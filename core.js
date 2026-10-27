/* CLK Yönetim — çekirdek: ayarlar, veri bağlantısı, yardımcılar, kabuk ve yönlendirme */
window.CLK = (() => {
  const SB_URL = 'https://prkzzaqinfeptmmbkqsd.supabase.co';
  const SB_KEY = 'sb_publishable_0sbTUikCycbokrRbzxtBAg_JGTfJtr4';
  const FN = SB_URL + '/functions/v1/';
  const sb = window.supabase.createClient(SB_URL, SB_KEY);

  const RULES = { market: 3, retail: 2.5, quick: 25, d1: 25, d2: 20, d3: 15, stock: 10, critical: 3, desi: 5, desiValiz: 40, kdv: 10 };
  const S = {
    user: null, route: 'panel',
    products: [], pLoaded: false, pLoading: false, pErr: '', pAt: null, pProg: '',
    orders: [], oLoaded: false, oLoading: false, oErr: '',
    users: [], uLoaded: false, uLoading: false, uErr: '',
    balance: [], bLoaded: false, bLoading: false, bErr: '',
    categories: [],
    ui: {}
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tl = n => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0)) + ' ₺';
  const tl2 = n => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0) + ' ₺';
  const tlc = n => new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 2 }).format(Number(n) || 0) + ' ₺';
  const num = n => new Intl.NumberFormat('tr-TR').format(Math.round(Number(n) || 0));
  const dt = s => { const d = new Date(String(s || '').replace(' ', 'T')); return isNaN(d) ? '—' : d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }); };
  const dtt = s => { const d = new Date(String(s || '').replace(' ', 'T')); return isNaN(d) ? '—' : d.toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };
  function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), Math.max(2800, String(m).length * 70)); }

  /* ürün yardımcıları */
  const P = {
    qty: p => Number(p.quantity) || 0,
    on: p => String(p.status) === '1' || p.status === 1 || p.status === true,
    cat: p => [p.category1, p.category2, p.category3, p.category4].filter(Boolean).pop() || 'Kategorisiz',
    path: p => [p.category1, p.category2, p.category3, p.category4].filter(Boolean).join(' › ') || 'Kategorisiz',
    img: p => { const i = (Array.isArray(p.images) ? p.images : [])[0]; return typeof i === 'string' ? i : i?.imagesUrl || i?.imageUrl || i?.url || ''; },
    imgs: p => (Array.isArray(p.images) ? p.images : []).map(i => typeof i === 'string' ? i : i?.imagesUrl || i?.imageUrl || i?.url).filter(Boolean),
    crit: p => Number(p.criticalStockStatus) === 1 && Number(p.criticalStockQuantity) > 0 ? Number(p.criticalStockQuantity) : RULES.critical,
    vars: p => (Array.isArray(p.variants) ? p.variants : []).map(v => ({ n: [v.value1, v.value2, v.value3].filter(Boolean).join(' / '), q: Number(v.quantity) || 0, b: v.barcode || '' }))
  };
  P.state = p => (P.qty(p) <= 0 ? 'out' : P.qty(p) <= P.crit(p) ? 'low' : 'ok');

  /* fiyat kuralları */
  function end4999(v) { if (!(v > 0)) return 0; const n = Math.ceil(v), b = Math.floor(n / 100) * 100; for (const c of [b + 49, b + 99, b + 149]) if (c >= n) return c; return b + 149; }
  const r5 = x => Math.ceil(x / 5 - 1e-9) * 5;
  const prices = buy => { buy = Number(buy) || 0; return { market: end4999(buy * RULES.market), retail: end4999(buy * RULES.retail), quick: r5(buy * (1 + RULES.quick / 100)), d1: r5(buy * (1 + RULES.d1 / 100)), d2: r5(buy * (1 + RULES.d2 / 100)), d3: r5(buy * (1 + RULES.d3 / 100)) }; };
  const hex12 = p => { const h = '0123456789ABCDEF'; let s = p; for (let i = 0; i < 12; i++) s += h[Math.floor(Math.random() * 16)]; return s; };

  /* veri bağlantısı */
  async function token() { const { data } = await sb.auth.getSession(); return data.session?.access_token || null; }
  async function call(name, { method = 'GET', query, body } = {}) {
    const t = await token(); if (!t) throw new Error('Oturum kapandı. Yeniden giriş yap.');
    const url = new URL(FN + name); if (query) Object.entries(query).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));
    const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + t, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) throw new Error(j.message || 'İstek tamamlanamadı.');
    return j;
  }
  async function pagedData(type, size, onPage) {
    const all = []; let start = 0, total = Infinity, guard = 0;
    while (all.length < total && guard++ < 200) {
      const j = await call('clk-data', { query: { type, pageStart: start, pageSize: size, orderBy: 'id', sort: 'desc' } });
      const res = j.result || {}; const rows = res.list || [];
      all.push(...rows); total = Number(res.total) || all.length; onPage && onPage(all, total);
      if (rows.length < size) break; start += size;
    }
    return all;
  }
  async function loadProducts(force) {
    if (S.pLoading || (S.pLoaded && !force)) return; S.pLoading = true; S.pErr = ''; render();
    try {
      const all = []; let page = 0, total = Infinity;
      while (all.length < total && page < 80) {
        const j = await call('qukasoft-product-list', { query: { page, pageSize: 50, field: 'name', search: '' } });
        const rows = j.products || []; all.push(...rows); total = Number(j.total) || all.length;
        S.products = all.slice(); S.pProg = `${num(all.length)} / ${isFinite(total) ? num(total) : '…'}`; render();
        if (rows.length < 50) break; page++;
      }
      S.products = all; S.pLoaded = true; S.pAt = new Date();
    } catch (e) { S.pErr = e.message; }
    S.pLoading = false; render();
  }
  async function loadOrders(force) {
    if (S.oLoading || (S.oLoaded && !force)) return; S.oLoading = true; S.oErr = ''; render();
    try { S.orders = await pagedData('orders', 20, a => { S.orders = a.slice(); render(); }); S.oLoaded = true; } catch (e) { S.oErr = e.message; }
    S.oLoading = false; render();
  }
  async function loadUsers(force) {
    if (S.uLoading || (S.uLoaded && !force)) return; S.uLoading = true; S.uErr = ''; render();
    try { S.users = await pagedData('users', 100); S.uLoaded = true; } catch (e) { S.uErr = e.message; }
    S.uLoading = false; render();
  }
  async function loadBalance(force) {
    if (S.bLoading || (S.bLoaded && !force)) return; S.bLoading = true; S.bErr = ''; render();
    try { S.balance = await pagedData('balance', 100); S.bLoaded = true; } catch (e) { S.bErr = e.message; }
    S.bLoading = false; render();
  }
  async function loadCategories() {
    if (S.categories.length) return S.categories;
    try {
      const root = (await call('qukasoft-category-list', { query: { parentId: 0 } })).categories || [];
      const out = [];
      for (const c of root) {
        out.push({ id: c.id, name: c.name, path: c.name });
        try { ((await call('qukasoft-category-list', { query: { parentId: c.id } })).categories || []).forEach(k => out.push({ id: k.id, name: k.name, path: c.name + ' › ' + k.name })); } catch {}
      }
      S.categories = out;
    } catch {}
    return S.categories;
  }

  /* sipariş yardımcıları */
  const ORDER_STATUS = { 1: ['Yeni', 'gold'], 2: ['Hazırlanıyor', 'warn'], 3: ['Kargoda', 'info'], 4: ['Teslim edildi', 'ok'], 5: ['İade', 'bad'], 6: ['İptal', 'off'] };
  const O = {
    id: o => o.order?.id, code: o => o.order?.code || '', status: o => Number(o.order?.status) || 0,
    date: o => o.order?.createdAt, total: o => Number(o.summary?.overall) || 0,
    cust: o => o.customer?.name || [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') || o.customer?.title || 'Müşteri',
    userId: o => Number(o.order?.userId || o.user?.id) || 0,
    platform: o => o.order?.platform || 'Site',
    items: o => Array.isArray(o.products) ? o.products : [],
    counts: o => ![5, 6].includes(Number(o.order?.status) || 0)
  };
  const BAL_TYPE = { 0: ['Para girişi', 'in'], 1: ['Para çıkışı', 'out'], 2: ['Sipariş', 'out'], 3: ['Ödeme siparişi', 'in'], 4: ['Bakiye yükleme', 'in'], 5: ['XML aboneliği', 'out'], 6: ['Sipariş komisyonu', 'out'], 7: ['Bakiye düzeltme', 'adj'], 8: ['Bakiye düzeltme', 'adj'] };

  /* kabuk */
  const ICONS = {
    panel: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    urunler: '<svg viewBox="0 0 24 24"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    stok: '<svg viewBox="0 0 24 24"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 17l9 4 9-4"/></svg>',
    siparisler: '<svg viewBox="0 0 24 24"><path d="M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 9h6M9 13h6"/></svg>',
    musteriler: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/></svg>',
    cari: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
    banner: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="8.5" r="1.5"/></svg>',
    eslestirme: '<svg viewBox="0 0 24 24"><path d="M4 7h11l-3-3M20 17H9l3 3"/></svg>',
    esitle: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/></svg>',
    ekstre: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7M9 7h3"/></svg>',
    urunlistesi: '<svg viewBox="0 0 24 24"><path d="M9 5h11M9 12h11M9 19h11"/><path d="M4 5l1 1 2-2M4 12l1 1 2-2M4 19l1 1 2-2"/></svg>',
    westpolo: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    stokkart: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 13h8M8 16h5"/></svg>',
    cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'
  };
  const NAV = [['panel', 'Panel'], ['urunler', 'Ürünler'], ['stok', 'Stok'], ['siparisler', 'Siparişler'], ['musteriler', 'Müşteriler'], ['cari', 'Cari hesap'], ['banner', 'Banner'], ['eslestirme', 'Paraşüt'], ['westpolo', 'West Polo'], ['urunlistesi', 'Ürün listesi'], ['stokkart', 'Stok kartları'], ['ekstre', 'Müşteri ekstresi']];
  const views = {};
  // Paraşüt ↔ site eşitlemesini hemen çalıştırır (saatlik görevi beklemeden); işleyişi views-parasut.js'te
  const esitleBtn = () => `<button class="esitle" data-act="esitle" ${S.esitleniyor ? 'disabled' : ''}>${ICONS.esitle}<span>${S.esitleniyor ? 'Eşitleniyor…' : 'Şimdi eşitle'}</span></button>`;
  function shell(content) {
    const nav = NAV.map(([k, l]) => `<button data-go="${k}" ${S.route === k ? 'aria-current="page"' : ''}>${ICONS[k]}<span>${l}</span></button>`).join('');
    const more = ['siparisler', 'musteriler', 'cari'].includes(S.route);
    const mob = [['panel', 'Panel'], ['urunler', 'Ürünler'], ['yeni', 'Ekle'], ['siparisler', 'Sipariş'], ['daha', 'Daha']].map(([k, l]) => {
      const cur = S.route === k || (k === 'daha' && ['stok', 'musteriler', 'cari', 'banner', 'eslestirme', 'westpolo', 'urunlistesi', 'stokkart', 'ekstre'].includes(S.route));
      const ic = k === 'yeni' ? `<span class="ic">${ICONS.plus}</span>` : k === 'daha' ? ICONS.more : ICONS[k];
      return `<button data-go="${k}" class="${k === 'yeni' ? 'add' : ''}" ${cur ? 'aria-current="page"' : ''}>${ic}<span>${l}</span></button>`;
    }).join('');
    return `<div class="shell">
      <aside class="side"><div class="logo">CLK<small>ÇANTA · YÖNETİM</small></div>
        <nav class="nav">${nav}<button class="add" data-go="yeni">${ICONS.plus}<span>Yeni ürün</span></button>${esitleBtn()}</nav>
        <div class="foot"><b>${esc(S.user?.email || '')}</b><button class="link" data-act="logout">Çıkış yap</button></div></aside>
      <header class="mtop"><div class="logo">CLK</div><div class="mtop-acts"><button data-act="esitle" ${S.esitleniyor ? 'disabled' : ''}>${S.esitleniyor ? 'EŞİTLENİYOR…' : 'EŞİTLE'}</button><button data-act="logout">Çıkış</button></div></header>
      <main class="main" id="main">${content}</main>
      <nav class="mnav">${mob}</nav>
      <div class="sheet-more" id="more" hidden><div class="sheet-in">${[['stok', 'Stok'], ['musteriler', 'Müşteriler'], ['cari', 'Cari hesap'], ['siparisler', 'Siparişler'], ['banner', 'Banner'], ['eslestirme', 'Paraşüt'], ['westpolo', 'West Polo'], ['urunlistesi', 'Ürün listesi'], ['stokkart', 'Stok kartları'], ['ekstre', 'Müşteri ekstresi']].map(([k, l]) => `<button data-go="${k}">${ICONS[k]}<span>${l}</span></button>`).join('')}${esitleBtn()}</div></div></div>`;
  }
  const head = (eyebrow, title, sub, acts = '') => `<div class="page-h"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="acts">${acts}</div></div>`;
  const skel = () => `<div class="card"><div class="skel" style="height:110px"></div><div class="skel" style="height:240px;margin-top:14px"></div></div>`;
  const errBox = (msg, act) => `<div class="card empty"><h3>Veri alınamadı</h3><p>${esc(msg)}</p><button class="btn dark" data-act="${act}">Tekrar dene</button></div>`;

  function go(r, arg) {
    if (r === 'daha') { const m = $('#more'); if (m) m.hidden = !m.hidden; return; }
    S.route = r; S.arg = arg; try { history.replaceState(null, '', '#' + r); } catch {}
    render(); window.scrollTo({ top: 0 });
  }
  let raf = 0;
  function render() { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
  function draw() {
    const app = $('#app');
    if (!S.user) { app.className = ''; app.innerHTML = views.auth(); views.bindAuth(); return; }
    const v = views[S.route] || views.panel;
    const keepScroll = window.scrollY, focusId = document.activeElement?.id, sel = document.activeElement?.selectionStart;
    app.className = ''; app.innerHTML = shell(v());
    views['bind_' + S.route]?.();
    if (focusId) { const f = document.getElementById(focusId); if (f) { f.focus(); try { f.setSelectionRange(sel, sel); } catch {} } }
    if (S.keepScroll) window.scrollTo({ top: keepScroll }); S.keepScroll = false;
  }
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); go(g.dataset.go, g.dataset.arg); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act;
    if (act === 'logout') sb.auth.signOut();
    else if (act === 'reloadP') loadProducts(true);
    else if (act === 'reloadO') loadOrders(true);
    else if (act === 'reloadU') { loadUsers(true); loadBalance(true); }
    else if (act === 'reloadB') loadBalance(true);
    else views.onAct?.(act, a, e);
  });

  async function boot() {
    const { data } = await sb.auth.getSession();
    S.user = data.session?.user || null;
    const h = location.hash.slice(1); if (h && (views[h] || h === 'yeni')) S.route = h;
    sb.auth.onAuthStateChange((_e, session) => {
      const was = !!S.user; S.user = session?.user || null;
      if (S.user && !was) { S.route = S.route || 'panel'; prefetch(); }
      render();
    });
    window.addEventListener('hashchange', () => { const r = location.hash.slice(1); if (r && r !== S.route && (views[r] || r === 'yeni')) { S.route = r; render(); } });
    render(); if (S.user) prefetch();
  }
  function prefetch() { loadProducts(); loadOrders(); loadUsers(); loadBalance(); }

  return { sb, S, RULES, $, $$, esc, tl, tl2, tlc, num, dt, dtt, toast, P, O, ORDER_STATUS, BAL_TYPE, prices, hex12, call, loadProducts, loadOrders, loadUsers, loadBalance, loadCategories, head, skel, errBox, ICONS, views, go, render, boot };
})();
