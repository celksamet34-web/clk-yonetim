/* CLK Yönetim — anasayfa görsel stüdyosu: banner, slider (manşet) ve kategori görselleri; yapay zekâ sahnesi, onaydan sonra Qukasoft paneline yüklenir */
(() => {
  const { S, $, esc, P, head, views, render, sb, toast } = CLK;
  const BUCKET = 'product-images';
  // Sahne hazırları: panelde Türkçe ad, modele İngilizce tarif
  const SCENES = [
    ['luks', 'Lüks mermer', 'a polished beige marble pedestal in a softly lit high-end boutique, warm golden accent light, elegant minimal composition, premium fashion campaign photography'],
    ['krem', 'Krem stüdyo', 'a warm cream studio backdrop with a large soft pale beige circle behind the product and a thin delicate golden arc line, soft even light, minimal luxury catalog style'],
    ['koyu', 'Koyu stüdyo', 'a dark charcoal studio backdrop with a soft spotlight from above and a subtle warm gold rim light, luxury product campaign photography'],
    ['okul', 'Okula dönüş', 'a cheerful back-to-school scene, soft pastel classroom background with blurred colorful books and pencils on a light wooden desk, bright natural daylight, clean and playful'],
    ['seyahat', 'Seyahat', 'a blurred modern airport terminal with warm sunlight through large windows, premium travel lifestyle photography'],
    ['sonbahar', 'Sonbahar', 'warm golden-hour light, blurred autumn leaves and cozy knit textures on a wooden surface, premium editorial look'],
    ['yaz', 'Yaz', 'a bright summer terrace with soft sea view bokeh, white stone surface, airy natural light, fresh premium lifestyle photography']
  ];
  const TAIL = ' No text, no letters, no logos, no people.';
  // Biçimler: [anahtar, ad, genişlik, yükseklik, yerleşim]. Yerleşim: ürünün en büyük genişlik/yükseklik oranı, alt kenarı ve yatay merkezi.
  // Slider masaüstünde ürün sağda, sol taraf Qukasoft yazılarına boş; banner ve mobil sliderda ürün üstte, alt kısım yazıya; kategori kutusunda ortada.
  const FORMATS = [
    ['banner', 'Anasayfa banner', 1248, 1664, { w: 0.62, h: 0.58, bottom: 0.68, cx: 0.5 }],
    ['slider', 'Slider masaüstü', 1920, 850, { w: 0.34, h: 0.76, bottom: 0.9, cx: 0.71 }],
    ['slider-m', 'Slider mobil', 1080, 1440, { w: 0.64, h: 0.5, bottom: 0.6, cx: 0.5 }],
    ['kategori', 'Kategori kutusu', 800, 1000, { w: 0.68, h: 0.6, bottom: 0.82, cx: 0.5 }]
  ];
  // Motorlar: fal.ai Seedream (girdiyi düzenler, ~0,04 $) ya da Photoroom AI arka plan (Plus planı, ~0,10 $)
  const ENGINES = [['fal', 'Seedream (fal.ai)', '~0,04 $'], ['photoroom', 'Photoroom', '~0,10 $']];
  const B = (S.ui.bn ||= { q: '', code: '', scene: 'luks', custom: '', title: '', sub: '', btn: 'İncele', link: '', engine: 'fal', format: 'banner', busy: '', out: null, approved: null, approvals: [] });
  B.engine ||= 'fal'; B.format ||= 'banner'; B.approvals ||= [];
  try { if (!B.approvals.length) B.approvals = JSON.parse(localStorage.getItem('clk-banner-approvals') || '[]'); } catch {}
  const product = () => S.products.find(p => String(p.code) === String(B.code));
  const fmt = (k = B.format) => FORMATS.find(f => f[0] === k) || FORMATS[0];
  const sceneText = () => B.custom.trim() || (SCENES.find(s => s[0] === B.scene) || SCENES[0])[2];
  // Seedream'e sahne düz gider (sunucu düzenleme istemine sarar; "logo yok" çantanın logosunu sildirebilir)
  const promptText = () => B.engine === 'fal' ? sceneText() + '.' : sceneText() + TAIL;
  const engine = () => ENGINES.find(e => e[0] === B.engine) || ENGINES[0];

  // Önizleme: Qukasoft'un görselin üstüne koyduğu yazılar. Banner ve mobil sliderda altta siyah kutular, masaüstü sliderda solda, kategoride altta ad.
  const overlay = f => f === 'kategori' ? `<div class="bn-ov cat"><span>${esc(B.title || 'KATEGORİ ADI')}</span></div>`
    : `<div class="bn-ov ${f === 'slider' ? 'side' : ''}">${B.title ? `<span class="t">${esc(B.title)}</span>` : ''}${B.sub ? `<span class="s">${esc(B.sub)}</span>` : ''}${B.btn ? `<span class="b">${esc(B.btn)}</span>` : ''}</div>`;

  views.banner = () => {
    const p = product(), img = p && P.img(p), list = S.products.filter(x => P.img(x)), out = B.out, [fk, fl, fw, fh] = fmt();
    return head('Mağaza', 'Görsel stüdyosu', 'Anasayfa banner, slider ve kategori görselleri · yapay zekâ sahnesi · onaylamadan yayına çıkmaz') + `
    <div class="grid2 bn">
      <div class="bn-form">
        <div class="chips" style="margin:0">${FORMATS.map(([k, l, w, h]) => `<button class="chip" data-act="bnFormat" data-k="${k}" aria-pressed="${B.format === k}">${l} <b>${w}×${h}</b></button>`).join('')}</div>
        <section class="step"><div class="step-h"><span class="no">01</span><div><h2>Ürün</h2><p>Görselde yer alacak çanta. İlk fotoğrafı kullanılır, yerinde ve aynen kalır.</p></div></div>
          <div class="step-b"><label class="f"><span>Ürün ara</span><input type="search" id="bnq" list="bn-products" placeholder="Ürün adı ya da kodu" value="${esc(p ? `${p.code} — ${p.name}` : B.q)}"></label>
            <datalist id="bn-products">${list.map(x => `<option value="${esc(x.code)} — ${esc(x.name)}">`).join('')}</datalist>
            ${img ? `<div class="bn-pick"><img src="${esc(img)}" alt=""><div><b>${esc(p.name)}</b><small>${esc(p.code)}</small></div></div>` : ''}</div></section>
        <section class="step"><div class="step-h"><span class="no">02</span><div><h2>Sahne</h2><p>Çantanın arkasına üretilecek ortam. Kendi tarifini yazarsan hazır sahne yerine o kullanılır.</p></div></div>
          <div class="step-b"><div class="chips" style="margin:0">${SCENES.map(([k, l]) => `<button class="chip" data-act="bnScene" data-k="${k}" aria-pressed="${B.scene === k && !B.custom.trim()}">${l}</button>`).join('')}</div>
            <label class="f"><span>Kendi tarifin (isteğe bağlı, İngilizce daha iyi sonuç verir)</span><textarea id="bncustom" rows="2" placeholder="ör. a velvet armchair in a luxury hotel lobby, warm evening light">${esc(B.custom)}</textarea></label></div></section>
        <section class="step"><div class="step-h"><span class="no">03</span><div><h2>${fk === 'kategori' ? 'Kategori' : 'Yazılar'}</h2><p>${fk === 'kategori' ? 'Kategori adı Qukasoft\'ta kutunun altına yazılır; önizleme içindir.' : 'Qukasoft bu yazıları görselin üstüne kendisi yazar; önizlemede nasıl duracağı görünür.'}</p></div></div>
          <div class="step-b bn-txt">
            <label class="f"><span>${fk === 'kategori' ? 'Kategori adı' : 'Başlık'}</span><input type="text" id="bntitle" value="${esc(B.title)}" placeholder="${fk === 'kategori' ? 'ör. SIRT VE DAĞCI ÇANTALARI' : 'ör. Yeni Sezon Sırt Çantaları'}"></label>
            ${fk === 'kategori' ? '' : `<label class="f"><span>Alt yazı</span><input type="text" id="bnsub" value="${esc(B.sub)}" placeholder="ör. Okul ve seyahat için yeni modeller"></label>
            <label class="f"><span>Düğme</span><input type="text" id="bnbtn" value="${esc(B.btn)}" placeholder="ör. İncele"></label>`}
            <label class="f"><span>Bağlantı</span><input type="url" id="bnlink" value="${esc(B.link)}" placeholder="ör. https://www.clkcanta.com/kolej-sirtlar"></label></div></section>
        <div class="chips" style="margin:0">${ENGINES.map(([k, l, c]) => `<button class="chip" data-act="bnEngine" data-k="${k}" aria-pressed="${B.engine === k}">${l} <b>${c}</b></button>`).join('')}</div>
        <div class="bn-acts"><button class="btn dark" data-act="bnMake" ${!img || B.busy ? 'disabled' : ''}>${B.busy ? esc(B.busy) : out ? 'Yeniden üret' : 'Görsel üret'}</button><span class="bn-cost">${fl} ${fw}×${fh} · ${engine()[1]} · görsel başı ${engine()[2]}</span></div>
      </div>
      <aside class="bn-prev"><div class="sum-card">
        <div class="bn-frame" style="aspect-ratio:${out ? `${fmt(out.format)[2]}/${fmt(out.format)[3]}` : `${fw}/${fh}`}">${out ? `<img src="${esc(out.preview)}" alt="Önizleme">` : `<div class="bn-empty">${img ? 'Önizleme burada görünecek' : 'Önce ürün seç'}</div>`}${out ? overlay(out.format) : ''}${B.busy ? `<div class="busy">${esc(B.busy)}</div>` : ''}</div>
        ${out ? `<p class="bn-note">${out.sandbox ? '<b>Deneme (filigranlı, ücretsiz).</b> ' : ''}${esc(fmt(out.format)[1])} ${fmt(out.format)[2]}×${fmt(out.format)[3]} · ${esc(out.engine || 'Photoroom')} · sahne: ${esc(out.scene)} · ${out.match ? `orijinal ürün yerleştirildi (eşleşme %${out.match})` : '<b>orijinal ürün yerleştirilemedi, logoyu kontrol et</b>'}</p>
          <div class="sum-acts"><button class="btn gold" data-act="bnApprove" ${out.sandbox || out.approved ? 'disabled' : ''}>${out.approved ? 'Onaylandı' : 'Onayla'}</button><button class="btn" data-act="bnDrop">Vazgeç</button></div>` : ''}
        ${B.approvals.length ? `<div class="bn-ok"><b>Onaylananlar</b><small>Qukasoft'a yüklenmeyi bekliyor. Claude'a "onaylananları yükle" deyin.</small>
          ${B.approvals.slice(0, 12).map(a => `<a class="bn-app" href="${esc(a.url)}" target="_blank" rel="noopener"><span>${esc(fmt(a.format)[1])}</span>${esc(a.title || 'Başlıksız')}</a>`).join('')}</div>` : ''}
      </div></aside>
    </div>`;
  };

  views.bind_banner = () => {
    const q = $('#bnq'); q?.addEventListener('change', () => { B.q = q.value; const code = q.value.split(' — ')[0].trim(); const p = S.products.find(x => String(x.code) === code); B.code = p ? p.code : ''; render(); });
    const bindTxt = (id, k, rerender) => $(id)?.addEventListener('input', e => { B[k] = e.target.value; if (rerender) { clearTimeout(bindTxt.t); bindTxt.t = setTimeout(() => { S.keepScroll = true; render(); }, 400); } });
    bindTxt('#bncustom', 'custom'); bindTxt('#bntitle', 'title', true); bindTxt('#bnsub', 'sub', true); bindTxt('#bnbtn', 'btn', true); bindTxt('#bnlink', 'link');
  };

  // Modele giden girdi: ürün biçimin boyutundaki beyaz tuvale biçimin yerleşimine göre konur. Model ürünü bu yerde bırakır
  // (Photoroom: referenceBox=originalImage; Seedream: "yerinde ve aynen bırak" istemi); boş kalan alan sahneye ve yazılara kalır.
  const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = () => no(new Error('Fotoğraf açılamadı.')); i.src = src; });
  // Dönüş: modele giden girdi (du) ve ürünün kaynak kesiti ile tuvaldeki yeri (geri yapıştırma için)
  async function placeBag(src, f) {
    const [, , W, H, L] = f, im = await loadImg(src), c0 = document.createElement('canvas'); c0.width = im.width; c0.height = im.height;
    const x0 = c0.getContext('2d'); x0.drawImage(im, 0, 0);
    const d = x0.getImageData(0, 0, im.width, im.height).data; let l = im.width, t = im.height, r = -1, b = -1;
    for (let y = 0; y < im.height; y += 2) for (let i = 0; i < im.width; i += 2) { const q = (y * im.width + i) * 4; if (d[q] < 235 || d[q + 1] < 235 || d[q + 2] < 235) { if (i < l) l = i; if (i > r) r = i; if (y < t) t = y; if (y > b) b = y; } }
    if (r < 0) { l = 0; t = 0; r = im.width - 1; b = im.height - 1; } // açık renkli ürün ayırt edilemezse tüm fotoğraf
    const bw = r - l + 1, bh = b - t + 1, s = Math.min(W * L.w / bw, H * L.h / bh), w = bw * s, h = bh * s;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(c0, l, t, bw, bh, W * L.cx - w / 2, H * L.bottom - h, w, h);
    return { du: c.toDataURL('image/jpeg', 0.92), geo: { c0, l, t, bw, bh, x: W * L.cx - w / 2, y: H * L.bottom - h, w, h } };
  }
  // Model logoyu ve küçük yazıları değiştirebiliyor (ör. valiz etiketi YEFA → VIP, doğrulandı) ve ürünü biraz büyütüp kaydırıyor.
  // Bu yüzden orijinal ürün dokusu sonuçta aranır (gri tonda maskeli normalize korelasyon; önce 1/8 çözünürlükte geniş, sonra 1/2'de dar)
  // ve bulunan yere orijinal pikseller yumuşak kenarlı maskeyle yapıştırılır. Eşleşme zayıfsa sonuç olduğu gibi kalır.
  async function restoreProduct(outDu, f, geo) {
    const [, , W, H] = f, out = await loadImg(outDu), O = document.createElement('canvas'); O.width = W; O.height = H;
    const ox = O.getContext('2d'); ox.drawImage(out, 0, 0, W, H);
    const grayOf = (cv, k) => { const w = Math.round(cv.width / k), h = Math.round(cv.height / k), t = document.createElement('canvas'); t.width = w; t.height = h; t.getContext('2d').drawImage(cv, 0, 0, w, h); const d = t.getContext('2d').getImageData(0, 0, w, h).data, g = new Float32Array(w * h); for (let i = 0; i < g.length; i++) g[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11; return { w, h, g }; };
    // Şablon: ürünün gri tonu ve maskesi (beyaz zemin dışı), verilen boyutta; nokta listesi (x, y, gri)
    const tpl = (pw, ph, step) => { const w = Math.max(4, Math.round(pw)), h = Math.max(4, Math.round(ph)), t = document.createElement('canvas'); t.width = w; t.height = h; const tx = t.getContext('2d'); tx.drawImage(geo.c0, geo.l, geo.t, geo.bw, geo.bh, 0, 0, w, h);
      const d = tx.getImageData(0, 0, w, h).data, pts = []; for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) { const q = (y * w + x) * 4; if (d[q] < 225 || d[q + 1] < 225 || d[q + 2] < 225) pts.push(x, y, d[q] * 0.3 + d[q + 1] * 0.59 + d[q + 2] * 0.11); } return { w, h, pts }; };
    const ncc = (G, T, px, py) => { let n = 0, sa = 0, saa = 0, st = 0, stt = 0, sat = 0; const p = T.pts;
      for (let q = 0; q < p.length; q += 3) { const x = px + p[q], y = py + p[q + 1]; if (x < 0 || y < 0 || x >= G.w || y >= G.h) return -1; const a = G.g[y * G.w + x], v = p[q + 2]; n++; sa += a; saa += a * a; st += v; stt += v * v; sat += a * v; }
      const va = saa - sa * sa / n, vt = stt - st * st / n; return n > 20 && va > 0 && vt > 0 ? (sat - sa * st / n) / Math.sqrt(va * vt) : -1; };
    let best = { s: -1 };
    const G8 = grayOf(O, 8);
    for (let sc = 0.8; sc <= 1.5; sc += 0.05) {
      const T = tpl(geo.w * sc / 8, geo.h * sc / 8, 1), cx = (geo.x + geo.w / 2) / 8, cy = (geo.y + geo.h / 2) / 8, rx = W * 0.2 / 8, ry = H * 0.2 / 8;
      for (let y = Math.round(cy - ry); y <= cy + ry; y++) for (let x = Math.round(cx - rx); x <= cx + rx; x++) { const s = ncc(G8, T, Math.round(x - T.w / 2), Math.round(y - T.h / 2)); if (s > best.s) best = { s, sc, cx: x * 8, cy: y * 8 }; }
    }
    const G2 = grayOf(O, 2), coarse = best; best = { s: -1 };
    for (let sc = coarse.sc - 0.05; sc <= coarse.sc + 0.05; sc += 0.01) {
      const T = tpl(geo.w * sc / 2, geo.h * sc / 2, 3);
      for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) { const x = Math.round(coarse.cx / 2) + dx, y = Math.round(coarse.cy / 2) + dy, s = ncc(G2, T, Math.round(x - T.w / 2), Math.round(y - T.h / 2)); if (s > best.s) best = { s, sc, cx: x * 2, cy: y * 2 }; }
    }
    if (!(best.s > 0.6)) return { du: outDu, score: best.s, pasted: false };
    // Yapıştırma: ürün kesiti bulunan boyutta, beyaz zemin maskesi 1,5 px yumuşatılmış
    const w = Math.round(geo.w * best.sc), h = Math.round(geo.h * best.sc), px = Math.round(best.cx - w / 2), py = Math.round(best.cy - h / 2);
    const P = document.createElement('canvas'); P.width = w; P.height = h; const pc = P.getContext('2d'); pc.drawImage(geo.c0, geo.l, geo.t, geo.bw, geo.bh, 0, 0, w, h);
    const pd = pc.getImageData(0, 0, w, h), M = document.createElement('canvas'); M.width = w; M.height = h; const mc = M.getContext('2d'), md = mc.createImageData(w, h);
    // Zemin sayılan: beyaz ya da açık renksiz gri (ürün fotoğrafındaki tekerlek/taban gölgesi; yapıştırılınca beyaz leke bırakıyordu)
    const bg = (r, g, b) => { const lo = Math.min(r, g, b), hi = Math.max(r, g, b); return lo >= 232 || (lo >= 170 && hi - lo < 20); };
    for (let q = 0; q < pd.data.length; q += 4) md.data[q + 3] = bg(pd.data[q], pd.data[q + 1], pd.data[q + 2]) ? 0 : 255;
    mc.putImageData(md, 0, 0); const soft = document.createElement('canvas'); soft.width = w; soft.height = h; const sc2 = soft.getContext('2d'); sc2.filter = 'blur(1.5px)'; sc2.drawImage(M, 0, 0);
    pc.globalCompositeOperation = 'destination-in'; pc.drawImage(soft, 0, 0);
    ox.drawImage(P, px, py);
    return { du: O.toDataURL('image/jpeg', 0.92), score: best.s, pasted: true };
  }
  CLK.bannerRestore = restoreProduct; // denemeler için
  // Sonuç biçimin tam boyutunda JPEG'e getirilir (Seedream daha büyük ama aynı oranda döner)
  async function fitTo(src, f) {
    const [, , W, H] = f, im = await loadImg(src), c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), s = Math.max(W / im.width, H / im.height), w = im.width * s, h = im.height * s;
    x.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); return c.toDataURL('image/jpeg', 0.92);
  }
  const fn = (t, body) => fetch('/.netlify/functions/ai-product-image', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.message || 'Görsel üretilemedi.'); return j; });
  async function make(sandbox, opts = {}) {
    const p = product(); if (!p) return toast('Önce ürün seç.');
    const eng = sandbox ? 'photoroom' : B.engine, f = fmt(); // sandbox yalnızca Photoroom'da var
    B.busy = sandbox ? 'Deneme üretiliyor…' : eng === 'fal' ? 'Seedream sahne üretiyor… (30-90 sn)' : 'Photoroom sahne üretiyor… (10-30 sn)'; S.keepScroll = true; render();
    try {
      const { data } = await sb.auth.getSession(); const t = data.session?.access_token; if (!t) throw new Error('Oturum kapandı. Yeniden giriş yap.');
      const scene = B.custom.trim() ? 'kendi tarif' : (SCENES.find(s => s[0] === B.scene) || SCENES[0])[1];
      const placed = await placeBag(P.img(p), f);
      let j = await fn(t, { action: 'banner', format: f[0], engine: eng, image: placed.du, prompt: promptText(), sandbox: !!sandbox, layout: opts.layout, model: opts.model });
      if (j.pending) { // fal.ai kuyruğu: 3 sn arayla sor (en çok ~3 dk)
        const job = j.job;
        for (let i = 0; i < 60 && j.pending; i++) { await new Promise(ok => setTimeout(ok, 3000)); j = await fn(t, { action: 'falResult', job }); }
        if (j.pending) throw new Error('Seedream zaman aşımı.');
      }
      if (!j.image) throw new Error(j.message || 'Görsel üretilemedi.');
      B.busy = 'Orijinal ürün yerleştiriliyor…'; render();
      const fixed = await restoreProduct(await fitTo(j.image, f), f, placed.geo);
      if (!fixed.pasted) toast('Ürün sonuçta bulunamadı, logo ve yazıları gözle kontrol et.');
      B.out = { preview: fixed.du, format: f[0], sandbox: !!j.sandbox, scene, code: p.code, engine: eng === 'fal' ? 'Seedream' : 'Photoroom', match: fixed.pasted ? Math.round(fixed.score * 100) : 0 };
    } catch (e) { toast(e.message); }
    B.busy = ''; S.keepScroll = true; render();
  }
  CLK.bannerTest = opts => make(true, opts); // ücretsiz, filigranlı deneme (Photoroom sandbox); arayüzde düğmesi yok. opts: { layout, model }
  async function approve() {
    const o = B.out; if (!o || o.sandbox) return;
    B.busy = 'Kaydediliyor…'; S.keepScroll = true; render();
    try {
      const path = `${S.user.id}/clk-yonetim/${o.format}-${crypto.randomUUID()}.jpg`;
      const blob = await fetch(o.preview).then(r => r.blob());
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false }); if (error) throw new Error('Görsel kaydedilemedi.');
      const { data, error: e2 } = await sb.storage.from(BUCKET).createSignedUrl(path, 604800); if (e2) throw new Error('Bağlantı oluşturulamadı.');
      o.approved = true;
      B.approved = { path, url: data.signedUrl, format: o.format, title: B.title, sub: o.format === 'kategori' ? '' : B.sub, btn: o.format === 'kategori' ? '' : B.btn, link: B.link, code: o.code, at: Date.now() };
      B.approvals = [B.approved, ...B.approvals].slice(0, 30);
      try { localStorage.setItem('clk-banner-approvals', JSON.stringify(B.approvals)); } catch {}
      toast('Görsel onaylandı.');
    } catch (e) { toast(e.message); }
    B.busy = ''; S.keepScroll = true; render();
  }

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'bnEngine') { B.engine = el.dataset.k; S.keepScroll = true; render(); }
    else if (act === 'bnFormat') { B.format = el.dataset.k; if (B.format === 'kategori' && !B.custom.trim()) B.scene = 'krem'; B.out = null; S.keepScroll = true; render(); }
    else if (act === 'bnScene') { B.scene = el.dataset.k; B.custom = ''; S.keepScroll = true; render(); }
    else if (act === 'bnMake') make(false);
    else if (act === 'bnApprove') approve();
    else if (act === 'bnDrop') { B.out = null; S.keepScroll = true; render(); }
    else prevAct?.(act, el, e);
  };
})();
