/* CLK Yönetim — ürün listesi: müşteri ve Paraşüt'teki bir ya da birkaç satışı seçilir (her satış kendi tarihiyle ayrı bölüm), ürünler sevkiyat ve kontrol listesi olarak yazdırılır */
(() => {
  const { sb, S, $, esc, toast, head, views, render, araKutu, araSec } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/siparis-parasut';
  const FIRMA = ['CLK ÇANTA', 'Birlik Mah. 873 Sk. No:2/A Esenler / İstanbul', '0534 077 88 67', 'www.clkcanta.com'];
  const D = (S.ui.ul ||= { musteriler: null, musteri: '', satislar: null, secili: [], okunan: {}, gruplar: [], kalemler: [], bilgi: { musteri: '', no: '', tarih: '' }, bakiyeGoster: false, bakiye: null, yukleniyor: '', durum: '' });
  const tlE = v => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0) + ' ₺';
  const trT = d => d ? String(d).split('-').reverse().join('.') : '';
  const sayi = v => { const n = Number(String(v ?? '').replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const yuvarla = n => Math.round(n * 100) / 100;
  // müşteriye giden fatura no: CLK-SF + Paraşüt fatura id'sinden türeyen rakam-harf-rakam-harf (aynı faturada hep aynı, ör. CLK-SF4A8D)
  const sfNo = id => {
    let h = 2166136261;
    for (const c of 'sf' + id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    const H = 'ABCDEFGHJKLMNPRSTUVYZ';
    return 'CLK-SF' + (h % 10) + H[(h >>> 4) % H.length] + ((h >>> 9) % 10) + H[(h >>> 13) % H.length];
  };
  // güncel Paraşüt bakiyesi: 5 dakikada bir yenilenen bakiye raporundan, yoksa müşteri listesinden
  async function bakiyeAl(id) {
    D.bakiye = null;
    try {
      const r = await sor({ islem: 'rapor' });
      const s = (r?.satirlar || []).find(x => String(x.parasut_id) === String(id));
      if (s && s.parasut_bakiye !== null) { D.bakiye = { tutar: Number(s.parasut_bakiye), zaman: r.zaman }; return; }
    } catch { }
    const { data } = await sb.from('sp_parasut_musteri').select('bakiye,guncel').eq('id', id).maybeSingle();
    if (data) D.bakiye = { tutar: Number(data.bakiye) || 0, zaman: data.guncel };
  }

  async function sor(govde) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.hata) throw new Error(j?.hata || 'Sunucu ' + r.status);
    return j;
  }
  async function musteriler() {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await sb.from('sp_parasut_musteri').select('id,ad').range(i, i + 999);
      if (error) throw new Error(error.message);
      out.push(...data); if (data.length < 1000) break;
    }
    D.musteriler = out.sort((a, b) => a.ad.localeCompare(b.ad, 'tr')); render();
  }
  async function satislariAl(id) {
    D.musteri = id; D.satislar = null; D.secili = []; D.bakiye = null; if (D.bakiyeGoster) bakiyeAl(id).then(render); D.okunan = {}; D.yukleniyor = 'satislar'; D.durum = ''; render();
    try { const l = await sor({ islem: 'satislar', id }); if (D.musteri === id) D.satislar = l; }
    catch (e) { D.durum = 'Satışlar alınamadı: ' + e.message; D.satislar = []; }
    D.yukleniyor = ''; render();
  }
  // seçilen faturalar sırayla okunur (Paraşüt aynı anda gelen girişleri reddediyor); her satış eski tarihten yeniye ayrı bölüm olur
  async function secimiOku() {
    const secim = D.secili.slice();
    D.yukleniyor = 'satis'; render();
    try {
      for (const [i, id] of secim.entries()) {
        if (D.okunan[id]) continue;
        D.durum = `Satış Paraşüt'ten okunuyor (${i + 1}/${secim.length})…`; render();
        D.okunan[id] = await sor({ islem: 'satis', id });
        if (D.secili.join() !== secim.join()) return;
      }
      // numarası olmayan faturaya CLK-SF numarası hemen Paraşüt'e yazılır; numarası olan (ör. CLK-WEST) kendi numarasıyla kalır
      const yeni = secim.filter(id => !D.okunan[id].no);
      if (yeni.length) {
        D.durum = 'Fatura numarası Paraşüt\'e yazılıyor…'; render();
        try { for (const x of await sor({ islem: 'sf_no', idler: yeni })) if (x.no && !x.hata) D.okunan[x.id].no = x.no; }
        catch (e) { toast('Numara Paraşüt\'e yazılamadı: ' + e.message); }
        if (D.secili.join() !== secim.join()) return;
      }
      const fat = secim.map(id => D.okunan[id]).sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));
      D.gruplar = fat.map(v => ({ no: v.no || sfNo(v.id), tarih: v.tarih || '' }));
      D.kalemler = fat.flatMap((v, g) => v.kalemler.map(([urun, miktar, fiyat, tutar]) => ({ urun, miktar, fiyat, tutar, g })));
      D.bilgi = { musteri: fat[0]?.musteri || '', no: fat.map(v => v.no || sfNo(v.id)).join(', '), tarih: fat.at(-1)?.tarih || '' };
      D.durum = fat.length ? `${fat.length} satış, ${D.kalemler.length} kalem${fat.length > 1 ? ' (her satış tarihiyle ayrı bölümde)' : fat[0].aciklama ? ' (' + fat[0].aciklama + ')' : ''}. Kontrol edip "Yazdır"a basın.` : '';
    } catch (e) { D.durum = 'Satış okunamadı: ' + e.message; }
    finally { if (D.secili.join() === secim.join()) { D.yukleniyor = ''; render(); } }
  }
  function sec(ids) {
    D.secili = ids; D.kalemler = []; D.gruplar = [];
    if (ids.length) secimiOku(); else { D.durum = ''; render(); }
  }

  const toplam = (l = D.kalemler) => yuvarla(l.reduce((a, k) => a + (Number(k.tutar) || 0), 0));
  const adet = (l = D.kalemler) => l.reduce((a, k) => a + (Number(k.miktar) || 0), 0);

  // West Polo'daki "Sevkiyat ve kontrol listesi" tasarımı (A4, kontrol kutulu)
  // West Polo sayfası da aynı tasarımı kullanır: CLK.kontrolListesi(başlık, [[etiket, değer]], [{urun, miktar, fiyat, tutar}])
  function sayfaHtml(baslik = 'Ürün Listesi', bilgiler = [['Müşteri', D.bilgi.musteri], D.bilgi.no && [D.bilgi.no.includes(',') ? 'Faturalar' : 'Fatura no', D.bilgi.no], D.bilgi.tarih && ['Tarih', trT(D.bilgi.tarih)]].filter(Boolean), kalemler = D.kalemler, gruplar = D.gruplar) {
    const satirlar = kalemler.filter(k => k.urun);
    const bolumler = gruplar.length > 1 ? gruplar.map((b, g) => ({ b, g, l: satirlar.filter(k => k.g === g) })).filter(x => x.l.length) : [{ l: satirlar }];
    const satirYaz = l => l.map((k, i) => `<tr><td class="n">${i + 1}</td><td class="l u">${esc(k.urun)}</td><td>${k.miktar}</td><td>Adet</td><td>${tlE(k.fiyat)}</td><td>${tlE(k.tutar)}</td><td class="k"><span class="kutu"></span></td></tr>`).join('');
    const logo = new URL('logo-clk.png', location.href).href;
    return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title> </title><style>
    *{box-sizing:border-box}
    @page{size:A4;margin:0}
    table.sayfa{width:100%;table-layout:fixed;border-collapse:collapse} .sayfa>thead>tr>td,.sayfa>tfoot>tr>td,.sayfa>tbody>tr>td{padding:0;border:0;background:none;white-space:normal;text-align:left}
    .sayfa>thead>tr>td{height:14mm} .sayfa>tfoot>tr>td{height:14mm}
    body{margin:0;padding:0 13mm;color:#111;font:10.5px/1.45 "Segoe UI",system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .serif{font-family:"Didot","Bodoni MT","Playfair Display",Georgia,"Times New Roman",serif}
    .ust{text-align:center;padding:4px 0 0} .ust img{height:78px;display:block;margin:0 auto 10px}
    .marka{font-size:17px;letter-spacing:.62em;margin:0 0 0 .62em;font-weight:400}
    .susleme{display:flex;align-items:center;justify-content:center;gap:10px;margin:9px auto 8px;width:62%}
    .susleme i{flex:1;height:0;border-top:.6px solid #111} .susleme b{width:6px;height:6px;background:#111;transform:rotate(45deg)}
    .iletisim{font-size:8px;letter-spacing:.24em;text-transform:uppercase;color:#444} .iletisim span+span:before{content:"·";margin:0 .9em;color:#999}
    .cizgi{height:4px;border-top:1.6px solid #111;border-bottom:.5px solid #111;margin:14px 0 18px}
    .baslik{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:16px}
    h1{font-size:30px;font-weight:400;margin:0;line-height:1;letter-spacing:.01em}
    h1 small{display:block;font:600 8.5px/1 "Segoe UI",sans-serif;letter-spacing:.28em;color:#777;margin-bottom:8px;text-transform:uppercase}
    .meta{border:1px solid #111;border-radius:3px;min-width:230px} .meta div{display:flex;justify-content:space-between;gap:16px;padding:5px 10px} .meta div+div{border-top:.5px solid #bbb}
    .meta span{font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:#666;padding-top:1px} .meta b{font-weight:600;text-align:right;white-space:nowrap}
    table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
    th{font-size:8px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#555;text-align:right;padding:0 5px 6px;border-bottom:1.5px solid #111}
    td{padding:4.5px 5px;text-align:right;white-space:nowrap;border-bottom:.5px solid #d4d4d4} tbody tr:nth-child(even) td{background:#f5f5f3}
    th.l,td.l{text-align:left} td.n{color:#999;width:22px;text-align:left} td.u{font-weight:500;white-space:normal}
    th.k,td.k{text-align:center;width:50px} table.liste{font-size:10px}
    .kutu{display:inline-block;width:17px;height:17px;border:1.6px solid #111;border-radius:3px;background:#fff;vertical-align:middle}
    tr{break-inside:avoid} tr.grup td{background:#fff!important;border-bottom:1.2px solid #111;padding:14px 5px 5px;text-align:left;font-size:11px;letter-spacing:.04em;break-after:avoid} tr.grup b{font-weight:700;text-transform:uppercase;letter-spacing:.14em} tr.grup span{float:right;color:#555;font-size:9.5px} .alt{display:flex;justify-content:flex-end;margin-top:14px;break-inside:avoid}
    .toplam{min-width:260px;border-top:1.5px solid #111} .toplam div{display:flex;justify-content:space-between;align-items:baseline;padding:6px 2px} .toplam div+div{border-top:.5px solid #bbb}
    .toplam span{font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:#555} .toplam .buyuk b{font-size:19px;font-weight:400}
    .imza{display:grid;grid-template-columns:1.8fr 1fr 1fr;gap:22px;margin-top:26px;break-inside:avoid}
    .imza div{border-top:.8px solid #111;padding-top:5px;font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:#555;height:62px}
    .not{margin-top:22px;padding:9px 12px;border:1px solid #111;border-radius:3px;text-align:center;font-size:10px;break-inside:avoid} .not b{font-weight:600}
    .toplam .bakiye{border-top:1.5px solid #111} .toplam .bakiye b{font-size:14px;font-weight:600} .bakiye small{display:block;font-size:7.5px;color:#888;letter-spacing:.04em;text-transform:none;margin-top:2px}
    .son{margin-top:14px;text-align:center;font-size:11px;font-style:italic;color:#333;break-inside:avoid} .son b{font-style:normal;letter-spacing:.12em;font-weight:600}
    </style></head><body><table class="sayfa"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot><tbody><tr><td>
    <div class="ust"><img src="${logo}" alt="CLK"><div class="marka serif">${esc(FIRMA[0])}</div>
      <div class="susleme"><i></i><b></b><i></i></div>
      <div class="iletisim">${FIRMA.slice(1).map(l => `<span>${esc(l)}</span>`).join('')}</div></div>
    <div class="cizgi"></div>
    <div class="baslik"><h1 class="serif"><small>Sevkiyat ve kontrol listesi</small>${esc(baslik)}</h1>
      <div class="meta">${bilgiler.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div></div>
    <table class="liste"><thead><tr><th class="l" colspan="2">Ürün</th><th>Miktar</th><th>Birim</th><th>Br. fiyat</th><th>Tutar</th><th class="k">Kontrol</th></tr></thead><tbody>
    ${bolumler.map(({ b, g, l }) => (b ? `<tr class="grup"><td colspan="7"><b>${g + 1}. satış</b> · ${esc(trT(b.tarih))}${b.no ? ' · ' + esc(b.no) : ''}<span>${l.length} kalem · ${adet(l)} adet · ${tlE(toplam(l))}</span></td></tr>` : '') + satirYaz(l)).join('')}
    </tbody></table>
    <div class="alt"><div class="toplam"><div><span>Kalem</span><b>${satirlar.length}</b></div><div><span>Toplam adet</span><b>${adet(satirlar)}</b></div>
      <div class="buyuk"><span>Genel toplam</span><b class="serif">${tlE(toplam(satirlar))}</b></div>${bakiyeHtml(kalemler === D.kalemler)}</div></div>
    <div class="imza"><div>Sayan / kolileyen</div><div>Koli sayısı</div><div>Tarih / imza</div></div>
    <div class="not">Eksik veya hatalı ürünleriniz için lütfen bizimle iletişime geçiniz: <b>${esc(FIRMA[2])}</b></div>
    <div class="son serif">Diğer ürünlerimiz için web sitemizi ziyaret etmeyi unutmayın · <b>${esc(FIRMA[3])}</b></div></td></tr></tbody></table></body></html>`;
  }
  const bakiyeYazi = t => tlE(Math.abs(t)) + (t > 0.004 ? ' borç' : t < -0.004 ? ' alacak' : '');
  const bakiyeHtml = ulMu => !ulMu || !D.bakiyeGoster || !D.bakiye ? '' : `<div class="bakiye"><span>Güncel bakiye<small>${esc(new Date(D.bakiye.zaman || Date.now()).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }))} itibarıyla</small></span><b>${esc(bakiyeYazi(D.bakiye.tutar))}</b></div>`;
  // gizli çerçevede açılıp yazdırma penceresi gelir (telefonda PDF olarak kaydedilebilir)
  function yazdir(html = sayfaHtml()) {
    const f = Object.assign(document.createElement('iframe'), { style: 'position:fixed;right:0;bottom:0;width:0;height:0;border:0' });
    document.body.append(f);
    f.srcdoc = html;
    f.onload = () => { setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); }, 300); };
  }
  CLK.kontrolListesi = (baslik, bilgiler, kalemler) => yazdir(sayfaHtml(baslik, bilgiler, kalemler, []));
  // PDF: liste gizli bir çerçevede çizilir, html2pdf ile A4 PDF olarak indirilir
  // dosya adı yalnız fatura numarası (celik isteği 29.10.2026); birden çok faturada numaralar alt çizgiyle
  const dosyaAdi = () => (D.bilgi.no ? D.bilgi.no.split(',').map(x => x.replace(/\s+/g, '')).filter(Boolean).join('_') : 'CLKCANTA-' + D.bilgi.tarih.split('-').reverse().join('.')) + '.pdf';
  function indir() {
    return new Promise((tamam, hata) => {
      const f = Object.assign(document.createElement('iframe'), { style: 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0' });
      document.body.append(f);
      const ad = JSON.stringify(dosyaAdi());
      f.srcdoc = sayfaHtml().replace('</body>', `<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></` + `script><script>
        document.querySelectorAll('.sayfa>thead td,.sayfa>tfoot td').forEach(t => t.style.height = '0');
        html2pdf().set({ margin: [12, 0, 12, 0], filename: ${ad}, image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4' }, pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.alt', '.imza', '.not', '.son'] } })
          .from(document.body).save().then(() => parent.postMessage('ulPdfTamam', '*'), e => parent.postMessage('ulPdfHata', '*'));
      </` + `script></body>`);
      const dinle = e => { if (e.source !== f.contentWindow) return; removeEventListener('message', dinle); setTimeout(() => f.remove(), 1000); e.data === 'ulPdfTamam' ? tamam() : hata(new Error('PDF oluşturulamadı')); };
      addEventListener('message', dinle);
    });
  }


  const satirHtml = (k, i) => `<tr data-i="${i}">
    <td class="ul-urun"><input data-f="urun" value="${esc(k.urun)}" aria-label="Ürün ${i + 1}"></td>
    <td><input data-f="miktar" inputmode="decimal" value="${esc(String(k.miktar).replace('.', ','))}" aria-label="Miktar ${i + 1}"></td>
    <td><input data-f="fiyat" inputmode="decimal" value="${esc(String(k.fiyat).replace('.', ','))}" aria-label="Fiyat ${i + 1}"></td>
    <td class="num">${tlE(k.tutar)}</td>
    <td><button class="btn sm" data-act="ulSil" data-i="${i}" aria-label="Satırı sil">×</button></td></tr>`;

  const grupHtml = g => { const b = D.gruplar[g] || {}, l = D.kalemler.filter(k => k.g === g);
    return `<tr class="ul-grup"><td colspan="5"><b>${g + 1}. satış</b> · ${esc(trT(b.tarih))}${b.no ? ' · ' + esc(b.no) : ''}<span>${l.length} kalem · ${adet(l)} adet · ${tlE(toplam(l))}</span></td></tr>`; };

  const secilenAd = () => D.musteriler?.find(m => m.id === D.musteri)?.ad || '';
  views.urunlistesi = () => {
    if (!D.musteriler) musteriler().catch(e => { D.durum = 'Müşteri listesi alınamadı: ' + e.message; D.musteriler = []; render(); });
    const sat = D.satislar;
    return `${head('Paraşüt', 'Ürün listesi', 'Müşteriyi ve Paraşüt\'teki bir ya da birkaç satışı seçin, her satış kendi tarihiyle ayrı bölümde listelenir; ürünler sevkiyatta işaretlenecek kontrol listesi olarak yazdırılır.')}
      <div class="card">
        <div class="ek-form ul-sec">
          <div class="ek-mus ara-alan"><label for="ulAra">Müşteri</label>${araKutu('ulAra', D.musteriler, secilenAd(), 'ulMus', { yer: D.musteriler ? 'Müşteri adı yazın (' + D.musteriler.length + ' müşteri)' : 'Müşteriler yükleniyor…' })}</div>
        </div>
        ${!D.musteri ? '' : !sat ? '<p class="ek-durum">Satışlar yükleniyor…</p>' : !sat.length ? '<p class="ek-durum">Bu müşterinin satışı yok.</p>' : `
        <div class="ul-sat-bas"><b>Satışlar</b><span>${D.secili.length ? D.secili.length + ' seçili' : 'Bir ya da birkaç fatura seçin'}</span>
          <span class="ul-hizli">${[1, 2, 3, 4].filter(n => n <= sat.length).map(n => `<button class="btn sm" data-act="ulSon" data-n="${n}">${n === 1 ? 'Son fatura' : 'Son ' + n}</button>`).join('')}${D.secili.length ? '<button class="btn sm" data-act="ulTemizle">Temizle</button>' : ''}</span></div>
        <div class="ul-satlar" id="ulSatlar">${sat.map(([id, t, no, tutar, ack, tur]) => `<label class="ul-sat${D.secili.includes(id) ? ' on' : ''}${tur !== 'invoice' ? ' iade' : ''}">
          <input type="checkbox" value="${esc(id)}" ${D.secili.includes(id) ? 'checked' : ''} ${D.yukleniyor === 'satis' ? 'disabled' : ''}>
          <span class="t">${esc(trT(t))}</span><span class="no">${esc(no || '—')}${tur !== 'invoice' ? ' · iade/iptal' : ''}${ack ? `<small>${esc(ack)}</small>` : ''}</span><span class="tt">${tlE(tutar)}</span></label>`).join('')}</div>`}
        ${D.durum ? `<p class="ek-durum" role="status">${esc(D.durum)}</p>` : ''}
      </div>
      ${D.kalemler.length ? `<div class="card">
        <div class="ek-form">
          <label class="ek-mus">Müşteri adı (listede)<input id="ulBMusteri" value="${esc(D.bilgi.musteri)}"></label>
          <label>${D.secili.length > 1 ? 'Faturalar' : 'Fatura no'}<input id="ulBNo" value="${esc(D.bilgi.no)}"></label>
          <label>Tarih<input id="ulBTarih" type="date" value="${esc(D.bilgi.tarih)}"></label>
        </div>
        <div class="ul-ozet"><span>Kalem <b>${D.kalemler.length}</b></span><span>Toplam adet <b>${adet()}</b></span><span>Genel toplam <b>${tlE(toplam())}</b></span></div>
        <div class="ul-tablo"><table><thead><tr><th>Ürün</th><th>Miktar</th><th>Br. fiyat</th><th>Tutar</th><th></th></tr></thead>
          <tbody id="ulGovde">${D.kalemler.map((k, i) => (D.gruplar.length > 1 && (i === 0 || D.kalemler[i - 1].g !== k.g) ? grupHtml(k.g) : '') + satirHtml(k, i)).join('')}</tbody></table></div>
        <div class="ek-dug">
          <button class="btn dark" data-act="ulYazdir">Yazdır</button>
          <button class="btn" data-act="ulIndir">PDF indir</button>
          <button class="btn" data-act="ulEkle">Satır ekle</button>
          <button class="btn${D.bakiyeGoster ? ' dark' : ''}" data-act="ulBakiye" aria-pressed="${D.bakiyeGoster}">${D.bakiyeGoster ? '✓ Bakiye listede' : 'Bakiyeyi göster'}</button>
        </div>
        ${D.bakiyeGoster ? `<p class="ek-durum">${D.bakiye ? `Listenin en altında: güncel cari bakiye <b>${esc(bakiyeYazi(D.bakiye.tutar))}</b>` : 'Bakiye alınıyor…'}</p>` : ''}
      </div>` : ''}`;
  };

  views.bind_urunlistesi = () => {
    $('#ulSatlar')?.addEventListener('change', e => { S.keepScroll = true; sec([...document.querySelectorAll('#ulSatlar input:checked')].map(x => x.value)); });
    $('#ulBMusteri')?.addEventListener('input', e => { D.bilgi.musteri = e.target.value; });
    $('#ulBNo')?.addEventListener('input', e => { D.bilgi.no = e.target.value; });
    $('#ulBTarih')?.addEventListener('change', e => { D.bilgi.tarih = e.target.value; });
    $('#ulGovde')?.addEventListener('change', e => {
      const i = +e.target.closest('tr')?.dataset.i, f = e.target.dataset.f, k = D.kalemler[i];
      if (!k || !f) return;
      if (f === 'urun') k.urun = e.target.value.trim().toLocaleUpperCase('tr');
      else { k[f] = sayi(e.target.value); k.tutar = yuvarla(k.miktar * k.fiyat); }
      S.keepScroll = true; render();
    });
  };

  araSec.ulMus = m => { D.kalemler = []; satislariAl(m.id); };
  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'ulYazdir') yazdir(sayfaHtml());
    else if (act === 'ulIndir') { toast('PDF hazırlanıyor…'); indir().then(() => toast('PDF indirildi'), e => toast(e.message)); }
    else if (act === 'ulSon') { S.keepScroll = true; sec(D.satislar.filter(x => x[5] === 'invoice').slice(0, +el.dataset.n).map(x => x[0])); }
    else if (act === 'ulTemizle') { S.keepScroll = true; sec([]); }
    else if (act === 'ulBakiye') { D.bakiyeGoster = !D.bakiyeGoster; S.keepScroll = true; if (D.bakiyeGoster && !D.bakiye && D.musteri) bakiyeAl(D.musteri).then(render); render(); }
    else if (act === 'ulEkle') { D.kalemler.push({ urun: '', miktar: 1, fiyat: 0, tutar: 0, g: D.kalemler.at(-1)?.g ?? 0 }); S.keepScroll = true; render(); }
    else if (act === 'ulSil') { D.kalemler.splice(+el.dataset.i, 1); S.keepScroll = true; render(); }
    else prevAct?.(act, el, e);
  };
})();
