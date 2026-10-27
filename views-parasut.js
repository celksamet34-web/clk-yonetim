/* CLK Yönetim — Paraşüt eşleştirme: site ürünü → Paraşüt set ürünü, site müşterisi → Paraşüt müşterisi, aktarılan siparişler */
(() => {
  const { sb, S, $, $$, esc, tl, num, dtt, toast, head, skel, errBox, views, render } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/siparis-parasut';
  const D = (S.ui.ps ||= { tab: 'urun', q: '', f: 'bekleyen', yukleniyor: false, hata: '', veri: null, isliyor: '' });
  const GERI = { gonderildi: ['Siteye geçti', 'ok'], gonderiliyor: ['Gönderiliyor', 'info'], eslesme_yok: ['Ürün eşleşmemiş', 'warn'], hata: ['Hata', 'bad'], atla: ['Atlandı', 'off'], iptal: ['Sitede iptal edildi', 'off'] };
  const DURUM = { aktarildi: ['Paraşüt\'te', 'ok'], aktariliyor: ['Aktarılıyor', 'info'], kargo_bekliyor: ['Kargo bekliyor', 'off'], eslesme_yok: ['Ürün seçilmemiş', 'warn'], musteri_yok: ['Müşteri seçilmemiş', 'warn'], hata: ['Hata', 'bad'], iptal: ['İptal', 'off'], iptal_kontrol: ['İptal, faturayı kontrol et', 'bad'] };

  async function hepsi(tablo, sutun) {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await sb.from(tablo).select(sutun).range(i, i + 999);
      if (error) throw new Error(error.message);
      out.push(...data); if (data.length < 1000) return out;
    }
  }
  async function yukle() {
    D.yukleniyor = true; D.hata = ''; render();
    try {
      const [urun, pUrun, musteri, pMusteri, siteM, siparis, ayar, geri, kontrol] = await Promise.all([
        hepsi('sp_urun_eslesme', 'site_anahtar,site_ad,parasut_id,parasut_ad,oneri_id,oneri_ad'),
        hepsi('sp_parasut_urun', 'id,ad'),
        hepsi('sp_musteri_eslesme', 'site_ad,parasut_id,parasut_ad,oneri_id,oneri_ad'),
        hepsi('sp_parasut_musteri', 'id,ad,bakiye'),
        hepsi('sp_site_musteri', 'user_id,ad,unvan,eposta,bayi'),
        sb.from('sp_siparis').select('siparis_id,kod,tarih,musteri,durum,toplam,satirlar,not_,parasut_id').order('tarih', { ascending: false }).limit(200).then(r => { if (r.error) throw new Error(r.error.message); return r.data; }),
        hepsi('sp_ayar', 'ad,deger'),
        sb.from('sp_geri').select('parasut_id,tur,musteri,tarih,tutar,belge,durum,not_,site_ref,guncel').order('guncel', { ascending: false }).limit(200).then(r => { if (r.error) throw new Error(r.error.message); return r.data; }),
        fonksiyon('rapor').catch(() => null)
      ]);
      const me = Object.fromEntries(musteri.map(m => [m.site_ad, m]));
      D.veri = {
        urun: urun.sort((a, b) => a.site_ad.localeCompare(b.site_ad, 'tr')),
        musteri: siteM.map(u => ({ ...u, ...(me['u:' + u.user_id] || {}), site_ad: 'u:' + u.user_id })).sort((a, b) => (a.unvan || a.ad).localeCompare(b.unvan || b.ad, 'tr')),
        pUrun, pMusteri, siparis, geri, kontrol,
        pUrunAd: Object.fromEntries(pUrun.map(p => [p.ad, p.id])),
        pMusAd: Object.fromEntries(pMusteri.map(p => [p.ad, p.id])),
        ayar: Object.fromEntries(ayar.map(a => { try { return [a.ad, JSON.parse(a.deger)]; } catch { return [a.ad, a.deger]; } }))
      };
    } catch (e) { D.hata = e.message; }
    D.yukleniyor = false; render();
  }

  async function fonksiyon(islem) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify({ islem }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.hata) throw new Error(j.hata || 'Sunucu ' + r.status);
    return j;
  }

  const satirUrun = u => {
    const sec = u.parasut_ad || u.oneri_ad || '';
    return `<div class="es-row ${u.parasut_id ? 'ok' : ''}" data-k="${esc(u.site_anahtar)}">
      <div class="es-site"><b>${esc(u.site_ad)}</b><small>Site #${esc(u.site_anahtar)}${u.parasut_id ? '' : u.oneri_ad ? ' · öneri' : ''}</small></div>
      <input list="es-purun" class="es-in" value="${esc(sec)}" placeholder="Paraşüt ürünü seç">
      <button class="btn sm ${u.parasut_id ? '' : 'dark'}" data-act="esUrun">${u.parasut_id ? 'Kaydedildi' : 'Onayla'}</button></div>`;
  };
  const satirMusteri = m => {
    const sec = m.parasut_ad || m.oneri_ad || '';
    return `<div class="es-row ${m.parasut_id ? 'ok' : ''}" data-k="${esc(m.site_ad)}">
      <div class="es-site"><b>${esc(m.unvan || m.ad)}</b><small>${esc([m.unvan ? m.ad : '', m.eposta].filter(Boolean).join(' · '))}${m.parasut_id ? '' : m.oneri_ad ? ' · öneri' : ''}</small></div>
      <input list="es-pmus" class="es-in" value="${esc(sec)}" placeholder="Paraşüt müşterisi seç">
      <button class="btn sm ${m.parasut_id ? '' : 'dark'}" data-act="esMus">${m.parasut_id ? 'Kaydedildi' : 'Onayla'}</button></div>`;
  };
  // bakiye kontrolü: site bakiyesi Paraşüt bakiyesinin tersi olmalı (Paraşüt'te borç +, sitede -)
  const satirKontrol = k => {
    const [l, c] = k.durum === 'ok' ? ['Aynı', 'ok'] : k.durum === 'fark' ? ['Fark ' + tl(Math.abs(k.fark)), 'bad'] : ['Okunamadı', 'warn'];
    return `<div class="es-sip"><div><b>${esc(k.site)}</b><small>Paraşüt: ${esc(k.parasut)} · site #${esc(k.site_user)}</small>
      <small>Sitede ${k.site_bakiye === null ? '—' : tl(k.site_bakiye)} · Paraşüt'te ${k.parasut_bakiye === null ? '—' : tl(k.parasut_bakiye)}</small></div>
      <div class="es-sag"><span class="pill ${c}">${l}</span></div></div>`;
  };
  const satirGeri = g => {
    const [l, c] = GERI[g.durum] || [g.durum, 'off'];
    const ne = g.tur === 'satis' ? 'Satış → site siparişi' + (g.site_ref ? ' ' + g.site_ref : '') : 'Tahsilat → cari girişi';
    return `<div class="es-sip"><div><b>${esc(g.musteri)}</b><small>${esc(ne)}${g.belge ? ' · ' + esc(g.belge) : ''} · ${esc(g.tarih || '')}</small><small>İşlendi ${dtt(g.guncel)}</small>${g.not_ ? `<small class="es-not">${esc(g.not_)}</small>` : ''}</div>
      <div class="es-sag"><b class="num">${tl(g.tutar)}</b><span class="pill ${c}">${l}</span></div></div>`;
  };
  const satirSiparis = s => {
    const [l, c] = DURUM[s.durum] || [s.durum, 'off'];
    const urunler = (s.satirlar || []).map(x => `${esc(x.parasut_ad || x.site_ad)} ×${num(x.adet)}`).join(', ');
    return `<div class="es-sip"><div><b>${esc(s.musteri)}</b><small>${esc(s.kod)} · ${dtt(s.tarih)}</small><small>${urunler}</small>${s.not_ ? `<small class="es-not">${esc(s.not_)}</small>` : ''}</div>
      <div class="es-sag"><b class="num">${tl(s.toplam)}</b><span class="pill ${c}">${l}</span></div></div>`;
  };

  views.eslestirme = () => {
    if (!D.veri && !D.yukleniyor && !D.hata) setTimeout(yukle);
    const acts = `<button class="btn sm" data-act="esListe" ${D.isliyor ? 'disabled' : ''}>${D.isliyor === 'liste' ? 'Yenileniyor…' : 'Listeleri yenile'}</button>
      <button class="btn sm dark" data-act="esCalis" ${D.isliyor ? 'disabled' : ''}>${D.isliyor === 'calis' ? 'Aktarılıyor…' : 'Siparişleri şimdi aktar'}</button>`;
    const alt = 'Siteden gelen siparişler saat başı Paraşüt\'e satış faturası olarak düşer. Renkler toplanır, set ürününe yazılır.';
    if (D.hata && !D.veri) return head('Paraşüt', 'Eşleştirme', alt, acts) + errBox(D.hata, 'esYukle');
    if (!D.veri) return head('Paraşüt', 'Eşleştirme', alt, acts) + skel();
    const V = D.veri, q = D.q.trim().toLocaleLowerCase('tr');
    const uyan = (...s) => !q || s.join(' ').toLocaleLowerCase('tr').includes(q);
    const uB = V.urun.filter(u => !u.parasut_id).length, mB = V.musteri.filter(m => !m.parasut_id).length;
    const sB = V.siparis.filter(s => !['aktarildi', 'iptal', 'kargo_bekliyor'].includes(s.durum)).length;
    let govde = '';
    if (D.tab === 'urun') {
      const L = V.urun.filter(u => (D.f === 'hepsi' || (D.f === 'bekleyen' ? !u.parasut_id : u.parasut_id)) && uyan(u.site_ad, u.parasut_ad, u.oneri_ad, u.site_anahtar));
      govde = `<p class="es-ip">Her site ürünü için Paraşüt'teki set ürününü seçip <b>Onayla</b>'ya basın. Önerilen eşleşmeler kutuda hazır yazılı, kontrol edip onaylamanız yeterli.</p>
        ${L.slice(0, 150).map(satirUrun).join('') || '<p class="empty">Bu filtrede ürün yok.</p>'}${L.length > 150 ? `<p class="empty">${num(L.length - 150)} ürün daha var, aramayı daraltın.</p>` : ''}`;
    } else if (D.tab === 'musteri') {
      const L = V.musteri.filter(m => (D.f === 'hepsi' || (D.f === 'bekleyen' ? !m.parasut_id : m.parasut_id)) && uyan(m.ad, m.unvan, m.eposta, m.parasut_ad));
      govde = `<p class="es-ip">Sitedeki her toptan müşteri için Paraşüt'teki müşteriyi seçin. Seçilmeyen müşterinin siparişi Paraşüt'e gitmez, bekler.</p>
        ${L.map(satirMusteri).join('') || '<p class="empty">Bu filtrede müşteri yok.</p>'}`;
    } else if (D.tab === 'rapor') {
      const K = V.kontrol;
      govde = `<p class="es-ip">Her saat başı aktarımdan sonra onaylı müşterilerin site bakiyesi Paraşüt bakiyesiyle karşılaştırılır. Fark çıkarsa hiçbir şey kendiliğinden düzeltilmez, burada kırmızı görünür.</p>
        <div class="es-bas"><b>Bakiye kontrolü</b><span>${K?.zaman ? `${dtt(K.zaman)} · ${num(K.toplam)} müşteri · ${K.farkli ? `<b class="es-kirmizi">${num(K.farkli)} fark</b>` : 'fark yok'}` : 'Henüz kontrol yapılmadı'}</span>
          <button class="btn sm" data-act="esKontrol" ${D.isliyor ? 'disabled' : ''}>${D.isliyor === 'kontrol' ? 'Kontrol ediliyor…' : 'Şimdi kontrol et'}</button></div>
        ${(K?.satirlar || []).filter(k => uyan(k.site, k.parasut)).map(satirKontrol).join('') || '<p class="empty">Kayıt yok.</p>'}
        <div class="es-bas"><b>Paraşüt'ten siteye aktarılanlar</b><span>son ${num(V.geri.length)} kayıt</span></div>
        ${V.geri.filter(g => uyan(g.musteri, g.belge, g.site_ref)).map(satirGeri).join('') || '<p class="empty">Henüz aktarım yok.</p>'}`;
    } else {
      govde = `<p class="es-ip">Siparişler sitede <b>Kargolandı</b> ya da <b>Teslim edildi</b> olunca Paraşüt'e aktarılır; eksik ürünü ondan önce siparişten çıkarın.</p>` + (V.siparis.filter(s => uyan(s.musteri, s.kod)).map(satirSiparis).join('') || '<p class="empty">Henüz siteden yeni sipariş gelmedi.</p>');
    }
    const son = V.ayar.son_calisma, sonL = V.ayar.son_liste;
    return head('Paraşüt', 'Eşleştirme', alt, acts) + `
      <div class="mini-kpis"><div><span>Bekleyen ürün</span><b>${num(uB)}</b></div><div><span>Bekleyen müşteri</span><b>${num(mB)}</b></div><div><span>Bekleyen sipariş</span><b>${num(sB)}</b></div><div><span>Son kontrol</span><b>${son?.zaman ? dtt(son.zaman) : '—'}</b></div></div>
      <div class="card"><div class="chips">${[['urun', 'Ürünler', V.urun.length], ['musteri', 'Müşteriler', V.musteri.length], ['siparis', 'Siparişler', V.siparis.length], ['rapor', 'Rapor', V.kontrol?.farkli || 0]].map(([k, l, n]) => `<button class="chip" data-estab="${k}" aria-pressed="${D.tab === k}">${l} <b>${num(n)}</b></button>`).join('')}</div>
        <div class="tools"><input type="search" id="esq" placeholder="Ara" value="${esc(D.q)}">
          ${!['siparis', 'rapor'].includes(D.tab) ? `<select id="esf">${[['bekleyen', 'Onay bekleyenler'], ['onayli', 'Onaylananlar'], ['hepsi', 'Tümü']].map(([k, l]) => `<option value="${k}" ${D.f === k ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}</div>
        ${govde}
        ${sonL?.zaman ? `<p class="es-ip">Listeler ${dtt(sonL.zaman)} tarihinde yenilendi: Paraşüt'te ${num(sonL.parasut_urun)} ürün, ${num(sonL.parasut_musteri)} müşteri.</p>` : ''}</div>
      <datalist id="es-purun">${V.pUrun.map(p => `<option value="${esc(p.ad)}">`).join('')}</datalist>
      <datalist id="es-pmus">${V.pMusteri.map(p => `<option value="${esc(p.ad)}">`).join('')}</datalist>`;
  };
  views.bind_eslestirme = () => {
    const q = $('#esq'); q?.addEventListener('input', () => { D.q = q.value; clearTimeout(q.t); q.t = setTimeout(render, 220); });
    $('#esf')?.addEventListener('change', e => { D.f = e.target.value; render(); });
    $$('[data-estab]').forEach(b => b.addEventListener('click', () => { D.tab = b.dataset.estab; D.q = ''; render(); }));
  };

  async function kaydet(el, tablo, anahtar, adlar) {
    const row = el.closest('.es-row'), ad = row.querySelector('.es-in').value.trim();
    const id = adlar[ad];
    if (!id) { toast('Listeden bir kayıt seçin.'); return; }
    el.disabled = true;
    const kayit = { parasut_id: id, parasut_ad: ad, guncel: new Date().toISOString() };
    const { error } = tablo === 'sp_urun_eslesme'
      ? await sb.from(tablo).update(kayit).eq(anahtar, row.dataset.k)
      : await sb.from(tablo).upsert({ site_ad: row.dataset.k, ...kayit });
    el.disabled = false;
    if (error) { toast('Kaydedilemedi: ' + error.message); return; }
    const liste = tablo === 'sp_urun_eslesme' ? D.veri.urun : D.veri.musteri;
    Object.assign(liste.find(x => (x[anahtar]) === row.dataset.k) || {}, { parasut_id: id, parasut_ad: ad });
    toast('Kaydedildi'); S.keepScroll = true; render();
  }

  // menüdeki "Şimdi eşitle": listeler (müşteri, ürün) → siteden Paraşüt'e → Paraşüt'ten siteye → bakiye kontrolü
  async function esitle() {
    if (S.esitleniyor) return;
    S.esitleniyor = true; render(); toast('Eşitleniyor… (1–2 dakika sürebilir)');
    try {
      const l = await fonksiyon('liste').catch(e => ({ hata: e.message }));
      const r = await fonksiyon('calis');
      const p = r.parasut || {}, k = r.kontrol || {};
      const parca = [`Siteden Paraşüt'e ${num(r.aktarilan || 0)}`, `Paraşüt'ten siteye ${num(p.satis || 0)} satış, ${num(p.odeme || 0)} tahsilat`, ...(r.silinen?.iptal ? [`Paraşüt'te silinen ${num(r.silinen.iptal)} faturanın site siparişi iptal edildi`] : []),
        k.hata ? 'bakiye kontrolü olmadı' : k.farkli ? `${num(k.farkli)} müşteride bakiye farkı` : `${num(k.toplam || 0)} müşterinin bakiyesi aynı`];
      const hata = [l.hata && 'listeler: ' + l.hata, r.hata && 'site → Paraşüt: ' + r.hata, p.hata && 'Paraşüt → site: ' + p.hata, r.silinen?.hata && 'iptaller: ' + r.silinen.hata].filter(Boolean);
      S.esitleniyor = false;
      toast((hata.length ? 'Eşitlendi, sorun var: ' + hata.join('; ') + ' · ' : 'Eşitlendi · ') + parca.join(' · '));
    } catch (err) { S.esitleniyor = false; toast('Eşitlenemedi: ' + err.message); }
    // açık sayfalar yeni bilgiyle yenilenir
    if (S.ui.ek) { S.ui.ek.musteriler = null; if (S.route === 'ekstre' && S.ui.ek.resim) views.onAct('ekHazirla'); }
    if (S.route === 'eslestirme') await yukle(); else { D.veri = null; render(); }
  }

  const prevAct = views.onAct;
  views.onAct = async (act, el, e) => {
    if (act === 'esitle') esitle();
    else if (act === 'esYukle') yukle();
    else if (act === 'esUrun') kaydet(el, 'sp_urun_eslesme', 'site_anahtar', D.veri.pUrunAd);
    else if (act === 'esMus') kaydet(el, 'sp_musteri_eslesme', 'site_ad', D.veri.pMusAd);
    else if (act === 'esListe' || act === 'esCalis' || act === 'esKontrol') {
      D.isliyor = { esListe: 'liste', esCalis: 'calis', esKontrol: 'kontrol' }[act]; render();
      try {
        const r = await fonksiyon(D.isliyor);
        toast(D.isliyor === 'liste' ? `Listeler yenilendi: ${num(r.site_urun)} site ürünü, ${num(r.parasut_urun)} Paraşüt ürünü`
          : D.isliyor === 'kontrol' ? (r.farkli ? `${num(r.farkli)} müşteride bakiye farkı var` : `${num(r.toplam)} müşterinin bakiyesi aynı`)
          : `${num(r.okunan)} sipariş okundu, ${num(r.aktarilan)} aktarıldı, ${num(r.bekleyen)} bekliyor`);
      } catch (err) { toast('Olmadı: ' + err.message); }
      D.isliyor = ''; await yukle();
    }
    else prevAct?.(act, el, e);
  };
})();
