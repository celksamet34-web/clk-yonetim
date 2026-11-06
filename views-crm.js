/* CLK Yönetim — siparişler, müşteriler, cari hesap */
(() => {
  const { S, $, $$, esc, tl, tl2, tlc, num, dt, dtt, P, O, ORDER_STATUS, head, skel, errBox, views, go, render } = CLK;
  const st = s => { const [l, c] = ORDER_STATUS[s] || ['—', 'off']; return `<span class="pill ${c}">${l}</span>`; };
  const userName = u => [u.name, u.lastname].filter(Boolean).join(' ') || u.title || u.email || 'Müşteri';
  const userById = id => S.users.find(u => Number(u.id) === Number(id)) || (S.pasifUsers || []).find(u => Number(u.id) === Number(id));
  const ordersOf = id => S.orders.filter(o => O.userId(o) === Number(id));

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
  // Müşteriler: cari yetkisi olana ödemeleri toplu takip listesi (eski Cari hesap sayfası; celik 06.11: "müşteri carileri kısmında ki ödemeleri toplu takip etme listesini beğendim"),
  // olmayana site üyeleri listesi (bakiyesiz)
  const cariAcik = () => S.route === 'musteriler' && CLK.izin('cari');
  views.musteriler = () => CLK.izin('cari') ? views.cari() : uyeListesi();
  const uyeListesi = () => {
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
    if (CLK.izin('cari')) { views.bind_cari(); return; }
    const q = $('#uq'); q?.addEventListener('input', () => { M.q = q.value; clearTimeout(q.t); q.t = setTimeout(render.yazinca, 220); });
    $('#usort')?.addEventListener('change', e => { M.sort = e.target.value; render(); });
    $$('[data-uf]').forEach(b => b.addEventListener('click', () => { M.f = b.dataset.uf; render(); }));
  };

  /* müşteri sayfası (celik 06.11.2026: "müşterilerden x müşteriye girince paraşütten eski satışları yaz. hatta tarayıcıdan gir paraşüt gibi düzenle.
     ödeme gir senet gir cari hesabını borcu gör. daha farklı kolay yap onu. ekstre ve satış sayfalarını orda toplayalım"):
     Paraşüt'ün müşteri ekranı gibi: yanda bakiye, Ödeme gir / Senet gir / Ekstre gönder ve ödeme notu; ortada sekmeler: Paraşüt hesap hareketleri
     (views-musteri.js, satışa dokununca ürünleri, yazdır/PDF), site siparişleri, bilgiler. Ödeme ve senet formu sayfanın üstünde açılır.
     Özet sekmesi (celik 06.11: "paraşüte bağlı kalma ekstra kendinde bişeyler kat"): ödeme durumu, ortalama ödeme süresi, borç yaşı, aylık grafik,
     alım düzeni, elimizdeki çek/senet ve risk (views-musteri.js ozetHtml); yanda Sipariş gir ve WhatsApp ile Borç hatırlat. */
  const MT = (S.ui.mt ||= { tab: '' });
  /* müşteri bilgilerini düzenleme (celik 06.11: "müşteri sayfasında bilgiler de düzenleme şansı da tanı. telefon numarası adres vergi no il ilçe
     fiyat tanımlaması", "bunları siteye de paraşüte de yollarsın"): siparis-parasut musteri_bilgi / musteri_guncelle. Site üyesi ve eşleşmiş Paraşüt
     müşterisi birlikte yazılır, ikisi de geri okunur, başka alan değişirse eski hali geri yazılır. Paraşüt'te dolu alan boşaltılmaz. Fiyat tanımı ve
     iskonto yalnız sitede (Paraşüt'te fiyat listesi yok) ve cari yetkisi ister. */
  const BD = (S.ui.bd ||= { uid: null, not: null });
  const SPFN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/siparis-parasut';
  const bdCiz = () => { if (S.route === 'musteri') { S.keepScroll = true; render(); } };
  async function spSor(govde) {
    const { data } = await CLK.sb.auth.getSession();
    const r = await fetch(SPFN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.hata) throw new Error(j?.hata || 'Sunucu ' + r.status);
    return j;
  }
  const FIYAT = { 0: 'Varsayılan (site fiyatı)', 2: 'Bayi fiyatı 1', 3: 'Bayi fiyatı 2', 4: 'Bayi fiyatı 3', 5: 'Bayi fiyatı 4' };
  const BD_ALAN = [['phone', 'Telefon', 'tel', 'phone'], ['address', 'Adres', 'text', 'address'], ['district', 'İlçe', 'text', 'district'], ['city', 'İl', 'text', 'city'],
    ['vergi', 'Vergi no / TC kimlik no', 'numeric', 'tax_number'], ['taxBranch', 'Vergi dairesi', 'text', 'tax_office']];
  const BD_AD = { phone: 'telefon', invoice: 'fatura adresi', delivery: 'teslimat adresi', nationalId: 'TC kimlik no', taxId: 'vergi no', taxBranch: 'vergi dairesi', priceType: 'fiyat tanımı',
    discountRate: 'iskonto', address: 'adres', district: 'ilçe', city: 'il', tax_number: 'vergi no', tax_office: 'vergi dairesi' };
  const bdForm = u => ({ phone: u.phone || '', address: u.invoice?.address || '', district: u.invoice?.district || '', city: u.invoice?.city || '', vergi: u.taxId || u.nationalId || '',
    taxBranch: u.taxBranch || '', priceType: String(Number(u.priceType) || 0), discountRate: String(Number(u.discountRate) || 0) });
  const bdDuzenler = () => CLK.izin('musteriler') || CLK.izin('cari');
  async function bdAc(uid) {
    const u = userById(uid); if (!u) return;
    Object.assign(BD, { uid: String(uid), form: bdForm(u), ilk: bdForm(u), p: null, pid: '', pHata: '', yuk: true, kay: false, hata: '', uyari: '', not: null });
    bdCiz();
    try {
      const r = await spSor({ islem: 'musteri_bilgi', uye: Number(uid) });
      if (BD.uid !== String(uid)) return;
      if (r.uye) { BD.form = bdForm(r.uye); BD.ilk = bdForm(r.uye); }
      Object.assign(BD, { p: r.parasut || null, pid: r.pid || '', pHata: r.parasutHata || '' });
    } catch (e) { if (BD.uid === String(uid)) BD.hata = /Oturum gerekli/.test(e.message) ? 'Sunucu güncellemesi bekleniyor.' : e.message; }
    BD.yuk = false; bdCiz();
  }
  async function bdKaydet() {
    const u = userById(BD.uid); if (!u || BD.kay || BD.yuk) return;
    const f = BD.form, vergi = String(f.vergi || '').replace(/\D/g, ''), isk = Number(String(f.discountRate || '0').replace(',', '.'));
    BD.hata = ''; BD.uyari = '';
    if (vergi && ![10, 11].includes(vergi.length)) BD.hata = 'Vergi numarası 10, TC kimlik numarası 11 hane olmalı.';
    else if (!Number.isFinite(isk) || isk < 0 || isk > 100) BD.hata = 'İskonto 0 ile 100 arasında olmalı.';
    if (BD.hata) return bdCiz();
    const alanlar = { phone: f.phone, address: f.address, district: f.district, city: f.city, vergi, taxBranch: f.taxBranch,
      ...(CLK.izin('cari') ? { priceType: Number(f.priceType) || 0, discountRate: isk } : {}) };
    BD.kay = true; bdCiz();
    try {
      const r = await spSor({ islem: 'musteri_guncelle', uye: Number(BD.uid), alanlar });
      if (r.uye) for (const k of ['phone', 'invoice', 'delivery', 'taxId', 'nationalId', 'taxBranch', 'priceType', 'discountRate']) if (k in r.uye) u[k] = r.uye[k];
      const sd = r.site?.degisen || [], pd = r.parasut?.degisen || [];
      const uy = [r.site?.uyari, r.parasut?.hata, r.parasut?.uyari].filter(Boolean);
      const ad = l => [...new Set(l.map(k => BD_AD[k] || k))].join(', ');
      const not = !sd.length && !pd.length ? 'Değişiklik yoktu; site ve Paraşüt zaten aynı.'
        : [sd.length ? 'Sitede ' + ad(sd) : '', pd.length ? 'Paraşüt\'te ' + ad(pd) : '', r.parasut?.yok ? 'bu üye Paraşüt\'te eşleşmemiş, yalnız siteye yazıldı' : ''].filter(Boolean).join(' · ') + ' güncellendi.';
      if (uy.length) { BD.uyari = not + ' ' + uy.join(' '); BD.kay = false; BD.ilk = bdForm(u); return bdCiz(); }
      Object.assign(BD, { uid: null, kay: false, not: { uid: String(u.id), yazi: not } });
      CLK.toast('Bilgiler kaydedildi');
    } catch (e) { BD.hata = 'Kaydedilemedi: ' + e.message; BD.kay = false; }
    bdCiz();
  }
  function bdHtml(u) {
    const f = BD.form, kapali = BD.yuk || BD.kay ? 'disabled' : '', fiyatYetki = CLK.izin('cari');
    // Paraşüt'teki değer formdakinden farklıysa gösterilir (vergi no yalnız 10/11 haneyse: "bunu yaz" geçersiz numarayla siteyi boşaltmasın)
    const pDeger = (pk, k) => { const v = String(BD.p?.[pk] ?? '').trim(); if (k === 'vergi' && !/^\d{10,11}$/.test(v)) return ''; return v && v.replace(/\s+/g, ' ').toLocaleUpperCase('tr') !== String(BD.ilk?.[k] ?? '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr') ? v : ''; };
    const alan = ([k, ad, tip, pk]) => { const pv = pDeger(pk, k);
      return `<label class="bd-a${k === 'address' ? ' bd-genis' : ''}"><span>${ad}</span><input id="bd-${k}" data-bd="${k}" value="${esc(f[k])}" ${tip === 'tel' ? 'type="tel" inputmode="tel" autocomplete="off"' : tip === 'numeric' ? 'type="text" inputmode="numeric" autocomplete="off"' : 'type="text"'} ${kapali}>
        ${pv ? `<small class="bd-p">Paraşüt'te: ${esc(pv)} <button class="link" data-act="bdAl" data-k="${k}" data-v="${esc(pv)}">bunu yaz</button></small>` : ''}</label>`; };
    return `<div class="bd-form" role="form" aria-label="Müşteri bilgilerini düzenle">
      <div class="bd-ust"><b>Bilgileri düzenle</b><small>${BD.yuk ? 'Site ve Paraşüt\'ten okunuyor…' : BD.pid ? `Site üyesi ve Paraşüt müşterisi${BD.p?.ad ? ' (' + esc(BD.p.ad) + ')' : ''} birlikte güncellenir` : 'Bu üye Paraşüt\'te bir müşteriyle eşleşmemiş; yalnız siteye yazılır'}</small></div>
      ${BD.pHata ? `<p class="msg err">${esc(BD.pHata)}</p>` : ''}
      <div class="bd-g">${BD_ALAN.map(alan).join('')}
        ${fiyatYetki ? `<label class="bd-a"><span>Fiyat tanımı</span><select id="bd-priceType" data-bd="priceType" ${kapali}>${Object.entries(FIYAT).map(([v, t]) => `<option value="${v}"${String(f.priceType) === v ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="bd-a"><span>İskonto %</span><input id="bd-discountRate" data-bd="discountRate" type="text" inputmode="decimal" value="${esc(f.discountRate)}" ${kapali}></label>` : ''}</div>
      <p class="hint">Fatura adresi değişir; teslimat adresi aynıysa o da değişir. Paraşüt'te dolu bir alanı burada boş bırakırsanız Paraşüt'teki değer kalır.${fiyatYetki ? ' Fiyat tanımı ve iskonto yalnız sitede geçerli (Paraşüt\'te fiyat listesi yok).' : ''}</p>
      ${BD.hata ? `<p class="msg err">${esc(BD.hata)}</p>` : ''}${BD.uyari ? `<p class="msg err">${esc(BD.uyari)}</p>` : ''}
      <div class="bd-d"><button class="btn dark" data-act="bdKaydet" ${kapali}>${BD.kay ? 'Kaydediliyor…' : 'Kaydet'}</button><button class="btn" data-act="bdKapat" ${BD.kay ? 'disabled' : ''}>Vazgeç</button></div>
    </div>`;
  }
  views.musteri = () => {
    const u = userById(S.arg), pasif = !!u && Number(u.status) === 0;
    // geri düğmesi müşteri kartının açıldığı sayfaya döner (celik 02.11: "cari hesaptan müşteriye girdiğimizde geri cari hesap sayfasına geçmek için düğme bırak")
    const don = S.ui.mDon && GERI[S.ui.mDon.r] ? S.ui.mDon : null;
    const back = don ? `<button class="btn sm" data-act="mGeri">← ${GERI[don.r]}</button>` : '<button class="btn sm" data-go="musteriler">← Müşteriler</button>';
    const cariGor = CLK.izin('cari'), hGor = !!CLK.mHesap?.gorur();
    if (u && cariGor) cariOzetGerekirse();
    if (!u) return head('Müşteri', 'Bulunamadı', '', back) + (S.uLoading ? skel() : '<div class="card empty"><h3>Müşteri bulunamadı</h3></div>');
    const s = custStats(u), os = ordersOf(u.id), bal = Number(u.balance) || 0;
    const tabs = [hGor && ['ozet', 'Özet'], hGor && ['hareket', 'Hesap hareketleri'], ['siparis', 'Site siparişleri'], ['bilgi', 'Bilgiler']].filter(Boolean);
    if (!tabs.some(([k]) => k === MT.tab)) MT.tab = tabs[0][0];
    const prices = { 0: 'Varsayılan', 2: 'Bayi fiyatı 1', 3: 'Bayi fiyatı 2', 4: 'Bayi fiyatı 3', 5: 'Bayi fiyatı 4' };
    const fav = {}; os.filter(O.counts).forEach(o => O.items(o).forEach(i => { (fav[i.code] ||= { name: i.name, code: i.code, q: 0 }).q += Number(i.netQuantity ?? i.quantity) || 0; }));
    const favs = Object.values(fav).sort((a, b) => b.q - a.q).slice(0, 5);
    const adres = a => [a?.address, a?.district, a?.city].filter(Boolean).join(', ');
    const sipBtn = CLK.izin('siparisgir') && CLK.siparisAc && !pasif ? `<button class="btn mk-koyu" data-act="mSiparis" data-u="${u.id}">Sipariş gir</button>` : '';
    const waBtn = cariGor && bal < -0.5 && !pasif ? `<button class="btn mk-koyu mk-wa" data-act="mhWa" data-u="${u.id}" data-ad="${esc(userName(u))}" data-tel="${esc(u.phone || '')}" data-bal="${bal}"><span aria-hidden="true">✆</span> Borç hatırlat</button>` : '';
    const ekstreBtn = hGor ? `<button class="btn mk-ek" data-act="mhEkstre" data-u="${u.id}" ${CLK.mHesap.hazir(u.id) ? '' : 'disabled'} title="Seçili dönemin hesap özeti resmi">Ekstre gönder</button>` : '';
    // Paraşüt bakiyesi (artı = borç) site bakiyesiyle (eksi = borç) tutmuyorsa yazılır; eşitleme birkaç dakikada bir yansıtır
    const pBak = cariGor ? CLK.mHesap?.bakiye(u.id) : null;
    const fark = pBak !== null && pBak !== undefined && Math.abs(pBak + bal) > 0.5;
    const yan = cariGor ? `<div class="sum-card mk-bak">
        <div><small class="mk-et">GÜNCEL BAKİYE</small>
          <div class="big" style="color:${bal < -0.005 ? '#f0a39a' : 'var(--gold-2)'}">${tl2(Math.abs(bal))}</div>
          <small class="mk-dr">${bal < -0.005 ? 'Müşterinin borcu' : bal > 0.005 ? 'Müşterinin alacağı (fazla ödeme)' : 'Hesap kapalı'}</small>
          ${fark ? `<small class="mk-fark">Paraşüt'te ${tl2(Math.abs(pBak))} ${pBak > 0.005 ? 'borç' : pBak < -0.005 ? 'alacak' : ''} görünüyor; eşitleme birkaç dakikada yansıtır.</small>` : ''}
          ${sonOdeme(u)}</div>
        ${pasif ? '<p class="mk-pasif">Pasif üye</p>' : `<div class="mk-dug"><button class="btn gold" data-act="thAc" data-u="${u.id}" data-yer="musteri" data-sekil="para">Ödeme gir</button>${CLK.izin('senet') ? `<button class="btn mk-koyu" data-act="thAc" data-u="${u.id}" data-yer="musteri" data-sekil="senet">Senet gir</button>` : ''}${ekstreBtn}${sipBtn}${waBtn}</div>`}
        ${notKutu(u)}
      </div>` : `<div class="sum-card mk-bak"><dl><dt>Telefon</dt><dd>${esc(u.phone || '—')}</dd><dt>Sipariş</dt><dd>${num(s.n)}</dd></dl>${ekstreBtn || sipBtn ? `<div class="mk-dug">${ekstreBtn}${sipBtn}</div>` : ''}</div>`;
    const siparisHtml = `<div class="mini-kpis"><div><span>Sipariş</span><b>${num(s.n)}</b></div><div><span>Toplam alışveriş</span><b>${tl(s.spend)}</b></div><div><span>Ortalama sepet</span><b>${tl(s.n ? s.spend / s.n : 0)}</b></div><div><span>Son sipariş</span><b>${s.last ? dt(s.last) : '—'}</b></div></div>
      ${os.length ? `<div class="olist">${os.map(o => `<button class="orow" data-order="${O.id(o)}"><div class="o1"><b>${esc(O.code(o))}</b><small>${dtt(O.date(o))} · ${O.items(o).length} kalem</small></div><div class="o2">${O.items(o).slice(0, 2).map(i => `<span>${esc(i.name)} ×${num(i.quantity)}</span>`).join('')}</div><div class="o3"><b class="num">${tl(O.total(o))}</b>${st(O.status(o))}</div></button>`).join('')}</div>` : '<p class="sub">Sitede sipariş yok.</p>'}`;
    const favHtml = favs.length ? `<h3 class="mk-h3">En çok aldıkları <small>site siparişleri</small></h3><ul class="mk-fav">${favs.map(f => `<li><div><b>${esc(f.name)}</b><small>${esc(f.code)}</small></div><b class="num">${num(f.q)} adet</b></li>`).join('')}</ul>` : '';
    const bdNot = BD.not?.uid === String(u.id) ? `<p class="msg ok bd-not">${esc(BD.not.yazi)}</p>` : '';
    const bilgiHtml = BD.uid === String(u.id) ? bdHtml(u) : `${bdNot}${bdDuzenler() && !pasif ? `<div class="bd-bas"><button class="btn sm dark" data-act="bdAc" data-u="${u.id}">Bilgileri düzenle</button></div>` : ''}<dl class="mk-dl"><dt>Telefon</dt><dd>${u.phone ? `${esc(u.phone)} <button class="btn sm" data-act="copy" data-v="${esc(u.phone)}">Kopyala</button>` : '—'}</dd>
        <dt>E-posta</dt><dd style="word-break:break-all">${esc(u.email || '—')}</dd>
        ${u.taxId || u.nationalId ? `<dt>${u.taxId ? 'Vergi' : 'TC kimlik'}</dt><dd>${esc(u.taxBranch || '')} ${esc(u.taxId || u.nationalId)}</dd>` : ''}
        <dt>Fiyat grubu</dt><dd>${esc(prices[u.priceType] || 'Varsayılan')}</dd><dt>İskonto</dt><dd>%${num(u.discountRate)}</dd>
        <dt>Açık hesap limiti</dt><dd>${Number(u.nBalanceStatus) === 1 ? (Number(u.nBalanceLimit) ? tl(u.nBalanceLimit) : 'Limitsiz') : 'Kapalı'}</dd>
        ${u.customerGroup?.name ? `<dt>Grup</dt><dd>${esc(u.customerGroup.name)}</dd>` : ''}
        <dt>Fatura adresi</dt><dd>${esc(adres(u.invoice) || '—')}</dd>
        ${adres(u.delivery) && adres(u.delivery) !== adres(u.invoice) ? `<dt>Teslimat adresi</dt><dd>${esc(adres(u.delivery))}</dd>` : ''}
        <dt>Site kodu</dt><dd>${esc(u.code || '—')}</dd>${u.createdAt ? `<dt>Kayıt</dt><dd>${dt(u.createdAt)}</dd>` : ''}${u.lastLoginAt && !/^0000/.test(u.lastLoginAt) ? `<dt>Son giriş</dt><dd>${dt(u.lastLoginAt)}</dd>` : ''}</dl>
      ${hGor ? '' : favHtml}`;
    const alt = [esc(u.title && u.title !== userName(u) ? u.title : ''), esc(u.invoice?.city || ''), esc(u.phone || ''), pasif ? 'Pasif üye' : ''].filter(Boolean).join(' · ');
    return head(Number(u.dealerStatus) === 1 ? 'Bayi' : 'Müşteri', esc(userName(u)), alt, back) + (CLK.tahsilat?.kart('musteri', u.id) || '') + `
      <div class="mk">
        <aside class="mk-yan">${yan}</aside>
        <div class="mk-ana">
          <div class="mk-tabs" role="tablist">${tabs.map(([k, t]) => `<button role="tab" class="mk-tab" data-act="mTab" data-k="${k}" aria-selected="${MT.tab === k}">${t}${k === 'siparis' && os.length ? ` <b>${num(os.length)}</b>` : ''}</button>`).join('')}</div>
          <div class="card mk-ic">${MT.tab === 'ozet' ? CLK.mHesap.ozetHtml(u, favHtml) : MT.tab === 'hareket' ? CLK.mHesap.html(u) : MT.tab === 'siparis' ? siparisHtml : bilgiHtml}</div>
        </div>
      </div>${CLK.mHesap?.ekstreHtml() || ''}`;
  };

  /* ---------- cari ---------- */
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
  views.bind_musteri = () => {
    notBagla(); CLK.tahsilat?.bagla?.();
    // bilgi formu: yazarken sayfa çizilmez (telefonda klavye kapanmasın)
    $$('[data-bd]').forEach(i => i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', () => { if (BD.form) BD.form[i.dataset.bd] = i.value; }));
  };
  // ana panel: ödeme günü gelen (yarın dahil) ve geçen notlar
  CLK.cariNot = {
    panel: () => {
      if (!CLK.izin('cari')) return '';
      cariOzetGerekirse();
      const z = ozetMap();
      const L = (NT.l || []).filter(n => n.tarih && gecen(n.tarih) >= -1).map(n => ({ n, u: userById(n.site), d: notDurum(n, z[n.site]) }))
        .filter(x => x.u).sort((a, b) => a.n.tarih.localeCompare(b.n.tarih));
      if (!L.length) return '';
      return `<div class="card"><div class="card-h"><div><h3>Ödeme sözleri</h3><p class="sub">Ödeme günü gelen ve geçen müşteri notları</p></div><button class="btn sm ghost" data-go="musteriler">Müşteriler</button></div>
        <ul class="rows">${L.map(({ n, u, d }) => { const bal = Number(u.balance) || 0; return `<li data-user="${u.id}"><div class="t"><b>${esc(userName(u))}</b><small>${esc(n.metin || 'Ödeme günü')}${n.tutar ? ' · ' + tl(n.tutar) : ''} · ${dt(n.tarih)}</small></div>
          <span class="pill ${d.k === 'ok' ? 'ok' : d.k === 'bad' ? 'bad' : 'warn'}">${esc(d.k === 'ok' ? 'Ödeme geldi' : d.k === 'bad' ? 'Geçti' : d.t)}</span><b class="num ${bal < -0.5 ? 'neg' : ''}" style="margin-left:8px">${tl2(bal)}</b></li>`; }).join('')}</ul></div>`;
    }
  };
  const CZ = (S.ui.cz ||= { v: null, yuk: false, hata: '', zaman: 0, tekrar: 0 });
  const cariOzetGerekirse = () => { if (!CZ.yuk && !CZ.hata && (!CZ.v || Date.now() - CZ.zaman > 20 * 60e3)) setTimeout(() => cariOzetYukle(false), 0); };
  async function cariOzetYukle(yenile) {
    if (CZ.yuk || !CLK.tahsilat?.sor) return;
    CZ.yuk = true; CZ.hata = ''; if (cariAcik()) { S.keepScroll = true; render(); }
    const ciz = () => { if (cariAcik() || ['musteri', 'panel'].includes(S.route) && !(NT.ed && document.activeElement?.id?.startsWith('nt'))) { S.keepScroll = true; render(); } };
    try {
      const j = await CLK.tahsilat.sor({ islem: 'cari_ozet', yenile: !!yenile });
      if (j.musteriler?.length || !CZ.v) CZ.v = j;
      if (Array.isArray(j.notlar)) NT.l = j.notlar;
      CZ.zaman = Date.now();
      // sunucu eski listeyi verip yenisini arka planda hesaplıyorsa biraz sonra yeniden sorulur
      if (j.eski && CZ.tekrar < 4) { CZ.tekrar++; setTimeout(() => { if (cariAcik()) cariOzetYukle(false); }, 40000); } else CZ.tekrar = 0;
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
    if (S.uErr && !S.users.length) return head('Satış', 'Müşteriler', '', acts) + odeme + errBox(S.uErr, 'reloadU');
    if (!S.uLoaded && !S.users.length) return head('Satış', 'Müşteriler', 'Alınıyor…', acts) + odeme + skel();
    const R = cariSatirlar(), nm = notMap();
    const debtors = R.filter(r => r.bal < -0.5), creditors = R.filter(r => r.bal > 0.5), gec = R.filter(r => r.gec);
    const yedi = R.filter(r => r.son !== null && r.son <= 7).length;
    const q = C.q.trim().toLocaleLowerCase('tr');
    let L = R.filter(r => {
      if (C.f === 'borclu' && !(r.bal < -0.5)) return false;
      if (C.f === 'alacakli' && !(r.bal > 0.5)) return false;
      if (C.f === 'gec' && !r.gec) return false;
      if (C.f === 'not' && !nm[r.u.id]) return false;
      if (C.f === 'bayi' && Number(r.u.dealerStatus) !== 1) return false;
      if (C.f === 'onay' && Number(r.u.dealerStatus) !== 2) return false;
      return !q || [userName(r.u), r.u.title, r.u.phone, r.u.email, r.u.code, r.u.taxId, r.u.invoice?.city, r.z?.ad].join(' ').toLocaleLowerCase('tr').includes(q);
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
      <div class="k"><b>${esc(userName(r.u))}${Number(r.u.dealerStatus) === 2 ? ' <span class="pill warn">Bayilik onayı bekliyor</span>' : ''}</b><small>${Number(r.u.dealerStatus) === 1 ? 'Bayi · ' : ''}${esc(r.u.phone || r.u.email || r.u.code || '')}${r.u.invoice?.city ? ' · ' + esc(r.u.invoice.city) : ''}</small></div>
      <div class="b"><b class="num ${r.bal < -0.5 ? 'neg' : r.bal > 0.5 ? 'pos' : ''}">${tl2(r.bal)}</b><small>${durum(r)}${!nm[r.u.id] && NT.l ? ` · <button class="nt-arti" data-act="ntAc" data-id="${r.u.id}" title="Ödeme notu ekle">+ Not</button>` : ''}</small></div>
      <div class="o"><span class="m">Son ödeme</span>${odemeHucre(r)}</div>
      <div class="h"><span class="m">Son hareket</span>${hareketHucre(r)}</div>
      ${notH(r)}
    </li>${NT.ed?.id === String(r.u.id) ? `<li class="cz-ed">${notForm(false)}</li>` : ''}`;
    const zaman = CZ.v?.zaman ? new Date(CZ.v.zaman).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
    const altYazi = CZ.hata ? `<span class="cz-gec">Son ödeme tarihleri alınamadı: ${esc(CZ.hata)}</span>`
      : CZ.yuk ? 'Son ödeme ve hareket tarihleri Paraşüt\'ten alınıyor…' : zaman ? `Ödeme ve hareket tarihleri Paraşüt'ten, ${zaman} itibarıyla. Satıra dokununca müşterinin hareketleri açılır.` : '';
    const onay = R.filter(r => Number(r.u.dealerStatus) === 2).length;
    return head('Satış', 'Müşteriler', `${num(R.length)} müşteri · borç, son ödeme ve ödeme notları`, acts) + odeme + `
      <div class="kpis">
        <div class="kpi hero"><div class="k">Toplam alacak</div><div class="v">${tl(Math.abs(debtors.reduce((a, r) => a + r.bal, 0)))}</div><div class="s">${num(debtors.length)} müşterinin borcu</div></div>
        <div class="kpi"><div class="k">Müşteri alacağı</div><div class="v">${tlc(creditors.reduce((a, r) => a + r.bal, 0))}</div><div class="s">${num(creditors.length)} hesapta artı bakiye</div></div>
        <div class="kpi ${gec.length ? 'bad' : ''}"><div class="k">${GEC} gündür ödemeyen</div><div class="v">${CZ.v ? tlc(Math.abs(gec.reduce((a, r) => a + r.bal, 0))) : '…'}</div><div class="s">${CZ.v ? num(gec.length) + ' borçlu müşteri' : 'tarihler alınıyor'}</div></div>
        <div class="kpi"><div class="k">Son 7 günde ödeyen</div><div class="v">${CZ.v ? num(yedi) : '…'}</div><div class="s">müşteri</div></div>
      </div>
      <div class="card cz" style="margin-top:18px">
        <div class="card-h"><div><h3>Müşteri carileri</h3><p class="sub">${altYazi}</p></div></div>
        <div class="tools"><input type="search" id="cq" placeholder="Müşteri ara" value="${esc(C.q)}"></div>
        <div class="chips">${[['hepsi', 'Hepsi', R.length], ['borclu', 'Borçlu', debtors.length], ['alacakli', 'Alacaklı', creditors.length], ['gec', GEC + ' gündür ödemeyen', CZ.v ? gec.length : ''], ['not', 'Ödeme notu olan', NT.l ? R.filter(r => nm[r.u.id]).length : ''], ['bayi', 'Bayiler', R.filter(r => Number(r.u.dealerStatus) === 1).length], ...(onay || C.f === 'onay' ? [['onay', 'Bayilik onayı bekleyen', onay]] : [])].map(([k, l, n]) => `<button class="chip" data-cf="${k}" aria-pressed="${C.f === k}">${l}${n !== '' ? ` <b>${n}</b>` : ''}</button>`).join('')}</div>
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
    else if (act === 'mTab') { MT.tab = el.dataset.k; S.keepScroll = true; render(); }
    else if (act === 'bdAc') bdAc(el.dataset.u);
    else if (act === 'bdKapat') { BD.uid = null; bdCiz(); }
    else if (act === 'bdKaydet') bdKaydet();
    else if (act === 'bdAl') { if (BD.form) { BD.form[el.dataset.k] = el.dataset.v; const i = $('#bd-' + el.dataset.k); if (i) i.value = el.dataset.v; } }
    else if (act === 'mSiparis') CLK.siparisAc?.(el.dataset.u);
    else if (act === 'ntAc') notAc(el.dataset.id);
    else if (act === 'ntKapat') { NT.ed = null; S.keepScroll = true; render(); }
    else if (act === 'ntKaydet') notKaydet(false);
    else if (act === 'ntSil') notKaydet(true);
    else if (act === 'mGeri') { const d = S.ui.mDon; S.ui.mDon = null; go(d?.r || 'musteriler', d?.a); if (d?.y) requestAnimationFrame(() => window.scrollTo({ top: d.y, behavior: 'instant' })); }
    else if (act === 'copy') { navigator.clipboard?.writeText(el.dataset.v).then(() => CLK.toast('Kopyalandı'), () => CLK.toast('Kopyalanamadı')); }
    else prevAct?.(act, el, e);
  };
})();
