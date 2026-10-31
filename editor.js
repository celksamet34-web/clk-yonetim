/* CLK Yönetim — ürün ekleme ve düzenleme */
(() => {
  const { S, $, $$, esc, tl, num, P, RULES, prices, hex12, call, loadCategories, head, views, go, render, sb, toast } = CLK;
  const BUCKET = 'product-images';
  const COLORS = [['SİYAH','#151515'],['LACİVERT','#1f2a44'],['GRİ','#8b9097'],['FÜME','#4a4d52'],['BEJ','#d9c6a8'],['KAHVE','#5b3f2a'],['TABA','#a2642f'],['KIRMIZI','#b2271f'],['BORDO','#6c1b2a'],['PEMBE','#e8a3b6'],['PUDRA','#e9c9c0'],['MOR','#6a4c93'],['MAVİ','#2f6db5'],['YEŞİL','#2e7d4f'],['HAKİ','#6b6b3a'],['TURUNCU','#e07a1f'],['SARI','#e9c440'],['BEYAZ','#f6f6f4'],['KREM','#efe6d2']];
  const SLOTS = [['front','Ön','Tam karşıdan, çanta ortada'],['model','Manken','Ön çekimden otomatik üretilir'],['back','Arka','Arka yüz ve askılar'],['side','Yan','Derinliği gösteren açı'],['detail','Detay','Logo, fermuar, dikiş'],['inside','İç','Bölmeler açık'],['extra','Ek','İsteğe bağlı']];
  const MARKETS = ['n11','hb','ty','cs','amz','eptt','ms','paz','far','idef','lcw','temu'];
  const AUDIENCES = [['kadin','Kadın'],['erkek','Erkek'],['kiz-cocuk','Kız çocuk'],['erkek-cocuk','Erkek çocuk']];
  const HEIGHTS = { kadin: 170, erkek: 182, 'kiz-cocuk': 135, 'erkek-cocuk': 138 }; // sunucudaki manken boylarıyla aynı
  const CARRIES = [['capraz','Çapraz / göğüs'],['omuz','Omuz'],['el','Elde (yakın çekim)'],['sirt','Sırt']];
  const mHeight = () => (+D.mh >= 80 && +D.mh <= 220 ? +D.mh : HEIGHTS[D.audience]);
  const hexOf = n => (COLORS.find(c => c[0] === String(n).toLocaleUpperCase('tr')) || [0, '#ddd'])[1];

  // Qukasoft ölçüleri ürün özelliği (attribute) olarak tutuyor: En, Yükseklik, Boy (= derinlik)
  const DIM_ATTR = { w: 'En', h: 'Yükseklik', d: 'Boy' };
  const MATERIAL_ATTR = 'Malzeme', WATER_ATTR = 'Su Geçirmez';
  // Panelin kendi alanlarına karşılık gelmeyen Qukasoft alanları (yeni üründe boş, düzenlemede üründen gelir)
  const extra = (p = {}) => ({ invoiceName: p.invoiceName || '', modelCode: p.modelCode || '', mpn: p.mpn || '', dealerPrice4: p.dealerPrice4 ?? '',
    domestic: p.domestic === undefined ? true : Number(p.domestic) === 1, showcase: p.showcaseStatus === undefined ? true : Number(p.showcaseStatus) === 1, seq: p.seq ?? 0,
    specialCode1: p.specialCode1 || '', specialCode2: p.specialCode2 || '', specialCode3: p.specialCode3 || '',
    seoTitle: p.seoTitle || '', seoDescription: p.seoDescription || '', seoKeywords: p.seoKeywords || '', slug: p.slug || '',
    id: p.id || '', videoText: p.videoText || '', unitId: p.unitId || 1,
    // İlişkili ürünler ayrı Qukasoft işlemleriyle kaydedilir; yalnızca değiştirilenler (touched) gönderilir
    similars: [], combines: [], compat: {}, rel: { sim: false, comb: false, combLoaded: false, grp: false },
    // Ürün grubu (ilişkili ürünler): aynı modelin renk/boyut gibi ayrı ürünlerini seçenek adıyla bağlar; bu ürün de grubun üyesidir
    group: { name: '', items: [] } });

  let D = null; // taslak
  function blank() {
    return { isNew: true, code: hex12('CLK-'), name: '', barcode: '', brand: 'CLK', categoryId: '', categoryName: '', shortDescription: '', longDescription: '', active: true,
      buyPrice: '', listPrice: '', salePrice: '', fastSalePrice: '', dealerPrice1: '', dealerPrice2: '', dealerPrice3: '', taxRate: RULES.kdv, shipmentPayment: 0,
      desi: RULES.desi, quantity: RULES.stock, critical: RULES.critical, variants: [], w: '', d: '', h: '', material: '', attrs: [], ...extra(),
      shots: {}, audience: 'kadin', carry: 'capraz', mh: '', waterproof: false, auto: { cutout: true, mark: true } };
  }
  function fromProduct(p) {
    const imgs = P.imgs(p), shots = {};
    imgs.forEach((u, i) => { shots[(SLOTS[i] || ['x' + i])[0]] = { url: u, existing: true }; });
    const at = (Array.isArray(p.attributes) ? p.attributes : []).map(a => ({ n: String(a.name || ''), v: String(a.value ?? '') })).filter(a => a.n);
    const take = name => { const i = at.findIndex(a => a.n.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr')); return i < 0 ? '' : at.splice(i, 1)[0].v; };
    const num = v => String(v).replace(',', '.').match(/\d+(\.\d+)?/)?.[0] || '';
    const w = num(take(DIM_ATTR.w)), h = num(take(DIM_ATTR.h)), d = num(take(DIM_ATTR.d)), material = take(MATERIAL_ATTR), water = take(WATER_ATTR);
    return { isNew: false, code: p.code, name: p.name || '', barcode: p.barcode || '', brand: p.brand || '', categoryId: p.categoryId ?? p.categoryID ?? '', categoryName: P.path(p),
      shortDescription: p.shortDescription || '', longDescription: p.longDescription || '', active: P.on(p),
      buyPrice: p.buyPrice ?? '', listPrice: p.listPrice ?? '', salePrice: p.salePrice ?? '', fastSalePrice: p.fastSalePrice ?? '', dealerPrice1: p.dealerPrice1 ?? '', dealerPrice2: p.dealerPrice2 ?? '', dealerPrice3: p.dealerPrice3 ?? '',
      taxRate: Number(p.taxRate ?? RULES.kdv), shipmentPayment: Number(p.shipmentPayment) || 0, desi: p.desi ?? RULES.desi, quantity: P.qty(p), critical: P.crit(p),
      variants: (Array.isArray(p.variants) ? p.variants : []).map(v => ({ v: [v.value1, v.value2, v.value3].filter(Boolean).join(' / '), b: v.barcode || '', q: Number(v.quantity) || 0 })),
      w, d, h, material, attrs: at, ...extra(p),
      shots, audience: 'kadin', carry: 'capraz', mh: '', waterproof: /^(evet|var|1|true)$/i.test(water), auto: { cutout: true, mark: true } };
  }
  // Qukasoft ek işlemleri (bu sitenin qukasoft fonksiyonu üzerinden). Qukasoft aynı anda gelen istekleri
  // reddedebildiği için istekler sıraya konur; bağlantı hatasında (502) bir kez yeniden denenir.
  let qkQueue = Promise.resolve();
  function qk(path, payload = {}) {
    const run = async () => {
      const { data } = await sb.auth.getSession(); const t = data.session?.access_token; if (!t) throw new Error('Oturum kapandı.');
      for (let attempt = 0; ; attempt++) {
        const r = await fetch('/.netlify/functions/qukasoft', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ path, ...payload }) });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.success) return j.result;
        if (r.status === 502 && attempt === 0) { await new Promise(ok => setTimeout(ok, 900)); continue; }
        throw new Error(j.message || 'Qukasoft işlemi yapılamadı.');
      }
    };
    const p = qkQueue.then(run, run); qkQueue = p.catch(() => {}); return p;
  }
  const REF = { units: null, compat: null, err: '' }; // birimler ve uyumluluk değerleri (oturum boyunca bir kez yüklenir)
  async function loadRefs() {
    if (REF.units || REF.err) return;
    try {
      const u = await qk('unit/lists', { query: { pageStart: 0, pageSize: 50 } }); REF.units = (u?.list || []).map(x => ({ id: +(x.ID ?? x.id), title: x.title || x.name || '' }));
      const g = await qk('compability/lists', { query: { pageStart: 0, pageSize: 50 } }), groups = g?.list || [], vals = [];
      for (const gr of groups) { const v = await qk('compability/values', { query: { pageStart: 0, pageSize: 100, compatibilityId: gr.Id ?? gr.id } }); (v?.list || []).forEach(x => vals.push({ id: +x.id, group: gr.name, label: [1, 2, 3, 4, 5].map(i => x['field' + i]).filter(Boolean).join(' · ') })); }
      REF.compat = vals;
    } catch (e) { REF.err = e.message; }
    render();
  }
  async function loadCombines() {
    if (!D || D.isNew || D.rel.combLoaded || !D.id) return; D.rel.combLoaded = true;
    try { const r = await qk('product/combines', { query: { pageStart: 0, pageSize: 50, mainProductId: D.id } }); D.combines = (r?.list || []).map(x => ({ code: x.combineProductCode, text: x.customText || '' })); S.keepScroll = true; render(); } catch {}
  }
  const pname = code => S.products.find(p => p.code === code)?.name || '';
  // Ürün seçici: kod ya da adla arama (datalist), seçilince listeye eklenir
  const picker = (id, act, items, textKey) => `<div class="inline" style="gap:8px"><input type="text" id="${id}" list="ed-products" placeholder="Ürün adı ya da kodu yaz, listeden seç"><button class="btn sm" data-act="${act}" data-in="${id}">Ekle</button></div>
    ${items.length ? `<div class="vrows">${items.map((x, i) => `<div class="vrow rel" data-i="${i}"><span><b>${esc(x.code)}</b> ${esc(pname(x.code))}</span>${textKey ? `<input type="text" data-ck="${i}" value="${esc(x.text)}" placeholder="Kombin metni (ör. Cüzdanıyla al)">` : '<span></span>'}<button data-act="${act}Del" data-i="${i}" aria-label="Çıkar">×</button></div>`).join('')}</div>` : ''}`;
  const pickCode = v => { v = String(v || '').trim(); return (S.products.find(p => p.code === v.split(' — ')[0]) || S.products.find(p => p.name.toLocaleLowerCase('tr') === v.toLocaleLowerCase('tr')))?.code || ''; };
  // Kaydetten sonra ilişkili ürünleri Qukasoft'a yazar; her işlemin sonucunu döndürür
  async function saveRelations() {
    const out = [], code = D.code.trim();
    if (D.rel.sim) { try { await qk('product/updateSimilars', { data: { products: [{ code, similarProducts: D.similars.map(c => ({ code: c })) }] } }); D.rel.sim = false; out.push('benzer ürünler'); } catch (e) { out.push('benzer ürünler: ' + e.message); } }
    if (D.rel.comb) { try { await qk('product/updateCombines', { data: { products: [{ code, combineProducts: D.combines.map(c => ({ code: c.code, customText: c.text, combination: true })) }] } }); D.rel.comb = false; out.push('kombinler'); } catch (e) { out.push('kombinler: ' + e.message); } }
    const ch = Object.entries(D.compat).filter(([, p]) => p);
    if (ch.length) { try { await qk('product/updateCompabilities', { data: { products: ch.map(([id, process]) => ({ code, compabilityValueId: +id, process })) } }); D.compat = {}; out.push('uyumluluk'); } catch (e) { out.push('uyumluluk: ' + e.message); } }
    return out;
  }
  // Mevcut ürünlerden öneriler (marka, model kodu, özellik adları)
  const known = () => {
    const brands = new Map(), models = new Set(), attrs = new Set();
    S.products.forEach(p => { if (p.brand && +p.brandId) brands.set(p.brand, +p.brandId); if (p.modelCode) models.add(p.modelCode); (p.attributes || []).forEach(a => a.name && attrs.add(a.name)); });
    Object.values(DIM_ATTR).forEach(n => attrs.delete(n));
    return { brands, models: [...models].sort(), attrs: [...attrs].sort() };
  };
  function ensure() {
    const key = S.route === 'yeni' ? 'new' : 'e:' + S.arg;
    if (D && D._key === key) return true;
    if (S.route === 'yeni') { D = blank(); D._key = key; return true; }
    const p = S.products.find(x => String(x.code) === String(S.arg)); if (!p) return false;
    D = fromProduct(p); D._key = key; dropSizeShots(D); return true;
  }
  // Ölçü görseli kaldırıldı (25.10.2026). Daha önce yüklenenler ürün açılınca listeden çıkarılır, kaydedince Qukasoft'tan da kalkar.
  // Tanıma yalnızca panelin çizdiği zeminlere bakar (üç köşe): renksiz gri 122 ya da eski tasarımın koyu zemini (#121110'a yakın).
  // Koyu fonlu gerçek ürün fotoğrafı silinmesin diye eşikler dar tutuldu.
  async function dropSizeShots(d) {
    const found = [];
    for (const [k, s] of Object.entries(d.shots)) {
      if (k === 'front' || k === 'model' || !s.url) continue;
      try {
        const im = await loadImg(s.url), c = document.createElement('canvas'); c.width = c.height = 40; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 40, 40);
        const px = x.getImageData(0, 0, 40, 40).data, rgb = (i, j) => { const p = (j * 40 + i) * 4; return [px[p], px[p + 1], px[p + 2]]; };
        const flat = (i, j, lo, hi) => { const v = rgb(i, j); return Math.max(...v) - Math.min(...v) < 8 && v.every(n => n >= lo && n <= hi); };
        const corners = [[1, 1], [38, 1], [1, 38]];
        if (corners.every(([i, j]) => flat(i, j, 107, 137)) || corners.every(([i, j]) => flat(i, j, 8, 34))) found.push(k);
      } catch {}
    }
    if (!found.length || D !== d) return;
    found.forEach(k => delete d.shots[k]);
    S.keepScroll = true; render();
    toast(`Ölçü görseli listeden çıkarıldı (${found.length}). Ürünü kaydedince Qukasoft'tan da kalkar.`);
  }

  /* ---------- görünüm ---------- */
  const fld = (label, html, cls = '') => `<label class="f ${cls}"><span>${label}</span>${html}</label>`;
  const inp = (k, attrs = '') => `<input type="text" data-k="${k}" value="${esc(D[k] ?? '')}" ${attrs}>`;
  const ninp = (k, attrs = '') => `<input type="number" inputmode="decimal" step="0.01" data-k="${k}" value="${esc(D[k] ?? '')}" ${attrs}>`;
  // ölçü rehberi (celik isteği 31.10.2026): çanta çizimi üzerinde En, Yükseklik ve Derinlik'in nereden ölçüldüğü; kutuya yazılan değer çizimde görünür,
  // kutuya girilince o ok öne çıkar, oka dokununca kutusu açılır
  const OLCU = { w: ['En', '#2f6fd6'], h: ['Yükseklik', '#c46a12'], d: ['Derinlik', '#2f8a57'] };
  const olcuYazi = (k, v) => OLCU[k][0] + (String(v ?? '').trim() && +v > 0 ? ' ' + String(v).replace('.', ',') + ' cm' : '');
  const olcuEt = k => `<i class="olcu-nokta" style="background:${OLCU[k][1]}"></i>${OLCU[k][0]} (cm)`;
  const olcuRehber = () => {
    const ok = (k, x1, y1, x2, y2, uc, yazi) => `<g class="ok-g ok-${k}" data-olcu="${k}" role="button" tabindex="-1" aria-label="${OLCU[k][0]} kutusuna git" style="color:${OLCU[k][1]}">
      ${uc}<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="2.5" marker-start="url(#olcuUc${k})" marker-end="url(#olcuUc${k})"/>${yazi}</g>`;
    const uc = k => `<marker id="olcuUc${k}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${OLCU[k][1]}"/></marker>`;
    return `<div class="olcu-rehber" aria-label="Ölçü rehberi">
      <svg viewBox="0 0 250 215" role="img" aria-label="Çanta üzerinde En, Yükseklik ve Derinlik">
        <defs>${uc('w')}${uc('h')}${uc('d')}</defs>
        <path d="M40 70L90 40L210 40L160 70Z" fill="#ece7df" stroke="#8a8174" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M100 55Q125 2 150 55" fill="none" stroke="#8a8174" stroke-width="5" stroke-linecap="round"/>
        <path d="M160 70L210 40L210 140L160 170Z" fill="#e2dbcf" stroke="#8a8174" stroke-width="1.5" stroke-linejoin="round"/>
        <rect x="40" y="70" width="120" height="100" fill="#f6f2ec" stroke="#8a8174" stroke-width="1.5"/>
        <rect x="58" y="108" width="84" height="44" rx="4" fill="none" stroke="#b9b0a2" stroke-width="1.2" stroke-dasharray="4 3"/>
        <text x="100" y="94" text-anchor="middle" font-size="10" fill="#a39c91" letter-spacing="1">ÖN YÜZ</text>
        ${ok('w', 44, 186, 156, 186, '<path d="M40 174V194M160 174V194" stroke="currentColor" stroke-width="1"/>', `<text data-yazi="w" x="100" y="207" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">${esc(olcuYazi('w', D.w))}</text>`)}
        ${ok('h', 24, 74, 24, 166, '<path d="M14 70H38M14 170H38" stroke="currentColor" stroke-width="1"/>', `<text data-yazi="h" x="12" y="120" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor" transform="rotate(-90 12 120)">${esc(olcuYazi('h', D.h))}</text>`)}
        ${ok('d', 172, 181, 214, 156, '<path d="M162 172L170 186M212 142L220 156" stroke="currentColor" stroke-width="1"/>', `<text data-yazi="d" x="198" y="201" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">${esc(olcuYazi('d', D.d))}</text>`)}
      </svg>
      <p><b style="color:${OLCU.w[1]}">En:</b> ön yüzün soldan sağa genişliği. <b style="color:${OLCU.h[1]}">Yükseklik:</b> gövdenin altından üstüne, sap hariç. <b style="color:${OLCU.d[1]}">Derinlik:</b> önden arkaya kalınlık; sitede “Boy” olarak görünür.</p></div>`;
  };
  const isValiz = () => /VAL[İI]Z/i.test(D.categoryName || '');
  const hasSize = () => +D.w > 0 || +D.h > 0;
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
      <section class="step"><div class="step-h"><span class="no">01</span><div><h2>Fotoğraflar</h2><p>Telefonla çek ya da galeriden seç. Arka plan temizlenir, mağazanın oranında 1200×1600 (3:4) ve CLK filigranlı hazırlanır.</p></div>${galleryList().length ? `<button class="btn sm" data-act="edGallery" data-i="0" style="margin-left:auto">Görselleri aç (${galleryList().length})</button>` : ''}</div>
        <div class="step-b"><div class="shots">${SLOTS.map(([k, t, h]) => shot(k, t, h)).join('')}</div>
          <div class="f"><span>Manken</span><div class="chips" style="margin:0">${AUDIENCES.map(([k, l]) => `<button class="chip" data-act="edAud" data-a="${k}" aria-pressed="${D.audience === k}">${l}</button>`).join('')}</div></div>
          <div class="f"><span>Taşıma şekli</span><div class="chips" style="margin:0">${CARRIES.map(([k, l]) => `<button class="chip" data-act="edCarry" data-c="${k}" aria-pressed="${D.carry === k}">${l}</button>`).join('')}</div></div>
          <div class="olcu"><div class="fg">${fld(olcuEt('w'), ninp('w'))}${fld(olcuEt('h'), ninp('h'))}${fld(olcuEt('d'), ninp('d'))}${fld('Manken boyu (cm)', ninp('mh', `placeholder="${HEIGHTS[D.audience]}"`))}</div>${olcuRehber()}</div>
          <label class="toggle"><input type="checkbox" data-k="waterproof" ${D.waterproof ? 'checked' : ''}> Su geçirmez (ölçü görseline rozet ekler)</label>
          <p class="hint">Ürün ölçüleri girilince çanta mankenin boyuna göre gerçek ölçüsünde gösterilir; ölçü yoksa manken otomatik üretilmez. Seçimi ya da ölçüyü değiştirdikten sonra Manken kutusunda “Yeniden”e bas.</p>
          <div class="row-opts"><label class="toggle"><input type="checkbox" data-auto="cutout" ${D.auto.cutout ? 'checked' : ''}> Otomatik dekupe</label><label class="toggle"><input type="checkbox" data-auto="mark" ${D.auto.mark ? 'checked' : ''}> CLK filigranı</label></div></div></section>
      <section class="step"><div class="step-h"><span class="no">02</span><div><h2>Ürün bilgileri</h2><p>Sitede ve faturada görünecek bilgiler</p></div></div>
        <div class="step-b"><div class="fg">
          ${fld('Ürün adı <em>*</em>', inp('name', 'placeholder="ör. West Polo 7041 El Çantası"'), 'full')}
          ${fld('Kategori', `<select data-k="categoryId"><option value="">${cats.length ? 'Kategori seç' : (D.categoryName || 'Yükleniyor…')}</option>${cats.map(c => `<option value="${c.id}" ${String(c.id) === String(D.categoryId) ? 'selected' : ''}>${esc(c.path)}</option>`).join('')}</select>`)}
          ${fld('Marka', inp('brand', 'list="ed-brands"'))}
          ${fld('Ürün kodu', `<div class="inline">${inp('code', D.isNew ? '' : 'readonly')}${D.isNew ? '<button class="btn sm" data-act="edCode">Yenile</button>' : ''}</div>`)}
          ${fld('Barkod', inp('barcode', 'placeholder="Varsa üretici barkodu"'))}
          ${fld('Model kodu', inp('modelCode', 'list="ed-models" placeholder="ör. URBAN"'))}
          ${fld('Fatura adı', inp('invoiceName', 'placeholder="Faturada görünecek ad"'))}
          ${fld('MPN', inp('mpn', 'placeholder="Üretici parça numarası"'))}
          ${fld('Kısa açıklama', inp('shortDescription', 'placeholder="Listelerde görünen tek cümle"'), 'full')}
          <div class="f full"><span>Ürün açıklaması</span><textarea data-k="longDescription" rows="5" placeholder="Malzeme, bölmeler, askı, kullanım…">${esc(D.longDescription)}</textarea><div class="inline" style="justify-self:start;gap:8px;flex-wrap:wrap"><button class="btn sm dark" data-act="edDescAi">Yapay zekâ ile yaz</button><button class="btn sm" data-act="edDesc">Şablonla yaz</button></div>
            ${/<\w/.test(D.longDescription) ? `<div class="desc-pv"><span class="desc-pv-h">Sitede böyle görünür</span>${safeHtml(D.longDescription)}</div>` : ''}</div>
          ${fld('Malzeme', inp('material', 'placeholder="ör. Suni deri"'))}
          <label class="toggle full"><input type="checkbox" data-k="active" ${D.active ? 'checked' : ''}> Sitede yayında</label>
        </div></div></section>
      <section class="step"><div class="step-h"><span class="no">03</span><div><h2>Fiyatlar</h2><p>Alış fiyatını gir; diğerleri kurallara göre dolar, istersen değiştir.</p></div></div>
        <div class="step-b"><div class="calc"><span>Piyasa alışın ${RULES.market}, satış ${RULES.retail} katı (49/99 ile biter) · Hızlı satış ve Bayi 1 %${RULES.d1} · Bayi 2 %${RULES.d2} · Bayi 3 %${RULES.d3}</span><button class="btn sm dark" data-act="edCalc">Yeniden hesapla</button></div>
          <div class="prices">${fld('Alış', ninp('buyPrice', 'placeholder="0"'), 'hl')}${fld('Piyasa', ninp('listPrice'))}${fld('Satış', ninp('salePrice'), 'hl')}${fld('Hızlı satış', ninp('fastSalePrice'))}${fld('Bayi 1', ninp('dealerPrice1'))}${fld('Bayi 2', ninp('dealerPrice2'))}${fld('Bayi 3', ninp('dealerPrice3'))}${fld('Bayi 4', ninp('dealerPrice4'))}
            ${fld('KDV', `<select data-k="taxRate">${[0, 1, 10, 20].map(v => `<option value="${v}" ${+D.taxRate === v ? 'selected' : ''}>%${v}</option>`).join('')}</select>`)}
            ${fld('Kargo', `<select data-k="shipmentPayment"><option value="0" ${!+D.shipmentPayment ? 'selected' : ''}>Alıcı öder</option><option value="1" ${+D.shipmentPayment ? 'selected' : ''}>Satıcı öder</option></select>`)}</div>
          <p class="hint">Pazaryeri fiyatları satış fiyatından otomatik alınır. Kâr: <b>${+D.salePrice && +D.buyPrice ? tl(D.salePrice - D.buyPrice) + ' · %' + Math.round((1 - D.buyPrice / D.salePrice) * 100) : '—'}</b></p></div></section>
      <section class="step"><div class="step-h"><span class="no">04</span><div><h2>Renk ve stok</h2><p>Renge dokun: barkod ve ${RULES.stock} adet stok otomatik atanır</p></div></div>
        <div class="step-b"><div class="swatches">${COLORS.map(([n, h]) => `<button class="sw" data-color="${n}" aria-pressed="${D.variants.some(v => v.v === n)}"><i style="background:${h}"></i>${n}</button>`).join('')}</div>
          ${D.variants.length ? `<div class="vrows">${D.variants.map((v, i) => `<div class="vrow" data-i="${i}"><i style="background:${hexOf(v.v)}"></i><input type="text" data-vk="v" value="${esc(v.v)}" aria-label="Renk"><input type="text" class="bc" data-vk="b" value="${esc(v.b)}" aria-label="Barkod"><input type="number" inputmode="numeric" data-vk="q" value="${esc(v.q)}" aria-label="Stok"><button data-act="edVdel" data-i="${i}" aria-label="Sil">×</button></div>`).join('')}</div>` : `<div class="fg">${fld('Stok adedi (renksiz)', ninp('quantity'))}</div>`}
          <div class="fg three">${fld('Desi', ninp('desi'))}<div class="f"><span>Toplam stok</span><input type="text" value="${num(totalQ)}" readonly></div>${fld('Kritik stok', ninp('critical'))}</div></div></section>
      <section class="step"><div class="step-h"><span class="no">05</span><div><h2>Özellikler ve görünürlük</h2><p>Sitede filtre ve ürün tablosunda görünen özellikler. En, Yükseklik ve Boy ölçülerden otomatik eklenir.</p></div></div>
        <div class="step-b">
          ${D.attrs.length ? `<div class="vrows">${D.attrs.map((a, i) => `<div class="vrow attr" data-i="${i}"><input type="text" data-ak="n" value="${esc(a.n)}" list="ed-attrs" aria-label="Özellik" placeholder="Özellik (ör. Desen)"><input type="text" data-ak="v" value="${esc(a.v)}" aria-label="Değer" placeholder="Değer (ör. Düz)"><button data-act="edAttrDel" data-i="${i}" aria-label="Sil">×</button></div>`).join('')}</div>` : ''}
          <button class="btn sm" data-act="edAttrAdd" style="justify-self:start">+ Özellik ekle</button>
          <div class="fg three">${fld('Sıra', ninp('seq'))}${fld('Özel kod 1', inp('specialCode1'))}${fld('Özel kod 2', inp('specialCode2'))}${fld('Özel kod 3', inp('specialCode3'))}</div>
          <div class="row-opts"><label class="toggle"><input type="checkbox" data-k="showcase" ${D.showcase ? 'checked' : ''}> Vitrinde göster</label><label class="toggle"><input type="checkbox" data-k="domestic" ${D.domestic ? 'checked' : ''}> Yerli üretim</label></div></div></section>
      <section class="step"><div class="step-h"><span class="no">06</span><div><h2>Arama motoru (SEO)</h2><p>Google'da görünen başlık ve açıklama. Boş bırakılırsa Qukasoft ürün adını kullanır.</p></div><button class="btn sm" data-act="edSeo" style="margin-left:auto">Bilgilerden doldur</button></div>
        <div class="step-b"><div class="fg">
          ${fld(`SEO başlığı <em>${D.seoTitle.length}/60</em>`, inp('seoTitle', 'maxlength="70"'), 'full')}
          ${fld(`SEO açıklaması <em>${D.seoDescription.length}/160</em>`, inp('seoDescription', 'maxlength="200"'), 'full')}
          ${fld('Anahtar kelimeler', inp('seoKeywords', 'placeholder="virgülle ayır"'), 'full')}
          ${fld('Sayfa adresi (URL)', inp('slug', 'placeholder="boşsa üründen oluşturulur"'), 'full')}
        </div></div></section>
      <section class="step"><div class="step-h"><span class="no">07</span><div><h2>İlişkili ürünler ve diğer</h2><p>Benzer ürünler, kombinler, uyumluluk, video ve birim. İlişkiler ürün kaydedildikten sonra Qukasoft'a ayrıca yazılır.</p></div></div>
        <div class="step-b">
          ${REF.err ? `<div class="msg err">${esc(REF.err)}</div>` : ''}
          <div class="f"><span>Benzer ürünler${D.isNew ? '' : ' <em>(Qukasoft mevcut listeyi vermiyor; eklediğin liste kaydedilince geçerli olur)</em>'}</span>${picker('ed-sim', 'edSim', D.similars.map(code => ({ code })), false)}</div>
          <div class="f"><span>Kombin ürünler</span>${picker('ed-comb', 'edComb', D.combines, true)}</div>
          <div class="f"><span>Ürün grubu (ilişkili ürünler)${D.isNew ? '' : ' <em>(Qukasoft mevcut grubu vermiyor; doldurursan kaydedilince geçerli olur)</em>'}</span>
            <div class="fg">${fld('Grup adı', `<input type="text" data-gk="name" value="${esc(D.group.name)}" placeholder="ör. West Polo 7041 renkleri">`)}${fld('Bu ürünün seçenek adı', `<input type="text" data-gk="self" value="${esc(D.group.self || '')}" placeholder="ör. Kahve">`)}</div>
            ${picker('ed-grp', 'edGrp', D.group.items, true).replace(/data-ck="/g, 'data-gl="').replace(/Kombin metni \(ör\. Cüzdanıyla al\)/g, 'Seçenek adı (ör. Siyah)')}</div>
          <div class="f"><span>Uyumluluk</span>${!REF.compat ? '<p class="hint">Yükleniyor…</p>' : REF.compat.length ? `<div class="vrows">${REF.compat.map(c => `<div class="vrow rel"><span><b>${esc(c.group)}</b> ${esc(c.label)}</span><span></span><select data-cv="${c.id}"><option value="">—</option><option value="insert" ${D.compat[c.id] === 'insert' ? 'selected' : ''}>Ekle</option><option value="delete" ${D.compat[c.id] === 'delete' ? 'selected' : ''}>Çıkar</option></select></div>`).join('')}</div>` : '<p class="hint">Mağazada tanımlı uyumluluk değeri yok. Qukasoft panelinde Uyumluluklar bölümünden tanımlanabilir.</p>'}</div>
          <div class="fg">
            ${fld('Birim', `<select data-k="unitId">${(REF.units || [{ id: D.unitId, title: 'Adet' }]).map(u => `<option value="${u.id}" ${+u.id === +D.unitId ? 'selected' : ''}>${esc(u.title)}</option>`).join('')}</select>`)}
            <div class="f full"><span>Video (YouTube embed kodu ya da bağlantısı)</span><textarea data-k="videoText" rows="2" placeholder="&lt;iframe src=&quot;https://www.youtube.com/embed/…&quot;&gt;&lt;/iframe&gt;">${esc(D.videoText)}</textarea></div>
          </div></div></section>
    </div>
    <datalist id="ed-products">${S.products.filter(p => p.code !== D.code).map(p => `<option value="${esc(p.code)} — ${esc(p.name)}">`).join('')}</datalist>
    ${(k => `<datalist id="ed-brands">${[...k.brands.keys()].map(b => `<option value="${esc(b)}">`).join('')}</datalist><datalist id="ed-models">${k.models.map(m => `<option value="${esc(m)}">`).join('')}</datalist><datalist id="ed-attrs">${k.attrs.map(m => `<option value="${esc(m)}">`).join('')}</datalist>`)(known())}
    <aside class="summary"><div class="sum-card"><div class="cover" ${cover ? 'data-act="edGallery" data-i="0" style="cursor:zoom-in"' : ''}>${cover ? `<img src="${esc(cover)}" alt="">` : 'CLK'}</div>${galleryList().length ? `<button class="btn gold" data-act="edGallery" data-i="0">Görselleri aç (${galleryList().length})</button>` : ''}
      <h3>${esc(D.name || 'Adsız ürün')}</h3>
      <dl><dt>Satış</dt><dd>${D.salePrice ? tl(D.salePrice) : '—'}</dd><dt>Bayi 1</dt><dd>${D.dealerPrice1 ? tl(D.dealerPrice1) : '—'}</dd><dt>Stok</dt><dd>${num(totalQ)} adet</dd><dt>Renk</dt><dd>${D.variants.length || '—'}</dd><dt>Fotoğraf</dt><dd>${Object.keys(D.shots).length}/${SLOTS.length}</dd></dl>
      <ul class="checklist">${ck.map(([l, ok]) => `<li class="${ok ? 'ok' : ''}">${l}</li>`).join('')}</ul>
      <div id="ed-msg"></div><div class="sum-acts">${actions}</div></div></aside></div>
    <div class="ed-bar">${actions}</div>`;
  };
  function shot(k, t, h) {
    const s = D.shots[k], src = s?.preview || s?.url;
    const isModel = k === 'model', auto = isModel, act = 'edModel';
    if (auto && !src && !hasSize()) h = 'Önce ürün ölçülerini gir';
    return `<div class="shot ${src ? 'has' : ''}"><span class="lb ${isModel ? 'auto' : ''}">${t}</span>
      ${src ? `<img src="${esc(src)}" alt="${t}">` : `<div class="empty-s">${CLK.ICONS.cam}<b>${t}</b><span>${h}</span></div>`}
      ${s?.busy ? `<div class="busy">${esc(s.busy)}</div>` : ''}
      ${src ? `<div class="ops">${auto ? `<button data-act="${act}">Yeniden</button>` : `<button data-act="edCut" data-k="${k}">Dekupe</button>`}<button class="x" data-act="edShotDel" data-k="${k}">Sil</button></div>` :
        auto ? `<div class="ops"><button data-act="${act}" ${D.shots.front ? '' : 'disabled'}>Manken üret</button></div>` : `<label><input type="file" accept="image/*" capture="environment" data-shot="${k}" hidden></label>`}</div>`;
  }

  /* ---------- görsel hazırlama ---------- */
  // Uzak görseller (Qukasoft CDN, Supabase) CORS ile yüklenmezse tuval kilitlenir ve toDataURL hata verir.
  const loadImg = src => new Promise((ok, no) => { const i = new Image(); if (!src.startsWith('data:')) i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = () => no(new Error('Fotoğraf açılamadı.')); i.src = src; });
  const fileUrl = f => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); });
  // Mağaza teması ürün görsellerini 3:4 gösterir; kare görsele Qukasoft alt ve üste boş bant ekliyor (doğrulandı).
  const PW = 1200, PH = 1600;
  // focus yoksa görsel %92'ye sığdırılır (beyaz kenar). focus varsa kaplanır: yanlardan kırpılır, verilmişse
  // focus.x0–x1 (görsel genişliğine oranla çanta) kadrajda kalır.
  async function portrait(src, mark, focus) {
    const im = await loadImg(src), c = document.createElement('canvas'); c.width = PW; c.height = PH;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, PW, PH);
    if (focus) {
      const s = Math.max(PW / im.width, PH / im.height), w = im.width * s, h = im.height * s, cw = PW / w;
      let L = (1 - cw) / 2; if (focus.x1 != null) { L = Math.min(L, focus.x0); L = Math.max(L, focus.x1 - cw); }
      L = Math.max(0, Math.min(1 - cw, L));
      x.drawImage(im, -L * w, (PH - h) / 2, w, h);
    } else {
      const s = Math.min(PW * 0.92 / im.width, PH * 0.92 / im.height); const w = im.width * s, h = im.height * s;
      x.drawImage(im, (PW - w) / 2, (PH - h) / 2, w, h);
    }
    if (mark) { x.save(); x.globalAlpha = 0.18; x.fillStyle = '#121110'; x.font = '600 54px "Playfair Display", Georgia, serif'; x.textAlign = 'right'; x.textBaseline = 'bottom'; x.letterSpacing = '12px'; x.fillText('CLK', PW - 40, PH - 34); x.restore(); }
    return c.toDataURL('image/jpeg', 0.9);
  }
  const toBlob = du => fetch(du).then(r => r.blob());
  async function upload(du) {
    const uid = S.user.id, path = `${uid}/clk-yonetim/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from(BUCKET).upload(path, await toBlob(du), { contentType: 'image/jpeg', upsert: false });
    if (error) throw new Error('Fotoğraf yüklenemedi.');
    return path;
  }
  // Ölçek rehberi: görüntü modeli santimetreye uymadığı için çantayı son karedeki gerçek boyutuna biz küçültürüz.
  // Kare, mankenin başından uyluk ortasına kadar (boyun ~%62'si) görüneceği kadraja göre hesaplanır.
  // Ön fotoğrafta (beyaz arka plan) çantanın sınır kutusu
  async function bagBox(du) {
    const im = await loadImg(du), c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const px = x.getImageData(0, 0, c.width, c.height).data, wmX = c.width - 260, wmY = c.height - 120; // sağ alt: CLK filigranı
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y += 2) for (let i = 0; i < c.width; i += 2) {
      if (i > wmX && y > wmY) continue;
      const p = (y * c.width + i) * 4; if (px[p] < 220 || px[p + 1] < 220 || px[p + 2] < 220) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (x1 < 0 || (bw < c.width * 0.1 && bh < c.height * 0.1)) return null; // açık renkli ürün ayırt edilemedi
    return { c, x0, y0, bw, bh };
  }
  // Çantayı w×h boyutunda kes: beyaz arka plan şeffaf, kenarlar hafif yumuşatılmış.
  // thr: bundan açık pikseller arka plan sayılır; koyu zeminde beyaz hale kalmasın diye düşürülebilir.
  function cutBag(L, w, h, thr = 225) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    const bag = document.createElement('canvas'); bag.width = w; bag.height = h; const bx = bag.getContext('2d');
    bx.drawImage(L.c, L.x0, L.y0, L.bw, L.bh, 0, 0, w, h);
    const bd = bx.getImageData(0, 0, w, h), m = document.createElement('canvas'); m.width = w; m.height = h; const mx = m.getContext('2d'), md = mx.createImageData(w, h);
    for (let p = 0; p < bd.data.length; p += 4) md.data[p + 3] = Math.min(bd.data[p], bd.data[p + 1], bd.data[p + 2]) < thr ? 255 : 0;
    mx.putImageData(md, 0, 0);
    const soft = document.createElement('canvas'); soft.width = w; soft.height = h; const sx = soft.getContext('2d'); sx.filter = 'blur(1.2px)'; sx.drawImage(m, 0, 0);
    bx.globalCompositeOperation = 'destination-in'; bx.drawImage(soft, 0, 0);
    return bag;
  }
  async function scaleRef(du) {
    const L = await bagBox(du); if (!L) return null;
    const N = 1024, ppc = N * 0.93 / (mHeight() * 0.62);
    // 0.6: modeller (Seedream, OpenAI) tam çözünürlüklü ürün görselini de gördüğü için çantayı rehberdekinden büyük çiziyor; denemelerle ayarlandı
    const s = 0.6 * Math.min(+D.w > 0 ? +D.w * ppc / L.bw : Infinity, +D.h > 0 ? +D.h * ppc / L.bh : Infinity);
    // Sırt çantası sırtın üstünde durur (manken arkadan çekilir); diğerleri bel-göğüs hizasında
    const r = { x: Math.round((N - L.bw * s) / 2), y: Math.round(N * (D.carry === 'sirt' ? 0.45 : 0.55) - L.bh * s / 2), w: Math.round(L.bw * s), h: Math.round(L.bh * s) };
    const o = document.createElement('canvas'); o.width = o.height = N; const ox = o.getContext('2d'); ox.fillStyle = '#fff'; ox.fillRect(0, 0, N, N);
    ox.drawImage(L.c, L.x0, L.y0, L.bw, L.bh, r.x, r.y, r.w, r.h);
    return { du: o.toDataURL('image/jpeg', 0.92), rect: r, bag: cutBag(L, r.w, r.h) };
  }
  // Üretilen görselde çantayı bul ve orijinal çanta piksellerini üstüne koy; logo ve detaylar ön fotoğrafla birebir kalır.
  // Model çantayı kaydırıp döndürebildiği ve rengini değiştirebildiği için çanta silüeti (içi 1, çevresi 0) ile
  // gri görüntü arasında normalize korelasyon aranır: önce 1/8 çözünürlükte geniş, sonra 1/4'te dar arama.
  // Eşleşme zayıfsa üretilen görsel olduğu gibi kalır.
  async function pasteBag(aiDu, ref) {
    const N = 1024, im = await loadImg(aiDu), c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, N, N);
    const level = k => {
      const n = N / k, cv = document.createElement('canvas'); cv.width = cv.height = n; const cx = cv.getContext('2d'); cx.drawImage(c, 0, 0, n, n);
      const d = cx.getImageData(0, 0, n, n).data, g = new Float32Array(n * n);
      for (let i = 0; i < g.length; i++) g[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
      return { n, g };
    };
    const tpl = new Map();
    const template = (k, ang, sc) => { // silüet ve 2 piksellik çevre halkası, merkeze göre
      const key = k + ':' + ang + ':' + sc; if (tpl.has(key)) return tpl.get(key);
      const w = ref.rect.w * sc / k, h = ref.rect.h * sc / k, R = Math.ceil(Math.hypot(w, h) / 2) + 3, S = 2 * R;
      const cv = document.createElement('canvas'); cv.width = cv.height = S; const cx = cv.getContext('2d');
      cx.translate(R, R); cx.rotate(ang * Math.PI / 180); cx.drawImage(ref.bag, -w / 2, -h / 2, w, h);
      const a = cx.getImageData(0, 0, S, S).data, inside = i => a[i * 4 + 3] > 128, pts = [];
      for (let y = 0; y < S; y++) for (let i = 0; i < S; i++) {
        const j = y * S + i; let v = inside(j) ? 1 : -1;
        if (v < 0) { let near = false; for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy, xx = i + dx; if (yy >= 0 && xx >= 0 && yy < S && xx < S && inside(yy * S + xx)) { near = true; break; } } if (!near) continue; v = 0; }
        pts.push(i - R, y - R, v > 0 ? 1 : 0);
      }
      const t = { pts, R }; tpl.set(key, t); return t;
    };
    const score = (L, t, cx, cy) => { // |NCC| (çanta açık ya da koyu olabilir)
      let n = 0, sa = 0, saa = 0, st = 0, stt = 0, sat = 0; const p = t.pts;
      for (let q = 0; q < p.length; q += 3) { const xx = cx + p[q], yy = cy + p[q + 1]; if (xx < 0 || yy < 0 || xx >= L.n || yy >= L.n) return 0; const a = L.g[yy * L.n + xx], v = p[q + 2]; n++; sa += a; saa += a * a; st += v; stt += v * v; sat += a * v; }
      const va = saa - sa * sa / n, vt = stt - st * st / n; return va > 0 && vt > 0 ? Math.abs((sat - sa * st / n) / Math.sqrt(va * vt)) : 0;
    };
    const L8 = level(8), L4 = level(4), c0x = ref.rect.x + ref.rect.w / 2, c0y = ref.rect.y + ref.rect.h / 2;
    let best = { s: 0 };
    for (let ang = -40; ang <= 40; ang += 5) for (const sc of [0.8, 0.9, 1, 1.1, 1.25]) {
      const t = template(8, ang, sc);
      for (let dy = -20; dy <= 20; dy++) for (let dx = -20; dx <= 20; dx++) { const cx = Math.round(c0x / 8) + dx, cy = Math.round(c0y / 8) + dy, s = score(L8, t, cx, cy); if (s > best.s) best = { s, ang, sc, cx: cx * 8, cy: cy * 8 }; }
    }
    const coarse = best; best = { s: 0 };
    for (let ang = coarse.ang - 4; ang <= coarse.ang + 4; ang += 2) for (const sc of [0.94, 0.97, 1, 1.03, 1.06].map(v => +(v * coarse.sc).toFixed(3))) {
      const t = template(4, ang, sc);
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const cx = Math.round(coarse.cx / 4) + dx, cy = Math.round(coarse.cy / 4) + dy, s = score(L4, t, cx, cy); if (s > best.s) best = { s, ang, sc, cx: cx * 4, cy: cy * 4 }; }
    }
    pasteBag.last = best;
    if (!(best.s > 0.72)) return aiDu; // zayıf eşleşmede yapıştırmak iki çantayı üst üste bindirir
    const w = ref.rect.w * best.sc * 1.02, h = ref.rect.h * best.sc * 1.02; // %2 büyük: modelin çantasının kenarlarını örter
    x.save(); x.translate(best.cx, best.cy); x.rotate(best.ang * Math.PI / 180); x.drawImage(ref.bag, -w / 2, -h / 2, w, h); x.restore();
    return c.toDataURL('image/jpeg', 0.92);
  }
  // Model bazen sahneyi beyaz rehber karesinin içine küçük bir fotoğraf gibi koyuyor: kenarlardaki düz beyaz bantları kırp.
  async function trimBorder(du) {
    const im = await loadImg(du), W = im.width, H = im.height, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, W, H).data;
    // Satır/sütunun %95'i neredeyse beyazsa çerçevedir (modelin bıraktığı silik izler kırpmayı durdurmasın)
    const plain = (x0, y0, dx, dy, n) => { let k = 0; for (let i = 0; i < n; i++) { const p = ((y0 + dy * i) * W + x0 + dx * i) * 4; if (d[p] * 0.3 + d[p + 1] * 0.59 + d[p + 2] * 0.11 > 236) k++; } return k / n > 0.95; };
    let t = 0, b = H - 1, l = 0, r = W - 1;
    while (t < H / 3 && plain(0, t, 1, 0, W)) t++;
    while (b > H * 2 / 3 && plain(0, b, 1, 0, W)) b--;
    while (l < W / 3 && plain(l, 0, 0, 1, H)) l++;
    while (r > W * 2 / 3 && plain(r, 0, 0, 1, H)) r--;
    // Yalnızca dört kenarın hepsinde bant varsa çerçevedir; beyaz stüdyoda başın üstündeki boşluk kırpılmasın
    const min = Math.min(W, H) * 0.03; if (t < min || H - 1 - b < min || l < min || W - 1 - r < min) return du;
    trimBorder.last = { l, w: r - l + 1, W };
    const o = document.createElement('canvas'); o.width = r - l + 1; o.height = b - t + 1; o.getContext('2d').drawImage(c, l, t, o.width, o.height, 0, 0, o.width, o.height);
    return o.toDataURL('image/jpeg', 0.92);
  }
  // Bu sitenin görsel fonksiyonu (dekupede Photoroom, mankende fal.ai/Gemini, yedekte OpenAI). Yoksa null döner.
  async function siteImage(body) {
    const { data } = await sb.auth.getSession(); const t = data.session?.access_token; if (!t) throw new Error('Oturum kapandı. Yeniden giriş yap.');
    const r = await fetch('/.netlify/functions/ai-product-image', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.status === 404 || r.status === 503) return null;
    let j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || (r.status === 504 ? 'Sunucu zaman aşımına uğradı.' : 'Görsel hazırlanamadı.'));
    if (j.pending) { // fal.ai kuyruğu: sonuç hazır olana kadar 3 sn arayla sor (en çok ~3 dk)
      const job = j.job;
      try {
        for (let i = 0; i < 60 && j.pending; i++) {
          await new Promise(ok => setTimeout(ok, 3000));
          const p = await fetch('/.netlify/functions/ai-product-image', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'falResult', job }) });
          j = await p.json().catch(() => ({})); if (!p.ok) throw new Error(j.message || 'fal.ai sonucu alınamadı.');
        }
        if (j.pending) throw new Error('fal.ai zaman aşımı');
      } catch (e) { toast('fal.ai üretemedi, OpenAI ile üretiliyor: ' + e.message.split(/[.\n]/)[0]); return siteImage({ ...body, skipFal: true }); }
    }
    if (!j.image) throw new Error(j.message || 'Görsel hazırlanamadı.');
    if (j.engineError) toast(/quota|top_up|balance|credit/i.test(j.engineError) ? 'Seçili servisin bakiyesi/kotası yok (' + j.engineError.split(':')[0] + '), OpenAI ile üretildi.' : 'Seçili servis üretemedi, OpenAI ile üretildi: ' + j.engineError.split(/[.\n]/)[0]);
    return j.image;
  }
  async function modelImage(du) {
    modelImage.focus = {}; pasteBag.last = null; trimBorder.last = null;
    // Kategori gönderilmez: yanlış kategorili üründe (ör. portföy sanılan göğüs çantası) kullanım şeklini bozuyor.
    // "Elde" seçiminde manken yok, yakın çekim el: kadraj rehberi uymaz, ölçek el boyuna göre yazıyla verilir
    const ref = hasSize() && D.carry !== 'el' ? await scaleRef(du).catch(() => null) : null;
    // Ölçek rehberi varsa ilk görsel tam çözünürlüklü ürün (detay ve logo), ikinci görsel rehber (boyut ve konum)
    const img = await siteImage({ action: 'model', image: du, guide: ref?.du, scaled: !!ref, audience: D.audience, carry: D.carry, height: mHeight(), size: { w: D.w, d: D.d, h: D.h } });
    if (!img) { toast('Manken seçimi henüz etkin değil, varsayılan mankenle üretiliyor.'); return null; }
    const out = ref ? await pasteBag(img, ref).catch(() => img) : img;
    const fin = await trimBorder(out).catch(() => out);
    // Görseller kare gelir, 3:4'e yanlardan kırpılır: çantanın yatay yeri (görsel genişliğine oranla) kırpmaya aktarılır
    const b = ref && pasteBag.last?.s > 0.72 ? pasteBag.last : null, t = trimBorder.last;
    if (b) { const half = (ref.rect.w * b.sc / 2 + 20) / 1024, map = f => t ? (f * t.W - t.l) / t.w : f; modelImage.focus = { x0: map(b.cx / 1024 - half), x1: map(b.cx / 1024 + half) }; }
    return fin;
  }
  async function aiImage(du, action) {
    const img = action === 'model' ? await modelImage(du) : await siteImage({ action, image: du });
    if (img) return img;
    const j = await call('ai-product-image', { method: 'POST', body: { action, image: du } });
    if (!j.image) throw new Error('Görsel hazırlanamadı.'); return j.image;
  }
  async function processShot(k, raw) {
    const s = (D.shots[k] = { preview: raw, busy: 'Hazırlanıyor…' }); render();
    try {
      let base = await portrait(raw, false);
      if (D.auto.cutout) { s.busy = 'Arka plan temizleniyor…'; render(); try { base = await aiImage(base, 'cutout'); } catch (e) { toast('Dekupe yapılamadı, orijinal kullanıldı.'); } }
      const final = await portrait(base, D.auto.mark); s.preview = final; s.raw = raw; s.busy = 'Yükleniyor…'; render();
      s.path = await upload(final); delete s.busy; delete s.url; delete s.existing;
      if (k === 'front' && !D.shots.model && hasSize()) makeModel();
    } catch (e) { s.busy = ''; toast(e.message); }
    render();
  }
  async function makeModel() {
    const f = D.shots.front; if (!f) return toast('Önce ön fotoğrafı ekle.');
    const s = (D.shots.model = { busy: 'Manken pozu üretiliyor… (1-2 dk)' }); render();
    try {
      const src = f.preview || f.url; const base = src.startsWith('data:') ? src : await portrait(src, false);
      const img = await aiImage(base, 'model');
      s.preview = await portrait(img, D.auto.mark, modelImage.focus || {}); s.busy = 'Yükleniyor…'; render(); s.path = await upload(s.preview); delete s.busy;
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
      dealerPrice4: n(D.dealerPrice4), desi: n(D.desi), type: 0, criticalStockStatus: 1, criticalStockQuantity: +D.critical >= 0 && D.critical !== '' ? +D.critical : RULES.critical,
      invoiceName: D.invoiceName.trim(), modelCode: D.modelCode.trim(), mpn: D.mpn.trim(), domestic: D.domestic ? 1 : 0, showcaseStatus: D.showcase ? 1 : 0, seq: n(D.seq) ?? 0,
      specialCode1: D.specialCode1.trim(), specialCode2: D.specialCode2.trim(), specialCode3: D.specialCode3.trim(),
      seoTitle: D.seoTitle.trim(), seoDescription: D.seoDescription.trim(), seoKeywords: D.seoKeywords.trim(), slug: D.slug.trim() || undefined,
      videoText: D.videoText.trim(), unitId: n(D.unitId) || 1 };
    if (D.categoryId) p.categoryId = Number(D.categoryId);
    const k = known(), bid = k.brands.get(D.brand) ?? [...k.brands].find(([b]) => b.toLocaleLowerCase('tr') === String(D.brand).toLocaleLowerCase('tr'))?.[1];
    if (bid) p.brandId = bid;
    // Özellikler: ölçüler En/Yükseklik/Boy olarak, ayrıca Malzeme ve Su Geçirmez (Qukasoft tanımsız niteliği kayıtta kendisi oluşturuyor)
    const attrs = [];
    Object.entries(DIM_ATTR).forEach(([f, name]) => { if (+D[f] > 0) attrs.push({ name, value: String(+D[f]) }); });
    if (D.material.trim()) attrs.push({ name: MATERIAL_ATTR, value: D.material.trim() });
    if (D.waterproof) attrs.push({ name: WATER_ATTR, value: 'Evet' });
    D.attrs.forEach(a => { if (a.n.trim() && a.v.trim() && !attrs.some(x => x.name.toLocaleLowerCase('tr') === a.n.trim().toLocaleLowerCase('tr'))) attrs.push({ name: a.n.trim(), value: a.v.trim() }); });
    if (attrs.length || !D.isNew) p.attributes = attrs;
    // Ürün grubu: yalnızca değiştirildiyse; üyeler kod + grup adı + seçenek adı, bu ürün de dahil
    const gname = D.group.name.trim();
    if (D.rel.grp && gname) p.groups = [{ code: p.code, label: String(D.group.self || '').trim() }, ...D.group.items.map(i => ({ code: i.code, label: String(i.text || '').trim() }))]
      .filter(g => g.label).map(g => ({ code: g.code, name: gname, label: g.label }));
    if (D.variants.length) { p.variant1Name = 'Renk'; p.variants = D.variants.map(v => ({ value1: v.v, barcode: v.b || hex12('CLK-V-'), quantity: +v.q || 0, priceStatus: 0, price: 0 })); p.quantity = p.variants.reduce((a, v) => a + v.quantity, 0); }
    else p.quantity = +D.quantity || 0;
    if (p.salePrice) p.marketplacePrices = MARKETS.map(type => ({ type, currency: 'TL', price: p.salePrice }));
    if (urls.length) p.images = urls.map(imageUrl => ({ imageUrl }));
    Object.keys(p).forEach(k => p[k] === undefined && delete p[k]);
    return p;
  }
  // Ürün türü: ad ve kategoriden; bulunamazsa taşıma şeklinden. [ad, giriş cümlesi, kullanım yeri]
  const KINDS = [
    [/valiz/, ['valiz', 'seyahatlerinizde düzeni ve dayanıklılığı bir arada sunan', 'kısa kaçamaklardan uzun yolculuklara kadar']],
    [/kalemlik/, ['kalemlik', 'ders ve masa başında düzeni kolaylaştıran', 'okulda ve evde']],
    [/beslenme/, ['beslenme çantası', 'pratik yapısıyla öğünleri yanınızda taşıtan', 'okulda ve gezilerde']],
    [/cüzdan/, ['cüzdan', 'düzenli bölmeleri ve derli toplu yapısıyla öne çıkan', 'cebinizde ya da çantanızda']],
    [/makyaj/, ['makyaj çantası', 'kozmetik ürünlerinizi düzenli tutan', 'evde ve seyahatte']],
    [/evrak|laptop/, ['evrak çantası', 'belgelerinizi ve eşyalarınızı derli toplu taşıyan', 'iş toplantılarında ve ofis temposunda']],
    [/spor/, ['spor çantası', 'antrenmandan hafta sonu kaçamaklarına eşlik eden', 'spor salonunda ve seyahatte']],
    [/sırt|dağcı|anaokul/, ['sırt çantası', 'gün boyu konforu ve kullanışlı iç hacmi bir araya getiren', 'okulda, işte ve seyahatte']],
    [/göğüs|bel çanta|çapraz/, ['çapraz çanta', 'elleri serbest bırakan, vücuda oturan', 'şehirde, seyahatte ve günlük koşturmada']],
    [/portföy|el çanta|clutch/, ['el çantası', 'zarif hatlarıyla kombinlerinizi tamamlayan', 'gün içinde ve özel davetlerde']]
  ];
  const CARRY_KIND = { capraz: ['çapraz çanta', 'elleri serbest bırakan, vücuda oturan', 'şehirde, seyahatte ve günlük koşturmada'], omuz: ['omuz çantası', 'şık duruşu ve rahat kullanımıyla öne çıkan', 'işte, okulda ve gün içinde'], el: ['el çantası', 'zarif hatlarıyla kombinlerinizi tamamlayan', 'gün içinde ve özel davetlerde'], sirt: ['sırt çantası', 'gün boyu konforu ve kullanışlı iç hacmi bir araya getiren', 'okulda, işte ve seyahatte'] };
  const CARRY_LABEL = { capraz: 'Çapraz ya da göğüs çantası olarak taşınır', omuz: 'Omuzda taşınır', el: 'Elde taşınır', sirt: 'Sırtta taşınır' };
  function productKind() {
    const t = `${D.name} ${D.categoryName}`.toLocaleLowerCase('tr');
    return (KINDS.find(([re]) => re.test(t)) || [0, D.carry && CARRY_KIND[D.carry]])[1] || ['çanta', 'şık tasarımı ve kullanışlı yapısıyla öne çıkan', 'günlük hayatta'];
  }
  function careText() {
    const m = (D.material || '').toLocaleLowerCase('tr');
    if (/suni|vegan|pu\b|sentetik/.test(m)) return 'Hafif nemli, yumuşak bir bezle silerek temizleyin; aşındırıcı temizleyici ve sert fırça kullanmayın. Uzun süre doğrudan güneş ve ısı kaynağı karşısında bırakmayın.';
    if (/deri/.test(m)) return 'Nemli, yumuşak bir bezle silin ve kendi kendine kurumaya bırakın. Doğrudan güneş ve ısı kaynaklarından uzak tutun; dönem dönem deri bakım kremiyle beslemek ömrünü uzatır.';
    if (/kumaş|polyester|naylon|kanvas|keten|denim/.test(m)) return 'Lekeleri hafif sabunlu suyla, yumuşak bir bezle silerek temizleyin. Makinede yıkamayın, ütülemeyin; gölgede kurutun.';
    return 'Yumuşak, hafif nemli bir bezle silerek temizleyin. Kullanmadığınız zamanlarda içini doldurup kuru ve serin bir yerde saklamak formunu korur.';
  }
  const sizeLine = () => [D.w, D.h, D.d].some(v => +v > 0) ? `${[D.w, D.h, D.d].map(v => +v > 0 ? String(+v).replace('.', ',') : '–').join(' × ')} cm` : '';
  // Verilen bilgilerden Qukasoft'a HTML açıklama: giriş, öne çıkanlar, ürün bilgileri, bakım. Yalnızca girilen bilgiler yazılır.
  function autoDesc() {
    const [noun, intro, use] = productKind(), e = s => esc(String(s || '').trim()), lc = s => String(s).toLocaleLowerCase('tr');
    const title = [D.brand, D.name].filter(Boolean).map(e).join(' '), colors = D.variants.map(v => lc(v.v)), size = sizeLine();
    const mat = D.material ? `${e(D.material.charAt(0).toLocaleUpperCase('tr') + D.material.slice(1))} gövdesi zamansız bir görünümü günlük kullanıma taşır.` : '';
    const p1 = `<p><strong>${title || 'Bu ürün'}</strong>, ${intro} bir ${noun}. ${mat}${D.waterproof ? ' Su geçirmez yapısı sayesinde yağmurlu havalarda da eşyalarınızı korur.' : ''}</p>`;
    const p2 = `<p>${use.charAt(0).toLocaleUpperCase('tr') + use.slice(1)} rahatlıkla kullanabileceğiniz bu ${noun}${size ? `, ${size} ölçüleriyle ihtiyacınız olanı yanınızda taşımanız için tasarlandı` : ' ihtiyacınız olanı yanınızda taşımanız için tasarlandı'}.${colors.length > 1 ? ` ${colors.length} farklı renk seçeneğiyle tarzınıza en uygun olanı seçebilirsiniz.` : ''}</p>`;
    const feats = [D.material && `${e(D.material)} malzeme`, D.waterproof && 'Su geçirmez yapı', D.carry && CARRY_LABEL[D.carry], size && `Ölçüler: ${size} (en × yükseklik × derinlik)`, colors.length && `Renk seçenekleri: ${colors.map(e).join(', ')}`].filter(Boolean);
    const info = [['Marka', D.brand], ['Ürün kodu', D.code], ['Kategori', D.categoryName], ['Malzeme', D.material], ['Ölçüler', size], ['Renk', colors.join(', ')], ['Su geçirmez', D.waterproof ? 'Evet' : '']].filter(([, v]) => String(v || '').trim());
    return [p1, p2,
      feats.length ? `<h3>Öne çıkan özellikler</h3><ul>${feats.map(f => `<li>${f}</li>`).join('')}</ul>` : '',
      `<h3>Ürün bilgileri</h3><ul>${info.map(([k, v]) => `<li><strong>${k}:</strong> ${e(v)}</li>`).join('')}</ul>`,
      `<h3>Bakım önerisi</h3><p>${careText()}</p>`].filter(Boolean).join('\n');
  }
  // Yapay zekâ ile açıklama: yalnızca paneldeki bilgiler gider; hata olursa şablona düşer
  async function aiDesc(btn) {
    const [noun] = productKind();
    // Alan adları Türkçe gider; model "Ürün bilgileri" listesinde bunları olduğu gibi kullanıyor
    const facts = { 'Marka': D.brand, 'Ürün adı': D.name, 'Ürün türü': noun, 'Kategori': D.categoryName, 'Ürün kodu': D.code, 'Malzeme': D.material, 'Ölçüler': sizeLine() && `${sizeLine()} (en × yükseklik × derinlik)`,
      'Renk': D.variants.map(v => v.v.toLocaleLowerCase('tr')).join(', '), 'Su geçirmez': D.waterproof ? 'Evet' : '', 'Taşıma şekli': D.carry && CARRY_LABEL[D.carry], 'Kısa açıklama': D.shortDescription };
    btn.disabled = true; btn.textContent = 'Yazılıyor…';
    try {
      const { data } = await sb.auth.getSession(); const t = data.session?.access_token; if (!t) throw new Error('Oturum kapandı.');
      const r = await fetch('/.netlify/functions/ai-product-image', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'describe', facts }) });
      const j = await r.json().catch(() => ({})); if (!r.ok || !j.long) throw new Error(j.message || 'Yanıt alınamadı');
      D.longDescription = safeHtml(j.long).replace(/<\/(p|h3|ul|li)>/g, '</$1>\n').trim();
      if (!D.shortDescription.trim() && j.short) D.shortDescription = j.short;
    } catch (e) { toast('Yapay zekâ yazamadı, şablon kullanıldı: ' + e.message.split(/[.\n]/)[0]); D.longDescription = autoDesc(); if (!D.shortDescription.trim()) D.shortDescription = autoShort(); }
    S.keepScroll = true; render();
  }
  // SEO: başlık ≤60, açıklama ≤160 karakter; boş alanlar doldurulur, yazılmış olanlara dokunulmaz
  function fillSeo() {
    const [noun] = productKind(), cut = (s, n) => s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1) > 0 ? s.lastIndexOf(' ', n - 1) : n).trim();
    const name = [D.brand, D.name].filter(Boolean).join(' ').replace(/^(\S+) \1/i, '$1');
    if (!D.seoTitle.trim()) D.seoTitle = cut(`${name} ${noun.charAt(0).toLocaleUpperCase('tr') + noun.slice(1)} | CLK Çanta`, 60);
    if (!D.seoDescription.trim()) D.seoDescription = cut(D.shortDescription.trim() || autoShort(), 160);
    if (!D.seoKeywords.trim()) D.seoKeywords = [...new Set([D.brand, D.name, noun, D.material, ...D.variants.map(v => `${v.v.toLocaleLowerCase('tr')} ${noun}`), ...String(D.categoryName).split('›')].map(s => String(s || '').trim().toLocaleLowerCase('tr')).filter(Boolean))].join(', ');
  }
  function autoShort() {
    const [noun] = productKind(), size = sizeLine();
    return [[D.brand, D.name].filter(Boolean).join(' '), [D.material, noun].filter(Boolean).join(' '), size, D.waterproof && 'su geçirmez'].filter(Boolean).join(' · ');
  }
  // Açıklama önizlemesi: yalnızca bilinen biçim etiketleri, nitelikler atılır (elle yazılan HTML de güvenle gösterilir)
  function safeHtml(html) {
    const ok = new Set(['P', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I', 'H3', 'H4', 'BR']);
    const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
    const walk = n => [...n.childNodes].map(c => c.nodeType === 3 ? esc(c.textContent) : c.nodeType === 1 ? (ok.has(c.tagName) ? `<${c.tagName.toLowerCase()}>${walk(c)}${c.tagName === 'BR' ? '' : `</${c.tagName.toLowerCase()}>`}` : walk(c)) : '').join('');
    return walk(doc.body.firstChild);
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
      const rel = await saveRelations(), relErr = rel.filter(r => r.includes(':'));
      say((j.message || 'Qukasoft’a gönderildi.') + (rel.length ? ` İlişkiler: ${rel.join(', ')}.` : ''), !relErr.length); toast(D.isNew ? 'Ürün Qukasoft’a yüklendi' : 'Ürün güncellendi');
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
    const rh = $('.olcu-rehber');
    if (rh) for (const k of Object.keys(OLCU)) {
      const el = document.querySelector(`input[data-k="${k}"]`); if (!el) continue;
      el.addEventListener('focus', () => { rh.dataset.aktif = k; });
      el.addEventListener('blur', () => { if (rh.dataset.aktif === k) delete rh.dataset.aktif; });
      el.addEventListener('input', () => { const t = rh.querySelector(`[data-yazi="${k}"]`); if (t) t.textContent = olcuYazi(k, el.value); });
      rh.querySelector(`[data-olcu="${k}"]`)?.addEventListener('click', () => el.focus());
    }
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
    $$('[data-ak]').forEach(el => el.addEventListener('input', () => { D.attrs[+el.closest('.vrow').dataset.i][el.dataset.ak] = el.value; }));
    $$('[data-ck]').forEach(el => el.addEventListener('input', () => { D.combines[+el.dataset.ck].text = el.value; D.rel.comb = true; }));
    $$('[data-cv]').forEach(el => el.addEventListener('change', () => { D.compat[el.dataset.cv] = el.value; }));
    $$('[data-gk]').forEach(el => el.addEventListener('input', () => { D.group[el.dataset.gk] = el.value; D.rel.grp = true; }));
    $$('[data-gl]').forEach(el => el.addEventListener('input', () => { D.group.items[+el.dataset.gl].text = el.value; D.rel.grp = true; }));
    loadRefs(); loadCombines();
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
    else if (act === 'edDescAi') aiDesc(el);
    else if (act === 'edDesc') { D.longDescription = autoDesc(); if (!D.shortDescription.trim()) D.shortDescription = autoShort(); S.keepScroll = true; render(); }
    else if (act === 'edVdel') { D.variants.splice(+el.dataset.i, 1); S.keepScroll = true; render(); }
    else if (act === 'edSim' || act === 'edComb') {
      const code = pickCode($('#' + el.dataset.in)?.value); if (!code) return toast('Listeden bir ürün seç.');
      if (act === 'edSim') { if (!D.similars.includes(code)) D.similars.push(code); D.rel.sim = true; }
      else { if (!D.combines.some(c => c.code === code)) D.combines.push({ code, text: '' }); D.rel.comb = true; }
      S.keepScroll = true; render();
    }
    else if (act === 'edGrp') {
      const code = pickCode($('#ed-grp')?.value); if (!code) return toast('Listeden bir ürün seç.');
      if (!D.group.items.some(c => c.code === code)) D.group.items.push({ code, text: '' }); D.rel.grp = true; S.keepScroll = true; render();
    }
    else if (act === 'edGrpDel') { D.group.items.splice(+el.dataset.i, 1); D.rel.grp = true; S.keepScroll = true; render(); }
    else if (act === 'edSimDel') { D.similars.splice(+el.dataset.i, 1); D.rel.sim = true; S.keepScroll = true; render(); }
    else if (act === 'edCombDel') { D.combines.splice(+el.dataset.i, 1); D.rel.comb = true; S.keepScroll = true; render(); }
    else if (act === 'edAttrAdd') { D.attrs.push({ n: '', v: '' }); S.keepScroll = true; render(); }
    else if (act === 'edAttrDel') { D.attrs.splice(+el.dataset.i, 1); S.keepScroll = true; render(); }
    else if (act === 'edSeo') { fillSeo(); S.keepScroll = true; render(); }
    else if (act === 'edShotDel') { delete D.shots[el.dataset.k]; S.keepScroll = true; render(); }
    else if (act === 'edCut') { const s = D.shots[el.dataset.k]; if (!s) return; const was = D.auto.cutout; D.auto.cutout = true; const src = s.raw || s.preview || s.url; (src.startsWith('data:') ? Promise.resolve(src) : portrait(src, false)).then(du => processShot(el.dataset.k, du)).finally(() => { D.auto.cutout = was; }); }
    else if (act === 'edModel') makeModel();
    else if (act === 'edAud') { D.audience = el.dataset.a; S.keepScroll = true; render(); }
    else if (act === 'edCarry') { D.carry = el.dataset.c; S.keepScroll = true; render(); }
    else if (act === 'edGallery') openGallery(+el.dataset.i || 0);
    else if (act === 'edSend') send(el);
    else if (act === 'edDraft') saveDraft();
  };
})();
