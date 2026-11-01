/* CLK Yönetim — Instagram gönderisi (celik isteği 01.11.2026: "panele Instagram post ile alakalı bir form hazırla, Instagram üzerindeki
   çantacıların içeriklerine bak, hangisi bize uygunsa onu tasarla").
   Çanta satıcılarının en çok kullandığı üç gönderi: tek ürün (büyük fotoğraf, fiyat etiketi, renkler, WhatsApp/DM çağrısı),
   kaydırmalı (kapak + ürünün bütün fotoğrafları + son karede ölçü, malzeme, renk, fiyat) ve koleksiyon (2–4 ürün, "Yeni gelenler").
   Gönderi 4:5 (1080×1350, akışta en çok yer kaplayan boy) ya da hikâye 9:16 (1080×1920; üst ve alt Instagram arayüzü için boş).
   Açıklama ve etiketler (hashtag) üründen yazılır, düzenlenebilir. Paylaşınca açıklama panoya kopyalanır. Sunucuya bir şey yazılmaz.
   Tasarım 01.11 akşamı celik isteğiyle lüks düzene geçti: kemer fon, ince altın çerçeve, altın mühürde fiyat (aşağıda TEMA).
   Lüks sahne (celik 01.11 "photoroomdan dene"): kapak Photoroom'un ürettiği sahnede tam ekran çizilir (ürün pikselleri aynen kalır);
   yalnız "Sahneyi üret"e basınca üretilir (~0,10 $). Manken karesi (celik 01.11 "instagram içinde 1 sayfa da mankenli mi yapsak"):
   kaydırmalının 2. karesi ürünün manken fotoğrafı ya da "Manken üret" (fal.ai, ~0,04 $) ile tam ekran. */
