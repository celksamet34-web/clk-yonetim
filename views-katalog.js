/* CLK Yönetim — Katalog: sitedeki ürünlerden PDF katalog; fiyatsız ya da Site / Bayi 1–4 fiyatlı (celik isteği 01.11.2026).
   06.11: lüks temalar (Fildişi, Siyah ve altın, Mocha; eski düzen "Klasik"), kemerli kapak, arka kapak (WhatsApp QR), sayfada 16 ürünlü fiyat listesi,
   PDF'te ürüne dokununca WhatsApp'ta o ürünün adıyla mesaj. 07.11: sayfalar iki kat çözünürlükte (A4 2480×3508, ~300 dpi) çizilir,
   fotoğraflar yüksek kaliteli küçültmeyle konur (celik: "görüntü doğru ama kalitesi düşük"); "Normal" seçilirse eski boyut.
   Sayfalar tarayıcıda tuvale çizilir, jsPDF ile tek PDF yapılır; indirilir ya da WhatsApp'ta paylaşılır. Sunucuya bir şey yazılmaz. */
(() => {
  const { S, $, esc, num, toast, head, views, render, loadProducts, P } = CLK;
  const FIYAT = [['yok', 'Fiyatsız'], ['site', 'Site fiyatı'], ['b1', 'Bayi 1'], ['b2', 'Bayi 2'], ['b3', 'Bayi 3'], ['b4', 'Bayi 4']];
  const BICIM = { a4: { ad: 'A4 dikey (yazdırma, e-posta)', W: 1240, H: 1754, mm: [210, 297], adet: [1, 4, 6, 9, 16] }, dik: { ad: '4:5 (WhatsApp, Instagram)', W: 1080, H: 1350, mm: [216, 270], adet: [1, 4] },
    durum: { ad: 'WhatsApp durum (9:16 resimler)', W: 1080, H: 1920, adet: [1], resim: true } };
  const IZGARA = { 1: [1, 1], 4: [2, 2], 6: [3, 2], 9: [3, 3], 16: [2, 8] };
  const SIRA = [['kat', 'Kategoriye göre'], ['ad', 'Ada göre'], ['artan', 'Fiyat artan'], ['azalan', 'Fiyat azalan'], ['yeni', 'En yeni önce']];
  const TEL = '0534 077 88 67', SITE = 'clkcanta.com', ADRES = 'Birlik Mah. 873 Sk. No:2/A Esenler / İstanbul';
  const RENK = { INK: '#121110', INK2: '#1d1b19', GOLD: '#b48f55', GOLD2: '#d6bd8f', CREAM: '#f6f4f0', LINE: '#e8e3db', MUTED: '#7a746b' };
  const COZ = [['yuksek', 'Yüksek (net, ~300 dpi)'], ['normal', 'Normal (küçük dosya)']];
  const ayYil = () => new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  const VARS = { tema: 'kurumsal', ktema: 'fildisi', arka: true, coz: 'yuksek', baslik: 'Ürün Kataloğu', alt: '', fiyat: 'yok', bicim: 'a4', adet: 4, sira: 'kat', not: '', kapak: true, katSayfa: true, kod: true, renk: true, olcu: true, kat: '', stokta: true, aktif: true };
  let kayit = {};
  try { kayit = JSON.parse(localStorage.getItem('clk-katalog') || '{}'); } catch {}
  const D = (S.ui.kt ||= { ...VARS, ...kayit, cikar: new Set(kayit.cikar || []), ara: '', goster: 60, durum: '', calisiyor: false, url: '', blob: null, onizleme: [] });
  const sakla = () => { try { localStorage.setItem('clk-katalog', JSON.stringify({ ...Object.fromEntries(Object.keys(VARS).map(k => [k, D[k]])), cikar: [...D.cikar] })); } catch {} };
  const sifirla = () => { if (D.url) URL.revokeObjectURL(D.url); for (const r of D.resimler || []) URL.revokeObjectURL(r.url); D.url = ''; D.blob = null; D.resimler = []; D.onizleme = []; D.durum = ''; };

  const buyuk = s => String(s || '').toLocaleUpperCase('tr');
  const fmt = v => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(v) + ' ₺';
  // Bayi 2–4 boşsa sitede de Bayi 1 geçerli (Siteye gönder ile aynı); fiyat yoksa 0
  const fiyatAl = (p, a = D.fiyat) => {
    if (a === 'yok') return 0;
    const v = a === 'site' ? +p.salePrice : (+p['dealerPrice' + a.slice(1)] || +p.dealerPrice1);
    return v > 0 ? v : 0;
  };
  // PRS-<paraşüt id> ve rastgele CLK-xxxxxxxxxxxx kodları müşteriye anlamsız: model kodu varsa o, yoksa kod yazılmaz
  const kodAl = p => { const m = String(p.modelCode || '').trim(), c = String(p.code || '').trim(); return m || (/^(PRS|CLK)-/i.test(c) ? '' : c); };
  // ürün nitelikleri (Qukasoft attributes): En × Yükseklik × Boy (derinlik), Malzeme, Su Geçirmez
  const nitelik = (p, ad) => { const a = (Array.isArray(p.attributes) ? p.attributes : []).find(x => buyuk(x.name).replace(/İ/g, 'I') === buyuk(ad).replace(/İ/g, 'I')); return String(a?.value ?? '').trim(); };
  const cm = v => String(v).replace(',', '.').replace(/\s*cm$/i, '').trim();
  function bilgi(p) {
    const o = ['En', 'Yükseklik', 'Boy'].map(k => cm(nitelik(p, k))).filter(Boolean);
    const olcu = o.length ? o.map(x => x.replace('.', ',')).join(' × ') + (o.every(x => /^\d+([.,]\d+)?$/.test(x)) ? ' cm' : '') : '';
    const malzeme = nitelik(p, 'Malzeme'), suV = buyuk(nitelik(p, 'Su Geçirmez'));
    const su = /^(EVET|VAR|1|TRUE)$/.test(suV) || suV.includes('GEÇİRMEZ') ? 'Su geçirmez' : '';
    return { olcu, malzeme: malzeme ? guzelAd(malzeme) : '', su };
  }
  const bilgiYazi = p => { if (!D.olcu) return ''; const b = bilgi(p); return [b.olcu, b.malzeme, b.su].filter(Boolean).join(' · '); };
  const renkler = p => {
    const l = (Array.isArray(p.variants) ? p.variants : []).filter(v => !D.stokta || (+v.quantity || 0) > 0).map(v => String(v.value1 || '').trim()).filter(Boolean);
    return [...new Set(l.map(buyuk))];
  };

  // katalog listesi: filtreler, sonra elle çıkarılanlar
  function filtreli() {
    const q = buyuk(D.ara).split(/\s+/).filter(Boolean);
    return S.products.filter(p => {
      if (D.aktif && !P.on(p)) return false;
      if (D.stokta && P.qty(p) <= 0) return false;
      if (D.kat && !(P.path(p) === D.kat || P.path(p).startsWith(D.kat + ' › '))) return false;
      if (q.length) { const t = buyuk(p.name + ' ' + (p.code || '') + ' ' + (p.modelCode || '')); if (!q.every(k => t.includes(k))) return false; }
      return true;
    });
  }
  function sirala(l) {
    const ad = (a, b) => String(a.name).localeCompare(String(b.name), 'tr');
    const f = { kat: (a, b) => P.path(a).localeCompare(P.path(b), 'tr') || ad(a, b), ad, artan: (a, b) => fiyatAl(a) - fiyatAl(b) || ad(a, b), azalan: (a, b) => fiyatAl(b) - fiyatAl(a) || ad(a, b), yeni: (a, b) => (+b.id || 0) - (+a.id || 0) }[D.sira] || ad;
    return l.slice().sort(f);
  }
  const katalogdakiler = () => sirala(filtreli().filter(p => P.img(p) && !D.cikar.has(String(p.id))));
  function katSecenek() {
    const say = {};
    for (const p of S.products) { if (D.aktif && !P.on(p)) continue; const k = P.path(p).split(' › '); for (let i = 1; i <= k.length; i++) { const y = k.slice(0, i).join(' › '); say[y] = (say[y] || 0) + 1; } }
    return Object.entries(say).sort((a, b) => a[0].localeCompare(b[0], 'tr'));
  }

  /* çizim yardımcıları */
  // Sayfa mantıksal ölçüde (W×H) çizilir, tuval k katı büyüklüktedir: fotoğraflar küçülmeden kalır. Gölge bulanıklığı ve kayması
  // dönüşümden etkilenmediği için k ile çarpılır. Fotoğraflar yüksek kaliteli küçültmeyle çizilir (varsayılan düşük kalite tırtıklı ve bulanık).
  const GOLGE = new Set(['shadowBlur', 'shadowOffsetX', 'shadowOffsetY']);
  function tuval(W, H, k) {
    const c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k);
    const t = c.getContext('2d');
    const g = k === 1 ? t : new Proxy(t, {
      get: (o, a) => { const v = o[a]; return typeof v === 'function' ? v.bind(o) : GOLGE.has(a) ? v / k : v; },
      set: (o, a, v) => { o[a] = GOLGE.has(a) ? v * k : v; return true; }
    });
    const hazirla = () => { t.setTransform(k, 0, 0, k, 0, 0); t.globalAlpha = 1; t.globalCompositeOperation = 'source-over'; t.imageSmoothingEnabled = true; t.imageSmoothingQuality = 'high'; t.clearRect(0, 0, W, H); };
    return { c, g, hazirla };
  }
  const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const gorselOnbellek = new Map();
  // önce doğrudan; olmazsa herkese açık görsel aracısı üzerinden (yalnız sitedeki herkese açık ürün fotoğrafı gider)
  function gorsel(src) {
    if (!src) return Promise.resolve(null);
    if (!gorselOnbellek.has(src)) gorselOnbellek.set(src, loadImg(src).catch(() => loadImg('https://wsrv.nl/?w=1200&url=' + encodeURIComponent(src))).catch(() => null));
    return gorselOnbellek.get(src);
  }
  let logoKoyu = null, logoAltin = null, logoBeyaz = null;
  async function logolar() {
    if (logoKoyu) return;
    const im = await loadImg(new URL('logo-clk.png', location.href).href).catch(() => null);
    if (!im) return;
    logoKoyu = im;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = RENK.GOLD2; g.fillRect(0, 0, c.width, c.height);
    logoAltin = c;
    const c2 = document.createElement('canvas'); c2.width = im.width; c2.height = im.height;
    const g2 = c2.getContext('2d'); g2.drawImage(im, 0, 0); g2.globalCompositeOperation = 'source-in'; g2.fillStyle = '#fff'; g2.fillRect(0, 0, c2.width, c2.height);
    logoBeyaz = c2;
  }
  const yuvarlak = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const F = (b, z, aile = 'Inter') => `${b} ${Math.round(z)}px ${aile === 'Inter' ? 'Inter, system-ui, sans-serif' : '"Playfair Display", Georgia, serif'}`;
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
  function sigdir(g, im, x, y, w, h) {
    const k = Math.min(w / im.width, h / im.height), iw = im.width * k, ih = im.height * k;
    g.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  }
  // renk adından nokta rengi; bilinmeyen renkte nokta çizilmez, yalnız adı yazılır
  const RENKLER = [['SİYAH', '#151515'], ['LACİVERT', '#1f2a44'], ['KAHVE', '#5b3a24'], ['TABA', '#a0632b'], ['CAMEL', '#b5835a'], ['BEJ', '#d8c3a5'], ['KREM', '#efe4cc'], ['VİZON', '#a39283'],
    ['ANTRASİT', '#3a3a3a'], ['FÜME', '#4d4d4d'], ['GRİ', '#8d8d8d'], ['GÜMÜŞ', '#c4c4c4'], ['BEYAZ', '#ffffff'], ['BORDO', '#6d1a24'], ['KIRMIZI', '#b3261e'], ['PEMBE', '#e8a0b4'], ['PUDRA', '#e9c9c1'],
    ['MOR', '#6a3d8f'], ['LİLA', '#b39ad1'], ['MAVİ', '#2f6fb3'], ['TURKUAZ', '#2bb3b1'], ['YEŞİL', '#3b7656'], ['HAKİ', '#6b6b3a'], ['SARI', '#e3b23c'], ['HARDAL', '#c79a2c'], ['TURUNCU', '#e07a2e'], ['ALTIN', '#c9a14a']];
  const renkKod = ad => RENKLER.find(([k]) => ad.includes(k))?.[1] || '';
  const guzelAd = s => buyuk(s).toLocaleLowerCase('tr').replace(/(^|[\s/-])(\S)/g, (m, a, b) => a + b.toLocaleUpperCase('tr'));

  /* ürün kartı: üstte 3:4 fotoğraf alanı, köşede fiyat etiketi; altta ad, kod ve renkler */
  function kart(g, p, im, x, y, w, h) {
    const s = w / 500, pad = Math.round(18 * s), r = Math.round(22 * s);
    g.save(); g.shadowColor = 'rgba(18,17,16,.10)'; g.shadowBlur = 24 * s; g.shadowOffsetY = 8 * s;
    yuvarlak(g, x, y, w, h, r); g.fillStyle = '#fff'; g.fill(); g.restore();
    const altH = Math.round(w * ((+D.adet === 1 ? (D.renk ? 0.25 : 0.19) : D.renk ? 0.36 : 0.28) + (D.olcu ? (+D.adet === 1 ? 0.03 : 0.05) : 0))), ix = x + pad, iy = y + pad, iw = w - 2 * pad, ih = h - altH - pad;
    g.save(); yuvarlak(g, ix, iy, iw, ih, Math.round(14 * s)); g.clip();
    g.fillStyle = '#fff'; g.fillRect(ix, iy, iw, ih);
    if (im) sigdir(g, im, ix, iy, iw, ih);
    else { g.fillStyle = RENK.CREAM; g.fillRect(ix, iy, iw, ih); g.fillStyle = RENK.MUTED; g.font = F(600, 20 * s); g.textAlign = 'center'; g.fillText('Fotoğraf yüklenemedi', ix + iw / 2, iy + ih / 2); g.textAlign = 'left'; }
    g.restore();
    // fiyat etiketi: altın zemin, koyu yazı (reklamlardaki fiyat rozeti)
    const f = fiyatAl(p);
    if (f) {
      const t = fmt(f), z = 30 * s; g.font = F(700, z);
      const tw = g.measureText(t).width, bw = tw + 30 * s, bh = z * 1.75, bx = ix + iw - bw - 12 * s, by = iy + 12 * s;
      g.save(); g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowBlur = 12 * s; g.shadowOffsetY = 4 * s;
      yuvarlak(g, bx, by, bw, bh, bh / 2); const gr = g.createLinearGradient(bx, by, bx + bw, by + bh); gr.addColorStop(0, RENK.GOLD); gr.addColorStop(1, '#c9a76b'); g.fillStyle = gr; g.fill(); g.restore();
      g.fillStyle = '#1b150b'; g.textBaseline = 'middle'; g.fillText(t, bx + 15 * s, by + bh / 2 + 1); g.textBaseline = 'alphabetic';
    }
    // ad (en çok 2 satır), kod, renkler
    let ty = iy + ih + 34 * s;
    const ad = 26 * s; g.font = F(700, ad); g.fillStyle = RENK.INK;
    for (const l of satirlar(g, p.name, iw, 2)) { g.fillText(l, ix, ty); ty += ad * 1.22; }
    const kod = D.kod ? kodAl(p) : '';
    if (kod) { g.font = F(500, 17 * s); g.fillStyle = RENK.MUTED; g.fillText(satirlar(g, 'Kod: ' + kod, iw, 1)[0] || '', ix, ty + 2 * s); ty += 26 * s; }
    const bi = bilgiYazi(p);
    if (bi) { g.font = F(600, 17 * s); g.fillStyle = '#4a453f'; g.fillText(satirlar(g, bi, iw, 1)[0] || '', ix, ty + 2 * s); ty += 26 * s; }
    if (D.renk) {
      const rl = renkler(p);
      if (rl.length) {
        const nr = 9 * s; let rx = ix; ty += 12 * s;
        const noktali = rl.filter(renkKod);
        for (const k of noktali.slice(0, 8)) {
          g.beginPath(); g.arc(rx + nr, ty - nr * 0.6, nr, 0, 7); g.fillStyle = renkKod(k); g.fill();
          g.lineWidth = Math.max(1, 1.5 * s); g.strokeStyle = 'rgba(18,17,16,.25)'; g.stroke(); rx += nr * 2 + 6 * s;
        }
        g.font = F(600, 16 * s); g.fillStyle = RENK.MUTED;
        // renk adları sığdığı kadar; sığmazsa sayı
        const genis = ix + iw - rx - 6 * s, adlar = rl.map(guzelAd).join(', ');
        const yazi = g.measureText(adlar).width <= genis ? adlar : `${rl.length} renk`;
        g.fillText(satirlar(g, yazi, genis, 1)[0] || '', rx + (noktali.length ? 6 * s : 0), ty);
      }
    }
  }

  function ustBant(g, W, H, kat) {
    const m = Math.round(W * 0.05), y = Math.round(H * 0.045);
    if (logoKoyu) { const lh = H * 0.026, lw = logoKoyu.width / logoKoyu.height * lh; g.drawImage(logoKoyu, m, y - lh * 0.8, lw, lh); g.font = F(700, W * 0.0125); g.fillStyle = RENK.INK; g.letterSpacing = '4px'; g.fillText('ÇANTA', m + lw + W * 0.012, y); g.letterSpacing = '0px'; }
    if (kat) { g.font = F(700, W * 0.013); g.fillStyle = '#6a5226'; g.textAlign = 'right'; g.letterSpacing = '3px'; g.fillText(satirlar(g, buyuk(kat), W * 0.6, 1)[0], W - m, y); g.letterSpacing = '0px'; g.textAlign = 'left'; }
    g.fillStyle = RENK.GOLD; g.fillRect(m, y + H * 0.014, W - 2 * m, 2);
  }
  function altBant(g, W, H, no, toplam, lk) {
    const bh = Math.round(H * 0.055), y = H - bh, m = Math.round(W * 0.05);
    g.fillStyle = RENK.INK; g.fillRect(0, y, W, bh);
    g.textBaseline = 'middle'; g.font = F(700, W * 0.0145); g.fillStyle = RENK.GOLD2;
    g.fillText(`WhatsApp ile sipariş: ${TEL}`, m, y + bh / 2);
    lk?.push({ x: m, y, w: g.measureText(`WhatsApp ile sipariş: ${TEL}`).width, h: bh, url: waUrl() });
    g.font = F(500, W * 0.013); g.fillStyle = '#cfc8bc'; g.textAlign = 'right';
    g.fillText(`${SITE}   ·   ${no} / ${toplam}`, W - m, y + bh / 2);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    if (D.not.trim()) { g.font = F(500, W * 0.012); g.fillStyle = RENK.MUTED; g.textAlign = 'center'; g.fillText(satirlar(g, D.not.trim(), W - 2 * m, 1)[0], W / 2, y - H * 0.012); g.textAlign = 'left'; }
  }
  function urunSayfasi(g, W, H, liste, imgs, kat, no, toplam, lk) {
    g.fillStyle = RENK.CREAM; g.fillRect(0, 0, W, H);
    ustBant(g, W, H, kat);
    const [sut, sat] = IZGARA[D.adet], m = Math.round(W * 0.05), gap = Math.round(W * 0.025);
    const ust = Math.round(H * 0.085), alt = Math.round(H * (D.not.trim() ? 0.085 : 0.075));
    const cw = (W - 2 * m - gap * (sut - 1)) / sut, ch = (H - ust - alt - gap * (sat - 1)) / sat;
    liste.forEach((p, i) => { const x = m + (i % sut) * (cw + gap), y = ust + Math.floor(i / sut) * (ch + gap); kart(g, p, imgs[i], x, y, cw, ch); lk?.push({ x, y, w: cw, h: ch, url: waUrl(p) }); });
    altBant(g, W, H, no, toplam, lk);
  }
  /* WhatsApp durumu (celik 01.11.2026): 1080×1920, her ürün ayrı resim. Üstteki ~220 px (ad, süre çubuğu) ve alttaki ~260 px (yanıt kutusu) boş bırakılır. */
  /* Renkli durum (celik 01.11: "daha canlı renkler daha güzel yap"): her resim sıradaki canlı renk geçişiyle, sarı fiyat çıkartması, beyaz kart, yeşil WhatsApp düğmesi */
  const PALET = [['#ff3d77', '#ff9a3c'], ['#7b2ff7', '#f107a3'], ['#0061ff', '#00c6ff'], ['#00a884', '#a8e063'], ['#ff512f', '#dd2476'], ['#1d2b64', '#1cb5e0'], ['#f7971e', '#ffd200'], ['#8e2de2', '#4a00e0']];
  function durumRenkli(g, W, H, p, im, i) {
    const [c1, c2] = PALET[i % PALET.length];
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // yumuşak ışık lekeleri ve nokta deseni
    for (const [x, y, r, a] of [[W * 0.9, H * 0.12, 420, 0.16], [W * 0.05, H * 0.55, 360, 0.12], [W * 0.75, H * 0.92, 380, 0.14]]) {
      const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(255,255,255,${a})`); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    g.fillStyle = 'rgba(255,255,255,.18)';
    for (let yy = 0; yy < 6; yy++) for (let xx = 0; xx < 6; xx++) { g.beginPath(); g.arc(W - 250 + xx * 34, 1480 + yy * 34, 5, 0, 7); g.fill(); }
    for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 5; xx++) { g.beginPath(); g.arc(70 + xx * 34, 330 + yy * 34, 5, 0, 7); g.fill(); }
    const m = 64, ust = 236;
    if (logoBeyaz) { const lh = 64, lw = logoBeyaz.width / logoBeyaz.height * lh; g.drawImage(logoBeyaz, m, ust - lh + 8, lw, lh); g.font = F(700, 23); g.fillStyle = '#fff'; g.letterSpacing = '6px'; g.fillText('ÇANTA', m + lw + 16, ust); g.letterSpacing = '0px'; }
    const kat = P.cat(p);
    if (kat && kat !== 'Kategorisiz') {
      g.font = F(700, 22); g.letterSpacing = '3px'; const t = satirlar(g, buyuk(kat), 480, 1)[0], tw = g.measureText(t).width, bh = 54, bx = W - m - tw - 44;
      yuvarlak(g, bx, ust - 38, tw + 44, bh, bh / 2); g.fillStyle = 'rgba(255,255,255,.22)'; g.fill();
      g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(t, bx + 22, ust - 38 + bh / 2 + 1); g.textBaseline = 'alphabetic'; g.letterSpacing = '0px';
    }
    // hafif eğik beyaz kart
    const cw = W - 2 * m - 20, ch = 960, cx = (W - cw) / 2, cy = 320;
    g.save(); g.translate(W / 2, cy + ch / 2); g.rotate(-0.025);
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 60; g.shadowOffsetY = 24; yuvarlak(g, -cw / 2, -ch / 2, cw, ch, 48); g.fillStyle = '#fff'; g.fill();
    g.shadowColor = 'transparent'; g.clip();
    if (im) sigdir(g, im, -cw / 2 + 40, -ch / 2 + 40, cw - 80, ch - 80);
    else { g.fillStyle = '#888'; g.font = F(600, 34); g.textAlign = 'center'; g.fillText('Fotoğraf yüklenemedi', 0, 0); g.textAlign = 'left'; }
    g.restore();
    // sarı çıkartma: fiyat ya da (fiyatsızda) STOKTA
    const f = fiyatAl(p), etiket = f ? fmt(f) : P.qty(p) > 0 ? 'STOKTA' : '';
    if (etiket) {
      const r = 132, sx = W - m - r + 24, sy = cy + 96;
      g.save(); g.translate(sx, sy); g.rotate(-0.16);
      g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 30; g.shadowOffsetY = 10;
      // tırtıklı yıldız kenar
      g.beginPath(); for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2, rr = k % 2 ? r : r * 1.08; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath();
      g.fillStyle = '#ffe14d'; g.fill(); g.shadowColor = 'transparent';
      g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (f) {
        g.font = F(700, 24); g.fillText(D.fiyat === 'site' ? 'SADECE' : 'FİYAT', 0, -44);
        let z = 62; g.font = F(700, z); while (g.measureText(etiket).width > r * 1.6 && z > 30) { z -= 2; g.font = F(700, z); }
        g.fillText(etiket, 0, 8);
      } else { g.font = F(700, 40); g.fillText(etiket, 0, 0); }
      g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.restore();
    }
    // ad
    let y = cy + ch + 96; g.textAlign = 'center';
    g.save(); g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 16; g.shadowOffsetY = 4;
    g.font = F(700, 54); g.fillStyle = '#fff';
    for (const l of satirlar(g, p.name, W - 2 * m - 20, 2)) { g.fillText(l, W / 2, y); y += 62; }
    g.restore();
    // renkler ve kod: yarı saydam beyaz hap içinde
    const kod = D.kod ? kodAl(p) : '', rl = D.renk ? renkler(p) : [], noktali = rl.filter(renkKod).slice(0, 8);
    const yazi = [rl.length > 1 ? `${rl.length} renk` : rl.length ? guzelAd(rl[0]) : '', kod ? 'Kod: ' + kod : '', bilgi(p).olcu && D.olcu ? bilgi(p).olcu : ''].filter(Boolean).join('  ·  ');
    if (yazi || noktali.length) {
      g.font = F(600, 28); const nr = 15, ng = 10, nw = noktali.length ? noktali.length * 2 * nr + (noktali.length - 1) * ng + 18 : 0, tw = g.measureText(yazi).width, bw = nw + tw + 56, bh = 62, bx = (W - bw) / 2, by = y - 30;
      yuvarlak(g, bx, by, bw, bh, bh / 2); g.fillStyle = 'rgba(255,255,255,.24)'; g.fill();
      let x = bx + 28 + nr;
      for (const k of noktali) { g.beginPath(); g.arc(x, by + bh / 2, nr, 0, 7); g.fillStyle = renkKod(k); g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); x += 2 * nr + ng; }
      g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(yazi, bx + 28 + nw, by + bh / 2 + 1); g.textBaseline = 'alphabetic';
    }
    // WhatsApp düğmesi: beyaz hap, yeşil daire
    const t = `Sipariş için yazın  ${TEL}`; g.font = F(700, 33); g.textAlign = 'left';
    const tw = g.measureText(t).width, bh = 92, ic = 64, bw = tw + ic + 74, bx = (W - bw) / 2, by = H - 262 - bh;
    g.save(); g.shadowColor = 'rgba(0,0,0,.28)'; g.shadowBlur = 26; g.shadowOffsetY = 8; yuvarlak(g, bx, by, bw, bh, bh / 2); g.fillStyle = '#fff'; g.fill(); g.restore();
    g.beginPath(); g.arc(bx + 14 + ic / 2, by + bh / 2, ic / 2, 0, 7); g.fillStyle = '#25d366'; g.fill();
    // basit telefon simgesi
    g.save(); g.translate(bx + 14 + ic / 2, by + bh / 2); g.rotate(-0.6); g.fillStyle = '#fff'; yuvarlak(g, -8, -16, 16, 32, 6); g.fill(); g.restore();
    g.fillStyle = '#111'; g.textBaseline = 'middle'; g.fillText(t, bx + 14 + ic + 22, by + bh / 2 + 1); g.textBaseline = 'alphabetic';
    g.font = F(700, 25); g.fillStyle = 'rgba(255,255,255,.9)'; g.textAlign = 'center'; g.letterSpacing = '2px'; g.fillText(SITE, W / 2, by + bh + 44); g.letterSpacing = '0px'; g.textAlign = 'left';
  }

  /* Kurumsal durum (celik 01.11: "renk daha kurumsal, metaya uygun"): Meta reklam düzeni; açık stüdyo zemininde büyük ürün (beyaz fon çarpma ile zemine karışır),
     üstte ad, altta koyu bilgi bandı: fiyat, renkler, tek altın "Sipariş ver" düğmesi. Az yazı, marka renkleri (kömür, altın, beyaz). */
  function durumKurumsal(g, W, H, p, im) {
    const zg = g.createLinearGradient(0, 360, 0, 1360); zg.addColorStop(0, '#ffffff'); zg.addColorStop(1, '#ece7df');
    g.fillStyle = zg; g.fillRect(0, 0, W, H);
    const m = 72;
    // üst marka bandı (alttaki bantla aynı kömür renk): ortada altın logo, CLK ÇANTA, ince altın çizgi
    const ubh = 372;
    g.fillStyle = RENK.INK; yuvarlak(g, 0, -60, W, ubh + 60, 56); g.fill();
    if (logoAltin) { const lh = 64, lw = logoAltin.width / logoAltin.height * lh; g.drawImage(logoAltin, (W - lw) / 2, 214, lw, lh); }
    g.textAlign = 'center'; g.font = F(700, 20); g.fillStyle = RENK.GOLD2; g.letterSpacing = '10px'; g.fillText('CLK ÇANTA', W / 2 + 5, 318); g.letterSpacing = '0px';
    g.fillStyle = 'rgba(214,189,143,.45)'; g.fillRect(W / 2 - 230, 296, 130, 1.5); g.fillRect(W / 2 + 100, 296, 130, 1.5);
    // kategori (küçük, altın) ve ürün adı ortalı
    let y = ubh + 82;
    const kat = P.cat(p);
    if (kat && kat !== 'Kategorisiz') { g.font = F(700, 20); g.fillStyle = '#8a6a33'; g.letterSpacing = '5px'; g.fillText(satirlar(g, buyuk(kat), W - 2 * m, 1)[0], W / 2, y); g.letterSpacing = '0px'; y += 62; }
    else y += 20;
    g.font = F(700, 50); g.fillStyle = RENK.INK;
    for (const l of satirlar(g, p.name, W - 2 * m, 2)) { g.fillText(l, W / 2, y); y += 60; }
    g.fillStyle = RENK.GOLD; g.fillRect(W / 2 - 45, y - 26, 90, 4);
    g.textAlign = 'left';
    // ürün: fotoğraf çarpma ile çizilir, beyaz fonu açık zemine karışır
    const b = D.olcu ? bilgi(p) : {}, kodK = D.kod ? kodAl(p) : '';
    const ozellik = [['ÖLÇÜ', b.olcu], ['MALZEME', b.malzeme], ['KOD', kodK], ['', b.su]].filter(([, v]) => v).slice(0, 3);
    const ay = y + 10, ah = (ozellik.length ? 1222 : 1330) - ay;
    // vitrin fotoğraflarının kendi gölgesi var; ayrıca zemin gölgesi çizilmez
    if (im) { g.save(); g.globalCompositeOperation = 'multiply'; sigdir(g, im, m, ay, W - 2 * m, ah - 20); g.restore(); }
    else { g.fillStyle = RENK.MUTED; g.font = F(600, 34); g.textAlign = 'center'; g.fillText('Fotoğraf yüklenemedi', W / 2, ay + ah / 2); g.textAlign = 'left'; }
    // özellik şeridi: ölçü, malzeme, kod (beyaz kutu, ince ayraçlar)
    if (ozellik.length) {
      const sx = m, sw = W - 2 * m, sh = 104, sy = 1228, cw = sw / ozellik.length;
      g.save(); g.shadowColor = 'rgba(18,17,16,.10)'; g.shadowBlur = 24; g.shadowOffsetY = 6; yuvarlak(g, sx, sy, sw, sh, 20); g.fillStyle = '#fff'; g.fill(); g.restore();
      g.textAlign = 'center';
      ozellik.forEach(([l, v], i) => {
        const cx = sx + cw * i + cw / 2;
        if (i) { g.fillStyle = RENK.LINE; g.fillRect(sx + cw * i, sy + 22, 2, sh - 44); }
        if (l) { g.font = F(700, 17); g.fillStyle = '#8a6a33'; g.letterSpacing = '3px'; g.fillText(l, cx, sy + 40); g.letterSpacing = '0px'; }
        g.font = F(700, 27); g.fillStyle = RENK.INK; g.fillText(satirlar(g, v, cw - 28, 1)[0], cx, l ? sy + 78 : sy + sh / 2 + 10);
      });
      g.textAlign = 'left';
    }
    // alt bilgi bandı
    const by = 1360;
    g.fillStyle = RENK.INK; yuvarlak(g, 0, by, W, H - by + 60, 56); g.fill();
    const f = fiyatAl(p);
    g.font = F(600, 22); g.fillStyle = RENK.GOLD2; g.letterSpacing = '4px';
    g.fillText(f ? (D.fiyat === 'site' ? 'FİYAT' : 'BAYİ FİYATI') : 'FİYAT BİLGİSİ', m, by + 74); g.letterSpacing = '0px';
    if (f) { g.font = F(700, 76); g.fillStyle = '#fff'; g.fillText(fmt(f), m, by + 160); }
    else { g.font = F(700, 44); g.fillStyle = '#fff'; g.fillText('Mesaj atın, hemen iletelim', m, by + 148); }
    // sağda renkler ve kod
    const rl = D.renk ? renkler(p) : [], noktali = rl.filter(renkKod).slice(0, 6), kod = D.kod ? kodAl(p) : '';
    g.textAlign = 'right';
    if (rl.length) {
      g.font = F(600, 22); g.fillStyle = RENK.GOLD2; g.letterSpacing = '4px'; g.fillText(rl.length > 1 ? `${rl.length} RENK` : 'RENK', W - m, by + 74); g.letterSpacing = '0px';
      if (noktali.length) { const r = 17; let x = W - m - r; for (const k of noktali.slice().reverse()) { g.beginPath(); g.arc(x, by + 132, r, 0, 7); g.fillStyle = renkKod(k); g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.8)'; g.stroke(); x -= 2 * r + 12; } }
      else { g.font = F(600, 30); g.fillStyle = '#fff'; g.fillText(satirlar(g, rl.map(guzelAd).join(', '), 380, 1)[0], W - m, by + 144); }
    }
    // renk adları noktaların altında; kod özellik şeridinde değilse burada
    if (rl.length && noktali.length) { g.font = F(500, 23); g.fillStyle = '#cfc8bc'; g.fillText(satirlar(g, rl.map(guzelAd).join(', '), 460, 1)[0], W - m, by + 186); }
    else if (kod && !ozellik.some(([l]) => l === 'KOD')) { g.font = F(500, 24); g.fillStyle = '#a39c91'; g.fillText('Kod: ' + kod, W - m, by + 188); }
    g.textAlign = 'left';
    // tek eylem düğmesi (Meta'daki "Mesaj gönder" gibi)
    const bx = m, bw = W - 2 * m, bh = 96, byy = by + 222;
    yuvarlak(g, bx, byy, bw, bh, 18); const gg = g.createLinearGradient(bx, byy, bx + bw, byy); gg.addColorStop(0, RENK.GOLD); gg.addColorStop(1, '#c9a76b'); g.fillStyle = gg; g.fill();
    g.fillStyle = '#1b150b'; g.font = F(700, 34); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`Sipariş ver  ·  ${TEL}`, W / 2, byy + bh / 2 + 1);
    g.textBaseline = 'alphabetic'; g.font = F(600, 23); g.fillStyle = '#a39c91'; g.letterSpacing = '3px'; g.fillText(buyuk(SITE), W / 2, byy + bh + 52); g.letterSpacing = '0px'; g.textAlign = 'left';
  }

  function durumResmi(g, W, H, p, im, i) {
    if (String(D.tema).startsWith('l-')) { T = KTEMA[D.tema.slice(2)] || KTEMA.fildisi; return durumLuks(g, W, H, p, im); }
    if (D.tema === 'renkli') return durumRenkli(g, W, H, p, im, i);
    if (D.tema !== 'koyu') return durumKurumsal(g, W, H, p, im);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2c2824'); gr.addColorStop(0.55, RENK.INK); gr.addColorStop(1, '#0b0a09');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(214,189,143,.18)'; g.lineWidth = 2;
    for (const r of [420, 290]) { g.beginPath(); g.arc(W + 40, 300, r, 0, 7); g.stroke(); }
    const m = 64, ust = 236;
    if (logoAltin) { const lh = 62, lw = logoAltin.width / logoAltin.height * lh; g.drawImage(logoAltin, m, ust - lh + 8, lw, lh); g.font = F(700, 22); g.fillStyle = RENK.GOLD2; g.letterSpacing = '6px'; g.fillText('ÇANTA', m + lw + 16, ust); g.letterSpacing = '0px'; }
    const kat = P.cat(p); if (kat && kat !== 'Kategorisiz') { g.font = F(700, 21); g.fillStyle = RENK.GOLD2; g.textAlign = 'right'; g.letterSpacing = '4px'; g.fillText(satirlar(g, buyuk(kat), 520, 1)[0], W - m, ust); g.letterSpacing = '0px'; g.textAlign = 'left'; }
    // ürün: beyaz kart, fotoğraf sığdırılır
    const cx = m, cy = 300, cw = W - 2 * m, ch = 930;
    g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 50; g.shadowOffsetY = 18; yuvarlak(g, cx, cy, cw, ch, 40); g.fillStyle = '#fff'; g.fill(); g.restore();
    g.save(); yuvarlak(g, cx, cy, cw, ch, 40); g.clip();
    if (im) sigdir(g, im, cx + 40, cy + 40, cw - 80, ch - 110);
    else { g.fillStyle = RENK.MUTED; g.font = F(600, 34); g.textAlign = 'center'; g.fillText('Fotoğraf yüklenemedi', W / 2, cy + ch / 2); g.textAlign = 'left'; }
    g.restore();
    // fiyat: kartın alt kenarına oturan büyük altın etiket
    let y = cy + ch + 40;
    const f = fiyatAl(p);
    if (f) {
      const t = fmt(f); g.font = F(700, 66); const tw = g.measureText(t).width, bw = tw + 90, bh = 116, bx = (W - bw) / 2, by = cy + ch - bh / 2;
      g.save(); g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 30; g.shadowOffsetY = 10; yuvarlak(g, bx, by, bw, bh, bh / 2);
      const gg = g.createLinearGradient(bx, by, bx + bw, by + bh); gg.addColorStop(0, RENK.GOLD); gg.addColorStop(1, '#d9b97c'); g.fillStyle = gg; g.fill(); g.restore();
      g.fillStyle = '#1b150b'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(t, W / 2, by + bh / 2 + 2); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      y = by + bh + 30;
    }
    // ad, kod, renkler (ortalı)
    g.textAlign = 'center';
    g.font = F(700, 46); g.fillStyle = '#fff'; y += 40;
    for (const l of satirlar(g, p.name, W - 2 * m - 20, 2)) { g.fillText(l, W / 2, y); y += 56; }
    const kod = D.kod ? kodAl(p) : '';
    const rl = D.renk ? renkler(p) : [], noktali = rl.filter(renkKod).slice(0, 10);
    const alt = [kod ? 'Kod: ' + kod : '', rl.length ? rl.map(guzelAd).join(', ') : '', bilgiYazi(p)].filter(Boolean).join('   ·   ');
    if (noktali.length) {
      const r = 15, gap = 12, tw = noktali.length * (2 * r) + (noktali.length - 1) * gap; let x = (W - tw) / 2 + r; y += 10;
      for (const k of noktali) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = renkKod(k); g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.75)'; g.stroke(); x += 2 * r + gap; }
      y += 52;
    }
    if (alt) { g.font = F(500, 28); g.fillStyle = '#cfc8bc'; g.fillText(alt, W / 2, y); }
    // çağrı: yanıt kutusunun hemen üstünde
    const t = `Sipariş için yazın  ·  ${TEL}`; g.font = F(700, 32);
    const tw = g.measureText(t).width, bh = 82, bw = tw + 80, by = H - 268 - bh, bx = (W - bw) / 2;
    yuvarlak(g, bx, by, bw, bh, bh / 2); g.lineWidth = 3; g.strokeStyle = RENK.GOLD2; g.stroke();
    g.fillStyle = RENK.GOLD2; g.textBaseline = 'middle'; g.fillText(t, W / 2, by + bh / 2 + 1); g.textBaseline = 'alphabetic';
    g.font = F(600, 24); g.fillStyle = '#9a9286'; g.fillText(SITE, W / 2, by + bh + 42);
    g.textAlign = 'left';
  }

  function kapak(g, W, H, imgs, adet) {
    const gr = g.createRadialGradient(W * 0.2, H * 0.1, 0, W * 0.2, H * 0.1, H * 1.1); gr.addColorStop(0, '#2c2824'); gr.addColorStop(0.6, RENK.INK); gr.addColorStop(1, '#0b0a09');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // köşede ince altın halkalar (panelin giriş ekranıyla aynı dil)
    g.strokeStyle = 'rgba(214,189,143,.22)'; g.lineWidth = 2;
    for (const r of [W * 0.42, W * 0.28]) { g.beginPath(); g.arc(W * 1.02, H * 1.0, r, 0, 7); g.stroke(); }
    const m = W * 0.08;
    if (logoAltin) { const lh = H * 0.07, lw = logoAltin.width / logoAltin.height * lh; g.drawImage(logoAltin, m, H * 0.07, lw, lh); }
    g.font = F(700, W * 0.017); g.fillStyle = RENK.GOLD2; g.letterSpacing = '8px'; g.fillText('CLK ÇANTA', m, H * 0.07 + H * 0.07 + H * 0.035); g.letterSpacing = '0px';
    let y = H * 0.27; const bz = W * 0.085;
    g.font = F(600, bz, 'P'); g.fillStyle = '#fff';
    for (const l of satirlar(g, D.baslik.trim() || 'Ürün Kataloğu', W - 2 * m, 2)) { g.fillText(l, m, y); y += bz * 1.1; }
    g.font = F(500, W * 0.022); g.fillStyle = RENK.GOLD2;
    g.fillText(satirlar(g, D.alt.trim() || `${guzelAd(ayYil())} · ${num(adet)} ürün`, W - 2 * m, 1)[0], m, y + W * 0.005);
    // ürünlerden kolaj: beyaz kutularda en çok 4 fotoğraf
    const l = imgs.filter(Boolean).slice(0, 4), kx = m, ky = y + H * 0.05, kw = W - 2 * m, kh = H * 0.86 - ky - H * 0.02;
    if (l.length) {
      const sut = l.length === 1 ? 1 : 2, sat = l.length <= 2 ? 1 : 2, gap = W * 0.025;
      const cw = (kw - gap * (sut - 1)) / sut, chh = (kh - gap * (sat - 1)) / sat;
      l.forEach((im, i) => {
        const x = kx + (i % sut) * (cw + gap), yy = ky + Math.floor(i / sut) * (chh + gap);
        g.save(); yuvarlak(g, x, yy, cw, chh, W * 0.02); g.fillStyle = '#fff'; g.fill(); g.clip(); sigdir(g, im, x + cw * 0.06, yy + chh * 0.06, cw * 0.88, chh * 0.88); g.restore();
      });
    }
    // alt: altın düğme görünümlü çağrı
    const t = `WhatsApp ile sipariş  ${TEL}`; g.font = F(700, W * 0.024);
    const tw = g.measureText(t).width, bh = W * 0.07, by = H * 0.885;
    yuvarlak(g, m, by, tw + W * 0.08, bh, bh / 2); const gg = g.createLinearGradient(m, by, m + tw, by + bh); gg.addColorStop(0, RENK.GOLD); gg.addColorStop(1, '#c9a76b'); g.fillStyle = gg; g.fill();
    g.fillStyle = '#1b150b'; g.textBaseline = 'middle'; g.fillText(t, m + W * 0.04, by + bh / 2 + 1);
    g.font = F(600, W * 0.02); g.fillStyle = '#cfc8bc'; g.textAlign = 'right'; g.fillText(SITE, W - m, by + bh / 2); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  }

  /* Lüks tema (celik 06.11: "katalog sistemine bi el at", "temasını değiştirelim"): Instagram'daki lüks dil (celik 01.11 "tasarımı biraz daha lüks yap",
     beğendi) PDF'e taşındı. Fildişi / Siyah ve altın / Mocha zemin, ince altın çift çerçeve, ürün kemer (arch) içinde: beyaz fonlu fotoğraf çarpma ile
     kemerin tonuna karışır, pikseller değişmez. Adlar Cormorant Garamond, bilgiler harf aralıklı küçük büyük harf, fiyat Playfair (büyük düzende
     altın varak mühürde). Eski düzen "Klasik" seçeneği. PDF'te ürüne dokununca WhatsApp'ta o ürünün adıyla mesaj açılır (jsPDF bağlantısı). */
  const KTEMA = {
    fildisi: { ad: 'Lüks · Fildişi', zemin: ['#faf6ef', '#eee6d8'], isik: [255, 255, 255, 0.85], kemer: ['#efe6d9', '#e2d6c5'], yazi: '#1f1a15', soluk: '#7d7265', altin: '#9a7741', cizgi: 'rgba(154,119,65,.45)', koyu: false },
    koyu: { ad: 'Lüks · Siyah ve altın', zemin: ['#1d1a17', '#0b0a09'], isik: [92, 78, 58, 0.45], kemer: ['#f1eadf', '#e3d9c9'], yazi: '#f6f0e5', soluk: '#a99f90', altin: '#d8bf90', cizgi: 'rgba(216,191,144,.42)', koyu: true },
    mocha: { ad: 'Lüks · Mocha', zemin: ['#4b3629', '#271c15'], isik: [120, 88, 62, 0.5], kemer: ['#f3ebdf', '#e5d9c7'], yazi: '#f5ecdf', soluk: '#cbb9a2', altin: '#dcc08b', cizgi: 'rgba(220,192,139,.5)', koyu: true }
  };
  const PTEMA = [...Object.entries(KTEMA).map(([k, v]) => [k, v.ad]), ['klasik', 'Klasik (beyaz kartlar)']];
  let T = KTEMA.fildisi;
  const SERIF = '"Cormorant Garamond", "Playfair Display", Georgia, serif';
  const FS = (b, z, it) => `${it ? 'italic ' : ''}${b} ${Math.round(z)}px ${SERIF}`;
  // ürün adı, fiyat ve telefon Bodoni Moda ile: Cormorant ve Playfair'in rakamları eski usul (07 → "o7", 0534'te 3, 4, 7 aşağı sarkıyor), model kodu okunmuyordu;
  // tuvalde yazı özelliği (lnum) açılamıyor. Küçük boy (opsz 11) çizgileri kalın: değişken sürümde ince çizgiler kayboluyordu (1.249 → "1.2 19").
  // Yazı tipi katalog hazırlanırken yüklenir (index.html'de yok).
  const FP = (b, z) => `${b} ${Math.round(z)}px "Bodoni Moda", "Playfair Display", Georgia, serif`;
  let bodoni = null;
  const bodoniYukle = () => bodoni ||= new Promise(ok => {
    const l = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@11,500;11,600&display=swap' });
    l.onload = () => Promise.all(['500 40px "Bodoni Moda"', '600 40px "Bodoni Moda"'].map(f => document.fonts.load(f).catch(() => null))).then(ok, ok);
    l.onerror = () => { bodoni = null; ok(); };
    document.head.append(l);
  });
  // ürün adı: baş harfler büyük; rakamlı, kısa ünsüzsüz (BYB, PP) ve bilinen kısaltmalar (USB, ABS) olduğu gibi
  const adYaz = s => buyuk(s).split(/(\s+|[/()-])/).map(w => /\d/.test(w) || /^(USB|ABS|PVC|PU|EVA|TPU|LED|RFID|XS|XL|XXL|CLK)$/.test(w) || (w.length <= 4 && /^\p{L}+$/u.test(w) && !/[AEIİOÖUÜ]/.test(w)) ? w : w.toLocaleLowerCase('tr').replace(/^\p{L}/u, c => c.toLocaleUpperCase('tr'))).join('');
  const bayiMi = () => /^b\d$/.test(D.fiyat);
  const fiyatEtiket = () => D.fiyat === 'yok' ? '' : bayiMi() ? 'Bayi fiyatları' : 'Fiyatlı katalog';
  const WA_NO = '90' + TEL.replace(/\D/g, '').replace(/^0/, '');
  const waUrl = p => `https://wa.me/${WA_NO}` + (p ? '?text=' + encodeURIComponent(`Merhaba, katalogdaki ${p.name}${kodAl(p) ? ` (kod ${kodAl(p)})` : ''} için bilgi almak istiyorum.`) : '');
  const SITE_URL = 'https://www.' + SITE;
  const iki = n => String(n).padStart(2, '0');

  function varak(g, x0, x1, koyu = T.koyu) {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    (koyu ? [[0, '#b08b52'], [0.3, '#f0dcaf'], [0.5, '#c9a76c'], [0.75, '#ead3a2'], [1, '#a5814a']] : [[0, '#7f6232'], [0.35, '#b8955a'], [0.6, '#8d6d39'], [1, '#a98549']]).forEach(([o, c]) => gr.addColorStop(o, c));
    return gr;
  }
  // harf aralıklı büyük harf yazı; sığmazsa küçülür; genişliği döner
  function aralikli(g, t, x, y, z, ara, renk, hiza = 'center', b = 600, maxW = 0) {
    t = buyuk(t); g.font = F(b, z); g.letterSpacing = ara + 'px';
    while (maxW && z > 9 && g.measureText(t).width > maxW) { z -= 0.5; ara = Math.max(1, ara * 0.95); g.letterSpacing = ara + 'px'; g.font = F(b, z); }
    g.fillStyle = renk; g.textAlign = hiza; g.fillText(t, x + (hiza === 'center' ? ara / 2 : hiza === 'right' ? ara : 0), y);
    const w = g.measureText(t).width; g.letterSpacing = '0px'; g.textAlign = 'left'; return w;
  }
  // yazı sığana kadar küçülür (en az yarısı)
  function sigYaz(g, t, x, y, maxW, z, yaz) {
    let s = z; g.font = yaz(s);
    while (s > z / 2 && g.measureText(t).width > maxW) { s -= 1; g.font = yaz(s); }
    g.fillText(t, x, y); return g.measureText(t).width;
  }
  // zemin: tonlu geçiş, üstte yumuşak ışık, ince altın çift çerçeve (kâğıt dokusu yok: PDF büyümesin)
  function zeminLux(g, W, H) {
    const s = W / 1240, l = g.createLinearGradient(0, 0, 0, H); l.addColorStop(0, T.zemin[0]); l.addColorStop(1, T.zemin[1]); g.fillStyle = l; g.fillRect(0, 0, W, H);
    const [ir, ig, ib, ia] = T.isik, r = g.createRadialGradient(W / 2, H * 0.3, 40 * s, W / 2, H * 0.32, W * 0.8);
    r.addColorStop(0, `rgba(${ir},${ig},${ib},${ia})`); r.addColorStop(1, `rgba(${ir},${ig},${ib},0)`); g.fillStyle = r; g.fillRect(0, 0, W, H);
    g.strokeStyle = T.cizgi; g.lineWidth = 1.6 * s; g.strokeRect(34 * s, 34 * s, W - 68 * s, H - 68 * s);
    g.globalAlpha = 0.55; g.lineWidth = s; g.strokeRect(44 * s, 44 * s, W - 88 * s, H - 88 * s); g.globalAlpha = 1;
  }
  // —— ◆ —— ayraç
  function elmas(g, cx, y, w, k) {
    const d = 5 * k; g.fillStyle = T.cizgi; g.fillRect(cx - w / 2, y - 0.6 * k, w / 2 - d * 2.4, 1.2 * k); g.fillRect(cx + d * 2.4, y - 0.6 * k, w / 2 - d * 2.4, 1.2 * k);
    g.save(); g.translate(cx, y); g.rotate(Math.PI / 4); g.fillStyle = T.altin; g.fillRect(-d, -d, 2 * d, 2 * d); g.restore();
  }
  const kemerYol = (g, x, y, w, h) => { const r = Math.min(w / 2, h); g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + r); g.arc(x + w / 2, y + r, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath(); };
  // fotoğrafın kenarları beyaz mı (vitrin fotoğrafı)
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
  // ürünün kutusu: fondan ayrılan piksellerin sınırı + pay (kenarlar kadrajdan çıkar, pikseller değişmez). Fon kenar piksellerinin
  // ortancasıdır. Ek bilgi (yumusakCiz): her yandaki boşluk ve fon tam beyaz değilse (stüdyo grisi) fon rengi.
  const icBellek = new WeakMap();
  function icerik(im) {
    if (icBellek.has(im)) return icBellek.get(im);
    let kutu = [0, 0, im.width, im.height, null];
    try {
      const n = 160, k = Math.min(1, n / Math.max(im.width, im.height)), cw = Math.max(1, Math.round(im.width * k)), ch = Math.max(1, Math.round(im.height * k));
      const c = document.createElement('canvas'); c.width = cw; c.height = ch; const x = c.getContext('2d'); x.drawImage(im, 0, 0, cw, ch);
      const d = x.getImageData(0, 0, cw, ch).data, kn = [[], [], []];
      for (let xx = 0; xx < cw; xx++) for (const yy of [0, ch - 1]) { const i = (yy * cw + xx) * 4; for (let j = 0; j < 3; j++) kn[j].push(d[i + j]); }
      for (let yy = 0; yy < ch; yy++) for (const xx of [0, cw - 1]) { const i = (yy * cw + xx) * 4; for (let j = 0; j < 3; j++) kn[j].push(d[i + j]); }
      const fon = kn.map(a => a.sort((p, q) => p - q)[a.length >> 1]), gri = Math.min(...fon) < 247 && Math.min(...fon) > 200;
      const esik = fon.map(v => Math.min(239, v - 16));
      let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
      for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) { const i = (yy * cw + xx) * 4; if (d[i] < esik[0] || d[i + 1] < esik[1] || d[i + 2] < esik[2]) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; } }
      if (x1 > x0 && y1 > y0) {
        const pay = gri ? 0.08 : 0.04, px = (x1 - x0) * pay, py = (y1 - y0) * pay;
        const a0 = Math.max(0, (x0 - px) / k), b0 = Math.max(0, (y0 - py) / k), a1 = Math.min(im.width, (x1 + 1 + px) / k), b1 = Math.min(im.height, (y1 + 1 + py) / k);
        kutu = [a0, b0, a1 - a0, b1 - b0, { fon: gri ? fon : null, bos: [x0 / k - a0, y0 / k - b0, a1 - (x1 + 1) / k, b1 - (y1 + 1) / k] }];
      } else if (gri) kutu[4] = { fon, bos: [0, 0, 0, 0] };
    } catch {}
    icBellek.set(im, kutu); return kutu;
  }
  // Fotoğraf çarpmayla konunca tam beyaz olmayan fon zeminde kutu gibi görünüyordu (vitrin fotoğrafında ürünün çevresinde 250–252'lik
  // dikdörtgen pus, stüdyo grisi): fon griyse fon rengi beyaza çekilir (her kanal fon → 255, en çok %8 açma; vitrindeki ışık açma sınırı),
  // çok açık renksiz pikseller (en küçük kanal ≥240, kanal farkı ≤12) yumuşak geçişle beyaza gider, ürünle kesim kenarı arasındaki
  // boşluk beyaza yumuşar. Ürünün kendi pikselleri (koyu ve renkli) değişmez. Tek geçici tuval kullanılır (iPhone'da tuval belleği sınırlı).
  let yc = null;
  function yumusakCiz(g, im, kutu, dx, dy, iw, ih) {
    const [sx, sy, sw, sh, ek] = kutu;
    if (!ek) return g.drawImage(im, sx, sy, sw, sh, dx, dy, iw, ih);
    const k = Math.abs(g.getTransform?.().a || 1), cw = Math.max(1, Math.round(iw * k)), ch = Math.max(1, Math.round(ih * k));
    const c = yc ||= document.createElement('canvas'); c.width = cw; c.height = ch;
    const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(im, sx, sy, sw, sh, 0, 0, cw, ch);
    try {
      const v = x.getImageData(0, 0, cw, ch), a = v.data, [f0, f1, f2] = (ek.fon || [255, 255, 255]).map(f => Math.min(1.08, 255 / Math.max(1, f)));
      for (let i = 0; i < a.length; i += 4) {
        let r = a[i] * f0, gg = a[i + 1] * f1, b = a[i + 2] * f2;
        const mn = Math.min(r, gg, b);
        if (mn >= 240 && Math.max(r, gg, b) - mn <= 12) { const t = Math.min(1, (mn - 240) / 9); r += (255 - r) * t; gg += (255 - gg) * t; b += (255 - b) * t; }
        a[i] = r; a[i + 1] = gg; a[i + 2] = b;
      }
      x.putImageData(v, 0, 0);
    } catch {}
    const o = cw / sw, [bl, bt, br, bb] = ek.bos.map((b, i) => Math.min(b * o, (i % 2 ? ch : cw) * 0.12));
    for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, bl, 0, 0, 0, bl, ch], [cw, 0, cw - br, 0, cw - br, 0, br, ch], [0, 0, 0, bt, 0, 0, cw, bt], [0, ch, 0, ch - bb, 0, ch - bb, cw, bb]]) {
      if (rw < 1 || rh < 1) continue;
      const gr = x.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(rx, ry, rw, rh);
    }
    g.drawImage(c, dx, dy, iw, ih);
  }
  // kemer içinde ürün: beyaz fonlu fotoğraf kemerin tabanına oturur (çarpma), değilse kemeri doldurur
  function kemerFoto(g, im, x, y, w, h, cerceve, k) {
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, T.kemer[0]); gr.addColorStop(1, T.kemer[1]);
    if (cerceve) { const o = 12 * k; g.save(); g.strokeStyle = T.cizgi; g.lineWidth = 1.3 * k; kemerYol(g, x - o, y - o, w + 2 * o, h + o); g.stroke(); g.restore(); }
    g.save(); g.shadowColor = T.koyu ? 'rgba(0,0,0,.42)' : 'rgba(80,60,30,.10)'; g.shadowBlur = (T.koyu ? 40 : 26) * k; g.shadowOffsetY = 10 * k; kemerYol(g, x, y, w, h); g.fillStyle = gr; g.fill(); g.restore();
    g.save(); kemerYol(g, x, y, w, h); g.clip();
    if (!im) { g.fillStyle = '#8b8174'; g.font = F(600, Math.max(11, 18 * k)); g.textAlign = 'center'; g.fillText('Fotoğraf yüklenemedi', x + w / 2, y + h * 0.6); g.textAlign = 'left'; }
    else if (beyazFon(im)) {
      const kt = icerik(im), [, , sw, sh] = kt, kw = w * 0.8, kx = x + (w - kw) / 2, ky = y + Math.min(w, h) * 0.2, kh = h - Math.min(w, h) * 0.2 - h * 0.07;
      const s = Math.min(kw / sw, kh / sh, 3), iw = sw * s, ih = sh * s;
      g.globalCompositeOperation = 'multiply'; yumusakCiz(g, im, kt, kx + (kw - iw) / 2, ky + kh - ih, iw, ih);
    } else { const s = Math.max(w / im.width, h / im.height), iw = im.width * s, ih = im.height * s; g.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); }
    g.restore();
  }
  // altın varak mühür: fiyat
  function muhur(g, cx, cy, r, f) {
    g.save(); g.shadowColor = 'rgba(40,25,5,.32)'; g.shadowBlur = r * 0.3; g.shadowOffsetY = r * 0.1;
    g.beginPath(); g.arc(cx, cy, r, 0, 7); const gr = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    [[0, '#a8834b'], [0.32, '#efd9a9'], [0.55, '#c7a368'], [0.8, '#e6cd99'], [1, '#9c7840']].forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fill(); g.restore();
    g.strokeStyle = 'rgba(60,40,10,.35)'; g.lineWidth = Math.max(1, r * 0.012); g.beginPath(); g.arc(cx, cy, r * 0.9, 0, 7); g.stroke();
    aralikli(g, bayiMi() ? 'BAYİ FİYATI' : 'FİYAT', cx, cy - r * 0.3, Math.max(9, r * 0.14), Math.max(1.5, r * 0.035), 'rgba(43,31,14,.75)', 'center', 700, r * 1.4);
    g.fillStyle = '#2b1f0e'; g.textAlign = 'center'; sigYaz(g, fmt(f), cx, cy + r * 0.2, r * 1.5, r * 0.4, z => FP(700, z)); g.textAlign = 'left';
    g.fillStyle = 'rgba(43,31,14,.45)'; g.fillRect(cx - r * 0.18, cy + r * 0.42, r * 0.36, Math.max(1, r * 0.012));
  }
  // renk noktaları ve adları (sığmazsa "N renk")
  function renkSatiri(g, rl, x, y, maxW, r, z, hiza = 'center') {
    if (!rl.length) return;
    const nok = rl.filter(renkKod).slice(0, 8), ara = z * 0.2, dw = nok.length ? nok.length * (2 * r + r * 0.7) + r * 0.6 : 0;
    g.font = F(600, z); g.letterSpacing = ara + 'px';
    const adlar = rl.join(' · '), yazi = dw + g.measureText(adlar).width <= maxW ? adlar : `${rl.length} RENK`, tw = Math.min(g.measureText(yazi).width, Math.max(0, maxW - dw));
    g.letterSpacing = '0px';
    let xx = hiza === 'center' ? x - (dw + tw) / 2 : x;
    for (const k of nok) { g.beginPath(); g.arc(xx + r, y - z * 0.36, r, 0, 7); g.fillStyle = renkKod(k); g.fill(); g.lineWidth = Math.max(1, r * 0.14); g.strokeStyle = T.koyu ? 'rgba(255,255,255,.7)' : 'rgba(31,26,21,.28)'; g.stroke(); xx += 2 * r + r * 0.7; }
    aralikli(g, yazi, xx + (nok.length ? r * 0.6 : 0), y, z, ara, T.soluk, 'left', 600, Math.max(20, maxW - dw));
  }
  // üst: solda logo, sağda katalog adı; ortada kategori (üst kategori aralıklı, kendisi italik)
  function ustLux(g, W, H, kat) {
    const s = W / 1240, m = 96 * s, lg = T.koyu ? logoAltin : logoKoyu;
    let lx = m;
    if (lg) { const lh = 34 * s, lw = lg.width / lg.height * lh; g.drawImage(lg, m, 84 * s, lw, lh); lx = m + lw + 14 * s; }
    aralikli(g, 'ÇANTA', lx, 113 * s, 12 * s, 6 * s, T.koyu ? T.altin : T.soluk, 'left', 600);
    const kk = String(kat || '').split(' › ').filter(Boolean);
    const sag = [kk.length ? D.baslik.trim() || 'Ürün Kataloğu' : guzelAd(ayYil()), fiyatEtiket()].filter(Boolean).join('  ·  ');
    aralikli(g, sag, W - m, 113 * s, 12 * s, 4 * s, T.soluk, 'right', 600, W * 0.46);
    if (kk.length > 1) aralikli(g, kk.slice(0, -1).join('  ·  '), W / 2, 184 * s, 14 * s, 6 * s, T.altin, 'center', 600, W - 2 * m);
    const bas = kk.length ? adYaz(kk.at(-1)) : D.baslik.trim() || 'Ürün Kataloğu';
    g.textAlign = 'center'; g.font = FS(500, 60 * s, true);
    let z = 60 * s; while (z > 30 * s && g.measureText(bas).width > W - 2 * m) { z -= 2 * s; g.font = FS(500, z, true); }
    const w = g.measureText(bas).width; g.fillStyle = T.koyu ? varak(g, W / 2 - w / 2, W / 2 + w / 2) : T.yazi; g.fillText(bas, W / 2, 244 * s); g.textAlign = 'left';
    elmas(g, W / 2, 278 * s, 280 * s, s);
  }
  const altPay = s => (D.not.trim() ? 168 : 136) * s;
  // alt: ince çizgi; solda WhatsApp, ortada site, sağda sayfa no (bağlantılı)
  function altLux(g, W, H, no, toplam, lk) {
    const s = W / 1240, m = 96 * s, y = H - 112 * s, by = y + 46 * s;
    if (D.not.trim()) { g.font = FS(500, 23 * s, true); g.fillStyle = T.soluk; g.textAlign = 'center'; g.fillText(satirlar(g, D.not.trim(), W - 2 * m, 1)[0], W / 2, y - 22 * s); g.textAlign = 'left'; }
    g.fillStyle = T.cizgi; g.fillRect(m, y, W - 2 * m, 1.2 * s);
    const w1 = aralikli(g, `WhatsApp  ${TEL}`, m, by, 13 * s, 3.5 * s, T.yazi, 'left', 600);
    lk.push({ x: m - 8 * s, y: by - 30 * s, w: w1 + 16 * s, h: 44 * s, url: waUrl() });
    g.font = FS(500, 27 * s, true); g.fillStyle = T.altin; g.textAlign = 'center'; g.fillText(SITE, W / 2, by + s); const w2 = g.measureText(SITE).width; g.textAlign = 'left';
    lk.push({ x: W / 2 - w2 / 2 - 8 * s, y: by - 30 * s, w: w2 + 16 * s, h: 44 * s, url: SITE_URL });
    aralikli(g, `${iki(no)}  /  ${iki(toplam)}`, W - m, by, 13 * s, 3.5 * s, T.soluk, 'right', 600);
  }
  // ürün bilgi satırı: kod · ölçü · malzeme · su geçirmez
  const bilgiSatiri = p => { const b = D.olcu ? bilgi(p) : {}; return [D.kod && kodAl(p), b.olcu, b.malzeme, b.su].filter(Boolean).join('  ·  '); };
  // yazı boyları (px, A4 1240 genişliğe göre); r: mühür yarıçapı (0 = fiyat adın altında yazıyla)
  const LX = { 1: { ad: 52, bi: 17, fy: 50, r: 118, rk: 14 }, 4: { ad: 33, bi: 13.5, fy: 34, r: 74, rk: 11 }, 6: { ad: 27, bi: 12, fy: 28, r: 0, rk: 10 }, 9: { ad: 23, bi: 11, fy: 24, r: 0, rk: 9 } };
  function luxSayfa(g, W, H, liste, imgs, kat, no, toplam, lk) {
    const s = W / 1240, n = +D.adet, m = 96 * s, ust = 318 * s, alt = H - altPay(s);
    zeminLux(g, W, H); ustLux(g, W, H, kat);
    if (n === 16) listeLux(g, W, H, liste, imgs, ust, alt, lk);
    else {
      const [sut, sat] = IZGARA[n], gx = (n === 4 ? 56 : 40) * s, gy = (n === 9 ? 24 : 34) * s, L = LX[n] || LX[4];
      const cw = (W - 2 * m - gx * (sut - 1)) / sut, ch = (alt - ust - gy * (sat - 1)) / sat;
      const fiyatli = D.fiyat !== 'yok', muhurlu = L.r > 0, cerceve = n <= 6, o = cerceve ? 12 * s : 0;
      const th = (L.ad * 2.15 + (D.kod || D.olcu ? L.bi * 2.4 : 0) + (D.renk ? L.rk * 2.9 : 0) + (fiyatli && !muhurlu ? L.fy * 1.3 : 0) + 14) * s;
      liste.forEach((p, i) => {
        const x = m + (i % sut) * (cw + gx), y = ust + Math.floor(i / sut) * (ch + gy), ah = ch - th - o;
        const aw = Math.min(cw * (n === 1 ? 0.8 : 0.84), ah * (n === 1 ? 0.84 : 0.92)), ax = x + (cw - aw) / 2, ay = y + o;
        kemerFoto(g, imgs[i], ax, ay, aw, ah, cerceve, s);
        const f = fiyatAl(p), cx = x + cw / 2;
        if (muhurlu && f) muhur(g, ax + aw - L.r * s * 0.3, ay + aw * 0.27, L.r * s, f);
        let ty = ay + ah + 8 * s, z = L.ad * s;
        g.textAlign = 'center'; g.fillStyle = T.yazi; g.font = FP(500, z);
        satirlar(g, adYaz(p.name), cw - 6 * s, 2).forEach((l, j) => { ty += j ? z * 1.02 : z * 0.98; g.fillText(l, cx, ty); });
        g.textAlign = 'left';
        const bi = bilgiSatiri(p);
        if (bi) { ty += L.bi * s * 2.3; aralikli(g, bi, cx, ty, L.bi * s, L.bi * s * 0.2, T.soluk, 'center', 600, cw - 8 * s); }
        const rl = D.renk ? renkler(p) : [];
        if (rl.length) { ty += L.rk * s * 2.7; renkSatiri(g, rl, cx, ty, cw - 8 * s, L.rk * s * 0.62, L.rk * s); }
        if (f && !muhurlu) { ty += L.fy * s * 1.28; g.textAlign = 'center'; g.font = FP(600, L.fy * s); const t = fmt(f), w = g.measureText(t).width; g.fillStyle = T.koyu ? varak(g, cx - w / 2, cx + w / 2) : T.yazi; g.fillText(t, cx, ty); g.textAlign = 'left'; }
        lk.push({ x, y, w: cw, h: ch, url: waUrl(p) });
      });
    }
    altLux(g, W, H, no, toplam, lk);
  }
  /* fiyat listesi (sayfada 16): iki sütun, satırda küçük kemer, ad, bilgi, renkler ve sağda fiyat; sütun sütun okunur */
  function listeLux(g, W, H, liste, imgs, ust, alt, lk) {
    const s = W / 1240, m = 96 * s, gx = 60 * s, cw = (W - 2 * m - gx) / 2, sat = 8, rh = (alt - ust) / sat;
    if (liste.length > sat) { g.fillStyle = T.cizgi; g.fillRect(W / 2 - 0.6 * s, ust + 10 * s, 1.2 * s, rh * Math.min(sat, liste.length - sat) - 20 * s); }
    liste.forEach((p, i) => {
      const x = m + Math.floor(i / sat) * (cw + gx), y = ust + (i % sat) * rh;
      if (i % sat) { g.globalAlpha = 0.6; g.fillStyle = T.cizgi; g.fillRect(x, y, cw, s); g.globalAlpha = 1; }
      const th = rh - 22 * s, tw = th * 0.8;
      kemerFoto(g, imgs[i], x, y + 11 * s, tw, th, false, s * 0.6);
      const tx = x + tw + 22 * s, wt = cw - tw - 22 * s, f = fiyatAl(p);
      g.fillStyle = T.yazi; g.font = FP(500, 23 * s);
      let yy = y + 40 * s;
      for (const l of satirlar(g, adYaz(p.name), wt, 2)) { g.fillText(l, tx, yy); yy += 27 * s; }
      const bi = bilgiSatiri(p);
      if (bi) aralikli(g, bi, tx, yy + 2 * s, 10.5 * s, 2 * s, T.soluk, 'left', 600, wt);
      const by = y + rh - 20 * s;
      let fw = 0;
      if (f) { g.font = FP(600, 27 * s); const t = fmt(f); fw = g.measureText(t).width; g.fillStyle = T.koyu ? varak(g, x + cw - fw, x + cw) : T.yazi; g.textAlign = 'right'; g.fillText(t, x + cw, by); g.textAlign = 'left'; }
      const rl = D.renk ? renkler(p) : [];
      if (rl.length) renkSatiri(g, rl, tx, by - 1 * s, wt - fw - 14 * s, 6.5 * s, 10 * s, 'left');
      lk.push({ x, y, w: cw, h: rh, url: waUrl(p) });
    });
  }
  // kapak için farklı kategorilerden ürünler
  function kapakSec(l, n) {
    const out = [], kat = new Set();
    for (const p of l) { if (out.length >= n) break; const k = P.cat(p); if (!kat.has(k)) { kat.add(k); out.push(p); } }
    for (const p of l) { if (out.length >= n) break; if (!out.includes(p)) out.push(p); }
    return out;
  }
  function luxKapak(g, W, H, imgs, l, lk) {
    const X = v => v * W / 1240, Y = v => v * H / 1754, k = Math.min(W / 1240, H / 1754);
    zeminLux(g, W, H);
    const lg = T.koyu ? logoAltin : logoKoyu;
    if (lg) { const lh = 66 * k, lw = lg.width / lg.height * lh; g.drawImage(lg, (W - lw) / 2, Y(120), lw, lh); }
    aralikli(g, 'ÇANTA', W / 2, Y(120) + 66 * k + 36 * k, 16 * k, 12 * k, T.koyu ? T.altin : T.soluk, 'center', 600);
    const bas = D.baslik.trim() || 'Ürün Kataloğu';
    g.textAlign = 'center'; let z = 126 * k; g.font = FS(500, z, true);
    while (z > 60 * k && g.measureText(bas).width > W - X(200)) { z -= 3 * k; g.font = FS(500, z, true); }
    const bw = g.measureText(bas).width; g.fillStyle = T.koyu ? varak(g, W / 2 - bw / 2, W / 2 + bw / 2) : T.yazi; g.fillText(bas, W / 2, Y(440)); g.textAlign = 'left';
    const altY = D.alt.trim() || [guzelAd(ayYil()), `${num(l.length)} ürün`, fiyatEtiket()].filter(Boolean).join('  ·  ');
    aralikli(g, altY, W / 2, Y(510), 19 * k, 6 * k, T.altin, 'center', 600, W - X(240));
    elmas(g, W / 2, Y(560), X(320), k);
    // üç kemer: ortadaki büyük, yanlar alçak; alt kenarlar aynı hizada
    const il = imgs.filter(Boolean).slice(0, 3), alt = Y(1270);
    const yer = il.length === 3 ? [[X(104), X(282), Y(480)], [X(422), X(396), Y(640)], [X(854), X(282), Y(480)]] : il.length === 2 ? [[X(170), X(420), Y(600)], [X(650), X(420), Y(600)]] : [[X(370), X(500), Y(660)]];
    const sira = il.length === 3 ? [il[1], il[0], il[2]] : il;
    yer.forEach(([x, w, h], i) => { if (sira[i]) kemerFoto(g, sira[i], x, alt - h, w, h, true, k); });
    // kategoriler
    const say = {}; for (const p of l) { const c = P.cat(p); if (c && c !== 'Kategorisiz') say[c] = (say[c] || 0) + 1; }
    let kats = Object.entries(say).sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 5);
    g.font = F(600, 15 * k); g.letterSpacing = 5 * k + 'px';
    while (kats.length > 1 && g.measureText(buyuk(kats.join('  ·  '))).width > W - X(240)) kats = kats.slice(0, -1);
    g.letterSpacing = '0px';
    if (kats.length) aralikli(g, kats.join('  ·  '), W / 2, Y(1352), 15 * k, 5 * k, T.soluk, 'center', 600, W - X(240));
    // çağrı
    g.font = FS(500, 31 * k, true); g.fillStyle = T.soluk; g.textAlign = 'center'; g.fillText('Ürünün üstüne dokunun, WhatsApp\'tan hemen sorun.', W / 2, Y(1468)); g.textAlign = 'left';
    elmas(g, W / 2, Y(1520), X(220), k);
    const cw = aralikli(g, `Sipariş ve bilgi  ·  WhatsApp ${TEL}`, W / 2, Y(1580), 19 * k, 5 * k, T.yazi, 'center', 600, W - X(240));
    lk.push({ x: W / 2 - cw / 2 - 10 * k, y: Y(1580) - 34 * k, w: cw + 20 * k, h: 50 * k, url: waUrl() });
    g.font = FS(500, 42 * k, true); const sw = g.measureText(SITE).width; g.fillStyle = T.koyu ? varak(g, W / 2 - sw / 2, W / 2 + sw / 2) : T.altin; g.textAlign = 'center'; g.fillText(SITE, W / 2, Y(1642)); g.textAlign = 'left';
    lk.push({ x: W / 2 - sw / 2 - 10 * k, y: Y(1642) - 40 * k, w: sw + 20 * k, h: 54 * k, url: SITE_URL });
  }
  /* arka kapak: logo, WhatsApp numarası ve QR (okutunca WhatsApp sohbeti), adres, site, katalogdaki markalar */
  let qrYuk = null;
  const qrYukle = () => qrYuk ||= new Promise(ok => {
    if (window.qrcode) return ok(window.qrcode);
    const sc = Object.assign(document.createElement('script'), { src: 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', onload: () => ok(window.qrcode || null), onerror: () => { qrYuk = null; ok(null); } });
    document.head.append(sc);
  });
  function qrCiz(g, qr, x, y, size, k) {
    const n = qr.getModuleCount(), q = 3, c = size / (n + 2 * q);
    g.save(); g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowBlur = 20 * k; g.shadowOffsetY = 6 * k; yuvarlak(g, x, y, size, size, 16 * k); g.fillStyle = '#fffdf9'; g.fill(); g.restore();
    g.fillStyle = '#1f1a15';
    for (let r = 0; r < n; r++) for (let cc = 0; cc < n; cc++) if (qr.isDark(r, cc)) g.fillRect(Math.floor(x + (cc + q) * c), Math.floor(y + (r + q) * c), Math.ceil(c) + 0.5, Math.ceil(c) + 0.5);
  }
  function luxArka(g, W, H, qrf, l, lk) {
    const X = v => v * W / 1240, Y = v => v * H / 1754, k = Math.min(W / 1240, H / 1754);
    zeminLux(g, W, H);
    const lg = T.koyu ? logoAltin : logoKoyu;
    if (lg) { const lh = 96 * k, lw = lg.width / lg.height * lh; g.drawImage(lg, (W - lw) / 2, Y(300), lw, lh); }
    aralikli(g, 'ÇANTA', W / 2, Y(300) + 96 * k + 48 * k, 19 * k, 14 * k, T.koyu ? T.altin : T.soluk, 'center', 600);
    elmas(g, W / 2, Y(560), X(300), k);
    g.font = FS(500, 46 * k, true); g.fillStyle = T.yazi; g.textAlign = 'center'; g.fillText('Sipariş ve bilgi için', W / 2, Y(660));
    aralikli(g, 'WhatsApp', W / 2, Y(724), 16 * k, 8 * k, T.altin, 'center', 600);
    g.font = FP(600, 66 * k); const tw = g.measureText(TEL).width; g.fillStyle = T.koyu ? varak(g, W / 2 - tw / 2, W / 2 + tw / 2) : T.yazi; g.textAlign = 'center'; g.fillText(TEL, W / 2, Y(808)); g.textAlign = 'left';
    lk.push({ x: W / 2 - tw / 2 - 12 * k, y: Y(808) - 64 * k, w: tw + 24 * k, h: 82 * k, url: waUrl() });
    let y = Y(880);
    const qr = qrf ? (() => { try { const q = qrf(0, 'M'); q.addData(waUrl()); q.make(); return q; } catch { return null; } })() : null;
    if (qr) {
      const qs = X(250); qrCiz(g, qr, (W - qs) / 2, y, qs, k);
      lk.push({ x: (W - qs) / 2, y, w: qs, h: qs, url: waUrl() });
      y += qs + 48 * k; aralikli(g, 'Okutun, WhatsApp\'tan yazın', W / 2, y, 13 * k, 5 * k, T.soluk, 'center', 600); y += 40 * k;
    } else y += 40 * k;
    y = Math.max(y + 40 * k, Y(1330));
    elmas(g, W / 2, y, X(220), k);
    g.font = FS(500, 31 * k); g.fillStyle = T.soluk; g.textAlign = 'center'; g.fillText(ADRES, W / 2, y + 66 * k);
    g.font = FS(500, 44 * k, true); const sw = g.measureText(SITE).width; g.fillStyle = T.koyu ? varak(g, W / 2 - sw / 2, W / 2 + sw / 2) : T.altin; g.fillText(SITE, W / 2, y + 136 * k); g.textAlign = 'left';
    lk.push({ x: W / 2 - sw / 2 - 10 * k, y: y + 96 * k, w: sw + 20 * k, h: 56 * k, url: SITE_URL });
    let mk = [...new Set(l.map(p => buyuk(p.brand || '').trim()).filter(b => b && b.length < 24))];
    g.font = F(600, 14 * k); g.letterSpacing = 5 * k + 'px';
    while (mk.length > 1 && g.measureText(mk.join('  ·  ')).width > W - X(260)) mk = mk.slice(0, -1);
    g.letterSpacing = '0px';
    if (mk.length > 1) aralikli(g, mk.join('  ·  '), W / 2, Math.min(H - 110 * k, y + 214 * k), 14 * k, 5 * k, T.soluk, 'center', 600, W - X(260));
  }
  // klasik temanın kapağıyla uyumlu arka kapak: Siyah ve altın düzeni
  function arkaKapak(g, W, H, qrf, l, lk) { const t = T; if (D.ktema === 'klasik') T = KTEMA.koyu; try { luxArka(g, W, H, qrf, l, lk); } finally { T = t; } }

  /* WhatsApp durumu, lüks (1080×1920): üst ~260 px ve alt ~260 px WhatsApp arayüzüne boş; kemer, mühürde fiyat, ad, bilgi, renkler, çağrı */
  function durumLuks(g, W, H, p, im) {
    zeminLux(g, W, H);
    const lg = T.koyu ? logoAltin : logoKoyu;
    if (lg) { const lh = 54, lw = lg.width / lg.height * lh; g.drawImage(lg, (W - lw) / 2, 268, lw, lh); }
    aralikli(g, 'ÇANTA', W / 2, 362, 15, 11, T.koyu ? T.altin : T.soluk, 'center', 600);
    const kat = P.cat(p);
    if (kat && kat !== 'Kategorisiz') { const w = aralikli(g, kat, W / 2, 432, 19, 7, T.altin, 'center', 600, 640); g.fillStyle = T.cizgi; g.fillRect(W / 2 - w / 2 - 76, 425, 54, 1.4); g.fillRect(W / 2 + w / 2 + 22, 425, 54, 1.4); }
    const aw = 740, ax = (W - aw) / 2, ay = 496, ah = 1268 - ay;
    kemerFoto(g, im, ax, ay, aw, ah, true, 1);
    const f = fiyatAl(p); if (f) muhur(g, ax + aw - 24, ay + aw * 0.28, 104, f);
    g.textAlign = 'center'; g.fillStyle = T.yazi; g.font = FP(500, 54);
    let sat = satirlar(g, adYaz(p.name), W - 200, 2), y = 1352;
    if (sat.length > 1) { g.font = FP(500, 44); sat = satirlar(g, adYaz(p.name), W - 200, 2); y = 1340; }
    for (const l of sat) { g.fillText(l, W / 2, y); y += 54; }
    g.textAlign = 'left';
    const bi = bilgiSatiri(p);
    if (bi) { aralikli(g, bi, W / 2, y + 4, 21, 4, T.soluk, 'center', 600, W - 200); y += 52; }
    const rl = D.renk ? renkler(p) : [];
    if (rl.length) renkSatiri(g, rl, W / 2, Math.min(y + 10, 1520), W - 200, 12, 19);
    elmas(g, W / 2, 1552, 220, 1);
    aralikli(g, `Sipariş için WhatsApp ${TEL}`, W / 2, 1600, 23, 4, T.yazi, 'center', 600, W - 180);
    g.font = FS(500, 38, true); const sw = g.measureText(SITE).width; g.fillStyle = T.koyu ? varak(g, W / 2 - sw / 2, W / 2 + sw / 2) : T.altin; g.textAlign = 'center'; g.fillText(SITE, W / 2, 1644); g.textAlign = 'left';
  }

  // sayfalara bölme: "her kategori yeni sayfada" açıksa kategori değişince yeni sayfa
  function sayfalar(l) {
    const n = D.adet, out = [];
    if (D.katSayfa && D.sira === 'kat') {
      let grup = [], k = null;
      const bitir = () => { for (let i = 0; i < grup.length; i += n) out.push({ kat: k, l: grup.slice(i, i + n) }); };
      for (const p of l) { if (P.path(p) !== k) { bitir(); grup = []; k = P.path(p); } grup.push(p); }
      bitir();
    } else {
      for (let i = 0; i < l.length; i += n) { const s = l.slice(i, i + n), ks = [...new Set(s.map(P.path))]; out.push({ kat: ks.length === 1 ? ks[0] : '', l: s }); }
    }
    return out;
  }
  let jspdf = null;
  const jsPdfYukle = () => jspdf ||= new Promise((ok, no) => {
    if (window.jspdf) return ok(window.jspdf);
    const s = Object.assign(document.createElement('script'), { src: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js', onload: () => ok(window.jspdf), onerror: () => { jspdf = null; no(new Error('PDF aracı yüklenemedi, internet bağlantısını kontrol edin.')); } });
    document.head.append(s);
  });
  const dosyaAdi = () => `CLK-katalog-${D.fiyat === 'yok' ? 'fiyatsiz' : D.fiyat}-${new Date().toISOString().slice(0, 10)}.pdf`;

  async function olustur() {
    const l = katalogdakiler();
    if (!l.length) { toast('Katalogda ürün yok: filtreleri ya da seçimi kontrol edin'); return; }
    sifirla(); D.calisiyor = true; D.durum = 'Hazırlanıyor…'; S.keepScroll = true; render();
    try {
      const yazi = ['700 40px Inter', '600 40px Inter', '600 40px "Playfair Display"', '700 40px "Playfair Display"', '600 40px "Cormorant Garamond"', 'italic 500 40px "Cormorant Garamond"', '500 40px "Cormorant Garamond"'];
      const [{ jsPDF }] = await Promise.all([jsPdfYukle(), logolar(), ...yazi.map(y => document.fonts?.load?.(y))].map(x => Promise.resolve(x).catch(() => null)));
      const b = BICIM[D.bicim], { W, H } = b;
      if (b.resim) { await durumlar(l, W, H); return; }
      const lux = D.ktema !== 'klasik';
      T = KTEMA[D.ktema] || KTEMA.fildisi;
      const qrf = D.arka ? await qrYukle() : null;
      if (lux) await bodoniYukle();
      const pdf = new jsPDF({ unit: 'mm', format: b.mm, orientation: 'portrait', compress: true });
      const sl = sayfalar(l), toplam = sl.length + (D.kapak ? 1 : 0) + (D.arka ? 1 : 0);
      const ol = D.coz === 'normal' ? 1 : 2, { c, g, hazirla } = tuval(W, H, ol);
      let no = 0, eksik = 0, lk = [];
      const kx = b.mm[0] / W, ky = b.mm[1] / H;
      const ekle = () => {
        if (no > 0) pdf.addPage(b.mm, 'portrait');
        pdf.addImage(c.toDataURL('image/jpeg', ol > 1 ? 0.9 : 0.92), 'JPEG', 0, 0, b.mm[0], b.mm[1], undefined, 'FAST');
        // dokunulabilir yerler: ürün → WhatsApp'ta ürün adıyla mesaj, numara → WhatsApp, site → clkcanta.com
        for (const a of lk) try { pdf.link(a.x * kx, a.y * ky, a.w * kx, a.h * ky, { url: a.url }); } catch {}
        lk = [];
        if (D.onizleme.length < 60) { const o = document.createElement('canvas'); o.width = 600; o.height = Math.round(600 * H / W); const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(c, 0, 0, o.width, o.height); D.onizleme.push(o.toDataURL('image/jpeg', 0.85)); }
        no++;
      };
      if (D.kapak) {
        const imgs = await Promise.all((lux ? kapakSec(l, 3) : l.slice(0, 4)).map(p => gorsel(P.img(p))));
        hazirla(); if (lux) luxKapak(g, W, H, imgs, l, lk); else kapak(g, W, H, imgs, l.length); ekle();
      }
      for (let i = 0; i < sl.length; i++) {
        D.durum = `Sayfa ${no + 1} / ${toplam} hazırlanıyor…`; const d = $('#ktDurum'); if (d) d.textContent = D.durum;
        // sonraki sayfanın fotoğrafları da şimdiden istenir
        if (sl[i + 1]) sl[i + 1].l.forEach(p => gorsel(P.img(p)));
        const imgs = await Promise.all(sl[i].l.map(p => gorsel(P.img(p))));
        eksik += imgs.filter(x => !x).length;
        hazirla(); if (lux) luxSayfa(g, W, H, sl[i].l, imgs, sl[i].kat, no + 1, toplam, lk); else urunSayfasi(g, W, H, sl[i].l, imgs, sl[i].kat, no + 1, toplam, lk); ekle();
      }
      if (D.arka) { hazirla(); arkaKapak(g, W, H, qrf, l, lk); ekle(); }
      c.width = c.height = 1; // büyük tuvalin belleği bırakılır
      D.blob = pdf.output('blob'); D.url = URL.createObjectURL(D.blob);
      const fs = D.fiyat === 'yok' ? 0 : l.filter(p => !fiyatAl(p)).length;
      D.durum = `${num(l.length)} ürün, ${toplam} sayfa hazır (${(D.blob.size / 1048576).toFixed(1).replace('.', ',')} MB).` + (eksik ? ` ${eksik} ürünün fotoğrafı açılamadı.` : '') + (fs ? ` ${fs} üründe ${FIYAT.find(x => x[0] === D.fiyat)[1]} fiyatı olmadığı için fiyat yazılmadı.` : '');
    } catch (e) { D.durum = 'Katalog hazırlanamadı: ' + (e.message || e); }
    finally { if (yc) yc.width = yc.height = 1; D.calisiyor = false; S.keepScroll = true; render(); }
  }
  // durum resimleri: her ürün bir JPEG; hepsi birden ya da tek tek paylaşılır
  async function durumlar(l, W, H) {
    const { c, g, hazirla } = tuval(W, H, 1), out = []; let eksik = 0;
    if (String(D.tema).startsWith('l-')) await bodoniYukle();
    for (let i = 0; i < l.length; i++) {
      D.durum = `Resim ${i + 1} / ${l.length} hazırlanıyor…`; const d = $('#ktDurum'); if (d) d.textContent = D.durum;
      if (l[i + 1]) gorsel(P.img(l[i + 1]));
      const im = await gorsel(P.img(l[i])); if (!im) eksik++;
      hazirla(); durumResmi(g, W, H, l[i], im, i);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.95));
      const ad = `CLK-durum-${String(i + 1).padStart(2, '0')}-${String(kodAl(l[i]) || l[i].id).replace(/[^\w-]+/g, '')}.jpg`;
      out.push({ blob, ad, url: URL.createObjectURL(blob) });
    }
    c.width = c.height = 1; D.resimler = out;
    const fs = D.fiyat === 'yok' ? 0 : l.filter(p => !fiyatAl(p)).length;
    D.durum = `${num(out.length)} durum resmi hazır. Tek birini paylaşmak için resmine dokunun.` + (eksik ? ` ${eksik} ürünün fotoğrafı açılamadı.` : '') + (fs ? ` ${fs} üründe fiyat olmadığı için fiyat yazılmadı.` : '') + (out.length > 30 ? ' WhatsApp durumda bir seferde en çok 30 resim paylaşılabilir; az ürün seçin ya da tek tek paylaşın.' : '');
  }
  const resimIndir = r => { const a = Object.assign(document.createElement('a'), { href: r.url, download: r.ad }); document.body.append(a); a.click(); a.remove(); };
  async function resimPaylas(liste) {
    if (!liste.length) return;
    const fl = liste.map(r => new File([r.blob], r.ad, { type: 'image/jpeg' }));
    try { if (navigator.canShare?.({ files: fl })) { await navigator.share({ files: fl }); return; } }
    catch (e) { if (e.name === 'AbortError') return; }
    for (const [i, r] of liste.entries()) setTimeout(() => resimIndir(r), i * 350);
    toast('Bu cihaz doğrudan paylaşmaya izin vermedi; resimler indirildi');
  }
  function indir() { if (D.resimler?.length) { D.resimler.forEach((r, i) => setTimeout(() => resimIndir(r), i * 350)); return; } if (!D.url) return; const a = Object.assign(document.createElement('a'), { href: D.url, download: dosyaAdi() }); document.body.append(a); a.click(); a.remove(); }
  async function paylas() {
    if (D.resimler?.length) return resimPaylas(D.resimler);
    if (!D.blob) return;
    const f = new File([D.blob], dosyaAdi(), { type: 'application/pdf' });
    try { if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: D.baslik || 'CLK Çanta katalog' }); return; } }
    catch (e) { if (e.name === 'AbortError') return; }
    indir(); toast('Bu cihaz doğrudan paylaşmaya izin vermedi; PDF indirildi');
  }

  /* sayfa */
  const sec = (id, liste, v) => `<select id="${id}">${liste.map(([k, l]) => `<option value="${esc(k)}" ${String(v) === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const kutu = (id, v, l) => `<label class="toggle"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}> ${l}</label>`;
  function satir(p) {
    const id = String(p.id), var_ = !D.cikar.has(id), f = fiyatAl(p), img = P.img(p), kod = kodAl(p);
    return `<label class="kt-r ${var_ ? '' : 'kt-cik'}"><input type="checkbox" data-kt-u="${esc(id)}" ${var_ ? 'checked' : ''} ${img ? '' : 'disabled'}>
      <span class="kt-im">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<i>Foto yok</i>'}</span>
      <span class="kt-ad"><b>${esc(p.name)}</b><small>${esc([kod, P.path(p)].filter(Boolean).join(' · '))}</small>${(() => { const b = bilgi(p), rl = renkler(p), t = [b.olcu, b.malzeme, b.su, rl.length ? rl.map(guzelAd).join(', ') : ''].filter(Boolean).join(' · '); return t ? `<small class="kt-bilgi">${esc(t)}</small>` : ''; })()}</span>
      <span class="kt-sag">${D.fiyat === 'yok' ? '' : `<b>${f ? fmt(f) : '<em>fiyat yok</em>'}</b>`}<small>${num(P.qty(p))} adet</small></span></label>`;
  }
  views.katalog = () => {
    if (!S.pLoaded && !S.pLoading && !S.pErr) loadProducts();
    const ust = head('Site ürünleri', 'Katalog', 'Sitedeki ürünlerden PDF katalog hazırlanır: fiyatsız ya da seçtiğiniz fiyatla (site ya da Bayi 1–4). WhatsApp\'tan gönderilir ya da yazdırılır; PDF\'te ürüne dokunan müşteri WhatsApp\'tan o ürünü sorar.');
    if (!S.pLoaded && !S.products.length) return ust + (S.pErr ? CLK.errBox(S.pErr, 'reloadP') : `<div class="card"><p class="sk-say">Ürünler yükleniyor… ${esc(S.pProg || '')}</p><div class="skel" style="height:240px"></div></div>`);
    const b = BICIM[D.bicim] || BICIM.a4, adetler = b.adet.filter(n => n !== 16 || D.ktema !== 'klasik');
    if (!adetler.includes(+D.adet)) D.adet = adetler.includes(4) ? 4 : adetler[0];
    const fl = filtreli(), fotosuz = fl.filter(p => !P.img(p)).length, ic = katalogdakiler(), gorunen = sirala(fl).slice(0, D.goster);
    const resim = !!b.resim, hazir = !!(D.url || D.resimler?.length);
    const sayfaSay = !ic.length ? 0 : resim ? ic.length : sayfalar(ic).length + (D.kapak ? 1 : 0) + (D.arka ? 1 : 0);
    return `${ust}
      <div class="card kt-ayar">
        <h3>Görünüm</h3><p class="sub">Ayarlar bu cihazda hatırlanır.</p>
        <div class="kt-fiyat" role="group" aria-label="Fiyat">${FIYAT.map(([k, l]) => `<button class="chip" data-act="ktFiyat" data-v="${k}" aria-pressed="${D.fiyat === k}">${l}</button>`).join('')}</div>
        <div class="ek-form kt-form">
          <label>Başlık<input id="ktBaslik" value="${esc(D.baslik)}" placeholder="Ürün Kataloğu"></label>
          <label>Alt başlık<input id="ktAlt" value="${esc(D.alt)}" placeholder="${esc(guzelAd(ayYil()))} · ${num(ic.length)} ürün"></label>
          <label>Biçim${sec('ktBicim', Object.entries(BICIM).map(([k, v]) => [k, v.ad]), D.bicim)}</label>
          ${resim ? `<label>Tasarım${sec('ktTema', [['kurumsal', 'Kurumsal (Meta reklamı)'], ...Object.entries(KTEMA).map(([k, v]) => ['l-' + k, v.ad]), ['renkli', 'Canlı renkli'], ['koyu', 'Siyah ve altın (eski)']], D.tema)}</label>`
            : `<label>Tema${sec('ktKtema', PTEMA, D.ktema)}</label><label>Sayfada ürün${sec('ktAdet', adetler.map(n => [n, n === 1 ? '1 (büyük, reklam gibi)' : n === 16 ? '16 (fiyat listesi)' : String(n)]), D.adet)}</label><label>Çözünürlük${sec('ktCoz', COZ, D.coz)}</label>`}
          <label>Sıralama${sec('ktSira', SIRA, D.sira)}</label>
          <label>Alt not<input id="ktNot" value="${esc(D.not)}" placeholder="örn. Fiyatlar 1 Kasım'a kadar geçerlidir"></label>
        </div>
        <div class="kt-kutular">${resim ? '' : kutu('ktKapak', D.kapak, 'Kapak sayfası') + kutu('ktArka', D.arka, 'Arka kapak (iletişim, QR)') + kutu('ktKatSayfa', D.katSayfa, 'Her kategori yeni sayfada')}${kutu('ktKod', D.kod, 'Ürün kodu yazılsın')}${kutu('ktRenk', D.renk, 'Renkler yazılsın')}${kutu('ktOlcu', D.olcu, 'Ölçü ve malzeme yazılsın')}</div>
      </div>
      <div class="card kt-urunler">
        <h3>Ürünler</h3><p class="sub">Filtreye uyan ve fotoğrafı olan ürünlerin hepsi kataloğa girer; istemediğinizin işaretini kaldırın.</p>
        <div class="ek-form kt-form">
          <label>Kategori${sec('ktKat', [['', 'Tüm kategoriler'], ...katSecenek().map(([k, n]) => [k, `${k} (${n})`])], D.kat)}</label>
          <label>Ara<input id="ktAra" type="search" value="${esc(D.ara)}" placeholder="Ürün adı ya da kodu"></label>
        </div>
        <div class="kt-kutular">${kutu('ktStokta', D.stokta, 'Yalnız stokta olanlar')}${kutu('ktAktif', D.aktif, 'Yalnız sitede yayında olanlar')}</div>
        <div class="kt-say"><span><b>${num(ic.length)}</b> ürün katalogda${sayfaSay ? ` · ${sayfaSay} ${resim ? 'resim' : 'sayfa'}` : ''}${fotosuz ? ` · ${fotosuz} ürünün fotoğrafı yok, girmez` : ''}</span>
          <span><button class="btn sm" data-act="ktHepsi">Hepsini seç</button> <button class="btn sm" data-act="ktHicbiri">Hiçbirini seçme</button></span></div>
        <div class="kt-liste">${gorunen.map(satir).join('') || '<p class="ek-bos">Filtreye uyan ürün yok.</p>'}</div>
        ${fl.length > gorunen.length ? `<button class="btn sm" data-act="ktDaha" style="margin-top:10px">Daha fazla göster (${num(fl.length - gorunen.length)} ürün daha)</button>` : ''}
      </div>
      <div class="card kt-cikti">
        <div class="ek-dug">
          <button class="btn gold" data-act="ktOlustur" ${D.calisiyor || !ic.length ? 'disabled' : ''}>${D.calisiyor ? 'Hazırlanıyor…' : resim ? 'Durum resimlerini hazırla' : 'Kataloğu hazırla'}</button>
          <button class="btn ek-wa" data-act="ktPaylas" ${hazir ? '' : 'disabled'}>${resim ? 'Hepsini WhatsApp\'ta paylaş' : 'WhatsApp\'ta paylaş'}</button>
          <button class="btn" data-act="ktIndir" ${hazir ? '' : 'disabled'}>${resim ? 'Resimleri indir' : 'PDF indir'}</button>
        </div>
        <p class="ek-durum" id="ktDurum" role="status">${esc(D.durum)}</p>
        ${D.resimler?.length ? `<div class="kt-on kt-durum">${D.resimler.map((r, i) => `<button type="button" data-act="ktTek" data-i="${i}" title="Bu resmi paylaş"><img src="${r.url}" alt="Durum resmi ${i + 1}"><span>Paylaş</span></button>`).join('')}</div>` : ''}
        ${D.onizleme.length ? `<div class="kt-on">${D.onizleme.map((u, i) => `<img src="${u}" alt="Sayfa ${i + 1}">`).join('')}</div>` : ''}
      </div>`;
  };
  views.bind_katalog = () => {
    const yaz = (id, k, tam) => $('#' + id)?.addEventListener(tam ? 'change' : 'input', e => {
      D[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'select-one' && k === 'adet' ? +e.target.value : e.target.value;
      sakla();
      const eski = !!(D.url || D.resimler?.length), ciz = tam || eski;
      if (eski) sifirla();
      if (ciz) { S.keepScroll = true; render(); }
    });
    yaz('ktBaslik', 'baslik'); yaz('ktAlt', 'alt'); yaz('ktNot', 'not');
    for (const [id, k] of [['ktTema', 'tema'], ['ktKtema', 'ktema'], ['ktArka', 'arka'], ['ktCoz', 'coz'], ['ktBicim', 'bicim'], ['ktAdet', 'adet'], ['ktSira', 'sira'], ['ktKat', 'kat'], ['ktKapak', 'kapak'], ['ktKatSayfa', 'katSayfa'], ['ktKod', 'kod'], ['ktRenk', 'renk'], ['ktOlcu', 'olcu'], ['ktStokta', 'stokta'], ['ktAktif', 'aktif']]) yaz(id, k, true);
    const a = $('#ktAra');
    a?.addEventListener('input', () => { clearTimeout(a.t); a.t = setTimeout(() => { D.ara = a.value; D.goster = 60; S.keepScroll = true; render.yazinca(); }, 200); });
    $('.kt-liste')?.addEventListener('change', e => {
      const id = e.target.dataset?.ktU; if (!id) return;
      if (e.target.checked) D.cikar.delete(id); else D.cikar.add(id);
      sakla(); if (D.url || D.resimler?.length) sifirla(); S.keepScroll = true; render();
    });
  };
  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'ktFiyat') { D.fiyat = el.dataset.v; sakla(); sifirla(); S.keepScroll = true; render(); }
    else if (act === 'ktHepsi' || act === 'ktHicbiri') { for (const p of filtreli()) { const id = String(p.id); if (act === 'ktHepsi') D.cikar.delete(id); else D.cikar.add(id); } sakla(); sifirla(); S.keepScroll = true; render(); }
    else if (act === 'ktDaha') { D.goster += 120; S.keepScroll = true; render(); }
    else if (act === 'ktOlustur') olustur();
    else if (act === 'ktIndir') indir();
    else if (act === 'ktTek') { const r = D.resimler?.[+el.dataset.i]; if (r) resimPaylas([r]); }
    else if (act === 'ktPaylas') paylas();
    else prevAct?.(act, el, e);
  };
})();
