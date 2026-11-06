/* CLK Yönetim — Ödeme takvimi (celik 02.11.2026: "kart kira kredi gibi ödemeleri takip edeceğimiz kart ve krediler için son ödeme tarihlerini
   telefon ile bildirim alacağımız bir form hazırla. personele gizli kalsın").
   Kredi kartı, kredi, kira, fatura, vergi gibi ödemeler: her ayın belli günü ya da tek sefer; tutar isteğe bağlı (kart ekstresi her ay değişirse dönem tutarı girilir).
   Sunucu: Supabase edge fonksiyonu odeme-takvim (yalnız yönetici; kayıt sp_ayar odeme_takvim, Paraşüt'e yazılmaz). Telefona bildirim ntfy uygulamasına,
   sipariş bildirimleriyle aynı kanala gider (celik 02.11: "aynı kanala çek"; kanal adı sp_ayar odeme_ntfy_konu, panelde gösterilmez): cron saat başı 09:00–21:00, seçilen günlerde (7/3/1 gün önce, son gün) ve gecikince bir kez. Sayfa personelde görünmez. */
(() => {
  const { sb, S, $, esc, tl: tl0, tl2, num, dt, toast, head, views, render, go } = CLK;
  const tl = n => (Number(n) || 0) % 1 ? tl2(n) : tl0(n); // kuruşlu tutar kuruşuyla yazılır
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/odeme-takvim';
  const TUR = [['kart', 'Kredi kartı'], ['kredi', 'Kredi'], ['kira', 'Kira'], ['fatura', 'Fatura'], ['vergi', 'Vergi / SGK'], ['diger', 'Diğer']];
  const TURAD = Object.fromEntries(TUR);
  const YER = { kart: 'Örn. Garanti Bonus kart', kredi: 'Örn. Akbank ticari kredi', kira: 'Örn. Dükkân kirası', fatura: 'Örn. Elektrik faturası', vergi: 'Örn. SGK primi', diger: 'Örn. Araç sigortası' };
  // son gün her ödemede sabah ve akşam 20:00'de gelir (celik 02.11), seçilen yalnız önceki günler
  const HAT = [[7, '7 gün önce'], [3, '3 gün önce'], [1, '1 gün önce']];
  const SONGUN = 'son gün sabah ve 20:00';
  const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const AYTAM = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const GUN = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const OD = (S.ui.od ||= { v: null, yuk: false, hata: '', zaman: 0, f: null, is: false, fHata: '', sat: null, silOnay: false });

  const bugun = () => new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);
  const gunFark = (a, b) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 864e5);
  const ayGun = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const ayEkle = (d, n) => { const [y, m] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };
  const donemTarihi = (g, d) => { const [y, m] = d.split('-').map(Number); return `${d}-${String(Math.min(g, ayGun(y, m))).padStart(2, '0')}`; };
  const gunAdi = g => GUN[new Date(g + 'T12:00:00Z').getUTCDay()];
  const ayAdi = d => { const [y, m] = d.split('-').map(Number); return `${AYTAM[m - 1]} ${y}`; };
  const para = v => {
    let s = String(v ?? '').replace(/[\s₺TLtl]/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    return Number.isFinite(n) && n > 0 && n < 1e9 ? Math.round(n * 100) / 100 : 0;
  };
  const yazTutar = n => n ? String(n).replace('.', ',') : '';

  async function sor(govde) {
    const { data } = await sb.auth.getSession();
    let r;
    try { r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) }); }
    catch { throw new Error('Bağlantı koptu, tekrar deneyin.'); }
    const j = await r.json().catch(() => null);
    if (!j) throw new Error('Sunucu yanıt vermedi (' + r.status + ').');
    if (!r.ok || j.hata) throw new Error(j.hata || 'Sunucu ' + r.status);
    return j;
  }
  const ciz = () => { if (S.route === 'odemeler' || S.route === 'panel') { S.keepScroll = true; render(); } };
  async function yukle() {
    if (OD.yuk) return;
    OD.yuk = true; OD.hata = ''; ciz();
    try { OD.v = await sor({ islem: 'liste' }); OD.zaman = Date.now(); } catch (e) { OD.hata = e.message; OD.zaman = Date.now(); }
    OD.yuk = false; ciz();
  }
  const gerekirse = () => { if (!OD.yuk && (!OD.zaman || (!OD.v && !OD.hata) || Date.now() - OD.zaman > 5 * 60e3)) setTimeout(yukle, 0); };

  // kalemin ödenmemiş dönemleri: gecikenler ve sıradaki (sunucudaki acikDonemler ile aynı kural)
  function acikDonemler(k, D, gun) {
    const l = [];
    if (k.tekrar === 'tek') { const o = D[k.id + '|tek'] || {}; if (!o.odendi) l.push({ donem: 'tek', tarih: o.tarih || k.tarih, tutar: o.tutar ?? k.tutar ?? 0, ozel: !!o.tutar }); return l; }
    let d = String(k.baslangic || '');
    if (!/^\d{4}-\d{2}$/.test(d)) return l;
    for (let i = 0; i < 480; i++) {
      if (k.bitis && d > k.bitis) break;
      const o = D[k.id + '|' + d] || {}, t = o.tarih || donemTarihi(k.gun, d);
      if (!o.odendi) { l.push({ donem: d, tarih: t, tutar: o.tutar ?? k.tutar ?? 0, ozel: !!o.tutar }); if (t >= gun) break; }
      d = ayEkle(d, 1);
    }
    return l;
  }
  // kalan taksit: ilk ödenmemiş dönemden son taksit ayına kadar
  const kalanTaksit = (k, D) => {
    if (k.tekrar !== 'aylik' || !k.bitis) return 0;
    let d = k.baslangic, n = 0;
    for (let i = 0; i < 480 && d <= k.bitis; i++, d = ayEkle(d, 1)) if (!D[k.id + '|' + d]?.odendi) n++;
    return n;
  };
  const satirlar = () => {
    const v = OD.v, g = bugun(), l = [];
    for (const k of v?.kalemler || []) for (const p of acikDonemler(k, v.donemler || {}, g)) l.push({ k, p, n: gunFark(p.tarih, g) });
    return l.sort((a, b) => a.p.tarih.localeCompare(b.p.tarih) || a.k.ad.localeCompare(b.k.ad, 'tr'));
  };
  const odenenler = () => {
    const v = OD.v, l = [];
    for (const [a, o] of Object.entries(v?.donemler || {})) {
      if (!o.odendi) continue;
      const [id, donem] = a.split('|'), k = (v.kalemler || []).find(x => x.id === id);
      l.push({ k, id, donem, o: o.odendi, ad: k?.ad || 'Silinen ödeme' });
    }
    return l.sort((a, b) => (b.o.zaman || '').localeCompare(a.o.zaman || ''));
  };
  const durum = n => n < 0 ? ['bad', `${-n} gün gecikti`] : n === 0 ? ['bad', 'Bugün son gün'] : n === 1 ? ['warn', 'Yarın son gün'] : n <= 7 ? ['warn', `${n} gün sonra`] : ['', `${n} gün sonra`];
  const tekrarYazi = (k, D) => {
    if (k.tekrar === 'tek') return `Tek sefer · ${dt(k.tarih)}`;
    const kt = kalanTaksit(k, D || {});
    return `Her ayın ${k.gun}. günü${k.bitis ? ` · son taksit ${ayAdi(k.bitis)}${kt ? ` (${kt} taksit kaldı)` : ''}` : ''}`;
  };
  const hatYazi = k => 'Bildirim: ' + [...HAT.filter(([n]) => (k.hatirlat || []).includes(n)).map(([, l]) => l.toLocaleLowerCase('tr')), SONGUN].join(', ');

  /* ---------- form ---------- */
  const bosForm = () => ({ id: '', ad: '', tur: 'kart', tekrar: 'aylik', gun: '', tarih: '', tutar: '', taksit: '', hatirlat: [3, 1], not: '' });
  function formHtml() {
    const f = OD.f, yeni = !f.id;
    return `<div class="card od-form" id="odForm"><div class="card-h"><div><h3>${yeni ? 'Yeni ödeme' : esc(f.ad || 'Ödeme') + ' · düzenle'}</h3><p class="sub">Son ödeme gününden önce telefona bildirim gelir.</p></div></div>
      <div class="f"><span>Ne ödemesi?</span><div class="chips">${TUR.map(([k, l]) => `<button class="chip" data-act="odTur" data-v="${k}" aria-pressed="${f.tur === k}">${l}</button>`).join('')}</div></div>
      <label class="f"><span>Adı</span><input id="odAd" type="text" maxlength="80" autocomplete="off" placeholder="${esc(YER[f.tur] || '')}" value="${esc(f.ad)}"></label>
      <div class="f"><span>Ne zaman?</span><div class="chips"><button class="chip" data-act="odTekrar" data-v="aylik" aria-pressed="${f.tekrar === 'aylik'}">Her ay</button><button class="chip" data-act="odTekrar" data-v="tek" aria-pressed="${f.tekrar === 'tek'}">Tek sefer</button></div></div>
      <div class="od-2">
        ${f.tekrar === 'aylik' ? `<label class="f"><span>Son ödeme günü (ayın kaçı)</span><select id="odGun"><option value="">Seçin</option>${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${Number(f.gun) === i + 1 ? 'selected' : ''}>${i + 1}${i + 1 > 28 ? ' (kısa ayda son gün)' : ''}</option>`).join('')}</select></label>`
          : `<label class="f"><span>Son ödeme tarihi</span><input id="odTarih" type="date" value="${esc(f.tarih)}"></label>`}
        <label class="f"><span>Tutar <em>${f.tur === 'kart' ? 'ekstre her ay değişiyorsa boş bırakın' : 'isteğe bağlı'}</em></span><input id="odTutar" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(f.tutar)}"></label>
        ${f.tekrar === 'aylik' && (f.tur === 'kredi' || f.taksit) ? `<label class="f"><span>Kalan taksit <em>boşsa bitmez</em></span><input id="odTaksit" type="number" min="1" max="480" inputmode="numeric" placeholder="Örn. 12" value="${esc(f.taksit)}"></label>` : ''}
      </div>
      <div class="f"><span>Önceden hatırlatma <em>son gün sabah ve akşam 20:00'de her zaman gelir</em></span><div class="chips">${HAT.map(([n, l]) => `<button class="chip" data-act="odHat" data-v="${n}" aria-pressed="${f.hatirlat.includes(n)}">${l}</button>`).join('')}</div></div>
      <label class="f"><span>Not <em>isteğe bağlı</em></span><input id="odNot" type="text" maxlength="200" autocomplete="off" placeholder="Örn. hesaptan otomatik çekiliyor" value="${esc(f.not)}"></label>
      ${OD.fHata ? `<p class="msg err">${esc(OD.fHata)}</p>` : ''}
      <div class="od-btn"><button class="btn gold" data-act="odKaydet" ${OD.is ? 'disabled' : ''}>${OD.is ? 'Kaydediliyor' : 'Kaydet'}</button><button class="btn" data-act="odKapat" ${OD.is ? 'disabled' : ''}>Vazgeç</button>
        ${yeni ? '' : `<button class="btn ghost od-sil" data-act="odSil" ${OD.is ? 'disabled' : ''}>${OD.silOnay ? 'Silmek için tekrar basın' : 'Ödemeyi sil'}</button>`}</div>
    </div>`;
  }

  /* ---------- liste ---------- */
  function satirHtml({ k, p, n }) {
    const [c, t] = durum(n), s = OD.sat, ac = s && s.id === k.id && s.donem === p.donem;
    const g = p.tarih.split('-');
    return `<li class="od-r ${c}">
      <div class="od-g"><b>${g[2]}</b><small>${AY[Number(g[1]) - 1]} · ${gunAdi(p.tarih)}</small></div>
      <div class="od-k"><b>${esc(k.ad)}</b><small><span class="pill">${esc(TURAD[k.tur] || 'Ödeme')}</span> ${p.donem !== 'tek' ? esc(ayAdi(p.donem)) : 'Tek sefer'}${k.not ? ' · ' + esc(k.not) : ''}</small></div>
      <div class="od-d"><b class="${c}">${t}</b><small>${p.tutar ? tl(p.tutar) + (p.ozel ? ' · bu ay' : '') : 'Tutar girilmedi'}</small></div>
      <div class="od-a"><button class="btn gold sm" data-act="odOde" data-id="${k.id}" data-donem="${p.donem}">Ödendi</button><button class="btn sm" data-act="odDonem" data-id="${k.id}" data-donem="${p.donem}" title="Bu ayın tutarı ya da günü">${p.tutar ? 'Değiştir' : 'Tutar gir'}</button></div>
    </li>${ac ? `<li class="od-sat">${s.mod === 'ode' ? `
        <label class="f"><span>Ödenen tutar</span><input id="odSatTutar" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(s.tutar)}"></label>
        <label class="f"><span>Ödeme günü</span><input id="odSatTarih" type="date" value="${esc(s.tarih)}" max="${bugun()}"></label>
        <div class="od-btn"><button class="btn gold sm" data-act="odSatKaydet" ${OD.is ? 'disabled' : ''}>${OD.is ? 'Kaydediliyor' : 'Ödendi olarak kaydet'}</button><button class="btn sm" data-act="odSatKapat">Vazgeç</button></div>`
      : `
        <label class="f"><span>${p.donem === 'tek' ? 'Tutar' : esc(ayAdi(p.donem)) + ' tutarı'}</span><input id="odSatTutar" type="text" inputmode="decimal" autocomplete="off" placeholder="${k.tutar ? esc(yazTutar(k.tutar)) : '0,00'}" value="${esc(s.tutar)}"></label>
        <label class="f"><span>Son ödeme günü</span><input id="odSatTarih" type="date" value="${esc(s.tarih)}"></label>
        <div class="od-btn"><button class="btn gold sm" data-act="odSatKaydet" ${OD.is ? 'disabled' : ''}>${OD.is ? 'Kaydediliyor' : 'Kaydet'}</button><button class="btn sm" data-act="odSatKapat">Vazgeç</button></div>`}
      ${s.hata ? `<p class="msg err">${esc(s.hata)}</p>` : ''}</li>` : ''}`;
  }

  views.odemeler = () => {
    gerekirse();
    const acts = `<button class="btn gold" data-act="odYeni">+ Yeni ödeme</button><button class="btn" data-act="odYenile" ${OD.yuk ? 'disabled' : ''}>${OD.yuk ? 'Okunuyor…' : 'Yenile'}</button>`;
    const bas = head('Finans', 'Ödeme takvimi', 'Kart, kredi, kira gibi ödemelerin son günleri. Yaklaşınca telefona bildirim gelir. Yalnız yönetici görür.', acts);
    if (!OD.v) return bas + (OD.hata ? `<div class="card empty"><h3>Okunamadı</h3><p>${esc(OD.hata)}</p><button class="btn dark" data-act="odYenile">Tekrar dene</button></div>`
      : '<div class="card"><div class="skel" style="height:90px"></div><div class="skel" style="height:220px;margin-top:14px"></div></div>');
    const v = OD.v, D = v.donemler || {}, R = satirlar(), g = bugun(), ay = g.slice(0, 7);
    const yedi = R.filter(r => r.n >= 0 && r.n <= 7), gec = R.filter(r => r.n < 0), buAy = R.filter(r => r.p.tarih.slice(0, 7) === ay);
    const top = l => l.reduce((a, r) => a + (Number(r.p.tutar) || 0), 0), tutsuz = l => l.filter(r => !r.p.tutar).length;
    const odn = odenenler(), odnAy = odn.filter(x => String(x.o.tarih || '').slice(0, 7) === ay);
    const ek = l => tutsuz(l) ? ` · ${tutsuz(l)} tutarsız` : '';
    return bas + `${OD.hata ? `<p class="msg err" style="margin-bottom:14px">${esc(OD.hata)}</p>` : ''}
      <div class="kpis od-kpis">
        <div class="kpi hero"><div class="k">7 gün içinde</div><div class="v">${tl0(top(yedi))}</div><div class="s">${num(yedi.length)} ödeme${ek(yedi)}</div></div>
        <div class="kpi ${gec.length ? 'bad' : ''}"><div class="k">Geciken</div><div class="v">${gec.length ? tl0(top(gec)) : '—'}</div><div class="s">${gec.length ? num(gec.length) + ' ödeme' + ek(gec) : 'gecikmiş ödeme yok'}</div></div>
        <div class="kpi"><div class="k">${AYTAM[Number(ay.slice(5)) - 1]} kalan</div><div class="v">${tl0(top(buAy))}</div><div class="s">${num(buAy.length)} ödeme${ek(buAy)}</div></div>
        <div class="kpi"><div class="k">${AYTAM[Number(ay.slice(5)) - 1]} ödenen</div><div class="v">${tl0(odnAy.reduce((a, x) => a + (Number(x.o.tutar) || 0), 0))}</div><div class="s">${num(odnAy.length)} ödeme</div></div>
      </div>
      ${OD.f ? formHtml() : ''}
      <div class="card" style="margin-top:18px"><div class="card-h"><div><h3>Yaklaşan ödemeler</h3><p class="sub">Geciken ve sıradaki ödemeler, son ödeme gününe göre</p></div></div>
        ${R.length ? `<ul class="od-tb">${R.map(satirHtml).join('')}</ul>` : `<div class="od-bos"><p>Henüz ödeme yok.</p><button class="btn gold" data-act="odYeni">+ İlk ödemeyi ekle</button></div>`}
      </div>
      <div class="grid2" style="margin-top:18px">
        <div class="card"><div class="card-h"><div><h3>Tüm ödemeler</h3><p class="sub">${num((v.kalemler || []).length)} kayıt</p></div></div>
          ${(v.kalemler || []).length ? `<ul class="od-liste">${[...v.kalemler].sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map(k => `<li><div><b>${esc(k.ad)}</b><small>${esc(TURAD[k.tur] || '')} · ${esc(tekrarYazi(k, D))}${k.tutar ? ' · ' + tl(k.tutar) : ''}</small><small>${esc(hatYazi(k))}</small></div><button class="btn sm" data-act="odDuzenle" data-id="${k.id}">Düzenle</button></li>`).join('')}</ul>` : '<p class="sub">Kayıt yok.</p>'}
          ${odn.length ? `<h4 class="od-h4">Son ödenenler</h4><ul class="od-liste">${odn.slice(0, 12).map(x => `<li><div><b>${esc(x.ad)}</b><small>${x.donem === 'tek' ? 'Tek sefer' : esc(ayAdi(x.donem))} · ödendi ${dt(x.o.tarih)}${x.o.tutar ? ' · ' + tl(x.o.tutar) : ''}</small></div>${x.k ? `<button class="btn sm ghost" data-act="odGeri" data-id="${x.id}" data-donem="${x.donem}" title="Ödenmedi olarak geri al">Geri al</button>` : ''}</li>`).join('')}</ul>` : ''}
        </div>
        <div class="card od-bildirim"><div class="card-h"><div><h3>Telefona bildirim</h3><p class="sub">ntfy uygulaması · sipariş bildirimleriyle aynı kanal</p></div></div>
          <p>Hatırlatmalar sipariş bildirimlerinin geldiği <b>ntfy</b> kanalına gelir, telefonda ayrıca bir şey kurmanız gerekmez: seçtiğiniz günlerde saat 09:00'da, son gün sabah 09:00'da ve akşam 20:00'de, ödeme gecikirse ertesi gün bir kez daha. Son gün "Ödendi" derseniz akşamki gelmez.</p>
          ${nbHtml()}
        </div>
      </div>`;
  };

  views.bind_odemeler = () => {
    $('#nbAnahtar')?.addEventListener('input', e => { NB.a = e.target.value; NB.hata = ''; });
    const f = OD.f;
    if (f) for (const [id, k] of [['odAd', 'ad'], ['odTutar', 'tutar'], ['odTaksit', 'taksit'], ['odNot', 'not'], ['odTarih', 'tarih'], ['odGun', 'gun']]) {
      const el = $('#' + id);
      el?.addEventListener('input', () => { f[k] = el.value; OD.fHata = ''; });
      el?.addEventListener('change', () => { f[k] = el.value; });
    }
    if (OD.sat) for (const [id, k] of [['odSatTutar', 'tutar'], ['odSatTarih', 'tarih']]) {
      const el = $('#' + id);
      el?.addEventListener('input', () => { if (OD.sat) OD.sat[k] = el.value; });
      el?.addEventListener('change', () => { if (OD.sat) OD.sat[k] = el.value; });
    }
  };

  async function kaydet() {
    const f = OD.f; if (!f || OD.is) return;
    const tutar = para(f.tutar);
    if (!f.ad.trim()) OD.fHata = 'Ödemenin adını yazın.';
    else if (f.tekrar === 'aylik' && !Number(f.gun)) OD.fHata = 'Ayın kaçında ödendiğini seçin.';
    else if (f.tekrar === 'tek' && !f.tarih) OD.fHata = 'Son ödeme tarihini seçin.';
    else if (String(f.tutar).trim() && !tutar) OD.fHata = 'Tutarı anlaşılır yazın (ör. 25.000).';
    else OD.fHata = '';
    if (OD.fHata) { S.keepScroll = true; render(); return; }
    OD.is = true; S.keepScroll = true; render();
    try {
      OD.v = await sor({ islem: 'kaydet', id: f.id || undefined, ad: f.ad, tur: f.tur, tekrar: f.tekrar, gun: Number(f.gun) || undefined, tarih: f.tarih || undefined,
        tutar, taksit: Number(f.taksit) || undefined, hatirlat: f.hatirlat, not: f.not });
      OD.zaman = Date.now(); OD.f = null; toast(f.id ? 'Ödeme güncellendi' : 'Ödeme eklendi');
    } catch (e) { OD.fHata = e.message; }
    OD.is = false; S.keepScroll = true; render();
  }
  async function satKaydet() {
    const s = OD.sat; if (!s || OD.is) return;
    const tutar = para(s.tutar);
    if (String(s.tutar).trim() && !tutar) { s.hata = 'Tutarı anlaşılır yazın (ör. 25.000).'; S.keepScroll = true; render(); return; }
    OD.is = true; s.hata = ''; S.keepScroll = true; render();
    try {
      OD.v = s.mod === 'ode' ? await sor({ islem: 'odendi', id: s.id, donem: s.donem, tutar, tarih: s.tarih })
        : await sor({ islem: 'donem', id: s.id, donem: s.donem, tutar, tarih: s.tarih === s.varsayilan ? '' : s.tarih });
      OD.zaman = Date.now(); toast(s.mod === 'ode' ? 'Ödendi olarak kaydedildi' : 'Kaydedildi'); OD.sat = null;
    } catch (e) { s.hata = e.message; }
    OD.is = false; S.keepScroll = true; render();
  }
  async function basit(govde, mesaj) {
    if (OD.is) return;
    OD.is = true; S.keepScroll = true; render();
    try { const j = await sor(govde); if (j.kalemler) { OD.v = j; OD.zaman = Date.now(); } toast(mesaj); }
    catch (e) { toast(e.message); }
    OD.is = false; S.keepScroll = true; render();
  }
  /* telefon bildirimleri (06.11: ntfy.sh ücretsiz kotayı internet adresine göre sayıyor; Supabase'in ortak çıkış adresinde 19:00'da doldu, sipariş bildirimleri dahil
     hiçbiri gitmedi). Hesap anahtarı (sp_ayar.ntfy_token) ücretli planda (Supporter, 2.500/gün; celik 06.11 20:58 aldı) kotayı bize ayırır; ücretsiz hesap da
     IP'ye göre sayılır (ntfy /v1/account limits.basis "ip"). Her bildirim bildirim_kayit'a yazılır, ulaşmayan 15 dk'da bir yeniden
     gönderilir (cron bildirim-kontrol). Veritabanı fonksiyonları (yalnız yönetici): bildirim_durum, bildirim_hesap, bildirim_deneme, bildirim_sonuc; kurulum
     /mnt/project-files/sunucu/bildirim.sql. Kurulmamışsa eski deneme (odeme-takvim) kullanılır. */
  const NB = (OD.nb ||= { d: null, yuk: false, zaman: 0, hata: '', kurulu: true, a: '', kay: false, den: '', denHata: '' });
  const nbCiz = () => { S.keepScroll = true; render(); };
  const nbHataYazi = h => !h ? '' : h.kod === 429 ? 'ntfy.sh günlük ücretsiz kotası doldu (429). Ulaşmayan bildirimler bekletilir, kota açılınca gönderilir. ntfy hesabının Supporter planı sürüyor mu bakın (ücretsiz hesap da ortak kotayı kullanır).'
    : h.kod === 401 || h.kod === 403 ? `ntfy.sh anahtarı kabul etmedi (${h.kod}). Anahtarı yeniden kopyalayıp kaydedin.` : 'ntfy.sh hatası' + (h.kod ? ` (${h.kod})` : '') + (h.hata ? ': ' + String(h.hata).slice(0, 120) : '');
  async function nbYukle(zorla) {
    if (NB.yuk || (!zorla && Date.now() - NB.zaman < 60000)) return;
    NB.yuk = true; NB.zaman = Date.now();
    const { data, error } = await sb.rpc('bildirim_durum');
    NB.yuk = false;
    if (error) { NB.kurulu = !/bildirim_durum|PGRST202|Could not find|does not exist/i.test(`${error.message} ${error.code || ''}`); NB.hata = NB.kurulu ? error.message : ''; }
    else { NB.d = data; NB.kurulu = true; NB.hata = ''; }
    nbCiz();
  }
  async function nbKaydet(sil) {
    const a = sil ? '' : NB.a.trim();
    if (!sil && !/^tk_[A-Za-z0-9]{20,60}$/.test(a)) { NB.hata = 'Anahtar tk_ ile başlamalı: ntfy.sh › Account › Access tokens bölümünden kopyalayın.'; return nbCiz(); }
    NB.kay = true; NB.hata = ''; nbCiz();
    const { error } = await sb.rpc('bildirim_hesap', { anahtar: a });
    NB.kay = false;
    if (error) { NB.hata = error.message; return nbCiz(); }
    NB.a = ''; toast(sil ? 'Bildirim hesabı kaldırıldı' : 'Anahtar kaydedildi, deneme bildirimi gidiyor');
    if (sil) nbYukle(true); else nbDeneme();
    nbCiz();
  }
  async function nbDeneme() {
    if (!NB.kurulu) return basit({ islem: 'deneme' }, 'Deneme bildirimi gönderildi, telefona bakın');
    if (NB.den === 'gidiyor') return;
    NB.den = 'gidiyor'; NB.denHata = ''; nbCiz();
    const { data: id, error } = await sb.rpc('bildirim_deneme');
    if (error) { NB.den = 'hata'; NB.denHata = error.message; return nbCiz(); }
    for (let i = 0; i < 12 && NB.den === 'gidiyor'; i++) {
      await new Promise(r => setTimeout(r, 1500));
      const { data: s } = await sb.rpc('bildirim_sonuc', { istek: id });
      if (s && !s.bekliyor) { NB.den = s.tamam ? 'tamam' : 'hata'; NB.denHata = s.tamam ? '' : nbHataYazi(s); }
    }
    if (NB.den === 'gidiyor') { NB.den = 'hata'; NB.denHata = 'ntfy.sh yanıt vermedi; birkaç dakika sonra yeniden deneyin.'; }
    nbYukle(true);
  }
  const saat = t => { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
  function nbHtml() {
    nbYukle();
    const d = NB.d, g = d?.gun || {};
    const durum = !NB.kurulu ? `<p class="msg err">Kurulum bekleniyor: Supabase SQL Editor'da bildirim.sql çalıştırılmalı.</p>`
      : !d ? `<p class="sub">${NB.yuk ? 'Durum okunuyor…' : ''}</p>`
      : `<ul class="nb-d">
          <li><span>Gönderim</span><b class="${d.hesap ? 'ok' : 'bad'}">${d.hesap ? 'ntfy hesabıyla (kota bize ait)' : 'Hesapsız · ortak ücretsiz kota'}</b></li>
          <li><span>Son 24 saat</span><b>${num(g.toplam || 0)} bildirim · ${num(g.tamam || 0)} ulaştı${g.bekliyor ? ` · <span class="bad">${num(g.bekliyor)} bekliyor</span>` : ''}${g.hata ? ` · <span class="bad">${num(g.hata)} gitmedi</span>` : ''}</b></li>
          ${d.sonHata && Date.now() - Date.parse(d.sonHata.zaman) < 864e5 ? `<li><span>Son hata</span><b class="bad">${saat(d.sonHata.zaman)} · ${esc(nbHataYazi(d.sonHata))}</b></li>` : ''}
        </ul>`;
    const form = NB.kurulu ? `<label class="nb-a"><span>ntfy hesap anahtarı</span><input id="nbAnahtar" type="password" autocomplete="off" spellcheck="false" placeholder="${d?.hesap ? 'Kayıtlı · değiştirmek için yenisini yapıştırın' : 'tk_…'}" value="${esc(NB.a)}"></label>
        <div class="nb-btn"><button class="btn dark sm" data-act="odNbKaydet" ${NB.kay ? 'disabled' : ''}>${NB.kay ? 'Kaydediliyor…' : 'Anahtarı kaydet'}</button>${d?.hesap ? '<button class="btn sm ghost" data-act="odNbSil">Anahtarı kaldır</button>' : ''}</div>
        <p class="hint">Kota yalnız ücretli (Supporter) ntfy hesabında bize ait olur; ücretsiz hesap da ortak adres kotasını kullanır (06.11'de Supporter alındı). Anahtar: ntfy.sh/account › Access tokens › Create access token (süre: never). Anahtar yalnız sunucuda saklanır, burada geri gösterilmez. Telefondaki uygulamada değişiklik gerekmez.</p>` : '';
    return `${durum}${NB.hata ? `<p class="msg err">${esc(NB.hata)}</p>` : ''}${form}
      <div class="nb-btn"><button class="btn gold sm" data-act="odDeneme" ${OD.is || NB.den === 'gidiyor' ? 'disabled' : ''}>${NB.den === 'gidiyor' ? 'Gönderiliyor…' : 'Deneme bildirimi gönder'}</button></div>
      ${NB.den === 'tamam' ? '<p class="msg ok">ntfy.sh bildirimi aldı; telefonunuza gelmiş olmalı.</p>' : NB.den === 'hata' ? `<p class="msg err">${esc(NB.denHata)}</p>` : ''}`;
  }
  const bulKalem = id => (OD.v?.kalemler || []).find(k => k.id === id);
  const bulDonem = (id, donem) => { const k = bulKalem(id); return k && acikDonemler(k, OD.v.donemler || {}, bugun()).find(p => p.donem === donem); };

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (!act.startsWith('od')) return prevAct?.(act, el, e);
    const f = OD.f;
    if (act === 'odYenile') yukle();
    else if (act === 'odYeni') { OD.f = bosForm(); OD.fHata = ''; OD.silOnay = false; if (S.route !== 'odemeler') go('odemeler'); else { S.keepScroll = true; render(); } setTimeout(() => $('#odForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }
    else if (act === 'odDuzenle') {
      const k = bulKalem(el.dataset.id); if (!k) return;
      const kt = kalanTaksit(k, OD.v.donemler || {});
      OD.f = { id: k.id, ad: k.ad, tur: k.tur, tekrar: k.tekrar, gun: k.gun ? String(k.gun) : '', tarih: k.tarih || '', tutar: yazTutar(k.tutar), taksit: kt ? String(kt) : '', hatirlat: [...(k.hatirlat || [])], not: k.not || '' };
      OD.fHata = ''; OD.silOnay = false; S.keepScroll = true; render(); setTimeout(() => $('#odForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
    else if (act === 'odKapat') { OD.f = null; OD.fHata = ''; S.keepScroll = true; render(); }
    else if (act === 'odTur' && f) { f.tur = el.dataset.v; S.keepScroll = true; render(); }
    else if (act === 'odTekrar' && f) { f.tekrar = el.dataset.v; S.keepScroll = true; render(); }
    else if (act === 'odHat' && f) { const n = Number(el.dataset.v); f.hatirlat = f.hatirlat.includes(n) ? f.hatirlat.filter(x => x !== n) : [...f.hatirlat, n]; S.keepScroll = true; render(); }
    else if (act === 'odKaydet') kaydet();
    else if (act === 'odSil' && f?.id) {
      if (!OD.silOnay) { OD.silOnay = true; S.keepScroll = true; render(); setTimeout(() => { if (OD.silOnay) { OD.silOnay = false; S.keepScroll = true; render(); } }, 6000); return; }
      OD.silOnay = false; const id = f.id; OD.f = null; basit({ islem: 'sil', id }, 'Ödeme silindi');
    }
    else if (act === 'odOde' || act === 'odDonem') {
      const p = bulDonem(el.dataset.id, el.dataset.donem); if (!p) return;
      const k = bulKalem(el.dataset.id), varsayilan = p.donem === 'tek' ? k.tarih : donemTarihi(k.gun, p.donem);
      OD.sat = act === 'odOde' ? { mod: 'ode', id: k.id, donem: p.donem, tutar: yazTutar(p.tutar), tarih: bugun() }
        : { mod: 'donem', id: k.id, donem: p.donem, tutar: p.ozel ? yazTutar(p.tutar) : '', tarih: p.tarih, varsayilan };
      S.keepScroll = true; render(); setTimeout(() => $('#odSatTutar')?.focus(), 0);
    }
    else if (act === 'odSatKapat') { OD.sat = null; S.keepScroll = true; render(); }
    else if (act === 'odSatKaydet') satKaydet();
    else if (act === 'odGeri') basit({ islem: 'odendi_geri', id: el.dataset.id, donem: el.dataset.donem }, 'Ödenmedi olarak geri alındı');
    else if (act === 'odDeneme') nbDeneme();
    else if (act === 'odNbKaydet') nbKaydet(false);
    else if (act === 'odNbSil') nbKaydet(true);
    else prevAct?.(act, el, e);
  };

  // ana panel: 7 gün içindeki ve geciken ödemeler (yalnız yönetici)
  CLK.odeme = {
    // telefon bildirimleri gitmiyorsa ana panelde uyarı (yalnız yönetici)
    bildirim: () => {
      if (!CLK.yonetici()) return '';
      nbYukle();
      const g = NB.d?.gun, sorun = (g?.bekliyor || 0) + (g?.hata || 0);
      if (!NB.d || !sorun) return '';
      return `<div class="card nb-uyari" data-go="odemeler"><div><b>Telefon bildirimleri gitmiyor</b><small>Son 24 saatte ${num(sorun)} bildirim ulaşmadı${NB.d.hesap ? '' : ' · ntfy hesap anahtarı girilmemiş'}. Ödeme takvimi › Telefona bildirim.</small></div><span class="pill bad">${num(sorun)}</span></div>`;
    },
    panel: () => {
      if (!CLK.yonetici()) return '';
      gerekirse();
      if (!OD.v) return '';
      const R = satirlar().filter(r => r.n <= 7);
      if (!R.length) return '';
      return `<div class="card"><div class="card-h"><div><h3>Ödemeler · 7 gün</h3><p class="sub">Kart, kredi, kira · son ödeme günleri</p></div><button class="btn sm ghost" data-go="odemeler">Ödeme takvimi</button></div>
        <ul class="rows">${R.slice(0, 8).map(({ k, p, n }) => { const [c, t] = durum(n); return `<li data-go="odemeler"><span class="th ord">${p.tarih.slice(8)}</span><div class="t"><b>${esc(k.ad)}</b><small>${esc(TURAD[k.tur] || '')} · ${dt(p.tarih)} ${gunAdi(p.tarih)}${p.tutar ? ' · ' + tl(p.tutar) : ''}</small></div><span class="pill ${c || 'gold'}">${t}</span></li>`; }).join('')}</ul></div>`;
    }
  };
})();
