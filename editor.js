/* CLK Yönetim — ürün ekleme ve düzenleme */
(() => {
  const { S, $, $$, esc, tl, num, P, RULES, prices, hex12, call, loadCategories, head, views, go, render, sb, toast } = CLK;
  const BUCKET = 'product-images';
  const COLORS = [['SİYAH','#151515'],['LACİVERT','#1f2a44'],['GRİ','#8b9097'],['FÜME','#4a4d52'],['BEJ','#d9c6a8'],['KAHVE','#5b3f2a'],['TABA','#a2642f'],['KIRMIZI','#b2271f'],['BORDO','#6c1b2a'],['PEMBE','#e8a3b6'],['PUDRA','#e9c9c0'],['MOR','#6a4c93'],['MAVİ','#2f6db5'],['YEŞİL','#2e7d4f'],['HAKİ','#6b6b3a'],['TURUNCU','#e07a1f'],['SARI','#e9c440'],['BEYAZ','#f6f6f4'],['KREM','#efe6d2']];
  const SLOTS = [['front','Ön','Tam karşıdan, çanta ortada'],['model','Manken','Ön çekimden otomatik üretilir'],['back','Arka','Arka yüz ve askılar'],['side','Yan','Derinliği gösteren açı'],['detail','Detay','Logo, fermuar, dikiş'],['inside','İç','Bölmeler açık'],['extra','Ek','İsteğe bağlı']];
  const MARKETS = ['n11','hb','ty','cs','amz','eptt','ms','paz','far','idef','lcw','temu'];
  const hexOf = n => (COLORS.find(c => c[0] === String(n).toLocaleUpperCase('tr')) || [0, '#ddd'])[1];

  let D = null; // taslak
  function blank() {
    return { isNew: true, code: hex12('CLK-'), name: '', barcode: '', brand: 'CLK', categoryId: '', categoryName: '', shortDescription: '', longDescription: '', active: true,
      buyPrice: '', listPrice: '', salePrice: '', fastSalePrice: '', dealerPrice1: '', dealerPrice2: '', dealerPrice3: '', taxRate: RULES.kdv, shipmentPayment: 0,
      desi: RULES.desi, quantity: RULES.stock, variants: [], w: '', d: '', h: '', material: '', shots: {}, auto: { cutout: true, mark: true } };
  }
  function fromProduct(p) {
    const imgs = P.imgs(p), shots = {};
    imgs.forEach((u, i) => { shots[(SLOTS[i] || ['x' + i])[0]] = { url: u, existing: true }; });
    return { isNew: false, code: p.code, name: p.name || '', barcode: p.barcode || '', brand: p.brand || '', categoryId: p.categoryId ?? p.categoryID ?? '', categoryName: P.path(p),
      shortDescription: p.shortDescription || '', longDescription: p.longDescription || '', active: P.on(p),
      buyPrice: p.buyPrice ?? '', listPrice: p.listPrice ?? '', salePrice: p.salePrice ?? '', fastSalePrice: p.fastSalePrice ?? '', dealerPrice1: p.dealerPrice1 ?? '', dealerPrice2: p.dealerPrice2 ?? '', dealerPrice3: p.dealerPrice3 ?? '',
      taxRate: Number(p.taxRate ?? RULES.kdv), shipmentPayment: Number(p.shipmentPayment) || 0, desi: p.desi ?? RULES.desi, quantity: P.qty(p),
      variants: (Array.isArray(p.variants) ? p.variants : []).map(v => ({ v: [v.value1, v.value2, v.value3].filter(Boolean).join(' / '), b: v.barcode || '', q: Number(v.quantity) || 0 })),
      w: '', d: '', h: '', material: '', shots, auto: { cutout: true, mark: true } };
  }
  function ensure() {
    const key = S.route === 'yeni' ? 'new' : 'e:' + S.arg;
    if (D && D._key === key) return true;
    if (S.route === 'yeni') { D = blank(); D._key = key; return true; }
    const p = S.products.find(x => String(x.code) === String(S.arg)); if (!p) return false;
    D = fromProduct(p); D._key = key; return true;
  }

  /* ---------- görünüm ---------- */
  const fld = (label, html, cls = '') => `<label class="f ${cls}"><span>${label}</span>${html}</label>`;
  const inp = (k, attrs = '') => `<input type="text" data-k="${k}" value="${esc(D[k] ?? '')}" ${attrs}>`;
  const ninp = (k, attrs = '') => `<input type="number" inputmode="decimal" step="0.01" data-k="${k}" value="${esc(D[k] ?? '')}" ${attrs}>`;
  const isValiz = () => /VAL[İI]Z/i.test(D.categoryName || '');
  function checks() {
    const c = [['Ürün adı', !!D.name.trim()], ['Kategori', !!D.categoryId || !D.isNew], ['Alış ve satış fiyatı', +D.buyPrice > 0 && +D.salePrice > 0], ['Renk ve stok', D.variants.length > 0 || +D.quantity >= 0], ['Ön fotoğraf', !!D.shots.front], ['En az 4 fotoğraf', Object.keys(D.shots).length >= 4]];
    return c;
  }
  function galleryList() {
    if (!D) return [];
    const order = SLOTS.map(x => x[0]).concat(Object.keys(D.shots).filter(k => !SLOTS.some(x => x[0] === k)));
    return order.map(k => ({ k, t: (SLOTS.find(x => x[0] === k) || [0, 'Görsel'])[1], src: D.shots[k]?.preview || D.shots[k]?.url })).filter(x => x.src);
  }
  function openGallery(i) {
    const list = galleryList(); if (!list.length) return;
    let cur = Math.max(0, Math.min(i, list.length - 1));
    const box = document.createElement('div'); box.className = 'gal'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    const draw = () => {
      const it = list[cur];
      box.innerHTML = `<div class="gal-top"><span>${esc(it.t)} · ${cur + 1}/${list.length}</span><div><a class="btn sm" href="${esc(it.src.startsWith('data:') ? '#' : it.src)}" target="_blank" rel="noopener" ${it.src.startsWith('data:') ? 'hidden' : ''}>Yeni sekmede aç</a><button class="btn sm dark" data-g="x">Kapat</button></div></div>
        <div class="gal-main"><button class="gal-nav" data-g="p" aria-label="Önceki" ${list.length < 2 ? 'hidden' : ''}>‹</button><img src="${esc(it.src)}" alt="${esc(it.t)}"><button class="gal-nav" data-g="n" aria-label="Sonraki" ${list.length < 2 ? 'hidden' : ''}>›</button></div>
        <div class="gal-strip">${list.map((x, j) => `<button data-g="${j}" class="${j === cur ? 'on' : ''}"><img src="${esc(x.src)}" alt=""></button>`).join('')}</div>`;
    };
    const close = () => { box.remove(); document.removeEventListener('keydown', key); };
    const key = e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') { cur = (cur + 1) % list.length; draw(); } if (e.key === 'ArrowLeft') { cur = (cur - 1 + list.length) % list.length; draw(); } };
    box.addEventListener('click', e => { const g = e.target.closest('[data-g]'); if (!g) { if (e.target === box) close(); return; } const v = g.dataset.g;
      if (v === 'x') close(); else if (v === 'n') cur = (cur + 1) % list.length; else if (v === 'p') cur = (cur - 1 + list.length) % list.length; else cur = +v; if (v !== 'x') draw(); });
    let sx = 0; box.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) { cur = (cur + (dx < 0 ? 1 : -1) + list.length) % list.length; draw(); } });
    document.addEventListener('keydown', key); draw(); document.body.append(box);
  }
  views.yeni = views.duzenle = () => {
    if (!ensure()) return head('Ürün', 'Yükleniyor…', '', `<button class="btn sm" data-go="urunler">← Ürünler</button>`) + CLK.skel();
    if (!S.categories.length) loadCategories().then(() => render());
    const cats = S.categories;
    const cover = D.shots.front?.preview || D.shots.front?.url || Object.values(D.shots)[0]?.preview || Object.values(D.shots)[0]?.url || '';
    const totalQ = D.variants.length ? D.variants.reduce((a, v) => a + (+v.q || 0), 0) : +D.quantity || 0;
    const ck = checks(), ready = ck.filter(x => x[1]).length;
    const actions = `<button class="btn dark" data-act="edSend">${D.isNew ? 'Qukasoft’a yükle' : 'Qukasoft’ta güncelle'}</button><button class="btn" data-act="edDraft">Taslak kaydet</button>`;
    return head(D.isNew ? 'Yeni ürün' : 'Ürünü düzenle', D.isNew ? 'Ürün ekle' : esc(D.name || D.code), D.isNew ? 'Fotoğrafla, alış fiyatını gir, gerisini sistem hesaplasın.' : esc(D.code) + ' · Qukasoft’taki kayıt güncellenir', `<button class="btn sm" data-go="${D.isNew ? 'panel' : 'urunler'}">← Geri</button>`) + `
    <div class="ed"><div class="steps">
      <section class="step"><div class="step-h"><span class="no">01</span><div><h2>Fotoğraflar</h2><p>Telefonla çek ya da galeriden seç. Arka plan temizlenir, 1200×1200 kare ve CLK filigranlı hazırlanır.</p></div>${galleryList().length ? `<button class="btn sm" data-act="edGallery" data-i="0" style="margin-left:auto">Görselleri aç (${galleryList().length})</button>` : ''}</div>
        <div class="step-b"><div class="shots">${SLOTS.map(([k, t, h]) => shot(k, t, h)).join('')}</div>
          <div class="row-opts"><label class="toggle"><input type="checkbox" data-auto="cutout" ${D.auto.cutout ? 'checked' : ''}> Otomatik dekupe</label><label class="toggle"><input type="checkbox" data-auto="mark" ${D.auto.mark ? 'checked' : ''}> CLK filigranı</label></div></div></section>
      <section class="step"><div class="step-h"><span class="no">02</span><div><h2>Ürün bilgileri</h2><p>Sitede ve faturada görünecek bilgiler</p></div></div>
        <div class="step-b"><div class="fg">
          ${fld('Ürün adı <em>*</em>', inp('name', 'placeholder="ör. West Polo 7041 El Çantası"'), 'full')}
          ${fld('Kategori', `<select data-k="categoryId"><option value="">${cats.length ? 'Kategori seç' : (D.categoryName || 'Yükleniyor…')}</option>${cats.map(c => `<option value="${c.id}" ${String(c.id) === String(D.categoryId) ? 'selected' : ''}>${esc(c.path)}</option>`).join('')}</select>`)}
          ${fld('Marka', inp('brand'))}
          ${fld('Ürün kodu', `<div class="inline">${inp('code', D.isNew ? '' : 'readonly')}${D.isNew ? '<button class="btn sm" data-act="edCode">Yenile</button>' : ''}</div>`)}
          ${fld('Barkod', inp('barcode', 'placeholder="Varsa üretici barkodu"'))}
          ${fld('Kısa açıklama', inp('shortDescription', 'placeholder="Listelerde görünen tek cümle"'), 'full')}
          <div class="f full"><span>Ürün açıklaması</span><textarea data-k="longDescription" rows="5" placeholder="Malzeme, bölmeler, askı, kullanım…">${esc(D.longDescription)}</textarea><button class="btn sm" data-act="edDesc" style="justify-self:start">Bilgilerden açıklama yaz</button></div>
          ${fld('En (cm)', ninp('w'))}${fld('Boy (cm)', ninp('d'))}${fld('Yükseklik (cm)', ninp('h'))}${fld('Malzeme', inp('material', 'placeholder="ör. Suni deri"'))}
          <label class="toggle full"><input type="checkbox" data-k="active" ${D.active ? 'checked' : ''}> Sitede yayında</label>
        </div></div></section>
      <section class="step"><div class="step-h"><span class="no">03</span><div><h2>Fiyatlar</h2><p>Alış fiyatını gir; diğerleri kurallara göre dolar, istersen değiştir.</p></div></div>
        <div class="step-b"><div class="calc"><span>Piyasa alışın ${RULES.market}, satış ${RULES.retail} katı (49/99 ile biter) · Hızlı satış ve Bayi 1 %${RULES.d1} · Bayi 2 %${RULES.d2} · Bayi 3 %${RULES.d3}</span><button class="btn sm dark" data-act="edCalc">Yeniden hesapla</button></div>
          <div class="prices">${fld('Alış', ninp('buyPrice', 'placeholder="0"'), 'hl')}${fld('Piyasa', ninp('listPrice'))}${fld('Satış', ninp('salePrice'), 'hl')}${fld('Hızlı satış', ninp('fastSalePrice'))}${fld('Bayi 1', ninp('dealerPrice1'))}${fld('Bayi 2', ninp('dealerPrice2'))}${fld('Bayi 3', ninp('dealerPrice3'))}
            ${fld('KDV', `<select data-k="taxRate">${[0, 1, 10, 20].map(v => `<option value="${v}" ${+D.taxRate === v ? 'selected' : ''}>%${v}</option>`).join('')}</select>`)}
            ${fld('Kargo', `<select data-k="shipmentPayment"><option value="0" ${!+D.shipmentPayment ? 'selected' : ''}>Alıcı öder</option><option value="1" ${+D.shipmentPayment ? 'selected' : ''}>Satıcı öder</option></select>`)}</div>
          <p class="hint">Pazaryeri fiyatları satış fiyatından otomatik alınır. Kâr: <b>${+D.salePrice && +D.buyPrice ? tl(D.salePrice - D.buyPrice) + ' · %' + Math.round((1 - D.buyPrice / D.salePrice) * 100) : '—'}</b></p></div></section>
      <section class="step"><div class="step-h"><span class="no">04</span><div><h2>Renk ve stok</h2><p>Renge dokun: barkod ve ${RULES.stock} adet stok otomatik atanır</p></div></div>
        <div class="step-b"><div class="swatches">${COLORS.map(([n, h]) => `<button class="sw" data-color="${n}" aria-pressed="${D.variants.some(v => v.v === n)}"><i style="background:${h}"></i>${n}</button>`).join('')}</div>
          ${D.variants.length ? `<div class="vrows">${D.variants.map((v, i) => `<div class="vrow" data-i="${i}"><i style="background:${hexOf(v.v)}"></i><input type="text" data-vk="v" value="${esc(v.v)}" aria-label="Renk"><input type="text" class="bc" data-vk="b" value="${esc(v.b)}" aria-label="Barkod"><input type="number" inputmode="numeric" data-vk="q" value="${esc(v.q)}" aria-label="Stok"><button data-act="edVdel" data-i="${i}" aria-label="Sil">×</button></div>`).join('')}</div>` : `<div class="fg">${fld('Stok adedi (renksiz)', ninp('quantity'))}</div>`}
          <div class="fg three">${fld('Desi', ninp('desi'))}<div class="f"><span>Toplam stok</span><input type="text" value="${num(totalQ)}" readonly></div><div class="f"><span>Kritik stok</span><input type="text" value="${RULES.critical}" readonly></div></div></div></section>
    </div>
    <aside class="summary"><div class="sum-card"><div class="cover" ${cover ? 'data-act="edGallery" data-i="0" style="cursor:zoom-in"' : ''}>${cover ? `<img src="${esc(cover)}" alt="">` : 'CLK'}</div>${galleryList().length ? `<button class="btn gold" data-act="edGallery" data-i="0">Görselleri aç (${galleryList().length})</button>` : ''}
      <h3>${esc(D.name || 'Adsız ürün')}</h3>
      <dl><dt>Satış</dt><dd>${D.salePrice ? tl(D.salePrice) : '—'}</dd><dt>Bayi 1</dt><dd>${D.dealerPrice1 ? tl(D.dealerPrice1) : '—'}</dd><dt>Stok</dt><dd>${num(totalQ)} adet</dd><dt>Renk</dt><dd>${D.variants.length || '—'}</dd><dt>Fotoğraf</dt><dd>${Object.keys(D.shots).length}/7</dd></dl>
      <ul class="checklist">${ck.map(([l, ok]) => `<li class="${ok ? 'ok' : ''}">${l}</li>`).join('')}</ul>
      <div id="ed-msg"></div><div class="sum-acts">${actions}</div></div></aside></div>
    <div class="ed-bar">${actions}</div>`;
  };
  function shot(k, t, h) {
    const s = D.shots[k], src = s?.preview || s?.url;
    const isModel = k === 'model';
    return `<div class="shot ${src ? 'has' : ''}"><span class="lb ${isModel ? 'auto' : ''}">${t}</span>
      ${src ? `<img src="${esc(src)}" alt="${t}">` : `<div class="empty-s">${CLK.ICONS.cam}<b>${t}</b><span>${h}</span></div>`}
      ${s?.busy ? `<div class="busy">${esc(s.busy)}</div>` : ''}
      ${src ? `<div class="ops">${isModel ? `<button data-act="edModel">Yeniden</button>` : `<button data-act="edCut" data-k="${k}">Dekupe</button>`}<button class="x" data-act="edShotDel" data-k="${k}">Sil</button></div>` :
        isModel ? `<div class="ops"><button data-act="edModel" ${D.shots.front ? '' : 'disabled'}>Manken üret</button></div>` : `<label><input type="file" accept="image/*" capture="environment" data-shot="${k}" hidden></label>`}</div>`;
  }

  /* ---------- görsel hazırlama ---------- */
  const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const fileUrl = f => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); });
  async function square(src, mark) {
    const im = await loadImg(src), N = 1200, c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, N, N);
    const s = Math.min(N * 0.92 / im.width, N * 0.92 / im.height); const w = im.width * s, h = im.height * s;
    x.drawImage(im, (N - w) / 2, (N - h) / 2, w, h);
    if (mark) { x.save(); x.globalAlpha = 0.18; x.fillStyle = '#121110'; x.font = '600 54px "Playfair Display", Georgia, serif'; x.textAlign = 'right'; x.textBaseline = 'bottom'; x.letterSpacing = '12px'; x.fillText('CLK', N - 40, N - 34); x.restore(); }
    return c.toDataURL('image/jpeg', 0.9);
  }
  const toBlob = du => fetch(du).then(r => r.blob());
  async function upload(du) {
    const uid = S.user.id, path = `${uid}/clk-yonetim/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from(BUCKET).upload(path, await toBlob(du), { contentType: 'image/jpeg', upsert: false });
    if (error) throw new Error('Fotoğraf yüklenemedi.');
    return path;
  }
  async function aiImage(du, action) {
    const j = await call('ai-product-image', { method: 'POST', body: { action, image: du } });
    if (!j.image) throw new Error('Görsel hazırlanamadı.'); return j.image;
  }
  async function processShot(k, raw) {
    const s = (D.shots[k] = { preview: raw, busy: 'Hazırlanıyor…' }); render();
    try {
      let base = await square(raw, false);
      if (D.auto.cutout) { s.busy = 'Arka plan temizleniyor…'; render(); try { base = await aiImage(base, 'cutout'); } catch (e) { toast('Dekupe yapılamadı, orijinal kullanıldı.'); } }
      const final = await square(base, D.auto.mark); s.preview = final; s.raw = raw; s.busy = 'Yükleniyor…'; render();
      s.path = await upload(final); delete s.busy; delete s.url; delete s.existing;
      if (k === 'front' && !D.shots.model) makeModel();
    } catch (e) { s.busy = ''; toast(e.message); }
    render();
  }
  async function makeModel() {
    const f = D.shots.front; if (!f) return toast('Önce ön fotoğrafı ekle.');
    const s = (D.shots.model = { busy: 'Manken pozu üretiliyor… (1-2 dk)' }); render();
    try {
      const src = f.preview || f.url; const base = src.startsWith('data:') ? src : await square(src, false);
      const img = await aiImage(base.startsWith('data:') ? base : await square(base, false), 'model');
      s.preview = await square(img, D.auto.mark); s.busy = 'Yükleniyor…'; render(); s.path = await upload(s.preview); delete s.busy;
    } catch (e) { delete D.shots.model; toast('Manken görseli üretilemedi: ' + e.message); }
    render();
  }

  /* ---------- kaydetme ---------- */
  function buildProduct(urls) {
    const n = v => (v === '' || v === null || v === undefined ? undefined : Number(v));
    const desc = D.longDescription || autoDesc();
    const p = { code: D.code.trim(), name: D.name.trim(), status: D.active ? 1 : 0, brand: D.brand || undefined, barcode: D.barcode || undefined,
      shortDescription: D.shortDescription || undefined, longDescription: desc || undefined, taxRate: +D.taxRate, currency: 'TL', shipmentPayment: +D.shipmentPayment ? 1 : 0,
      buyPrice: n(D.buyPrice), listPrice: n(D.listPrice), salePrice: n(D.salePrice), fastSalePrice: n(D.fastSalePrice), dealerPrice1: n(D.dealerPrice1), dealerPrice2: n(D.dealerPrice2), dealerPrice3: n(D.dealerPrice3),
      desi: n(D.desi), type: 0, criticalStockStatus: 1, criticalStockQuantity: RULES.critical };
    if (D.categoryId) p.categoryId = Number(D.categoryId);
    if (D.variants.length) { p.variant1Name = 'Renk'; p.variants = D.variants.map(v => ({ value1: v.v, barcode: v.b || hex12('CLK-V-'), quantity: +v.q || 0, priceStatus: 0, price: 0 })); p.quantity = p.variants.reduce((a, v) => a + v.quantity, 0); }
    else p.quantity = +D.quantity || 0;
    if (p.salePrice) p.marketplacePrices = MARKETS.map(type => ({ type, currency: 'TL', price: p.salePrice }));
    if (urls.length) p.images = urls.map(imageUrl => ({ imageUrl }));
    Object.keys(p).forEach(k => p[k] === undefined && delete p[k]);
    return p;
  }
  function autoDesc() {
    const parts = [];
    if (D.name) parts.push(`${D.name}${D.brand ? ', ' + D.brand + ' kalitesiyle' : ''} günlük kullanım için tasarlandı.`);
    if (D.material) parts.push(`Malzeme: ${D.material}.`);
    if (+D.w || +D.d || +D.h) parts.push(`Ölçüler: ${[D.w && 'En ' + D.w + ' cm', D.d && 'Boy ' + D.d + ' cm', D.h && 'Yükseklik ' + D.h + ' cm'].filter(Boolean).join(' · ')}.`);
    if (D.variants.length) parts.push(`Renk seçenekleri: ${D.variants.map(v => v.v.toLocaleLowerCase('tr')).join(', ')}.`);
    return parts.join(' ');
  }
  async function send(btn) {
    const msg = $('#ed-msg'); const say = (t, ok) => { msg.innerHTML = `<div class="msg ${ok ? 'ok' : 'err'}">${esc(t)}</div>`; };
    const probs = []; if (!D.name.trim()) probs.push('Ürün adı'); if (!(+D.salePrice > 0)) probs.push('Satış fiyatı'); if (D.isNew && !D.categoryId) probs.push('Kategori');
    if (Object.values(D.shots).some(s => s.busy)) return say('Fotoğraflar hazırlanırken bekle.');
    if (probs.length) return say('Eksik: ' + probs.join(', '));
    $$('[data-act="edSend"]').forEach(b => { b.disabled = true; b.textContent = 'Gönderiliyor…'; });
    try {
      const order = SLOTS.map(s => s[0]).concat(Object.keys(D.shots).filter(k => !SLOTS.some(s => s[0] === k)));
      const urls = [];
      for (const k of order) { const s = D.shots[k]; if (!s) continue; if (s.path) { const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(s.path, 604800); if (error) throw new Error('Fotoğraf bağlantısı oluşturulamadı.'); urls.push(data.signedUrl); } else if (s.url) urls.push(s.url); }
      const j = await call('qukasoft-product-save', { method: 'POST', body: { product: buildProduct(urls) } });
      say(j.message || 'Qukasoft’a gönderildi.', true); toast(D.isNew ? 'Ürün Qukasoft’a yüklendi' : 'Ürün güncellendi');
      CLK.loadProducts(true);
    } catch (e) { say(e.message); }
    $$('[data-act="edSend"]').forEach(b => { b.disabled = false; b.textContent = D.isNew ? 'Qukasoft’a yükle' : 'Qukasoft’ta güncelle'; });
  }
  async function saveDraft() {
    const data = JSON.parse(JSON.stringify(D)); Object.values(data.shots || {}).forEach(s => { delete s.preview; delete s.raw; delete s.busy; });
    const paths = Object.values(D.shots).map(s => s.path).filter(Boolean);
    const row = { product_name: D.name || 'Adsız ürün', data: { ...data, _source: 'clk-yonetim' }, image_paths: paths, updated_at: new Date().toISOString() };
    const q = D.draftId ? sb.from('product_drafts').update(row).eq('id', D.draftId).select('id').single() : sb.from('product_drafts').insert(row).select('id').single();
    const { data: r, error } = await q; if (error) return toast('Taslak kaydedilemedi.');
    D.draftId = r.id; toast('Taslak kaydedildi');
  }

  /* ---------- etkileşim ---------- */
  views.bind_yeni = views.bind_duzenle = () => {
    if (!D) return;
    $$('[data-k]').forEach(el => {
      const k = el.dataset.k, ev = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input';
      el.addEventListener(ev, () => {
        if (el.type === 'checkbox') D[k] = el.checked; else D[k] = el.value;
        if (k === 'categoryId') { const c = S.categories.find(x => String(x.id) === el.value); D.categoryName = c?.path || ''; if (D.isNew) D.desi = isValiz() ? RULES.desiValiz : RULES.desi; S.keepScroll = true; render(); }
        if (k === 'buyPrice' && +el.value > 0) { Object.entries(prices(el.value)).forEach(([pk, v]) => { const map = { market: 'listPrice', retail: 'salePrice', quick: 'fastSalePrice', d1: 'dealerPrice1', d2: 'dealerPrice2', d3: 'dealerPrice3' }; D[map[pk]] = v; const f = document.querySelector(`[data-k="${map[pk]}"]`); if (f) f.value = v; }); }
        if (['name', 'salePrice', 'buyPrice', 'dealerPrice1'].includes(k)) { clearTimeout(el.t); el.t = setTimeout(() => { S.keepScroll = true; render(); }, 600); }
      });
    });
    $$('[data-vk]').forEach(el => el.addEventListener('input', () => { const i = +el.closest('.vrow').dataset.i; const k = el.dataset.vk; D.variants[i][k] = k === 'q' ? (+el.value || 0) : el.value.toLocaleUpperCase('tr'); }));
    $$('[data-auto]').forEach(el => el.addEventListener('change', () => { D.auto[el.dataset.auto] = el.checked; }));
    $$('[data-shot]').forEach(el => el.addEventListener('change', async () => { const f = el.files[0]; if (!f) return; processShot(el.dataset.shot, await fileUrl(f)); }));
    $$('[data-color]').forEach(b => b.addEventListener('click', () => {
      const n = b.dataset.color, i = D.variants.findIndex(v => v.v === n);
      if (i >= 0) D.variants.splice(i, 1); else D.variants.push({ v: n, b: hex12('CLK-V-'), q: RULES.stock });
      S.keepScroll = true; render();
    }));
  };
  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (!act.startsWith('ed')) return prevAct?.(act, el, e);
    if (act === 'edCalc') { if (!(+D.buyPrice > 0)) return toast('Önce alış fiyatını gir'); const r = prices(D.buyPrice); Object.assign(D, { listPrice: r.market, salePrice: r.retail, fastSalePrice: r.quick, dealerPrice1: r.d1, dealerPrice2: r.d2, dealerPrice3: r.d3 }); S.keepScroll = true; render(); }
    else if (act === 'edCode') { D.code = hex12('CLK-'); S.keepScroll = true; render(); }
    else if (act === 'edDesc') { D.longDescription = autoDesc(); S.keepScroll = true; render(); }
    else if (act === 'edVdel') { D.variants.splice(+el.dataset.i, 1); S.keepScroll = true; render(); }
    else if (act === 'edShotDel') { delete D.shots[el.dataset.k]; S.keepScroll = true; render(); }
    else if (act === 'edCut') { const s = D.shots[el.dataset.k]; if (!s) return; const was = D.auto.cutout; D.auto.cutout = true; const src = s.raw || s.preview || s.url; (src.startsWith('data:') ? Promise.resolve(src) : square(src, false)).then(du => processShot(el.dataset.k, du)).finally(() => { D.auto.cutout = was; }); }
    else if (act === 'edModel') makeModel();
    else if (act === 'edGallery') openGallery(+el.dataset.i || 0);
    else if (act === 'edSend') send(el);
    else if (act === 'edDraft') saveDraft();
  };
})();
