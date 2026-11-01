/* CLK Yönetim — Katalog: sitedeki ürünlerden reklam (Meta reklamı) görünümlü PDF katalog; fiyatsız ya da Site / Bayi 1–4 fiyatlı (celik isteği 01.11.2026).
   Sayfalar tarayıcıda tuvale çizilir, jsPDF ile tek PDF yapılır; indirilir ya da WhatsApp'ta paylaşılır. Sunucuya bir şey yazılmaz. */
(() => {
  const { S, $, esc, num, toast, head, views, render, loadProducts, P } = CLK;
  const FIYAT = [['yok', 'Fiyatsız'], ['site', 'Site fiyatı'], ['b1', 'Bayi 1'], ['b2', 'Bayi 2'], ['b3', 'Bayi 3'], ['b4', 'Bayi 4']];
  const BICIM = { a4: { ad: 'A4 dikey (yazdırma, e-posta)', W: 1240, H: 1754, mm: [210, 297], adet: [1, 4, 6, 9] }, dik: { ad: '4:5 (WhatsApp, Instagram)', W: 1080, H: 1350, mm: [216, 270], adet: [1, 4] },
    durum: { ad: 'WhatsApp durum (9:16 resimler)', W: 1080, H: 1920, adet: [1], resim: true } };
  const IZGARA = { 1: [1, 1], 4: [2, 2], 6: [3, 2], 9: [3, 3] };
  const SIRA = [['kat', 'Kategoriye göre'], ['ad', 'Ada göre'], ['artan', 'Fiyat artan'], ['azalan', 'Fiyat azalan'], ['yeni', 'En yeni önce']];
  const TEL = '0534 077 88 67', SITE = 'clkcanta.com';
  const RENK = { INK: '#121110', INK2: '#1d1b19', GOLD: '#b48f55', GOLD2: '#d6bd8f', CREAM: '#f6f4f0', LINE: '#e8e3db', MUTED: '#7a746b' };
  const ayYil = () => new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  const VARS = { tema: 'kurumsal', baslik: 'Ürün Kataloğu', alt: '', fiyat: 'yok', bicim: 'a4', adet: 4, sira: 'kat', not: '', kapak: true, katSayfa: true, kod: true, renk: true, kat: '', stokta: true, aktif: true };
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
    const altH = Math.round(w * (+D.adet === 1 ? (D.renk ? 0.25 : 0.19) : D.renk ? 0.36 : 0.28)), ix = x + pad, iy = y + pad, iw = w - 2 * pad, ih = h - altH - pad;
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
        const yazi = rl.length === 1 ? guzelAd(rl[0]) : rl.length <= 3 && !noktali.length ? rl.map(guzelAd).join(', ') : `${rl.length} renk`;
        g.fillText(satirlar(g, yazi, ix + iw - rx - 6 * s, 1)[0] || '', rx + (noktali.length ? 6 * s : 0), ty);
      }
    }
  }

  function ustBant(g, W, H, kat) {
    const m = Math.round(W * 0.05), y = Math.round(H * 0.045);
    if (logoKoyu) { const lh = H * 0.026, lw = logoKoyu.width / logoKoyu.height * lh; g.drawImage(logoKoyu, m, y - lh * 0.8, lw, lh); g.font = F(700, W * 0.0125); g.fillStyle = RENK.INK; g.letterSpacing = '4px'; g.fillText('ÇANTA', m + lw + W * 0.012, y); g.letterSpacing = '0px'; }
    if (kat) { g.font = F(700, W * 0.013); g.fillStyle = '#6a5226'; g.textAlign = 'right'; g.letterSpacing = '3px'; g.fillText(satirlar(g, buyuk(kat), W * 0.6, 1)[0], W - m, y); g.letterSpacing = '0px'; g.textAlign = 'left'; }
    g.fillStyle = RENK.GOLD; g.fillRect(m, y + H * 0.014, W - 2 * m, 2);
  }
  function altBant(g, W, H, no, toplam) {
    const bh = Math.round(H * 0.055), y = H - bh, m = Math.round(W * 0.05);
    g.fillStyle = RENK.INK; g.fillRect(0, y, W, bh);
    g.textBaseline = 'middle'; g.font = F(700, W * 0.0145); g.fillStyle = RENK.GOLD2;
    g.fillText(`WhatsApp ile sipariş: ${TEL}`, m, y + bh / 2);
    g.font = F(500, W * 0.013); g.fillStyle = '#cfc8bc'; g.textAlign = 'right';
    g.fillText(`${SITE}   ·   ${no} / ${toplam}`, W - m, y + bh / 2);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    if (D.not.trim()) { g.font = F(500, W * 0.012); g.fillStyle = RENK.MUTED; g.textAlign = 'center'; g.fillText(satirlar(g, D.not.trim(), W - 2 * m, 1)[0], W / 2, y - H * 0.012); g.textAlign = 'left'; }
  }
  function urunSayfasi(g, W, H, liste, imgs, kat, no, toplam) {
    g.fillStyle = RENK.CREAM; g.fillRect(0, 0, W, H);
    ustBant(g, W, H, kat);
    const [sut, sat] = IZGARA[D.adet], m = Math.round(W * 0.05), gap = Math.round(W * 0.025);
    const ust = Math.round(H * 0.085), alt = Math.round(H * (D.not.trim() ? 0.085 : 0.075));
    const cw = (W - 2 * m - gap * (sut - 1)) / sut, ch = (H - ust - alt - gap * (sat - 1)) / sat;
    liste.forEach((p, i) => kart(g, p, imgs[i], m + (i % sut) * (cw + gap), ust + Math.floor(i / sut) * (ch + gap), cw, ch));
    altBant(g, W, H, no, toplam);
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
    const yazi = [rl.length > 1 ? `${rl.length} renk` : rl.length ? guzelAd(rl[0]) : '', kod ? 'Kod: ' + kod : ''].filter(Boolean).join('  ·  ');
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
    const zg = g.createLinearGradient(0, 0, 0, 1360); zg.addColorStop(0, '#ffffff'); zg.addColorStop(1, '#ece7df');
    g.fillStyle = zg; g.fillRect(0, 0, W, H);
    const m = 72, ust = 262;
    if (logoKoyu) { const lh = 58, lw = logoKoyu.width / logoKoyu.height * lh; g.drawImage(logoKoyu, m, ust - lh + 6, lw, lh); g.font = F(700, 21); g.fillStyle = RENK.INK; g.letterSpacing = '6px'; g.fillText('ÇANTA', m + lw + 14, ust); g.letterSpacing = '0px'; }
    const kat = P.cat(p);
    if (kat && kat !== 'Kategorisiz') { g.font = F(700, 20); g.fillStyle = '#8a6a33'; g.textAlign = 'right'; g.letterSpacing = '4px'; g.fillText(satirlar(g, buyuk(kat), 520, 1)[0], W - m, ust); g.letterSpacing = '0px'; g.textAlign = 'left'; }
    // başlık: ürün adı
    let y = ust + 96; g.font = F(700, 54); g.fillStyle = RENK.INK;
    for (const l of satirlar(g, p.name, W - 2 * m, 2)) { g.fillText(l, m, y); y += 64; }
    g.fillStyle = RENK.GOLD; g.fillRect(m, y - 30, 90, 5);
    // ürün: fotoğraf çarpma ile çizilir, beyaz fonu açık zemine karışır
    const ay = y + 10, ah = 1330 - ay;
    // vitrin fotoğraflarının kendi gölgesi var; ayrıca zemin gölgesi çizilmez
    if (im) { g.save(); g.globalCompositeOperation = 'multiply'; sigdir(g, im, m, ay, W - 2 * m, ah - 20); g.restore(); }
    else { g.fillStyle = RENK.MUTED; g.font = F(600, 34); g.textAlign = 'center'; g.fillText('Fotoğraf yüklenemedi', W / 2, ay + ah / 2); g.textAlign = 'left'; }
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
    if (kod) { g.font = F(500, 24); g.fillStyle = '#a39c91'; g.fillText('Kod: ' + kod, W - m, by + 188); }
    g.textAlign = 'left';
    // tek eylem düğmesi (Meta'daki "Mesaj gönder" gibi)
    const bx = m, bw = W - 2 * m, bh = 96, byy = by + 222;
    yuvarlak(g, bx, byy, bw, bh, 18); const gg = g.createLinearGradient(bx, byy, bx + bw, byy); gg.addColorStop(0, RENK.GOLD); gg.addColorStop(1, '#c9a76b'); g.fillStyle = gg; g.fill();
    g.fillStyle = '#1b150b'; g.font = F(700, 34); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`Sipariş ver  ·  ${TEL}`, W / 2, byy + bh / 2 + 1);
    g.textBaseline = 'alphabetic'; g.font = F(600, 23); g.fillStyle = '#a39c91'; g.letterSpacing = '3px'; g.fillText(buyuk(SITE), W / 2, byy + bh + 52); g.letterSpacing = '0px'; g.textAlign = 'left';
  }

  function durumResmi(g, W, H, p, im, i) {
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
    const alt = [kod ? 'Kod: ' + kod : '', rl.length > 1 ? `${rl.length} renk` : rl.length ? guzelAd(rl[0]) : ''].filter(Boolean).join('   ·   ');
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
      const [{ jsPDF }] = await Promise.all([jsPdfYukle(), logolar(), document.fonts?.load?.('700 40px Inter'), document.fonts?.load?.('600 40px "Playfair Display"')].map(x => Promise.resolve(x)));
      const b = BICIM[D.bicim], { W, H } = b;
      if (b.resim) { await durumlar(l, W, H); return; }
      const pdf = new jsPDF({ unit: 'mm', format: b.mm, orientation: 'portrait', compress: true });
      const sl = sayfalar(l), toplam = sl.length + (D.kapak ? 1 : 0);
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      let no = 0, eksik = 0;
      const ekle = () => {
        if (no > 0) pdf.addPage(b.mm, 'portrait');
        pdf.addImage(c.toDataURL('image/jpeg', 0.88), 'JPEG', 0, 0, b.mm[0], b.mm[1], undefined, 'FAST');
        if (D.onizleme.length < 60) { const k = document.createElement('canvas'); k.width = 300; k.height = Math.round(300 * H / W); k.getContext('2d').drawImage(c, 0, 0, k.width, k.height); D.onizleme.push(k.toDataURL('image/jpeg', 0.8)); }
        no++;
      };
      if (D.kapak) {
        const imgs = await Promise.all(l.slice(0, 4).map(p => gorsel(P.img(p))));
        g.clearRect(0, 0, W, H); kapak(g, W, H, imgs, l.length); ekle();
      }
      for (let i = 0; i < sl.length; i++) {
        D.durum = `Sayfa ${no + 1} / ${toplam} hazırlanıyor…`; const d = $('#ktDurum'); if (d) d.textContent = D.durum;
        // sonraki sayfanın fotoğrafları da şimdiden istenir
        if (sl[i + 1]) sl[i + 1].l.forEach(p => gorsel(P.img(p)));
        const imgs = await Promise.all(sl[i].l.map(p => gorsel(P.img(p))));
        eksik += imgs.filter(x => !x).length;
        g.clearRect(0, 0, W, H); urunSayfasi(g, W, H, sl[i].l, imgs, sl[i].kat, no + 1, toplam); ekle();
      }
      D.blob = pdf.output('blob'); D.url = URL.createObjectURL(D.blob);
      const fs = D.fiyat === 'yok' ? 0 : l.filter(p => !fiyatAl(p)).length;
      D.durum = `${num(l.length)} ürün, ${toplam} sayfa hazır (${(D.blob.size / 1048576).toFixed(1).replace('.', ',')} MB).` + (eksik ? ` ${eksik} ürünün fotoğrafı açılamadı.` : '') + (fs ? ` ${fs} üründe ${FIYAT.find(x => x[0] === D.fiyat)[1]} fiyatı olmadığı için fiyat yazılmadı.` : '');
    } catch (e) { D.durum = 'Katalog hazırlanamadı: ' + (e.message || e); }
    finally { D.calisiyor = false; S.keepScroll = true; render(); }
  }
  // durum resimleri: her ürün bir JPEG; hepsi birden ya da tek tek paylaşılır
  async function durumlar(l, W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), out = []; let eksik = 0;
    for (let i = 0; i < l.length; i++) {
      D.durum = `Resim ${i + 1} / ${l.length} hazırlanıyor…`; const d = $('#ktDurum'); if (d) d.textContent = D.durum;
      if (l[i + 1]) gorsel(P.img(l[i + 1]));
      const im = await gorsel(P.img(l[i])); if (!im) eksik++;
      g.clearRect(0, 0, W, H); durumResmi(g, W, H, l[i], im, i);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
      const ad = `CLK-durum-${String(i + 1).padStart(2, '0')}-${String(kodAl(l[i]) || l[i].id).replace(/[^\w-]+/g, '')}.jpg`;
      out.push({ blob, ad, url: URL.createObjectURL(blob) });
    }
    D.resimler = out;
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
      <span class="kt-ad"><b>${esc(p.name)}</b><small>${esc([kod, P.path(p)].filter(Boolean).join(' · '))}</small></span>
      <span class="kt-sag">${D.fiyat === 'yok' ? '' : `<b>${f ? fmt(f) : '<em>fiyat yok</em>'}</b>`}<small>${num(P.qty(p))} adet</small></span></label>`;
  }
  views.katalog = () => {
    if (!S.pLoaded && !S.pLoading && !S.pErr) loadProducts();
    const ust = head('Site ürünleri', 'Katalog', 'Sitedeki ürünlerden reklam görünümlü PDF katalog hazırlanır: fiyatsız ya da seçtiğiniz fiyatla (site ya da Bayi 1–4). WhatsApp\'tan gönderilir ya da yazdırılır.');
    if (!S.pLoaded && !S.products.length) return ust + (S.pErr ? CLK.errBox(S.pErr, 'reloadP') : `<div class="card"><p class="sk-say">Ürünler yükleniyor… ${esc(S.pProg || '')}</p><div class="skel" style="height:240px"></div></div>`);
    const b = BICIM[D.bicim] || BICIM.a4;
    if (!b.adet.includes(+D.adet)) D.adet = b.adet.includes(4) ? 4 : b.adet[0];
    const fl = filtreli(), fotosuz = fl.filter(p => !P.img(p)).length, ic = katalogdakiler(), gorunen = sirala(fl).slice(0, D.goster);
    const resim = !!b.resim, hazir = !!(D.url || D.resimler?.length);
    const sayfaSay = !ic.length ? 0 : resim ? ic.length : sayfalar(ic).length + (D.kapak ? 1 : 0);
    return `${ust}
      <div class="card kt-ayar">
        <h3>Görünüm</h3><p class="sub">Ayarlar bu cihazda hatırlanır.</p>
        <div class="kt-fiyat" role="group" aria-label="Fiyat">${FIYAT.map(([k, l]) => `<button class="chip" data-act="ktFiyat" data-v="${k}" aria-pressed="${D.fiyat === k}">${l}</button>`).join('')}</div>
        <div class="ek-form kt-form">
          <label>Başlık<input id="ktBaslik" value="${esc(D.baslik)}" placeholder="Ürün Kataloğu"></label>
          <label>Alt başlık<input id="ktAlt" value="${esc(D.alt)}" placeholder="${esc(guzelAd(ayYil()))} · ${num(ic.length)} ürün"></label>
          <label>Biçim${sec('ktBicim', Object.entries(BICIM).map(([k, v]) => [k, v.ad]), D.bicim)}</label>
          ${resim ? `<label>Tasarım${sec('ktTema', [['kurumsal', 'Kurumsal (Meta reklamı)'], ['renkli', 'Canlı renkli'], ['koyu', 'Siyah ve altın']], D.tema)}</label>` : `<label>Sayfada ürün${sec('ktAdet', b.adet.map(n => [n, n === 1 ? '1 (büyük, reklam gibi)' : String(n)]), D.adet)}</label>`}
          <label>Sıralama${sec('ktSira', SIRA, D.sira)}</label>
          <label>Alt not<input id="ktNot" value="${esc(D.not)}" placeholder="örn. Fiyatlar 1 Kasım'a kadar geçerlidir"></label>
        </div>
        <div class="kt-kutular">${resim ? '' : kutu('ktKapak', D.kapak, 'Kapak sayfası') + kutu('ktKatSayfa', D.katSayfa, 'Her kategori yeni sayfada')}${kutu('ktKod', D.kod, 'Ürün kodu yazılsın')}${kutu('ktRenk', D.renk, 'Renkler yazılsın')}</div>
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
    for (const [id, k] of [['ktTema', 'tema'], ['ktBicim', 'bicim'], ['ktAdet', 'adet'], ['ktSira', 'sira'], ['ktKat', 'kat'], ['ktKapak', 'kapak'], ['ktKatSayfa', 'katSayfa'], ['ktKod', 'kod'], ['ktRenk', 'renk'], ['ktStokta', 'stokta'], ['ktAktif', 'aktif']]) yaz(id, k, true);
    const a = $('#ktAra');
    a?.addEventListener('input', () => { clearTimeout(a.t); a.t = setTimeout(() => { D.ara = a.value; D.goster = 60; S.keepScroll = true; render(); }, 200); });
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
