/* CLK Yönetim — ürün listesi: müşteri ve Paraşüt'teki bir ya da birkaç satışı seçilir (aynı ürünler birleşir), ürünler sevkiyat ve kontrol listesi olarak yazdırılır */
(() => {
  const { sb, S, $, esc, toast, head, views, render } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/siparis-parasut';
  const FIRMA = ['CLK ÇANTA', 'Birlik Mah. 873 Sk. No:2/A Esenler / İstanbul', '0534 077 88 67', 'www.clkcanta.com'];
  const D = (S.ui.ul ||= { musteriler: null, musteri: '', satislar: null, secili: [], okunan: {}, kalemler: [], bilgi: { musteri: '', no: '', tarih: '' }, yukleniyor: '', durum: '' });
  const tlE = v => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0) + ' ₺';
  const trT = d => d ? String(d).split('-').reverse().join('.') : '';
  const sayi = v => { const n = Number(String(v ?? '').replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const yuvarla = n => Math.round(n * 100) / 100;

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
    D.musteri = id; D.satislar = null; D.secili = []; D.okunan = {}; D.yukleniyor = 'satislar'; D.durum = ''; render();
    try { const l = await sor({ islem: 'satislar', id }); if (D.musteri === id) D.satislar = l; }
    catch (e) { D.durum = 'Satışlar alınamadı: ' + e.message; D.satislar = []; }
    D.yukleniyor = ''; render();
  }
  // seçilen faturalar sırayla okunur (Paraşüt aynı anda gelen girişleri reddediyor), aynı ürün + aynı fiyat tek satırda toplanır
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
      const fat = secim.map(id => D.okunan[id]).sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));
      const bir = new Map();
      for (const v of fat) for (const [urun, miktar, fiyat, tutar] of v.kalemler) {
        const k = urun + '|' + fiyat, x = bir.get(k);
        if (x) { x.miktar = yuvarla(x.miktar + miktar); x.tutar = yuvarla(x.tutar + tutar); }
        else bir.set(k, { urun, miktar, fiyat, tutar });
      }
      D.kalemler = [...bir.values()];
      D.bilgi = { musteri: fat[0]?.musteri || '', no: fat.map(v => v.no).filter(Boolean).join(', '), tarih: fat.at(-1)?.tarih || '' };
      D.durum = fat.length ? `${fat.length} fatura, ${D.kalemler.length} kalem${fat.length > 1 ? ' (aynı ürünler birleştirildi)' : fat[0].aciklama ? ' (' + fat[0].aciklama + ')' : ''}. Kontrol edip "Yazdır"a basın.` : '';
    } catch (e) { D.durum = 'Satış okunamadı: ' + e.message; }
    finally { if (D.secili.join() === secim.join()) { D.yukleniyor = ''; render(); } }
  }
  function sec(ids) {
    D.secili = ids; D.kalemler = [];
    if (ids.length) secimiOku(); else { D.durum = ''; render(); }
  }

  const toplam = (l = D.kalemler) => yuvarla(l.reduce((a, k) => a + (Number(k.tutar) || 0), 0));
  const adet = (l = D.kalemler) => l.reduce((a, k) => a + (Number(k.miktar) || 0), 0);

  // West Polo'daki "Sevkiyat ve kontrol listesi" tasarımı (A4, kontrol kutulu)
  // West Polo sayfası da aynı tasarımı kullanır: CLK.kontrolListesi(başlık, [[etiket, değer]], [{urun, miktar, fiyat, tutar}])
  function sayfaHtml(baslik = 'Ürün Listesi', bilgiler = [['Müşteri', D.bilgi.musteri], D.bilgi.no && [D.bilgi.no.includes(',') ? 'Faturalar' : 'Fatura no', D.bilgi.no], D.bilgi.tarih && ['Tarih', trT(D.bilgi.tarih)]].filter(Boolean), kalemler = D.kalemler) {
    const satirlar = kalemler.filter(k => k.urun);
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
    .meta span{font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:#666;padding-top:1px} .meta b{font-weight:600;text-align:right}
    table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
    th{font-size:8px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#555;text-align:right;padding:0 5px 6px;border-bottom:1.5px solid #111}
    td{padding:4.5px 5px;text-align:right;white-space:nowrap;border-bottom:.5px solid #d4d4d4} tbody tr:nth-child(even) td{background:#f5f5f3}
    th.l,td.l{text-align:left} td.n{color:#999;width:22px;text-align:left} td.u{font-weight:500;white-space:normal}
    th.k,td.k{text-align:center;width:50px} table.liste{font-size:10px}
    .kutu{display:inline-block;width:17px;height:17px;border:1.6px solid #111;border-radius:3px;background:#fff;vertical-align:middle}
    tr{break-inside:avoid} .alt{display:flex;justify-content:flex-end;margin-top:14px;break-inside:avoid}
    .toplam{min-width:260px;border-top:1.5px solid #111} .toplam div{display:flex;justify-content:space-between;align-items:baseline;padding:6px 2px} .toplam div+div{border-top:.5px solid #bbb}
    .toplam span{font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:#555} .toplam .buyuk b{font-size:19px;font-weight:400}
    .imza{display:grid;grid-template-columns:1.8fr 1fr 1fr;gap:22px;margin-top:26px;break-inside:avoid}
    .imza div{border-top:.8px solid #111;padding-top:5px;font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:#555;height:62px}
    .not{margin-top:22px;padding:9px 12px;border:1px solid #111;border-radius:3px;text-align:center;font-size:10px;break-inside:avoid} .not b{font-weight:600}
    .son{margin-top:14px;text-align:center;font-size:11px;font-style:italic;color:#333;break-inside:avoid} .son b{font-style:normal;letter-spacing:.12em;font-weight:600}
    </style></head><body><table class="sayfa"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot><tbody><tr><td>
    <div class="ust"><img src="${logo}" alt="CLK"><div class="marka serif">${esc(FIRMA[0])}</div>
      <div class="susleme"><i></i><b></b><i></i></div>
      <div class="iletisim">${FIRMA.slice(1).map(l => `<span>${esc(l)}</span>`).join('')}</div></div>
    <div class="cizgi"></div>
    <div class="baslik"><h1 class="serif"><small>Sevkiyat ve kontrol listesi</small>${esc(baslik)}</h1>
      <div class="meta">${bilgiler.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div></div>
    <table class="liste"><thead><tr><th class="l" colspan="2">Ürün</th><th>Miktar</th><th>Birim</th><th>Br. fiyat</th><th>Tutar</th><th class="k">Kontrol</th></tr></thead><tbody>
    ${satirlar.map((k, i) => `<tr><td class="n">${i + 1}</td><td class="l u">${esc(k.urun)}</td><td>${k.miktar}</td><td>Adet</td><td>${tlE(k.fiyat)}</td><td>${tlE(k.tutar)}</td><td class="k"><span class="kutu"></span></td></tr>`).join('')}
    </tbody></table>
    <div class="alt"><div class="toplam"><div><span>Kalem</span><b>${satirlar.length}</b></div><div><span>Toplam adet</span><b>${adet(satirlar)}</b></div>
      <div class="buyuk"><span>Genel toplam</span><b class="serif">${tlE(toplam(satirlar))}</b></div></div></div>
    <div class="imza"><div>Sayan / kolileyen</div><div>Koli sayısı</div><div>Tarih / imza</div></div>
    <div class="not">Eksik veya hatalı ürünleriniz için lütfen bizimle iletişime geçiniz: <b>${esc(FIRMA[2])}</b></div>
    <div class="son serif">Diğer ürünlerimiz için web sitemizi ziyaret etmeyi unutmayın · <b>${esc(FIRMA[3])}</b></div></td></tr></tbody></table></body></html>`;
  }
  // gizli çerçevede açılıp yazdırma penceresi gelir (telefonda PDF olarak kaydedilebilir)
  function yazdir(html = sayfaHtml()) {
    const f = Object.assign(document.createElement('iframe'), { style: 'position:fixed;right:0;bottom:0;width:0;height:0;border:0' });
    document.body.append(f);
    f.srcdoc = html;
    f.onload = () => { setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); }, 300); };
  }
  CLK.kontrolListesi = (baslik, bilgiler, kalemler) => yazdir(sayfaHtml(baslik, bilgiler, kalemler));
  function indir() {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([sayfaHtml()], { type: 'text/html' })), download: `urun-listesi-${(D.bilgi.musteri || 'musteri').toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]+/gi, '-').replace(/^-|-$/g, '')}${D.bilgi.tarih ? '-' + D.bilgi.tarih : ''}.html` });
    document.body.append(a); a.click(); a.remove();
  }

  const satirHtml = (k, i) => `<tr data-i="${i}">
    <td class="ul-urun"><input data-f="urun" value="${esc(k.urun)}" aria-label="Ürün ${i + 1}"></td>
    <td><input data-f="miktar" inputmode="decimal" value="${esc(String(k.miktar).replace('.', ','))}" aria-label="Miktar ${i + 1}"></td>
    <td><input data-f="fiyat" inputmode="decimal" value="${esc(String(k.fiyat).replace('.', ','))}" aria-label="Fiyat ${i + 1}"></td>
    <td class="num">${tlE(k.tutar)}</td>
    <td><button class="btn sm" data-act="ulSil" data-i="${i}" aria-label="Satırı sil">×</button></td></tr>`;

  views.urunlistesi = () => {
    if (!D.musteriler) musteriler().catch(e => { D.durum = 'Müşteri listesi alınamadı: ' + e.message; D.musteriler = []; render(); });
    const sat = D.satislar;
    return `${head('Paraşüt', 'Ürün listesi', 'Müşteriyi ve Paraşüt\'teki bir ya da birkaç satışı seçin, aynı ürünler tek satırda toplanır; ürünler sevkiyatta işaretlenecek kontrol listesi olarak yazdırılır.')}
      <div class="card">
        <div class="ek-form ul-sec">
          <label class="ek-mus">Müşteri<select id="ulMusteri">${D.musteriler ? `<option value="">Müşteri seçin (${D.musteriler.length})</option>${D.musteriler.map(m => `<option value="${esc(m.id)}" ${m.id === D.musteri ? 'selected' : ''}>${esc(m.ad)}</option>`).join('')}` : '<option value="">Müşteriler yükleniyor…</option>'}</select></label>
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
          <tbody id="ulGovde">${D.kalemler.map(satirHtml).join('')}</tbody></table></div>
        <div class="ek-dug">
          <button class="btn dark" data-act="ulYazdir">Yazdır</button>
          <button class="btn" data-act="ulIndir">Dosya olarak indir</button>
          <button class="btn" data-act="ulEkle">Satır ekle</button>
        </div>
      </div>` : ''}`;
  };

  views.bind_urunlistesi = () => {
    $('#ulMusteri')?.addEventListener('change', e => { D.kalemler = []; if (e.target.value) satislariAl(e.target.value); else { D.musteri = ''; D.satislar = null; render(); } });
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

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'ulYazdir') yazdir(sayfaHtml());
    else if (act === 'ulIndir') { indir(); toast('Liste indirildi'); }
    else if (act === 'ulSon') { S.keepScroll = true; sec(D.satislar.filter(x => x[5] === 'invoice').slice(0, +el.dataset.n).map(x => x[0])); }
    else if (act === 'ulTemizle') { S.keepScroll = true; sec([]); }
    else if (act === 'ulEkle') { D.kalemler.push({ urun: '', miktar: 1, fiyat: 0, tutar: 0 }); S.keepScroll = true; render(); }
    else if (act === 'ulSil') { D.kalemler.splice(+el.dataset.i, 1); S.keepScroll = true; render(); }
    else prevAct?.(act, el, e);
  };
})();
