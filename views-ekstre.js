/* CLK Yönetim — müşteri ekstresi: Paraşüt'ten anında okunur, WhatsApp için resim olarak hazırlanır */
(() => {
  const { sb, S, $, esc, tl, toast, head, views, render } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/siparis-parasut';
  const gun = d => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const ilk = () => { const d = new Date(); d.setMonth(d.getMonth() - 3); d.setDate(1); return gun(d); };
  const D = (S.ui.ek ||= { musteriler: null, ad: '', bas: ilk(), son: gun(new Date()), veri: null, yukleniyor: false, durum: '', resim: '' });
  let blob = null;
  const tlE = v => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' ₺';
  const trE = d => d ? d.split('-').reverse().join('.') : '';

  async function musteriler() {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await sb.from('sp_parasut_musteri').select('id,ad,bakiye').range(i, i + 999);
      if (error) throw new Error(error.message);
      out.push(...data); if (data.length < 1000) break;
    }
    D.musteriler = out.sort((a, b) => a.ad.localeCompare(b.ad, 'tr')); render();
  }
  async function ekstreAl(id) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify({ islem: 'ekstre', id }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.hata) throw new Error(j.hata || 'Sunucu ' + r.status);
    return j;
  }

  // hareketleri sırala; devir = dönem öncesi + Paraşüt bakiyesiyle hareket toplamı arasındaki fark
  function hesapla(m, bas, son) {
    const h = [];
    for (const [t, no, v, ac] of m.satis || []) h.push({ t, s: 0, ack: 'Satış faturası' + (no ? ' ' + no : '') + (ac ? ' · ' + ac : ''), a: v, b: 0 });
    for (const [t, no, v] of m.iade || []) h.push({ t, s: 1, ack: 'İade' + (no ? ' · ' + no : ''), a: 0, b: v });
    for (const [t, tur, v, vade, seri, hesap] of m.odeme || [])
      h.push({ t, s: 2, v: vade, ack: tur === 'c' ? `Çek${seri ? ' no ' + seri : ''}${vade ? ' · vade ' + trE(vade) : ''}` : (hesap || 'Tahsilat'), cek: tur === 'c', a: 0, b: v });
    h.sort((x, y) => x.t.localeCompare(y.t) || x.s - y.s || String(x.v || '').localeCompare(String(y.v || '')));
    const fark = m.bakiye - h.reduce((s, x) => s + x.a - x.b, 0);
    const devir = fark + h.filter(x => x.t < bas).reduce((s, x) => s + x.a - x.b, 0);
    const satirlar = []; let kal = devir;
    for (const x of h.filter(x => x.t >= bas && x.t <= son)) { kal += x.a - x.b; satirlar.push({ ...x, kal }); }
    const alim = satirlar.reduce((s, x) => s + x.a, 0), odeme = satirlar.reduce((s, x) => s + x.b, 0);
    return { devir, satirlar, alim, odeme, sonBakiye: devir + alim - odeme };
  }

  // ekstre resmi: CLK Çanta Panel'deki ile aynı (WhatsApp için 1080 px genişlik)
  function ciz(m, bas, son) {
    const r = hesapla(m, bas, son);
    const W = 1080, P = 56, SAT = 46, F = "system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";
    const H = 560 + (r.satirlar.length + 1) * SAT + 150;
    const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
    const g = c.getContext('2d'); g.scale(2, 2);
    const yaz = (s, x, y, { b = 400, z = 20, r: sag = false, renk = '#1d2433', it = false } = {}) => {
      g.font = `${it ? 'italic ' : ''}${b} ${z}px ${F}`; g.fillStyle = renk; g.textAlign = sag ? 'right' : 'left'; g.fillText(s, x, y);
    };
    const kalanYaz = (v, x, y, b = 700) => v < -0.005 ? yaz(tlE(-v) + ' fazla', x, y, { b, z: 19, r: true, renk: '#1a7f4b' }) : yaz(tlE(v), x, y, { b, z: 19, r: true });
    const kutu = (x, y, w, h, rd, renk, cizgi) => { g.beginPath(); g.roundRect(x, y, w, h, rd); if (renk) { g.fillStyle = renk; g.fill(); } if (cizgi) { g.strokeStyle = cizgi; g.lineWidth = 1.5; g.stroke(); } };
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    yaz('CLK ÇANTA', P, 86, { b: 800, z: 38 });
    yaz('Birlik Mah. 873 Sok. No:2/A Esenler / İstanbul', P, 118, { z: 18, renk: '#5b6475' });
    yaz('0534 077 88 67', P, 144, { z: 18, renk: '#5b6475' });
    yaz('HESAP ÖZETİ', W - P, 86, { b: 800, z: 28, r: true });
    yaz(`${trE(bas)} – ${trE(son)}`, W - P, 118, { z: 18, r: true, renk: '#5b6475' });
    g.fillStyle = '#1d2433'; g.fillRect(P, 168, W - 2 * P, 4);
    yaz('Sayın', P, 214, { z: 17, renk: '#5b6475' });
    yaz(m.ad, P, 250, { b: 800, z: 30 });
    kutu(P, 278, W - 2 * P, 104, 14, '#1d2433');
    yaz(`${trE(son)} itibarıyla`, P + 30, 322, { z: 20, renk: '#fff' });
    const fazla = r.sonBakiye < -0.005;
    yaz(fazla ? 'fazla ödemeniz' : 'bize olan borcunuz', P + 30, 352, { z: 20, renk: '#fff' });
    yaz(tlE(Math.abs(r.sonBakiye)), W - P - 30, 348, { b: 800, z: 46, r: true, renk: fazla ? '#7ee2a8' : '#fff' });
    const kw = (W - 2 * P - 24) / 3;
    [[`${trE(bas)} öncesinden kalan`, r.devir, true], ['Bu dönemki satış faturaları', r.alim], ['Bu dönemki ödemeleriniz', r.odeme, false, '#1a7f4b']].forEach(([t, v, kal, renk], i) => {
      const x = P + i * (kw + 12);
      kutu(x, 402, kw, 92, 12, null, '#dde2ea');
      yaz(t, x + 18, 436, { z: 16, renk: '#5b6475' });
      if (kal && v < -0.005) yaz(tlE(-v) + ' fazla ödeme', x + 18, 474, { b: 700, z: 21, renk: '#1a7f4b' });
      else yaz(tlE(v), x + 18, 474, { b: 700, z: 24, renk: renk || '#1d2433' });
    });
    const kol = { t: P + 6, i: P + 150, a: 640, b: 800, k: W - P - 6 };
    let y = 540;
    yaz('TARİH', kol.t, y, { b: 700, z: 14, renk: '#5b6475' }); yaz('İŞLEM', kol.i, y, { b: 700, z: 14, renk: '#5b6475' });
    yaz('FATURA', kol.a, y, { b: 700, z: 14, r: true, renk: '#5b6475' }); yaz('ÖDEME', kol.b, y, { b: 700, z: 14, r: true, renk: '#5b6475' }); yaz('KALAN BORÇ', kol.k, y, { b: 700, z: 14, r: true, renk: '#5b6475' });
    g.fillStyle = '#1d2433'; g.fillRect(P, y + 12, W - 2 * P, 3);
    y += 15;
    const satir = (x, bg) => {
      if (bg) { g.fillStyle = bg; g.fillRect(P, y, W - 2 * P, SAT); }
      g.fillStyle = '#eef0f4'; g.fillRect(P, y + SAT - 1, W - 2 * P, 1);
      const yy = y + 30;
      yaz(trE(x.t), kol.t, yy, { z: 18, it: x.it });
      if (x.cek) {
        g.font = `400 18px ${F}`; const on = `Ödeme · Çek${x.seriYaz}`; yaz(on, kol.i, yy, { z: 18 });
        if (x.v) yaz(` · vade ${trE(x.v)}`, kol.i + g.measureText(on).width, yy, { b: 700, z: 18 });
      } else yaz(x.ack, kol.i, yy, { z: 18, it: x.it });
      if (x.a) yaz(tlE(x.a), kol.a, yy, { z: 18, r: true });
      if (x.b) yaz(tlE(x.b), kol.b, yy, { z: 18, r: true, renk: '#1a7f4b' });
      kalanYaz(x.kal, kol.k, yy);
      y += SAT;
    };
    satir({ t: bas, ack: 'Önceki dönemden kalan', kal: r.devir, it: true }, '#f5f7fa');
    for (const x of r.satirlar) {
      const odeme = x.s === 2 && !x.cek;
      satir({ ...x, ack: odeme ? 'Ödeme · ' + x.ack : x.ack, seriYaz: x.cek && x.ack.match(/^Çek( no \S+)?/)?.[1] || '' }, x.cek ? '#f4fbf7' : null);
    }
    y += 40;
    g.fillStyle = '#dde2ea'; g.fillRect(P, y - 26, W - 2 * P, 1);
    g.font = `400 18px ${F}`;
    const son1 = fazla ? 'Fazla ödemeniz ' : 'Kalan borcunuz ';
    yaz(son1, P, y + 6, { z: 18, renk: '#5b6475' });
    const w1 = g.measureText(son1).width;
    yaz(tlE(Math.abs(r.sonBakiye)), P + w1, y + 6, { b: 700, z: 18 });
    g.font = `700 18px ${F}`; const w2 = g.measureText(tlE(Math.abs(r.sonBakiye))).width;
    yaz('. Kayıtlarınızla farklılık varsa lütfen bize bildirin.', P + w1 + w2, y + 6, { z: 18, renk: '#5b6475' });
    yaz((r.devir < -0.005 || r.satirlar.some(x => x.kal < -0.005) ? 'Yeşil "fazla": o tarihte ödemeniz faturalarınızdan fazlaydı. ' : '') + 'Teşekkür ederiz.', P, y + 36, { z: 18, renk: '#5b6475' });
    return new Promise(res => c.toBlob(res, 'image/png'));
  }

  // Paraşüt'te aynı adın büyük/küçük harfli iki kaydı olabiliyor: önce birebir eşleşen seçilir
  const secili = () => D.musteriler?.find(m => m.ad === D.ad.trim()) || D.musteriler?.find(m => m.ad.toLocaleUpperCase('tr') === D.ad.trim().toLocaleUpperCase('tr'));
  const dosyaAdi = () => `ekstre-${(D.veri?.ad || 'musteri').toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]+/gi, '-').replace(/^-|-$/g, '')}-${D.son}.png`;

  async function hazirla() {
    const m = secili();
    if (!m) { D.durum = 'Listeden bir müşteri seçin.'; render(); return; }
    if (!D.bas || !D.son || D.bas > D.son) { D.durum = 'Tarihleri kontrol edin: başlangıç bitişten önce olmalı.'; render(); return; }
    D.yukleniyor = true; D.durum = 'Paraşüt\'ten güncel bilgiler alınıyor…'; render();
    try {
      if (D.veri?.id !== m.id) {
        // Paraşüt'te silinmiş eski kayıt seçildiyse aynı adlı öteki kayıt denenir
        const adaylar = [m, ...D.musteriler.filter(x => x !== m && x.ad.toLocaleUpperCase('tr') === m.ad.toLocaleUpperCase('tr'))];
        for (const [i, a] of adaylar.entries()) {
          try { D.veri = { id: a.id, ...(await ekstreAl(a.id)) }; break; }
          catch (e) { if (!/404/.test(e.message) || i === adaylar.length - 1) throw e; }
        }
      }
      blob = await ciz(D.veri, D.bas, D.son);
      if (D.resim) URL.revokeObjectURL(D.resim);
      D.resim = URL.createObjectURL(blob);
      D.durum = `Ekstre hazır. Paraşüt bakiyesi ${tlE(D.veri.bakiye)}.`;
    } catch (e) { D.durum = 'Olmadı: ' + e.message; }
    D.yukleniyor = false; render();
  }

  views.ekstre = () => {
    if (!D.musteriler) { musteriler().catch(e => { D.durum = 'Müşteri listesi alınamadı: ' + e.message; D.musteriler = []; render(); }); }
    return `${head('Paraşüt', 'Müşteri ekstresi', 'Müşteriyi ve tarihleri seçin. Bilgiler her seferinde Paraşüt\'ten anında alınır; resmi WhatsApp\'tan gönderin.')}
      <div class="card">
        <div class="ek-form">
          <label class="ek-mus">Müşteri<input id="ekAd" type="text" list="ekListe" value="${esc(D.ad)}" placeholder="Müşteri adı yazın" autocomplete="off"></label>
          <label>Başlangıç<input id="ekBas" type="date" value="${esc(D.bas)}"></label>
          <label>Bitiş<input id="ekSon" type="date" value="${esc(D.son)}"></label>
        </div>
        <datalist id="ekListe">${(D.musteriler || []).map(m => `<option value="${esc(m.ad)}">`).join('')}</datalist>
        <div class="ek-dug">
          <button class="btn dark" data-act="ekHazirla" ${D.yukleniyor ? 'disabled' : ''}>${D.yukleniyor ? 'Hazırlanıyor…' : 'Ekstreyi hazırla'}</button>
          <button class="btn ek-wa" data-act="ekPaylas" ${D.resim && !D.yukleniyor ? '' : 'disabled'}>WhatsApp'ta paylaş</button>
          <button class="btn" data-act="ekIndir" ${D.resim && !D.yukleniyor ? '' : 'disabled'}>Resmi indir</button>
        </div>
        ${D.durum ? `<p class="ek-durum" role="status">${esc(D.durum)}</p>` : ''}
      </div>
      <div class="card ek-on">${D.resim ? `<img src="${D.resim}" alt="Ekstre: ${esc(D.veri?.ad || '')}">` : '<p class="ek-bos">Henüz ekstre hazırlanmadı.</p>'}</div>`;
  };

  views.bind_ekstre = () => {
    const ad = $('#ekAd'), bas = $('#ekBas'), son = $('#ekSon');
    // müşteri ya da tarih değişince eski resim geçersiz olur
    const sifirla = () => { if (D.resim) { URL.revokeObjectURL(D.resim); D.resim = ''; blob = null; S.keepScroll = true; render(); } };
    ad?.addEventListener('input', () => { D.ad = ad.value; });
    ad?.addEventListener('change', () => { D.ad = ad.value; if (secili()?.id !== D.veri?.id) sifirla(); });
    bas?.addEventListener('change', () => { D.bas = bas.value; sifirla(); });
    son?.addEventListener('change', () => { D.son = son.value; sifirla(); });
  };

  function indir() {
    const a = Object.assign(document.createElement('a'), { href: D.resim, download: dosyaAdi() });
    document.body.append(a); a.click(); a.remove();
  }
  const prevAct = views.onAct;
  views.onAct = async (act, el, e) => {
    if (act === 'ekHazirla') { D.veri = null; hazirla(); }
    else if (act === 'ekIndir') { if (D.resim) { indir(); toast('Resim indirildi'); } }
    else if (act === 'ekPaylas') {
      if (!blob) return;
      const dosya = new File([blob], dosyaAdi(), { type: 'image/png' });
      try {
        if (navigator.canShare?.({ files: [dosya] })) { await navigator.share({ files: [dosya], title: 'Hesap özeti' }); return; }
      } catch (err) { if (err.name === 'AbortError') return; }
      indir(); toast('Bu cihaz doğrudan paylaşmaya izin vermedi; resim indirildi');
    }
    else prevAct?.(act, el, e);
  };
})();
