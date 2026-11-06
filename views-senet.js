/* CLK Yönetim — Senet gir (celik 01.11.2026: "senet gir işlemini yapabilir misin, hem sıra no veririz"; "çek girişinde açıklamaya senet yazıyoruz").
   Senet Paraşüt'e çek olarak açılır: bankası "Diğer", banka adı SENET, numarası panelin verdiği sıra no (SN0001, SN0002…).
   Müşteriden alınan senet müşterinin carisinden düşer ve sitedeki cariye tahsilat olarak yazılır; tedarikçiye verilen senet ödenecek olur.
   Birden çok senet (taksit) bir kerede girilir. Paraşüt'te hiçbir kayıt silinmez ya da değiştirilmez (sunucu: gider-cek).
   Tedarikçiye verdik › Portföydeki müşteri evrakı: portföydeki çek ve senetler seçilip numaralı çıkış bordrosu (CB0001…) hazırlanır
   (celik 01.11.2026: "portföyde ki senetleri tedarikçiye çıkacağımız bir formda hazırla", "tedarikçiye verdik kısmında form açıp seçebiliriz").
   Paraşüt API'si ciroya izin vermiyor: ciro Paraşüt'te tedarikçiye ödeme olarak girilir, panel girilene kadar "Paraşüt'te bekliyor" gösterir. */
