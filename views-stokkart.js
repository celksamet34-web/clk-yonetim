/* CLK Yönetim — Paraşüt stok kartları: ad, alış/satış fiyatı ve arşiv düzeltme, toplu isim değiştirme; kaydedince doğrudan Paraşüt'e yazılır */
(() => {
  const { sb, S, $, esc, num, dtt, toast, head, views, render } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/siparis-parasut';
  const D = (S.ui.sk ||= { urunler: null, zaman: '', yukleniyor: '', hata: '', filtre: 'hepsi', ara: '', goster: 100, secili: new Set(), bul: '', yeni: '', durum: '' });
  // kaydedilmemiş değişiklikler: { id: { ad?, alis?, satis?, arsiv? } }, sayfa yenilenince kaybolmasın
  let taslak = {};
  try { taslak = JSON.parse(localStorage.getItem('clk-stokkart-taslak') || '{}'); } catch {}
  const sakla = () => { try { localStorage.setItem('clk-stokkart-taslak', JSON.stringify(taslak)); } catch {} };
  const fmt = v => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(v) || 0);
  const sayi = v => { const n = Number(String(v ?? '').replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const buyuk = s => String(s || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr');

  async function sor(govde) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.hata) throw new Error(j?.hata || 'Sunucu ' + r.status);
    return j;
  }
  // taze: Paraşüt'ten yeniden okunur (yarım dakika kadar); değilse son okunan liste hemen gelir
  async function yukle(taze) {
    D.yukleniyor = taze ? 'taze' : 'ilk'; D.hata = ''; render();
    try {
      const v = await sor({ islem: 'urunler', taze });
      D.urunler = v.urunler.map(([id, ad, alis, satis, stok, ss, as, arsiv, kat]) => ({ id: String(id), ad, alis, satis, stok, ss, as, arsiv: !!arsiv, kat: kat || '' }));
      D.zaman = v.zaman;
      // Paraşüt'teki değerle aynı olan taslak alanları düşer
      const ix = Object.fromEntries(D.urunler.map(u => [u.id, u]));
      for (const [id, t] of Object.entries(taslak)) { for (const a of Object.keys(t)) if (!ix[id] || ix[id][a] === t[a]) delete t[a]; if (!Object.keys(t).length) delete taslak[id]; }
      sakla();
      D.yukleniyor = '';
      // son okuma 1 saatten eskiyse arka planda yenilenir
      if (!taze && Date.now() - Date.parse(v.zaman) > 36e5) return yukle(true);
    } catch (e) { D.hata = e.message; D.yukleniyor = ''; }
    render();
  }

  const deger = (u, a) => (taslak[u.id] && a in taslak[u.id] ? taslak[u.id][a] : u[a]);
  function degistir(u, a, v) {
    const t = { ...(taslak[u.id] || {}) };
    if (v === u[a] || (typeof v === 'number' && Number.isNaN(v))) delete t[a]; else t[a] = v;
    if (Object.keys(t).length) taslak[u.id] = t; else delete taslak[u.id];
    sakla();
  }
  const arsivde = u => deger(u, 'arsiv');
  // West Polo ürünleri bizim stoğumuz değil, tedarikçinin stok listesi: ana listelerde görünmez, yalnız "West Polo" düğmesinde (celik isteği 30.10.2026)
  const west = u => buyuk(u.kat) === 'WEST' || buyuk(u.ad).startsWith('WEST POLO ');
  const FILTRE = {
    hepsi: ['Tümü', u => !arsivde(u) && !west(u)],
    stokta: ['Stokta var', u => !arsivde(u) && !west(u) && u.stok > 0],
    eksi: ['Eksi stok', u => !arsivde(u) && !west(u) && u.stok < 0],
    sifir: ['Stok 0', u => !arsivde(u) && !west(u) && u.stok === 0],
    bos: ['Hiç kullanılmamış', u => !arsivde(u) && !west(u) && !u.ss && !u.as],
    west: ['West Polo', u => !arsivde(u) && west(u)],
    degisen: ['Değiştirilenler', u => !!taslak[u.id]],
    arsiv: ['Arşivde', u => arsivde(u)]
  };
  const gorunen = () => {
    const q = D.ara.trim().toLocaleLowerCase('tr');
    return (D.urunler || []).filter(FILTRE[D.filtre][1]).filter(u => !q || u.ad.toLocaleLowerCase('tr').includes(q) || String(deger(u, 'ad')).toLocaleLowerCase('tr').includes(q));
  };
  // toplu isim: seçili ürünlerde, seçim yoksa görünen ürünlerde
  const topluHedef = () => {
    const bul = buyuk(D.bul);
    if (!bul) return [];
    const havuz = D.secili.size ? D.urunler.filter(u => D.secili.has(u.id)) : gorunen();
    return havuz.filter(u => buyuk(deger(u, 'ad')).includes(bul));
  };

  const satir = u => {
    const t = taslak[u.id] || {};
    const inp = (a, cls) => `<input class="sk-in ${cls} ${a in t ? 'sk-deg' : ''}" data-id="${u.id}" data-a="${a}" value="${esc(a === 'ad' ? deger(u, a) : String(deger(u, a)).replace('.', ','))}" ${a === 'ad' ? '' : 'inputmode="decimal"'} aria-label="${a} ${esc(u.ad)}">`;
    return `<tr class="${Object.keys(t).length ? 'sk-satir-deg' : ''} ${arsivde(u) ? 'sk-arsivde' : ''}">
      <td><input type="checkbox" data-sec="${u.id}" ${D.secili.has(u.id) ? 'checked' : ''} aria-label="Seç ${esc(u.ad)}"></td>
      <td class="sk-ad">${inp('ad', 'sk-ad-in')}</td><td>${inp('alis', 'sk-num')}</td><td>${inp('satis', 'sk-num')}</td>
      <td class="num ${u.stok < 0 ? 'sk-eksi' : ''}">${fmt(u.stok)}</td>
      <td class="num" title="${u.ss} satış, ${u.as} alış faturası">${u.ss} / ${u.as}</td>
      <td><label class="sk-arsiv"><input type="checkbox" data-arsiv="${u.id}" ${arsivde(u) ? 'checked' : ''}>${u.arsiv ? 'Arşivde' : 'Arşiv'}</label></td></tr>`;
  };

  views.stokkart = () => {
    if (!D.urunler && !D.yukleniyor && !D.hata) yukle(false);
    const n = Object.keys(taslak).length;
    const acts = `<button class="btn" data-act="skYenile" ${D.yukleniyor ? 'disabled' : ''}>${D.yukleniyor === 'taze' ? 'Güncelleniyor…' : 'Güncelle'}</button>`;
    const ust = head('Paraşüt', 'Stok kartları', `Paraşüt'teki ürünler${D.zaman ? ', ' + dtt(D.zaman) + ' itibarıyla' : ''}. Adı, alış ve satış fiyatını düzeltin, arşive alınacakları işaretleyin, sonra "Paraşüt'e kaydet"e basın. Stok adedi buradan değişmez.`, acts);
    if (!D.urunler) return ust + (D.hata ? `<div class="card empty"><h3>Ürünler alınamadı</h3><p>${esc(D.hata)}</p><button class="btn dark" data-act="skYenile">Tekrar dene</button></div>` : '<div class="card"><div class="skel" style="height:300px"></div></div>');
    const liste = gorunen(), hedef = topluHedef();
    return `${ust}
      <div class="sk-filtre">${Object.entries(FILTRE).map(([k, [ad, f]]) => `<button class="sk-f" data-act="skFiltre" data-k="${k}" aria-pressed="${D.filtre === k}"><b>${num(D.urunler.filter(f).length)}</b><small>${ad}</small></button>`).join('')}</div>
      <div class="card">
        <div class="sk-arac"><input id="skAra" type="search" placeholder="Ürün ara" value="${esc(D.ara)}" aria-label="Ürün ara">
          <button class="btn" data-act="skSecArsiv" ${D.secili.size ? '' : 'disabled'}>${D.secili.size ? `Seçilen ${D.secili.size} ürünü arşive al` : 'Seçilenleri arşive al'}</button>
          <span class="sk-say">${num(liste.length)} ürün</span></div>
        <div class="sk-arac sk-toplu"><b>Toplu isim değiştir</b>
          <input id="skBul" placeholder="Adda geçen yazı (örn. CLASİC)" value="${esc(D.bul)}" aria-label="Değişecek yazı">
          <input id="skYeni" placeholder="Yerine yazılacak (örn. CLASSIC)" value="${esc(D.yeni)}" aria-label="Yeni yazı">
          <button class="btn" data-act="skToplu" ${hedef.length ? '' : 'disabled'}>Değiştir</button>
          <span class="sk-say">${!D.bul.trim() ? 'Seçili ürünlerde, seçim yoksa listede görünenlerde uygulanır.' : hedef.length ? `${hedef.length} ürünün adında "${esc(buyuk(D.bul))}" var${D.secili.size ? ' (seçilenler)' : ''}.` : `"${esc(buyuk(D.bul))}" geçen ürün yok.`}</span></div>
        <div class="ul-tablo"><table class="sk-tablo"><thead><tr><th><input type="checkbox" id="skHepsi" aria-label="Görünenlerin hepsini seç" ${liste.length && liste.slice(0, D.goster).every(u => D.secili.has(u.id)) ? 'checked' : ''}></th><th>Ürün adı</th><th>Alış</th><th>Satış</th><th>Stok</th><th title="Kaç satış ve alış faturasında geçiyor">Kullanım</th><th>Arşiv</th></tr></thead>
          <tbody>${liste.length ? liste.slice(0, D.goster).map(satir).join('') : '<tr><td colspan="7" class="sk-bos">Bu filtrede ürün yok.</td></tr>'}</tbody></table></div>
        ${liste.length > D.goster ? `<div class="ek-dug"><button class="btn" data-act="skDaha">Daha fazla göster (${num(liste.length - D.goster)} kaldı)</button></div>` : ''}
      </div>
      <div class="sk-cubuk"><span>${n ? `${n} ürün değişti, Paraşüt'e kaydedilmedi` : 'Değişiklik yok'}</span>${D.durum ? `<span class="sk-durum">${esc(D.durum)}</span>` : ''}
        <button class="btn" data-act="skGeriAl" ${n && D.yukleniyor !== 'kayit' ? '' : 'disabled'}>Geri al</button>
        <button class="btn dark" data-act="skKaydet" ${n && !D.yukleniyor ? '' : 'disabled'}>${D.yukleniyor === 'kayit' ? 'Kaydediliyor…' : 'Paraşüt\'e kaydet'}</button></div>`;
  };

  views.bind_stokkart = () => {
    const ara = $('#skAra'); ara?.addEventListener('input', () => { D.ara = ara.value; D.goster = 100; render(); });
    const bul = $('#skBul'); bul?.addEventListener('input', () => { D.bul = bul.value; render(); });
    const yeni = $('#skYeni'); yeni?.addEventListener('input', () => { D.yeni = yeni.value; });
    $('#skHepsi')?.addEventListener('change', e => { gorunen().slice(0, D.goster).forEach(u => e.target.checked ? D.secili.add(u.id) : D.secili.delete(u.id)); S.keepScroll = true; render(); });
    $('.sk-tablo')?.addEventListener('change', e => {
      const el = e.target, ix = id => D.urunler.find(u => u.id === id);
      if (el.dataset.sec) { el.checked ? D.secili.add(el.dataset.sec) : D.secili.delete(el.dataset.sec); }
      else if (el.dataset.arsiv) degistir(ix(el.dataset.arsiv), 'arsiv', el.checked);
      else if (el.dataset.a) {
        const u = ix(el.dataset.id), a = el.dataset.a;
        if (a === 'ad') { const v = buyuk(el.value); if (v) degistir(u, 'ad', v); } else degistir(u, a, sayi(el.value));
      } else return;
      S.keepScroll = true; render();
    });
  };

  async function kaydet() {
    const liste = Object.entries(taslak).map(([id, t]) => ({ id, ...t }));
    if (!liste.length) return;
    D.yukleniyor = 'kayit'; D.durum = ''; render();
    let hatali = [];
    try {
      // sunucu tek seferde en çok 300 ürün işler
      for (let i = 0; i < liste.length; i += 100) {
        const r = await sor({ islem: 'urun_guncelle', degisiklikler: liste.slice(i, i + 100) });
        for (const s of r.sonuc || []) if (s.ok) delete taslak[s.id]; else hatali.push(s);
        sakla();
      }
      D.durum = hatali.length ? `${hatali.length} ürün kaydedilemedi: ${hatali[0].hata || ''}` : `${liste.length} ürün Paraşüt'e kaydedildi.`;
      toast(D.durum);
    } catch (e) { D.durum = 'Kaydedilemedi: ' + e.message; }
    D.yukleniyor = ''; render();
    yukle(true);
  }

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'skYenile') yukle(true);
    else if (act === 'skFiltre') { D.filtre = el.dataset.k; D.goster = 100; render(); }
    else if (act === 'skDaha') { D.goster += 200; S.keepScroll = true; render(); }
    else if (act === 'skSecArsiv') { for (const id of D.secili) { const u = D.urunler.find(x => x.id === id); if (u) degistir(u, 'arsiv', true); } D.secili.clear(); S.keepScroll = true; render(); toast('Seçilenler arşive alınacak; "Paraşüt\'e kaydet"e basın'); }
    else if (act === 'skToplu') {
      const bul = buyuk(D.bul), yeni = buyuk(D.yeni), re = new RegExp(bul.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      let n = 0;
      for (const u of topluHedef()) { const ad = buyuk(String(deger(u, 'ad')).toLocaleUpperCase('tr').replace(re, yeni)); if (ad && ad !== deger(u, 'ad')) { degistir(u, 'ad', ad); n++; } }
      S.keepScroll = true; render(); toast(n ? `${n} ürünün adı değişti; kontrol edip "Paraşüt'e kaydet"e basın` : 'Değişen ad olmadı');
    }
    else if (act === 'skGeriAl') { taslak = {}; sakla(); D.durum = ''; S.keepScroll = true; render(); }
    else if (act === 'skKaydet') kaydet();
    else prevAct?.(act, el, e);
  };
})();
