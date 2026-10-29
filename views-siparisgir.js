/* CLK Yönetim — Sipariş gir: personel müşteriyi ve Paraşüt ürünlerini seçer, renk renk adet yazar; sipariş sitede müşterinin carisine açılır, Paraşüt'e tek satış faturası olarak (renkler toplanmış) geçer */
(() => {
  const { sb, S, $, esc, toast, head, views, render, araKutu, araSec, ARA } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/siparis-parasut';
  const TIP = [[0, 'Site fiyatı', 'site'], [2, 'Bayi fiyatı 1', 'b1'], [3, 'Bayi fiyatı 2', 'b2'], [4, 'Bayi fiyatı 3', 'b3'], [5, 'Bayi fiyatı 4', 'b4']];
  const SIK_RENK = ['SİYAH', 'KAHVE', 'TABA', 'LACİVERT', 'GRİ', 'BEJ', 'VİZON', 'BORDO', 'KIRMIZI', 'YEŞİL', 'HAKİ', 'MAVİ', 'PEMBE', 'BEYAZ'];
  const D = (S.ui.sg ||= { musteriler: null, urunler: null, kurallar: {}, yuvarla: 1, renkler: {}, hata: '', ara: '', durum: '', sonuc: null, odak: '' });
  // form her açılışta boş gelir (celik isteği 29.10.2026); taslak saklanmaz
  const BOS = () => ({ istek: (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2)), musteri: null, tip: null, satirlar: [], not: '', teslim: false });
  let T = BOS();
  try { localStorage.removeItem('clk-siparis-taslak'); } catch {}
  const sakla = () => {};
  function yeniForm() {
    T = BOS(); D.durum = ''; D.sonuc = null; D.ara = ''; D.gizli = false; delete ARA.sgMusteri;
  }
  // menüden ya da logodan Sipariş gir'e her gelişte form sıfırlanır (yakalama aşamasında, sayfa çizilmeden önce)
  document.addEventListener('click', e => { if (e.target.closest?.('[data-go="siparisgir"]')) yeniForm(); }, true);
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
  CLK.spSor = sor;
  // Siparişler › Düzelt: sitedeki sipariş forma yüklenir; kaydedince eski sipariş iptal edilir, yerine bu açılır
  CLK.siparisDuzelt = v => {
    yeniForm();
    T.duzelt = v.kod; T.musteri = v.userId; T.teslim = !!v.teslim; T.not = v.not || '';
    for (const x of v.satirlar) {
      let s = T.satirlar.find(y => y.pid === x.pid);
      if (!s) T.satirlar.push(s = { pid: x.pid, ad: urun(x.pid)?.ad || x.ad, fiyat: x.fiyat, acik: false, renkler: [] });
      const r = s.renkler.find(y => y.renk === x.renk);
      if (r) r.adet = String(Number(r.adet) + x.adet); else s.renkler.push({ renk: x.renk, adet: String(x.adet) });
    }
    CLK.go('siparisgir');
  };
  // müşteriler: Paraşüt'le eşleşmiş site üyeleri; fiyat tanımı, iskonto ve bakiye sitedeki üye kartından
  async function musterileriAl() {
    const [{ data: es, error }] = await Promise.all([sb.from('sp_musteri_eslesme').select('site_ad,parasut_id,parasut_ad').not('parasut_id', 'is', null), CLK.loadUsers()]);
    if (error) throw new Error(error.message);
    for (let i = 0; i < 150 && !S.uLoaded && !S.uErr; i++) await new Promise(r => setTimeout(r, 200));
    if (!S.uLoaded) throw new Error(S.uErr || 'Site üyeleri alınamadı.');
    const uye = Object.fromEntries(S.users.map(x => [String(x.id), x]));
    return (es || []).map(e => { const x = uye[String(e.site_ad).slice(2)]; return x ? { id: Number(x.id), ad: e.parasut_ad, tip: Number(x.priceType) || 0, iskonto: Number(x.discountRate) || 0, bakiye: Number(x.balance) || 0, pid: e.parasut_id,
      tel: x.phone || '', adres: [x.delivery?.address || x.invoice?.address, x.delivery?.district || x.invoice?.district, x.delivery?.city || x.invoice?.city].filter(Boolean).join(', '), vergi: [x.taxBranch, x.taxId || x.nationalId].filter(Boolean).join(' ') } : null; })
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
          <small>${s.fiyat != null ? `Elle girildi.${D.gizli ? ` Hesaplanan ${fmt(o.f)} ₺ (${esc(o.kaynak)})` : ''} <button type="button" class="sg-link" data-act="sgOto" data-pid="${s.pid}">Hesaplanana dön</button>` : D.gizli ? esc(o.kaynak) : ''}${u ? `${s.fiyat != null || D.gizli ? ' · ' : ''}Paraşüt stok ${u.stok}` : ''}</small></div>
        <div class="sg-satir-dug"><button type="button" class="btn sm danger" data-act="sgSil" data-pid="${s.pid}">Ürünü çıkar</button><button type="button" class="btn sm" data-act="sgKapat" data-pid="${s.pid}">Tamam</button></div>
      </div>` : ''}
    </div>`;
  }

  // telefonda alt çubuk: toplam her an görünür, düğme özete götürür
  const mbarHtml = () => `<span><small>${T.satirlar.length} ürün · ${toplamAdet()} adet</small><b>${fmt(toplam())} ₺</b></span><button type="button" class="btn dark sm" data-act="sgOzeteGit">Özet ve onay</button>`;
  const sonVar = () => { try { return !!localStorage.getItem('clk-siparis-son'); } catch { return false; } };
  function ozetHtml() {
    const m = musteri(), n = T.satirlar.length, ta = toplamAdet();
    const eksik = !m ? 'Müşteri seçilmedi' : !ta ? 'Adet yazılmadı' : T.satirlar.some(s => !(birim(s) >= 0) || Number.isNaN(birim(s))) ? 'Fiyatı hatalı ürün var' : '';
    return `<div class="sg-baslik"><span class="sg-no">3</span><h3>Özet</h3></div>
      <dl><div><dt>Müşteri</dt><dd>${m ? esc(m.ad) : '—'}</dd></div><div><dt>Ürün</dt><dd>${n}</dd></div><div><dt>Toplam adet</dt><dd>${ta}</dd></div><div class="sg-genel"><dt>Toplam</dt><dd>${fmt(toplam())} ₺</dd></div></dl>
      <fieldset class="sg-teslim"><legend>Sipariş türü</legend>
        <label><input type="radio" name="sgTeslim" value="siparis" ${T.teslim ? '' : 'checked'}><span><b>Sipariş</b><small>Sitede "Hazırlanıyor" olarak açılır; durumunu siteden takip edin. Kargolanınca ya da teslim edilince Paraşüt'e geçer</small></span></label>
        <label><input type="radio" name="sgTeslim" value="teslim" ${T.teslim ? 'checked' : ''}><span><b>Teslim</b><small>Ürün elden verildi: sitede "Teslim edildi" olarak açılır, 5 dakika içinde Paraşüt'e geçer</small></span></label></fieldset>
      <label class="sg-not">Sipariş notu (müşteri görür)<textarea id="sgNot" rows="2">${esc(T.not)}</textarea></label>
      ${D.durum === 'onay' ? `<div class="sg-onay"><p>${T.duzelt ? `Eski sipariş <b>${esc(T.duzelt)}</b> iptal edilecek (tutarı cariye geri döner) ve yerine ` : ''}<b>${esc(m.ad)}</b> carisine <b>${fmt(toplam())} ₺</b> tutarında, ${n} ürün / ${ta} adetlik ${T.teslim ? '<b>teslim</b> kaydı' : 'sipariş (<b>Hazırlanıyor</b>)'} açılacak.</p>
          <div class="sg-onay-dug"><button class="btn" data-act="sgVazgec">Geri dön</button><button class="btn dark" data-act="sgGonder">${T.duzelt ? 'Onayla, düzelt' : 'Onayla, siparişi aç'}</button></div></div>`
        : `<button class="btn dark sg-olustur" data-act="sgOnay" ${eksik || D.durum ? 'disabled' : ''}>${D.durum === 'gonderiliyor' ? (T.duzelt ? 'Düzeltiliyor…' : 'Sipariş açılıyor…') : T.duzelt ? 'Düzeltmeyi kaydet' : 'Siparişi oluştur'}</button>
          ${eksik ? `<p class="sg-soluk">${eksik}</p>` : ''}`}
      ${n || m ? `<button class="btn ghost sm" data-act="sgTemizle">${T.duzelt ? 'Düzeltmeden vazgeç' : 'Formu temizle'}</button>` : ''}
      ${!n && sonVar() ? '<button class="btn ghost sm" data-act="sgSonYazdir">Son siparişin listesini yazdır</button>' : ''}`;
  }

  views.siparisgir = () => {
    if (!D.musteriler && !D.urunler && !D.hata && !yukle.basladi) { yukle.basladi = true; yukle(); }
    const ust = T.duzelt ? head('Satış', 'Sipariş düzelt', `Sipariş <b>${esc(T.duzelt)}</b> forma yüklendi. Adetleri, renkleri, fiyatları ya da türü değiştirip kaydedin: eski sipariş sitede iptal edilir (tutarı cariye geri döner), yerine düzeltilmiş sipariş açılır.`,
        '<button class="btn" data-act="sgTemizle">Vazgeç</button>')
      : head('Satış', 'Sipariş gir', 'Müşteriyi seçin, ürünü arayıp tıklayın, renklerin adedini yazın. Sipariş sitede müşterinin carisine açılır; Paraşüt\'e tek satış faturası olarak gider (renkler toplanır).',
      T.musteri || T.satirlar.length ? '<button class="btn" data-act="sgTemizle">Temizle</button>' : '');
    if (D.hata) return ust + `<div class="card empty"><h3>Bilgiler alınamadı</h3><p>${esc(D.hata)}</p><button class="btn dark" data-act="sgYenile">Tekrar dene</button></div>`;
    if (D.sonuc) return ust + `<div class="card sg-tamam"><div class="pill ok">Sipariş açıldı</div><h3>${esc(D.sonuc.kod || 'Sipariş')}</h3>
      <p>${esc(D.sonuc.musteri)} · ${fmt(D.sonuc.toplam)} ₺</p><p class="sg-soluk">${D.sonuc.teslim ? 'Teslim olarak açıldı, 5 dakika içinde Paraşüt\'e satış faturası olur.' : 'Sitede "Hazırlanıyor" olarak açıldı. Kargolanınca ya da teslim edilince Paraşüt\'e satış faturası olur.'}</p>
      <div class="sg-tamam-dug"><button class="btn dark" data-act="sgYazdir">Listeyi yazdır</button><button class="btn" data-act="sgYeni">Yeni sipariş</button></div></div>`;
    const m = musteri(), n = T.satirlar.length, ta = toplamAdet();
    const musteriKutu = `<div class="card sg-kart"><div class="sg-baslik"><span class="sg-no">1</span><h3>Müşteri</h3></div>
      ${araKutu('sgMusteri', D.musteriler, m?.ad || '', 'sgMus', { yer: D.musteriler ? `Müşteri adı yazın (${D.musteriler.length} müşteri)` : 'Müşteriler yükleniyor…' })}
      ${m ? `<button type="button" class="sg-mus-degis" data-act="sgMusTemizle">× Müşteriyi değiştir</button><div class="sg-mus-kart">
          <div class="sg-mus-iletisim">${m.tel ? `<span>${esc(m.tel)}</span>` : ''}${m.adres ? `<span>${esc(m.adres)}</span>` : ''}${m.vergi ? `<span>Vergi: ${esc(m.vergi)}</span>` : ''}${!m.tel && !m.adres && !m.vergi ? '<span class="sg-soluk">Sitede iletişim bilgisi yok</span>' : ''}</div>
          <div class="sg-mus-bakiye"><small>Bakiye</small><b class="${m.bakiye < -0.004 ? 'sg-borc' : ''}">${fmt(Math.abs(m.bakiye))} ₺</b><small>${m.bakiye < -0.004 ? 'borç' : m.bakiye > 0.004 ? 'alacak' : ''}</small></div></div>
        <button type="button" class="sg-gizli-dug" data-act="sgGizli" aria-expanded="${D.gizli ? 'true' : 'false'}">${D.gizli ? 'Ayrıntıları gizle ▴' : 'Ayrıntılar ▾'}</button>
        ${D.gizli ? `<div class="sg-mus-bilgi">
        <label>Fiyat tanımı (★ müşterinin) <select id="sgTip">${TIP.map(([k, l]) => `<option value="${k}" ${tip() === k ? 'selected' : ''}>${l}${k === m.tip ? ' ★' : ''}</option>`).join('')}</select></label>
        <div><small>İskonto</small><b>%${m.iskonto}</b></div></div>` : ''}` : ''}
    </div>`;
    const urunKutu = `<div class="card sg-kart"><div class="sg-baslik"><span class="sg-no">2</span><h3>Ürünler</h3><span class="sg-soluk">${n ? `${n} ürün · ${ta} adet` : ''}</span></div>
      <div class="sg-ara"><input id="sgAra" type="search" autocomplete="off" placeholder="${D.urunler ? 'Ürün adı ya da kodu yazın (örn. 4924)' : 'Ürünler yükleniyor…'}" value="${esc(D.ara)}" ${m ? '' : 'disabled'} aria-label="Ürün ara">
        ${m ? `<div id="sgSonuc">${sonucHtml()}</div>` : '<p class="sg-soluk">Önce müşteriyi seçin; fiyatlar müşteriye göre hesaplanır.</p>'}</div>
      <div class="sg-satirlar">${n ? T.satirlar.map(satirHtml).join('') : m ? '<p class="sg-bos">Henüz ürün eklenmedi. Yukarıda arayıp tıklayın.</p>' : ''}</div>
    </div>`;
    return `${ust}<div class="sg-duzen"><div class="sg-sol">${musteriKutu}${urunKutu}</div><div class="sg-sag"><div class="card sg-ozet" id="sgOzet">${ozetHtml()}</div></div></div>
      <div class="sg-mbar" id="sgMbar" ${n ? '' : 'hidden'}>${mbarHtml()}</div>`;
  };

  araSec.sgMus = mus => { D.gizli = false; T.musteri = mus.id; T.tip = null; D.durum = ''; sakla(); D.odak = 'sgAra'; };

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
    oz?.addEventListener('change', e => { if (e.target.name === 'sgTeslim') { T.teslim = e.target.value === 'teslim'; sakla(); oz.innerHTML = ozetHtml(); } });
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
      const r = await sor({ islem: 'siparis_gir', siparis: { istek: T.istek, userId: m.id, satirlar, not: T.not, teslim: T.teslim, ...(T.duzelt ? { duzelt: T.duzelt } : {}) } });
      // eski sipariş sitede iptal edildi: listede hemen gizlensin
      if (r.eski) { const o = S.orders.find(x => String(CLK.O.code(x)) === String(r.eski)); if (o?.order) o.order.status = 6; }
      // çıktı için: renk renk satırlar, müşteri bilgisi ve teslimat sonuçla birlikte saklanır (sayfa yenilense de yazdırılabilir)
      D.sonuc = { ...r, tel: m.tel, adres: m.adres, liste: T.satirlar.flatMap(s => adetler(s).map(x => ({ urun: s.ad + (x.renk ? ' – ' + x.renk : ''), miktar: Number(x.adet), fiyat: birim(s), tutar: Math.round(Number(x.adet) * birim(s) * 100) / 100 }))) };
      try { localStorage.setItem('clk-siparis-son', JSON.stringify(D.sonuc)); } catch {}
      T = BOS(); sakla(); D.durum = '';
      toast(r.eski ? `Sipariş ${r.eski} düzeltildi, yeni no ${r.kod || ''}` : `Sipariş ${r.kod || ''} açıldı`);
    } catch (e) { D.durum = ''; toast(/Oturum gerekli/.test(e.message) ? 'Siparişi siteye gönderme henüz açılmadı (sunucu güncellemesi bekleniyor). Taslak saklandı.' : 'Sipariş açılamadı: ' + e.message); }
    render();
  }

  // Ürün listesi sayfasındaki "Sevkiyat ve kontrol listesi" A4 düzeni (telefonda yazdırma penceresinden PDF kaydedilebilir)
  function yazdir(o) {
    if (!o?.liste?.length || !CLK.kontrolListesi) { toast('Yazdırılacak liste yok'); return; }
    const trTarih = new Date(o.zaman || Date.now()).toLocaleDateString('tr-TR');
    CLK.kontrolListesi('Sipariş', [['Müşteri', o.musteri], o.kod && ['Sipariş no', o.kod], ['Tarih', trTarih], ['Tür', o.teslim ? 'Teslim' : 'Sipariş'], o.tel && ['Telefon', o.tel]].filter(Boolean), o.liste);
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
    // fiyat tanımı, iskonto, bakiye ve fiyatın kaynağı müşterinin yanında görünmesin diye kapalı gelir
    else if (act === 'sgGizli') { D.gizli = !D.gizli; S.keepScroll = true; render(); }
    else if (act === 'sgOzeteGit') { document.activeElement?.blur(); $('#sgOzet')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else if (act === 'sgYeni') { D.sonuc = null; render(); }
    else if (act === 'sgYazdir') yazdir(D.sonuc);
    else if (act === 'sgSonYazdir') { try { yazdir(JSON.parse(localStorage.getItem('clk-siparis-son'))); } catch { toast('Son sipariş bulunamadı'); } }
    else if (act === 'sgTemizle') { yeniForm(); render(); }
    else if (act === 'sgMusTemizle') { T.musteri = null; T.tip = null; D.durum = ''; D.gizli = false; delete ARA.sgMusteri; D.odak = 'sgMusteri'; render(); }
    else prevAct?.(act, el, e);
  };
})();