(() => {
  const { sb, S, $, $$, esc, tl, tl2, num, dt, dtt, toast, head, views, render, araKutu, araSec, ARA, go } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/gider-cek';
  const EN_COK = 12;
  const bugun = () => new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);
  const gunEkle = (g, n) => new Date(Date.parse(g + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const aySonuMu = g => new Date(Date.parse(g + 'T00:00:00Z') + 864e5).getUTCDate() === 1;
  // aya göre ilerler; ilk vade ay sonuysa hepsi ay sonu olur (30.11 → 31.12 → 31.01 → 28.02)
  const ayEkle = (g, n, sonu) => {
    const y = +g.slice(0, 4), m = +g.slice(5, 7) - 1 + n, son = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, sonu ? son : Math.min(+g.slice(8, 10), son))).toISOString().slice(0, 10);
  };
  const aySonu = g => ayEkle(g, 0, true);
  const bekle = ms => new Promise(s => setTimeout(s, ms));
  const uuid = () => (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^a-z0-9-]/gi, '');
  const para = v => {
    let s = String(v ?? '').replace(/[\s₺TLtl]/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    return Number.isFinite(n) && n > 0 && n < 1e8 ? Math.round(n * 100) / 100 : 0;
  };
  const yaz = n => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const siraMetni = n => 'SN' + String(n).padStart(4, '0');
  const senetMi = c => /sen+e?t|seet/i.test(c.bankaAd) || /senet/i.test(c.seri) || (c.banka === 'OTHER' && !c.bankaAd);

  const yeniForm = (o = {}) => ({ yon: o.yon || 'alinan', tur: o.tur || 'portfoy', kisi: null, adet: 1, mod: 'her', tutar: '', ilk: o.ilk || aySonu(gunEkle(bugun(), 28)), aralik: 'ay', tarih: o.tarih || bugun(), aciklama: '', satirlar: [], secili: [] });
  const D = (S.ui.sn ||= { k: null, c: null, yuk: false, hata: '', f: yeniForm(), kaydediyor: false, onay: false, sonuc: null, uyari: '', goster: 15,
    pfTur: 'senet', pfAra: '', pfGoster: 80, bordro: null, bResim: '', bIptalOnay: false });
  const ciz = () => { S.keepScroll = true; render(); };

  async function sor(govde) {
    const { data } = await sb.auth.getSession();
    let r;
    try { r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) }); }
    catch { throw Object.assign(new Error('Bağlantı koptu.'), { ag: true }); }
    const j = await r.json().catch(() => null);
    if (!j) throw Object.assign(new Error('Sunucu yanıt vermedi (' + r.status + ').'), { ag: r.status >= 500 });
    if (!r.ok || j.hata) throw new Error(j.hata || 'Sunucu ' + r.status);
    return j;
  }
  // bağlantı koparsa aynı istek numarasıyla tekrar sorulur: sunucu aynı senedi ikinci kez açmaz
  async function yazIstek(govde) {
    let son;
    for (let i = 0; i < 3; i++) {
      try { return await sor(govde); } catch (e) { son = e; if (!e.ag) break; await bekle(3000 * (i + 1)); }
    }
    throw son;
  }

  async function yukle(yenile) {
    if (D.yuk) return;
    D.yuk = true; D.hata = ''; S.keepScroll = true; render();
    const iki = await Promise.allSettled([
      sor({ islem: 'senet_kaynak', yenile: !!yenile }).then(k => { D.k = k; S.keepScroll = true; render(); }),
      // açık senetleri göstermek ve aynı senedi iki kez girmemek için Paraşüt'teki çek/senet listesi (10 dakika saklanır)
      sor({ islem: 'cekler', yenile: !!yenile }).then(c => { D.c = c; if (S.ui.cs) S.ui.cs.v = c; S.keepScroll = true; render(); })
    ]);
    const h = iki.find(x => x.status === 'rejected');
    if (h) D.hata = h.reason?.message || 'Veri alınamadı';
    D.yuk = false; S.keepScroll = true; render();
  }

  /* ---------- tedarikçiye çıkış (ciro) bordrosu ---------- */
  const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const EV = () => CLK.evrak || { senetMi, tur: c => (senetMi(c) ? 'Senet' : 'Çek'), banka: c => (senetMi(c) ? '' : c.bankaAd || (c.banka !== 'OTHER' ? c.banka : '')) };
  const sonG = c => EV().sonGun?.(c) || c.vade;
  const evrakAdi = c => [EV().tur(c), EV().banka(c), c.seri ? 'No ' + c.seri : ''].filter(Boolean).join(' · ');
  const trE = d => (d ? String(d).slice(0, 10).split('-').reverse().join('.') : '');
  const tlE = v => yaz(v) + ' ₺';
  const gunArasi = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
  // tutara göre ağırlıklı ortalama vade
  const ortVade = (l, tarih) => {
    const t = l.reduce((s, c) => s + c.tutar, 0);
    return t && tarih ? gunEkle(tarih, Math.round(l.reduce((s, c) => s + c.tutar * gunArasi(tarih, c.vade), 0) / t)) : '';
  };
  const ciroMu = () => D.f.yon === 'verilen' && D.f.tur === 'portfoy';
  // bordrodaki evrakın Paraşüt'teki durumu: bekliyor (hâlâ portföyde), islendi (bu tedarikçiye ciro), baska (başka tedarikçiye ciro), kapandi (tahsil edildi vb.)
  function evrakDurum(e, b) {
    const c = (D.c?.cekler || []).find(x => x.id === e.id);
    if (!c) return 'bilinmiyor';
    if (c.yon === 'ciro') return c.kimeId === b.kisiId ? 'islendi' : 'baska';
    return c.yon === 'alinan' && c.kalan > 0.009 ? 'bekliyor' : 'kapandi';
  }
  function bordroDurum(b) {
    const s = { islendi: 0, bekliyor: 0, baska: 0, kapandi: 0, bilinmiyor: 0 };
    for (const e of b.evraklar || []) s[evrakDurum(e, b)]++;
    return s;
  }
  // Paraşüt'te ciro edilmeyi bekleyen bordrolara ayrılmış evraklar: id → bordro
  function ayrilan() {
    const m = {};
    for (const b of D.c?.bordrolar || []) for (const e of b.evraklar || []) if (evrakDurum(e, b) === 'bekliyor') m[e.id] = b;
    return m;
  }
  // alış tarihine göre (celik 02.11), CLK.evrak.alisSira ile aynı
  const alisSira = (a, b) => (a.tarih || '').localeCompare(b.tarih || '') || (a.vade || '').localeCompare(b.vade || '') || String(a.seri || '').localeCompare(String(b.seri || ''), 'tr');
  const portfoy = () => (D.c?.cekler || []).filter(c => c.yon === 'alinan' && c.kalan > 0.009 && (c.doviz || 'TRL') === 'TRL')
    .sort(alisSira);
  function seciliEvrak() {
    const ayr = ayrilan(), l = portfoy().filter(c => !ayr[c.id]);
    return D.f.secili.map(id => l.find(c => c.id === id)).filter(Boolean).sort(alisSira);
  }
  function pfFiltre() {
    const q = D.pfAra.trim().toLocaleUpperCase('tr'), l = portfoy(), say = { senet: 0, cek: 0, hepsi: l.length };
    for (const c of l) say[EV().senetMi(c) ? 'senet' : 'cek']++;
    const g = l.filter(c => (D.pfTur === 'hepsi' || (D.pfTur === 'senet') === EV().senetMi(c))
      && (!q || [c.kimden, c.seri, evrakAdi(c), String(c.tutar), yaz(c.tutar), trE(c.vade)].join(' ').toLocaleUpperCase('tr').includes(q)));
    return { l: g, say };
  }
  function ciroEksik() {
    const f = D.f, e = [], n = seciliEvrak().length;
    if (!f.kisi) e.push('Evrakların verildiği tedarikçiyi seçin.');
    if (!f.tarih) e.push('Veriliş tarihini seçin.');
    else if (f.tarih > gunEkle(bugun(), 60)) e.push('Tarih çok ileride.');
    if (!n) e.push('Portföyden en az bir evrak seçin.');
    if (n > 60) e.push('Bir bordroya en çok 60 evrak yazılır.');
    return e;
  }
  function pfSatir(c, ayr) {
    const s = D.f.secili.includes(c.id), b = ayr[c.id], n = gunArasi(bugun(), c.vade), ev = EV();
    // senette ödeme süresi: vade (tatilse sonraki iş günü) ve izleyen iki iş günü (views-cek.js CLK.evrak)
    const sd = ev.odemeDurum && ev.senetMi(c) && n <= 0 ? ev.odemeDurum(c) : '';
    const pill = b ? `<span class="pill warn">${esc(b.no)} · ayrıldı</span>` : sd === 'surede' ? `<span class="pill warn">Son gün ${ev.kisaGun(ev.sonGun(c))}</span>` : sd === 'songun' ? '<span class="pill bad">Bugün son gün</span>' : n < 0 ? `<span class="pill bad">${-n} gün geçti</span>` : n === 0 ? '<span class="pill bad">Bugün</span>' : n <= 7 ? `<span class="pill warn">${n} gün</span>` : `<span class="pill off">${n} gün</span>`;
    return `<li><label class="sn-pf-r ${s && !b ? 'secili' : ''} ${b ? 'ayrik' : ''} ${sd === 'surede' ? 'yakin' : n < 0 || sd === 'songun' ? 'gecti' : n <= 7 ? 'yakin' : ''}">
      <input type="checkbox" data-sn-pf="${esc(c.id)}" ${s && !b ? 'checked' : ''} ${b ? 'disabled' : ''} aria-label="${esc((c.kimden || '') + ' ' + tl2(c.tutar))}">
      <div class="cs-vade"><b>${c.vade.slice(8, 10)}</b><small>${AY[+c.vade.slice(5, 7) - 1]} ${c.vade.slice(2, 4)}</small></div>
      <div class="cs-orta"><b>${esc(c.kimden || 'Kişi yok')}</b><small>${esc(evrakAdi(c))} · alış ${dt(c.tarih)}${b ? ` · ${esc(b.no)} ile ${esc(b.kisi)} firmasına verildi, Paraşüt'te ciro bekliyor` : ''}</small></div>
      <div class="cs-sag"><b>${tl2(c.tutar)}</b>${pill}</div></label></li>`;
  }
  function pfListeHtml() {
    if (!D.c) return `<div class="skel" style="height:200px"></div><p class="hint">${D.hata ? esc(D.hata) : 'Paraşüt\'teki portföy okunuyor, yarım dakika sürebilir…'}</p>`;
    const { l } = pfFiltre(), ayr = ayrilan();
    if (!l.length) return `<p class="cs-bos">${portfoy().length ? 'Bu seçimde evrak yok.' : 'Portföyde evrak yok.'}</p>`;
    return `<ul class="sn-pf">${l.slice(0, D.pfGoster).map(c => pfSatir(c, ayr)).join('')}</ul>
      ${l.length > D.pfGoster ? `<div class="ek-dug"><button class="btn sm" data-act="snPfDaha">Daha fazla göster (${num(l.length - D.pfGoster)})</button></div>` : ''}`;
  }
  function pfSecHtml() {
    const s = seciliEvrak(), t = s.reduce((x, c) => x + c.tutar, 0);
    return `<span>${s.length ? `<b>${num(s.length)} evrak seçildi</b> · ${tl2(t)}` : 'Tedarikçiye verilecek evrakları işaretleyin.'}</span>
      <span class="sn-pf-d">${D.c && pfFiltre().l.length ? '<button class="link" data-act="snPfHepsi">Görünenlerin hepsini seç</button>' : ''}${s.length ? '<button class="link" data-act="snPfTemizle">Seçimi temizle</button>' : ''}</span>`;
  }
  const pfYenile = () => {
    const a = $('#snPfListe'); if (a) a.innerHTML = pfListeHtml();
    const b = $('#snPfSec'); if (b) b.innerHTML = pfSecHtml();
    ozetYenile();
  };
  // seçilen tedarikçiye daha önce ciro edilmiş, ödeme süresi dolmamış evraklar ve Paraşüt'e işlenmemiş bordroları
  function ciroKisiNot() {
    const k = D.f.kisi; if (!k || !D.c) return '';
    const ci = (D.c.cekler || []).filter(c => c.yon === 'ciro' && c.kimeId === k.id && sonG(c) >= bugun());
    const bek = (D.c.bordrolar || []).filter(b => b.kisiId === k.id && bordroDurum(b).bekliyor);
    return `<p class="hint sn-acik">${ci.length ? `Bu tedarikçiye ciro edilmiş, ödeme süresi dolmamış ${num(ci.length)} evrak var (${tl(ci.reduce((t, c) => t + c.tutar, 0))}); son vade ${dt(ci.map(c => c.vade).sort().at(-1))}.` : 'Bu tedarikçide ödeme süresi dolmamış ciro evrakı yok.'}${bek.length ? ` Paraşüt'te ciroyu bekleyen bordrosu: ${bek.map(b => esc(b.no)).join(', ')}.` : ''}</p>`;
  }
  function ciroAdimlar() {
    const f = D.f, say = D.c ? pfFiltre().say : { senet: 0, cek: 0, hepsi: 0 }, dun = gunEkle(bugun(), -1);
    return `<div class="gd-adim"><span>2</span><h3>Hangi evraklar?</h3></div>
      <div class="sn-pf-ust">
        <div class="gd-seg" role="group" aria-label="Evrak türü">${[['senet', 'Senetler'], ['cek', 'Çekler'], ['hepsi', 'Hepsi']].map(([k, ad]) => `<button data-act="snPfTur" data-o="${k}" aria-pressed="${D.pfTur === k}">${ad} <b>${num(say[k])}</b></button>`).join('')}</div>
        <input id="snPfAra" type="search" placeholder="Müşteri, no ya da tutar ara" value="${esc(D.pfAra)}" aria-label="Portföyde ara" autocomplete="off">
      </div>
      <div class="sn-pf-sec" id="snPfSec">${pfSecHtml()}</div>
      <div id="snPfListe">${pfListeHtml()}</div>
      <div class="gd-adim"><span>3</span><h3>Tarih ve not</h3></div>
      <div class="gd-tarih">
        <label class="f"><span>Veriliş tarihi</span><input id="snTarih" type="date" value="${esc(f.tarih)}" max="${gunEkle(bugun(), 60)}"></label>
        <div class="gd-hizli"><button class="chip" data-act="snTarihSec" data-g="${bugun()}" aria-pressed="${f.tarih === bugun()}">Bugün</button><button class="chip" data-act="snTarihSec" data-g="${dun}" aria-pressed="${f.tarih === dun}">Dün</button></div>
      </div>
      <label class="f gd-acik"><span>Not (isteğe bağlı)</span><input id="snAciklama" type="text" maxlength="200" autocomplete="off" placeholder="ör. Ekim faturası karşılığı" value="${esc(f.aciklama)}"></label>
      <p class="hint">Not bordroya yazılır. Paraşüt API'si ciroya izin vermediği için ciro Paraşüt'te tedarikçiye ödeme olarak girilir; girilince bu sayfada "Paraşüt'e işlendi" görünür.</p>`;
  }
  function ciroOzetHtml() {
    const f = D.f, l = seciliEvrak(), top = l.reduce((t, c) => t + c.tutar, 0), e = ciroEksik(), ov = ortVade(l, f.tarih);
    const satir = (k, v) => `<div class="gd-oz-s"><span>${k}</span><b>${v}</b></div>`;
    return `<div class="gd-oz-t">${tl2(top)}</div>
      <div class="gd-oz-k">${num(l.length)} evrak <em>tedarikçiye çıkış</em></div>
      ${satir('Verilen', f.kisi ? esc(f.kisi.ad) : 'Seçilmedi')}
      ${satir('Veriliş tarihi', f.tarih ? dt(f.tarih) : '—')}
      ${l.length && ov ? satir('Ortalama vade', `${dt(ov)} · ${num(gunArasi(f.tarih, ov))} gün`) : ''}
      ${l.length ? `<div class="sn-oz-l">${l.map(c => `<div><span>${esc(c.seri || EV().tur(c))}</span><span>${esc(c.kimden || '')} · ${dt(c.vade)}</span><b>${tl2(c.tutar)}</b></div>`).join('')}</div>` : ''}
      ${f.aciklama.trim() ? `<p class="gd-oz-a">“${esc(f.aciklama.trim())}”</p>` : ''}
      ${D.uyari ? `<p class="gd-oz-h">${esc(D.uyari)}</p>` : ''}
      <button class="btn dark gd-kaydet" data-act="snKaydet" ${D.kaydediyor || !D.k || !D.c ? 'disabled' : ''}>${D.kaydediyor ? 'Bordro hazırlanıyor…' : D.onay ? `Evet, ${num(l.length)} evrakı ver, bordroyu hazırla` : 'Çıkış bordrosunu hazırla (Paraşüt\'e yazılmaz)'}</button>
      <p class="gd-oz-n">${D.onay ? 'Evrakları kontrol edip bir kez daha basın.' : e.length && (f.kisi || l.length) ? esc(e[0]) : 'Bordro numaralanır, evraklar bu tedarikçiye ayrılır. Ciroyu ayrıca Paraşüt\'te tedarikçiye ödeme olarak girin.'}</p>`;
  }

  // bordro resmi: tedarikçiye verilen evrakların dökümü, ortalama vade, teslim eden / teslim alan imza yerleri
  function bordroCiz(b) {
    const l = b.evraklar || [], W = 1080, P = 56, SAT = 52, F = "system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";
    const ov = ortVade(l, b.tarih), not = String(b.aciklama || '').trim();
    const H = 600 + (l.length + 1) * SAT + (not ? 44 : 0) + 330;
    const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2;
    const g = cv.getContext('2d'); g.scale(2, 2);
    const yazi = (t, x, y, { b: k = 400, z = 20, r = false, renk = '#1d2433' } = {}) => { g.font = `${k} ${z}px ${F}`; g.fillStyle = renk; g.textAlign = r ? 'right' : 'left'; g.fillText(t, x, y); };
    const kisalt = (t, z, en, k = 400) => { t = String(t || ''); g.font = `${k} ${z}px ${F}`; while (t.length > 4 && g.measureText(t).width > en) t = t.slice(0, -2).trimEnd() + '…'; return t; };
    const kutu = (x, y, w, h, rd, renk, cizgi) => { g.beginPath(); g.roundRect(x, y, w, h, rd); if (renk) { g.fillStyle = renk; g.fill(); } if (cizgi) { g.strokeStyle = cizgi; g.lineWidth = 1.5; g.stroke(); } };
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    yazi('CLK ÇANTA', P, 86, { b: 800, z: 38 });
    yazi('Birlik Mah. 873 Sok. No:2/A Esenler / İstanbul', P, 118, { z: 18, renk: '#5b6475' });
    yazi('0534 077 88 67', P, 144, { z: 18, renk: '#5b6475' });
    yazi('ÇEK / SENET ÇIKIŞ BORDROSU', W - P, 84, { b: 800, z: 25, r: true });
    yazi('Bordro no ' + b.no, W - P, 116, { b: 700, z: 19, r: true });
    yazi('Tarih ' + trE(b.tarih), W - P, 144, { z: 18, r: true, renk: '#5b6475' });
    g.fillStyle = '#1d2433'; g.fillRect(P, 168, W - 2 * P, 4);
    yazi('Teslim alan', P, 214, { z: 17, renk: '#5b6475' });
    yazi(kisalt(b.kisi, 30, W - 2 * P, 800), P, 250, { b: 800, z: 30 });
    kutu(P, 278, W - 2 * P, 104, 14, '#1d2433');
    yazi('Ciro edilerek teslim edilen', P + 30, 322, { z: 20, renk: '#fff' });
    yazi(`çek ve senetler (${l.length} adet)`, P + 30, 352, { z: 20, renk: '#fff' });
    yazi(tlE(b.tutar), W - P - 30, 348, { b: 800, z: 44, r: true, renk: '#fff' });
    const kw = (W - 2 * P - 12) / 2;
    [['Ortalama vade', ov ? `${trE(ov)} · ${gunArasi(b.tarih, ov)} gün` : '—'], ['Vade aralığı', l.length ? `${trE(l[0].vade)} – ${trE(l[l.length - 1].vade)}` : '—']].forEach(([t, v], i) => {
      const x = P + i * (kw + 12);
      kutu(x, 402, kw, 84, 12, null, '#dde2ea');
      yazi(t, x + 18, 434, { z: 16, renk: '#5b6475' });
      yazi(v, x + 18, 468, { b: 700, z: 22 });
    });
    const kol = { n: P + 6, e: P + 52, k: 440, v: 770, t: W - P - 6 };
    let y = 536;
    [['#', kol.n], ['EVRAK', kol.e], ['BORÇLU', kol.k], ['VADE', kol.v]].forEach(([t, x]) => yazi(t, x, y, { b: 700, z: 14, renk: '#5b6475' }));
    yazi('TUTAR', kol.t, y, { b: 700, z: 14, r: true, renk: '#5b6475' });
    g.fillStyle = '#1d2433'; g.fillRect(P, y + 12, W - 2 * P, 3);
    y += 15;
    for (const [i, e] of l.entries()) {
      if (i % 2) { g.fillStyle = '#f7f8fa'; g.fillRect(P, y, W - 2 * P, SAT); }
      const yy = y + 33;
      yazi(String(i + 1), kol.n, yy, { z: 17, renk: '#5b6475' });
      yazi(kisalt(evrakAdi(e), 18, kol.k - kol.e - 20), kol.e, yy, { z: 18 });
      yazi(kisalt(e.kimden || '—', 18, kol.v - kol.k - 20), kol.k, yy, { z: 18 });
      yazi(trE(e.vade), kol.v, yy, { b: 700, z: 18 });
      yazi(tlE(e.tutar), kol.t, yy, { b: 700, z: 18, r: true });
      y += SAT;
    }
    g.fillStyle = '#1d2433'; g.fillRect(P, y + 4, W - 2 * P, 2);
    yazi('TOPLAM', kol.e, y + 40, { b: 800, z: 18 });
    yazi(`${l.length} evrak`, kol.k, y + 40, { z: 18, renk: '#5b6475' });
    yazi(tlE(b.tutar), kol.t, y + 40, { b: 800, z: 20, r: true });
    y += SAT + 10;
    if (not) { yazi(kisalt('Not: ' + not, 18, W - 2 * P), P, y + 24, { z: 18, renk: '#1d2433' }); y += 44; }
    yazi('Yukarıdaki çek ve senetler ciro edilerek teslim edilmiştir.', P, y + 30, { z: 18, renk: '#5b6475' });
    y += 62;
    [['TESLİM EDEN', 'CLK ÇANTA'], ['TESLİM ALAN', b.kisi]].forEach(([t, ad], i) => {
      const x = P + i * (kw + 12);
      kutu(x, y, kw, 190, 12, null, '#dde2ea');
      yazi(t, x + 18, y + 34, { b: 700, z: 14, renk: '#5b6475' });
      yazi(kisalt(ad, 20, kw - 36, 700), x + 18, y + 64, { b: 700, z: 20 });
      yazi('Ad soyad', x + 18, y + 110, { z: 15, renk: '#5b6475' });
      yazi('İmza', x + 18, y + 164, { z: 15, renk: '#5b6475' });
      g.fillStyle = '#c9ced8'; g.fillRect(x + 100, y + 112, kw - 120, 1); g.fillRect(x + 100, y + 166, kw - 120, 1);
    });
    return new Promise(res => cv.toBlob(res, 'image/png'));
  }
  const bordroMetni = b => `CLK Çanta – çek/senet çıkış bordrosu ${b.no}\nSayın ${b.kisi}, ${trE(b.tarih)} tarihinde ciro edilerek teslim edilen evraklar:\n\n`
    + (b.evraklar || []).map((e, i) => `${i + 1}) ${evrakAdi(e)} – ${e.kimden || '?'} – vade ${trE(e.vade)} – ${tlE(e.tutar)}`).join('\n')
    + `\n\nToplam: ${(b.evraklar || []).length} evrak, ${tlE(b.tutar)} · ortalama vade ${trE(ortVade(b.evraklar || [], b.tarih))}${b.aciklama ? '\nNot: ' + b.aciklama : ''}\nCLK Çanta · 0534 077 88 67`;
  let bBlob = null;
  const bordroDosya = () => `bordro-${D.bordro.no}-${String(D.bordro.kisi).toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]+/gi, '-').replace(/^-|-$/g, '')}.png`;
  function bordroAc(b) {
    if (D.bResim) URL.revokeObjectURL(D.bResim);
    D.bordro = b; D.bResim = ''; bBlob = null; D.bIptalOnay = false;
    bordroCiz(b).then(blob => { if (D.bordro !== b) return; bBlob = blob; D.bResim = URL.createObjectURL(blob); ciz(); }).catch(() => toast('Bordro resmi çizilemedi'));
  }
  function bordroIndir() { const a = Object.assign(document.createElement('a'), { href: D.bResim, download: bordroDosya() }); document.body.append(a); a.click(); a.remove(); }
  async function bordroPaylas() {
    if (!bBlob) return;
    const dosya = new File([bBlob], bordroDosya(), { type: 'image/png' });
    try { if (navigator.canShare?.({ files: [dosya] })) { await navigator.share({ files: [dosya], title: D.bordro.no + ' çıkış bordrosu' }); return; } }
    catch (err) { if (err.name === 'AbortError') return; }
    bordroIndir(); toast('Bu cihaz doğrudan paylaşmaya izin vermedi; resim indirildi');
  }
  function bordroYazdir() {
    const w = window.open('', '_blank');
    if (!w) { toast('Yazdırma penceresi açılamadı; resmi indirip yazdırın'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(D.bordro.no)} çıkış bordrosu</title><style>@page{margin:10mm}body{margin:0}img{display:block;width:100%}</style><img src="${D.bResim}" onload="setTimeout(function(){print()},200)">`);
    w.document.close();
  }
  function bordroHtml() {
    const b = D.bordro; if (!b) return '';
    const s = bordroDurum(b), n = (b.evraklar || []).length;
    const durum = b.iptal ? '<small class="gd-kirmizi">Bordro iptal edildi; evraklar yeniden seçilebilir.</small>'
      : s.islendi === n ? '<small>✓ Paraşüt\'e işlendi: evrakların hepsi bu tedarikçiye ciro edilmiş.</small>'
      : `<small>Paraşüt'te ${num(s.islendi)}/${num(n)} evrak ciro edildi.${s.baska ? ` <b class="gd-kirmizi">${num(s.baska)} evrak başka bir tedarikçiye ciro edilmiş.</b>` : ''}${s.kapandi ? ` ${num(s.kapandi)} evrak artık portföyde değil.` : ''}</small>
        <small>Ciroyu Paraşüt'te ${esc(b.kisi)} için ödeme olarak girin: ödeme şekli çek/senet, portföyden bu ${n > 1 ? num(n) + ' evrakı' : 'evrakı'} seçin. Girilince burada "Paraşüt'e işlendi" görünür.</small>`;
    return `<div class="gd-sonuc sn-bordro ${b.iptal || s.baska ? 'kismi' : ''}" role="status">
      <div class="gd-tik">${b.iptal ? '!' : '✓'}</div>
      <div><b>${esc(b.no)} çıkış bordrosu: ${esc(b.kisi)}, ${num(n)} evrak, ${tl2(b.tutar)}</b>
        <div class="sn-sonuc-l">${(b.evraklar || []).map(e => `<span><b>${esc(e.seri || EV().tur(e))}</b>${esc(e.kimden || '')} · ${dt(e.vade)} · ${tl2(e.tutar)}</span>`).join('')}</div>
        ${durum}
        <div class="sn-sonuc-d">
          <button class="btn sm ek-wa" data-act="snBPaylas" ${D.bResim ? '' : 'disabled'}>WhatsApp'ta paylaş</button>
          <button class="btn sm" data-act="snBIndir" ${D.bResim ? '' : 'disabled'}>Resmi indir</button>
          <button class="btn sm" data-act="snBYazdir" ${D.bResim ? '' : 'disabled'}>Yazdır</button>
          <button class="btn sm" data-act="snBMetin">Yazı olarak kopyala</button>
          ${!b.iptal && !s.islendi && !s.baska ? `<button class="btn sm" data-act="snBIptal">${D.bIptalOnay ? 'Evet, bordroyu iptal et' : 'Bordroyu iptal et'}</button>` : ''}
        </div>
        ${D.bResim ? `<div class="ek-on sn-b-on"><img src="${D.bResim}" alt="${esc(b.no)} çıkış bordrosu"></div>` : ''}
      </div>
      <button class="gd-x" data-act="snBKapat" aria-label="Kapat">×</button></div>`;
  }
  async function ciroKaydet() {
    const f = D.f, e = ciroEksik();
    if (e.length) { D.uyari = e[0]; D.onay = false; ciz(); return; }
    if (!D.onay) { D.onay = true; D.uyari = ''; ozetYenile(); setTimeout(() => { if (D.onay && !D.kaydediyor) { D.onay = false; ozetYenile(); } }, 10000); return; }
    D.kaydediyor = true; D.onay = false; D.uyari = ''; D.sonuc = null; ciz();
    const l = seciliEvrak();
    try {
      const r = await yazIstek({ islem: 'ciro', istek: uuid(), kisi: f.kisi.id, tarih: f.tarih, evraklar: l.map(c => c.id), aciklama: f.aciklama.trim() });
      D.f = yeniForm({ yon: 'verilen', tur: 'portfoy', tarih: f.tarih }); dagit(); delete ARA['snKisi_verilen'];
      if (D.c) D.c.bordrolar = [r, ...(D.c.bordrolar || []).filter(x => x.istek !== r.istek)];
      if (D.k) D.k.gecmis = [r, ...(D.k.gecmis || []).filter(x => x.istek !== r.istek)];
      D.kaydediyor = false;
      bordroAc(r); ciz();
      toast(`${r.no} çıkış bordrosu hazırlandı.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      D.uyari = err.message; D.kaydediyor = false; ciz();
      // evrak başkasına ayrılmış ya da portföyden çıkmışsa liste yenilenir
      if (/ayrılmış|portföyde değil|bulunamadı/.test(err.message)) { D.c = null; yukle(true); }
    }
  }
  async function bordroIptal() {
    const b = D.bordro; if (!b) return;
    if (!D.bIptalOnay) { D.bIptalOnay = true; ciz(); return; }
    D.bIptalOnay = false;
    try {
      const r = await sor({ islem: 'ciro_iptal', istek: b.istek });
      D.bordro = { ...b, ...r };
      if (D.c) D.c.bordrolar = (D.c.bordrolar || []).filter(x => x.istek !== b.istek);
      if (D.k) D.k.gecmis = (D.k.gecmis || []).map(x => (x.istek === b.istek && x.islem === 'ciro' ? { ...x, ...r } : x));
      if (S.ui.cs?.v) S.ui.cs.v.bordrolar = (S.ui.cs.v.bordrolar || []).filter(x => x.istek !== b.istek);
      toast(`${b.no} iptal edildi; evraklar yeniden seçilebilir.`);
    } catch (err) { toast(err.message); }
    ciz();
  }

  /* ---------- tahsilat makbuzu: müşteriden alınan senetler için (çizim views-cek.js CLK.makbuz) ---------- */
  let mBlob = null;
  const makbuzVerisi = g => ({ kisi: g.kisi, tarih: g.tarih, evraklar: (g.senetler || []).map(x => ({ seri: x.sira, banka: 'OTHER', bankaAd: 'SENET', vade: x.vade, tutar: x.tutar })) });
  function makbuzAc(g) {
    if (!CLK.makbuz) { toast('Makbuz açılamadı; sayfayı yenileyin'); return; }
    if (D.mResim) URL.revokeObjectURL(D.mResim);
    const m = makbuzVerisi(g);
    D.makbuz = m; D.mResim = ''; mBlob = null;
    CLK.makbuz.ciz(m).then(b => { if (D.makbuz !== m) return; mBlob = b; D.mResim = URL.createObjectURL(b); ciz(); }).catch(() => toast('Makbuz çizilemedi'));
  }
  function makbuzHtml() {
    const m = D.makbuz; if (!m) return '';
    const top = m.evraklar.reduce((t, e) => t + e.tutar, 0);
    return `<div class="gd-sonuc sn-bordro sn-makbuz" role="status">
      <div class="gd-tik">✓</div>
      <div><b>Tahsilat makbuzu: ${esc(m.kisi)}, ${num(m.evraklar.length)} senet, ${tl2(top)}</b>
        <small>Müşteriye WhatsApp'tan gönderin ya da yazdırıp imzalatın.</small>
        <div class="sn-sonuc-d">
          <button class="btn sm ek-wa" data-act="snMPaylas" ${D.mResim ? '' : 'disabled'}>WhatsApp'ta paylaş</button>
          <button class="btn sm" data-act="snMIndir" ${D.mResim ? '' : 'disabled'}>Resmi indir</button>
          <button class="btn sm" data-act="snMYazdir" ${D.mResim ? '' : 'disabled'}>Yazdır</button>
          <button class="btn sm" data-act="snMMetin">Yazı olarak kopyala</button>
        </div>
        ${D.mResim ? `<div class="ek-on sn-b-on"><img src="${D.mResim}" alt="Tahsilat makbuzu: ${esc(m.kisi)}"></div>` : ''}
      </div>
      <button class="gd-x" data-act="snMKapat" aria-label="Kapat">×</button></div>`;
  }

  /* ---------- taksitler ---------- */
  function dagit() {
    const f = D.f, n = Math.min(EN_COK, Math.max(1, Number(f.adet) || 1)), t = para(f.tutar), eski = f.satirlar;
    const kurus = f.mod === 'toplam' ? Math.round(t * 100) : 0;
    const parca = f.mod === 'toplam' ? Math.floor(kurus / n) : 0;
    f.satirlar = Array.from({ length: n }, (_, i) => {
      const vade = !f.ilk ? '' : f.aralik === 'ay' ? ayEkle(f.ilk, i, aySonuMu(f.ilk)) : gunEkle(f.ilk, i * (f.aralik === '15' ? 15 : 7));
      const tu = !t ? '' : f.mod === 'her' ? yaz(t) : yaz((i === n - 1 ? kurus - parca * (n - 1) : parca) / 100);
      return { no: i + 1, vade, tutar: tu, sira: eski[i]?.sira || '' };
    });
  }
  const satirlar = () => D.f.satirlar.map(s => ({ ...s, t: para(s.tutar) }));
  const toplamAdet = () => Math.max(Number(D.f.adet) || 1, ...D.f.satirlar.map(s => s.no));
  // sıra no önizlemesi: boş bırakılanlara sıradaki numaralar verilir (kaydederken sunucu kesinleştirir)
  function siraOnizle() {
    let n = parseInt(String(D.k?.sira || '').replace(/\D/g, ''), 10) || 1;
    return D.f.satirlar.map(s => (s.sira.trim() ? s.sira.trim() : siraMetni(n++)));
  }
  const kisiler = () => (D.f.yon === 'alinan' ? D.k?.musteriler : D.k?.tedarikciler) || [];
  // seçilen kişinin Paraşüt'teki açık senet ve çekleri
  function acikEvrak() {
    const k = D.f.kisi; if (!k || !D.c) return null;
    const l = (D.c.cekler || []).filter(c => D.f.yon === 'alinan' ? c.kimdenId === k.id && c.yon === 'alinan' && c.kalan > 0.009 : c.kimeId === k.id && c.yon === 'verilen' && c.kalan > 0.009);
    const ciro = D.f.yon === 'alinan' ? (D.c.cekler || []).filter(c => c.kimdenId === k.id && c.yon === 'ciro' && sonG(c) >= bugun()) : [];
    return { l, ciro };
  }
  function ayniVar() {
    const k = D.f.kisi; if (!k || !D.c) return [];
    const l = D.c.cekler || [];
    return satirlar().map(s => s.t && s.vade ? l.find(c => (D.f.yon === 'alinan' ? c.kimdenId === k.id && c.yon !== 'verilen' : c.kimeId === k.id && c.yon === 'verilen') && c.vade === s.vade && Math.abs(c.tutar - s.t) < 0.01) : null)
      .map((c, i) => c ? { i, c } : null).filter(Boolean);
  }

  function eksik() {
    const f = D.f, e = [];
    if (!f.kisi) e.push(f.yon === 'alinan' ? 'Senedi veren müşteriyi seçin.' : 'Senedin verildiği tedarikçiyi seçin.');
    if (!f.tarih) e.push('Alış tarihini seçin.');
    else if (f.tarih > gunEkle(bugun(), 60)) e.push('Tarih çok ileride.');
    const l = satirlar();
    if (!l.length) e.push('Senet tutarını ve vadesini girin.');
    l.forEach((s, i) => {
      const ad = l.length > 1 ? `${i + 1}. senedin ` : 'Senedin ';
      if (!s.t) e.push(ad + 'tutarını girin.');
      if (!s.vade) e.push(ad + 'vadesini girin.');
      else if (f.tarih && s.vade < f.tarih) e.push(ad + 'vadesi alış tarihinden önce olamaz.');
    });
    const sira = siraOnizle().map(x => x.toLocaleUpperCase('tr'));
    if (new Set(sira).size !== sira.length) e.push('Aynı sıra no iki senette yazılmış.');
    return e;
  }

  /* ---------- özet (yazdıkça yalnız bu bölüm yenilenir, telefonda klavye kapanmasın) ---------- */
  function ozetHtml() {
    if (ciroMu()) return ciroOzetHtml();
    const f = D.f, l = satirlar(), top = l.reduce((t, s) => t + s.t, 0), e = eksik(), sira = siraOnizle(), ayni = ayniVar();
    const satir = (k, v) => `<div class="gd-oz-s"><span>${k}</span><b>${v}</b></div>`;
    return `<div class="gd-oz-t">${tl2(top)}</div>
      <div class="gd-oz-k">${l.length} senet <em>${f.yon === 'alinan' ? 'müşteriden alınan' : 'tedarikçiye verilen'}</em></div>
      ${satir(f.yon === 'alinan' ? 'Veren' : 'Verilen', f.kisi ? esc(f.kisi.ad) : 'Seçilmedi')}
      ${satir(f.yon === 'alinan' ? 'Alış tarihi' : 'Veriliş tarihi', f.tarih ? dt(f.tarih) : '—')}
      <div class="sn-oz-l">${l.map((s, i) => `<div><span>${esc(sira[i])}</span><span>${s.vade ? dt(s.vade) : 'vade yok'}</span><b>${s.t ? tl2(s.t) : '—'}</b></div>`).join('')}</div>
      ${f.aciklama.trim() ? `<p class="gd-oz-a">“${esc(f.aciklama.trim())}”</p>` : ''}
      ${ayni.length ? `<p class="gd-oz-u">${ayni.map(({ i, c }) => `${l.length > 1 ? i + 1 + '. senet: ' : ''}bu kişide ${dt(c.vade)} vadeli ${tl2(c.tutar)} tutarında bir evrak zaten var${c.seri ? ' (no ' + esc(c.seri) + ')' : ''}.`).join(' ')} İkinci kez girmediğinizden emin olun.</p>` : ''}
      ${D.uyari ? `<p class="gd-oz-h">${esc(D.uyari)}</p>` : ''}
      <button class="btn dark gd-kaydet" data-act="snKaydet" ${D.kaydediyor || !D.k ? 'disabled' : ''}>${D.kaydediyor ? 'Paraşüt\'e kaydediliyor…' : D.onay ? (ayni.length ? 'Evet, yine de kaydet' : `Evet, ${l.length} senedi kaydet`) : (l.length > 1 ? `${l.length} senedi Paraşüt'e kaydet` : 'Senedi Paraşüt\'e kaydet')}</button>
      <p class="gd-oz-n">${D.onay ? 'Bilgileri kontrol edip bir kez daha basın.' : e.length && (f.kisi || para(f.tutar)) ? esc(e[0]) : f.yon === 'alinan' ? 'Senet müşterinin carisinden düşer, sitedeki carisine de tahsilat olarak yazılır.' : 'Senet tedarikçiye ödenecek olarak Paraşüt\'e işlenir.'}</p>`;
  }
  const ozetYenile = () => {
    const o = $('#snOzet'); if (o) o.innerHTML = ozetHtml();
    const p = siraOnizle(); $$('[data-sn-sira]').forEach((el, i) => { el.placeholder = p[i] || ''; });
  };

  function satirHtml() {
    const f = D.f, p = siraOnizle(), cok = f.satirlar.length > 1;
    if (!f.satirlar.length) return '';
    return `<div class="sn-satirlar">${f.satirlar.map((s, i) => `<div class="sn-satir">
      <span class="sn-no" title="Taksit">${cok ? s.no + '/' + toplamAdet() : '1'}</span>
      <label class="f"><span>Sıra no</span><input data-sn-sira="${i}" type="text" maxlength="30" autocomplete="off" placeholder="${esc(p[i])}" value="${esc(s.sira)}"></label>
      <label class="f"><span>Vade</span><input data-sn-vade="${i}" type="date" value="${esc(s.vade)}" min="${esc(f.tarih)}"></label>
      <label class="f"><span>Tutar</span><input data-sn-tutar="${i}" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(s.tutar)}"></label>
    </div>`).join('')}</div>
    <p class="hint">Sıra no boş kalırsa sıradaki numara verilir (${esc(p.find((x, i) => !f.satirlar[i].sira.trim()) || D.k?.sira || 'SN0001')}…). Senedin üstünde başka bir numara yazıyorsa onu yazın.</p>`;
  }
  const satirYenile = () => { const o = $('#snSatirlar'); if (o) o.innerHTML = satirHtml(); ozetYenile(); };

  function sonucHtml() {
    const r = D.sonuc;
    if (!r) return '';
    const s = r.site;
    const siteNot = !s ? '' : s.durum === 'tamam' ? `<small>✓ ${esc(s.mesaj)}</small>` : s.durum === 'bekle' ? `<small>⏳ ${esc(s.mesaj)}</small>` : s.durum === 'yok' ? `<small>${esc(s.mesaj)}</small>` : `<small class="gd-kirmizi">${esc(s.mesaj)}</small>`;
    const kismi = !r.ok || (r.uyari || []).length || r.senetler.some(x => x.uyari?.length) || s?.durum === 'hata';
    return `<div class="gd-sonuc ${kismi ? 'kismi' : ''}" role="status">
      <div class="gd-tik">${r.senetler.length ? '✓' : '!'}</div>
      <div>${r.senetler.length ? `<b>${r.senetler.length} senet Paraşüt'e kaydedildi: ${esc(r.kisi)}, ${tl2(r.toplam)}</b>` : `<b>Senet kaydedilemedi</b>`}
        ${r.senetler.length ? `<div class="sn-sonuc-l">${r.senetler.map(x => `<span><b>${esc(x.sira)}</b> vade ${dt(x.vade)} · ${tl2(x.tutar)}</span>`).join('')}</div>` : ''}
        ${siteNot}
        ${[...(r.uyari || []), ...r.senetler.flatMap(x => (x.uyari || []).map(u => x.sira + ': ' + u))].map(u => `<small class="gd-kirmizi">${esc(u)}</small>`).join('')}
        ${r.hata ? `<small class="gd-kirmizi"><b>${esc(r.hata)}</b>${r.belirsiz ? '' : r.senetler.length ? ' Kaydedilemeyen senetler formda duruyor; kontrol edip tekrar kaydedin.' : ''}</small>` : ''}
        <div class="sn-sonuc-d">${r.yon === 'alinan' && r.senetler.length ? `<button class="btn sm dark" data-act="snMakbuz">Tahsilat makbuzu</button><button class="btn sm" data-act="snRapor" data-ad="${esc(r.kisi)}">Müşteriye vade raporu</button>` : ''}<button class="btn sm" data-go="cek">Çek ve senet sayfası</button></div>
      </div>
      <button class="gd-x" data-act="snSonucKapat" aria-label="Kapat">×</button></div>`;
  }

  // seçilen kişinin portföydeki / ödenmemiş evrakları (Senet gir ve Ödeme gir › Senet)
  function aeHint() {
    const f = D.f, ae = acikEvrak();
    if (!ae) return '';
    return `<p class="hint sn-acik">${ae.l.length ? `${f.yon === 'alinan' ? 'Portföyde bu müşteriden' : 'Bu tedarikçiye verilmiş, ödenmemiş'} ${num(ae.l.length)} evrak var, toplam ${tl(ae.l.reduce((t, c) => t + c.kalan, 0))}; son vade ${dt(ae.l.map(c => c.vade).sort().at(-1))}.` : f.yon === 'alinan' ? 'Portföyde bu müşteriden açık evrak yok.' : 'Bu tedarikçiye verilmiş ödenmemiş evrak yok.'}${ae.ciro.length ? ` Ciro edilmiş, ödeme süresi dolmamış ${num(ae.ciro.length)} evrakı var (${tl(ae.ciro.reduce((t, c) => t + c.tutar, 0))}).` : ''}</p>`;
  }
  // senet sayısı, tutar, vadeler, alış tarihi ve not (Senet gir'de 2. ve 3. adım; Ödeme gir › Senet'te de aynı)
  function adimlarHtml(no = 2) {
    const f = D.f, dun = gunEkle(bugun(), -1);
    const ilkler = [[aySonu(bugun()), 'Bu ay sonu'], [aySonu(ayEkle(bugun(), 1, false)), 'Gelecek ay sonu'], [ayEkle(f.tarih || bugun(), 1, false), '1 ay sonra']];
    return `<div class="gd-adim"><span>${no}</span><h3>Kaç senet, ne kadar?</h3></div>
      <div class="sn-ust">
        <div class="f"><span>Senet sayısı</span><div class="sn-adet"><button data-act="snAdet" data-d="-1" aria-label="Azalt" ${f.adet <= 1 ? 'disabled' : ''}>−</button><b>${f.adet}</b><button data-act="snAdet" data-d="1" aria-label="Artır" ${f.adet >= EN_COK ? 'disabled' : ''}>+</button></div></div>
        ${f.adet > 1 ? `<div class="f"><span>Tutar</span><div class="gd-seg" role="group" aria-label="Tutar nasıl girilecek"><button data-act="snMod" data-o="her" aria-pressed="${f.mod === 'her'}">Her senet</button><button data-act="snMod" data-o="toplam" aria-pressed="${f.mod === 'toplam'}">Toplam, eşit böl</button></div></div>` : ''}
      </div>
      <div class="gd-tutar"><input id="snTutar" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(f.tutar)}" aria-label="${f.adet > 1 && f.mod === 'toplam' ? 'Toplam tutar' : 'Senet tutarı'}"><b>₺</b></div>
      <p class="hint gd-tutar-n">${f.adet > 1 ? (f.mod === 'toplam' ? `Toplam tutarı yazın, ${f.adet} senede eşit bölünür (kuruş farkı son senede).` : `Bir senedin tutarını yazın; ${f.adet} senet aynı tutarda olur. Farklıysa aşağıdan değiştirin.`) : 'Senedin tutarını yazın.'}</p>
      <div class="gd-tarih">
        <label class="f"><span>${f.adet > 1 ? 'İlk vade' : 'Vade'}</span><input id="snIlk" type="date" value="${esc(f.ilk)}" min="${esc(f.tarih)}"></label>
        <div class="gd-hizli">${ilkler.map(([g, ad]) => `<button class="chip" data-act="snIlkSec" data-g="${g}" aria-pressed="${f.ilk === g}">${ad}</button>`).join('')}</div>
      </div>
      ${f.adet > 1 ? `<div class="f"><span>Vadeler arası</span><div class="gd-seg" role="group" aria-label="Vadeler arası"><button data-act="snAralik" data-o="ay" aria-pressed="${f.aralik === 'ay'}">Her ay</button><button data-act="snAralik" data-o="15" aria-pressed="${f.aralik === '15'}">15 günde bir</button><button data-act="snAralik" data-o="hafta" aria-pressed="${f.aralik === 'hafta'}">Her hafta</button></div></div>` : ''}
      <div id="snSatirlar">${satirHtml()}</div>

      <div class="gd-adim"><span>${no + 1}</span><h3>Tarih ve not</h3></div>
      <div class="gd-tarih">
        <label class="f"><span>${f.yon === 'alinan' ? 'Alış tarihi' : 'Veriliş tarihi'}</span><input id="snTarih" type="date" value="${esc(f.tarih)}" max="${gunEkle(bugun(), 60)}"></label>
        <div class="gd-hizli"><button class="chip" data-act="snTarihSec" data-g="${bugun()}" aria-pressed="${f.tarih === bugun()}">Bugün</button><button class="chip" data-act="snTarihSec" data-g="${dun}" aria-pressed="${f.tarih === dun}">Dün</button></div>
      </div>
      <label class="f gd-acik"><span>Not (isteğe bağlı)</span><input id="snAciklama" type="text" maxlength="200" autocomplete="off" placeholder="ör. Ekim cari bakiyesi için" value="${esc(f.aciklama)}"></label>
      <p class="hint">Paraşüt'te açıklamaya "SENET ${f.adet > 1 ? '1/' + f.adet : ''}" ve notunuz yazılır, banka adı SENET olur, sıra no kendiliğinden verilir.</p>`;
  }

  function formHtml() {
    const f = D.f, k = D.k;
    if (!k) return `<div class="card gd-form">${D.hata ? `<p class="msg err">${esc(D.hata)}</p><button class="btn dark" data-act="snYenile">Tekrar dene</button>` : '<div class="skel" style="height:460px"></div>'}</div>`;
    const l = kisiler();
    return `<div class="card gd-form">
      ${makbuzHtml()}${bordroHtml()}${sonucHtml()}
      <div class="gd-adim"><span>1</span><h3>Kimden, kime?</h3></div>
      <div class="gd-seg sn-yon" role="group" aria-label="Senet yönü">
        <button data-act="snYon" data-o="alinan" aria-pressed="${f.yon === 'alinan'}">Müşteriden aldık</button>
        <button data-act="snYon" data-o="verilen" aria-pressed="${f.yon === 'verilen'}">Tedarikçiye verdik</button></div>
      ${f.yon === 'verilen' ? `<div class="gd-seg sn-tur" role="group" aria-label="Tedarikçiye ne verildi">
        <button data-act="snTur" data-o="portfoy" aria-pressed="${f.tur === 'portfoy'}">Portföydeki müşteri evrakı (ciro)</button>
        <button data-act="snTur" data-o="kendi" aria-pressed="${f.tur !== 'portfoy'}">Kendi senedimiz</button></div>
      <p class="sn-tur-n ${f.tur === 'portfoy' ? 'uyar' : 'tamam'}">${f.tur === 'portfoy'
        ? '<b>Paraşüt\'e yazılmaz.</b> Müşteriden aldığımız çek/senetleri tedarikçiye verirken yalnız çıkış bordrosu hazırlar; ciroyu Paraşüt\'te tedarikçiye ödeme olarak ayrıca girin. Yeni, kendi senedimizi verdiysek <b>Kendi senedimiz</b>\'i seçin.'
        : '<b>Paraşüt\'e yazılır.</b> Firmamızın yeni senedi tedarikçiye verilir; sıra no alır, Paraşüt\'te verilen senet olarak açılır.'}</p>` : ''}
      <div class="f ara-alan"><span>${f.yon === 'alinan' ? 'Müşteri' : 'Tedarikçi'}</span>${araKutu('snKisi_' + f.yon, l, f.kisi?.ad || '', 'snKisi', { yer: `Paraşüt ${f.yon === 'alinan' ? 'müşterisi' : 'tedarikçisi'} ara (${l.length})` })}</div>
      ${ciroMu() ? ciroKisiNot() + ciroAdimlar() + '</div>' : ''}${ciroMu() ? '' : `${aeHint()}

      ${adimlarHtml()}
    </div>`}`;
  }

  function bordroLi(g) {
    const e = g.evraklar || [], n = e.length, s = D.c ? bordroDurum(g) : null;
    const pill = g.iptal ? '<span class="pill off">İptal</span>' : !s ? '' : s.islendi === n ? '<span class="pill ok">Paraşüt\'e işlendi</span>'
      : s.baska ? '<span class="pill bad">Başkasına ciro</span>' : `<span class="pill warn">Paraşüt'te ciro bekliyor${s.islendi ? ' ' + num(n - s.islendi) : ''}</span>`;
    return `<li class="sn-g-ciro" data-act="snBordroAc" data-istek="${esc(g.istek)}" role="button" tabindex="0">
      <div class="gd-l-sol"><i class="gd-nokta" style="background:var(--ink)"></i><div><b>${esc(g.kisi)}</b><small>Çıkış bordrosu ${esc(g.no)} · ${num(n)} evrak${n ? ' · vade ' + dt(e[0].vade) + (n > 1 ? '–' + dt(e[n - 1].vade) : '') : ''} · ${dtt(g.zaman)}${g.kim ? ' · ' + esc(String(g.kim).split('@')[0]) : ''}</small></div></div>
      <div class="gd-l-sag"><b>${tl2(g.tutar)}</b>${pill}</div></li>`;
  }

  function sonKart() {
    if (!D.k) return '';
    const l = D.k.gecmis || [];
    const site = g => !g.site ? '' : g.site.durum === 'tamam' ? '<span class="pill ok">Siteye yazıldı</span>' : g.site.durum === 'bekle' ? '<span class="pill warn">Site bekliyor</span>' : g.site.durum === 'hata' ? '<span class="pill bad">Site hatası</span>' : '';
    return `<div class="card gd-son">
      <h3>Panelden girilen senetler ve bordrolar</h3><p class="sub">Bu sayfadan Paraşüt'e girilen senetler ve tedarikçiye çıkış bordroları. Bordroya dokunun, resmi yeniden açılsın. Tüm çek ve senetler Çek ve senet sayfasında.</p>
      ${l.length ? `<ul class="gd-liste">${l.slice(0, D.goster).map(g => { if (g.islem === 'ciro') return bordroLi(g); const s = g.senetler || []; return `<li>
        <div class="gd-l-sol"><i class="gd-nokta" style="background:${g.yon === 'alinan' ? 'var(--ok)' : 'var(--gold)'}"></i><div><b>${esc(g.kisi)}</b><small>${g.yon === 'alinan' ? 'Alınan' : 'Verilen'} · ${num(s.length)} senet${s.length ? ' · ' + esc(s[0].sira) + (s.length > 1 ? '–' + esc(s.at(-1).sira) : '') : ''}${s.length ? ' · vade ' + dt(s[0].vade) + (s.length > 1 ? '–' + dt(s.at(-1).vade) : '') : ''} · ${dtt(g.zaman)}${g.kim ? ' · ' + esc(String(g.kim).split('@')[0]) : ''}</small></div></div>
        <div class="gd-l-sag"><b>${tl2(g.tutar)}</b>${site(g)}${g.hata ? '<span class="pill bad">Yarım</span>' : ''}${g.yon === 'alinan' && s.length && g.istek ? `<button class="btn sm" data-act="snMakbuzAc" data-istek="${esc(g.istek)}">Makbuz</button>` : ''}</div></li>`; }).join('')}</ul>
        ${l.length > D.goster ? `<div class="ek-dug"><button class="btn sm" data-act="snDaha">Daha fazla</button></div>` : ''}` : '<p class="hint">Panelden henüz senet girilmedi.</p>'}
    </div>`;
  }

  views.senet = () => {
    if (!D.k && !D.yuk && !D.hata) yukle();
    if (!D.f.satirlar.length) dagit();
    const acts = `<button class="btn" data-act="snYenile" ${D.yuk ? 'disabled' : ''}>${D.yuk ? 'Okunuyor…' : 'Yenile'}</button>`;
    return `${head('Finans', 'Senet gir', 'Müşteriden alınan ya da tedarikçiye verilen senedi buradan girin; Paraşüt\'e senet olarak işlenir, sıra no kendiliğinden verilir. Portföydeki müşteri evraklarını tedarikçiye çıkış bordrosuyla verin.', acts)}
      ${D.hata && D.k ? `<p class="msg err" style="margin-bottom:14px">${esc(D.hata)}</p>` : ''}
      <div class="gd-ust">
        <div class="gd-sol">${formHtml()}</div>
        <div class="gd-sag"><div class="card gd-ozet" id="snOzet">${ozetHtml()}</div></div>
      </div>
      <div class="gd-alt">${sonKart()}</div>`;
  };

  function bagla() {
    const f = D.f;
    const sifirla = () => { D.onay = false; D.uyari = ''; };
    $('#snTutar')?.addEventListener('input', e => { f.tutar = e.target.value; sifirla(); dagit(); satirYenile(); });
    $('#snTutar')?.addEventListener('blur', e => { const t = para(e.target.value); if (t) { f.tutar = yaz(t); e.target.value = f.tutar; } });
    $('#snAciklama')?.addEventListener('input', e => { f.aciklama = e.target.value; sifirla(); ozetYenile(); });
    $('#snIlk')?.addEventListener('change', e => { f.ilk = e.target.value; sifirla(); dagit(); S.keepScroll = true; render(); });
    $('#snTarih')?.addEventListener('change', e => { f.tarih = e.target.value; sifirla(); S.keepScroll = true; render(); });
    const kutu = $('#snSatirlar');
    kutu?.addEventListener('input', e => {
      const el = e.target, s = f.satirlar[+(el.dataset.snSira ?? el.dataset.snTutar ?? el.dataset.snVade)];
      if (!s) return;
      if ('snSira' in el.dataset) s.sira = el.value; else if ('snTutar' in el.dataset) s.tutar = el.value; else s.vade = el.value;
      sifirla(); ozetYenile();
    });
    const pa = $('#snPfAra');
    pa?.addEventListener('input', () => { clearTimeout(pa.t); pa.t = setTimeout(() => { D.pfAra = pa.value; D.pfGoster = 80; pfYenile(); }, 180); });
    $('#snPfListe')?.addEventListener('change', e => {
      const el = e.target; if (!('snPf' in el.dataset)) return;
      const id = el.dataset.snPf;
      f.secili = el.checked ? [...new Set([...f.secili, id])] : f.secili.filter(x => x !== id);
      el.closest('.sn-pf-r')?.classList.toggle('secili', el.checked);
      sifirla();
      const b = $('#snPfSec'); if (b) b.innerHTML = pfSecHtml();
      ozetYenile();
    });
    kutu?.addEventListener('blur', e => { const el = e.target; if (!('snTutar' in el.dataset)) return; const t = para(el.value), s = f.satirlar[+el.dataset.snTutar]; if (t && s) { s.tutar = yaz(t); el.value = s.tutar; } }, true);
  }
  views.bind_senet = bagla;

  /* Cari hesap › Ödeme gir › "Senet" (celik 02.11.2026: "ödeme sayfasına senet giri de ekler misin"): Ödeme gir formunda müşteri seçilip
     ödeme şekli Senet seçilince Senet gir'in senet sayısı/tutar/vade/tarih adımları ve özeti aynı durumla (S.ui.sn) orada çizilir;
     kayıt Senet gir'deki gibi (gider-cek senet, yon alinan). Müşteri Ödeme gir'deki seçimden gelir. */
  CLK.senetGom = {
    hazir: () => !!D.k,
    html(kisi, no = 2) {
      const f = D.f;
      if (f.yon !== 'alinan') { f.yon = 'alinan'; D.onay = false; }
      if ((kisi?.id || '') !== (f.kisi?.id || '')) { f.kisi = kisi ? { id: kisi.id, ad: kisi.ad } : null; D.onay = false; D.uyari = ''; }
      if (!D.k && !D.yuk && !D.hata) setTimeout(() => yukle(false), 0);
      if (!f.satirlar.length) dagit();
      if (!D.k) return D.hata ? `<p class="msg err">${esc(D.hata)}</p><button class="btn dark" data-act="snYenile">Tekrar dene</button>` : '<p class="hint">Senet bilgileri okunuyor…</p><div class="skel" style="height:220px"></div>';
      return `${makbuzHtml()}${sonucHtml()}${aeHint()}${adimlarHtml(no)}`;
    },
    ozet: () => ozetHtml(),
    bagla
  };
  araSec.snKisi = m => { D.f.kisi = m; D.onay = false; D.uyari = ''; };

  // sitedeki cariye yazım eşitleme yüzünden beklediyse 20 saniyede bir tekrar sorulur
  async function siteBekle(istek) {
    for (let i = 0; i < 15; i++) {
      await bekle(20000);
      if (D.sonuc?.istek !== istek) return;
      try {
        const s = await sor({ islem: 'senet_site', istek });
        if (s.durum !== 'bekle') { D.sonuc.site = s; S.keepScroll = true; render(); if (s.durum === 'tamam') toast('Senet site carisine yazıldı.'); return; }
      } catch { /* bir sonraki denemede */ }
    }
  }

  async function kaydet() {
    if (ciroMu()) return ciroKaydet();
    const f = D.f, e = eksik();
    if (e.length) { D.uyari = e[0]; D.onay = false; S.keepScroll = true; render(); return; }
    if (!D.onay) { D.onay = true; D.uyari = ''; ozetYenile(); setTimeout(() => { if (D.onay && !D.kaydediyor) { D.onay = false; ozetYenile(); } }, 10000); return; }
    D.kaydediyor = true; D.onay = false; D.uyari = ''; D.sonuc = null; S.keepScroll = true; render();
    const l = satirlar(), istek = uuid();
    const govde = { islem: 'senet', istek, yon: f.yon, kisi: f.kisi.id, tarih: f.tarih, adet: toplamAdet(), aciklama: f.aciklama.trim(),
      satirlar: l.map(s => ({ no: s.no, tutar: s.t, vade: s.vade, sira: s.sira.trim() })) };
    try {
      const r = await yazIstek(govde);
      D.sonuc = { ...r, istek };
      if (D.k && r.sira) D.k.sira = r.sira;
      if (r.ok) { D.f = yeniForm({ yon: f.yon, tarih: f.tarih }); dagit(); delete ARA['snKisi_alinan']; delete ARA['snKisi_verilen']; toast(`${r.senetler.length} senet Paraşüt'e kaydedildi.`); }
      // yarım kaldıysa kaydedilenler formdan çıkar, kalanlar durur (tekrar basınca yalnız onlar girilir)
      else if (r.senetler.length) { f.satirlar = f.satirlar.slice(r.senetler.length); if (r.belirsiz) f.satirlar = []; }
      D.kaydediyor = false; S.keepScroll = true; render();
      const kart = $('#thKart');
      if (kart) kart.scrollIntoView({ behavior: 'smooth', block: 'start' }); else window.scrollTo({ top: 0, behavior: 'smooth' });
      if (r.site?.durum === 'tamam' && ['cari', 'musteri'].includes(S.route)) { CLK.loadUsers?.(true); CLK.loadBalance?.(true); }
      // müşteri sayfası Paraşüt hareketlerini yeniden okur
      if (r.senetler?.length) document.dispatchEvent(new CustomEvent('clk:cari', { detail: { musteri: f.kisi?.id } }));
      if (r.site?.durum === 'bekle') siteBekle(istek);
      // liste ve sıra no yenilenir
      D.c = null; yukle(false);
    } catch (err) {
      D.uyari = err.message; D.kaydediyor = false; S.keepScroll = true; render();
    }
  }

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    const f = D.f;
    if (act === 'snYenile') { D.hata = ''; yukle(true); }
    else if (act === 'snYon') { if (f.yon !== el.dataset.o) { f.yon = el.dataset.o; f.kisi = null; } D.onay = false; D.uyari = ''; ciz(); }
    else if (act === 'snTur') { f.tur = el.dataset.o; D.onay = false; D.uyari = ''; ciz(); }
    else if (act === 'snPfTur') { D.pfTur = el.dataset.o; D.pfGoster = 80; ciz(); }
    else if (act === 'snPfDaha') { D.pfGoster += 100; pfYenile(); }
    else if (act === 'snPfHepsi') {
      const ayr = ayrilan(), hepsi = [...new Set([...f.secili, ...pfFiltre().l.filter(c => !ayr[c.id]).map(c => c.id)])];
      if (hepsi.length > 60) toast('Bir bordroya en çok 60 evrak yazılır; ilk 60 seçildi');
      f.secili = hepsi.slice(0, 60); D.onay = false;
      pfYenile();
    }
    else if (act === 'snPfTemizle') { f.secili = []; D.onay = false; pfYenile(); }
    else if (act === 'snBordroAc') {
      const g = [...(D.c?.bordrolar || []), ...(D.k?.gecmis || [])].find(x => x.islem === 'ciro' && x.istek === el.dataset.istek);
      if (g) { bordroAc(g); ciz(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }
    else if (act === 'snBKapat') { if (D.bResim) URL.revokeObjectURL(D.bResim); D.bordro = null; D.bResim = ''; bBlob = null; ciz(); }
    else if (act === 'snBPaylas') bordroPaylas();
    else if (act === 'snBIndir') { if (D.bResim) { bordroIndir(); toast('Resim indirildi'); } }
    else if (act === 'snBYazdir') { if (D.bResim) bordroYazdir(); }
    else if (act === 'snBMetin') {
      const t = bordroMetni(D.bordro);
      (navigator.clipboard?.writeText(t) || Promise.reject()).then(() => toast('Bordro yazısı kopyalandı; WhatsApp\'a yapıştırabilirsiniz')).catch(() => { window.prompt('Yazıyı kopyalayın:', t); });
    }
    else if (act === 'snBIptal') bordroIptal();
    else if (act === 'snMakbuz') { if (D.sonuc?.senetler?.length) { makbuzAc({ kisi: D.sonuc.kisi, tarih: D.sonuc.tarih, senetler: D.sonuc.senetler }); ciz(); } }
    else if (act === 'snMakbuzAc') {
      const g = (D.k?.gecmis || []).find(x => x.islem === 'senet' && x.istek === el.dataset.istek);
      if (g) { makbuzAc(g); ciz(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }
    else if (act === 'snMKapat') { if (D.mResim) URL.revokeObjectURL(D.mResim); D.makbuz = null; D.mResim = ''; mBlob = null; ciz(); }
    else if (act === 'snMPaylas') { if (mBlob) CLK.belge.paylas(mBlob, D.mResim, CLK.makbuz.dosya(D.makbuz), 'Tahsilat makbuzu'); }
    else if (act === 'snMIndir') { if (D.mResim) { CLK.belge.indir(D.mResim, CLK.makbuz.dosya(D.makbuz)); toast('Resim indirildi'); } }
    else if (act === 'snMYazdir') { if (D.mResim) CLK.belge.yazdir(D.mResim, 'Tahsilat makbuzu – ' + D.makbuz.kisi); }
    else if (act === 'snMMetin') { if (D.makbuz) CLK.belge.kopyala(CLK.makbuz.metin(D.makbuz), 'Makbuz'); }
    else if (act === 'snAdet') { f.adet = Math.min(EN_COK, Math.max(1, f.adet + Number(el.dataset.d))); if (f.adet === 1) f.mod = 'her'; D.onay = false; dagit(); ciz(); }
    else if (act === 'snMod') { f.mod = el.dataset.o; D.onay = false; dagit(); ciz(); }
    else if (act === 'snAralik') { f.aralik = el.dataset.o; D.onay = false; dagit(); ciz(); }
    else if (act === 'snIlkSec') { f.ilk = el.dataset.g; D.onay = false; dagit(); ciz(); }
    else if (act === 'snTarihSec') { f.tarih = el.dataset.g; D.onay = false; ciz(); }
    else if (act === 'snKaydet') kaydet();
    else if (act === 'snSonucKapat') { D.sonuc = null; ciz(); }
    else if (act === 'snDaha') { D.goster += 30; ciz(); }
    else if (act === 'snRapor') {
      // Çek ve senet sayfasındaki müşteri vade raporu bu müşteriyle açılır
      const cs = S.ui.cs;
      if (cs) { cs.rm = el.dataset.ad; cs.rResim = ''; cs.rDurum = ''; cs.rHazir = false; cs.v = null; }
      delete ARA.csRm;
      go('cek');
      setTimeout(() => $('#csRapor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 900);
    }
    else prevAct?.(act, el, e);
  };
})();
