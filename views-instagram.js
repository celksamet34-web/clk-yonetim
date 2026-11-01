/* CLK Yönetim — Instagram gönderisi (celik isteği 01.11.2026: "panele Instagram post ile alakalı bir form hazırla, Instagram üzerindeki
   çantacıların içeriklerine bak, hangisi bize uygunsa onu tasarla").
   Çanta satıcılarının en çok kullandığı üç gönderi: tek ürün (büyük fotoğraf, fiyat etiketi, renkler, WhatsApp/DM çağrısı),
   kaydırmalı (kapak + ürünün bütün fotoğrafları + son karede ölçü, malzeme, renk, fiyat) ve koleksiyon (2–4 ürün, "Yeni gelenler").
   Gönderi 4:5 (1080×1350, akışta en çok yer kaplayan boy) ya da hikâye 9:16 (1080×1920; üst ve alt Instagram arayüzü için boş).
   Açıklama ve etiketler (hashtag) üründen yazılır, düzenlenebilir. Paylaşınca açıklama panoya kopyalanır. Sunucuya bir şey yazılmaz. */
(() => {
  const { S, $, esc, num, toast, head, views, render, loadProducts, P } = CLK;
  const TEL = '0534 077 88 67', SITE = 'clkcanta.com';
  const RENK = { INK: '#121110', GOLD: '#b48f55', GOLD2: '#d6bd8f', CREAM: '#f6f4f0', LINE: '#e8e3db', MUTED: '#7a746b' };
  const TUR = {
    tek: { ad: 'Tek ürün', not: 'Büyük fotoğraf, fiyat etiketi, renkler. Reklama en uygun.', en: 1 },
    kaydir: { ad: 'Kaydırmalı', not: 'Kapak, ürünün bütün fotoğrafları, son karede ölçü, malzeme, fiyat.', en: 1 },
    koleksiyon: { ad: 'Koleksiyon', not: '2–4 ürün tek karede: yeni gelenler, kampanya.', en: 4 }
  };
  const BICIM = { gonderi: ['Gönderi 4:5', 1350], hikaye: ['Hikâye 9:16', 1920] };
  const FIYAT = [['yok', 'Fiyatsız'], ['site', 'Site fiyatı'], ['b1', 'Bayi 1'], ['b2', 'Bayi 2'], ['b3', 'Bayi 3'], ['b4', 'Bayi 4']];
  const AYAR = { tur: 'tek', bicim: 'gonderi', tema: 'acik', fiyat: 'site', olcu: true, renk: true, kod: true, stokta: true };
  let kayit = {};
  try { kayit = JSON.parse(localStorage.getItem('clk-instagram') || '{}'); } catch {}
  const D = (S.ui.ig ||= { ...AYAR, ...kayit, sec: [], ara: '', goster: 40, ust: '', alt: '', cap: '', capElle: false, resimler: [], durum: '', calisiyor: false, kirli: false, slide: 0 });
  const sakla = () => { try { localStorage.setItem('clk-instagram', JSON.stringify(Object.fromEntries(Object.keys(AYAR).map(k => [k, D[k]])))); } catch {} };

  /* ürün bilgileri (Katalog ile aynı kurallar) */
  const buyuk = s => String(s || '').toLocaleUpperCase('tr');
  // sözcükler baş harfi büyük; rakamlı ya da sesli harfsiz kısa sözcükler (BYB, PP, 3LÜ) olduğu gibi kalır
  const guzelAd = s => buyuk(s).split(/(\s+|[/()-])/).map(w => /\d/.test(w) || (w.length <= 4 && /^\p{L}+$/u.test(w) && !/[AEIİOÖUÜ]/.test(w)) ? w : w.toLocaleLowerCase('tr').replace(/^\p{L}/u, c => c.toLocaleUpperCase('tr'))).join('');
  const fmt = v => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(v) + ' ₺';
  const fiyatAl = p => {
    if (D.fiyat === 'yok') return 0;
    const v = D.fiyat === 'site' ? +p.salePrice : (+p['dealerPrice' + D.fiyat.slice(1)] || +p.dealerPrice1);
    return v > 0 ? v : 0;
  };
  const bayi = () => /^b\d$/.test(D.fiyat);
  const kodAl = p => { const m = String(p.modelCode || '').trim(), c = String(p.code || '').trim(); return m || (/^(PRS|CLK)-/i.test(c) ? '' : c); };
  const nitelik = (p, ad) => { const a = (Array.isArray(p.attributes) ? p.attributes : []).find(x => buyuk(x.name).replace(/İ/g, 'I') === buyuk(ad).replace(/İ/g, 'I')); return String(a?.value ?? '').trim(); };
  const cm = v => String(v).replace(',', '.').replace(/\s*cm$/i, '').trim();
  function bilgi(p) {
    const o = ['En', 'Yükseklik', 'Boy'].map(k => cm(nitelik(p, k))).filter(Boolean);
    const olcu = o.length ? o.map(x => x.replace('.', ',')).join(' × ') + (o.every(x => /^\d+([.,]\d+)?$/.test(x)) ? ' cm' : '') : '';
    const malzeme = nitelik(p, 'Malzeme'), suV = buyuk(nitelik(p, 'Su Geçirmez'));
    return { olcu, malzeme: malzeme ? guzelAd(malzeme) : '', su: /^(EVET|VAR|1|TRUE)$/.test(suV) || suV.includes('GEÇİRMEZ') ? 'Su geçirmez' : '' };
  }
  const renkler = p => [...new Set((Array.isArray(p.variants) ? p.variants : []).filter(v => !D.stokta || (+v.quantity || 0) > 0).map(v => buyuk(String(v.value1 || '').trim())).filter(Boolean))];
  const RENKLER = [['SİYAH', '#151515'], ['LACİVERT', '#1f2a44'], ['KAHVE', '#5b3a24'], ['TABA', '#a0632b'], ['CAMEL', '#b5835a'], ['BEJ', '#d8c3a5'], ['KREM', '#efe4cc'], ['VİZON', '#a39283'],
    ['ANTRASİT', '#3a3a3a'], ['FÜME', '#4d4d4d'], ['GRİ', '#8d8d8d'], ['GÜMÜŞ', '#c4c4c4'], ['BEYAZ', '#ffffff'], ['BORDO', '#6d1a24'], ['KIRMIZI', '#b3261e'], ['PEMBE', '#e8a0b4'], ['PUDRA', '#e9c9c1'],
    ['MOR', '#6a3d8f'], ['LİLA', '#b39ad1'], ['MAVİ', '#2f6fb3'], ['TURKUAZ', '#2bb3b1'], ['YEŞİL', '#3b7656'], ['HAKİ', '#6b6b3a'], ['SARI', '#e3b23c'], ['HARDAL', '#c79a2c'], ['TURUNCU', '#e07a2e'], ['ALTIN', '#c9a14a']];
  const renkKod = ad => RENKLER.find(([k]) => ad.includes(k))?.[1] || '';
  const urun = id => S.products.find(p => String(p.id) === String(id));
  const secili = () => D.sec.map(urun).filter(Boolean);

  /* çizim yardımcıları */
  const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const onbellek = new Map();
  // önce doğrudan; olmazsa herkese açık görsel aracısı üzerinden (yalnız sitedeki herkese açık ürün fotoğrafı gider)
  function gorsel(src) {
    if (!src) return Promise.resolve(null);
    if (!onbellek.has(src)) onbellek.set(src, loadImg(src).catch(() => loadImg('https://wsrv.nl/?w=1200&url=' + encodeURIComponent(src))).catch(() => null));
    return onbellek.get(src);
  }
  let logoKoyu = null, logoAltin = null;
  async function logolar() {
    if (logoKoyu) return;
    const im = await loadImg(new URL('logo-clk.png', location.href).href).catch(() => null);
    if (!im) return;
    logoKoyu = im;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = RENK.GOLD2; g.fillRect(0, 0, c.width, c.height);
    logoAltin = c;
  }
  const yuvarlak = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const F = (b, z, serif) => `${b} ${Math.round(z)}px ${serif ? '"Playfair Display", Georgia, serif' : 'Inter, system-ui, sans-serif'}`;
  function satirlar(g, t, maxW, maxL) {
    const out = []; let cur = '';
    for (const w of String(t || '').split(/\s+/).filter(Boolean)) {
      const d = cur ? cur + ' ' + w : w;
      if (g.measureText(d).width <= maxW || !cur) cur = d; else { out.push(cur); cur = w; }
    }
    if (cur) out.push(cur);
    const kes = s => { while (s.length > 1 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1); return s.trimEnd() + '…'; };
    if (out.length > maxL) { out.length = maxL; out[maxL - 1] = kes(out[maxL - 1]); }
    return out.map(s => (g.measureText(s).width > maxW ? kes(s) : s));
  }
  // yazı sığana kadar küçülür (en az yarısına)
  function sigYazi(g, t, x, y, maxW, z, b, serif) {
    let s = z; g.font = F(b, s, serif);
    while (s > z / 2 && g.measureText(t).width > maxW) { s -= 2; g.font = F(b, s, serif); }
    g.fillText(t, x, y); return s;
  }
  const sigdir = (g, im, x, y, w, h) => { const k = Math.min(w / im.width, h / im.height), iw = im.width * k, ih = im.height * k; g.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); };
  const kapla = (g, im, x, y, w, h) => { const k = Math.max(w / im.width, h / im.height), iw = im.width * k, ih = im.height * k; g.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); };
  const T = () => D.tema === 'koyu'
    ? { koyu: true, yazi: '#ffffff', soluk: '#b5ac9e', vurgu: RENK.GOLD2, kart: '#1f1c19', kartCizgi: 'rgba(214,189,143,.25)' }
    : { koyu: false, yazi: RENK.INK, soluk: '#6f685e', vurgu: '#8a6a33', kart: '#ffffff', kartCizgi: RENK.LINE };

  /* ortak parçalar: zemin, üst marka satırı, alt bant, fiyat etiketi, renk noktaları, ürün fotoğrafı */
  function zemin(g, W, H) {
    const t = T();
    if (t.koyu) { const r = g.createRadialGradient(W / 2, H * 0.25, 60, W / 2, H * 0.4, H * 0.95); r.addColorStop(0, '#2c2824'); r.addColorStop(1, '#121110'); g.fillStyle = r; }
    else { const l = g.createLinearGradient(0, 0, 0, H); l.addColorStop(0, '#ffffff'); l.addColorStop(1, '#ebe5dc'); g.fillStyle = l; }
    g.fillRect(0, 0, W, H);
  }
  function marka(g, W, sag) {
    const t = T(), lg = t.koyu ? logoAltin : logoKoyu, m = 64, y = 84;
    if (lg) { const lh = 40, lw = lg.width / lg.height * lh; g.drawImage(lg, m, y - lh * 0.82, lw, lh); g.font = F(700, 17); g.fillStyle = t.yazi; g.letterSpacing = '6px'; g.fillText('ÇANTA', m + lw + 14, y - 2); g.letterSpacing = '0px'; }
    else { g.font = F(700, 30, true); g.fillStyle = t.yazi; g.fillText('CLK ÇANTA', m, y); }
    if (sag) { g.font = F(700, 18); g.fillStyle = t.vurgu; g.textAlign = 'right'; g.letterSpacing = '4px'; g.fillText(satirlar(g, buyuk(sag), 560, 1)[0], W - m, y - 4); g.letterSpacing = '0px'; g.textAlign = 'left'; }
  }
  // alt bant: hikâyede tuvalin altına kadar uzar
  // hikâyede alt bant kenarlardan içeride, köşeleri yuvarlak bir kart olur (altı Instagram'ın yanıt kutusuna kalır)
  function bant(g, W, alt, ipucu) {
    const y = 1200, m = 64, hik = alt > 1400;
    g.fillStyle = D.tema === 'koyu' ? '#0b0a09' : RENK.INK;
    if (hik) yuvarlak(g, 28, y, W - 56, 150, 36); else yuvarlak(g, 0, y, W, alt - y + 60, 44);
    g.fill();
    if (D.tema === 'koyu' && !hik) { g.fillStyle = 'rgba(214,189,143,.35)'; g.fillRect(m, y, W - 2 * m, 1.5); }
    g.font = F(700, 18); g.fillStyle = RENK.GOLD2; g.letterSpacing = '5px'; g.fillText('SİPARİŞ VE BİLGİ', m, y + 56); g.letterSpacing = '0px';
    g.fillStyle = '#fff'; sigYazi(g, `DM  ·  WhatsApp ${TEL}`, m, y + 106, 640, 34, 700);
    g.textAlign = 'right';
    if (ipucu) { g.font = F(700, 20); g.fillStyle = RENK.GOLD2; g.letterSpacing = '3px'; g.fillText('KAYDIR  ›', W - m, y + 56); g.letterSpacing = '0px'; }
    g.font = F(600, 24); g.fillStyle = '#a39c91'; g.fillText(SITE, W - m, y + 104);
    g.textAlign = 'left';
  }
  function etiket(g, f, sag, ust, buyukluk = 42) {
    if (!f) return;
    // bayi fiyatında hapın içinde küçük "BAYİ" yazar
    const t = fmt(f), lz = Math.round(buyukluk * 0.4), et = bayi() ? 'BAYİ' : '';
    g.font = F(700, lz); g.letterSpacing = '3px'; const lw = et ? g.measureText(et).width + buyukluk * 0.35 : 0; g.letterSpacing = '0px';
    g.font = F(700, buyukluk); const tw = g.measureText(t).width, bw = lw + tw + buyukluk * 0.95, bh = buyukluk * 1.6, bx = sag - bw, by = ust;
    g.save(); g.shadowColor = 'rgba(0,0,0,.22)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
    yuvarlak(g, bx, by, bw, bh, bh / 2); const gr = g.createLinearGradient(bx, by, bx + bw, by + bh); gr.addColorStop(0, RENK.GOLD); gr.addColorStop(1, '#cfae72'); g.fillStyle = gr; g.fill(); g.restore();
    g.fillStyle = '#1b150b'; g.textBaseline = 'middle'; const x0 = bx + buyukluk * 0.475;
    if (et) { g.font = F(700, lz); g.letterSpacing = '3px'; g.globalAlpha = 0.72; g.fillText(et, x0, by + bh / 2 + 1); g.globalAlpha = 1; g.letterSpacing = '0px'; }
    g.font = F(700, buyukluk); g.fillText(t, x0 + lw, by + bh / 2 + 2); g.textBaseline = 'alphabetic';
  }
  // renk noktaları ve adları ortalı tek satır
  function renkSatiri(g, rl, cx, y, maxW, r = 14) {
    if (!rl.length) return;
    const t = T(), nok = rl.filter(renkKod).slice(0, 8), z = Math.round(r * 1.75);
    g.font = F(600, z); const adlar = rl.map(guzelAd).join(', ');
    const dw = nok.length ? nok.length * (2 * r + 10) + 8 : 0;
    const yazi = dw + g.measureText(adlar).width <= maxW ? adlar : `${rl.length} renk`, tw = g.measureText(yazi).width;
    let x = cx - (dw + tw) / 2;
    for (const k of nok) { g.beginPath(); g.arc(x + r, y - r * 0.55, r, 0, 7); g.fillStyle = renkKod(k); g.fill(); g.lineWidth = 2.5; g.strokeStyle = t.koyu ? 'rgba(255,255,255,.75)' : 'rgba(18,17,16,.22)'; g.stroke(); x += 2 * r + 10; }
    g.fillStyle = t.soluk; g.fillText(yazi, x + (nok.length ? 8 : 0), y);
  }
  // açık temada fotoğraf çarpma ile zemine karışır (vitrin fotoğrafının beyaz fonu kaybolur); koyu temada beyaz kartta durur
  function urunFoto(g, im, x, y, w, h) {
    if (!im) { g.fillStyle = T().soluk; g.font = F(600, 30); g.textAlign = 'center'; g.fillText('Fotoğraf yüklenemedi', x + w / 2, y + h / 2); g.textAlign = 'left'; return; }
    if (!T().koyu) { g.save(); g.globalCompositeOperation = 'multiply'; sigdir(g, im, x, y, w, h); g.restore(); return; }
    g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 40; g.shadowOffsetY = 14; yuvarlak(g, x, y, w, h, 28); g.fillStyle = '#fff'; g.fill(); g.restore();
    g.save(); yuvarlak(g, x, y, w, h, 28); g.clip(); sigdir(g, im, x + 20, y + 20, w - 40, h - 40); g.restore();
  }
  const bilgiYazi = p => { const b = bilgi(p), k = D.kod ? kodAl(p) : ''; return [D.olcu && b.olcu, D.olcu && b.malzeme, D.olcu && b.su, k && 'Kod: ' + k].filter(Boolean).join('  ·  '); };

  /* 1) tek ürün ve kaydırmalının kapağı */
  function tekCiz(g, W, alt, p, im, ipucu) {
    const t = T(), m = 64, kat = P.cat(p);
    marka(g, W, kat && kat !== 'Kategorisiz' ? kat : '');
    let py = 128;
    if (D.ust.trim()) {
      g.textAlign = 'center'; g.fillStyle = t.koyu ? RENK.GOLD2 : RENK.INK;
      sigYazi(g, D.ust.trim(), W / 2, 214, W - 2 * m, 80, 700, true);
      if (D.alt.trim()) { g.fillStyle = t.soluk; sigYazi(g, D.alt.trim(), W / 2, 266, W - 2 * m, 28, 600); }
      g.textAlign = 'left'; py = D.alt.trim() ? 300 : 260;
    }
    const fx = t.koyu ? 150 : 80, fy = py + (t.koyu ? 10 : 0), fh = 905 - fy;
    urunFoto(g, im, fx, fy, W - 2 * fx, fh);
    etiket(g, fiyatAl(p), W - m, fy + 8);
    // ad, bilgi satırı, renkler
    let y = 978;
    g.textAlign = 'center'; g.fillStyle = t.yazi; g.font = F(600, 52, true);
    const sat = satirlar(g, guzelAd(p.name), W - 2 * m, 2);
    if (sat.length > 1) { g.font = F(600, 46, true); y = 966; }
    for (const l of satirlar(g, guzelAd(p.name), W - 2 * m, 2)) { g.fillText(l, W / 2, y); y += 56; }
    const bi = bilgiYazi(p);
    if (bi) { g.font = F(600, 25); g.fillStyle = t.soluk; g.fillText(satirlar(g, bi, W - 2 * m, 1)[0], W / 2, y - 4); y += 46; }
    g.textAlign = 'left';
    if (D.renk) renkSatiri(g, renkler(p), W / 2, Math.min(y + 4, 1168), W - 2 * m);
    bant(g, W, alt, ipucu);
  }

  /* 2) kaydırmalının ara kareleri: ürünün diğer fotoğrafları, tam kare; köşede küçük logo */
  function fotoCiz(g, W, H, im, hikaye) {
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    if (im) { if (hikaye) { zemin(g, W, H); g.save(); yuvarlak(g, 0, 250, W, H - 500, 0); g.clip(); g.fillStyle = '#fff'; g.fillRect(0, 250, W, H - 500); sigdir(g, im, 0, 250, W, H - 500); g.restore(); } else kapla(g, im, 0, 0, W, H); }
    if (logoKoyu) {
      const lh = 26, lw = logoKoyu.width / logoKoyu.height * lh, px = 18, bw = lw + 2 * px, bh = lh + 22, x = 40, y = H - (hikaye ? 290 : 40) - bh;
      g.save(); g.shadowColor = 'rgba(0,0,0,.12)'; g.shadowBlur = 12; yuvarlak(g, x, y, bw, bh, bh / 2); g.fillStyle = 'rgba(255,255,255,.88)'; g.fill(); g.restore();
      g.drawImage(logoKoyu, x + px, y + 11, lw, lh);
    }
  }

  /* 3) kaydırmalının son karesi: ürün bilgileri ve sipariş */
  function bilgiCiz(g, W, alt, p, im) {
    const t = T(), m = 64;
    marka(g, W, 'ÜRÜN BİLGİLERİ');
    g.textAlign = 'center'; g.fillStyle = t.yazi; g.font = F(600, 50, true);
    let y = 200;
    for (const l of satirlar(g, guzelAd(p.name), W - 2 * m, 2)) { g.fillText(l, W / 2, y); y += 58; }
    g.textAlign = 'left';
    const fw = 300, fh = 360, fy = y - 10;
    urunFoto(g, im, (W - fw) / 2, fy, fw, fh);
    const b = bilgi(p), rl = renkler(p), f = fiyatAl(p), kod = kodAl(p);
    const sat = [['Ölçü', b.olcu], ['Malzeme', b.malzeme], ['Özellik', b.su], ['Renkler', rl.length ? rl.map(guzelAd).join(', ') : ''], ['Kod', kod], [bayi() ? 'Bayi fiyatı' : 'Fiyat', f ? fmt(f) : 'Mesaj atın, hemen iletelim']].filter(([, v]) => v);
    const ky = fy + fh + 24, kh = Math.min(1170 - ky, sat.length * 72 + 24), sh = (kh - 24) / sat.length;
    g.save(); g.shadowColor = t.koyu ? 'rgba(0,0,0,.4)' : 'rgba(18,17,16,.08)'; g.shadowBlur = 24; g.shadowOffsetY = 6; yuvarlak(g, m, ky, W - 2 * m, kh, 24); g.fillStyle = t.kart; g.fill(); g.restore();
    if (t.koyu) { g.strokeStyle = t.kartCizgi; g.lineWidth = 1.5; yuvarlak(g, m, ky, W - 2 * m, kh, 24); g.stroke(); }
    sat.forEach(([k, v], i) => {
      const sy = ky + 12 + i * sh, orta = sy + sh / 2 + 9, son = i === sat.length - 1;
      if (i) { g.fillStyle = t.kartCizgi; g.fillRect(m + 28, sy, W - 2 * m - 56, 1.5); }
      g.font = F(700, 19); g.fillStyle = t.vurgu; g.letterSpacing = '3px'; g.fillText(buyuk(k), m + 32, orta - 2); g.letterSpacing = '0px';
      g.textAlign = 'right'; g.fillStyle = son && f ? (t.koyu ? RENK.GOLD2 : '#6a5226') : t.yazi;
      sigYazi(g, v, W - m - 32, orta, W - 2 * m - 300, son && f ? 38 : 29, 700);
      g.textAlign = 'left';
    });
    bant(g, W, alt, false);
  }

  /* 4) koleksiyon: 2–4 ürün, başlık ve alt başlık */
  function koleksiyonCiz(g, W, alt, l, imgs) {
    const t = T(), m = 64, n = l.length;
    marka(g, W, D.fiyat !== 'yok' && bayi() ? 'BAYİ FİYATLARI' : '');
    g.textAlign = 'center'; g.fillStyle = t.koyu ? RENK.GOLD2 : RENK.INK;
    sigYazi(g, D.ust.trim() || 'Yeni Gelenler', W / 2, 206, W - 2 * m, 76, 700, true);
    g.fillStyle = t.soluk; sigYazi(g, D.alt.trim() || `${guzelAd(new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }))}  ·  ${n} model`, W / 2, 254, W - 2 * m, 26, 600);
    g.textAlign = 'left';
    const sut = n === 4 ? 2 : n, sir = n === 4 ? 2 : 1, gap = 22, x0 = m - 16, y0 = 290, gw = W - 2 * x0, gh = 1176 - y0;
    const cw = (gw - gap * (sut - 1)) / sut, ch = (gh - gap * (sir - 1)) / sir;
    l.forEach((p, i) => {
      const x = x0 + (i % sut) * (cw + gap), y = y0 + Math.floor(i / sut) * (ch + gap), pad = 16, altH = n === 4 ? 104 : 128;
      g.save(); g.shadowColor = t.koyu ? 'rgba(0,0,0,.45)' : 'rgba(18,17,16,.10)'; g.shadowBlur = 22; g.shadowOffsetY = 6; yuvarlak(g, x, y, cw, ch, 22); g.fillStyle = '#fff'; g.fill(); g.restore();
      const ix = x + pad, iy = y + pad, iw = cw - 2 * pad, ih = ch - altH - pad;
      if (imgs[i]) { g.save(); yuvarlak(g, ix, iy, iw, ih, 14); g.clip(); sigdir(g, imgs[i], ix, iy, iw, ih); g.restore(); }
      const f = fiyatAl(p);
      g.font = F(700, n === 4 ? 23 : 25); g.fillStyle = RENK.INK;
      g.fillText(satirlar(g, guzelAd(p.name), iw, 1)[0], ix + 2, iy + ih + 38);
      let ry = iy + ih + (n === 4 ? 76 : 80);
      if (f) { g.font = F(700, n === 4 ? 27 : 30); g.fillStyle = '#6a5226'; g.fillText(fmt(f), ix + 2, ry); }
      const rl = D.renk ? renkler(p) : [], nok = rl.filter(renkKod).slice(0, 5);
      if (nok.length) { let rx = ix + iw - 12; for (const k of nok.slice().reverse()) { g.beginPath(); g.arc(rx, ry - 9, 11, 0, 7); g.fillStyle = renkKod(k); g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(18,17,16,.22)'; g.stroke(); rx -= 28; } }
      else if (rl.length) { g.font = F(600, 19); g.fillStyle = RENK.MUTED; g.textAlign = 'right'; g.fillText(`${rl.length} renk`, ix + iw - 2, ry); g.textAlign = 'left'; }
      if (!f && n < 4) { g.font = F(600, 20); g.fillStyle = RENK.MUTED; g.fillText(satirlar(g, bilgiYazi(p), iw - 150, 1)[0] || '', ix + 2, ry); }
    });
    bant(g, W, alt, false);
  }

  /* resimleri hazırla: tuval → JPEG; ayar değişince kendiliğinden yenilenir */
  let sayac = 0, zaman = 0;
  const planla = () => { D.kirli = true; clearTimeout(zaman); zaman = setTimeout(hazirla, 220); };
  async function hazirla() {
    const l = secili(), tur = TUR[D.tur];
    if (!l.length || (D.tur === 'koleksiyon' && l.length < 2)) { temizle(); onizlemeYenile(); return; }
    const benim = ++sayac; D.kirli = false; D.calisiyor = true; durumYaz('Hazırlanıyor…');
    try {
      await Promise.all([logolar(), document.fonts?.load?.('700 40px Inter'), document.fonts?.load?.('600 40px "Playfair Display"'), document.fonts?.load?.('700 40px "Playfair Display"')].map(x => Promise.resolve(x).catch(() => null)));
      const W = 1080, H = BICIM[D.bicim][1], hik = D.bicim === 'hikaye', oy = hik ? 285 : 0, alt = H - oy;
      const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
      const kareler = [];
      const ciz = async fn => { g.save(); g.clearRect(0, 0, W, H); g.letterSpacing = '0px'; await fn(); g.restore(); kareler.push(await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92))); };
      if (D.tur === 'koleksiyon') {
        const imgs = await Promise.all(l.slice(0, tur.en).map(p => gorsel(P.img(p))));
        await ciz(() => { zemin(g, W, H); g.translate(0, oy); koleksiyonCiz(g, W, alt, l.slice(0, tur.en), imgs); });
      } else {
        const p = l[0], fotolar = P.imgs(p), im = await gorsel(fotolar[0]);
        await ciz(() => { zemin(g, W, H); g.translate(0, oy); tekCiz(g, W, alt, p, im, D.tur === 'kaydir' && !hik); });
        if (D.tur === 'kaydir') {
          // kaydırmalı en çok 10 kare: kapak + 8 fotoğraf + bilgi
          const digerleri = fotolar.slice(1, 9), ims = await Promise.all(digerleri.map(gorsel));
          for (const x of ims.filter(Boolean)) await ciz(() => fotoCiz(g, W, H, x, hik));
          await ciz(() => { zemin(g, W, H); g.translate(0, oy); bilgiCiz(g, W, alt, p, im); });
        }
      }
      if (benim !== sayac) return;
      temizle();
      const kod = (D.tur === 'koleksiyon' ? 'koleksiyon' : String(kodAl(l[0]) || l[0].id)).replace(/[^\w-]+/g, '');
      D.resimler = kareler.map((blob, i) => ({ blob, url: URL.createObjectURL(blob), ad: `CLK-instagram-${kod}-${hik ? 'hikaye' : 'gonderi'}-${i + 1}.jpg` }));
      D.slide = 0;
      const fs = D.fiyat !== 'yok' && l.slice(0, tur.en).some(p => !fiyatAl(p));
      D.durum = `${D.resimler.length} ${D.resimler.length > 1 ? 'kare' : 'resim'} hazır${fs ? `; fiyatı olmayan üründe fiyat yazılmadı` : ''}.`;
    } catch (e) { if (benim === sayac) D.durum = 'Hazırlanamadı: ' + (e.message || e); }
    finally { if (benim === sayac) { D.calisiyor = false; if (!D.capElle) D.cap = aciklama(); onizlemeYenile(); } }
  }
  function temizle() { for (const r of D.resimler) URL.revokeObjectURL(r.url); D.resimler = []; }
  const durumYaz = t => { D.durum = t; const d = $('#igDurum'); if (d) d.textContent = t; };

  /* açıklama ve etiketler */
  const ETIKET = [[/SIRT/, ['sırtçantası']], [/VAL[İI]Z|BAVUL/, ['valiz', 'seyahatçantası']], [/EVRAK/, ['evrakçantası']], [/LAPTOP|NOTEBOOK/, ['laptopçantası']], [/OKUL/, ['okulçantası']],
    [/AB[İI]YE/, ['abiyeçanta']], [/OMUZ/, ['omuzçantası']], [/KOL ÇANTA|KOL$/, ['kolçantası']], [/EL ÇANTA/, ['elçantası']], [/CÜZDAN/, ['cüzdan']], [/BEL ÇANTA/, ['belçantası']],
    [/SPOR/, ['sporçantası']], [/POSTACI/, ['postacıçanta']], [/KADIN/, ['kadınçanta']], [/ERKEK/, ['erkekçanta']], [/ÇOCUK/, ['çocukçantası']], [/(?<!SUN[İI] )DER[İI]/, ['deriçanta']]];
  const etiketYap = s => '#' + String(s).toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, '');
  function etiketler(l) {
    const out = new Set(['#clkçanta', '#çanta', '#çantamodelleri']);
    for (const p of l) {
      const t = buyuk([p.name, P.path(p), nitelik(p, 'Malzeme')].join(' '));
      for (const [re, e] of ETIKET) if (re.test(t)) e.forEach(x => out.add('#' + x));
      const mk = String(p.brand || '').trim(); if (mk && !/^CLK/i.test(mk) && mk.length < 20) out.add(etiketYap(mk));
    }
    if (bayi()) { out.add('#toptançanta'); out.add('#toptansatış'); }
    out.add('#yenisezon'); out.add('#istanbul');
    return [...out].slice(0, 15).join(' ');
  }
  function aciklama() {
    const l = secili(); if (!l.length) return '';
    const ust = D.ust.trim(), altY = D.alt.trim(), sat = [];
    if (D.tur === 'koleksiyon') {
      sat.push(`✨ ${ust || 'Yeni Gelenler'}`); if (altY) sat.push(altY); sat.push('');
      for (const p of l.slice(0, 4)) { const f = fiyatAl(p), rl = renkler(p); sat.push(`▪️ ${guzelAd(p.name)}${f ? ' – ' + fmt(f) : ''}${rl.length > 1 ? ` (${rl.length} renk)` : ''}`); }
      if (bayi()) sat.push('', 'Fiyatlar bayi fiyatıdır.');
    } else {
      const p = l[0], b = bilgi(p), rl = renkler(p), f = fiyatAl(p), kod = kodAl(p);
      if (ust) sat.push(`✨ ${ust}`);
      if (altY) sat.push(altY);
      if (ust || altY) sat.push('');
      sat.push(guzelAd(p.name), '');
      if (b.olcu) sat.push(`📏 Ölçü: ${b.olcu}`);
      if (b.malzeme) sat.push(`🧵 Malzeme: ${b.malzeme}`);
      if (b.su) sat.push('💧 Su geçirmez');
      if (rl.length) sat.push(`🎨 Renkler: ${rl.map(guzelAd).join(', ')}`);
      if (f) sat.push(`🏷️ ${bayi() ? 'Bayi fiyatı' : 'Fiyat'}: ${fmt(f)}`);
      if (kod) sat.push(`Kod: ${kod}`);
    }
    sat.push('', `💬 Sipariş ve bilgi için DM ya da WhatsApp: ${TEL}`, `🛍️ ${SITE}`, '', etiketler(l.slice(0, 4)));
    return sat.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  /* paylaş, indir */
  const resimIndir = r => { const a = Object.assign(document.createElement('a'), { href: r.url, download: r.ad }); document.body.append(a); a.click(); a.remove(); };
  async function kopyala(sessiz) {
    const t = ($('#igCap')?.value ?? D.cap) || '';
    try { await navigator.clipboard.writeText(t); if (!sessiz) toast('Açıklama kopyalandı'); return true; }
    catch { const a = $('#igCap'); if (a) { a.select(); document.execCommand?.('copy'); } if (!sessiz) toast('Açıklama seçildi; kopyalayın'); return false; }
  }
  async function paylas(liste) {
    if (!liste.length) return;
    await kopyala(true);
    const fl = liste.map(r => new File([r.blob], r.ad, { type: 'image/jpeg' }));
    try { if (navigator.canShare?.({ files: fl })) { await navigator.share({ files: fl }); toast('Açıklama panoda: Instagram\'da yapıştırın'); return; } }
    catch (e) { if (e.name === 'AbortError') return; }
    liste.forEach((r, i) => setTimeout(() => resimIndir(r), i * 350));
    toast('Resimler indirildi, açıklama panoya kopyalandı');
  }

  /* sayfa */
  const sec = (id, liste, v) => `<select id="${id}">${liste.map(([k, l]) => `<option value="${esc(k)}" ${String(v) === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const kutu = (id, v, l) => `<label class="toggle"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}> ${l}</label>`;
  function liste() {
    const q = buyuk(D.ara).split(/\s+/).filter(Boolean);
    return S.products.filter(p => P.img(p) && (!D.stokta || P.qty(p) > 0) && (!q.length || q.every(k => buyuk(p.name + ' ' + (p.code || '') + ' ' + (p.modelCode || '') + ' ' + P.path(p)).includes(k))))
      .sort((a, b) => (+b.id || 0) - (+a.id || 0));
  }
  function satirHtml(p) {
    const id = String(p.id), i = D.sec.indexOf(id), f = fiyatAl(p), kod = kodAl(p), nf = P.imgs(p).length;
    return `<button type="button" class="ig-r ${i >= 0 ? 'secili' : ''}" data-act="igSec" data-id="${esc(id)}" aria-pressed="${i >= 0}">
      <span class="ig-no">${i >= 0 ? (TUR[D.tur].en > 1 ? i + 1 : '✓') : ''}</span>
      <span class="kt-im"><img src="${esc(P.img(p))}" alt="" loading="lazy"></span>
      <span class="kt-ad"><b>${esc(p.name)}</b><small>${esc([kod, P.path(p)].filter(Boolean).join(' · '))}</small><small>${nf} fotoğraf · ${num(P.qty(p))} adet${renkler(p).length ? ' · ' + renkler(p).length + ' renk' : ''}</small></span>
      <span class="kt-sag">${D.fiyat === 'yok' ? '' : `<b>${f ? fmt(f) : '<em>fiyat yok</em>'}</b>`}</span></button>`;
  }
  const listeHtml = () => { const l = liste(); return (l.slice(0, D.goster).map(satirHtml).join('') || '<p class="ek-bos">Aramaya uyan, fotoğraflı ürün yok.</p>') + (l.length > D.goster ? `<button class="btn sm" data-act="igDaha" style="margin:10px 0 2px">Daha fazla göster (${num(l.length - D.goster)})</button>` : ''); };
  function onizlemeHtml() {
    const r = D.resimler, hik = D.bicim === 'hikaye';
    if (!r.length) return `<div class="ig-bos">${D.calisiyor ? 'Hazırlanıyor…' : D.tur === 'koleksiyon' ? 'En az 2 ürün seçin.' : 'Bir ürün seçin; gönderi burada görünür.'}</div>`;
    const cap = (D.capElle ? D.cap : aciklama()).split('\n').filter(Boolean);
    return `<div class="ig-tel ${hik ? 'hik' : ''}">
        <div class="ig-ust"><span class="ig-av"><img src="logo-clk.png" alt=""></span><b>clkcanta</b><small>${hik ? 'Hikâye' : 'Gönderi'}</small></div>
        <div class="ig-kayan" id="igKayan">${r.map((x, i) => `<img src="${x.url}" alt="Kare ${i + 1}" data-i="${i}">`).join('')}</div>
        ${r.length > 1 ? `<div class="ig-nokta">${r.map((x, i) => `<i class="${i === D.slide ? 'on' : ''}"></i>`).join('')}</div>` : ''}
        ${hik ? '' : `<p class="ig-cap"><b>clkcanta</b> ${esc(cap[0] || '')} <span>${esc(cap.slice(1, 3).join(' '))}… devamı</span></p>`}
      </div>
      <div class="ig-kucuk">${r.map((x, i) => `<button type="button" data-act="igTek" data-i="${i}" title="Bu kareyi indir"><img src="${x.url}" alt=""><span>${i + 1}</span></button>`).join('')}</div>`;
  }
  function onizlemeYenile() {
    const o = $('#igOn'); if (o) o.innerHTML = onizlemeHtml();
    const d = $('#igDurum'); if (d) d.textContent = D.durum;
    const a = $('#igCap'); if (a && !D.capElle) a.value = D.cap;
    for (const b of document.querySelectorAll('[data-hazir]')) b.disabled = !D.resimler.length;
    kayanBagla();
  }
  function kayanBagla() {
    const k = $('#igKayan'); if (!k) return;
    k.addEventListener('scroll', () => { const i = Math.round(k.scrollLeft / k.clientWidth); if (i !== D.slide) { D.slide = i; document.querySelectorAll('.ig-nokta i').forEach((x, j) => x.classList.toggle('on', j === i)); } }, { passive: true });
  }

  views.instagram = () => {
    if (!S.pLoaded && !S.pLoading && !S.pErr) loadProducts();
    const ust = head('Site ürünleri', 'Instagram', 'Sitedeki ürünlerden Instagram gönderisi ve hikâyesi: tek ürün, kaydırmalı ya da koleksiyon. Açıklama ve etiketler de hazırlanır.');
    if (!S.pLoaded && !S.products.length) return ust + (S.pErr ? CLK.errBox(S.pErr, 'reloadP') : `<div class="card"><p class="sk-say">Ürünler yükleniyor… ${esc(S.pProg || '')}</p><div class="skel" style="height:240px"></div></div>`);
    const tur = TUR[D.tur], l = secili();
    return `${ust}
      <div class="ig-duzen">
        <div class="ig-sol">
          <div class="card">
            <div class="gd-adim"><span>1</span><h3>Gönderi türü</h3></div>
            <div class="ig-turler">${Object.entries(TUR).map(([k, v]) => `<button type="button" class="ig-tur" data-act="igTur" data-v="${k}" aria-pressed="${D.tur === k}"><b>${v.ad}</b><small>${v.not}</small></button>`).join('')}</div>
            <div class="ig-satir">
              <div class="gd-seg" role="group" aria-label="Boyut">${Object.entries(BICIM).map(([k, [ad]]) => `<button data-act="igBicim" data-v="${k}" aria-pressed="${D.bicim === k}">${ad}</button>`).join('')}</div>
              <div class="gd-seg" role="group" aria-label="Tasarım">${[['acik', 'Açık'], ['koyu', 'Siyah ve altın']].map(([k, ad]) => `<button data-act="igTema" data-v="${k}" aria-pressed="${D.tema === k}">${ad}</button>`).join('')}</div>
            </div>
          </div>
          <div class="card">
            <div class="gd-adim"><span>2</span><h3>${tur.en > 1 ? 'Ürünler (2–4)' : 'Ürün'}</h3></div>
            ${l.length ? `<div class="ig-secim">${l.map(p => `<span class="ig-chip">${esc(guzelAd(p.name))}<button data-act="igSec" data-id="${esc(String(p.id))}" aria-label="Çıkar">×</button></span>`).join('')}</div>` : ''}
            <div class="ig-ara"><input id="igAra" type="search" value="${esc(D.ara)}" placeholder="Ürün adı, kodu ya da kategori" autocomplete="off">${kutu('igStokta', D.stokta, 'Yalnız stokta')}</div>
            <div class="ig-liste" id="igListe">${listeHtml()}</div>
          </div>
          <div class="card">
            <div class="gd-adim"><span>3</span><h3>Yazılar ve fiyat</h3></div>
            <div class="kt-fiyat" role="group" aria-label="Fiyat">${FIYAT.map(([k, ad]) => `<button class="chip" data-act="igFiyat" data-v="${k}" aria-pressed="${D.fiyat === k}">${ad}</button>`).join('')}</div>
            <div class="ek-form kt-form">
              <label>${D.tur === 'koleksiyon' ? 'Başlık' : 'Üst yazı (isteğe bağlı)'}<input id="igUst" value="${esc(D.ust)}" maxlength="40" placeholder="${D.tur === 'koleksiyon' ? 'Yeni Gelenler' : 'örn. Yeni Sezon, %20 İndirim, Stokta'}"></label>
              <label>Alt yazı (isteğe bağlı)<input id="igAlt" value="${esc(D.alt)}" maxlength="60" placeholder="${D.tur === 'koleksiyon' ? 'Kasım 2026 · 4 model' : 'örn. Sınırlı stok'}"></label>
            </div>
            <div class="kt-kutular">${kutu('igOlcu', D.olcu, 'Ölçü ve malzeme')}${kutu('igRenk', D.renk, 'Renkler')}${kutu('igKod', D.kod, 'Ürün kodu')}</div>
          </div>
          <div class="card">
            <div class="gd-adim"><span>4</span><h3>Açıklama</h3></div>
            <textarea id="igCap" rows="11" class="ig-cap-alan" placeholder="Ürün seçince açıklama ve etiketler burada yazılır.">${esc(D.capElle ? D.cap : aciklama())}</textarea>
            <div class="ek-dug"><button class="btn sm" data-act="igKopya">Açıklamayı kopyala</button>${D.capElle ? '<button class="btn sm ghost" data-act="igYeniden">Yeniden yaz</button>' : ''}</div>
          </div>
        </div>
        <div class="ig-sag">
          <div class="card ig-cikti">
            <h3>Önizleme</h3><p class="sub" id="igDurum" role="status">${esc(D.durum)}</p>
            <div id="igOn">${onizlemeHtml()}</div>
            <div class="ek-dug">
              <button class="btn gold" data-act="igPaylas" data-hazir ${D.resimler.length ? '' : 'disabled'}>Instagram'da paylaş</button>
              <button class="btn" data-act="igIndir" data-hazir ${D.resimler.length ? '' : 'disabled'}>Resimleri indir</button>
            </div>
            <p class="hint">Paylaşınca açıklama panoya kopyalanır; Instagram'da açıklama alanına yapıştırın. Kaydırmalıda kareleri bu sırayla seçin.</p>
          </div>
        </div>
      </div>`;
  };
  views.bind_instagram = () => {
    const a = $('#igAra');
    a?.addEventListener('input', () => { clearTimeout(a.t); a.t = setTimeout(() => { D.ara = a.value; D.goster = 40; const b = $('#igListe'); if (b) b.innerHTML = listeHtml(); }, 200); });
    for (const [id, k] of [['igUst', 'ust'], ['igAlt', 'alt']]) $('#' + id)?.addEventListener('input', e => { D[k] = e.target.value; planla(); });
    for (const [id, k] of [['igStokta', 'stokta'], ['igOlcu', 'olcu'], ['igRenk', 'renk'], ['igKod', 'kod']]) $('#' + id)?.addEventListener('change', e => {
      D[k] = e.target.checked; sakla();
      if (k === 'stokta') { const b = $('#igListe'); if (b) b.innerHTML = listeHtml(); }
      planla();
    });
    $('#igCap')?.addEventListener('input', e => { D.cap = e.target.value; if (!D.capElle) { D.capElle = true; } });
    kayanBagla();
    // ilk açılışta ya da geri gelince seçili ürün varsa resimler yeniden çizilir
    if (D.sec.length && (D.kirli || !D.resimler.length) && !D.calisiyor && S.products.length) planla();
  };
  const ciz = () => { S.keepScroll = true; render(); };
  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'igTur') {
      D.tur = el.dataset.v; sakla();
      if (TUR[D.tur].en === 1 && D.sec.length > 1) D.sec = D.sec.slice(0, 1);
      temizle(); D.durum = ''; D.kirli = true; ciz();
    }
    else if (act === 'igBicim' || act === 'igTema' || act === 'igFiyat') {
      D[{ igBicim: 'bicim', igTema: 'tema', igFiyat: 'fiyat' }[act]] = el.dataset.v; sakla(); D.kirli = true; ciz();
    }
    else if (act === 'igSec') {
      const id = el.dataset.id, i = D.sec.indexOf(id), en = TUR[D.tur].en;
      if (i >= 0) D.sec.splice(i, 1);
      else if (en === 1) D.sec = [id];
      else if (D.sec.length >= en) { toast(`Koleksiyonda en çok ${en} ürün olur`); return; }
      else D.sec.push(id);
      // başka ürün seçilince elle yazılan açıklama eski ürünü anlatmasın
      D.capElle = false; D.kirli = true; if (!D.sec.length) { temizle(); D.durum = ''; }
      ciz();
    }
    else if (act === 'igDaha') { D.goster += 60; const b = $('#igListe'); if (b) b.innerHTML = listeHtml(); }
    else if (act === 'igKopya') kopyala();
    else if (act === 'igYeniden') { D.capElle = false; D.cap = aciklama(); ciz(); }
    else if (act === 'igPaylas') paylas(D.resimler);
    else if (act === 'igIndir') D.resimler.forEach((r, i) => setTimeout(() => resimIndir(r), i * 350));
    else if (act === 'igTek') { const r = D.resimler[+el.dataset.i]; if (r) resimIndir(r); }
    else prevAct?.(act, el, e);
  };
})();
