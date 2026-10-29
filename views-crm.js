/* CLK Yönetim — siparişler, müşteriler, cari hesap */
(() => {
  const { S, $, $$, esc, tl, tl2, tlc, num, dt, dtt, P, O, ORDER_STATUS, BAL_TYPE, head, skel, errBox, views, go, render } = CLK;
  const st = s => { const [l, c] = ORDER_STATUS[s] || ['—', 'off']; return `<span class="pill ${c}">${l}</span>`; };
  const userName = u => [u.name, u.lastname].filter(Boolean).join(' ') || u.title || u.email || 'Müşteri';
  const userById = id => S.users.find(u => Number(u.id) === Number(id));
  const ordersOf = id => S.orders.filter(o => O.userId(o) === Number(id));
  const balOf = id => S.balance.filter(b => Number(b.userId) === Number(id));
  const sign = b => { const t = (BAL_TYPE[b.type] || ['', 'adj'])[1]; return t === 'in' ? 1 : t === 'out' ? -1 : (Number(b.price) >= 0 ? 1 : -1); };

  /* ---------- siparişler ---------- */
  const F = (S.ui.o ||= { q: '', s: 0, plat: '', shown: 40 });
  views.siparisler = () => {
    const acts = `<button class="btn sm" data-act="reloadO" ${S.oLoading ? 'disabled' : ''}>${S.oLoading ? 'Yükleniyor ' + num(S.orders.length) : 'Yenile'}</button>`;
    if (S.oErr && !S.orders.length) return head('Satış', 'Siparişler', '', acts) + errBox(S.oErr, 'reloadO');
    if (!S.orders.length) return head('Satış', 'Siparişler', 'Qukasoft siparişleri alınıyor…', acts) + skel();
    if (F.s > 4) F.s = 0;
    const q = F.q.trim().toLocaleLowerCase('tr');
    const T = S.orders.filter(O.counts); // iade ve iptaller listede gösterilmez
    const L = T.filter(o => (!F.s || (F.s === -1 ? [1, 2].includes(O.status(o)) : O.status(o) === F.s)) && (!F.plat || O.platform(o) === F.plat) &&
      (!q || [O.code(o), O.cust(o), o.customer?.phone, o.customer?.email, ...O.items(o).map(i => i.name + ' ' + i.code)].join(' ').toLocaleLowerCase('tr').includes(q)));
    const valid = L.filter(O.counts), rev = valid.reduce((a, o) => a + O.total(o), 0);
    const cnt = s => T.filter(o => O.status(o) === s).length;
    const plats = [...new Set(T.map(O.platform))];
    return head('Satış', 'Siparişler', `${num(T.length)} sipariş · Qukasoft`, acts) + `
      <div class="mini-kpis"><div><span>Listelenen</span><b>${num(L.length)}</b></div><div><span>Ciro</span><b>${tl(rev)}</b></div><div><span>Ortalama sepet</span><b>${tl(valid.length ? rev / valid.length : 0)}</b></div><div><span>Bekleyen</span><b>${num(cnt(1) + cnt(2))}</b></div></div>
      <div class="card"><div class="tools"><input type="search" id="oq" placeholder="Sipariş no, müşteri, telefon veya ürün ara" value="${esc(F.q)}">
        ${plats.length > 1 ? `<select id="oplat"><option value="">Tüm kanallar</option>${plats.map(p => `<option ${p === F.plat ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>` : ''}</div>
        <div class="chips">${[[0, 'Tümü'], [-1, 'Bekleyen'], [1, 'Yeni'], [2, 'Hazırlanıyor'], [3, 'Kargoda'], [4, 'Teslim']].map(([k, l]) => `<button class="chip" data-os="${k}" aria-pressed="${F.s === k}">${l} <b>${k === -1 ? cnt(1) + cnt(2) : k ? cnt(k) : T.length}</b></button>`).join('')}</div>
        <div class="olist">${L.slice(0, F.shown).map(o => `<button class="orow" data-order="${O.id(o)}">
          <div class="o1"><b>${esc(O.cust(o))}</b><small>${esc(O.code(o))} · ${dtt(O.date(o))} · ${esc(O.platform(o))}</small></div>
          <div class="o2">${O.items(o).slice(0, 3).map(i => `<span>${esc(i.name)} ×${num(i.quantity)}</span>`).join('')}${O.items(o).length > 3 ? `<span>+${O.items(o).length - 3}</span>` : ''}</div>
          <div class="o3"><b class="num">${tl(O.total(o))}</b>${st(O.status(o))}</div></button>`).join('') || '<p class="empty">Bu filtreye uyan sipariş yok.</p>'}</div>
        ${L.length > F.shown ? `<div class="more"><button class="btn" data-act="oMore">Daha fazla (${num(L.length - F.shown)})</button></div>` : ''}</div>`;
  };
  views.bind_siparisler = () => {
    const q = $('#oq'); q?.addEventListener('input', () => { F.q = q.value; F.shown = 40; clearTimeout(q.t); q.t = setTimeout(render, 220); });
    $('#oplat')?.addEventListener('change', e => { F.plat = e.target.value; render(); });
    $$('[data-os]').forEach(b => b.addEventListener('click', () => { F.s = Number(b.dataset.os); F.shown = 40; render(); }));
  };

  views.siparis = () => {
    const o = S.orders.find(x => String(O.id(x)) === String(S.arg));
    const geri = `<button class="btn sm" data-go="siparisler">← Siparişler</button>`;
    if (!o) return head('Sipariş', 'Bulunamadı', '', geri) + (S.oLoading ? skel() : '<div class="card empty"><h3>Sipariş bulunamadı</h3></div>');
    const d = o.order || {}, c = o.customer || {}, s = o.summary || {}, items = O.items(o);
    const cost = items.reduce((a, i) => a + (Number(i.purchasePrice) || 0) * (Number(i.netQuantity ?? i.quantity) || 0), 0);
    const pm = {}; S.products.forEach(p => { pm[p.code] = p; });
    const id = esc(O.id(o)), acik = ![5, 6].includes(O.status(o)), is = OI.id === String(O.id(o)) ? OI : {};
    const back = (acik ? `<button class="btn sm danger" data-act="oIptal" data-id="${id}" ${is.is ? 'disabled' : ''}>${is.is === 'iptal' ? 'İptal ediliyor…' : is.onay ? 'Evet, iptal et' : 'İptal et'}</button>
      <button class="btn sm" data-act="oDuzelt" data-id="${id}" ${is.is ? 'disabled' : ''}>${is.is === 'duzelt' ? 'Yükleniyor…' : 'Düzelt'}</button>` : '')
      + `<button class="btn sm gold" data-act="oYazdir" data-id="${id}">Yazdır</button>` + geri;
    const uyari = is.mesaj ? `<div class="card o-uyari"><p>${esc(is.mesaj)}</p></div>` : is.onay ? `<div class="card o-uyari"><p>Sipariş sitede <b>iptal</b> edilecek, tutarı (${tl2(O.total(o))}) müşterinin carisine geri döner. Onaylamak için <b>Evet, iptal et</b>'e basın.</p></div>` : '';
    return head('Sipariş · ' + esc(d.platform || 'Site'), esc(d.code || ''), `${dtt(d.createdAt)} · ${st(Number(d.status))}`, back) + uyari + `
      <div class="ed"><div class="stack">
        <div class="card"><div class="card-h"><div><h3>Ürünler</h3><p class="sub">${items.length} kalem</p></div></div>
          <ul class="rows">${items.map(i => { const p = pm[i.code]; return `<li ${p ? `data-edit="${esc(i.code)}"` : ''}>${p && P.img(p) ? `<img class="th" src="${esc(P.img(p))}" alt="">` : '<span class="th"></span>'}<div class="t"><b>${esc(i.name)}</b><small>${esc(i.code)}${i.variants ? ' · ' + esc(typeof i.variants === 'string' ? i.variants : Object.values(i.variants || {}).join(' / ')) : ''} · ${num(i.quantity)} × ${tl2(i.priceIncVat ?? i.price)}</small></div><b class="num">${tl2(i.totalPriceIncVat ?? i.totalPrice)}</b></li>`; }).join('')}</ul></div>
        <div class="card"><h3>Teslimat ve fatura</h3><div class="info2">
          <div><span>Teslimat adresi</span><p>${esc([c.delivery?.address, c.delivery?.district, c.delivery?.city].filter(Boolean).join(', ') || '—')}</p></div>
          <div><span>Fatura adresi</span><p>${esc([c.invoice?.address, c.invoice?.district, c.invoice?.city].filter(Boolean).join(', ') || '—')}</p></div>
          <div><span>Kargo</span><p>${esc(d.shipmentFirmName || '—')}${d.shipmentCode2 ? ' · ' + esc(d.shipmentCode2) : ''}</p>${d.shipmentUrl ? `<a href="${esc(d.shipmentUrl)}" target="_blank" rel="noopener" class="link">Kargo takibi</a>` : ''}</div>
          <div><span>Ödeme</span><p>${esc(d.paymentMethod || '—')}${Number(d.paymentInstallments) > 1 ? ' · ' + esc(d.paymentInstallments) + ' taksit' : ''}</p></div>
          ${d.customerNote ? `<div class="wide"><span>Müşteri notu</span><p>${esc(d.customerNote)}</p></div>` : ''}
          ${d.einvoiceCode ? `<div><span>E-fatura</span><p>${esc(d.einvoiceCode)}</p></div>` : ''}</div></div>
      </div>
      <aside class="summary"><div class="sum-card">
        <h3>${esc(O.cust(o))}</h3>
        <dl><dt>Telefon</dt><dd>${esc(c.phone || '—')}</dd><dt>E-posta</dt><dd style="word-break:break-all">${esc(c.email || '—')}</dd>${c.taxId ? `<dt>Vergi no</dt><dd>${esc(c.taxId)}</dd>` : ''}</dl>
        <hr class="sep"><dl><dt>Ara toplam</dt><dd>${tl2(s.subTotal ?? s.total)}</dd>${Number(s.discount) ? `<dt>İndirim</dt><dd>−${tl2(s.discount)}</dd>` : ''}${(s.taxes || []).map(t => `<dt>KDV %${esc(t.rate)}</dt><dd>${tl2(t.amount)}</dd>`).join('')}<dt>Tahmini maliyet</dt><dd>${tl2(cost)}</dd></dl>
        <div><small style="color:#a99f90;letter-spacing:.16em;font-size:10px;font-weight:700">GENEL TOPLAM</small><div class="big">${tl2(s.overall)}</div></div>
        ${O.userId(o) && userById(O.userId(o)) ? `<button class="btn gold" data-user="${O.userId(o)}">Müşteri kartını aç</button>` : ''}
      </div></aside></div>`;
  };

  /* ---------- müşteriler ---------- */
  const M = (S.ui.u ||= { q: '', f: 'all', sort: 'spend' });
  function custStats(u) {
    const os = ordersOf(u.id).filter(O.counts); const spend = os.reduce((a, o) => a + O.total(o), 0);
    const last = os.map(O.date).sort().pop();
    return { n: os.length, spend, last };
  }
  views.musteriler = () => {
    const acts = `<button class="btn sm" data-act="reloadU" ${S.uLoading ? 'disabled' : ''}>${S.uLoading ? 'Yükleniyor' : 'Yenile'}</button>`;
    if (S.uErr && !S.users.length) return head('İlişkiler', 'Müşteriler', '', acts) + errBox(S.uErr, 'reloadU');
    if (!S.users.length) return head('İlişkiler', 'Müşteriler', 'Alınıyor…', acts) + skel();
    const q = M.q.trim().toLocaleLowerCase('tr');
    let L = S.users.map(u => ({ u, s: custStats(u) })).filter(({ u }) => {
      if (M.f === 'dealer' && Number(u.dealerStatus) !== 1) return false;
      if (M.f === 'debt' && !((Number(u.balance) || 0) < 0)) return false;
      if (M.f === 'pending' && Number(u.dealerStatus) !== 2) return false;
      return !q || [userName(u), u.title, u.email, u.phone, u.code, u.taxId, u.invoice?.city].join(' ').toLocaleLowerCase('tr').includes(q);
    });
    const sorters = { spend: x => -x.s.spend, balance: x => Number(x.u.balance) || 0, name: x => userName(x.u).toLocaleLowerCase('tr'), recent: x => -(new Date(String(x.u.createdAt || '').replace(' ', 'T')).getTime() || 0) };
    const fn = sorters[M.sort]; L.sort((a, b) => (fn(a) > fn(b) ? 1 : fn(a) < fn(b) ? -1 : 0));
    const dealers = S.users.filter(u => Number(u.dealerStatus) === 1).length, debtors = S.users.filter(u => (Number(u.balance) || 0) < 0);
    const ini = u => (userName(u).match(/\p{L}/gu) || ['?']).slice(0, 2).join('').toLocaleUpperCase('tr');
    return head('İlişkiler', 'Müşteriler', `${num(S.users.length)} kayıt`, acts) + `
      <div class="mini-kpis"><div><span>Müşteri</span><b>${num(S.users.length)}</b></div><div><span>Aktif bayi</span><b>${num(dealers)}</b></div><div><span>Borçlu</span><b>${num(debtors.length)}</b></div><div><span>Toplam alacak</span><b>${tl(Math.abs(debtors.reduce((a, u) => a + Number(u.balance), 0)))}</b></div></div>
      <div class="card"><div class="tools"><input type="search" id="uq" placeholder="Ad, ünvan, telefon, e-posta, vergi no veya şehir ara" value="${esc(M.q)}">
        <select id="usort">${[['spend', 'En çok alışveriş'], ['balance', 'Borç (çoktan)'], ['recent', 'En yeni kayıt'], ['name', 'Ada göre']].map(([k, l]) => `<option value="${k}" ${M.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="chips">${[['all', 'Tümü'], ['dealer', 'Bayiler'], ['pending', 'Bayilik onayı bekleyen'], ['debt', 'Borçlu']].map(([k, l]) => `<button class="chip" data-uf="${k}" aria-pressed="${M.f === k}">${l}</button>`).join('')}</div>
        <div class="clist">${L.map(({ u, s }) => { const bal = Number(u.balance) || 0; return `<button class="crow" data-user="${u.id}">
          <span class="av">${esc(ini(u))}</span><div class="c1"><b>${esc(userName(u))}</b><small>${esc(u.title && u.title !== userName(u) ? u.title + ' · ' : '')}${esc(u.phone || u.email || '')}${u.invoice?.city ? ' · ' + esc(u.invoice.city) : ''}</small></div>
          <div class="c2"><span>${num(s.n)} sipariş</span><b>${tl(s.spend)}</b></div>
          <div class="c3">${Number(u.dealerStatus) === 1 ? '<span class="pill gold">Bayi</span>' : Number(u.dealerStatus) === 2 ? '<span class="pill warn">Onay bekliyor</span>' : ''}<b class="num ${bal < 0 ? 'neg' : bal > 0 ? 'pos' : ''}">${tl2(bal)}</b></div></button>`; }).join('') || '<p class="empty">Müşteri bulunamadı.</p>'}</div></div>`;
  };
  views.bind_musteriler = () => {
    const q = $('#uq'); q?.addEventListener('input', () => { M.q = q.value; clearTimeout(q.t); q.t = setTimeout(render, 220); });
    $('#usort')?.addEventListener('change', e => { M.sort = e.target.value; render(); });
    $$('[data-uf]').forEach(b => b.addEventListener('click', () => { M.f = b.dataset.uf; render(); }));
  };

  views.musteri = () => {
    const u = userById(S.arg); const back = `<button class="btn sm" data-go="musteriler">← Müşteriler</button>`;
    if (!u) return head('Müşteri', 'Bulunamadı', '', back) + (S.uLoading ? skel() : '<div class="card empty"><h3>Müşteri bulunamadı</h3></div>');
    const s = custStats(u), os = ordersOf(u.id), bs = balOf(u.id), bal = Number(u.balance) || 0;
    const prices = { 0: 'Varsayılan', 2: 'Bayi fiyatı 1', 3: 'Bayi fiyatı 2', 4: 'Bayi fiyatı 3', 5: 'Bayi fiyatı 4' };
    const fav = {}; os.filter(O.counts).forEach(o => O.items(o).forEach(i => { (fav[i.code] ||= { name: i.name, code: i.code, q: 0 }).q += Number(i.netQuantity ?? i.quantity) || 0; }));
    const favs = Object.values(fav).sort((a, b) => b.q - a.q).slice(0, 5);
    return head(Number(u.dealerStatus) === 1 ? 'Bayi' : 'Müşteri', esc(userName(u)), `${esc(u.code || '')}${u.createdAt ? ' · Kayıt ' + dt(u.createdAt) : ''}${u.lastLoginAt ? ' · Son giriş ' + dt(u.lastLoginAt) : ''}`, back) + `
      <div class="ed"><div class="stack">
        <div class="mini-kpis"><div><span>Sipariş</span><b>${num(s.n)}</b></div><div><span>Toplam alışveriş</span><b>${tl(s.spend)}</b></div><div><span>Ortalama sepet</span><b>${tl(s.n ? s.spend / s.n : 0)}</b></div><div><span>Son sipariş</span><b>${s.last ? dt(s.last) : '—'}</b></div></div>
        <div class="card"><div class="card-h"><div><h3>Siparişleri</h3><p class="sub">${os.length} sipariş</p></div></div>
          ${os.length ? `<div class="olist">${os.map(o => `<button class="orow" data-order="${O.id(o)}"><div class="o1"><b>${esc(O.code(o))}</b><small>${dtt(O.date(o))} · ${O.items(o).length} kalem</small></div><div class="o2">${O.items(o).slice(0, 2).map(i => `<span>${esc(i.name)} ×${num(i.quantity)}</span>`).join('')}</div><div class="o3"><b class="num">${tl(O.total(o))}</b>${st(O.status(o))}</div></button>`).join('')}</div>` : '<p class="sub">Sipariş yok.</p>'}</div>
        <div class="card"><div class="card-h"><div><h3>Cari hareketler</h3><p class="sub">${bs.length} hareket</p></div></div>${ledger(bs, false)}</div>
      </div>
      <aside class="summary"><div class="sum-card">
        <div><small style="color:#a99f90;letter-spacing:.16em;font-size:10px;font-weight:700">GÜNCEL BAKİYE</small><div class="big" style="color:${bal < 0 ? '#f0a39a' : 'var(--gold-2)'}">${tl2(bal)}</div><small style="color:#a99f90">${bal < 0 ? 'Müşterinin borcu' : bal > 0 ? 'Müşterinin alacağı' : 'Hesap kapalı'}</small></div>
        <dl><dt>Telefon</dt><dd>${esc(u.phone || '—')}</dd><dt>E-posta</dt><dd style="word-break:break-all">${esc(u.email || '—')}</dd>
          ${u.taxId ? `<dt>Vergi</dt><dd>${esc(u.taxBranch || '')} ${esc(u.taxId)}</dd>` : ''}<dt>Fiyat grubu</dt><dd>${esc(prices[u.priceType] || 'Varsayılan')}</dd>
          <dt>İskonto</dt><dd>%${num(u.discountRate)}</dd><dt>Açık hesap limiti</dt><dd>${Number(u.nBalanceStatus) === 1 ? (Number(u.nBalanceLimit) ? tl(u.nBalanceLimit) : 'Limitsiz') : 'Kapalı'}</dd>
          ${u.customerGroup?.name ? `<dt>Grup</dt><dd>${esc(u.customerGroup.name)}</dd>` : ''}</dl>
        <hr class="sep"><div style="font-size:12.5px;color:#cfc6b8"><b style="color:#fff;display:block;margin-bottom:4px">Fatura adresi</b>${esc([u.invoice?.address, u.invoice?.district, u.invoice?.city].filter(Boolean).join(', ') || '—')}</div>
        ${favs.length ? `<hr class="sep"><div style="font-size:12.5px"><b style="color:#fff;display:block;margin-bottom:6px">En çok aldıkları</b>${favs.map(f => `<div class="favr"><span>${esc(f.name)}</span><b>${num(f.q)}</b></div>`).join('')}</div>` : ''}
        ${u.phone ? `<div class="copyrow"><span>${esc(u.phone)}</span><button class="btn sm" data-act="copy" data-v="${esc(u.phone)}">Kopyala</button></div>` : ''}
      </div></aside></div>`;
  };

  /* ---------- cari ---------- */
  function ledger(list, withUser) {
    if (!list.length) return '<p class="sub">Hareket yok.</p>';
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tarih</th>${withUser ? '<th>Müşteri</th>' : ''}<th>İşlem</th><th>Ödeme</th><th class="r">Tutar</th></tr></thead><tbody>${list.map(b => {
      const [lab] = BAL_TYPE[b.type] || ['Hareket']; const sg = sign(b), u = withUser ? userById(b.userId) : null;
      return `<tr class="${withUser && u ? 'row' : ''}" ${withUser && u ? `data-user="${u.id}"` : ''}><td>${dtt(b.createdAt)}</td>${withUser ? `<td>${esc(u ? userName(u) : b.userCode || '#' + b.userId)}</td>` : ''}<td>${esc(lab)}</td><td>${esc(b.paymentFirmName || '—')}${Number(b.installments) > 1 ? ' · ' + b.installments + ' taksit' : ''}</td><td class="r"><b class="${sg > 0 ? 'pos' : 'neg'}">${sg > 0 ? '+' : '−'}${tl2(Math.abs(Number(b.price) || 0))}</b></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  const C = (S.ui.c ||= { q: '', t: 'all' });
  views.cari = () => {
    const acts = `<button class="btn sm" data-act="reloadU" ${S.bLoading || S.uLoading ? 'disabled' : ''}>${S.bLoading ? 'Yükleniyor' : 'Yenile'}</button>`;
    if (S.bErr && !S.balance.length) return head('Finans', 'Cari hesap', '', acts) + errBox(S.bErr, 'reloadB');
    if (!S.bLoaded && !S.balance.length) return head('Finans', 'Cari hesap', 'Alınıyor…', acts) + skel();
    const q = C.q.trim().toLocaleLowerCase('tr');
    const L = S.balance.filter(b => {
      const t = (BAL_TYPE[b.type] || ['', 'adj'])[1]; if (C.t !== 'all' && t !== C.t) return false;
      if (!q) return true; const u = userById(b.userId); return [u ? userName(u) : '', b.userCode, b.paymentFirmName].join(' ').toLocaleLowerCase('tr').includes(q);
    });
    const inSum = S.balance.filter(b => sign(b) > 0).reduce((a, b) => a + Math.abs(+b.price || 0), 0), outSum = S.balance.filter(b => sign(b) < 0).reduce((a, b) => a + Math.abs(+b.price || 0), 0);
    const debtors = S.users.filter(u => (Number(u.balance) || 0) < 0).sort((a, b) => a.balance - b.balance), creditors = S.users.filter(u => (Number(u.balance) || 0) > 0);
    return head('Finans', 'Cari hesap', `${num(S.balance.length)} hareket · ${num(S.users.length)} hesap`, acts) + `
      <div class="kpis">
        <div class="kpi hero"><div class="k">Toplam alacak</div><div class="v">${tl(Math.abs(debtors.reduce((a, u) => a + Number(u.balance), 0)))}</div><div class="s">${num(debtors.length)} müşterinin borcu</div></div>
        <div class="kpi"><div class="k">Müşteri alacağı</div><div class="v">${tlc(creditors.reduce((a, u) => a + Number(u.balance), 0))}</div><div class="s">${num(creditors.length)} hesapta artı bakiye</div></div>
        <div class="kpi"><div class="k">Giriş</div><div class="v">${tlc(inSum)}</div><div class="s">tahsilat ve yüklemeler</div></div>
        <div class="kpi"><div class="k">Çıkış</div><div class="v">${tlc(outSum)}</div><div class="s">sipariş ve çıkışlar</div></div>
      </div>
      <div class="grid2" style="margin-top:18px">
        <div class="card"><div class="card-h"><div><h3>Hareketler</h3><p class="sub">En yeniden eskiye</p></div></div>
          <div class="tools"><input type="search" id="cq" placeholder="Müşteri veya ödeme yöntemi ara" value="${esc(C.q)}"></div>
          <div class="chips">${[['all', 'Tümü'], ['in', 'Girişler'], ['out', 'Çıkışlar'], ['adj', 'Düzeltmeler']].map(([k, l]) => `<button class="chip" data-ct="${k}" aria-pressed="${C.t === k}">${l}</button>`).join('')}</div>${ledger(L, true)}</div>
        <div class="card"><div class="card-h"><div><h3>Borçlu hesaplar</h3><p class="sub">Bakiyesi eksiye düşen müşteriler</p></div></div>
          ${debtors.length ? `<ul class="rows">${debtors.map(u => `<li data-user="${u.id}"><span class="th av-s">${esc((userName(u).match(/\p{L}/gu) || ['?']).slice(0, 2).join('').toLocaleUpperCase('tr'))}</span><div class="t"><b>${esc(userName(u))}</b><small>${esc(u.phone || u.email || '')}</small></div><b class="num neg">${tl2(u.balance)}</b></li>`).join('')}</ul>` : '<p class="sub">Borçlu hesap yok.</p>'}</div>
      </div>`;
  };
  views.bind_cari = () => {
    const q = $('#cq'); q?.addEventListener('input', () => { C.q = q.value; clearTimeout(q.t); q.t = setTimeout(render, 220); });
    $$('[data-ct]').forEach(b => b.addEventListener('click', () => { C.t = b.dataset.ct; render(); }));
  };

  // İptal et ve Düzelt: sunucu Paraşüt'e geçmiş ya da Paraşüt'ten gelmiş siparişi reddeder (orada değiştirilir)
  const OI = (S.ui.oi ||= {});
  const oiSifirla = id => { for (const k of Object.keys(OI)) delete OI[k]; OI.id = String(id); };
  async function siparisIptal(o) {
    if (!OI.onay) { oiSifirla(O.id(o)); OI.onay = true; S.keepScroll = true; render(); setTimeout(() => { if (OI.onay && OI.id === String(O.id(o))) { OI.onay = false; if (S.route === 'siparis') { S.keepScroll = true; render(); } } }, 8000); return; }
    oiSifirla(O.id(o)); OI.is = 'iptal'; S.keepScroll = true; render();
    try {
      const r = await CLK.spSor({ islem: 'siparis_iptal', kod: O.code(o) });
      o.order.status = 6; oiSifirla('');
      CLK.toast(r.zaten ? 'Sipariş zaten iptal edilmiş' : `Sipariş ${O.code(o)} iptal edildi, tutarı cariye geri döndü`);
      go('siparisler'); return;
    } catch (e) { OI.is = ''; OI.mesaj = 'İptal edilemedi: ' + e.message; }
    S.keepScroll = true; render();
  }
  async function siparisDuzelt(o) {
    oiSifirla(O.id(o)); OI.is = 'duzelt'; S.keepScroll = true; render();
    try { const v = await CLK.spSor({ islem: 'siparis_oku', kod: O.code(o) }); oiSifirla(''); CLK.siparisDuzelt(v); return; }
    catch (e) { OI.is = ''; OI.mesaj = 'Düzeltilemez: ' + e.message; }
    S.keepScroll = true; render();
  }

  // Sipariş detayındaki Yazdır: Sipariş gir çıktısıyla aynı sevkiyat ve kontrol listesi
  const varyant = v => !v ? '' : typeof v === 'string' ? v : Object.values(v).join(' / ');
  function siparisYazdir(o) {
    if (!o || !CLK.kontrolListesi) { CLK.toast('Yazdırılamadı'); return; }
    const d = o.order || {}, c = o.customer || {};
    const adres = [c.delivery?.address, c.delivery?.district, c.delivery?.city].filter(Boolean).join(', ');
    const kalemler = O.items(o).map(i => {
      const miktar = Number(i.quantity) || 0, fiyat = Number(i.priceIncVat ?? i.price) || 0;
      return { urun: [i.name, varyant(i.variants)].filter(Boolean).join(' · '), miktar, fiyat, tutar: Number(i.totalPriceIncVat ?? i.totalPrice) || miktar * fiyat };
    });
    CLK.kontrolListesi('Sipariş', [['Müşteri', O.cust(o)], ['Sipariş no', O.code(o)], ['Tarih', dtt(O.date(o))],
      ['Durum', (ORDER_STATUS[O.status(o)] || ['—'])[0]], c.phone && ['Telefon', c.phone], adres && ['Adres', adres]].filter(Boolean), kalemler);
  }

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'oMore') { F.shown += 40; S.keepScroll = true; render(); }
    else if (act === 'bekleyenGit') { F.s = -1; F.q = ''; F.plat = ''; F.shown = 40; go('siparisler'); }
    else if (act === 'oIptal' || act === 'oDuzelt') { const o = S.orders.find(x => String(O.id(x)) === el.dataset.id); if (o) (act === 'oIptal' ? siparisIptal : siparisDuzelt)(o); }
    else if (act === 'oYazdir') siparisYazdir(S.orders.find(x => String(O.id(x)) === el.dataset.id));
    else if (act === 'copy') { navigator.clipboard?.writeText(el.dataset.v).then(() => CLK.toast('Kopyalandı'), () => CLK.toast('Kopyalanamadı')); }
    else prevAct?.(act, el, e);
  };
})();
