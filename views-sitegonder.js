/* CLK Yönetim — Siteye gönder: Paraşüt ürünleri ad, site kategorisi ve Bayi 1–4 / site fiyatıyla sitede PRS-<paraşüt id> koduyla açılır ya da güncellenir (celik isteği 29.10.2026) */
(() => {
  const { sb, S, $, esc, num, dtt, toast, head, views, render, loadProducts, loadCategories, P } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/siparis-parasut';
  const FIYAT = [['b1', 'Bayi 1'], ['b2', 'Bayi 2'], ['b3', 'Bayi 3'], ['b4', 'Bayi 4'], ['site', 'Site']];
  const D = (S.ui.sg ||= { urunler: null, zaman: '', yukleniyor: '', hata: '', kurallar: null, yuvarla: '1', katEs: {}, katYuk: false, filtre: 'yok', pkat: '', ara: '', goster: 100, secili: new Set(), gonderiyor: false, ilerleme: '', sonuc: {} });
  // kaydedilmemiş değişiklikler: { paraşüt id: { ad?, kat?, b1?…, site?, acik? } }, sayfa yenilenince kaybolmasın
  let taslak = {};
  try { taslak = JSON.parse(localStorage.getItem('clk-sitegonder-taslak') || '{}'); } catch {}
  const sakla = () => { try { localStorage.setItem('clk-sitegonder-taslak', JSON.stringify(taslak)); } catch {} };
  const fmt = v => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(v) || 0);
  const sayi = v => { const s = String(v ?? '').trim(); if (!s) return null; const n = Number(s.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const buyuk = s => String(s || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr');
  const anahtar = a => buyuk(a).replace(/İ/g, 'I');
  const katAd = u => u.kat || 'KATEGORİSİZ';
  // fiyat kutusunun altındaki kâr: alışa göre yüzde ve tutar (celik isteği 29.10.2026)
  const kar = (alis, f) => {
    if (!(alis > 0) || !(f > 0)) return { yazi: '', zarar: false };
    const k = f - alis;
    return { yazi: `%${fmt(Math.round(k / alis * 1000) / 10)} · ${k > 0 ? '+' : ''}${fmt(k)} ₺`, zarar: k < 0 };
  };
  // yazarken satırdaki kâr yazıları hemen yenilenir (kutudan çıkmayı beklemez)
  const karGuncelle = tr => {
    const oku = a => { const n = sayi(tr.querySelector(`input[data-a="${a}"]`)?.value); return n > 0 ? n : 0; };
    const alis = oku('alis'), b1 = oku('b1');
    for (const [a] of FIYAT) {
      const el = tr.querySelector(`[data-kar="${a}"]`); if (!el) continue;
      const k = kar(alis, oku(a) || (a !== 'site' ? b1 : 0));
      el.textContent = k.yazi; el.classList.toggle('sg-zarar', k.zarar);
    }
  };

  async function sor(govde) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.hata) throw new Error(j?.hata || 'Sunucu ' + r.status);
    return j;
  }
  // Paraşüt ürünleri (arşivdekiler hariç), fiyat kuralları ve kategori eşleştirmesi; taze: Paraşüt'ten yeniden okunur
  async function yukle(taze) {
    D.yukleniyor = taze ? 'taze' : 'ilk'; D.hata = ''; render();
    try {
      const [v, k, a] = await Promise.all([sor({ islem: 'urunler', taze }), sb.from('fiyat_kural').select('*'), sb.from('fiyat_ayar').select('ad,deger')]);
      if (k.error) throw new Error(k.error.message);
      D.urunler = v.urunler.filter(x => !x[7]).map(([id, ad, alis, satis, stok, , , , kat]) => ({ id: String(id), ad, alis: Number(alis) || 0, satis: Number(satis) || 0, stok: Number(stok) || 0, kat: kat || '' }));
      D.zaman = v.zaman;
      D.kurallar = Object.fromEntries(k.data.map(r => [anahtar(r.kategori), r]));
      for (const r of a.data || []) { if (r.ad === 'yuvarla') D.yuvarla = r.deger; if (r.ad === 'site_kategori' && r.deger && typeof r.deger === 'object') D.katEs = r.deger; }
      D.yukleniyor = '';
      if (!taze && Date.now() - Date.parse(v.zaman) > 36e5) return yukle(true);
    } catch (e) { D.hata = e.message; D.yukleniyor = ''; }
    render();
  }

  // site kategorileri alt kategorileriyle (WEST POLO › ERKEK CÜZDANLARI gibi); sunucu okuyamazsa eski liste
  async function katYukle() {
    D.katYuk = true;
    try { const r = await sor({ islem: 'site_kategoriler' }); if (!Array.isArray(r)) throw new Error(); D.kats = r.map(c => ({ id: c.id, path: c.path })); }
    catch { D.kats = (await loadCategories()).map(c => ({ id: c.id, path: c.path })); }
    D.katYuk = false; render();
  }

  // sitedeki PRS ürünleri: paraşüt id → site ürünü
  let ixKaynak = null, ix = {};
  const sitede = () => {
    if (ixKaynak !== S.products) { ix = {}; for (const p of S.products) if (/^PRS-\d+$/.test(p.code || '')) ix[p.code.slice(4)] = p; ixKaynak = S.products; }
    return ix;
  };
  const sitedeMi = u => !!(sitede()[u.id] || D.sonuc[u.id]?.id);
  const kural = (u, a) => {
    const r = D.kurallar?.[anahtar(katAd(u))], oran = r?.[a];
    return CLK.fiyatla?.(Number(deger(u, 'alis')) || 0, oran == null || oran === '' ? null : Number(oran), D.yuvarla) ?? null;
  };
  // kutudaki ilk değer: son gönderilen, sitedeki ürün, yoksa Paraşüt adı ve fiyat kuralı
  const varsayilan = (u, a) => {
    const g = D.sonuc[u.id]?.deger;
    if (g && a in g) return g[a];
    const p = sitede()[u.id];
    if (a === 'ad') return p ? buyuk(p.name) : buyuk(u.ad);
    if (a === 'kat') return p ? String(p.categoryId ?? p.categoryID ?? '') : String(D.katEs[katAd(u)] || '');
    if (a === 'acik') return p ? P.on(p) : false;
    if (a === 'alis') return u.alis || null;
    if (p) return Number(a === 'site' ? p.salePrice : p['dealerPrice' + a.slice(1)]) || null;
    return kural(u, a);
  };
  const deger = (u, a) => (taslak[u.id] && a in taslak[u.id] ? taslak[u.id][a] : varsayilan(u, a));
  // boş Bayi 2–4, Bayi 1 fiyatını alır
  const fiyat = (u, a) => { const v = deger(u, a); if (v > 0) return v; return a !== 'b1' && a !== 'site' && deger(u, 'b1') > 0 ? deger(u, 'b1') : null; };
  const eksik = u => [!String(deger(u, 'ad') || '').trim() && 'ad', !sitedeMi(u) && !deger(u, 'kat') && 'site kategorisi', !(fiyat(u, 'b1') > 0) && 'Bayi 1', !(fiyat(u, 'site') > 0) && 'site fiyatı'].filter(Boolean);
  function degistir(u, a, v) {
    const t = { ...(taslak[u.id] || {}) };
    if (v === varsayilan(u, a) || (typeof v === 'number' && Number.isNaN(v))) delete t[a]; else t[a] = v;
    if (Object.keys(t).length) taslak[u.id] = t; else delete taslak[u.id];
    sakla();
    // alış değişince oranı girilmiş kategorinin fiyatları yeni alışla yeniden hesaplanır (elle yazılan fiyat da)
    if (a === 'alis') for (const [f] of FIYAT) { const k = kural(u, f); if (k > 0) degistir(u, f, k); }
  }

  const FILTRE = {
    yok: ['Sitede yok', u => !sitedeMi(u)],
    sitede: ['Sitede', u => sitedeMi(u)],
    degisen: ['Değiştirilenler', u => !!taslak[u.id]],
    hata: ['Gönderilemeyen', u => !!D.sonuc[u.id]?.hata],
    hepsi: ['Tümü', () => true]
  };
  const gorunen = () => {
    const q = D.ara.trim().toLocaleLowerCase('tr');
    return (D.urunler || []).filter(FILTRE[D.filtre][1]).filter(u => !D.pkat || katAd(u) === D.pkat)
      .filter(u => !q || u.ad.toLocaleLowerCase('tr').includes(q) || String(deger(u, 'ad')).toLocaleLowerCase('tr').includes(q));
  };
  const pKategoriler = () => {
    const say = {};
    for (const u of D.urunler || []) say[katAd(u)] = (say[katAd(u)] || 0) + 1;
    return Object.entries(say).sort((a, b) => (a[0] === 'KATEGORİSİZ') - (b[0] === 'KATEGORİSİZ') || b[1] - a[1]);
  };

  const satir = (u, katSecenek) => {
    const t = taslak[u.id] || {}, p = sitede()[u.id], s = D.sonuc[u.id], sec = D.secili.has(u.id), ek = sec ? eksik(u) : [];
    const kat = String(deger(u, 'kat') || '');
    const fiyatKutu = a => {
      const v = deger(u, a), gerek = sec && ((a === 'b1' && ek.includes('Bayi 1')) || (a === 'site' && ek.includes('site fiyatı')));
      const yer = a === 'b1' || a === 'site' ? 'Gerekli' : deger(u, 'b1') > 0 ? '= ' + fmt(deger(u, 'b1')) : '= Bayi 1';
      const k = kar(Number(deger(u, 'alis')) || 0, fiyat(u, a));
      return `<td><input class="sk-in sk-num ${a in t ? 'sk-deg' : ''} ${gerek ? 'fk-uyari' : ''}" data-id="${u.id}" data-a="${a}" value="${v > 0 ? String(v).replace('.', ',') : ''}" placeholder="${esc(yer)}" inputmode="decimal" aria-label="${a} ${esc(u.ad)}"><small class="sg-kar ${k.zarar ? 'sg-zarar' : ''}" data-kar="${a}" title="Alışa göre kâr oranı ve kâr">${k.yazi}</small></td>`;
    };
    const durum = s?.hata ? `<span class="pill bad" title="${esc(s.hata)}">${esc(s.hata.length > 40 ? s.hata.slice(0, 40) + '…' : s.hata)}</span>`
      : s?.id ? `<span class="pill ok">${s.yeni ? 'Sitede açıldı' : 'Güncellendi'}${s.acik ? '' : ' (gizli)'}</span>`
      : p ? `<span class="pill ${P.on(p) ? 'ok' : 'off'}">Sitede ${P.on(p) ? 'açık' : 'gizli'}</span>` : '<span class="pill info">Sitede yok</span>';
    return `<tr class="${Object.keys(t).length ? 'sk-satir-deg' : ''}">
      <td><input type="checkbox" data-sec="${u.id}" ${sec ? 'checked' : ''} aria-label="Seç ${esc(u.ad)}"></td>
      <td class="sg-urun"><input class="sk-in sk-ad-in ${'ad' in t ? 'sk-deg' : ''}" data-id="${u.id}" data-a="ad" value="${esc(deger(u, 'ad'))}" aria-label="Sitedeki adı ${esc(u.ad)}">
        <small>${esc(katAd(u))} · stok ${fmt(u.stok)}${p ? ' · ' + esc(p.code) : ''}</small></td>
      <td><select class="sg-kat ${'kat' in t ? 'sk-deg' : ''} ${sec && ek.includes('site kategorisi') ? 'fk-uyari' : ''}" data-id="${u.id}" data-a="kat" aria-label="Site kategorisi ${esc(u.ad)}"><option value="">${p ? 'Değiştirme' : 'Kategori seç'}</option>${kat ? katSecenek.replace(`value="${kat}"`, `value="${kat}" selected`) : katSecenek}</select></td>
      <td><input class="sk-in sk-num ${'alis' in t ? 'sk-deg' : ''}" data-id="${u.id}" data-a="alis" value="${deger(u, 'alis') > 0 ? String(deger(u, 'alis')).replace('.', ',') : ''}" placeholder="—" inputmode="decimal" aria-label="Alış ${esc(u.ad)}"></td>
      ${FIYAT.map(([a]) => fiyatKutu(a)).join('')}
      <td><label class="sk-arsiv"><input type="checkbox" data-acik="${u.id}" ${deger(u, 'acik') ? 'checked' : ''}>Açık</label></td>
      <td>${durum}</td></tr>`;
  };

  views.sitegonder = () => {
    if (!D.urunler && !D.yukleniyor && !D.hata) yukle(false);
    if (!S.pLoaded && !S.pLoading && !S.pErr) loadProducts();
    if (!D.kats && !D.katYuk) katYukle();
    const acts = `<button class="btn" data-act="sgYenile" ${D.yukleniyor || D.gonderiyor ? 'disabled' : ''}>${D.yukleniyor === 'taze' ? 'Paraşüt okunuyor…' : 'Paraşüt\'ten yenile'}</button>`;
    const ust = head('Paraşüt', 'Siteye gönder', `Paraşüt'teki ürünleri siteye gönderin${D.zaman ? ' (liste ' + dtt(D.zaman) + ')' : ''}. Adı, site kategorisini ve fiyatları kontrol edin, ürünleri seçip "Siteye gönder"e basın. Fiyatlar Fiyat kurallarından gelir, kutuya yazarak değiştirebilirsiniz; boş Bayi 2–4, Bayi 1 fiyatını alır. Her fiyatın altında alışa göre kâr oranı ve kâr yazar. Alışı değiştirirseniz gönderirken Paraşüt'e de yazılır ve oranı girilmiş fiyatlar yeni alışla hesaplanır. Yeni ürün stokunu Paraşüt'ten alır; sitede olan ürünün stoku ve renkleri değişmez. Fotoğraf ve açıklama Ürünler sayfasından eklenir.`, acts);
    if (!D.urunler) return ust + (D.hata ? `<div class="card empty"><h3>Ürünler alınamadı</h3><p>${esc(D.hata)}</p><button class="btn dark" data-act="sgYenile">Tekrar dene</button></div>` : '<div class="card"><div class="skel" style="height:300px"></div></div>');
    const kats = D.kats || [];
    const katSecenek = kats.map(c => `<option value="${c.id}">${esc(c.path)}</option>`).join('');
    const liste = gorunen(), pk = pKategoriler(), n = Object.keys(taslak).length;
    const siteDurum = S.pErr ? `Site ürünleri okunamadı: ${esc(S.pErr)}` : !S.pLoaded ? `Sitedeki ürünler okunuyor${S.pProg ? ' (' + esc(S.pProg) + ')' : ''}; "Sitede" bilgisi bitince doğru görünür.` : '';
    return `${ust}
      <div class="card">
        <div class="sk-arac"><b>Kategori eşleştirme</b><span class="sk-say">Paraşüt kategorisindeki ürünler sitede bu kategoriye girer. Satırda ayrıca değiştirebilirsiniz.</span></div>
        ${kats.length ? `<div class="sg-es">${pk.map(([k, c]) => `<label><b>${esc(k)} <small>(${num(c)})</small></b><select data-katesle="${esc(k)}"><option value="">Seçilmedi</option>${D.katEs[k] ? katSecenek.replace(`value="${D.katEs[k]}"`, `value="${D.katEs[k]}" selected`) : katSecenek}</select></label>`).join('')}</div>`
          : `<p class="sk-say">${D.kats ? 'Sitede kategori bulunamadı; önce Qukasoft panelinde kategori açın.' : 'Site kategorileri okunuyor…'}</p>`}
      </div>
      <div class="sk-filtre">${Object.entries(FILTRE).map(([k, [ad, f]]) => `<button class="sk-f" data-act="sgFiltre" data-k="${k}" aria-pressed="${D.filtre === k}"><b>${num(D.urunler.filter(f).length)}</b><small>${ad}</small></button>`).join('')}</div>
      <div class="card">
        ${siteDurum ? `<p class="sk-say">${siteDurum}</p>` : ''}
        <div class="sk-arac"><input id="sgAra" type="search" placeholder="Ürün ara" value="${esc(D.ara)}" aria-label="Ürün ara">
          <select id="sgPkat" class="sg-kat" aria-label="Paraşüt kategorisi"><option value="">Tüm Paraşüt kategorileri</option>${pk.map(([k, c]) => `<option value="${esc(k)}" ${D.pkat === k ? 'selected' : ''}>${esc(k)} (${num(c)})</option>`).join('')}</select>
          <span class="sk-say">${num(liste.length)} ürün</span></div>
        <div class="sk-arac">
          <button class="btn" data-act="sgHepsiSec" ${liste.length ? '' : 'disabled'}>Listedeki ${num(liste.length)} ürünü seç</button>
          <button class="btn" data-act="sgSecBos" ${D.secili.size ? '' : 'disabled'}>Seçimi kaldır</button>
          <button class="btn" data-act="sgKural" ${D.secili.size ? '' : 'disabled'} title="Seçilenlerin fiyatını Fiyat kurallarındaki oranla yeniden yazar">Seçilenlere kural fiyatı</button>
          <button class="btn" data-act="sgAcik" data-v="1" ${D.secili.size ? '' : 'disabled'}>Seçilenleri açık yap</button>
          <button class="btn" data-act="sgAcik" data-v="0" ${D.secili.size ? '' : 'disabled'}>Seçilenleri gizli yap</button></div>
        <div class="ul-tablo"><table class="sk-tablo sg-tablo"><thead><tr><th><input type="checkbox" id="sgHepsi" aria-label="Görünenlerin hepsini seç" ${liste.length && liste.slice(0, D.goster).every(u => D.secili.has(u.id)) ? 'checked' : ''}></th><th>Ürün (sitedeki adı)</th><th>Site kategorisi</th><th title="Değişirse Paraşüt'e de yazılır">Alış</th>${FIYAT.map(([, l]) => `<th>${l}</th>`).join('')}<th>Sitede</th><th>Durum</th></tr></thead>
          <tbody>${liste.length ? liste.slice(0, D.goster).map(u => satir(u, katSecenek)).join('') : '<tr><td colspan="11" class="sk-bos">Bu filtrede ürün yok.</td></tr>'}</tbody></table></div>
        ${liste.length > D.goster ? `<div class="ek-dug"><button class="btn" data-act="sgDaha">Daha fazla göster (${num(liste.length - D.goster)} kaldı)</button></div>` : ''}
      </div>
      <div class="sk-cubuk"><span>${D.secili.size ? `${num(D.secili.size)} ürün seçili` : 'Göndermek için ürün seçin'}${n ? ` · ${num(n)} üründe değişiklik` : ''}</span>${D.ilerleme ? `<span class="sk-durum">${esc(D.ilerleme)}</span>` : ''}
        <button class="btn" data-act="sgGeriAl" ${n && !D.gonderiyor ? '' : 'disabled'}>Değişiklikleri geri al</button>
        <button class="btn dark" data-act="sgGonder" ${D.secili.size && !D.gonderiyor ? '' : 'disabled'}>${D.gonderiyor ? 'Gönderiliyor…' : 'Siteye gönder'}</button></div>`;
  };

  views.bind_sitegonder = () => {
    const ara = $('#sgAra'); ara?.addEventListener('input', () => { D.ara = ara.value; D.goster = 100; clearTimeout(ara.t); ara.t = setTimeout(render, 220); });
    $('#sgPkat')?.addEventListener('change', e => { D.pkat = e.target.value; D.goster = 100; render(); });
    $('#sgHepsi')?.addEventListener('change', e => { gorunen().slice(0, D.goster).forEach(u => e.target.checked ? D.secili.add(u.id) : D.secili.delete(u.id)); S.keepScroll = true; render(); });
    document.querySelectorAll('[data-katesle]').forEach(el => el.addEventListener('change', async () => {
      const k = el.dataset.katesle;
      if (el.value) D.katEs[k] = el.value; else delete D.katEs[k];
      S.keepScroll = true; render();
      const { error } = await sb.from('fiyat_ayar').upsert({ ad: 'site_kategori', deger: D.katEs, guncel: new Date().toISOString() });
      if (error) toast('Kategori eşleştirmesi kaydedilemedi: ' + error.message);
    }));
    $('.sg-tablo')?.addEventListener('input', e => { const a = e.target.dataset.a; if (a === 'alis' || FIYAT.some(([f]) => f === a)) karGuncelle(e.target.closest('tr')); });
    $('.sg-tablo')?.addEventListener('change', e => {
      const el = e.target, bul = id => D.urunler.find(u => u.id === id);
      if (el.dataset.sec) { el.checked ? D.secili.add(el.dataset.sec) : D.secili.delete(el.dataset.sec); }
      else if (el.dataset.acik) degistir(bul(el.dataset.acik), 'acik', el.checked);
      else if (el.dataset.a) {
        const u = bul(el.dataset.id), a = el.dataset.a;
        if (a === 'ad') { const v = buyuk(el.value); if (v) degistir(u, 'ad', v); }
        else if (a === 'kat') degistir(u, 'kat', el.value);
        else { const v = sayi(el.value); if (Number.isNaN(v) || v < 0) toast('Fiyat sayı olmalı (örn. 1250 ya da 1.250,50)'); else degistir(u, a, v); }
      } else return;
      S.keepScroll = true; render();
    });
  };

  const paket = u => ({ pid: u.id, ad: buyuk(deger(u, 'ad')), pad: u.ad, kategori: Number(deger(u, 'kat')) || 0, alis: Number(deger(u, 'alis')) || 0, acik: !!deger(u, 'acik'), fiyat: Object.fromEntries(FIYAT.map(([a]) => [a, fiyat(u, a)])) });
  // site aynı anda gelen istekleri reddedebiliyor: beşerli parçalar sırayla gider, parça hata verirse bir kez daha denenir
  async function gonder() {
    const liste = (D.urunler || []).filter(u => D.secili.has(u.id));
    const eksikler = liste.filter(u => eksik(u).length);
    if (eksikler.length) { S.keepScroll = true; render(); toast(`${num(eksikler.length)} üründe bilgi eksik, kırmızı kutuları doldurun. İlki: ${eksikler[0].ad} (${eksik(eksikler[0]).join(', ')})`); return; }
    D.gonderiyor = true; let tamam = 0, hatali = 0;
    for (let i = 0; i < liste.length; i += 5) {
      const parca = liste.slice(i, i + 5), paketler = parca.map(paket);
      D.ilerleme = `${num(i)} / ${num(liste.length)} gönderildi`; S.keepScroll = true; render();
      // değişen alış önce Paraşüt'e yazılır; yazılamayan ürün siteye gitmez (iki taraf aynı kalsın)
      const alisDegisen = parca.filter(u => taslak[u.id] && 'alis' in taslak[u.id] && taslak[u.id].alis > 0);
      const alisHata = {};
      if (alisDegisen.length) {
        try {
          const a = await sor({ islem: 'urun_guncelle', degisiklikler: alisDegisen.map(u => ({ id: u.id, alis: taslak[u.id].alis })) });
          for (const x of a.sonuc || []) { const u = parca.find(y => y.id === String(x.id)); if (!u) continue; if (x.ok) u.alis = taslak[u.id].alis; else alisHata[u.id] = 'Alış Paraşüt\'e yazılamadı: ' + (x.hata || ''); }
        } catch (e) { for (const u of alisDegisen) alisHata[u.id] = 'Alış Paraşüt\'e yazılamadı: ' + e.message; }
      }
      const gidecek = paketler.filter(x => !alisHata[x.pid]);
      let r = { sonuc: Object.entries(alisHata).map(([pid, hata]) => ({ pid, hata })) };
      for (let dene = 0; dene < 2 && gidecek.length; dene++) {
        try { const g = await sor({ islem: 'site_gonder', urunler: gidecek }); r.sonuc.push(...(g.sonuc || [])); break; }
        catch (e) { if (dene) r.sonuc.push(...gidecek.map(x => ({ pid: x.pid, hata: e.message }))); else await new Promise(s => setTimeout(s, 3000)); }
      }
      for (const s of r.sonuc || []) {
        const pk = paketler.find(x => x.pid === String(s.pid));
        if (s.hata && !s.id) { D.sonuc[s.pid] = s; hatali++; continue; }
        // gönderilen değerler site listesi yenilenene kadar kutularda kalır
        D.sonuc[s.pid] = { ...s, deger: pk ? { ad: pk.ad, kat: String(pk.kategori || ''), acik: pk.acik, ...pk.fiyat } : undefined };
        if (s.hata) hatali++; else tamam++;
        delete taslak[s.pid]; D.secili.delete(String(s.pid));
      }
      sakla();
    }
    D.gonderiyor = false;
    D.ilerleme = hatali ? `${num(tamam)} ürün gönderildi, ${num(hatali)} üründe sorun var (Gönderilemeyen filtresine bakın)` : `${num(tamam)} ürün siteye gönderildi`;
    toast(D.ilerleme); S.keepScroll = true; render();
    loadProducts(true);
  }

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'sgYenile') { yukle(true); if (!S.pLoading) loadProducts(true); D.kats = null; katYukle(); }
    else if (act === 'sgFiltre') { D.filtre = el.dataset.k; D.goster = 100; render(); }
    else if (act === 'sgDaha') { D.goster += 200; S.keepScroll = true; render(); }
    else if (act === 'sgHepsiSec') { gorunen().forEach(u => D.secili.add(u.id)); S.keepScroll = true; render(); }
    else if (act === 'sgSecBos') { D.secili.clear(); S.keepScroll = true; render(); }
    else if (act === 'sgKural') {
      let n = 0;
      for (const id of D.secili) { const u = D.urunler.find(x => x.id === id); if (!u) continue; for (const [a] of FIYAT) { const v = kural(u, a); if (v > 0) { degistir(u, a, v); n++; } } }
      S.keepScroll = true; render(); toast(n ? 'Seçilenlerin fiyatı Fiyat kurallarına göre yazıldı' : 'Seçilenlerin kategorisinde oran girilmemiş');
    }
    else if (act === 'sgAcik') { for (const id of D.secili) { const u = D.urunler.find(x => x.id === id); if (u) degistir(u, 'acik', el.dataset.v === '1'); } S.keepScroll = true; render(); }
    else if (act === 'sgGeriAl') { taslak = {}; sakla(); S.keepScroll = true; render(); }
    else if (act === 'sgGonder') gonder();
    else prevAct?.(act, el, e);
  };
})();
