/* CLK Yönetim — Fiyat kuralları: Paraşüt ürün kategorisine göre alış fiyatı üstüne Bayi 1–4 ve site oranları (fiyat_kural tablosu) */
(() => {
  const { sb, S, $, esc, toast, head, views, render } = CLK;
  const ALAN = [['b1', 'Bayi 1'], ['b2', 'Bayi 2'], ['b3', 'Bayi 3'], ['b4', 'Bayi 4'], ['site', 'Site (perakende)']];
  const YUVARLA = [['0', 'Kuruşlu (yuvarlama yok)'], ['1', 'Tam liraya'], ['5', "5'in katına"], ['10', "10'un katına"]];
  const D = (S.ui.fk ||= { kurallar: null, ayar: { yuvarla: '1', ornek_alis: 1000 }, taslak: {}, yukleniyor: false, kayit: false, hata: '' });
  const fmt = v => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(v);
  const sayi = v => { const s = String(v ?? '').trim(); if (!s) return null; const n = Number(s.replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };

  async function yukle() {
    D.yukleniyor = true; D.hata = ''; render();
    try {
      const [k, a] = await Promise.all([sb.from('fiyat_kural').select('*').order('sira'), sb.from('fiyat_ayar').select('ad,deger')]);
      if (k.error) throw new Error(k.error.message);
      D.kurallar = k.data;
      for (const r of a.data || []) D.ayar[r.ad] = r.deger;
    } catch (e) { D.hata = e.message; }
    D.yukleniyor = false; render();
  }

  const deger = (r, a) => (D.taslak[r.kategori] && a in D.taslak[r.kategori] ? D.taslak[r.kategori][a] : r[a]);
  // alış + oran, seçilen adıma yukarı yuvarlanır (Sipariş gir de kullanır)
  CLK.fiyatla = (alis, oran, yuvarla) => {
    if (oran == null || Number.isNaN(Number(oran)) || !(alis > 0)) return null;
    const ham = alis * (1 + Number(oran) / 100), adim = Number(yuvarla) || 0;
    return adim ? Math.ceil(ham / adim - 1e-9) * adim : Math.round(ham * 100) / 100;
  };
  const fiyat = (alis, oran) => CLK.fiyatla(alis, oran, D.ayar.yuvarla);

  const satir = r => {
    const t = D.taslak[r.kategori] || {}, alis = Number(D.ayar.ornek_alis) || 0;
    const oranlar = ALAN.map(([a]) => deger(r, a));
    const bayiEnBuyuk = Math.max(...oranlar.slice(0, 4).filter(v => v != null && !Number.isNaN(v)));
    const siteDusuk = oranlar[4] != null && Number.isFinite(bayiEnBuyuk) && oranlar[4] < bayiEnBuyuk;
    return `<tr class="${Object.keys(t).length ? 'sk-satir-deg' : ''}"><td class="sk-ad"><b>${esc(r.kategori)}</b></td>${ALAN.map(([a], i) => {
      const v = oranlar[i], f = fiyat(alis, v);
      return `<td><div class="fk-hucre"><input class="sk-in sk-num ${a in t ? 'sk-deg' : ''} ${a === 'site' && siteDusuk ? 'fk-uyari' : ''}" data-k="${esc(r.kategori)}" data-a="${a}" value="${v == null || Number.isNaN(v) ? '' : String(v).replace('.', ',')}" inputmode="decimal" placeholder="—" aria-label="${esc(r.kategori)} ${a} oranı"><span>%</span></div><small class="fk-ornek">${f == null ? '&nbsp;' : fmt(f) + ' ₺'}</small></td>`;
    }).join('')}</tr>`;
  };

  views.fiyat = () => {
    if (!D.kurallar && !D.yukleniyor && !D.hata) yukle();
    const n = Object.keys(D.taslak).length;
    const ust = head('Ürünler', 'Fiyat kuralları', 'Sitedeki Bayi 1–4 ve site fiyatı, ürünün Paraşüt\'teki alış fiyatına kategorisinin oranı eklenerek hesaplanır. Ürün girişinde alış değişince fiyatlar da bu oranlarla yenilenir. Boş kutu: henüz karar verilmedi. Fiyatlar şimdilik siteye gönderilmiyor.');
    if (!D.kurallar) return ust + (D.hata ? `<div class="card empty"><h3>Oranlar alınamadı</h3><p>${esc(D.hata)}</p><button class="btn dark" data-act="fkYenile">Tekrar dene</button></div>` : '<div class="card"><div class="skel" style="height:300px"></div></div>');
    return `${ust}
      <div class="card">
        <div class="sk-arac">
          <label class="fk-ayar">Örnek alış fiyatı <input id="fkOrnek" inputmode="decimal" value="${esc(String(D.ayar.ornek_alis).replace('.', ','))}"> ₺</label>
          <label class="fk-ayar">Yuvarlama <select id="fkYuvarla">${YUVARLA.map(([k, l]) => `<option value="${k}" ${String(D.ayar.yuvarla) === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <span class="sk-say">Oranın altındaki rakam, örnek alış fiyatıyla çıkan satış fiyatıdır. Yuvarlama yukarı yapılır.</span>
        </div>
        <div class="ul-tablo"><table class="sk-tablo fk-tablo"><thead><tr><th>Kategori</th>${ALAN.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead>
          <tbody>${D.kurallar.map(satir).join('')}</tbody></table></div>
        <p class="sk-say">KATEGORİSİZ: Paraşüt'te kategorisi boş olan ürünler. Turuncu site oranı: bayi oranından düşük, perakende fiyat bayiden ucuz çıkar.</p>
      </div>
      <div class="sk-cubuk"><span>${n ? `${n} kategoride değişiklik var, kaydedilmedi` : 'Değişiklik yok'}</span>
        <button class="btn" data-act="fkGeriAl" ${n && !D.kayit ? '' : 'disabled'}>Geri al</button>
        <button class="btn dark" data-act="fkKaydet" ${n && !D.kayit ? '' : 'disabled'}>${D.kayit ? 'Kaydediliyor…' : 'Kaydet'}</button></div>`;
  };

  async function ayarYaz(ad, deger) {
    D.ayar[ad] = deger; S.keepScroll = true; render();
    const { error } = await sb.from('fiyat_ayar').upsert({ ad, deger, guncel: new Date().toISOString() });
    if (error) toast('Ayar kaydedilemedi: ' + error.message);
  }

  views.bind_fiyat = () => {
    $('#fkYuvarla')?.addEventListener('change', e => ayarYaz('yuvarla', e.target.value));
    $('#fkOrnek')?.addEventListener('change', e => { const v = sayi(e.target.value); if (v > 0) ayarYaz('ornek_alis', v); });
    $('.fk-tablo')?.addEventListener('change', e => {
      const el = e.target; if (!el.dataset.a) return;
      const r = D.kurallar.find(x => x.kategori === el.dataset.k), a = el.dataset.a, v = sayi(el.value);
      if (Number.isNaN(v)) { toast('Oran sayı olmalı (örn. 30 ya da 12,5)'); S.keepScroll = true; render(); return; }
      const t = { ...(D.taslak[r.kategori] || {}) };
      if (v === (r[a] == null ? null : Number(r[a]))) delete t[a]; else t[a] = v;
      if (Object.keys(t).length) D.taslak[r.kategori] = t; else delete D.taslak[r.kategori];
      S.keepScroll = true; render();
    });
  };

  async function kaydet() {
    const simdi = new Date().toISOString();
    const satirlar = Object.entries(D.taslak).map(([kategori, t]) => {
      const r = D.kurallar.find(x => x.kategori === kategori);
      return { kategori, sira: r.sira, ...Object.fromEntries(ALAN.map(([a]) => [a, a in t ? t[a] : r[a]])), guncel: simdi };
    });
    D.kayit = true; render();
    const { error } = await sb.from('fiyat_kural').upsert(satirlar);
    D.kayit = false;
    if (error) { toast('Kaydedilemedi: ' + error.message); render(); return; }
    D.taslak = {}; toast(`${satirlar.length} kategorinin oranı kaydedildi`);
    yukle();
  }

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'fkYenile') yukle();
    else if (act === 'fkGeriAl') { D.taslak = {}; S.keepScroll = true; render(); }
    else if (act === 'fkKaydet') kaydet();
    else prevAct?.(act, el, e);
  };
})();