(() => {
  const { S, $, esc, num, toast, head, views, render, loadProducts, P, sb } = CLK;
  const TEL = '0534 077 88 67', SITE = 'clkcanta.com';
  const RENK = { INK: '#121110', GOLD: '#b48f55', GOLD2: '#d6bd8f', CREAM: '#f6f4f0', LINE: '#e8e3db', MUTED: '#7a746b' };
  const TUR = {
    tek: { ad: 'Tek ürün', not: 'Kemer fonda büyük fotoğraf, altın mühürde fiyat, renkler.', en: 1 },
    kaydir: { ad: 'Kaydırmalı', not: 'Kapak, ürünün bütün fotoğrafları, son karede ölçü, malzeme, fiyat.', en: 1 },
    koleksiyon: { ad: 'Koleksiyon', not: '2–4 ürün tek karede: yeni gelenler, kampanya.', en: 4 }
  };
  const BICIM = { gonderi: ['Gönderi 4:5', 1350], hikaye: ['Hikâye 9:16', 1920] };
  const FIYAT = [['yok', 'Fiyatsız'], ['site', 'Site fiyatı'], ['b1', 'Bayi 1'], ['b2', 'Bayi 2'], ['b3', 'Bayi 3'], ['b4', 'Bayi 4']];
  const AYAR = { tur: 'tek', bicim: 'gonderi', tema: 'acik', fiyat: 'site', olcu: true, renk: true, kod: true, stokta: true, sahne: 'yok' };
  // Photoroom sahneleri: panelde Türkçe ad, Photoroom'a İngilizce tarif (üstte logo, altta yazı için sakin alan istenir)
  const SAHNE = [
    ['yok', 'Kemer (sahnesiz)', ''],
    ['mermer', 'Mermer kaide', 'the product standing on a polished warm beige marble pedestal in a softly lit luxury boutique, warm golden accent light from the side, plain softly blurred backdrop, elegant minimal composition, premium fashion campaign photography'],
    ['butik', 'Butik', 'an elegant high-end boutique interior softly out of focus with warm brass details, the product standing on a cream travertine plinth, warm soft light, calm empty space above and below the product, luxury editorial photography'],
    ['ipek', 'İpek', 'the product standing on a low ivory stone plinth in front of softly draped champagne silk fabric, gentle diffused daylight, airy calm composition, luxury still-life photography'],
    ['gece', 'Gece', 'the product standing on a black glossy plinth with subtle reflections in a dark charcoal studio, soft spotlight from above and a warm gold rim light, luxury evening campaign photography'],
    // celik 01.11 gece: "daha güzel ve farklı tema" — Instagram'da çanta satıcılarının sık kullandığı sahneler
    ['pampas', 'Taş ve pampas', 'the product standing on a low warm beige travertine stone block, dried pampas grass in a ceramic vase beside it, sculpted neutral plaster wall, soft natural window light, modern minimal luxury lifestyle photography'],
    ['gunes', 'Gün ışığı', 'the product standing on a light stone ledge in front of a warm cream plaster wall with soft golden-hour sunlight and gentle palm leaf shadows, Mediterranean summer luxury campaign photography'],
    ['kadife', 'Kadife', 'the product standing on a round brushed brass pedestal in front of deep emerald green velvet drapery with soft folds, warm moody spotlight, opulent luxury editorial photography'],
    ['pastel', 'Pastel kemer', 'the product standing on a smooth pastel cylinder pedestal in front of a large arched niche in a soft blush pink wall, soft even diffused light, playful premium fashion photography']
  ];
  const SAHNE_SON = ' No text, no letters, no logos, no people.';
  const KITLE = [['kadin', 'Kadın'], ['erkek', 'Erkek'], ['kiz-cocuk', 'Kız çocuk'], ['erkek-cocuk', 'Erkek çocuk']];
  const TASIMA = [['omuz', 'Omuzda'], ['capraz', 'Çapraz'], ['el', 'Elde'], ['sirt', 'Sırtta']];
  let kayit = {};
  try { kayit = JSON.parse(localStorage.getItem('clk-instagram') || '{}'); } catch {}
  const D = (S.ui.ig ||= { ...AYAR, ...kayit, sec: [], ara: '', goster: 40, ust: '', alt: '', cap: '', capElle: false, resimler: [], durum: '', calisiyor: false, kirli: false, slide: 0 });
  // üretilenler yalnız bu oturumda tutulur (sahne: ürün|sahne|boyut → resim; manken: ürün → resim); seçim ürün başına
  D.sahneler ||= {}; D.mankenler ||= {}; D.mankenSec ||= {}; D.sahneIs ||= ''; D.mankenIs ||= ''; D.kitle ||= ''; D.tasima ||= '';
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
  /* lüks tasarım (celik 01.11: "tasarımı biraz daha lüks yap"): bol boşluk, ince altın çift çerçeve, kemer (arch) fon içinde ürün,
     Cormorant Garamond başlıklar, harf aralıklı küçük büyük harf etiketler, altın varak mühürde fiyat, hafif kâğıt dokusu.
     Ağır siyah bantlar ve hap etiketler kaldırıldı. Ürün fotoğrafının piksellerine dokunulmaz (doku yalnız zemine). */
  const TEMA = {
    acik: { ad: 'Fildişi', zemin: ['#f8f4ed', '#ebe2d4'], isik: [255, 255, 255, 0.8], kemer: ['#eee5d8', '#e2d6c5'], yazi: '#1f1a15', soluk: '#7d7265', altin: '#9a7741', cizgi: 'rgba(154,119,65,.5)', koyu: false },
    mocha: { ad: 'Mocha', zemin: ['#4b3629', '#271c15'], isik: [120, 88, 62, 0.55], kemer: ['#f3ebdf', '#e5d9c7'], yazi: '#f5ecdf', soluk: '#cbb9a2', altin: '#dcc08b', cizgi: 'rgba(220,192,139,.55)', koyu: true },
    koyu: { ad: 'Siyah ve altın', zemin: ['#1c1916', '#0a0908'], isik: [92, 78, 58, 0.5], kemer: ['#f1eadf', '#e3d9c9'], yazi: '#f6f0e5', soluk: '#a99f90', altin: '#d8bf90', cizgi: 'rgba(216,191,144,.5)', koyu: true }
  };
  const T = () => TEMA[D.tema] || TEMA.acik;
  const SERIF = '"Cormorant Garamond", "Playfair Display", Georgia, serif';
  const FS = (b, z, it) => `${it ? 'italic ' : ''}${b} ${Math.round(z)}px ${SERIF}`;
  // fiyat rakamları Playfair ile: Cormorant'ın eski usul rakamları (1.249) küçük ve zor okunuyor
  const FP = (b, z) => `${b} ${Math.round(z)}px "Playfair Display", Georgia, serif`;
  // altın varak: koyu temada açık parlak, açık temada koyu altın geçişi
  function varak(g, x0, x1, koyu = T().koyu) {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    (koyu ? [[0, '#b08b52'], [0.3, '#f0dcaf'], [0.5, '#c9a76c'], [0.75, '#ead3a2'], [1, '#a5814a']] : [[0, '#7f6232'], [0.35, '#b8955a'], [0.6, '#8d6d39'], [1, '#a98549']]).forEach(([o, c]) => gr.addColorStop(o, c));
    return gr;
  }
  // harf aralıklı büyük harf yazı; ortalıda son harfin aralığı da hesaba katılır
  function aralikli(g, t, x, y, z, ara, renk, hiza = 'center', b = 600, maxW = 0) {
    t = buyuk(t); g.font = F(b, z); g.letterSpacing = ara + 'px';
    while (maxW && z > 11 && g.measureText(t).width > maxW) { z -= 1; g.font = F(b, z); }
    g.fillStyle = renk; g.textAlign = hiza; g.fillText(t, x + (hiza === 'center' ? ara / 2 : hiza === 'right' ? ara : 0), y);
    const w = g.measureText(t).width; g.letterSpacing = '0px'; g.textAlign = 'left'; return w;
  }
  // iki yanında ince çizgi olan etiket: ——  OKUL  ——
  function cizgiliEtiket(g, t, cx, y, z = 20) {
    const s = T(), w = aralikli(g, t, cx, y, z, 7, s.altin, 'center', 600, 560), u = 54, b = 22;
    g.fillStyle = s.cizgi; g.fillRect(cx - w / 2 - b - u, y - z * 0.36, u, 1.4); g.fillRect(cx + w / 2 + b, y - z * 0.36, u, 1.4);
  }
  let grenDesen = null;
  function gren(g, W, H, a) {
    if (!grenDesen) {
      const c = document.createElement('canvas'); c.width = c.height = 180; const x = c.getContext('2d'), d = x.createImageData(180, 180);
      for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 120; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      x.putImageData(d, 0, 0); grenDesen = c;
    }
    g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'overlay'; g.fillStyle = g.createPattern(grenDesen, 'repeat'); g.fillRect(0, 0, W, H); g.restore();
  }
  // zemin: tonlu geçiş, kemerin arkasında yumuşak ışık, doku ve ince altın çift çerçeve (bütün tuval; hikâyede de)
  function zemin(g, W, H, oy = 0) {
    const s = T(), l = g.createLinearGradient(0, 0, 0, H); l.addColorStop(0, s.zemin[0]); l.addColorStop(1, s.zemin[1]); g.fillStyle = l; g.fillRect(0, 0, W, H);
    const r = g.createRadialGradient(W / 2, oy + 520, 40, W / 2, oy + 560, 760); const [ir, ig, ib, ia] = s.isik; r.addColorStop(0, `rgba(${ir},${ig},${ib},${ia})`); r.addColorStop(1, `rgba(${ir},${ig},${ib},0)`); g.fillStyle = r; g.fillRect(0, 0, W, H);
    gren(g, W, H, s.koyu ? 0.09 : 0.06);
    g.strokeStyle = s.cizgi; g.lineWidth = 1.6; g.strokeRect(30, 30, W - 60, H - 60);
    g.globalAlpha = 0.55; g.lineWidth = 1; g.strokeRect(40, 40, W - 80, H - 80); g.globalAlpha = 1;
  }
  // üstte ortalı logo ve aralıklı ÇANTA
  function marka(g, W) {
    const s = T(), lg = s.koyu ? logoAltin : logoKoyu;
    if (lg) { const lh = 50, lw = lg.width / lg.height * lh; g.drawImage(lg, (W - lw) / 2, 66, lw, lh); }
    else { g.font = FS(700, 44); g.fillStyle = s.yazi; g.textAlign = 'center'; g.fillText('CLK', W / 2, 108); g.textAlign = 'left'; }
    aralikli(g, 'ÇANTA', W / 2, 146, 15, 11, s.koyu ? s.altin : s.soluk, 'center', 600);
  }
  const kemerYol = (g, x, y, w, h) => { const r = w / 2; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + r); g.arc(x + r, y + r, r, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath(); };
  // fotoğrafın kenarları beyazsa (vitrin fotoğrafı) kemerin içine çarpma ile oturur; değilse kemeri doldurur
  const fonBellek = new WeakMap();
  function beyazFon(im) {
    if (fonBellek.has(im)) return fonBellek.get(im);
    let sonuc = true;
    try {
      const c = document.createElement('canvas'); c.width = c.height = 40; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 40, 40);
      const d = x.getImageData(0, 0, 40, 40).data; let ak = 0, top = 0;
      for (let i = 0; i < 40; i++) for (const [px, py] of [[i, 0], [i, 39], [0, i], [39, i]]) { const k = (py * 40 + px) * 4; top++; if (Math.min(d[k], d[k + 1], d[k + 2]) > 228) ak++; }
      sonuc = ak / top > 0.7;
    } catch {}
    fonBellek.set(im, sonuc); return sonuc;
  }
  // ürünün (ve gölgesinin) kutusu: beyaz olmayan piksellerin sınırı + %4 pay
  const icBellek = new WeakMap();
  function icerik(im) {
    if (icBellek.has(im)) return icBellek.get(im);
    let kutu = [0, 0, im.width, im.height];
    try {
      const n = 160, k = Math.min(1, n / Math.max(im.width, im.height)), cw = Math.max(1, Math.round(im.width * k)), ch = Math.max(1, Math.round(im.height * k));
      const c = document.createElement('canvas'); c.width = cw; c.height = ch; const x = c.getContext('2d'); x.drawImage(im, 0, 0, cw, ch);
      const d = x.getImageData(0, 0, cw, ch).data; let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
      for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) { const i = (yy * cw + xx) * 4; if (Math.min(d[i], d[i + 1], d[i + 2]) < 238) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; } }
      if (x1 > x0 && y1 > y0) {
        const px = (x1 - x0) * 0.04, py = (y1 - y0) * 0.04;
        const a0 = Math.max(0, (x0 - px) / k), b0 = Math.max(0, (y0 - py) / k), a1 = Math.min(im.width, (x1 + 1 + px) / k), b1 = Math.min(im.height, (y1 + 1 + py) / k);
        kutu = [a0, b0, a1 - a0, b1 - b0];
      }
    } catch {}
    icBellek.set(im, kutu); return kutu;
  }
  function kemerFoto(g, im, x, y, w, h, cerceve = true) {
    const s = T(), gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, s.kemer[0]); gr.addColorStop(1, s.kemer[1]);
    if (cerceve) { g.save(); g.strokeStyle = s.cizgi; g.lineWidth = 1.4; kemerYol(g, x - 14, y - 14, w + 28, h + 14); g.stroke(); g.restore(); }
    g.save(); g.shadowColor = s.koyu ? 'rgba(0,0,0,.45)' : 'rgba(80,60,30,.10)'; g.shadowBlur = s.koyu ? 50 : 30; g.shadowOffsetY = 12; kemerYol(g, x, y, w, h); g.fillStyle = gr; g.fill(); g.restore();
    g.save(); kemerYol(g, x, y, w, h); g.clip();
    if (!im) { g.fillStyle = '#8b8174'; g.font = F(600, 24); g.textAlign = 'center'; g.fillText('Fotoğraf yüklenemedi', x + w / 2, y + h / 2); g.textAlign = 'left'; }
    else if (beyazFon(im)) {
      // fotoğrafın beyaz kenarları kadrajdan çıkar (pikseller değişmez); ürün kemerin tabanına oturur, üstte kemer boşluğu kalır
      const [sx, sy, sw, sh] = icerik(im), kw = w * 0.78, kx = x + (w - kw) / 2, ky = y + w * 0.2, kh = h - w * 0.2 - h * 0.075;
      const k = Math.min(kw / sw, kh / sh, 3), iw = sw * k, ih = sh * k;
      g.globalCompositeOperation = 'multiply'; g.drawImage(im, sx, sy, sw, sh, kx + (kw - iw) / 2, ky + kh - ih, iw, ih);
    } else kapla(g, im, x, y, w, h);
    g.restore();
  }
  // altın varak mühür: fiyat
  function muhur(g, cx, cy, r, f) {
    if (!f) return;
    g.save(); g.shadowColor = 'rgba(40,25,5,.35)'; g.shadowBlur = 26; g.shadowOffsetY = 10;
    g.beginPath(); g.arc(cx, cy, r, 0, 7); const gr = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    [[0, '#a8834b'], [0.32, '#efd9a9'], [0.55, '#c7a368'], [0.8, '#e6cd99'], [1, '#9c7840']].forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fill(); g.restore();
    g.strokeStyle = 'rgba(60,40,10,.35)'; g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, r - 9, 0, 7); g.stroke();
    aralikli(g, bayi() ? 'BAYİ FİYATI' : 'FİYAT', cx, cy - r * 0.3, Math.max(12, r * 0.15), 4, 'rgba(43,31,14,.75)', 'center', 700);
    g.fillStyle = '#2b1f0e'; g.textAlign = 'center'; sigYaziF(g, fmt(f), cx, cy + r * 0.2, r * 1.5, r * 0.4, 700, false, FP); g.textAlign = 'left';
    g.fillStyle = 'rgba(43,31,14,.45)'; g.fillRect(cx - r * 0.18, cy + r * 0.42, r * 0.36, 1.2);
  }
  function sigYaziF(g, t, x, y, maxW, z, b, it, yaz = FS) {
    let s = z; g.font = yaz(b, s, it);
    while (s > z / 2 && g.measureText(t).width > maxW) { s -= 2; g.font = yaz(b, s, it); }
    g.fillText(t, x, y); return s;
  }
  // renk noktaları ve aralıklı adlar, ortalı
  function renkSatiri(g, rl, cx, y, maxW, r = 12) {
    if (!rl.length) return;
    const s = T(), nok = rl.filter(renkKod).slice(0, 8);
    g.font = F(600, 20); g.letterSpacing = '3px';
    const adlar = rl.join('  ·  '), dw = nok.length ? nok.length * (2 * r + 9) + 14 : 0;
    const yazi = dw + g.measureText(adlar).width <= maxW ? adlar : `${rl.length} RENK`, tw = g.measureText(yazi).width;
    g.letterSpacing = '0px';
    let x = cx - (dw + tw) / 2;
    for (const k of nok) { g.beginPath(); g.arc(x + r, y - 6, r, 0, 7); g.fillStyle = renkKod(k); g.fill(); g.lineWidth = 1.5; g.strokeStyle = s.koyu ? 'rgba(255,255,255,.7)' : 'rgba(31,26,21,.25)'; g.stroke(); x += 2 * r + 9; }
    aralikli(g, yazi, x + (nok.length ? 5 : 0), y, 20, 3, s.soluk, 'left', 600);
  }
  // alt bilgi: kısa çizgi, sipariş satırı, site
  function altBilgi(g, W, ipucu) {
    const s = T(), y = 1194;
    g.fillStyle = s.cizgi; g.fillRect(W / 2 - 60, y, 120, 1.4);
    g.save(); g.translate(W / 2, y + 0.7); g.rotate(Math.PI / 4); g.fillStyle = s.altin; g.fillRect(-4, -4, 8, 8); g.restore();
    aralikli(g, `Sipariş için DM  ·  WhatsApp ${TEL}`, W / 2, y + 50, 23, 3, s.yazi, 'center', 600, W - 170);
    g.font = FS(500, 32, true); g.fillStyle = s.altin; g.textAlign = 'center'; g.fillText(SITE, W / 2, y + 92); g.textAlign = 'left';
    if (ipucu) aralikli(g, 'KAYDIR  →', W - 78, y + 90, 18, 4, s.soluk, 'right', 600);
  }
  const bilgiYazi = p => { const b = bilgi(p), k = D.kod ? kodAl(p) : ''; return [D.olcu && b.olcu, D.olcu && b.malzeme, D.olcu && b.su, k].filter(Boolean).join('  ·  '); };
  // başlık (üst yazı): koyu temada varak, açıkta mürekkep; italik serif
  function baslik(g, t, W, y, z) {
    const s = T(); g.font = FS(500, z, true); g.textAlign = 'center';
    let zz = z; while (zz > z / 2 && g.measureText(t).width > W - 200) { zz -= 2; g.font = FS(500, zz, true); }
    const w = g.measureText(t).width; g.fillStyle = s.koyu ? varak(g, W / 2 - w / 2, W / 2 + w / 2) : s.yazi; g.fillText(t, W / 2, y); g.textAlign = 'left';
  }

  /* 1) tek ürün ve kaydırmalının kapağı */
  function tekCiz(g, W, alt, p, im, ipucu) {
    const s = T(), kat = P.cat(p), ust = D.ust.trim(), altY = D.alt.trim();
    marka(g, W);
    let ay = 236;
    if (ust) { baslik(g, ust, W, 238, 64); if (altY) aralikli(g, altY, W / 2, 284, 19, 6, s.altin, 'center', 600, W - 220); ay = altY ? 318 : 290; }
    else if (kat && kat !== 'Kategorisiz') cizgiliEtiket(g, kat, W / 2, 204);
    const aw = 600, ax = (W - aw) / 2, ab = 890;
    kemerFoto(g, im, ax, ay, aw, ab - ay);
    muhur(g, ax + aw - 14, ay + aw * 0.3, 88, fiyatAl(p));
    // ad, bilgi, renkler
    g.textAlign = 'center'; g.fillStyle = s.yazi; g.font = FS(600, 60);
    let sat = satirlar(g, guzelAd(p.name), W - 200, 2), y = 974;
    if (sat.length > 1) { g.font = FS(600, 50); sat = satirlar(g, guzelAd(p.name), W - 200, 2); y = 960; }
    for (const l of sat) { g.fillText(l, W / 2, y); y += 52; }
    g.textAlign = 'left';
    const bi = bilgiYazi(p);
    if (bi) { aralikli(g, bi, W / 2, y + 2, 21, 3, s.soluk, 'center', 600, W - 180); y += 52; }
    if (D.renk) renkSatiri(g, renkler(p), W / 2, Math.min(y + 6, 1150), W - 180);
    altBilgi(g, W, ipucu);
  }

  /* 2) kaydırmalının ara kareleri: ürünün diğer fotoğrafları büyük kemerde; altında ad ve kare numarası */
  function fotoCiz(g, W, alt, p, im, no, top) {
    const s = T();
    marka(g, W);
    const aw = 760, ax = (W - aw) / 2, ay = 196;
    kemerFoto(g, im, ax, ay, aw, 1140 - ay);
    g.textAlign = 'center'; g.fillStyle = s.yazi; g.font = FS(500, 42, true);
    g.fillText(satirlar(g, guzelAd(p.name), W - 220, 1)[0], W / 2, 1222); g.textAlign = 'left';
    aralikli(g, `${String(no).padStart(2, '0')}  /  ${String(top).padStart(2, '0')}`, W / 2, 1278, 19, 6, s.altin, 'center', 600);
  }

  /* 3) kaydırmalının son karesi: ürün bilgileri (solda kemer, sağda özellik çizelgesi) */
  function bilgiCiz(g, W, alt, p, im) {
    const s = T();
    marka(g, W);
    cizgiliEtiket(g, 'Ürün bilgileri', W / 2, 204);
    g.textAlign = 'center'; g.fillStyle = s.yazi; g.font = FS(600, 52);
    let y = 272; for (const l of satirlar(g, guzelAd(p.name), W - 200, 2)) { g.fillText(l, W / 2, y); y += 54; }
    g.textAlign = 'left';
    const b = bilgi(p), rl = renkler(p), f = fiyatAl(p), kod = kodAl(p);
    const sat = [['Ölçü', b.olcu], ['Malzeme', b.malzeme], ['Özellik', b.su], ['Renkler', rl.length ? rl.map(guzelAd).join(', ') : ''], ['Kod', kod], [bayi() ? 'Bayi fiyatı' : 'Fiyat', f ? fmt(f) : 'Mesaj atın, hemen iletelim']].filter(([, v]) => v);
    const ay = y + 6, aw = 400, ax = 92, ab = 1120;
    kemerFoto(g, im, ax, ay, aw, ab - ay);
    const sx = ax + aw + 64, sw = W - 92 - sx, sh = Math.min(118, (ab - ay) / sat.length), sy0 = ay + (ab - ay - sh * sat.length) / 2;
    sat.forEach(([k, v], i) => {
      const sy = sy0 + i * sh, son = i === sat.length - 1 && f;
      if (i) { g.fillStyle = s.cizgi; g.fillRect(sx, sy, sw, 1.2); }
      aralikli(g, k, sx, sy + sh * 0.38, 18, 4, s.altin, 'left', 600);
      g.fillStyle = son ? (s.koyu ? varak(g, sx, sx + sw) : s.yazi) : s.yazi;
      const satir = (() => { g.font = son ? FP(600, 38) : FS(600, 32); return satirlar(g, v, sw, 2); })();
      if (satir.length > 1 && !son) { g.font = FS(600, 26); const s2 = satirlar(g, v, sw, 2); s2.forEach((t, j) => g.fillText(t, sx, sy + sh * 0.4 + 34 + j * 28)); }
      else sigYaziF(g, v, sx, sy + sh * 0.4 + (son ? 48 : 42), sw, son ? 38 : 32, 600, false, son ? FP : FS);
    });
    altBilgi(g, W, false);
  }

  /* 4) koleksiyon: 2–4 ürün yan yana kemerlerde, italik başlık */
  function koleksiyonCiz(g, W, alt, l, imgs) {
    const s = T(), n = l.length;
    marka(g, W);
    baslik(g, D.ust.trim() || 'Yeni Gelenler', W, 252, 78);
    aralikli(g, D.alt.trim() || `${guzelAd(new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }))}  ·  ${n} model${bayi() ? '  ·  bayi fiyatları' : ''}`, W / 2, 300, 19, 5, s.altin, 'center', 600, W - 200);
    const sut = n === 4 ? 2 : n, sir = n === 4 ? 2 : 1, yazH = n === 4 ? 96 : 112, gx = n === 3 ? 34 : 56, gy = 26, y0 = 350, bot = 1168;
    const aw = Math.min(n === 2 ? 400 : n === 3 ? 282 : 300, (W - 180 - gx * (sut - 1)) / sut), ah = (bot - y0 - sir * yazH - gy * (sir - 1)) / sir;
    const x0 = (W - (aw * sut + gx * (sut - 1))) / 2;
    l.forEach((p, i) => {
      const x = x0 + (i % sut) * (aw + gx), y = y0 + Math.floor(i / sut) * (ah + yazH + gy);
      kemerFoto(g, imgs[i], x, y, aw, ah, false);
      const cx = x + aw / 2, f = fiyatAl(p);
      g.textAlign = 'center'; g.fillStyle = s.yazi; g.font = FS(600, n === 2 ? 36 : 30);
      g.fillText(satirlar(g, guzelAd(p.name), aw + gx - 12, 1)[0], cx, y + ah + 44); g.textAlign = 'left';
      const ry = y + ah + (n === 4 ? 84 : 92);
      if (f) { g.font = FP(600, n === 2 ? 30 : 26); g.textAlign = 'center'; const t = fmt(f), w = g.measureText(t).width; g.fillStyle = s.koyu ? varak(g, cx - w / 2, cx + w / 2) : s.altin; g.fillText(t, cx, ry); g.textAlign = 'left'; }
      else { const rl = D.renk ? renkler(p) : []; aralikli(g, rl.length ? `${rl.length} renk` : (kodAl(p) || ''), cx, ry - 4, 18, 4, s.soluk, 'center', 600, aw); }
    });
    altBilgi(g, W, false);
  }

  /* 5) Photoroom sahneli kapak (celik 01.11 gece: koyu geçişli, çerçeveli ilk düzen "çok çirkin" bulundu): sahne fotoğrafı olduğu gibi,
     üstte küçük logo (sahne açıksa koyu, koyuysa altın), altta krem kart: ad, ölçü, iletişim ve fiyat. Ürün Photoroom'da yerinde kalır. */
  // ürünün kapaktaki yeri (içerik koordinatı, 1080×1350): en çok %68 genişlik, 680 px yükseklik, alt kenarı 1010 (kartın üstünde zemin görünür)
  const YER = { w: 0.68, h: 680, alt: 1010 };
  // ürün kutusu: vitrin gölgesi (açık renksiz gri) sayılmaz, yoksa çanta kaidenin üstünde havada kalıyordu; bulunamazsa beyaz olmayan kutu
  function urunKutu(im) {
    try {
      const n = 200, k = Math.min(1, n / Math.max(im.width, im.height)), cw = Math.max(1, Math.round(im.width * k)), ch = Math.max(1, Math.round(im.height * k));
      const c = document.createElement('canvas'); c.width = cw; c.height = ch; const x = c.getContext('2d'); x.drawImage(im, 0, 0, cw, ch);
      const d = x.getImageData(0, 0, cw, ch).data; let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
      for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) {
        const i = (yy * cw + xx) * 4, lo = Math.min(d[i], d[i + 1], d[i + 2]), hi = Math.max(d[i], d[i + 1], d[i + 2]);
        if (lo < 238 && !(lo >= 196 && hi - lo <= 10)) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
      }
      if (x1 > x0 && y1 > y0 && (x1 - x0) * (y1 - y0) > cw * ch * 0.05) {
        const px = (x1 - x0) * 0.02, py = (y1 - y0) * 0.02, a0 = Math.max(0, (x0 - px) / k), b0 = Math.max(0, (y0 - py) / k);
        return [a0, b0, Math.min(im.width, (x1 + 1 + px) / k) - a0, Math.min(im.height, (y1 + 1 + py) / k) - b0];
      }
    } catch {}
    return icerik(im);
  }
  function yerlestir(im, W, H, oy) {
    const [sx, sy, sw, sh] = urunKutu(im), k = Math.min(W * YER.w / sw, YER.h / sh, 3), w = sw * k, h = sh * k;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(im, sx, sy, sw, sh, (W - w) / 2, oy + YER.alt - h, w, h);
    return c.toDataURL('image/jpeg', 0.92);
  }
  // sahnenin logo bölgesi açık mı (ortalama parlaklık)
  function ustAcik(sahne, W, H, oy) {
    try {
      const c = document.createElement('canvas'); c.width = 108; c.height = Math.round(H / 10); const x = c.getContext('2d'); kapla(x, sahne, 0, 0, c.width, c.height);
      const d = x.getImageData(32, Math.round((oy + 40) / 10), 44, 14).data; let t = 0;
      for (let i = 0; i < d.length; i += 4) t += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      return t / (d.length / 4) > 140;
    } catch { return true; }
  }
  function sahneCiz(g, W, alt, p, ipucu, acik) {
    // logo: açık sahnede koyu, koyuda altın; yumuşak gölgeyle
    const lg = acik ? logoKoyu : logoAltin;
    g.save(); g.shadowColor = acik ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.45)'; g.shadowBlur = 18;
    if (lg) { const lh = 46, lw = lg.width / lg.height * lh; g.drawImage(lg, (W - lw) / 2, 58, lw, lh); }
    aralikli(g, 'ÇANTA', W / 2, 134, 15, 11, acik ? '#3a2f22' : '#e8cf9a', 'center', 600);
    const ust = D.ust.trim(), altY = D.alt.trim();
    if (ust) {
      g.font = FS(500, 56, true); g.textAlign = 'center'; g.fillStyle = acik ? '#1f1a15' : '#fbf6ee';
      let z = 56; while (z > 30 && g.measureText(ust).width > W - 200) { z -= 2; g.font = FS(500, z, true); }
      g.fillText(ust, W / 2, 206); g.textAlign = 'left';
      if (altY) aralikli(g, altY, W / 2, 244, 17, 6, acik ? '#6b5530' : '#e8cf9a', 'center', 600, W - 220);
    }
    g.restore();
    // alt kart
    const kx = 54, ky = 1118, kw = W - 108, kh = 178, f = fiyatAl(p), ayir = kx + kw - 300;
    g.save(); g.shadowColor = 'rgba(40,28,12,.22)'; g.shadowBlur = 34; g.shadowOffsetY = 10; yuvarlak(g, kx, ky, kw, kh, 28); g.fillStyle = 'rgba(251,248,243,.95)'; g.fill(); g.restore();
    g.strokeStyle = 'rgba(154,119,65,.35)'; g.lineWidth = 1.2; yuvarlak(g, kx + 9, ky + 9, kw - 18, kh - 18, 22); g.stroke();
    const sx = kx + 44, sw = ayir - sx - 30;
    g.fillStyle = '#1f1a15'; g.font = FS(600, 46); let z = 46; const ad = guzelAd(p.name);
    while (z > 30 && g.measureText(ad).width > sw) { z -= 2; g.font = FS(600, z); }
    g.fillText(satirlar(g, ad, sw, 1)[0], sx, ky + 66);
    const bi = bilgiYazi(p);
    if (bi) aralikli(g, bi, sx, ky + 104, 16, 3, '#7d7265', 'left', 600, sw);
    aralikli(g, `DM  ·  WhatsApp ${TEL}  ·  ${SITE}`, sx, ky + 146, 15, 3, '#9a7741', 'left', 600, sw);
    g.fillStyle = 'rgba(154,119,65,.45)'; g.fillRect(ayir, ky + 30, 1.2, kh - 60);
    const cx = (ayir + kx + kw) / 2;
    if (f) {
      aralikli(g, bayi() ? 'BAYİ FİYATI' : 'FİYAT', cx, ky + 64, 15, 6, '#9a7741', 'center', 700);
      g.fillStyle = '#1f1a15'; g.textAlign = 'center'; sigYaziF(g, fmt(f), cx, ky + 126, 250, 52, 700, false, FP); g.textAlign = 'left';
    } else {
      aralikli(g, 'SİPARİŞ İÇİN', cx, ky + 78, 15, 6, '#9a7741', 'center', 700);
      g.fillStyle = '#1f1a15'; g.font = FS(600, 38, true); g.textAlign = 'center'; g.fillText('DM atın', cx, ky + 124); g.textAlign = 'left';
    }
    if (ipucu) { g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 10; aralikli(g, 'KAYDIR  →', W - 64, ky + kh + 38, 15, 4, '#fbf6ee', 'right', 600); g.restore(); }
  }

  /* 6) manken karesi: fotoğraf tam ekran, altta koyu geçişte ad, iletişim, logo ve kare numarası */
  function mankenCiz(g, W, H, oy, p, im, no, top) {
    g.fillStyle = '#efe9e0'; g.fillRect(0, 0, W, H); kapla(g, im, 0, 0, W, H);
    const y0 = oy + 1000, gr = g.createLinearGradient(0, y0, 0, H); gr.addColorStop(0, 'rgba(12,10,8,0)'); gr.addColorStop(0.35, 'rgba(12,10,8,.55)'); gr.addColorStop(1, 'rgba(12,10,8,.86)'); g.fillStyle = gr; g.fillRect(0, y0, W, H - y0);
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.6; g.strokeRect(30, 30, W - 60, H - 60);
    g.globalAlpha = 0.5; g.lineWidth = 1; g.strokeRect(40, 40, W - 80, H - 80); g.globalAlpha = 1;
    g.translate(0, oy);
    let lw = 0;
    if (logoAltin) { const lh = 40; lw = logoAltin.width / logoAltin.height * lh; g.drawImage(logoAltin, W - 84 - lw, 1190, lw, lh); }
    g.fillStyle = '#fbf6ee'; g.font = FS(500, 52, true);
    g.fillText(satirlar(g, guzelAd(p.name), W - 168 - Math.max(lw, 120) - 30, 1)[0], 84, 1226);
    aralikli(g, `Sipariş için DM  ·  WhatsApp ${TEL}`, 84, 1276, 18, 3, 'rgba(251,246,238,.85)', 'left', 600, W - 168 - 150);
    aralikli(g, `${String(no).padStart(2, '0')}  /  ${String(top).padStart(2, '0')}`, W - 84, 1276, 18, 6, '#e8cf9a', 'right', 600);
  }
  // manken karesine giden fotoğraf: seçilen ürün fotoğrafı, üretilen manken ya da yok (varsayılan 2. fotoğraf; Yeni ürün sayfası mankeni 2. sıraya koyar)
  function mankenAl(p) {
    const f = P.imgs(p), id = String(p.id), v = D.mankenSec[id] ?? (D.mankenler[id] ? 'uret' : f.length > 1 ? 1 : 'yok');
    if (v === 'uret') return D.mankenler[id] ? { src: D.mankenler[id], i: -1 } : null;
    return v !== 'yok' && f[v] ? { src: f[v], i: +v } : null;
  }
  const mankenDeger = p => { const v = mankenAl(p); return !v ? 'yok' : v.i < 0 ? 'uret' : String(v.i); };
  const sahneAnahtar = (p, k = D.sahne) => `${p.id}|${k}|${D.bicim}`;
  const sahneHazir = p => p && D.tur !== 'koleksiyon' && D.sahne !== 'yok' ? D.sahneler[sahneAnahtar(p)] || '' : '';

  /* yapay zekâ: bu sitenin görsel fonksiyonu; fal.ai kuyruğu 3 sn arayla sorulur (en çok ~3 dk) */
  const aiFn = (t, body) => fetch('/.netlify/functions/ai-product-image', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.message || (r.status === 504 ? 'Sunucu zaman aşımına uğradı.' : 'Görsel üretilemedi.')); return j; });
  async function ai(body) {
    const { data } = await sb.auth.getSession(); const t = data.session?.access_token; if (!t) throw new Error('Oturum kapandı. Yeniden giriş yap.');
    let j = await aiFn(t, body);
    if (j.pending) { const job = j.job; for (let i = 0; i < 60 && j.pending; i++) { await new Promise(ok => setTimeout(ok, 3000)); j = await aiFn(t, { action: 'falResult', job }); } if (j.pending) throw new Error('Üretim zaman aşımına uğradı.'); }
    if (!j.image) throw new Error(j.message || 'Görsel üretilemedi.');
    return j.image;
  }
  async function sahneUret() {
    const p = secili()[0], tarif = SAHNE.find(x => x[0] === D.sahne)?.[2];
    if (!p || !tarif || D.sahneIs) return;
    const anahtar = sahneAnahtar(p), hik = D.bicim === 'hikaye', W = 1080, H = BICIM[D.bicim][1];
    D.sahneIs = 'Photoroom sahne üretiyor… (10–40 sn)'; ciz();
    try {
      const im = await gorsel(P.imgs(p)[0]); if (!im) throw new Error('Ürün fotoğrafı açılamadı.');
      D.sahneler[anahtar] = await ai({ action: 'banner', engine: 'photoroom', format: hik ? 'ig-hikaye' : 'ig', prompt: tarif + SAHNE_SON, image: yerlestir(im, W, H, hik ? 285 : 0) });
      toast('Sahne hazır, kapakta kullanılıyor');
    } catch (e) { toast('Sahne üretilemedi: ' + e.message); }
    D.sahneIs = ''; D.kirli = true; ciz();
  }
  const kitleTahmin = p => { const t = buyuk(P.path(p) + ' ' + p.name); return /ÇOCUK|OKUL/.test(t) ? (/ERKEK/.test(t) ? 'erkek-cocuk' : 'kiz-cocuk') : /ERKEK/.test(t) ? 'erkek' : 'kadin'; };
  const tasimaTahmin = p => { const t = buyuk(P.path(p) + ' ' + p.name); return /SIRT/.test(t) ? 'sirt' : /EVRAK|LAPTOP|NOTEBOOK|VAL[İI]Z|BAVUL|EL ÇANTA|CÜZDAN|AB[İI]YE|PORTFÖY/.test(t) ? 'el' : /POSTACI|ÇAPRAZ|BEL ÇANTA|GÖĞÜS/.test(t) ? 'capraz' : 'omuz'; };
  async function mankenUret() {
    const p = secili()[0]; if (!p || D.mankenIs) return;
    const id = String(p.id);
    D.mankenIs = 'Manken üretiliyor… (1–2 dk)'; ciz();
    try {
      const im = await gorsel(P.imgs(p)[0]); if (!im) throw new Error('Ürün fotoğrafı açılamadı.');
      const c = document.createElement('canvas'); c.width = 1200; c.height = 1600; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 1200, 1600); sigdir(x, im, 0, 0, 1200, 1600);
      const [w, h, d] = ['En', 'Yükseklik', 'Boy'].map(k => +cm(nitelik(p, k)) || 0);
      D.mankenler[id] = await ai({ action: 'model', image: c.toDataURL('image/jpeg', 0.9), audience: D.kitle || kitleTahmin(p), carry: D.tasima || tasimaTahmin(p), size: { w, h, d } });
      D.mankenSec[id] = 'uret'; toast('Manken hazır, 2. karede');
    } catch (e) { toast('Manken üretilemedi: ' + e.message); }
    D.mankenIs = ''; D.kirli = true; ciz();
  }

  /* resimleri hazırla: tuval → JPEG; ayar değişince kendiliğinden yenilenir */
  let sayac = 0, zaman = 0;
  const planla = () => { D.kirli = true; clearTimeout(zaman); zaman = setTimeout(hazirla, 220); };
  async function hazirla() {
    const l = secili(), tur = TUR[D.tur];
    if (!l.length || (D.tur === 'koleksiyon' && l.length < 2)) { temizle(); onizlemeYenile(); return; }
    const benim = ++sayac; D.kirli = false; D.calisiyor = true; durumYaz('Hazırlanıyor…');
    try {
      await Promise.all([logolar(), document.fonts?.load?.('700 40px Inter'), document.fonts?.load?.('600 40px Inter'), document.fonts?.load?.('600 40px "Cormorant Garamond"'), document.fonts?.load?.('700 40px "Cormorant Garamond"'), document.fonts?.load?.('italic 500 40px "Cormorant Garamond"'), document.fonts?.load?.('600 40px "Playfair Display"')].map(x => Promise.resolve(x).catch(() => null)));
      const W = 1080, H = BICIM[D.bicim][1], hik = D.bicim === 'hikaye', oy = hik ? 285 : 0, alt = H - oy;
      const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
      const kareler = [];
      const ciz = async fn => { g.save(); g.clearRect(0, 0, W, H); g.letterSpacing = '0px'; await fn(); g.restore(); kareler.push(await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92))); };
      if (D.tur === 'koleksiyon') {
        const imgs = await Promise.all(l.slice(0, tur.en).map(p => gorsel(P.img(p))));
        await ciz(() => { zemin(g, W, H, oy); g.translate(0, oy); koleksiyonCiz(g, W, alt, l.slice(0, tur.en), imgs); });
      } else {
        const p = l[0], fotolar = P.imgs(p), im = await gorsel(fotolar[0]), ipucu = D.tur === 'kaydir' && !hik;
        const sahneSrc = sahneHazir(p), sahne = sahneSrc ? await gorsel(sahneSrc) : null;
        await ciz(() => {
          if (!sahne) { zemin(g, W, H, oy); g.translate(0, oy); tekCiz(g, W, alt, p, im, ipucu); return; }
          g.fillStyle = '#1c1916'; g.fillRect(0, 0, W, H); kapla(g, sahne, 0, 0, W, H);
          const acik = ustAcik(sahne, W, H, oy); g.translate(0, oy); sahneCiz(g, W, alt, p, ipucu, acik);
        });
        if (D.tur === 'kaydir') {
          // kaydırmalı en çok 10 kare: kapak + (manken) + fotoğraflar + bilgi; manken karesine giden fotoğraf ara karelerde tekrar etmez
          const mk = mankenAl(p), mIm = mk ? await gorsel(mk.src) : null;
          const digerleri = fotolar.slice(1).filter((_, j) => !mIm || j + 1 !== mk.i).slice(0, mIm ? 7 : 8), ims = await Promise.all(digerleri.map(gorsel));
          const digerIm = ims.filter(Boolean), top = digerIm.length + 2 + (mIm ? 1 : 0);
          if (mIm) await ciz(() => mankenCiz(g, W, H, oy, p, mIm, 2, top));
          for (const [i, x] of digerIm.entries()) await ciz(() => { zemin(g, W, H, oy); g.translate(0, oy); fotoCiz(g, W, alt, p, x, i + (mIm ? 3 : 2), top); });
          await ciz(() => { zemin(g, W, H, oy); g.translate(0, oy); bilgiCiz(g, W, alt, p, im); });
        }
      }
      if (benim !== sayac) return;
      temizle();
      const kod = (D.tur === 'koleksiyon' ? 'koleksiyon' : String(kodAl(l[0]) || l[0].id)).replace(/[^\w-]+/g, '');
      D.resimler = kareler.map((blob, i) => ({ blob, url: URL.createObjectURL(blob), ad: `CLK-instagram-${kod}-${hik ? 'hikaye' : 'gonderi'}-${i + 1}.jpg` }));
      D.slide = 0;
      const fs = D.fiyat !== 'yok' && l.slice(0, tur.en).some(p => !fiyatAl(p)), sb2 = D.tur !== 'koleksiyon' && D.sahne !== 'yok' && !sahneHazir(l[0]);
      D.durum = `${D.resimler.length} ${D.resimler.length > 1 ? 'kare' : 'resim'} hazır${fs ? `; fiyatı olmayan üründe fiyat yazılmadı` : ''}${sb2 ? '; sahne için "Sahneyi üret"e basın' : ''}.`;
    } catch (e) { if (benim === sayac) D.durum = 'Hazırlanamadı: ' + (e.message || e); }
    // çizim sürerken ayar değiştiyse (kirli) yeniden çizilir
    finally { if (benim === sayac) { D.calisiyor = false; if (!D.capElle) D.cap = aciklama(); onizlemeYenile(); if (D.kirli) planla(); } }
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
  // 3. adım: lüks sahne (tek ürün ve kaydırmalı) ve manken karesi (kaydırmalı)
  function sahneKart(no) {
    const p = secili()[0], hazir = sahneHazir(p), kay = D.tur === 'kaydir';
    const sahneDug = D.sahne === 'yok' ? '' : !p ? '<p class="sub">Önce ürün seçin.</p>' : D.sahneIs ? `<p class="sub ig-is">${esc(D.sahneIs)}</p>`
      : `<div class="ek-dug"><button class="btn sm ${hazir ? '' : 'gold'}" data-act="igSahneUret">${hazir ? 'Yeniden üret' : 'Sahneyi üret'} (~0,10 $)</button>${hazir ? '<span class="sub">Kapakta kullanılıyor.</span>' : ''}</div>`;
    let manken = '';
    if (kay && p) {
      const f = P.imgs(p), id = String(p.id), v = mankenDeger(p), m = D.mankenler[id];
      manken = `<h4 class="ig-alt-baslik">Manken karesi (2. kare)</h4>
        <p class="hint">Ürünün manken fotoğrafını seçin ya da yenisini üretin (~0,04 $). Seçilen fotoğraf tam ekran çizilir.</p>
        <div class="ig-mf" role="group" aria-label="Manken fotoğrafı">
          <button type="button" data-act="igManken" data-v="yok" aria-pressed="${v === 'yok'}">Yok</button>
          ${f.slice(1).map((u, j) => `<button type="button" data-act="igManken" data-v="${j + 1}" aria-pressed="${v === String(j + 1)}" aria-label="${j + 2}. fotoğraf"><img src="${esc(u)}" alt="" loading="lazy"><span>${j + 2}</span></button>`).join('')}
          ${m ? `<button type="button" data-act="igManken" data-v="uret" aria-pressed="${v === 'uret'}" aria-label="Üretilen manken"><img src="${esc(m)}" alt=""><span>Yeni</span></button>` : ''}
        </div>
        <div class="ig-mu">${sec('igKitle', KITLE, D.kitle || kitleTahmin(p))}${sec('igTasima', TASIMA, D.tasima || tasimaTahmin(p))}
          <button class="btn sm" data-act="igMankenUret" ${D.mankenIs ? 'disabled' : ''}>${D.mankenIs ? esc(D.mankenIs) : `${m ? 'Yeniden' : 'Manken'} üret (~0,04 $)`}</button></div>`;
    }
    return `<div class="card">
      <div class="gd-adim"><span>${no}</span><h3>Lüks sahne${kay ? ' ve manken' : ''}</h3></div>
      <p class="hint">Kapak Photoroom'un ürettiği lüks sahnede çizilir; ürün fotoğrafı aynen kalır. Her üretim ~0,10 $ ve yalnız düğmeye basınca yapılır.</p>
      <div class="kt-fiyat" role="group" aria-label="Sahne">${SAHNE.map(([k, ad]) => `<button class="chip" data-act="igSahne" data-v="${k}" aria-pressed="${D.sahne === k}">${ad}${k !== 'yok' && p && D.sahneler[sahneAnahtar(p, k)] ? ' ✓' : ''}</button>`).join('')}</div>
      ${sahneDug}${manken}
    </div>`;
  }
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
    const tur = TUR[D.tur], l = secili(), sahneVar = D.tur !== 'koleksiyon', n = sahneVar ? 4 : 3;
    return `${ust}
      <div class="ig-duzen">
        <div class="ig-sol">
          <div class="card">
            <div class="gd-adim"><span>1</span><h3>Gönderi türü</h3></div>
            <div class="ig-turler">${Object.entries(TUR).map(([k, v]) => `<button type="button" class="ig-tur" data-act="igTur" data-v="${k}" aria-pressed="${D.tur === k}"><b>${v.ad}</b><small>${v.not}</small></button>`).join('')}</div>
            <div class="ig-satir">
              <div class="gd-seg" role="group" aria-label="Boyut">${Object.entries(BICIM).map(([k, [ad]]) => `<button data-act="igBicim" data-v="${k}" aria-pressed="${D.bicim === k}">${ad}</button>`).join('')}</div>
              <div class="gd-seg" role="group" aria-label="Tasarım">${Object.entries(TEMA).map(([k, { ad }]) => `<button data-act="igTema" data-v="${k}" aria-pressed="${D.tema === k}">${ad}</button>`).join('')}</div>
            </div>
          </div>
          <div class="card">
            <div class="gd-adim"><span>2</span><h3>${tur.en > 1 ? 'Ürünler (2–4)' : 'Ürün'}</h3></div>
            ${l.length ? `<div class="ig-secim">${l.map(p => `<span class="ig-chip">${esc(guzelAd(p.name))}<button data-act="igSec" data-id="${esc(String(p.id))}" aria-label="Çıkar">×</button></span>`).join('')}</div>` : ''}
            <div class="ig-ara"><input id="igAra" type="search" value="${esc(D.ara)}" placeholder="Ürün adı, kodu ya da kategori" autocomplete="off">${kutu('igStokta', D.stokta, 'Yalnız stokta')}</div>
            <div class="ig-liste" id="igListe">${listeHtml()}</div>
          </div>
          ${sahneVar ? sahneKart(3) : ''}
          <div class="card">
            <div class="gd-adim"><span>${n}</span><h3>Yazılar ve fiyat</h3></div>
            <div class="kt-fiyat" role="group" aria-label="Fiyat">${FIYAT.map(([k, ad]) => `<button class="chip" data-act="igFiyat" data-v="${k}" aria-pressed="${D.fiyat === k}">${ad}</button>`).join('')}</div>
            <div class="ek-form kt-form">
              <label>${D.tur === 'koleksiyon' ? 'Başlık' : 'Üst yazı (isteğe bağlı)'}<input id="igUst" value="${esc(D.ust)}" maxlength="40" placeholder="${D.tur === 'koleksiyon' ? 'Yeni Gelenler' : 'örn. Yeni Sezon, %20 İndirim, Stokta'}"></label>
              <label>Alt yazı (isteğe bağlı)<input id="igAlt" value="${esc(D.alt)}" maxlength="60" placeholder="${D.tur === 'koleksiyon' ? 'Kasım 2026 · 4 model' : 'örn. Sınırlı stok'}"></label>
            </div>
            <div class="kt-kutular">${kutu('igOlcu', D.olcu, 'Ölçü ve malzeme')}${kutu('igRenk', D.renk, 'Renkler')}${kutu('igKod', D.kod, 'Ürün kodu')}</div>
          </div>
          <div class="card">
            <div class="gd-adim"><span>${n + 1}</span><h3>Açıklama</h3></div>
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
    $('#igKitle')?.addEventListener('change', e => { D.kitle = e.target.value; });
    $('#igTasima')?.addEventListener('change', e => { D.tasima = e.target.value; });
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
      D.capElle = false; D.kirli = true; D.kitle = D.tasima = ''; if (!D.sec.length) { temizle(); D.durum = ''; }
      ciz();
    }
    else if (act === 'igSahne') { D.sahne = el.dataset.v; sakla(); D.kirli = true; ciz(); }
    else if (act === 'igSahneUret') sahneUret();
    else if (act === 'igManken') { const p = secili()[0]; if (p) { const v = el.dataset.v; D.mankenSec[String(p.id)] = v === 'yok' || v === 'uret' ? v : +v; D.kirli = true; ciz(); } }
    else if (act === 'igMankenUret') mankenUret();
    else if (act === 'igDaha') { D.goster += 60; const b = $('#igListe'); if (b) b.innerHTML = listeHtml(); }
    else if (act === 'igKopya') kopyala();
    else if (act === 'igYeniden') { D.capElle = false; D.cap = aciklama(); ciz(); }
    else if (act === 'igPaylas') paylas(D.resimler);
    else if (act === 'igIndir') D.resimler.forEach((r, i) => setTimeout(() => resimIndir(r), i * 350));
    else if (act === 'igTek') { const r = D.resimler[+el.dataset.i]; if (r) resimIndir(r); }
    else prevAct?.(act, el, e);
  };
})();
