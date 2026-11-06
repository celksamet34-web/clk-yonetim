/* CLK Yönetim — siparişler, müşteriler, cari hesap */
(() => {
  const { S, $, $$, esc, tl, tl2, tlc, num, dt, dtt, P, O, ORDER_STATUS, BAL_TYPE, head, skel, errBox, views, go, render } = CLK;
  const st = s => { const [l, c] = ORDER_STATUS[s] || ['—', 'off']; return `<span class="pill ${c}">${l}</span>`; };
  const userName = u => [u.name, u.lastname].filter(Boolean).join(' ') || u.title || u.email || 'Müşteri';
  const userById = id => S.users.find(u => Number(u.id) === Number(id)) || (S.pasifUsers || []).find(u => Number(u.id) === Number(id));
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
    const q = $('#oq'); q?.addEventListener('input', () => { F.q = q.value; F.shown = 40; clearTimeout(q.t); q.t = setTimeout(render.yazinca, 220); });
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
    const id = esc(O.id(o)), acik = [1, 2].includes(O.status(o)), is = OI.id === String(O.id(o)) ? OI : {};
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
    const cariGor = CLK.izin('cari'); // personel cari yetkisi yoksa bakiye görmez (sunucu da bakiyeyi göndermez)
    if (!cariGor && (M.f === 'debt' || M.sort === 'balance')) { M.f = M.f === 'debt' ? 'all' : M.f; M.sort = M.sort === 'balance' ? 'spend' : M.sort; }
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
      <div class="mini-kpis"><div><span>Müşteri</span><b>${num(S.users.length)}</b></div><div><span>Aktif bayi</span><b>${num(dealers)}</b></div>${cariGor ? `<div><span>Borçlu</span><b>${num(debtors.length)}</b></div><div><span>Toplam alacak</span><b>${tl(Math.abs(debtors.reduce((a, u) => a + Number(u.balance), 0)))}</b></div>` : ''}</div>
      <div class="card"><div class="tools"><input type="search" id="uq" placeholder="Ad, ünvan, telefon, e-posta, vergi no veya şehir ara" value="${esc(M.q)}">
        <select id="usort">${[['spend', 'En çok alışveriş'], ['balance', 'Borç (çoktan)'], ['recent', 'En yeni kayıt'], ['name', 'Ada göre']].filter(([k]) => cariGor || k !== 'balance').map(([k, l]) => `<option value="${k}" ${M.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="chips">${[['all', 'Tümü'], ['dealer', 'Bayiler'], ['pending', 'Bayilik onayı bekleyen'], ['debt', 'Borçlu']].filter(([k]) => cariGor || k !== 'debt').map(([k, l]) => `<button class="chip" data-uf="${k}" aria-pressed="${M.f === k}">${l}</button>`).join('')}</div>
        <div class="clist">${L.map(({ u, s }) => { const bal = Number(u.balance) || 0; return `<button class="crow" data-user="${u.id}">
          <span class="av">${esc(ini(u))}</span><div class="c1"><b>${esc(userName(u))}</b><small>${esc(u.title && u.title !== userName(u) ? u.title + ' · ' : '')}${esc(u.phone || u.email || '')}${u.invoice?.city ? ' · ' + esc(u.invoice.city) : ''}</small></div>
          <div class="c2"><span>${num(s.n)} sipariş</span><b>${tl(s.spend)}</b></div>
          <div class="c3">${Number(u.dealerStatus) === 1 ? '<span class="pill gold">Bayi</span>' : Number(u.dealerStatus) === 2 ? '<span class="pill warn">Onay bekliyor</span>' : ''}${cariGor ? `<b class="num ${bal < 0 ? 'neg' : bal > 0 ? 'pos' : ''}">${tl2(bal)}</b>` : ''}</div></button>`; }).join('') || '<p class="empty">Müşteri bulunamadı.</p>'}</div></div>`;
  };
  views.bind_musteriler = () => {
    const q = $('#uq'); q?.addEventListener('input', () => { M.q = q.value; clearTimeout(q.t); q.t = setTimeout(render.yazinca, 220); });
    $('#usort')?.addEventListener('change', e => { M.sort = e.target.value; render(); });
    $$('[data-uf]').forEach(b => b.addEventListener('click', () => { M.f = b.dataset.uf; render(); }));
  };

  views.musteri = () => {
    const u = userById(S.arg), pasif = !!u && Number(u.status) === 0;
    // geri düğmesi müşteri kartının açıldığı sayfaya döner (celik 02.11: "cari hesaptan müşteriye girdiğimizde geri cari hesap sayfasına geçmek için düğme bırak")
    const don = S.ui.mDon && GERI[S.ui.mDon.r] ? S.ui.mDon : null;
    const back = `${u && !pasif ? CLK.tahsilat?.dugme(u.id) || '' : ''}${don ? `<button class="btn sm" data-act="mGeri">← ${GERI[don.r]}</button>` : '<button class="btn sm" data-go="musteriler">← Müşteriler</button>'}`;
    if (u && CLK.izin('cari')) cariOzetGerekirse();
    if (!u) return head('Müşteri', 'Bulunamadı', '', back) + (S.uLoading ? skel() : '<div class="card empty"><h3>Müşteri bulunamadı</h3></div>');
    const s = custStats(u), os = ordersOf(u.id), bs = balOf(u.id), bal = Number(u.balance) || 0;
    const prices = { 0: 'Varsayılan', 2: 'Bayi fiyatı 1', 3: 'Bayi fiyatı 2', 4: 'Bayi fiyatı 3', 5: 'Bayi fiyatı 4' };
    const fav = {}; os.filter(O.counts).forEach(o => O.items(o).forEach(i => { (fav[i.code] ||= { name: i.name, code: i.code, q: 0 }).q += Number(i.netQuantity ?? i.quantity) || 0; }));
    const favs = Object.values(fav).sort((a, b) => b.q - a.q).slice(0, 5);
    return head(Number(u.dealerStatus) === 1 ? 'Bayi' : 'Müşteri', esc(userName(u)), `${esc(u.code || '')}${u.createdAt ? ' · Kayıt ' + dt(u.createdAt) : ''}${u.lastLoginAt && !/^0000/.test(u.lastLoginAt) ? ' · Son giriş ' + dt(u.lastLoginAt) : ''}${pasif ? ' · Pasif üye' : ''}`, back) + `
      <div class="ed"><div class="stack">
        <div class="mini-kpis"><div><span>Sipariş</span><b>${num(s.n)}</b></div><div><span>Toplam alışveriş</span><b>${tl(s.spend)}</b></div><div><span>Ortalama sepet</span><b>${tl(s.n ? s.spend / s.n : 0)}</b></div><div><span>Son sipariş</span><b>${s.last ? dt(s.last) : '—'}</b></div></div>
        <div class="card"><div class="card-h"><div><h3>Siparişleri</h3><p class="sub">${os.length} sipariş</p></div></div>
          ${os.length ? `<div class="olist">${os.map(o => `<button class="orow" data-order="${O.id(o)}"><div class="o1"><b>${esc(O.code(o))}</b><small>${dtt(O.date(o))} · ${O.items(o).length} kalem</small></div><div class="o2">${O.items(o).slice(0, 2).map(i => `<span>${esc(i.name)} ×${num(i.quantity)}</span>`).join('')}</div><div class="o3"><b class="num">${tl(O.total(o))}</b>${st(O.status(o))}</div></button>`).join('')}</div>` : '<p class="sub">Sipariş yok.</p>'}</div>
        ${CLK.izin('cari') ? `<div class="card"><div class="card-h"><div><h3>Cari hareketler</h3><p class="sub">${bs.length} hareket</p></div></div>${ledger(bs, false)}</div>` : ''}
      </div>
      <aside class="summary"><div class="sum-card">
        ${CLK.izin('cari') ? `<div><small style="color:#a99f90;letter-spacing:.16em;font-size:10px;font-weight:700">GÜNCEL BAKİYE</small><div class="big" style="color:${bal < 0 ? '#f0a39a' : 'var(--gold-2)'}">${tl2(bal)}</div><small style="color:#a99f90">${bal < 0 ? 'Müşterinin borcu' : bal > 0 ? 'Müşterinin alacağı' : 'Hesap kapalı'}</small>${sonOdeme(u)}</div>${notKutu(u)}` : ''}
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
  /* ---------- cari: müşteri carileri (celik 02.11.2026: "cari hesaplarda hareketler gözükmesin müşteri carileri gözüksün.
     en son ödeme yaptığı zamana yazalım. son hareket zamanı olarak") ----------
     Her müşteri bir satır: site bakiyesi, Paraşüt'teki son ödemesi (tahsilat, çek ya da senet) ve son hareketi (satış, iade, ödeme).
     Tarihler gider-cek cari_ozet işleminden gelir (20 dk saklanır, eskiyse arka planda yenilenir). Hareket listesi müşteri sayfasında. */
  const C = (S.ui.c ||= { q: '', f: 'hepsi', s: 'borc' });
  /* ---------- ödeme notları (celik 02.11: "bakiyelerin yanına ödeme notu bırak. örnek duman kırtasiye 8 ekim kart çekeceğim dedi. bunu not et bana 8inde hatırlat") ----------
     Müşteri başına bir not: yazı, isteğe bağlı ödeme günü ve tutar. Sunucuda gider-cek cari_not (sp_ayar cari_not:<üye id>; yalnız panel kaydı, Paraşüt'e yazılmaz).
     Cari hesapta bakiyenin yanında, müşteri sayfasında bakiyenin altında; ödeme günü gelen ve geçenler ana panelde "Ödeme sözleri" kartında.
     Not yazıldıktan sonra Paraşüt'te ödeme görülürse "Ödeme geldi" yazar (cari_ozet son ödeme tarihi). */
  const NT = (S.ui.nt ||= { l: null, ed: null });
  const GERI = { cari: 'Cari hesap', musteriler: 'Müşteriler', panel: 'Panel', siparis: 'Sipariş', siparisler: 'Siparişler', ekstre: 'Müşteri ekstresi' };
  const notMap = () => { const m = {}; for (const n of NT.l || []) m[n.site] = n; return m; };
  const ozetMap = () => { const m = {}; for (const x of CZ.v?.musteriler || []) if (x.site) m[x.site] = x; return m; };
  const paraOku = v => {
    let s = String(v ?? '').replace(/[\s₺TLtl]/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    return Number.isFinite(n) && n > 0 && n < 1e8 ? Math.round(n * 100) / 100 : 0;
  };
  const yerelGun = iso => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const gunAdi = g => new Date(g + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long' });
  const kimAd = k => String(k || '').split('@')[0];
  // notun durumu: ok = not yazıldıktan sonra ödeme geldi; bad = ödeme günü geçti; warn = bugün ya da yarın; ileri; '' = günsüz
  const notDurum = (n, z) => {
    const yaz = yerelGun(n.zaman), od = z?.odeme?.[0];
    if (od && yaz && (od > yaz || (n.tarih && od >= n.tarih && od >= yaz))) return { k: 'ok', t: `Ödeme geldi · ${dt(od)} ${tl(z.odeme[1])}` };
    if (!n.tarih) return { k: '', t: '' };
    const d = -gecen(n.tarih);
    return d < 0 ? { k: 'bad', t: `${dt(n.tarih)} · ${-d} gün geçti` } : d === 0 ? { k: 'warn', t: 'Bugün' } : d === 1 ? { k: 'warn', t: 'Yarın' }
      : { k: 'ileri', t: `${dt(n.tarih)} ${gunAdi(n.tarih)} · ${d} gün sonra` };
  };
  const notForm = koyu => { const e = NT.ed; return `<div class="nt-ed${koyu ? ' koyu' : ''}">
      <label class="f"><span>Ödeme notu</span><textarea id="ntMetin" rows="2" maxlength="300" placeholder="Örn. 8'inde kartla ödeyecek">${esc(e.metin)}</textarea></label>
      <div class="nt-2"><label class="f"><span>Ödeme günü</span><input id="ntTarih" type="date" value="${esc(e.tarih)}"></label>
        <label class="f"><span>Tutar <em>isteğe bağlı</em></span><input id="ntTutar" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(e.tutar)}"></label></div>
      ${e.hata ? `<div class="msg err">${esc(e.hata)}</div>` : ''}
      <div class="nt-btn"><button class="btn gold sm" data-act="ntKaydet" ${e.is ? 'disabled' : ''}>${e.is ? 'Kaydediliyor' : 'Kaydet'}</button><button class="btn sm" data-act="ntKapat" ${e.is ? 'disabled' : ''}>Vazgeç</button>${e.var ? `<button class="btn sm ghost" data-act="ntSil" ${e.is ? 'disabled' : ''}>Notu kaldır</button>` : ''}</div>
      <small>Ödeme günü gelince ana panelde ve Cari hesapta uyarı çıkar. Yalnız panelde durur, Paraşüt'e yazılmaz.</small>
    </div>`; };
  const notYazi = (n, d) => `${d.t ? `<b class="nt-d ${d.k}">${esc(d.t)}</b>` : ''}<span class="nt-m">${esc(n.metin || 'Ödeme günü')}${n.tutar ? ` · <b>${tl(n.tutar)}</b>` : ''}</span>`;
  // müşteri sayfası: bakiyenin altında not kutusu
  const notKutu = u => {
    if (NT.ed?.id === String(u.id)) return notForm(true);
    const n = notMap()[u.id];
    if (!n) return NT.l ? `<button class="nt-ekle" data-act="ntAc" data-id="${u.id}">+ Ödeme notu ekle</button>` : '';
    const d = notDurum(n, ozetMap()[u.id]);
    return `<div class="nt-kutu ${d.k}"><small>ÖDEME NOTU</small><div>${notYazi(n, d)}</div>${n.tarih && (d.k === 'ok' || d.k === 'warn') ? `<span class="nt-g">Ödeme günü ${dt(n.tarih)} ${gunAdi(n.tarih)}</span>` : ''}
      <span class="nt-g">${esc(kimAd(n.kim))} · ${dtt(n.zaman)}</span><button class="btn sm" data-act="ntAc" data-id="${u.id}">Düzenle</button></div>`;
  };
  const sonOdeme = u => { const z = ozetMap()[u.id]; return z?.odeme ? `<small style="display:block;color:#a99f90;margin-top:4px">Son ödeme ${dt(z.odeme[0])} · ${tl(z.odeme[1])} · ${esc(z.odeme[2])}</small>` : ''; };
  function notAc(id) {
    const n = notMap()[id];
    NT.ed = { id: String(id), metin: n?.metin || '', tarih: n?.tarih || '', tutar: n?.tutar ? String(n.tutar).replace('.', ',') : '', var: !!n, is: false, hata: '' };
    S.keepScroll = true; render(); setTimeout(() => document.getElementById('ntMetin')?.focus(), 0);
  }
  async function notKaydet(sil) {
    const e = NT.ed; if (!e || e.is) return;
    const metin = sil ? '' : e.metin.trim(), tarih = sil ? '' : e.tarih, tutar = sil ? 0 : paraOku(e.tutar);
    if (!sil && !metin && !tarih) { e.hata = 'Notu ya da ödeme gününü yazın.'; S.keepScroll = true; render(); return; }
    if (!sil && String(e.tutar).trim() && !tutar) { e.hata = 'Tutarı anlaşılır yazın (ör. 25.000).'; S.keepScroll = true; render(); return; }
    const u = userById(e.id);
    e.is = true; e.hata = ''; S.keepScroll = true; render();
    try {
      const j = await CLK.tahsilat.sor({ islem: 'cari_not', site: Number(e.id), ad: u ? userName(u) : '', metin, tarih, tutar });
      NT.l = j.notlar || []; NT.ed = null; CLK.toast(sil ? 'Ödeme notu kaldırıldı' : 'Ödeme notu kaydedildi');
    } catch (er) { e.is = false; e.hata = er.message; }
    S.keepScroll = true; render();
  }
  const notBagla = () => {
    for (const [id, k] of [['ntMetin', 'metin'], ['ntTarih', 'tarih'], ['ntTutar', 'tutar']]) {
      const el = document.getElementById(id);
      el?.addEventListener('input', () => { if (NT.ed) NT.ed[k] = el.value; });
      el?.addEventListener('change', () => { if (NT.ed) NT.ed[k] = el.value; });
    }
  };
  views.bind_musteri = () => notBagla();
  // ana panel: ödeme günü gelen (yarın dahil) ve geçen notlar
  CLK.cariNot = {
    panel: () => {
      if (!CLK.izin('cari')) return '';
      cariOzetGerekirse();
      const z = ozetMap();
      const L = (NT.l || []).filter(n => n.tarih && gecen(n.tarih) >= -1).map(n => ({ n, u: userById(n.site), d: notDurum(n, z[n.site]) }))
        .filter(x => x.u).sort((a, b) => a.n.tarih.localeCompare(b.n.tarih));
      if (!L.length) return '';
      return `<div class="card"><div class="card-h"><div><h3>Ödeme sözleri</h3><p class="sub">Ödeme günü gelen ve geçen müşteri notları</p></div><button class="btn sm ghost" data-go="cari">Cari hesap</button></div>
        <ul class="rows">${L.map(({ n, u, d }) => { const bal = Number(u.balance) || 0; return `<li data-user="${u.id}"><div class="t"><b>${esc(userName(u))}</b><small>${esc(n.metin || 'Ödeme günü')}${n.tutar ? ' · ' + tl(n.tutar) : ''} · ${dt(n.tarih)}</small></div>
          <span class="pill ${d.k === 'ok' ? 'ok' : d.k === 'bad' ? 'bad' : 'warn'}">${esc(d.k === 'ok' ? 'Ödeme geldi' : d.k === 'bad' ? 'Geçti' : d.t)}</span><b class="num ${bal < -0.5 ? 'neg' : ''}" style="margin-left:8px">${tl2(bal)}</b></li>`; }).join('')}</ul></div>`;
    }
  };
  const CZ = (S.ui.cz ||= { v: null, yuk: false, hata: '', zaman: 0, tekrar: 0 });
  const cariOzetGerekirse = () => { if (!CZ.yuk && !CZ.hata && (!CZ.v || Date.now() - CZ.zaman > 20 * 60e3)) setTimeout(() => cariOzetYukle(false), 0); };
  async function cariOzetYukle(yenile) {
    if (CZ.yuk || !CLK.tahsilat?.sor) return;
    CZ.yuk = true; CZ.hata = ''; if (S.route === 'cari') { S.keepScroll = true; render(); }
    const ciz = () => { if (['cari', 'musteri', 'panel'].includes(S.route) && !(NT.ed && document.activeElement?.id?.startsWith('nt'))) { S.keepScroll = true; render(); } };
    try {
      const j = await CLK.tahsilat.sor({ islem: 'cari_ozet', yenile: !!yenile });
      if (j.musteriler?.length || !CZ.v) CZ.v = j;
      if (Array.isArray(j.notlar)) NT.l = j.notlar;
      CZ.zaman = Date.now();
      // sunucu eski listeyi verip yenisini arka planda hesaplıyorsa biraz sonra yeniden sorulur
      if (j.eski && CZ.tekrar < 4) { CZ.tekrar++; setTimeout(() => { if (S.route === 'cari') cariOzetYukle(false); }, 40000); } else CZ.tekrar = 0;
    } catch (e) { CZ.hata = e.message; }
    CZ.yuk = false; ciz();
  }
  const gunNo = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const bugunNo = () => { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
  const gecen = s => Math.round((bugunNo() - gunNo(s)) / 864e5);
  const once = n => n <= 0 ? 'bugün' : n === 1 ? 'dün' : `${n} gün önce`;
  const GEC = 30; // borçlu müşteri bu kadar gündür ödeme yapmadıysa kırmızı yazılır
  const cariSatirlar = () => {
    const p = {}; for (const m of CZ.v?.musteriler || []) if (m.site) p[m.site] = m;
    return S.users.map(u => {
      const bal = Number(u.balance) || 0, z = p[u.id] || null, son = z?.odeme ? gecen(z.odeme[0]) : null;
      return { u, bal, z, son, gec: bal < -0.5 && !!z && (son === null || son > GEC) };
    });
  };
  views.cari = () => {
    // Ödeme gir (views-tahsilat.js): müşteriden alınan ödeme Paraşüt'e tahsilat olarak girilir, site carisine de yazılır
    cariOzetGerekirse();
    const acts = `${CLK.tahsilat?.dugme() || ''}<button class="btn sm" data-act="czYenile" ${S.uLoading || CZ.yuk ? 'disabled' : ''}>${S.uLoading || CZ.yuk ? 'Yükleniyor' : 'Yenile'}</button>`;
    const odeme = CLK.tahsilat?.kart() || '';
    if (S.uErr && !S.users.length) return head('Finans', 'Cari hesap', '', acts) + odeme + errBox(S.uErr, 'reloadU');
    if (!S.uLoaded && !S.users.length) return head('Finans', 'Cari hesap', 'Alınıyor…', acts) + odeme + skel();
    const R = cariSatirlar(), nm = notMap();
    const debtors = R.filter(r => r.bal < -0.5), creditors = R.filter(r => r.bal > 0.5), gec = R.filter(r => r.gec);
    const yedi = R.filter(r => r.son !== null && r.son <= 7).length;
    const q = C.q.trim().toLocaleLowerCase('tr');
    let L = R.filter(r => {
      if (C.f === 'borclu' && !(r.bal < -0.5)) return false;
      if (C.f === 'alacakli' && !(r.bal > 0.5)) return false;
      if (C.f === 'gec' && !r.gec) return false;
      if (C.f === 'not' && !nm[r.u.id]) return false;
      return !q || [userName(r.u), r.u.phone, r.u.email, r.u.code, r.z?.ad].join(' ').toLocaleLowerCase('tr').includes(q);
    });
    const ad = (a, b) => userName(a.u).localeCompare(userName(b.u), 'tr');
    const tar = (r, k) => r.z?.[k]?.[0] || '';
    L.sort(C.s === 'ad' ? ad : C.s === 'odeme' ? (a, b) => tar(a, 'odeme').localeCompare(tar(b, 'odeme')) || a.bal - b.bal
      : C.s === 'hareket' ? (a, b) => tar(b, 'hareket').localeCompare(tar(a, 'hareket')) || ad(a, b) : (a, b) => a.bal - b.bal || ad(a, b));
    const bekle = CZ.yuk && !CZ.v;
    const odemeHucre = r => {
      if (bekle) return '<span class="cz-bos">Paraşüt\'ten alınıyor…</span>';
      if (!r.z) return `<b>—</b><small>${CZ.v ? 'Paraşüt eşleşmesi yok' : ''}</small>`;
      if (!r.z.odeme) return `<b>—</b><small class="${r.gec ? 'cz-gec' : ''}">Ödeme yok</small>`;
      const [t, tutar, tur] = r.z.odeme;
      return `<b>${dt(t)}</b><small class="${r.gec ? 'cz-gec' : ''}">${once(r.son)} · ${tl(tutar)} · ${esc(tur)}</small>`;
    };
    const hareketHucre = r => {
      if (bekle) return '';
      if (!r.z?.hareket) return '<b>—</b>';
      const [t, tur] = r.z.hareket;
      return `<b>${dt(t)}</b><small>${once(gecen(t))} · ${esc(tur)}</small>`;
    };
    const durum = r => r.bal < -0.5 ? 'Borçlu' : r.bal > 0.5 ? 'Alacaklı' : 'Kapalı';
    const notH = r => { const n = nm[r.u.id]; if (!n) return ''; const d = notDurum(n, r.z);
      return `<div class="n"><button class="nt-satir ${d.k}" data-act="ntAc" data-id="${r.u.id}" title="Ödeme notunu düzenle"><i>Not</i>${notYazi(n, d)}<small>${esc(kimAd(n.kim))} · ${dt(n.zaman)}</small></button></div>`; };
    const satir = r => `<li class="cz-tr${nm[r.u.id] ? ' notlu' : ''}" data-user="${r.u.id}">
      <div class="k"><b>${esc(userName(r.u))}</b><small>${esc(r.u.phone || r.u.email || r.u.code || '')}</small></div>
      <div class="b"><b class="num ${r.bal < -0.5 ? 'neg' : r.bal > 0.5 ? 'pos' : ''}">${tl2(r.bal)}</b><small>${durum(r)}${!nm[r.u.id] && NT.l ? ` · <button class="nt-arti" data-act="ntAc" data-id="${r.u.id}" title="Ödeme notu ekle">+ Not</button>` : ''}</small></div>
      <div class="o"><span class="m">Son ödeme</span>${odemeHucre(r)}</div>
      <div class="h"><span class="m">Son hareket</span>${hareketHucre(r)}</div>
      ${notH(r)}
    </li>${NT.ed?.id === String(r.u.id) ? `<li class="cz-ed">${notForm(false)}</li>` : ''}`;
    const zaman = CZ.v?.zaman ? new Date(CZ.v.zaman).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
    const altYazi = CZ.hata ? `<span class="cz-gec">Son ödeme tarihleri alınamadı: ${esc(CZ.hata)}</span>`
      : CZ.yuk ? 'Son ödeme ve hareket tarihleri Paraşüt\'ten alınıyor…' : zaman ? `Ödeme ve hareket tarihleri Paraşüt'ten, ${zaman} itibarıyla. Satıra dokununca müşterinin hareketleri açılır.` : '';
    return head('Finans', 'Cari hesap', `${num(R.length)} müşteri`, acts) + odeme + `
      <div class="kpis">
        <div class="kpi hero"><div class="k">Toplam alacak</div><div class="v">${tl(Math.abs(debtors.reduce((a, r) => a + r.bal, 0)))}</div><div class="s">${num(debtors.length)} müşterinin borcu</div></div>
        <div class="kpi"><div class="k">Müşteri alacağı</div><div class="v">${tlc(creditors.reduce((a, r) => a + r.bal, 0))}</div><div class="s">${num(creditors.length)} hesapta artı bakiye</div></div>
        <div class="kpi ${gec.length ? 'bad' : ''}"><div class="k">${GEC} gündür ödemeyen</div><div class="v">${CZ.v ? tlc(Math.abs(gec.reduce((a, r) => a + r.bal, 0))) : '…'}</div><div class="s">${CZ.v ? num(gec.length) + ' borçlu müşteri' : 'tarihler alınıyor'}</div></div>
        <div class="kpi"><div class="k">Son 7 günde ödeyen</div><div class="v">${CZ.v ? num(yedi) : '…'}</div><div class="s">müşteri</div></div>
      </div>
      <div class="card cz" style="margin-top:18px">
        <div class="card-h"><div><h3>Müşteri carileri</h3><p class="sub">${altYazi}</p></div></div>
        <div class="tools"><input type="search" id="cq" placeholder="Müşteri ara" value="${esc(C.q)}"></div>
        <div class="chips">${[['hepsi', 'Hepsi', R.length], ['borclu', 'Borçlu', debtors.length], ['alacakli', 'Alacaklı', creditors.length], ['gec', GEC + ' gündür ödemeyen', CZ.v ? gec.length : ''], ['not', 'Ödeme notu olan', NT.l ? R.filter(r => nm[r.u.id]).length : '']].map(([k, l, n]) => `<button class="chip" data-cf="${k}" aria-pressed="${C.f === k}">${l}${n !== '' ? ` <b>${n}</b>` : ''}</button>`).join('')}</div>
        <div class="cz-sira"><span>Sırala:</span>${[['borc', 'Borca göre'], ['odeme', 'Son ödemeye göre'], ['hareket', 'Son harekete göre'], ['ad', 'Ada göre']].map(([k, l]) => `<button class="chip sm" data-cs="${k}" aria-pressed="${C.s === k}">${l}</button>`).join('')}</div>
        ${L.length ? `<ul class="cz-tb"><li class="cz-th"><div>Müşteri</div><div>Bakiye</div><div>Son ödeme</div><div>Son hareket</div></li>${L.map(satir).join('')}</ul>` : '<p class="sub">Bu seçimde müşteri yok.</p>'}
      </div>`;
  };
  views.bind_cari = () => {
    const q = $('#cq'); q?.addEventListener('input', () => { C.q = q.value; clearTimeout(q.t); q.t = setTimeout(render.yazinca, 220); });
    $$('[data-cf]').forEach(b => b.addEventListener('click', () => { C.f = b.dataset.cf; S.keepScroll = true; render(); }));
    $$('[data-cs]').forEach(b => b.addEventListener('click', () => { C.s = b.dataset.cs; S.keepScroll = true; render(); }));
    notBagla();
    CLK.tahsilat?.bagla?.();
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
    // panel siparişinde renkler yönetici notunda ("AD: SİYAH 10, TABA 5; AD2: ..."); site her rengi ayrı satır tutar
    const kuyruk = {};
    for (const parca of String(d.adminNote || '').split(' – ').slice(1)) for (const u of parca.split('; ')) {
      const i = u.lastIndexOf(': '); if (i < 0) continue;
      kuyruk[u.slice(0, i)] = u.slice(i + 2).split(', ').map(x => x.match(/^(.+) (\d+)$/)).filter(Boolean).map(m => ({ renk: m[1], adet: Number(m[2]) }));
    }
    // çıktıda ürün başına tek satır, renkler adın altında küçük
    const grup = new Map();
    for (const i of O.items(o)) {
      const miktar = Number(i.quantity) || 0, tutar = Number(i.totalPriceIncVat ?? i.totalPrice) || miktar * (Number(i.priceIncVat ?? i.price) || 0);
      const q = kuyruk[i.name] || [], j = q.findIndex(x => x.adet === miktar);
      const renk = j >= 0 ? q.splice(j, 1)[0].renk : varyant(i.variants);
      const g = grup.get(i.code || i.name) || grup.set(i.code || i.name, { urun: i.name, renkler: [], miktar: 0, tutar: 0 }).get(i.code || i.name);
      g.miktar += miktar; g.tutar += tutar; if (renk) g.renkler.push(`${renk} ${miktar}`);
    }
    const kalemler = [...grup.values()].map(g => ({ urun: g.urun, renk: g.renkler.join(' · '), miktar: g.miktar, fiyat: g.miktar ? Math.round(g.tutar / g.miktar * 100) / 100 : 0, tutar: g.tutar }));
    CLK.kontrolListesi('Sipariş', [['Müşteri', O.cust(o)], ['Sipariş no', O.code(o)], ['Tarih', dtt(O.date(o))],
      ['Durum', (ORDER_STATUS[O.status(o)] || ['—'])[0]], c.phone && ['Telefon', c.phone], adres && ['Adres', adres]].filter(Boolean), kalemler);
  }

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'oMore') { F.shown += 40; S.keepScroll = true; render(); }
    else if (act === 'bekleyenGit') { F.s = -1; F.q = ''; F.plat = ''; F.shown = 40; go('siparisler'); }
    else if (act === 'oIptal' || act === 'oDuzelt') { const o = S.orders.find(x => String(O.id(x)) === el.dataset.id); if (o) (act === 'oIptal' ? siparisIptal : siparisDuzelt)(o); }
    else if (act === 'oYazdir') siparisYazdir(S.orders.find(x => String(O.id(x)) === el.dataset.id));
    else if (act === 'czYenile') { CLK.loadUsers(true); CZ.tekrar = 0; cariOzetYukle(true); }
    else if (act === 'ntAc') notAc(el.dataset.id);
    else if (act === 'ntKapat') { NT.ed = null; S.keepScroll = true; render(); }
    else if (act === 'ntKaydet') notKaydet(false);
    else if (act === 'ntSil') notKaydet(true);
    else if (act === 'mGeri') { const d = S.ui.mDon; S.ui.mDon = null; go(d?.r || 'musteriler', d?.a); if (d?.y) requestAnimationFrame(() => window.scrollTo({ top: d.y, behavior: 'instant' })); }
    else if (act === 'copy') { navigator.clipboard?.writeText(el.dataset.v).then(() => CLK.toast('Kopyalandı'), () => CLK.toast('Kopyalanamadı')); }
    else prevAct?.(act, el, e);
  };
})();
