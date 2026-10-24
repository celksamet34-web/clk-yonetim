/* CLK Yönetim — giriş, panel, ürünler, stok */
(() => {
  const { S, $, $$, esc, tl, tlc, num, dt, P, O, head, skel, errBox, views, go, render, sb, toast } = CLK;

  /* ---------- giriş ---------- */
  views.auth = () => `<div class="auth">
    <section class="auth-art"><div class="logo">CLK</div>
      <div><h1>Çanta işini tek ekrandan yönet.</h1><p>Stok, siparişler, müşteriler ve cari hesaplar Qukasoft ile eşleşik. Yeni ürünü telefonla fotoğraflayıp dakikalar içinde yayına al.</p></div>
      <small style="color:#7d766b;letter-spacing:.2em;font-size:10px">CLK ÇANTA · YÖNETİM</small></section>
    <section class="auth-form"><form class="auth-box" id="login">
      <h2>Giriş yap</h2><p class="sub">Ürün formunda kullandığın hesapla devam et.</p>
      <label class="f"><span>E-posta</span><input type="email" id="lg-mail" autocomplete="email" required></label>
      <label class="f"><span>Şifre</span><input type="password" id="lg-pass" autocomplete="current-password" required></label>
      <div id="lg-msg"></div>
      <button class="btn dark" type="submit" style="margin-top:6px">Giriş yap</button>
    </form></section></div>`;
  views.bindAuth = () => {
    $('#login').addEventListener('submit', async e => {
      e.preventDefault(); const b = e.target.querySelector('button'); b.disabled = true; b.textContent = 'Giriş yapılıyor…';
      const { error } = await sb.auth.signInWithPassword({ email: $('#lg-mail').value.trim(), password: $('#lg-pass').value });
      if (error) { $('#lg-msg').innerHTML = `<div class="msg err">E-posta veya şifre hatalı.</div>`; b.disabled = false; b.textContent = 'Giriş yap'; }
    });
  };

  /* ---------- satış hesapları ---------- */
  function salesStats(days) {
    const since = days ? Date.now() - days * 864e5 : 0;
    const by = {}; let rev = 0, cnt = 0, profit = 0;
    S.orders.filter(O.counts).forEach(o => {
      const t = new Date(String(O.date(o) || '').replace(' ', 'T')).getTime(); if (since && !(t >= since)) return;
      cnt++; rev += O.total(o);
      O.items(o).forEach(it => {
        const q = Number(it.netQuantity ?? it.quantity) || 0, line = Number(it.totalPriceIncVat ?? it.totalPrice) || 0;
        const cost = (Number(it.purchasePrice) || 0) * q; profit += (Number(it.totalPrice) || 0) - cost;
        const k = it.code || it.name; (by[k] ||= { code: it.code, name: it.name, q: 0, rev: 0 }); by[k].q += q; by[k].rev += line;
      });
    });
    return { rev, cnt, profit, top: Object.values(by).sort((a, b) => b.q - a.q || b.rev - a.rev) };
  }
  function monthly() {
    const m = {}; S.orders.filter(O.counts).forEach(o => { const d = new Date(String(O.date(o) || '').replace(' ', 'T')); if (isNaN(d)) return; const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); m[k] = (m[k] || 0) + O.total(o); });
    const now = new Date(), out = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); out.push({ k, label: d.toLocaleDateString('tr-TR', { month: 'short' }), v: m[k] || 0 }); }
    return out;
  }
  const prodByCode = () => { const m = {}; S.products.forEach(p => { m[p.code] = p; }); return m; };
  const thumb = p => p && P.img(p) ? `<img class="th" src="${esc(P.img(p))}" alt="" loading="lazy">` : '<span class="th"></span>';

  /* ---------- panel ---------- */
  views.panel = () => {
    const acts = `<button class="btn sm" data-act="reloadAll">Yenile</button><button class="btn dark sm" data-go="yeni">+ Yeni ürün</button>`;
    if (!S.products.length && !S.orders.length && (S.pLoading || S.oLoading)) return head('Genel bakış', 'Panel', 'Qukasoft verileri alınıyor…', acts) + skel();
    const PR = S.products, on = PR.filter(P.on);
    const cost = PR.reduce((a, p) => a + P.qty(p) * (+p.buyPrice || 0), 0);
    const out = on.filter(p => P.qty(p) <= 0), low = on.filter(p => P.state(p) === 'low');
    let per = 30, s30 = salesStats(30); if (!s30.cnt) { per = 90; s30 = salesStats(90); } if (!s30.cnt) { per = 365; s30 = salesStats(365); } const sAll = salesStats(0), mon = monthly(), mx = Math.max(1, ...mon.map(x => x.v));
    const pend = S.orders.filter(o => [1, 2].includes(O.status(o)));
    const debt = S.users.reduce((a, u) => a + Math.min(0, Number(u.balance) || 0), 0);
    const pm = prodByCode();
    const top = (s30.top.length ? s30.top : sAll.top).slice(0, 6);
    const alerts = [...out, ...low].slice(0, 6);
    return head('Genel bakış', 'Panel', `Son güncelleme ${CLK.S.pAt ? CLK.S.pAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'}`, acts) + `
    <div class="stack">
      <div class="kpis">
        <div class="kpi hero"><div class="k">Son ${per === 365 ? '12 ay' : per + ' gün'} ciro</div><div class="v">${tlc(s30.rev)}</div><div class="s">${num(s30.cnt)} sipariş · tahmini brüt kâr ${tlc(s30.profit)}</div></div>
        <div class="kpi"><div class="k">Bekleyen sipariş</div><div class="v">${num(pend.length)}</div><div class="s">yeni ve hazırlanan</div></div>
        <div class="kpi"><div class="k">Stok değeri</div><div class="v">${tlc(cost)}</div><div class="s">${num(PR.length)} ürün · alış fiyatıyla</div></div>
        <div class="kpi ${debt < 0 ? 'bad' : ''}"><div class="k">Açık cari</div><div class="v">${tlc(Math.abs(debt))}</div><div class="s">${num(S.users.filter(u => (Number(u.balance) || 0) < 0).length)} müşteri borçlu</div></div>
      </div>
      <div class="card"><div class="card-h"><div><h3>Kategoriler</h3><p class="sub">Üst kategoriler · seçince alt kategorilere ve ürünlere geçilir</p></div><button class="btn sm ghost" data-go="urunler">Tümü</button></div>${views.catTiles(S.products, true)}</div>
      <div class="grid2">
        <div class="card"><div class="card-h"><div><h3>Aylık ciro</h3><p class="sub">Son 6 ay · iade ve iptaller hariç</p></div></div>
          <div class="chart">${mon.map(x => `<div class="col"><div class="colbar" style="height:${Math.max(2, x.v / mx * 100)}%" title="${tl(x.v)}"><span>${x.v ? tlc(x.v) : ''}</span></div><small>${x.label}</small></div>`).join('')}</div></div>
        <div class="card"><div class="card-h"><div><h3>En çok satanlar</h3><p class="sub">${s30.top.length ? (per === 365 ? 'Son 12 ay' : 'Son ' + per + ' gün') : 'Tüm zamanlar'} · adet bazında</p></div><button class="btn sm ghost" data-go="siparisler">Siparişler</button></div>
          ${top.length ? `<ul class="rows">${top.map((t, i) => `<li data-edit="${esc(t.code)}"><span class="rank">${i + 1}</span><div class="t"><b>${esc(t.name)}</b><small>${esc(t.code)} · ${tl(t.rev)}</small></div><span class="pill gold">${num(t.q)} adet</span></li>`).join('')}</ul>` : '<p class="sub">Henüz satış yok.</p>'}</div>
      </div>
      <div class="grid2">
        <div class="card"><div class="card-h"><div><h3>Bekleyen siparişler</h3><p class="sub">Hazırlanması gereken siparişler</p></div></div>
          ${pend.length ? `<ul class="rows">${pend.slice(0, 6).map(o => `<li data-order="${O.id(o)}"><span class="th ord">${esc(String(O.code(o)).slice(-4))}</span><div class="t"><b>${esc(O.cust(o))}</b><small>${esc(O.code(o))} · ${dt(O.date(o))} · ${O.items(o).length} kalem</small></div><b class="num">${tl(O.total(o))}</b></li>`).join('')}</ul>` : '<p class="sub">Bekleyen sipariş yok.</p>'}</div>
        <div class="card"><div class="card-h"><div><h3>Stok uyarıları</h3><p class="sub">Aktif ürünlerde tükenen ve kritik seviyedekiler</p></div>${out.length + low.length ? `<button class="btn sm ghost" data-act="toAlerts">Tümü (${out.length + low.length})</button>` : ''}</div>
          ${alerts.length ? `<ul class="rows">${alerts.map(p => `<li data-edit="${esc(p.code)}">${thumb(p)}<div class="t"><b>${esc(p.name)}</b><small>${esc(p.code)} · ${esc(P.cat(p))}</small></div><span class="pill ${P.qty(p) <= 0 ? 'bad' : 'warn'}">${P.qty(p) <= 0 ? 'Tükendi' : P.qty(p) + ' adet'}</span></li>`).join('')}</ul>` : '<p class="sub">Uyarı yok.</p>'}</div>
      </div>
    </div>`;
  };
  views.bind_panel = () => {};

  /* ---------- ürünler: kategoriye göre ---------- */
  const U = (S.ui.p ||= { q: '', path: [], all: false, f: 'all', shown: 48 });
  const pathOf = p => [p.category1, p.category2, p.category3, p.category4].filter(Boolean).map(String);
  const under = (p, path) => { const a = pathOf(p); return path.every((x, i) => a[i] === x); };
  function filterProducts() {
    const q = U.q.trim().toLocaleLowerCase('tr');
    return S.products.filter(p => {
      if (U.f === 'on' && !P.on(p)) return false; if (U.f === 'off' && P.on(p)) return false;
      if (U.f === 'alert' && !(P.on(p) && P.state(p) !== 'ok')) return false; if (U.f === 'noimg' && P.img(p)) return false;
      if (q) { const h = [p.name, p.code, p.barcode, p.brand, ...P.vars(p).map(v => v.n + ' ' + v.b)].join(' ').toLocaleLowerCase('tr'); if (!h.includes(q)) return false; }
      return true;
    });
  }
  function tools() {
    const cats = [...new Set(S.products.map(P.cat))].sort((a, b) => a.localeCompare(b, 'tr'));
    const A = S.products, c = { all: A.length, on: A.filter(P.on).length, off: A.filter(p => !P.on(p)).length, alert: A.filter(p => P.on(p) && P.state(p) !== 'ok').length, noimg: A.filter(p => !P.img(p)).length };
    return `<div class="tools"><input type="search" id="pq" placeholder="Ad, kod, barkod, marka veya renk ara" value="${esc(U.q)}">
</div>
      <div class="chips">${[['all', 'Tümü'], ['on', 'Aktif'], ['off', 'Pasif'], ['alert', 'Stok uyarısı'], ['noimg', 'Görselsiz']].map(([k, l]) => `<button class="chip" data-pf="${k}" aria-pressed="${U.f === k}">${l} <b>${c[k]}</b></button>`).join('')}</div>`;
  }
  function groupsAt(list, path) {
    const lvl = path.length, g = {}; let direct = 0;
    list.forEach(p => {
      if (!under(p, path)) return; const a = pathOf(p), k = a[lvl];
      if (!k) { direct++; return; }
      const o = (g[k] ||= { name: k, n: 0, q: 0, v: 0, alert: 0, subs: new Set() }); o.n++; o.q += P.qty(p); o.v += P.qty(p) * (+p.buyPrice || 0);
      if (P.on(p) && P.state(p) !== 'ok') o.alert++; if (a[lvl + 1]) o.subs.add(a[lvl + 1]);
    });
    return { groups: Object.values(g).sort((a, b) => a.name.localeCompare(b.name, 'tr')), direct };
  }
  views.catTiles = (list, compact, path = []) => `<div class="ctiles ${compact ? 'compact' : ''}">${groupsAt(list, path).groups.map(c => `<button class="ctile" data-act="pickCat" data-cat="${esc(JSON.stringify(path.concat(c.name)))}">
      <b>${esc(c.name)}</b>
      <div class="cm"><span>${num(c.n)} ürün</span><span>${num(c.q)} adet</span>${c.subs.size ? `<span>${c.subs.size} alt kategori</span>` : ''}</div>
      <div class="cf"><span class="cv">${tlc(c.v)}</span>${c.alert ? `<span class="pill warn">${c.alert} uyarı</span>` : ''}</div></button>`).join('')}</div>`;
  const crumbs = () => `<nav class="crumbs"><button data-act="pickCat" data-cat="[]">Kategoriler</button>${U.path.map((x, i) => `<span>›</span><button data-act="pickCat" data-cat="${esc(JSON.stringify(U.path.slice(0, i + 1)))}" ${i === U.path.length - 1 ? 'aria-current="page"' : ''}>${esc(x)}</button>`).join('')}</nav>`;
  views.urunler = () => {
    const acts = `<button class="btn sm" data-act="reloadP" ${S.pLoading ? 'disabled' : ''}>${S.pLoading ? 'Yükleniyor ' + S.pProg : 'Yenile'}</button><button class="btn dark sm" data-go="yeni">+ Yeni ürün</button>`;
    if (S.pErr && !S.products.length) return head('Katalog', 'Ürünler', '', acts) + errBox(S.pErr, 'reloadP');
    if (!S.products.length) return head('Katalog', 'Ürünler', 'Qukasoft ürünleri alınıyor…', acts) + skel();
    const L = filterProducts(), searching = !!U.q.trim();
    const here = L.filter(p => under(p, U.path));
    const { groups, direct } = groupsAt(L, U.path);
    if (!searching && !U.all && groups.length) {
      const title = U.path.length ? esc(U.path[U.path.length - 1]) : 'Kategoriler';
      const sub = U.path.length ? `${groups.length} alt kategori · ${num(here.length)} ürün` : `${groups.length} üst kategori · ${num(L.length)} ürün. Fotoğrafları görmek için kategori seç.`;
      return head('Katalog', title, sub, acts) + (U.path.length ? crumbs() : '') + tools() + views.catTiles(L, false, U.path) +
        (U.path.length ? `<div class="more"><button class="btn" data-act="showAll">Bu kategorinin tüm ürünlerini göster (${num(here.length)})${direct ? ' · ' + direct + ' alt kategorisiz' : ''}</button></div>` : '');
    }
    const items = (searching ? L : here).sort((a, b) => String(a.name).localeCompare(String(b.name), 'tr'));
    const val = items.reduce((a, p) => a + P.qty(p) * (+p.buyPrice || 0), 0), stock = items.reduce((a, p) => a + P.qty(p), 0);
    const title = searching ? 'Arama sonuçları' : esc(U.path[U.path.length - 1] || 'Tüm ürünler');
    return head('Katalog', title, `${num(items.length)} ürün · ${num(stock)} adet · stok değeri ${tlc(val)}`, acts) + (searching ? '' : crumbs()) + tools() +
      (items.length ? `<div class="pgrid">${items.slice(0, U.shown).map(card).join('')}</div>` : '<div class="card empty"><h3>Ürün bulunamadı</h3><p>Filtreyi değiştir ya da aramayı temizle.</p></div>') +
      (items.length > U.shown ? `<div class="more"><button class="btn" data-act="pMore">Daha fazla göster (${num(items.length - U.shown)})</button></div>` : '');
  };
  function card(p) {
    const st = P.state(p), im = P.img(p);
    const badge = !P.on(p) ? '<span class="pill off">Pasif</span>' : st === 'out' ? '<span class="pill bad">Tükendi</span>' : st === 'low' ? '<span class="pill warn">Kritik</span>' : '';
    const v = P.vars(p);
    return `<button class="pc" data-edit="${esc(p.code)}"><div class="im">${im ? `<img src="${esc(im)}" alt="" loading="lazy">` : '<span class="ph">CLK</span>'}${badge}</div>
      <div class="bd"><div class="nm">${esc(p.name)}</div><div class="cd">${esc(p.code)}${v.length ? ' · ' + v.length + ' renk' : ''}</div>
      <div class="ft"><span class="pr">${tl(p.salePrice)}</span><span class="st ${st !== 'ok' ? 'low' : ''}">${num(P.qty(p))} adet</span></div></div></button>`;
  }
  views.bind_urunler = () => {
    const q = $('#pq'); if (q) q.addEventListener('input', () => { U.q = q.value; U.shown = 48; clearTimeout(q.t); q.t = setTimeout(render, 220); });
    $$('[data-pf]').forEach(b => b.addEventListener('click', () => { U.f = b.dataset.pf; U.shown = 48; render(); }));
  };

  /* ---------- stok ---------- */
  const T = (S.ui.s ||= { q: '', cat: '', f: 'all', sort: 'cat', shown: 80 });
  views.stok = () => {
    const acts = `<button class="btn sm" data-act="reloadP" ${S.pLoading ? 'disabled' : ''}>${S.pLoading ? 'Yükleniyor' : 'Yenile'}</button>`;
    if (S.pErr && !S.products.length) return head('Depo', 'Stok', '', acts) + errBox(S.pErr, 'reloadP');
    if (!S.products.length) return head('Depo', 'Stok', 'Alınıyor…', acts) + skel();
    const q = T.q.trim().toLocaleLowerCase('tr');
    let L = S.products.filter(p => {
      if (T.f === 'alert' && !(P.on(p) && P.state(p) !== 'ok')) return false; if (T.f === 'out' && P.qty(p) > 0) return false;
      if (T.f === 'on' && !P.on(p)) return false; if (T.cat && P.cat(p) !== T.cat) return false;
      if (q) { const h = [p.name, p.code, p.barcode, ...P.vars(p).map(v => v.n + ' ' + v.b)].join(' ').toLocaleLowerCase('tr'); if (!h.includes(q)) return false; }
      return true;
    });
    const sorters = { cat: p => P.cat(p).toLocaleLowerCase('tr') + '\u0000' + String(p.name).toLocaleLowerCase('tr'), value: p => -P.qty(p) * (+p.buyPrice || 0), low: p => P.qty(p), high: p => -P.qty(p) };
    const fn = sorters[T.sort] || sorters.cat; L.sort((a, b) => (fn(a) > fn(b) ? 1 : fn(a) < fn(b) ? -1 : 0));
    const units = L.reduce((a, p) => a + P.qty(p), 0), cost = L.reduce((a, p) => a + P.qty(p) * (+p.buyPrice || 0), 0), sale = L.reduce((a, p) => a + P.qty(p) * (+p.salePrice || 0), 0);
    const cats = [...new Set(S.products.map(P.cat))].sort((a, b) => a.localeCompare(b, 'tr'));
    const pill = p => !P.on(p) ? '<span class="pill off">Pasif</span>' : P.state(p) === 'out' ? '<span class="pill bad">Tükendi</span>' : P.state(p) === 'low' ? '<span class="pill warn">Kritik</span>' : '<span class="pill ok">Yeterli</span>';
    const rows = L.slice(0, T.shown).map((p, i, arr) => (T.sort === 'cat' && (i === 0 || P.cat(arr[i - 1]) !== P.cat(p)) ? `<tr class="grp"><td colspan="8">${esc(P.cat(p))}<span>${num(L.filter(x => P.cat(x) === P.cat(p)).length)} ürün</span></td></tr>` : '') +
      `<tr class="row" data-edit="${esc(p.code)}"><td>${thumb(p)}</td><td><b>${esc(p.name)}</b><br><small class="mut">${esc(p.code)}</small></td><td><div class="vt">${P.vars(p).map(v => `<span>${esc(v.n)} · ${v.q}</span>`).join('')}</div></td>
       <td class="r"><b>${num(P.qty(p))}</b></td><td class="r">${tl(p.buyPrice)}</td><td class="r">${tl(p.salePrice)}</td><td class="r">${tl(P.qty(p) * (+p.buyPrice || 0))}</td><td>${pill(p)}</td></tr>`).join('');
    return head('Depo', 'Stok', `${num(L.length)} ürün`, acts) + `
      <div class="mini-kpis"><div><span>Stok adedi</span><b>${num(units)}</b></div><div><span>Alış değeri</span><b>${tl(cost)}</b></div><div><span>Satış değeri</span><b>${tl(sale)}</b></div><div><span>Potansiyel kâr</span><b>${tl(sale - cost)}</b></div></div>
      <div class="card"><div class="tools"><input type="search" id="sq" placeholder="Ad, kod, barkod veya renk ara" value="${esc(T.q)}">
        <select id="scat"><option value="">Tüm kategoriler</option>${cats.map(x => `<option ${x === T.cat ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <select id="ssort">${[['cat', 'Kategoriye göre'], ['value', 'Stok değeri'], ['low', 'Stok (azdan)'], ['high', 'Stok (çoktan)']].map(([k, l]) => `<option value="${k}" ${T.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="chips">${[['all', 'Tümü'], ['on', 'Aktif'], ['alert', 'Uyarı'], ['out', 'Tükendi']].map(([k, l]) => `<button class="chip" data-sf="${k}" aria-pressed="${T.f === k}">${l}</button>`).join('')}</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Ürün</th><th>Renk stokları</th><th class="r">Stok</th><th class="r">Alış</th><th class="r">Satış</th><th class="r">Değer</th><th>Durum</th></tr></thead><tbody>${rows}</tbody></table></div>
        ${L.length > T.shown ? `<div class="more"><button class="btn" data-act="sMore">Daha fazla (${num(L.length - T.shown)})</button></div>` : ''}</div>`;
  };
  views.bind_stok = () => {
    const q = $('#sq'); if (q) q.addEventListener('input', () => { T.q = q.value; T.shown = 80; clearTimeout(q.t); q.t = setTimeout(render, 220); });
    $('#scat')?.addEventListener('change', e => { T.cat = e.target.value; render(); });
    $('#ssort')?.addEventListener('change', e => { T.sort = e.target.value; render(); });
    $$('[data-sf]').forEach(b => b.addEventListener('click', () => { T.f = b.dataset.sf; T.shown = 80; render(); }));
  };

  /* ortak eylemler */
  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'reloadAll') { CLK.loadProducts(true); CLK.loadOrders(true); CLK.loadUsers(true); CLK.loadBalance(true); }
    else if (act === 'pMore') { U.shown += 48; S.keepScroll = true; render(); }
    else if (act === 'sMore') { T.shown += 80; S.keepScroll = true; render(); }
    else if (act === 'toAlerts') { T.f = 'alert'; go('stok'); }
    else if (act === 'pickCat') { try { U.path = JSON.parse(el.dataset.cat); } catch { U.path = []; } U.all = false; U.q = ''; U.shown = 48; go('urunler'); }
    else if (act === 'showAll') { U.all = true; U.shown = 48; render(); }
    else prevAct?.(act, el, e);
  };
  document.addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]'); if (ed) { go('duzenle', ed.dataset.edit); return; }
    const od = e.target.closest('[data-order]'); if (od) { go('siparis', od.dataset.order); return; }
    const us = e.target.closest('[data-user]'); if (us) { go('musteri', us.dataset.user); }
  });
})();
