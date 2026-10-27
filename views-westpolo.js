/* CLK Yönetim — West Polo: Han Dericilik PDF faturası okunur, kâr oranıyla CLK-WEST satış faturası ve WEST POLO alış faturası doğrudan Paraşüt'e girilir */
(() => {
  const { sb, S, $, esc, toast, head, views, render, araKutu, araSec } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/siparis-parasut';
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  const bugun = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const D = (S.ui.wp ||= { fat: null, dosya: '', mesaj: '', mesajTur: '', kar: '', musteriler: null, musteri: '', tarih: bugun(), isim: 'WEST POLO', sira: '', gecmis: null, alislar: null, gonderiliyor: false, uyari: '', durum: '' });
  const tl = v => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0) + ' ₺';
  const trT = d => d ? String(d).slice(0, 10).split('-').reverse().join('.') : '';
  const r2 = v => Math.round(v * 100) / 100;
  // satış fiyatı bir üst 5'liğe yuvarlanır: 110 → 110, 110,01 → 115
  const yukari5 = v => Math.ceil(Math.round(v * 100) / 500) * 5;

  async function sor(govde) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.hata) throw new Error(j?.hata || 'Sunucu ' + r.status);
    return j;
  }
  async function hazirla() {
    D.musteriler = [];
    try {
      const out = [];
      for (let i = 0; ; i += 1000) {
        const { data, error } = await sb.from('sp_parasut_musteri').select('id,ad').range(i, i + 999);
        if (error) throw new Error(error.message);
        out.push(...data); if (data.length < 1000) break;
      }
      D.musteriler = out.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
      try { const son = localStorage.getItem('clk-wp-musteri'); if (!D.musteri && son && out.some(m => m.id === son)) D.musteri = son; } catch {}
    } catch (e) { D.durum = 'Müşteri listesi alınamadı: ' + e.message; }
    render();
    try { const v = await sor({ islem: 'westpolo_durum' }); D.gecmis = v.gecmis || []; if (!D.sira) D.sira = String(v.sira); }
    catch (e) { D.gecmis = []; D.durum = 'Sıra numarası Paraşüt\'ten alınamadı: ' + e.message; }
    render();
    // Paraşüt'teki alış fiyatları: değişen fiyat turuncu uyarı olur
    try { const v = await sor({ islem: 'urunler' }); D.alislar = new Map(v.urunler.map(u => [u[1], u[2]])); render(); } catch {}
  }

  // --- PDF: satırlar konumlarına göre birleştirilir, Han Dericilik fatura satırları ayrıştırılır ---
  let pdfjs;
  const pdfYukle = () => pdfjs ||= new Promise((ok, hata) => {
    const s = Object.assign(document.createElement('script'), { src: PDFJS + 'pdf.min.js', onload: () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(window.pdfjsLib); }, onerror: () => { pdfjs = null; hata(new Error('PDF okuyucu yüklenemedi')); } });
    document.head.append(s);
  });
  async function pdfSatirlar(pdf) {
    const lines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const tc = await (await pdf.getPage(p)).getTextContent(), rows = [];
      for (const it of tc.items) {
        if (!it.str.trim()) continue;
        const y = it.transform[5], x = it.transform[4];
        let row = rows.find(r => Math.abs(r.y - y) < 3);
        if (!row) rows.push(row = { y, items: [] });
        row.items.push({ x, s: it.str });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) lines.push(r.items.sort((a, b) => a.x - b.x).map(i => i.s.trim()).join('  '));
    }
    return lines;
  }
  const trNum = s => parseFloat(s.replace(/\./g, '').replace(',', '.'));
  function faturaAyir(lines) {
    const text = lines.join('\n');
    const no = (text.match(/Fatura\s+(\S+\/\d{4}\/\d+)/) || [])[1] || '';
    const d = text.match(/(\d{2})-(\d{2})-(\d{4})/);
    // "[kod]" öneki bazı satırlarda eksik olabiliyor; o zaman kod, açıklamanın ilk kelimesidir
    const re = /^(?:\[(\S+)\]\s*)?(\d\S*\s.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*₺/;
    const kalemler = [];
    for (const l of lines) {
      const m = l.match(re);
      if (!m) continue;
      const [, kodEk, ad, mk, bf, ind, tut] = m;
      const kod = kodEk || ad.split(/\s+/)[0];
      // Paraşüt ürün adı "WEST POLO <kod> <renk>"; aynı renk tek yazımla (KAHVERENGİ → KAHVE), "ÇANTA" alınmaz
      const renk = ad.trim().replace(/MEKANIZMALI/g, 'MEKANİZMALI').replace(/KAHVERENG[İI]/g, 'KAHVE').replace(new RegExp('^' + kod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*'), '').replace(/\s*ÇANTA$/, '');
      kalemler.push({ kod, urun: `WEST POLO ${kod} ${renk}`.trim(), miktar: trNum(mk), liste: trNum(bf), indirim: trNum(ind), tutar: trNum(tut) });
    }
    const t = text.match(/Toplam\s+([\d.,]+)\s*₺/);
    return { no, tarih: d ? `${d[3]}-${d[2]}-${d[1]}` : '', kalemler, toplam: t ? trNum(t[1]) : null };
  }
  async function oku(file) {
    D.fat = null; D.dosya = file.name; D.uyari = ''; D.mesaj = 'PDF okunuyor…'; D.mesajTur = ''; render();
    try {
      const lib = await pdfYukle();
      const f = faturaAyir(await pdfSatirlar(await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise));
      const sum = r2(f.kalemler.reduce((a, k) => a + k.tutar, 0));
      if (!f.kalemler.length) { D.mesaj = 'Bu PDF\'te ürün satırı bulunamadı. Han Dericilik faturası olduğundan emin olun.'; D.mesajTur = 'err'; }
      else if (f.toplam == null || Math.abs(sum - f.toplam) > 0.01) { D.mesaj = `Satırların toplamı (${tl(sum)}) PDF'teki toplamla (${f.toplam == null ? 'bulunamadı' : tl(f.toplam)}) tutmuyor, bazı satırlar okunamamış olabilir.`; D.mesajTur = 'err'; }
      else { D.fat = f; D.mesaj = `${f.no}: ${f.kalemler.length} satır okundu, toplam ${tl(f.toplam)} tutuyor.`; D.mesajTur = 'ok'; }
    } catch (e) { D.mesaj = 'PDF okunamadı: ' + e.message; D.mesajTur = 'err'; }
    render();
  }

  // maliyet = liste fiyatı - tedarikçi indirimi; satış = maliyet × (1 + kâr%), 5'liğe yuvarlı
  const kar = () => { const n = parseFloat(String(D.kar).replace(',', '.')); return n >= 0 ? n : NaN; };
  const kalemler = () => (D.fat?.kalemler || []).map(k => {
    const maliyet = r2(k.liste * (1 - k.indirim / 100)), fiyat = Number.isNaN(kar()) ? 0 : yukari5(maliyet * (1 + kar() / 100));
    return { ...k, maliyet, fiyat, satisTutar: r2(fiyat * k.miktar) };
  });
  const musteriAd = () => D.musteriler?.find(m => m.id === D.musteri)?.ad || '';
  const eksik = () => !D.fat ? 'Önce PDF faturayı seçin.' : Number.isNaN(kar()) ? 'Kâr oranını girin.' : !D.musteri ? 'Müşteriyi seçin.' : !(+D.sira >= 1) ? 'Sıra numarasını girin.' : !D.tarih ? 'Satış tarihini girin.' : '';
  const alisFarki = k => {
    const once = D.alislar?.get(k.urun);
    if (!(once > 0) || Math.abs(once - k.maliyet) < 0.01) return '';
    return `<span class="wp-fark">Önceki alış ${tl(once)} (${k.maliyet > once ? '+' : ''}${tl(k.maliyet - once)})</span>`;
  };

  async function gonder(zorla) {
    if (eksik() || D.gonderiliyor) return;
    const ks = kalemler();
    D.gonderiliyor = true; D.durum = 'Paraşüt\'e giriliyor: ürünler, satış ve alış faturası… (yarım dakika sürebilir)'; D.uyari = ''; render();
    try {
      const r = await sor({ islem: 'westpolo', kayit: { faturaNo: D.fat.no, alisTarih: D.fat.tarih, satisTarih: D.tarih, musteriId: D.musteri, sira: +D.sira, faturaIsmi: D.isim.trim() || 'WEST POLO', zorla: !!zorla,
        kalemler: ks.map(k => ({ urun: k.urun, miktar: k.miktar, alis: k.maliyet, satis: k.fiyat })) } });
      if (r.mukerrer) { D.uyari = r.mukerrer; D.durum = ''; }
      else {
        try { localStorage.setItem('clk-wp-musteri', D.musteri); } catch {}
        D.gecmis = [r, ...(D.gecmis || [])];
        D.durum = r.hata ? `${r.seri} ${r.sira} satış faturası girildi, ama ${r.hata}` : `${r.seri} ${r.sira} Paraşüt'e girildi: satış ${tl(r.satisToplam)}, alış ${tl(r.alisToplam)}.${r.not?.length ? ' ' + r.not.join(', ') + '.' : ''}`;
        toast(r.hata ? 'Satış girildi, alış girilemedi' : 'Paraşüt\'e girildi');
        D.fat = null; D.dosya = ''; D.mesaj = ''; D.kar = ''; D.sira = String(r.sira + 1);
      }
    } catch (e) { D.durum = 'Gönderilemedi: ' + e.message; }
    D.gonderiliyor = false; render();
  }
  const satisYazdir = () => { const ks = kalemler(); CLK.kontrolListesi('Satış Faturası', [['Müşteri', musteriAd()], ['Fatura no', `CLK-WEST ${D.sira}`], ['Tarih', trT(D.tarih)]], ks.map(k => ({ urun: k.urun, miktar: k.miktar, fiyat: k.fiyat, tutar: k.satisTutar }))); };
  const alisYazdir = () => CLK.kontrolListesi('Alış Faturası', [['Kayıt ismi', musteriAd() || '–'], ['Tedarikçi', 'WEST POLO'], ['Fatura no', D.fat.no], ['Tarih', trT(D.fat.tarih)], ['Kategori', 'WEST']],
    kalemler().map(k => ({ urun: k.urun, miktar: k.miktar, fiyat: k.maliyet, tutar: k.tutar })));

  views.westpolo = () => {
    if (!D.musteriler) hazirla();
    const ks = kalemler(), e = eksik(), k = kar();
    return `${head('Paraşüt', 'West Polo', 'Han Dericilik PDF faturasını seçin, kâr oranını ve müşteriyi girin. "Paraşüt\'e gönder" satış (CLK-WEST) ve alış (WEST POLO) faturasını doğrudan Paraşüt\'e girer; eksik ürün kendiliğinden açılır.')}
      <div class="card">
        <label class="wp-drop" id="wpDrop"><input type="file" id="wpDosya" accept="application/pdf" hidden>
          <b>${D.dosya ? esc(D.dosya) : 'Alış faturası PDF\'ini seçin'}</b><small>Buraya sürükleyin ya da dokunup seçin</small></label>
        ${D.mesaj ? `<p class="wp-msg ${D.mesajTur}" role="status">${esc(D.mesaj)}</p>` : ''}
      </div>
      <div class="card">
        <div class="ek-form wp-form">
          <label>Kâr oranı (%)<input id="wpKar" inputmode="decimal" placeholder="örn. 15" value="${esc(D.kar)}" class="${Number.isNaN(k) ? 'wp-req' : ''}"></label>
          <div class="ek-mus ara-alan"><label for="wpMusteri">Müşteri (Paraşüt)</label>${araKutu('wpMusteri', D.musteriler, D.musteriler?.find(m => m.id === D.musteri)?.ad || '', 'wpMus', { sinif: D.musteri ? '' : 'wp-req', yer: D.musteriler ? 'Müşteri adı yazın (' + D.musteriler.length + ' müşteri)' : 'Müşteriler yükleniyor…' })}</div>
          <label>Satış tarihi<input id="wpTarih" type="date" value="${esc(D.tarih)}"></label>
          <label>Fatura sıra (CLK-WEST)<input id="wpSira" inputmode="numeric" value="${esc(D.sira)}" placeholder="${D.gecmis ? '' : 'alınıyor…'}"></label>
          <label>Fatura ismi<input id="wpIsim" value="${esc(D.isim)}"></label>
        </div>
        <p class="wp-not">Listede olmayan yeni müşteriyi önce Paraşüt'te açın; sonra Paraşüt sayfasındaki "Şimdi eşitle" ile listeye gelir.</p>
      </div>
      ${D.fat ? `<div class="card">
        <div class="ul-ozet"><span>Fatura <b>${esc(D.fat.no)}</b></span><span>Alış tarihi <b>${trT(D.fat.tarih)}</b></span><span>Satır <b>${ks.length}</b></span><span>Alış toplamı <b>${tl(D.fat.toplam)}</b></span><span>Satış toplamı (KDV 0) <b>${Number.isNaN(k) ? '–' : tl(ks.reduce((a, x) => a + x.satisTutar, 0))}</b></span></div>
        <div class="ul-tablo"><table class="wp-tablo"><thead><tr><th>Ürün</th><th>Miktar</th><th>Liste</th><th>İnd. %</th><th>Maliyet (alış)</th><th>Satış fiyatı</th><th>Satış tutarı</th></tr></thead>
          <tbody>${ks.map(x => `<tr><td>${esc(x.urun)}</td><td>${x.miktar}</td><td>${tl(x.liste)}</td><td>${x.indirim}</td><td>${tl(x.maliyet)}${alisFarki(x)}</td><td>${Number.isNaN(k) ? '–' : tl(x.fiyat)}</td><td>${Number.isNaN(k) ? '–' : tl(x.satisTutar)}</td></tr>`).join('')}</tbody></table></div>
        <p class="wp-not">Alış: tedarikçi WEST POLO, kategori WEST, fatura no ${esc(D.fat.no)}, kayıt ismi müşteri adı, KDV 0, stok girişi yapılır.</p>
      </div>` : ''}
      <div class="card">
        ${D.uyari ? `<div class="wp-uyari"><b>Dikkat:</b> ${esc(D.uyari)} Emin değilseniz göndermeyin.</div>` : ''}
        <div class="ek-dug">
          <button class="btn dark" data-act="wpGonder" ${e || D.gonderiliyor ? 'disabled' : ''}>${D.gonderiliyor ? 'Paraşüt\'e giriliyor…' : 'Paraşüt\'e gönder (satış + alış)'}</button>
          ${D.uyari ? `<button class="btn" data-act="wpZorla" ${D.gonderiliyor ? 'disabled' : ''}>Yine de gönder</button>` : ''}
          <button class="btn" data-act="wpSatisYaz" ${e ? 'disabled' : ''}>Satışı yazdır</button>
          <button class="btn" data-act="wpAlisYaz" ${D.fat ? '' : 'disabled'}>Alışı yazdır</button>
        </div>
        <p class="ek-durum" role="status">${esc(D.durum || e || `CLK-WEST ${D.sira} numarasıyla, ${musteriAd()} adına girilecek.`)}</p>
      </div>
      ${D.gecmis?.length ? `<div class="card"><h3 class="wp-h">Paraşüt'e girilenler</h3>
        <div class="ul-tablo"><table class="wp-tablo"><thead><tr><th>Girildi</th><th>Fatura</th><th>Müşteri</th><th>Satış</th><th>Alış</th><th>Not</th></tr></thead>
          <tbody>${D.gecmis.slice(0, 15).map(g => `<tr><td>${new Date(g.zaman).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</td><td>${esc(g.seri)} ${esc(g.sira)}<br><small>${esc(g.faturaNo)}</small></td><td>${esc(g.musteri)}</td><td>${tl(g.satisToplam)}</td><td>${g.hata ? '<b class="wp-hata">girilemedi</b>' : tl(g.alisToplam)}</td><td class="wp-notlar">${esc([g.hata, ...(g.not || [])].filter(Boolean).join(', '))}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
  };

  views.bind_westpolo = () => {
    const drop = $('#wpDrop'), dosya = $('#wpDosya');
    dosya?.addEventListener('change', () => dosya.files[0] && oku(dosya.files[0]));
    drop?.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('on'); });
    drop?.addEventListener('dragleave', () => drop.classList.remove('on'));
    drop?.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('on'); e.dataTransfer.files[0] && oku(e.dataTransfer.files[0]); });
    const alan = (id, k, olay = 'input') => $(id)?.addEventListener(olay, e => { D[k] = e.target.value; D.uyari = ''; S.keepScroll = true; render(); });
    alan('#wpKar', 'kar'); alan('#wpSira', 'sira'); alan('#wpIsim', 'isim');
    alan('#wpTarih', 'tarih', 'change');
  };

  araSec.wpMus = m => { D.musteri = m.id; D.uyari = ''; };
  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'wpGonder') gonder(false);
    else if (act === 'wpZorla') gonder(true);
    else if (act === 'wpSatisYaz') satisYazdir();
    else if (act === 'wpAlisYaz') alisYazdir();
    else prevAct?.(act, el, e);
  };
})();
