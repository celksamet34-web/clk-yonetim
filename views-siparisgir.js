/* CLK Yönetim — Sipariş gir: personel müşteriyi ve Paraşüt ürünlerini seçer, renk renk adet yazar; sipariş sitede müşterinin carisine açılır, Paraşüt'e tek satış faturası olarak (renkler toplanmış) geçer */
(() => {
  const { sb, S, $, esc, toast, head, views, render, araKutu, araSec } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/siparis-parasut';
  const TIP = [[0, 'Site fiyatı', 'site'], [2, 'Bayi fiyatı 1', 'b1'], [3, 'Bayi fiyatı 2', 'b2'], [4, 'Bayi fiyatı 3', 'b3'], [5, 'Bayi fiyatı 4', 'b4']];
  const SIK_RENK = ['SİYAH', 'KAHVE', 'TABA', 'LACİVERT', 'GRİ', 'BEJ', 'VİZON', 'BORDO', 'KIRMIZI', 'YEŞİL', 'HAKİ', 'MAVİ', 'PEMBE', 'BEYAZ'];
  const D = (S.ui.sg ||= { musteriler: null, urunler: null, kurallar: {}, yuvarla: 1, renkler: {}, hata: '', ara: '', durum: '', sonuc: null, odak: '' });
  // taslak: sayfa yenilense de kaybolmaz
  const BOS = () => ({ istek: (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2)), musteri: null, tip: null, satirlar: [], not: '', teslim: false });
  let T;
  try { T = JSON.parse(localStorage.getItem('clk-siparis-taslak') || 'null'); } catch {}
  if (!T?.istek) T = BOS();
  const sakla = () => { try { localStorage.setItem('clk-siparis-taslak', JSON.stringify(T)); } catch {} };
  const fmt = v => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);
  const sayi = v => { const s = String(v ?? '').trim(); if (!s) return null; const n = Number(s.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const buyuk = s => String(s || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr');

  async function sor(govde) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.hata) throw new Error(j?.hata || 'Sunucu ' + r.status);
    return j;
  }
  // müşteriler: Paraşüt'le eşleşmiş site üyeleri; fiyat tanımı, iskonto ve bakiye sitedeki üye kartından
  async function musterileriAl() {
    const [{ data: es, error }] = await Promise.all([sb.from('sp_musteri_eslesme').select('site_ad,parasut_id,parasut_ad').not('parasut_id', 'is', null), CLK.loadUsers()]);
    if (error) throw new Error(error.message);
    for (let i = 0; i < 150 && !S.uLoaded && !S.uErr; i++) await new Promise(r => setTimeout(r, 200));
    if (!S.uLoaded) throw new Error(S.uErr || 'Site üyeleri alınamadı.');
    const uye = Object.fromEntries(S.users.map(x => [String(x.id), x]));
    return (es || []).map(e => { const x = uye[String(e.site_ad).slice(2)]; return x ? { id: Number(x.id), ad: e.parasut_ad, tip: Number(x.priceType) || 0, iskonto: Number(x.discountRate) || 0, bakiye: Number(x.balance) || 0, pid: e.parasut_id } : null; })
      .filter(Boolean).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  }
  async function yukle() {
    D.hata = ''; D.musteriler = D.urunler = null; render();
    try {
      const [m, u, k, a, r] = await Promise.all([
        musterileriAl(), sor({ islem: 'urunler' }),
        sb.from('fiyat_kural').select('*'), sb.from('fiyat_ayar').select('ad,deger'), sb.from('urun_renk').select('parasut_id,renkler')
      ]);
      D.musteriler = m;
      D.urunler = u.urunler.filter(x => !x[7]).map(([id, ad, alis, satis, stok, , , , kat]) => ({ id: String(id), ad, alis, satis, stok, kat: kat || '' }));
      D.kurallar = Object.fromEntries((k.data || []).map(r => [buyuk(r.kategori), r]));
      D.yuvarla = (a.data || []).find(x => x.ad === 'yuvarla')?.deger ?? 1;
      D.renkler = Object.fromEntries((r.data || []).map(x => [x.parasut_id, x.renkler || []]));
    } catch (e) { D.hata = e.message; }
    render();
  }

  const musteri = () => D.musteriler?.find(m => m.id === T.musteri) || null;
  const tip = () => T.tip ?? musteri()?.tip ?? 0;
  const urun = pid => D.urunler?.find(u => u.id === pid);
  // otomatik fiyat: alış + kategorinin oranı (müşterinin fiyat tanımına göre), oran yoksa Paraşüt satış fiyatı; sonra müşterinin iskontosu
  function otoFiyat(u) {
    if (!u) return { f: 0, kaynak: '' };
    const alan = TIP.find(t => t[0] === tip())?.[2] || 'site';
    const kural = D.kurallar[buyuk(u.kat)] || D.kurallar['KATEGORİSİZ'];
    const kuralli = CLK.fiyatla?.(u.alis, kural?.[alan], D.yuvarla);
    let f = kuralli ?? u.satis, kaynak = kuralli != null ? `${u.kat || 'Kategorisiz'} %${String(kural[alan]).replace('.', ',')}` : 'Paraşüt satış fiyatı';
    const isk = Number(musteri()?.iskonto) || 0;
    if (isk) { f = Math.round(f * (1 - isk / 100) * 100) / 100; kaynak += `, iskonto %${isk}`; }
    return { f, kaynak };
  }
  const birim = s => (s.fiyat != null ? s.fiyat : otoFiyat(urun(s.pid)).f);
  const adetler = s => s.renkler.filter(r => Number(r.adet) > 0);
  const satirAdet = s => adetler(s).reduce((t, r) => t + Number(r.adet), 0);
  const toplamAdet = () => T.satirlar.reduce((t, s) => t + satirAdet(s), 0);
  const toplam = () => T.satirlar.reduce((t, s) => t + satirAdet(s) * birim(s), 0);

  function urunEkle(pid) {
    let s = T.satirlar.find(x => x.pid === pid);
    if (!s) {
      const u = urun(pid), bilinen = D.renkler[pid] || [];
      s = { pid, ad: u?.ad || pid, fiyat: null, acik: true, renkler: bilinen.length ? bilinen.map(renk => ({ renk, adet: '' })) : [{ renk: '', adet: '' }] };
      T.satirlar.unshift(s);
    }
    T.satirlar.forEach(x => (x.acik = x === s));
    D.ara = ''; D.odak = `sgAdet-${pid}-0`; sakla(); render();
  }
  async function renkEkle(s, ad) {
    const renk = buyuk(ad).slice(0, 40);
    if (!renk) return;
    if (s.renkler.some(r => r.renk === renk)) { D.odak = `sgAdet-${s.pid}-${s.renkler.findIndex(r => r.renk === renk)}`; render(); return; }
    // tek boş "renksiz" satır varsa rengin yerini alır
    if (s.renkler.length === 1 && !s.renkler[0].renk && !s.renkler[0].adet) s.renkler = [];
    s.renkler.push({ renk, adet: '' });
    D.odak = `sgAdet-${s.pid}-${s.renkler.length - 1}`; sakla(); S.keepScroll = true; render();
    // ürünün renkleri hatırlanır, sonraki siparişte hazır gelir
    const liste = [...new Set([...(D.renkler[s.pid] || []), renk])];
    D.renkler[s.pid] = liste;
    const { error } = await sb.from('urun_renk').upsert({ parasut_id: s.pid, renkler: liste, guncel: new Date().toISOString() });
    if (error) toast('Renk hatırlanamadı: ' + error.message);
  }

  const aramaSonuc = () => {
    const k = buyuk(D.ara).split(' ').filter(Boolean);
    if (!k.length || !D.urunler) return [];
    return D.urunler.filter(u => { const a = buyuk(u.ad); return k.every(x => a.includes(x)); }).slice(0, 15);
  };

  const sonucHtml = () => {
    if (!buyuk(D.ara)) return '';
    const sonuc = aramaSonuc();
    return `<div class="sg-sonuc">${sonuc.length ? sonuc.map(u => `<button type="button" data-act="sgEkle" data-pid="${u.id}"><span><b>${esc(u.ad)}</b><small>${esc(u.kat || 'Kategorisiz')} · stok ${u.stok}${(D.renkler[u.id] || []).length ? ' · ' + D.renkler[u.id].length + ' renk' : ''}</small></span><em>${fmt(otoFiyat(u).f)} ₺</em></button>`).join('') : `<span>${D.urunler ? 'Eşleşen ürün yok' : 'Ürünler yükleniyor…'}</span>`}</div>`;
  };

  const renkOzet = s => adetler(s).map(r => `${r.renk ? esc(r.renk) + ' ' : ''}<b>${r.adet}</b>`).join(' · ') || '<span class="sg-soluk">Adet yazılmadı</span>';
  function satirUst(s) {
    const adet = satirAdet(s), b = birim(s);
    return `<div class="sg-satir-ad"><b>${esc(s.ad)}</b><small>${renkOzet(s)}</small></div>
        <div class="sg-satir-adet"><b>${adet}</b><small>adet</small></div>
        <div class="sg-satir-tutar"><b>${fmt(adet * b)} ₺</b><small>${fmt(b)} ₺ / adet</small></div>`;
  }
  function satirHtml(s) {
    const u = urun(s.pid), o = otoFiyat(u), b = birim(s);
    const renkler = s.renkler.map((r, i) => `<div class="sg-renk"><span class="sg-renk-ad">${r.renk ? esc(r.renk) : 'Renk yok'}</span>
      <input id="sgAdet-${s.pid}-${i}" class="sg-adet" data-pid="${s.pid}" data-i="${i}" inputmode="numeric" value="${esc(r.adet)}" placeholder="0" aria-label="${esc(r.renk || 'Adet')} adedi">
      ${s.renkler.length > 1 || r.renk ? `<button type="button" class="sg-x" data-act="sgRenkSil" data-pid="${s.pid}" data-i="${i}" aria-label="${esc(r.renk || 'Satırı')} kaldır">×</button>` : ''}</div>`).join('');
    const oneri = SIK_RENK.filter(r => !s.renkler.some(x => x.renk === r) && !(D.renkler[s.pid] || []).includes(r)).slice(0, 8);
    return `<div class="sg-satir ${s.acik ? 'acik' : ''}">
      <div class="sg-satir-ust" data-act="sgAc" data-pid="${s.pid}">${satirUst(s)}</div>
      ${s.acik ? `<div class="sg-satir-alt">
        <div class="sg-renkler">${renkler}</div>
        <div class="sg-renk-ekle"><input id="sgRenk-${s.pid}" data-pid="${s.pid}" placeholder="Renk ekle (yaz, Enter)" aria-label="Yeni renk adı">
          ${oneri.map(r => `<button type="button" class="chip" data-act="sgRenkEkle" data-pid="${s.pid}" data-renk="${esc(r)}">+ ${esc(r)}</button>`).join('')}</div>
        <div class="sg-fiyat"><label>Birim fiyat <input id="sgFiyat-${s.pid}" class="sg-fiyat-in ${s.fiyat != null ? 'elle' : ''}" data-pid="${s.pid}" inputmode="decimal" value="${String(b).replace('.', ',')}"> ₺</label>
          <small>${s.fiyat != null ? `Elle girildi. Hesaplanan ${fmt(o.f)} ₺ (${esc(o.kaynak)}) <button type="button" class="sg-link" data-act="sgOto" data-pid="${s.pid}">Hesaplanana dön</button>` : esc(o.kaynak)}${u ? ` · Paraşüt stok ${u.stok}` : ''}</small></div>
        <div class="sg-satir-dug"><button type="button" class="btn sm danger" data-act="sgSil" data-pid="${s.pid}">Ürünü çıkar</button><button type="button" class="btn sm" data-act="sgKapat" data-pid="${s.pid}">Tamam</button></div>
      </div>` : ''}
    </div>`;
  }

  // telefonda alt çubuk: toplam her an görünür, düğme özete götürür
  const mbarHtml = () => `<span><small>${T.satirlar.length} ürün · ${toplamAdet()} adet</small><b>${fmt(toplam())} ₺</b></span><button type="button" class="btn dark sm" data-act="sgOzeteGit">Özet ve onay</button>`;
  function ozetHtml() {
    const m = musteri(), n = T.satirlar.length, ta = toplamAdet();
    const eksik = !m ? 'Müşteri seçilmedi' : !ta ? 'Adet yazılmadı' : T.satirlar.some(s => !(birim(s) >= 0) || Number.isNaN(birim(s))) ? 'Fiyatı hatalı ürün var' : '';
    return `<div class="sg-baslik"><span class="sg-no">3</span><h3>Özet</h3></div>
      <dl><div><dt>Müşteri</dt><dd>${m ? esc(m.ad) : '—'}</dd></div><div><dt>Ürün</dt><dd>${n}</dd></div><div><dt>Toplam adet</dt><dd>${ta}</dd></div><div class="sg-genel"><dt>Toplam</dt><dd>${fmt(toplam())} ₺</dd></div></dl>
      <fieldset class="sg-teslim"><legend>Teslimat</legend>
        <label><input type="radio" name="sgTeslim" value="kargo" ${T.teslim ? '' : 'checked'}><span><b>Kargo ile gönderilecek</b><small>Sitede "Kargolandı" yapılınca Paraşüt'e geçer</small></span></label>
        <label><input type="radio" name="sgTeslim" value="elden" ${T.teslim ? 'checked' : ''}><span><b>Elden teslim edildi</b><small>5 dakika içinde Paraşüt'e geçer</small></span></label></fieldset>
      <label class="sg-not">Sipariş notu (müşteri görür)<textarea id="sgNot" rows="2">${esc(T.not)}</textarea></label>
      ${D.durum === 'onay' ? `<div class="sg-onay"><p><b>${esc(m.ad)}</b> carisine <b>${fmt(toplam())} ₺</b> tutarında, ${n} ürün / ${ta} adetlik sipariş açılacak.</p>
          <div class="sg-onay-dug"><button class="btn" data-act="sgVazgec">Geri dön</button><button class="btn dark" data-act="sgGonder">Onayla, siparişi aç</button></div></div>`
        : `<button class="btn dark sg-olustur" data-act="sgOnay" ${eksik || D.durum ? 'disabled' : ''}>${D.durum === 'gonderiliyor' ? 'Sipariş açılıyor…' : 'Siparişi oluştur'}</button>
          ${eksik ? `<p class="sg-soluk">${eksik}</p>` : ''}`}
      ${n || m ? '<button class="btn ghost sm" data-act="sgTemizle">Formu temizle</button>' : ''}`;
  }

  views.siparisgir = () => {
    if (!D.musteriler && !D.urunler && !D.hata && !yukle.basladi) { yukle.basladi = true; yukle(); }
    const ust = head('Satış', 'Sipariş gir', 'Müşteriyi seçin, ürünü arayıp tıklayın, renklerin adedini yazın. Sipariş sitede müşterinin carisine açılır; Paraşüt\'e tek satış faturası olarak gider (renkler toplanır).');
    if (D.hata) return ust + `<div class="card empty"><h3>Bilgiler alınamadı</h3><p>${esc(D.hata)}</p><button class="btn dark" data-act="sgYenile">Tekrar dene</button></div>`;
    if (D.sonuc) return ust + `<div class="card sg-tamam"><div class="pill ok">Sipariş açıldı</div><h3>${esc(D.sonuc.kod || 'Sipariş')}</h3>
      <p>${esc(D.sonuc.musteri)} · ${fmt(D.sonuc.toplam)} ₺</p><p class="sg-soluk">${D.sonuc.teslim ? 'Elden teslim olarak açıldı, 5 dakika içinde Paraşüt\'e satış faturası olur.' : 'Sitede "Kargolandı" yapılınca Paraşüt\'e satış faturası olur.'}</p>
      <button class="btn dark" data-act="sgYeni">Yeni sipariş</button></div>`;
    const m = musteri(), n = T.satirlar.length, ta = toplamAdet();
    const musteriKutu = `<div class="card sg-kart"><div class="sg-baslik"><span class="sg-no">1</span><h3>Müşteri</h3></div>
      ${araKutu('sgMusteri', D.musteriler, m?.ad || '', 'sgMus', { yer: D.musteriler ? `Müşteri adı yazın (${D.musteriler.length} müşteri)` : 'Müşteriler yükleniyor…' })}
      ${m ? `<div class="sg-mus-bilgi">
        <label>Fiyat tanımı (★ müşterinin) <select id="sgTip">${TIP.map(([k, l]) => `<option value="${k}" ${tip() === k ? 'selected' : ''}>${l}${k === m.tip ? ' ★' : ''}</option>`).join('')}</select></label>
        <div><small>İskonto</small><b>%${m.iskonto}</b></div>
        <div><small>Site bakiyesi</small><b class="${m.bakiye < 0 ? 'sg-borc' : ''}">${fmt(m.bakiye)} ₺</b></div></div>` : ''}
    </div>`;
    const urunKutu = `<div class="card sg-kart"><div class="sg-baslik"><span class="sg-no">2</span><h3>Ürünler</h3><span class="sg-soluk">${n ? `${n} ürün · ${ta} adet` : ''}</span></div>
      <div class="sg-ara"><input id="sgAra" type="search" autocomplete="off" placeholder="${D.urunler ? 'Ürün adı ya da kodu yazın (örn. 4924)' : 'Ürünler yükleniyor…'}" value="${esc(D.ara)}" ${m ? '' : 'disabled'} aria-label="Ürün ara">
        ${m ? `<div id="sgSonuc">${sonucHtml()}</div>` : '<p class="sg-soluk">Önce müşteriyi seçin; fiyatlar müşteriye göre hesaplanır.</p>'}</div>
      <div class="sg-satirlar">${n ? T.satirlar.map(satirHtml).join('') : m ? '<p class="sg-bos">Henüz ürün eklenmedi. Yukarıda arayıp tıklayın.</p>' : ''}</div>
    </div>`;
    return `${ust}<div class="sg-duzen"><div class="sg-sol">${musteriKutu}${urunKutu}</div><div class="sg-sag"><div class="card sg-ozet" id="sgOzet">${ozetHtml()}</div></div></div>
      <div class="sg-mbar" id="sgMbar" ${n ? '' : 'hidden'}>${mbarHtml()}</div>`;
  };

  araSec.sgMus = mus => { T.musteri = mus.id; T.tip = null; D.durum = ''; sakla(); D.odak = 'sgAra'; };

  // adet yazılınca yalnız ürünün başlığı ve özet yenilenir; odaktaki kutu yerinde kalır
  function parcaYenile(s) {
    const ust = document.querySelector(`.sg-satir-ust[data-pid="${s.pid}"]`); if (ust) ust.innerHTML = satirUst(s);
    const oz = $('#sgOzet'); if (oz && !oz.contains(document.activeElement)) oz.innerHTML = ozetHtml();
    const mb = $('#sgMbar'); if (mb) mb.innerHTML = mbarHtml();
  }

  views.bind_siparisgir = () => {
    const ara = $('#sgAra');
    // yazarken sayfa yeniden çizilmez (mobilde her harfte klavye sıfırlanıyor, ekran kayıyordu): yalnız sonuç listesi yenilenir
    ara?.addEventListener('input', () => { D.ara = ara.value; clearTimeout(D.t); D.t = setTimeout(() => { const k = $('#sgSonuc'); if (k) k.innerHTML = sonucHtml(); }, 80); });
    ara?.addEventListener('keydown', e => { if (e.key === 'Enter') { const ilk = aramaSonuc()[0]; if (ilk) { e.preventDefault(); urunEkle(ilk.id); } } });
    $('#sgTip')?.addEventListener('change', e => { T.tip = Number(e.target.value); sakla(); S.keepScroll = true; render(); });
    // özet parça parça yenilendiği için olaylar kapsayıcıdan dinlenir
    const oz = $('#sgOzet');
    oz?.addEventListener('input', e => { if (e.target.id === 'sgNot') { T.not = e.target.value; sakla(); } });
    oz?.addEventListener('change', e => { if (e.target.name === 'sgTeslim') { T.teslim = e.target.value === 'elden'; sakla(); oz.innerHTML = ozetHtml(); } });
    const sat = $('.sg-satirlar');
    sat?.addEventListener('input', e => {
      const el = e.target, s = T.satirlar.find(x => x.pid === el.dataset.pid); if (!s) return;
      if (el.classList.contains('sg-adet')) { s.renkler[+el.dataset.i].adet = el.value.replace(/\D/g, ''); sakla(); parcaYenile(s); }
    });
    sat?.addEventListener('change', e => {
      const el = e.target, s = T.satirlar.find(x => x.pid === el.dataset.pid); if (!s) return;
      if (el.classList.contains('sg-fiyat-in')) {
        const v = sayi(el.value);
        if (v == null || Number.isNaN(v) || v < 0) toast('Fiyat sayı olmalı (örn. 230 ya da 229,90)');
        else s.fiyat = Math.abs(v - otoFiyat(urun(s.pid)).f) < 0.005 ? null : v;
        sakla(); S.keepScroll = true; render();
      }
    });
    sat?.addEventListener('keydown', e => {
      const el = e.target; if (e.key !== 'Enter') return;
      const s = T.satirlar.find(x => x.pid === el.dataset.pid); if (!s) return;
      e.preventDefault();
      if (el.id.startsWith('sgRenk-')) { const v = el.value; el.value = ''; renkEkle(s, v); }
      else if (el.classList.contains('sg-adet')) { const sonraki = $(`#sgAdet-${s.pid}-${+el.dataset.i + 1}`); (sonraki || $(`#sgRenk-${s.pid}`))?.focus(); }
    });
    // çekirdek yeniden çizimde eski odağı geri verir; istenen odak ondan sonra verilir
    if (D.odak) { const id = D.odak; D.odak = ''; queueMicrotask(() => document.getElementById(id)?.focus()); }
  };

  async function gonder() {
    const m = musteri(); if (!m) return;
    const satirlar = T.satirlar.flatMap(s => adetler(s).map(r => ({ pid: s.pid, renk: r.renk, adet: Number(r.adet), fiyat: birim(s) })));
    D.durum = 'gonderiliyor'; render();
    try {
      const r = await sor({ islem: 'siparis_gir', siparis: { istek: T.istek, userId: m.id, satirlar, not: T.not, teslim: T.teslim } });
      D.sonuc = r; T = BOS(); sakla(); D.durum = '';
      toast(`Sipariş ${r.kod || ''} açıldı`);
    } catch (e) { D.durum = ''; toast(/Oturum gerekli/.test(e.message) ? 'Siparişi siteye gönderme henüz açılmadı (sunucu güncellemesi bekleniyor). Taslak saklandı.' : 'Sipariş açılamadı: ' + e.message); }
    render();
  }

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    const s = el.dataset.pid ? T.satirlar.find(x => x.pid === el.dataset.pid) : null;
    if (act === 'sgYenile') yukle();
    else if (act === 'sgEkle') urunEkle(el.dataset.pid);
    else if (act === 'sgAc' && s) { const ac = !s.acik; T.satirlar.forEach(x => (x.acik = false)); s.acik = ac; if (ac) D.odak = `sgAdet-${s.pid}-0`; sakla(); S.keepScroll = true; render(); }
    else if (act === 'sgKapat' && s) { s.acik = false; sakla(); S.keepScroll = true; render(); }
    else if (act === 'sgSil' && s) { T.satirlar = T.satirlar.filter(x => x !== s); sakla(); S.keepScroll = true; render(); }
    else if (act === 'sgRenkEkle' && s) renkEkle(s, el.dataset.renk);
    else if (act === 'sgRenkSil' && s) { s.renkler.splice(+el.dataset.i, 1); if (!s.renkler.length) s.renkler.push({ renk: '', adet: '' }); sakla(); S.keepScroll = true; render(); }
    else if (act === 'sgOto' && s) { s.fiyat = null; sakla(); S.keepScroll = true; render(); }
    else if (act === 'sgOnay') { D.durum = 'onay'; S.keepScroll = true; render(); }
    else if (act === 'sgVazgec') { D.durum = ''; S.keepScroll = true; render(); }
    else if (act === 'sgGonder') gonder();
    else if (act === 'sgOzeteGit') { document.activeElement?.blur(); $('#sgOzet')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else if (act === 'sgYeni') { D.sonuc = null; render(); }
    else if (act === 'sgTemizle') { T = BOS(); D.durum = ''; sakla(); render(); }
    else prevAct?.(act, el, e);
  };
})();
