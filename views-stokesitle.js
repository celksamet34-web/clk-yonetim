/* CLK Yönetim — Stok eşitle: sitede renkleriyle girilen stok Paraşüt'e yazılır (celik isteği 31.10.2026).
   Paraşüt'te renk yok; her ürünün sitedeki renk toplamı Paraşüt stoğu olur. Fark sunucuda (stok-esitle) "Stok sayımı" açıklamalı
   gelen ya da giden irsaliyeyle girilir, Paraşüt'te hiçbir kayıt silinmez. Sitede olmayan ve WEST ürünlerine dokunulmaz. */
(() => {
  const { sb, S, $, esc, num, dtt, toast, head, views, render } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/stok-esitle';
  const ESKI_DK = 10; // sunucu bundan eski okunmuş Paraşüt stoğunu yazmaz
  const D = (S.ui.se ||= { urunler: null, zaman: '', yukleniyor: false, hata: '', filtre: 'farkli', ara: '', goster: 100, secili: new Set(), onay: false, yaziyor: false, durum: '', sonuc: {}, uyari: '' });
  const fmt = v => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(v) || 0);
  const isaret = v => (v > 0 ? '+' : '') + fmt(v);

  async function sor(govde) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.hata) throw new Error(j?.hata || 'Sunucu ' + r.status);
    return j;
  }

  // Paraşüt stoğu sunucuda sayfa sayfa okunur; eski okunmuş ya da az önce yazılmış ürün varsa liste kendiliğinden yenilenir
  const eski = u => !u.zaman || Date.now() - Date.parse(u.zaman) > ESKI_DK * 6e4;
  const bekliyor = u => u.parasut !== null && !u.arsiv && (u.okunuyor || eski(u));
  let sayac = 0, oto = 0;
  async function yukle(kendi) {
    if (D.yukleniyor) return;
    oto = kendi ? oto + 1 : 0;
    D.yukleniyor = true; D.hata = ''; render();
    try {
      const r = await sor({ islem: 'liste' });
      D.urunler = r.urunler; D.zaman = r.zaman;
      const ix = new Set(D.urunler.filter(u => u.fark && !bekliyor(u)).map(u => u.id));
      for (const id of [...D.secili]) if (!ix.has(id)) D.secili.delete(id);
    } catch (e) { D.hata = e.message; }
    D.yukleniyor = false; S.keepScroll = true; render();
    const tur = ++sayac;
    if (D.urunler?.some(bekliyor) && oto < 8) setTimeout(() => { if (tur === sayac && S.route === 'stokesitle' && !D.yaziyor) yukle(true); }, 45e3);
  }

  const FILTRE = {
    farkli: ['Farklı', u => !!u.fark && !bekliyor(u)],
    renkli: ['Renkli', u => u.renkler.length > 0],
    eksi: ['Paraşüt\'te eksi', u => u.parasut < 0],
    esit: ['Eşit', u => u.parasut !== null && !u.fark && !bekliyor(u)],
    okunuyor: ['Okunuyor', u => bekliyor(u)],
    hepsi: ['Tümü', () => true]
  };
  const gorunen = () => {
    const q = D.ara.trim().toLocaleLowerCase('tr');
    return (D.urunler || []).filter(FILTRE[D.filtre][1]).filter(u => !q || u.ad.toLocaleLowerCase('tr').includes(q) || u.siteAd.toLocaleLowerCase('tr').includes(q) || u.kat.toLocaleLowerCase('tr').includes(q));
  };
  const yazilabilir = u => !!u.fark && !bekliyor(u) && u.hedef >= 0;
  const secililer = () => (D.urunler || []).filter(u => D.secili.has(u.id) && yazilabilir(u));

  const satir = u => {
    const s = D.sonuc[u.id];
    const durum = u.parasut === null ? 'Paraşüt\'te yok' : u.arsiv ? 'Paraşüt\'te arşivde' : u.okunuyor ? 'Yazıldı, Paraşüt\'ten okunuyor' : eski(u) ? 'Paraşüt stoğu okunuyor' : s?.not || '';
    const renk = u.renkler.length ? u.renkler.map(([r, q]) => `<span class="se-renk">${esc(r)} <b>${fmt(q)}</b></span>`).join('') : '<span class="se-renksiz">Renksiz</span>';
    return `<tr class="${D.secili.has(u.id) ? 'sk-satir-deg' : ''}">
      <td>${yazilabilir(u) ? `<input type="checkbox" data-sec="${u.id}" ${D.secili.has(u.id) ? 'checked' : ''} aria-label="Seç ${esc(u.ad)}">` : ''}</td>
      <td class="stg-urun">${esc(u.ad)}${u.siteAd && u.siteAd !== u.ad ? `<small>Sitede: ${esc(u.siteAd)}</small>` : ''}<small>${esc(u.kat || 'Kategorisiz')}${u.acik ? '' : ' · sitede gizli'}</small></td>
      <td class="se-renkler">${renk}</td>
      <td class="num">${fmt(u.site)}${u.bekleyen ? `<small class="se-not" title="Sitede açılmış, Paraşüt'e henüz geçmemiş siparişlerdeki adet; Paraşüt stoğundan düşmedi">+${fmt(u.bekleyen)} siparişte</small>` : ''}</td>
      <td class="num ${u.parasut < 0 ? 'sk-eksi' : ''}">${u.parasut === null ? '—' : fmt(u.parasut)}</td>
      <td class="num ${u.fark > 0 ? 'se-arti' : u.fark < 0 ? 'se-eksi' : ''}">${u.fark ? isaret(u.fark) : '—'}</td>
      <td class="se-durum">${esc(durum)}</td></tr>`;
  };

  views.stokesitle = () => {
    if (!D.urunler && !D.yukleniyor && !D.hata) yukle();
    const acts = `<button class="btn" data-act="seYenile" ${D.yukleniyor || D.yaziyor ? 'disabled' : ''}>${D.yukleniyor ? 'Okunuyor…' : 'Yenile'}</button>`;
    const ust = head('Paraşüt', 'Stok eşitle', `Sitede renkleriyle girilen stok Paraşüt'e yazılır${D.zaman ? ' (liste ' + dtt(D.zaman) + ')' : ''}. Paraşüt'te renk yok: her ürünün sitedeki renk toplamı Paraşüt stoğu olur. Fark, açıklaması "Stok sayımı" olan gelen ya da giden irsaliyeyle girilir; Paraşüt'te hiçbir kayıt silinmez. Sitede olmayan ürünlere ve WEST ürünlerine dokunulmaz.`, acts);
    if (!D.urunler) return ust + (D.hata ? `<div class="card empty"><h3>Liste alınamadı</h3><p>${esc(D.hata)}</p><button class="btn dark" data-act="seYenile">Tekrar dene</button></div>` : '<div class="card"><p class="sk-say" style="margin:0 0 10px">Sitedeki ürünler ve Paraşüt stokları okunuyor, yarım dakika sürebilir…</p><div class="skel" style="height:300px"></div></div>');
    const liste = gorunen(), sec = secililer();
    const giris = sec.filter(u => u.fark > 0).reduce((a, u) => a + u.fark, 0), cikis = sec.filter(u => u.fark < 0).reduce((a, u) => a - u.fark, 0);
    const okunan = D.urunler.filter(bekliyor).length;
    return `${ust}
      ${D.uyari ? `<div class="card se-uyari">${esc(D.uyari)}</div>` : ''}
      <div class="sk-filtre">${Object.entries(FILTRE).map(([k, [ad, f]]) => `<button class="sk-f" data-act="seFiltre" data-k="${k}" aria-pressed="${D.filtre === k}"><b>${num(D.urunler.filter(f).length)}</b><small>${ad}</small></button>`).join('')}</div>
      <div class="card">
        <div class="sk-arac"><input id="seAra" type="search" placeholder="Ürün ya da kategori ara" value="${esc(D.ara)}" aria-label="Ürün ara">
          <span class="sk-say">${num(liste.length)} ürün${okunan ? ` · ${num(okunan)} ürünün Paraşüt stoğu okunuyor, liste kendiliğinden yenilenir` : ''}</span></div>
        <div class="ul-tablo"><table class="sk-tablo se-tablo"><thead><tr><th><input type="checkbox" id="seHepsi" aria-label="Görünenlerin hepsini seç" ${liste.some(yazilabilir) && liste.slice(0, D.goster).filter(yazilabilir).every(u => D.secili.has(u.id)) ? 'checked' : ''}></th><th>Ürün</th><th>Sitedeki renkler</th><th>Sitede</th><th>Paraşüt</th><th>Fark</th><th>Durum</th></tr></thead>
          <tbody>${liste.length ? liste.slice(0, D.goster).map(satir).join('') : '<tr><td colspan="7" class="sk-bos">Bu filtrede ürün yok.</td></tr>'}</tbody></table></div>
        ${liste.length > D.goster ? `<div class="ek-dug"><button class="btn" data-act="seDaha">Daha fazla göster (${num(liste.length - D.goster)} kaldı)</button></div>` : ''}
      </div>
      <div class="sk-cubuk"><span>${sec.length ? `${num(sec.length)} ürün seçili: Paraşüt'e ${giris ? `+${fmt(giris)} giriş` : ''}${giris && cikis ? ', ' : ''}${cikis ? `−${fmt(cikis)} çıkış` : ''}` : 'Paraşüt\'e yazılacak ürünleri seçin'}</span>${D.durum ? `<span class="sk-durum">${esc(D.durum)}</span>` : ''}
        <button class="btn" data-act="seTemizle" ${sec.length && !D.yaziyor ? '' : 'disabled'}>Seçimi temizle</button>
        <button class="btn dark" data-act="seYaz" ${sec.length && !D.yaziyor && !D.yukleniyor ? '' : 'disabled'}>${D.yaziyor ? 'Yazılıyor…' : D.onay ? `Evet, ${num(sec.length)} ürünü Paraşüt'e yaz` : 'Paraşüt\'e yaz'}</button></div>`;
  };

  views.bind_stokesitle = () => {
    const ara = $('#seAra'); ara?.addEventListener('input', () => { D.ara = ara.value; D.goster = 100; render(); });
    $('#seHepsi')?.addEventListener('change', e => { gorunen().slice(0, D.goster).filter(yazilabilir).forEach(u => e.target.checked ? D.secili.add(u.id) : D.secili.delete(u.id)); D.onay = false; S.keepScroll = true; render(); });
    $('.se-tablo')?.addEventListener('change', e => {
      const id = e.target.dataset.sec; if (!id) return;
      e.target.checked ? D.secili.add(id) : D.secili.delete(id); D.onay = false; S.keepScroll = true; render();
    });
  };

  async function yaz() {
    const sec = secililer();
    if (!sec.length) return;
    D.yaziyor = true; D.onay = false; D.durum = ''; D.uyari = ''; render();
    const istek = (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^a-z0-9-]/gi, '');
    let r = null, hata = '';
    // bağlantı koparsa aynı istek numarasıyla tekrar sorulur: sunucu irsaliyeyi ikinci kez açmaz
    for (let i = 0; i < 3 && !r; i++) {
      try { r = await sor({ islem: 'yaz', urunler: sec.map(u => u.id), istek }); }
      catch (e) { hata = e.message; if (/Oturum|seçilmedi|İstek/.test(hata)) break; await new Promise(s => setTimeout(s, 4000)); }
    }
    if (r) {
      for (const s of r.sonuc || []) D.sonuc[s.id] = s;
      const yazilan = (r.sonuc || []).filter(s => s.ok && s.fark), hatali = (r.sonuc || []).filter(s => !s.ok);
      for (const s of yazilan) D.secili.delete(s.id);
      const irs = r.irsaliyeler || [];
      D.durum = yazilan.length ? `${num(yazilan.length)} ürün Paraşüt'e yazıldı (${irs.length} irsaliye).` : 'Paraşüt\'e yazılan olmadı.';
      if (hatali.length) D.durum += ` ${num(hatali.length)} ürün yazılmadı: ${hatali[0].not}`;
      // irsaliye stoğu beklendiği gibi değiştirmediyse açıkça uyarılır
      const tutmayan = (r.dogrulama || []).filter(d => d.parasut !== null && d.parasut !== d.beklenen);
      if (tutmayan.length) D.uyari = `Dikkat: irsaliyeden sonra Paraşüt stoğu beklenen değer olmadı (${tutmayan.map(d => `${d.ad}: beklenen ${fmt(d.beklenen)}, Paraşüt ${fmt(d.parasut)}`).join('; ')}). Başka ürün yazmadan önce kontrol edin.`;
      toast(D.durum);
    } else { D.durum = 'Yazılamadı: ' + hata; toast(D.durum); }
    D.yaziyor = false; S.keepScroll = true; render();
    yukle();
  }

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'seYenile') yukle();
    else if (act === 'seFiltre') { D.filtre = el.dataset.k; D.goster = 100; render(); }
    else if (act === 'seDaha') { D.goster += 200; S.keepScroll = true; render(); }
    else if (act === 'seTemizle') { D.secili.clear(); D.onay = false; S.keepScroll = true; render(); }
    else if (act === 'seYaz') { if (D.onay) yaz(); else { D.onay = true; S.keepScroll = true; render(); setTimeout(() => { if (D.onay && !D.yaziyor) { D.onay = false; S.keepScroll = true; render(); } }, 8000); } }
    else prevAct?.(act, el, e);
  };
})();
