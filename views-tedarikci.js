/* CLK Yönetim — Tedarikçiler (celik 07.11.2026: "bu tedarikçiler için de bakiye tutacağımız detaylı bir form hazırlar mısın. perakende harici.
   aylık mal alımı yıllık alım evraklar detaylı rapor").
   Paraşüt'teki tedarikçilerin carisi, bütün işlem geçmişi (Paraşüt'ün yürüyen bakiyesiyle), aylık ve yıllık alımları, verdiğimiz ve ciro ettiğimiz
   çek/senetler. Sunucu gider-cek tedarikciler / tedarikci (yalnız okur, Paraşüt'e yazmaz). Perakende firmaları (alışı BenimPOS'ta olan mağaza firmaları) gizlenir.
   İşaret bizim açımızdan: bakiye artı = borcumuz (Paraşüt'te eksi görünür), eksi = fazla ödeme / avans.
   Ödenecek toplam = cari borç + verdiğimiz, henüz ödenmemiş çek ve senetler (evrak verilince cari kapanır ama para vadesinde çıkar).
   Detaylı rapor A4 PDF (yazdır, indir, WhatsApp): iç rapor ya da tedarikçiye gönderilecek mutabakat. */
(() => {
  const { sb, S, $, esc, tl, tl2, dt, num, toast, head, views, render, skel } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/gider-cek';
  const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const AY_UZUN = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const T = (S.ui.td ||= { v: null, yuk: false, hata: '', deneme: 0, q: '', f: 'hepsi', s: 'odenecek', per: false, tablo: '', d: {}, tab: 'ozet', donem: '365', tur: 'hepsi', yil: '', ay: '', rp: null, kapali: false });
  const bugun = () => new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);
  const gunEkle = (g, n) => new Date(Date.parse(g + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const gunFark = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
  const bekle = ms => new Promise(r => setTimeout(r, ms));
  const r2 = n => Math.round(n * 100) / 100;
  const top = (l, f) => r2(l.reduce((s, x) => s + (Number(f(x)) || 0), 0));
  const ciz = () => { if (S.route === 'tedarikciler') { S.keepScroll = true; render(); } };
  const ayKaydir = (a, n) => new Date(Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 7);
  const ayAd = k => AY[+k.slice(5, 7) - 1] + (k.slice(0, 4) !== bugun().slice(0, 4) ? " '" + k.slice(2, 4) : '');
  const ayUzun = k => AY_UZUN[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4);
  const sonGun = e => CLK.evrak?.sonGun ? CLK.evrak.sonGun(e) : e.vade;
  const senetMi = e => CLK.evrak?.senetMi ? CLK.evrak.senetMi(e) : /senet/i.test(e.bankaAd || '');
  const kalanGun = v => v ? gunFark(bugun(), v) : null;
  // borcumuz artı; fazla ödeme (avans) yeşil yazılır
  const bakYaz = b => b < -0.005 ? `<span class="mh-fazla">${tl2(-b)} avans</span>` : tl2(b);

  async function sor(govde) {
    const { data } = await sb.auth.getSession();
    let r, j;
    for (let i = 0; ; i++) {
      r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) });
      j = await r.json().catch(() => ({}));
      // Paraşüt aynı anda gelen isteklere 429 veriyor: birkaç saniye arayla yeniden denenir
      if (i < 3 && /429|too many|yanıt vermedi/i.test(String(j?.hata || ''))) { await bekle(2500 * (i + 1)); continue; }
      break;
    }
    if (r.status === 400 && /Bilinmeyen işlem/.test(j?.hata || '')) throw new Error('Tedarikçi sayfası için sunucu güncellemesi bekleniyor.');
    if (!r.ok || j?.hata) throw new Error(j?.hata || 'Sunucu ' + r.status);
    return j;
  }

  // liste: sunucu 15 dk saklar; ilk tarama ve 6 saatlik tam tarama arka planda sürer, bu sırada eski liste (ya da boş) gelir, panel 25 sn sonra yeniden sorar
  let yeniden = 0;
  async function yukle(yenile) {
    if (T.yuk) return;
    T.yuk = true; T.hata = ''; T.at = Date.now(); ciz();
    try {
      const j = await sor({ islem: 'tedarikciler', yenile: !!yenile });
      if (j.liste?.length || !T.v) T.v = j;
      T.bekliyor = !!(j.eski || j.hazirlaniyor);
      clearTimeout(yeniden);
      if (T.bekliyor && T.deneme < 16) { T.deneme++; yeniden = setTimeout(() => { if (S.route === 'tedarikciler') yukle(false); }, 25000); }
      else T.deneme = 0;
    } catch (e) { T.hata = e.message; }
    T.yuk = false; ciz();
  }
  async function detayYukle(id, yenile) {
    const d = T.d[id] ||= { v: null, yuk: false, hata: '' };
    if (d.yuk) return;
    d.yuk = true; d.hata = ''; ciz();
    try { d.v = await sor({ islem: 'tedarikci', id, yenile: !!yenile }); d.zaman = Date.now(); }
    catch (e) { d.hata = e.message; }
    d.yuk = false; ciz();
  }

  /* ---------- hesaplar ---------- */
  // ay dizisi: [alış, alış iadesi, kasa/banka ödemesi, verilen kendi evrakımız, ciro edilen müşteri evrakı, tedarikçiye satış, diğer]
  const alisNet = v => v ? r2(v[0] - v[1]) : 0;
  const odemeTop = v => v ? r2(v[2] + v[3] + v[4]) : 0;
  function evrakHesap(ev, bordro) {
    const kendi = ev.filter(e => e.yon === 'verilen' && e.kalan > 0.009).sort((a, b) => (a.vade || '').localeCompare(b.vade || ''));
    const ciro = ev.filter(e => e.yon === 'ciro' && sonGun(e) >= bugun()).sort((a, b) => (a.vade || '').localeCompare(b.vade || ''));
    // panelde çıkış bordrosu hazırlanıp Paraşüt'te henüz ciro edilmemiş (hâlâ portföyde) müşteri evrakı: işlenince cari borç bu kadar düşer
    const bekleyen = (bordro || []).flatMap(b => (b.evraklar || []).filter(e => e.bekliyor).map(e => ({ ...e, no: b.no, btarih: b.tarih })));
    return { kendi, ciro, bekleyen, kendiT: top(kendi, e => e.kalan), ciroT: top(ciro, e => e.tutar), bekT: top(bekleyen, e => e.tutar), yakin: kendi[0]?.vade || '' };
  }
  function satirHesap(x) {
    const e = evrakHesap(x.evrak || [], x.bordro), ay = x.ay || {}, b = bugun(), yil = b.slice(0, 4), ayNo = b.slice(5, 7);
    const yilTop = y => r2(Object.entries(ay).filter(([k]) => k.startsWith(y)).reduce((s, [, v]) => s + alisNet(v), 0));
    const gecenAyni = r2(Object.entries(ay).filter(([k]) => k.startsWith(String(+yil - 1)) && k.slice(5, 7) <= ayNo).reduce((s, [, v]) => s + alisNet(v), 0));
    const son = [x.sonAlis && [x.sonAlis[0], 'Alış', x.sonAlis[1]], x.sonOdeme && [x.sonOdeme[0], x.sonOdeme[2], x.sonOdeme[1]]].filter(Boolean).sort((p, q) => q[0].localeCompare(p[0]))[0] || null;
    return { x, ...e, bakiye: Number(x.bakiye) || 0, odenecek: r2((Number(x.bakiye) || 0) + e.kendiT), buAy: alisNet(ay[b.slice(0, 7)]), gecenAy: alisNet(ay[ayKaydir(b.slice(0, 7), -1)]),
      buYil: yilTop(yil), gecenYil: yilTop(String(+yil - 1)), gecenAyni, son };
  }
  const gorunur = () => (T.v?.liste || []).filter(x => (T.per || !x.perakende) && !(x.arsiv && Math.abs(x.bakiye) < 0.5));
  const perakendeler = () => (T.v?.liste || []).filter(x => x.perakende);

  // tedarikçi hareketlerinden: borç ilk giren ilk kapanır sırasıyla ödemelere eşlenir (müşteri özetindeki gibi, yön tersi)
  const odemeMi = x => ['contact_debit', 'check_out'].includes(x.tur);
  const alisMi = x => x.tur === 'purchase_bill' && x.tutar > 0;
  const YAS = [[30, '0–30 gün'], [60, '31–60 gün'], [90, '61–90 gün'], [Infinity, '90 günden eski']];
  const YAS_RENK = ['#f1c48e', '#e08b3e', '#bb5a1f', '#842f10'];
  function analiz(l) {
    const bg = bugun(), yb = gunEkle(bg, -365);
    const en = l.at(-1), acilis = en ? r2(en.b - en.tutar) : 0;
    const kuyruk = []; let kredi = 0, agir = 0, agirV = 0, odenen = 0;
    if (acilis > 0.005) kuyruk.push({ t: '', k: acilis }); else if (acilis < -0.005) kredi = -acilis;
    for (let i = l.length - 1; i >= 0; i--) {
      const x = l[i];
      if (x.tutar > 0.005) { const m = Math.min(kredi, x.tutar); kredi -= m; if (x.tutar - m > 0.005) kuyruk.push({ t: x.t, k: x.tutar - m }); }
      else if (x.tutar < -0.005) {
        let p = -x.tutar;
        // evrakla ödemede paranın çıktığı gün vadedir ("vadesiyle")
        const ot = x.c?.vade && x.c.vade > x.t ? x.c.vade : x.t;
        while (p > 0.005 && kuyruk.length) {
          const q = kuyruk[0], m = Math.min(q.k, p);
          if (q.t && odemeMi(x) && x.t >= yb) { agir += m * Math.max(0, gunFark(q.t, x.t)); agirV += m * Math.max(0, gunFark(q.t, ot)); odenen += m; }
          q.k -= m; p -= m;
          if (q.k <= 0.005) kuyruk.shift();
        }
        if (p > 0.005) kredi += p;
      }
    }
    const yas = YAS.map(([, ad]) => ({ ad, t: 0 }));
    for (const q of kuyruk) { const g = q.t ? gunFark(q.t, bg) : Infinity; yas[YAS.findIndex(([s]) => g <= s)].t += q.k; }
    const enEski = kuyruk.find(q => q.k > 0.005);
    const yil = l.filter(x => x.t >= yb);
    const faturalar = l.filter(x => alisMi(x) && x.f && x.f.kalan > 0.009 && x.f.it !== 'cancelled');
    return {
      acik: r2(kuyruk.reduce((a, q) => a + q.k, 0)), kredi: r2(kredi), yas,
      enEski: enEski ? { t: enEski.t, gun: enEski.t ? gunFark(enEski.t, bg) : null } : null,
      ort: odenen > 0.5 ? Math.round(agir / odenen) : null, ortV: odenen > 0.5 ? Math.round(agirV / odenen) : null,
      alim: top(yil.filter(alisMi), x => x.tutar), alimN: yil.filter(alisMi).length,
      iade: top(yil.filter(x => x.tur === 'purchase_bill' && x.tutar < 0), x => -x.tutar),
      odeme: top(yil.filter(odemeMi), x => -x.tutar),
      acikFat: { n: faturalar.length, t: top(faturalar, x => x.f.kalan), eski: faturalar.map(x => x.t).sort()[0] || '' },
      sonAlis: l.find(alisMi) || null, sonOdeme: l.find(odemeMi) || null
    };
  }
  // ay ay döküm (hareketlerden): Paraşüt'ün aylık toplamları ve ay sonu borcu
  function aylik(l) {
    const m = {};
    for (const x of l) {
      if (!x.t) continue;
      const k = x.t.slice(0, 7), v = (m[k] ||= { alis: 0, iade: 0, nakit: 0, evrak: 0, ciro: 0, satis: 0, diger: 0, n: 0, son: null });
      if (x.tur === 'purchase_bill') { if (x.tutar >= 0) { v.alis += x.tutar; v.n++; } else v.iade -= x.tutar; }
      else if (x.tur === 'contact_debit') v.nakit -= x.tutar;
      else if (x.tur === 'check_out') { if (x.c?.ciro) v.ciro -= x.tutar; else v.evrak -= x.tutar; }
      else if (x.tur === 'sales_invoice') v.satis -= x.tutar;
      else v.diger += x.tutar;
      // liste yeniden eskiye: ayın ilk görülen satırı ay sonundaki bakiye
      if (v.son === null) v.son = x.b;
    }
    for (const v of Object.values(m)) for (const k of ['alis', 'iade', 'nakit', 'evrak', 'ciro', 'satis', 'diger']) v[k] = r2(v[k]);
    return m;
  }
  function aySonu(l, k) {
    // ay sonu borcu: o ayın son hareketi, yoksa önceki son hareket; hiç hareket yoksa açılıştan önceki 0
    const x = l.find(y => y.t && y.t.slice(0, 7) <= k);
    if (x) return x.b;
    const en = l.at(-1);
    return en ? r2(en.b - en.tutar) : 0;
  }

  /* ---------- hareket satırları ---------- */
  const turAd = x => ({
    purchase_bill: x.tutar >= 0 ? 'Alış faturası' : 'Alış iadesi', contact_debit: 'Ödeme', contact_credit: 'Tedarikçiden gelen para',
    check_out: x.c?.ciro ? (x.c?.senet ? 'Ciro edilen senet' : 'Ciro edilen çek') : (x.c?.senet ? 'Verilen senet' : 'Verilen çek'),
    check_in: x.c?.senet ? 'Alınan senet' : 'Alınan çek', sales_invoice: x.tutar < 0 ? 'Satış faturası' : 'Satış iadesi',
    opening_balance: 'Açılış bakiyesi', contact_transfer: 'Cari virman'
  }[x.tur] || (x.tutar > 0 ? 'Borç kaydı' : 'Alacak kaydı'));
  const bankaAd = c => !c ? '' : c.senet ? '' : CLK.evrak?.banka ? CLK.evrak.banka({ banka: c.banka, bankaAd: c.bankaAd, seri: c.seri }) : c.bankaAd;
  const aciklama = x => {
    if (x.c) return [bankaAd(x.c), x.c.seri ? 'No ' + x.c.seri : '', x.c.vade ? 'vade ' + dt(x.c.vade) : '', x.ack].filter(Boolean).join(' · ');
    if (x.f) return [x.f.no, x.f.ack || x.oto || x.ack].filter(Boolean).join(' · ');
    if (x.s) return [x.s.no, x.oto || x.ack].filter(Boolean).join(' · ');
    return [x.hesap, x.ack || x.oto].filter(Boolean).join(' · ');
  };
  const ikon = x => x.tur === 'purchase_bill' ? (x.tutar >= 0 ? '▤' : '↺') : x.c ? '▭' : x.tur === 'contact_debit' ? '₺' : x.tutar < 0 ? '↘' : '↗';
  function satirHtml(x) {
    const pill = alisMi(x) && x.f && x.f.kalan > 0.009 ? `<span class="pill ${x.f.kalan < x.tutar - 0.005 ? 'warn' : 'bad'}">${x.f.kalan < x.tutar - 0.005 ? 'Kalan ' + tl2(x.f.kalan) : 'Ödenmedi'}</span>` : '';
    return `<li class="mh-s${alisMi(x) ? ' fat' : ''}"><div class="mh-sb">
      <span class="mh-ik" aria-hidden="true">${ikon(x)}</span>
      <span class="mh-tur"><b>${esc(turAd(x))}</b>${pill}</span>
      <span class="mh-ack">${esc(aciklama(x))}</span>
      <span class="mh-t">${dt(x.t)}</span>
      <b class="mh-tt num ${x.tutar < 0 ? 'pos' : ''}">${x.tutar < 0 ? '−' : ''}${tl2(Math.abs(x.tutar))}</b>
      <span class="mh-b num">${bakYaz(x.b)}</span></div></li>`;
  }
  const BASLIK = '<li class="mh-th"><span></span><span>İşlem</span><span>Açıklama</span><span>Tarih</span><span class="r">Tutar</span><span class="r">Borcumuz</span></li>';

  /* ---------- liste sayfası ---------- */
  const SIRA = [['odenecek', 'Ödenecek'], ['yil', 'Bu yıl alım'], ['ay', 'Bu ay alım'], ['son', 'Son hareket'], ['ad', 'Ad']];
  const FILTRE = [['hepsi', 'Hepsi'], ['borc', 'Borcumuz olan'], ['evrak', 'Evrakı olan'], ['avans', 'Avans / alacak'], ['ay', 'Bu ay alım yapılan']];
  function liste() {
    const R = gorunur().map(satirHesap), q = T.q.trim().toLocaleLowerCase('tr');
    let L = R.filter(r => {
      if (T.f === 'borc' && !(r.bakiye > 0.5)) return false;
      if (T.f === 'evrak' && !(r.kendi.length || r.ciro.length)) return false;
      if (T.f === 'avans' && !(r.bakiye < -0.5)) return false;
      if (T.f === 'ay' && !(r.buAy > 0.5)) return false;
      return !q || [r.x.ad, r.x.tel].join(' ').toLocaleLowerCase('tr').includes(q);
    });
    const ad = (a, b) => a.x.ad.localeCompare(b.x.ad, 'tr');
    L.sort(T.s === 'ad' ? ad : T.s === 'yil' ? (a, b) => b.buYil - a.buYil || ad(a, b) : T.s === 'ay' ? (a, b) => b.buAy - a.buAy || ad(a, b)
      : T.s === 'son' ? (a, b) => (b.son?.[0] || '').localeCompare(a.son?.[0] || '') || ad(a, b) : (a, b) => b.odenecek - a.odenecek || ad(a, b));
    return { R, L };
  }
  const once = g => g === null || g === undefined ? '' : g <= 0 ? 'bugün' : g === 1 ? 'dün' : g + ' gün önce';
  function listeSatir(r) {
    const ev = r.kendi.length ? `<b class="num">${tl(r.kendiT)}</b><small>${num(r.kendi.length)} evrak · ilk vade ${dt(r.yakin)}</small>` : '<b>—</b><small>ödenmemiş evrak yok</small>';
    const son = r.son ? `<b>${dt(r.son[0])}</b><small>${once(gunFark(r.son[0], bugun()))} · ${esc(r.son[1])} ${tl(r.son[2])}</small>` : '<b>—</b>';
    const durum = r.bakiye > 0.5 ? 'Borcumuz' : r.bakiye < -0.5 ? 'Avans / alacak' : 'Kapalı';
    return `<li class="td-tr" data-act="tdAc" data-id="${esc(r.x.id)}" role="button" tabindex="0">
      <div class="k"><b>${esc(r.x.ad)}${r.x.perakende ? ' <span class="pill off">Perakende</span>' : ''}${r.x.arsiv ? ' <span class="pill off">Arşivde</span>' : ''}</b><small>${r.x.hata ? `<span class="cz-gec">Okunamadı: ${esc(r.x.hata)}</span>` : esc(r.x.tel || (r.x.adet ? num(r.x.adet) + ' hareket' : 'Hareket yok'))}</small></div>
      <div class="b"><span class="m">Cari</span><b class="num ${r.bakiye > 0.5 ? 'neg' : r.bakiye < -0.5 ? 'pos' : ''}">${tl(Math.abs(r.bakiye))}</b><small>${durum}</small></div>
      <div class="e"><span class="m">Verdiğimiz evrak</span>${ev}</div>
      <div class="o"><span class="m">Ödenecek</span><b class="num">${tl(Math.max(0, r.odenecek))}</b><small>${r.odenecek < -0.5 ? tl(-r.odenecek) + ' fazla' : r.ciroT > 0.5 ? 'ciro riski ' + tl(r.ciroT) : 'cari + evrak'}</small></div>
      <div class="y"><span class="m">Alım</span><b class="num">${tl(r.buYil)}</b><small>bu ay ${tl(r.buAy)}</small></div>
      <div class="h"><span class="m">Son hareket</span>${son}</div>
    </li>`;
  }
  // bütün tedarikçilerin son 12 ayı: alış ve ödeme (cari düşen: nakit, kendi evrakımız, ciro)
  function toplamAylar(R) {
    const bas = ayKaydir(bugun().slice(0, 7), -11);
    return Array.from({ length: 12 }, (_, i) => {
      const k = ayKaydir(bas, i);
      const s = top(R, r => alisNet(r.x.ay?.[k])), o = top(R, r => odemeTop(r.x.ay?.[k]));
      const enCok = R.map(r => [r.x.ad, alisNet(r.x.ay?.[k])]).filter(([, t]) => t > 0.5).sort((a, b) => b[1] - a[1]).slice(0, 3);
      return { k, ad: ayAd(k).split(' ')[0], uzun: ayUzun(k), s, o, enCok };
    });
  }
  const tavan = n => { if (n <= 0) return 1; const p = 10 ** Math.floor(Math.log10(n)), f = n / p; return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(k => f <= k + 1e-9)) * p; };
  const kisa = n => n >= 1e6 ? (n / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + ' Mn' : n >= 1e3 ? (n / 1e3).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' B' : String(Math.round(n));
  // tek eksen, iki dizi (Alış, Ödeme); aya dokununca altında rakamlar
  function grafik(l, act, ek = () => '') {
    const max = Math.max(...l.map(a => Math.max(a.s, a.o)));
    if (max <= 0) return '<p class="sub">Son 12 ayda alış ya da ödeme yok.</p>';
    const tp = tavan(max), h = n => n > 0 ? Math.max(1.5, n / tp * 100).toFixed(1) : 0;
    const sec = l.find(a => a.k === T.ay) || [...l].reverse().find(a => a.s > 0 || a.o > 0) || l.at(-1);
    return `<div class="mo-gr-w td-gr">
      <div class="mo-lej" aria-hidden="true"><span><i class="s"></i>Alış</span><span><i class="o"></i>Ödeme</span></div>
      <div class="mo-gr"><div class="mo-y" aria-hidden="true"><span style="bottom:100%">${kisa(tp)}</span><span style="bottom:50%">${kisa(tp / 2)}</span><span style="bottom:0">0</span></div>
        <div class="mo-cols">${l.map(a => `<button class="mo-ay${a === sec ? ' on' : ''}" data-act="${act}" data-k="${a.k}" aria-pressed="${a === sec}" aria-label="${esc(a.uzun)}: alış ${tl(a.s)}, ödeme ${tl(a.o)}" title="${esc(a.uzun)}&#10;Alış ${tl(a.s)}&#10;Ödeme ${tl(a.o)}"><span class="mo-cub"><i class="s" style="height:${h(a.s)}%"></i><i class="o" style="height:${h(a.o)}%"></i></span><small>${esc(a.ad)}</small></button>`).join('')}</div></div>
      <p class="mo-oku"><b>${esc(sec.uzun)}</b><span><i class="s"></i>Alış <b class="num">${tl(sec.s)}</b></span><span><i class="o"></i>Ödeme <b class="num">${tl(sec.o)}</b></span>${ek(sec)}</p>
    </div>`;
  }
  // alım tablosu: tedarikçi × ay (seçili yıl) ya da tedarikçi × yıl
  function alimTablosu(R) {
    const yillar = [...new Set(R.flatMap(r => Object.keys(r.x.ay || {}).map(k => k.slice(0, 4))))].sort().reverse();
    if (!yillar.length) return '';
    const sec = T.tablo && (T.tablo === 'yillar' || yillar.includes(T.tablo)) ? T.tablo : yillar[0];
    const chips = `<div class="chips td-ch" role="group" aria-label="Alım tablosu">${yillar.map(y => `<button class="chip sm" data-act="tdTablo" data-k="${y}" aria-pressed="${sec === y}">${y}</button>`).join('')}${yillar.length > 1 ? `<button class="chip sm" data-act="tdTablo" data-k="yillar" aria-pressed="${sec === 'yillar'}">Yıllara göre</button>` : ''}</div>`;
    let kol, deger;
    if (sec === 'yillar') { kol = yillar.slice().reverse().map(y => [y, y]); deger = (r, y) => r2(Object.entries(r.x.ay || {}).filter(([k]) => k.startsWith(y)).reduce((s, [, v]) => s + alisNet(v), 0)); }
    else { kol = AY.map((a, i) => [sec + '-' + String(i + 1).padStart(2, '0'), a]); deger = (r, k) => alisNet(r.x.ay?.[k]); }
    const satirlar = R.map(r => ({ r, d: kol.map(([k]) => deger(r, k)) })).map(s => ({ ...s, t: r2(s.d.reduce((a, b) => a + b, 0)) })).filter(s => s.t > 0.5).sort((a, b) => b.t - a.t);
    if (!satirlar.length) return `${chips}<p class="sub">${sec === 'yillar' ? '' : sec + ' yılında '}alış yok.</p>`;
    const toplamlar = kol.map((_, i) => top(satirlar, s => s.d[i])), genel = top(satirlar, s => s.t);
    const h = v => v > 0.5 ? kisa(v) : '<span class="td-0">·</span>';
    return `${chips}<div class="tbl-wrap"><table class="tbl td-at"><thead><tr><th>Tedarikçi</th>${kol.map(([, a]) => `<th class="r">${a}</th>`).join('')}<th class="r">Toplam</th></tr></thead>
      <tbody>${satirlar.map(s => `<tr class="row" data-act="tdAc" data-id="${esc(s.r.x.id)}"><td>${esc(s.r.x.ad)}</td>${s.d.map((v, i) => `<td class="r num" title="${esc(kol[i][1])}: ${tl(v)}">${h(v)}</td>`).join('')}<td class="r num"><b>${tl(s.t)}</b></td></tr>`).join('')}</tbody>
      <tfoot><tr><td><b>Toplam</b></td>${toplamlar.map(v => `<td class="r num"><b>${h(v)}</b></td>`).join('')}<td class="r num"><b>${tl(genel)}</b></td></tr></tfoot></table></div>
      <p class="hint td-not">Alış faturalarından iadeler düşülmüş tutar; B = bin, Mn = milyon ₺. Satıra dokununca tedarikçi açılır.</p>`;
  }

  function listeHtml() {
    if (!T.v && !T.yuk && !T.hata) setTimeout(() => yukle(false), 0);
    else if (T.v && !T.yuk && Date.now() - (T.at || 0) > 15 * 6e4) { T.at = Date.now(); setTimeout(() => yukle(false), 0); }
    const acts = `<button class="btn sm dark" data-act="tdRaporGenel" ${T.v?.liste?.length ? '' : 'disabled'}>Rapor (PDF)</button><button class="btn sm" data-act="tdYenile" ${T.yuk ? 'disabled' : ''}>${T.yuk ? 'Yükleniyor' : 'Yenile'}</button>`;
    const h = head('Alış', 'Tedarikçiler', 'Cari bakiye, verdiğimiz çek ve senetler, aylık ve yıllık alımlar · Paraşüt\'ten', acts);
    if (T.hata && !T.v) return h + `<div class="card empty"><h3>Tedarikçiler alınamadı</h3><p>${esc(T.hata)}</p><button class="btn dark" data-act="tdYenile">Tekrar dene</button></div>`;
    if (!T.v || (!T.v.liste?.length && T.bekliyor)) return h + `<div class="card"><p class="hint">${T.v?.hazirlaniyor || T.bekliyor ? 'Tedarikçilerin bütün hareketleri Paraşüt\'ten ilk kez okunuyor (bir iki dakika sürebilir), liste kendiliğinden gelecek…' : 'Tedarikçiler Paraşüt\'ten alınıyor…'}</p><div class="skel" style="height:110px"></div><div class="skel" style="height:240px;margin-top:14px"></div></div>`;
    const { R, L } = liste();
    const borclu = R.filter(r => r.bakiye > 0.5), avans = R.filter(r => r.bakiye < -0.5);
    const odenecek = top(R, r => Math.max(0, r.odenecek)), cari = top(borclu, r => r.bakiye), evrak = top(R, r => r.kendiT), evrakN = R.reduce((s, r) => s + r.kendi.length, 0);
    const yakin = R.flatMap(r => r.kendi).map(e => e.vade).filter(Boolean).sort()[0];
    const buYil = top(R, r => r.buYil), gecenAyni = top(R, r => r.gecenAyni), buAy = top(R, r => r.buAy), gecenAy = top(R, r => r.gecenAy);
    const fark = gecenAyni > 0.5 ? Math.round((buYil - gecenAyni) / gecenAyni * 100) : null;
    const per = perakendeler();
    const zaman = T.v.zaman ? new Date(T.v.zaman).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const aylar = toplamAylar(R);
    return h + `
      <div class="kpis td-kpis">
        <div class="kpi hero"><div class="k">Ödenecek toplam</div><div class="v">${tl(odenecek)}</div><div class="s">cari borç + verdiğimiz ödenmemiş çek ve senet</div></div>
        <div class="kpi"><div class="k">Cari borcumuz</div><div class="v">${tl(cari)}</div><div class="s">${num(borclu.length)} tedarikçi${avans.length ? ` · ${num(avans.length)} hesapta avans ${tl(-top(avans, r => r.bakiye))}` : ''}</div></div>
        <div class="kpi"><div class="k">Verdiğimiz evrak</div><div class="v">${tl(evrak)}</div><div class="s">${evrakN ? `${num(evrakN)} çek/senet · ilk vade ${dt(yakin)}` : 'ödenmemiş evrak yok'}</div></div>
        <div class="kpi"><div class="k">${bugun().slice(0, 4)} alım</div><div class="v">${tl(buYil)}</div><div class="s">bu ay ${tl(buAy)}${gecenAy > 0.5 ? ` · geçen ay ${tl(gecenAy)}` : ''}${fark !== null ? ` · geçen yılın aynı dönemine göre ${fark >= 0 ? '+' : '−'}%${Math.abs(fark)}` : ''}</div></div>
      </div>
      <div class="card td-c">
        <div class="card-h"><div><h3>Tedarikçi carileri</h3><p class="sub">${T.hata ? `<span class="cz-gec">${esc(T.hata)}</span>` : T.bekliyor ? 'Paraşüt\'ten yenileniyor, liste birazdan güncellenecek…' : zaman ? `Paraşüt'ten, ${zaman} itibarıyla. Satıra dokununca hareketleri, alımları ve evrakları açılır.` : ''}</p></div></div>
        <div class="tools"><input type="search" id="tdq" placeholder="Tedarikçi ara" value="${esc(T.q)}"></div>
        <div class="chips">${FILTRE.map(([k, l]) => `<button class="chip" data-act="tdF" data-k="${k}" aria-pressed="${T.f === k}">${l}</button>`).join('')}</div>
        <div class="cz-sira"><span>Sırala:</span>${SIRA.map(([k, l]) => `<button class="chip sm" data-act="tdS" data-k="${k}" aria-pressed="${T.s === k}">${l}</button>`).join('')}</div>
        ${L.length ? `<ul class="td-tb"><li class="td-th"><div>Tedarikçi</div><div class="b">Cari bakiye</div><div class="e">Verdiğimiz evrak</div><div class="o">Ödenecek</div><div class="y">${bugun().slice(0, 4)} alım</div><div class="h">Son hareket</div></li>${L.map(listeSatir).join('')}
          <li class="td-top"><div class="k"><b>Toplam</b><small>${num(L.length)} tedarikçi</small></div><div class="b"><span class="m">Cari</span><b class="num">${tl(top(L, r => r.bakiye))}</b><small>avanslar düşülmüş</small></div><div class="e"><span class="m">Evrak</span><b class="num">${tl(top(L, r => r.kendiT))}</b></div><div class="o"><span class="m">Ödenecek</span><b class="num">${tl(top(L, r => Math.max(0, r.odenecek)))}</b></div><div class="y"><span class="m">Alım</span><b class="num">${tl(top(L, r => r.buYil))}</b></div><div class="h"></div></li></ul>` : '<p class="sub">Bu seçimde tedarikçi yok.</p>'}
        ${per.length ? `<p class="td-per">${T.per ? `Perakende firmaları da listede (${num(per.length)}: ${esc(per.map(x => x.ad).join(', '))}). <button class="link" data-act="tdPer">Gizle</button>` : `Perakende firmaları (${num(per.length)}: ${esc(per.map(x => x.ad).join(', '))}) listede ve toplamlarda yok; alışları BenimPOS'ta. <button class="link" data-act="tdPer">Göster</button>`}</p>` : ''}
      </div>
      <div class="card td-c"><div class="card-h"><div><h3>Aylık alış ve ödeme</h3><p class="sub">Son 12 ay, bütün tedarikçiler. Ödeme: kasa/banka, verdiğimiz çek/senet ve ciro. Aya dokunun.</p></div></div>
        ${grafik(aylar, 'tdAy', a => a.enCok.length ? `<span class="td-en">En çok: ${a.enCok.map(([n, t]) => `${esc(n)} <b class="num">${tl(t)}</b>`).join(', ')}</span>` : '')}</div>
      <div class="card td-c"><div class="card-h"><div><h3>Alım tablosu</h3><p class="sub">Tedarikçi bazında aylık ve yıllık mal alımı</p></div></div>${alimTablosu(R)}</div>
      ${raporHtml()}`;
  }

  /* ---------- tedarikçi sayfası ---------- */
  const DONEM = [['90', 'Son 3 ay'], ['180', '6 ay'], ['365', '1 yıl'], ['0', 'Hepsi']];
  const TUR = [['hepsi', 'Hepsi'], ['alis', 'Alışlar'], ['odeme', 'Ödemeler'], ['evrak', 'Çek ve senet']];
  const TABS = [['ozet', 'Özet'], ['hareket', 'Hesap hareketleri'], ['alim', 'Aylık / yıllık alım'], ['evrak', 'Çek ve senetler'], ['bilgi', 'Bilgiler']];
  const basTarih = d => d === '0' ? '' : gunEkle(bugun(), -Number(d));
  const vadePill = (v, kapali) => {
    if (kapali) return '<span class="pill ok">Ödendi</span>';
    const n = kalanGun(v);
    return n === null ? '' : n < 0 ? `<span class="pill bad">${-n} gün geçti</span>` : n === 0 ? '<span class="pill bad">Bugün</span>' : n <= 7 ? `<span class="pill warn">${n} gün kaldı</span>` : n <= 31 ? `<span class="pill gold">${n} gün</span>` : `<span class="pill off">${n} gün</span>`;
  };
  const evrakAd = e => [senetMi(e) ? 'Senet' : 'Çek', senetMi(e) ? '' : CLK.evrak?.banka?.(e) || e.bankaAd, e.seri ? 'No ' + e.seri : ''].filter(Boolean).join(' · ');
  function evrakSatir(e, alt = '') {
    const kapali = e.yon === 'verilen' && !(e.kalan > 0.009);
    const v = e.vade || '';
    return `<li class="cs-r ${!kapali && kalanGun(v) !== null && kalanGun(v) < 0 ? 'gecti' : !kapali && kalanGun(v) !== null && kalanGun(v) <= 7 ? 'yakin' : ''} ${kapali ? 'kapali' : ''}">
      <div class="cs-vade"><b>${v.slice(8, 10)}</b><small>${v ? AY[+v.slice(5, 7) - 1] + ' ' + v.slice(2, 4) : ''}</small></div>
      <div class="cs-orta"><b>${esc(evrakAd(e))}</b><small>${esc([e.yon === 'ciro' ? 'müşteri: ' + (e.kimden || '?') : '', e.tarih ? (e.yon === 'verilen' ? 'veriliş ' : 'alış ') + dt(e.tarih) : '', e.aciklama, alt].filter(Boolean).join(' · '))}</small></div>
      <div class="cs-sag"><b>${tl(e.yon === 'verilen' && !kapali ? e.kalan : e.tutar)}</b>${e.yon === 'ciro' ? (sonGun(e) >= bugun() ? vadePill(sonGun(e)) : '<span class="pill off">Süresi doldu</span>') : vadePill(v, kapali)}</div></li>`;
  }

  function detayHtml(id) {
    const x = (T.v?.liste || []).find(y => y.id === id), d = T.d[id];
    const back = '<button class="btn sm" data-act="tdGeri">← Tedarikçiler</button>';
    if (d?.v && !d.yuk && Date.now() - (d.zaman || 0) > 10 * 6e4) setTimeout(() => detayYukle(id), 0);
    if (!d?.v) {
      if (!d || (!d.yuk && !d.hata)) setTimeout(() => detayYukle(id), 0);
      return head('Tedarikçi', esc(x?.ad || 'Tedarikçi'), '', back) + (d?.hata ? `<div class="card empty"><h3>Okunamadı</h3><p>${esc(d.hata)}</p><button class="btn dark" data-act="tdDYenile" data-id="${esc(id)}">Tekrar dene</button></div>`
        : `<div class="card"><p class="hint">Hareketleri Paraşüt'ten okunuyor…</p><div class="skel" style="height:260px"></div></div>`);
    }
    const v = d.v, l = v.satirlar || [], a = analiz(l), e = evrakHesap(v.evrak || [], v.bordro), bak = Number(v.bakiye) || 0, odenecek = r2(bak + e.kendiT);
    const saat = d.zaman ? new Date(d.zaman).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
    const tabs = TABS.map(([k, t]) => `<button role="tab" class="mk-tab" data-act="tdTab" data-k="${k}" aria-selected="${T.tab === k}">${t}${k === 'evrak' && e.kendi.length + e.ciro.length ? ` <b>${num(e.kendi.length + e.ciro.length)}</b>` : ''}</button>`).join('');
    const yan = `<div class="sum-card mk-bak">
        <div><small class="mk-et">CARİ BAKİYE</small>
          <div class="big" style="color:${bak > 0.005 ? '#f0a39a' : 'var(--gold-2)'}">${tl2(Math.abs(bak))}</div>
          <small class="mk-dr">${bak > 0.005 ? 'Borcumuz' : bak < -0.005 ? 'Avans / alacağımız (fazla ödeme)' : 'Hesap kapalı'}</small></div>
        <dl class="td-yan">
          <dt>Verdiğimiz evrak</dt><dd>${e.kendi.length ? tl2(e.kendiT) : '—'}</dd>${e.kendi.length ? `<dd class="td-alt">${num(e.kendi.length)} ödenmemiş çek/senet, ilk vade ${dt(e.yakin)}</dd>` : ''}
          <dt>Ödenecek toplam</dt><dd class="td-ode">${tl2(Math.max(0, odenecek))}</dd><dd class="td-alt">${odenecek < -0.005 ? `${tl2(-odenecek)} fazla ödenmiş` : 'cari + verdiğimiz evrak'}</dd>
          ${e.ciro.length ? `<dt>Ciro riski</dt><dd>${tl2(e.ciroT)}</dd><dd class="td-alt">${num(e.ciro.length)} müşteri evrakı, müşteri ödeyene kadar</dd>` : ''}
          ${e.bekleyen.length ? `<dt>Ciro bekleyen</dt><dd>${tl2(e.bekT)}</dd><dd class="td-alt">${esc([...new Set(e.bekleyen.map(b => b.no))].join(', '))} Paraşüt'te işlenince cari bu kadar düşer</dd>` : ''}
        </dl>
        <div class="mk-dug"><button class="btn gold" data-act="tdRapor" data-id="${esc(id)}">Detaylı rapor</button><button class="btn mk-koyu" data-act="tdMutabakat" data-id="${esc(id)}">Mutabakat</button>${CLK.izin('senet') ? '<button class="btn mk-koyu" data-go="senet">Senet gir</button>' : ''}</div>
      </div>`;
    let ic = '';
    if (T.tab === 'ozet') ic = ozetHtml(v, l, a, e);
    else if (T.tab === 'hareket') ic = hareketHtml(v, l);
    else if (T.tab === 'alim') ic = alimHtml(l);
    else if (T.tab === 'evrak') ic = evrakHtml(v, e);
    else ic = bilgiHtml(v);
    const alt = [v.bilgi?.tel, v.perakende ? 'Perakende firması' : '', v.bilgi?.arsiv ? 'Paraşüt\'te arşivde' : ''].filter(Boolean).map(esc).join(' · ');
    return head('Tedarikçi', esc(v.ad), alt, back + `<button class="btn sm ghost" data-act="tdDYenile" data-id="${esc(id)}" ${d.yuk ? 'disabled' : ''}>${d.yuk ? 'Okunuyor' : 'Yenile'}</button>`) + `
      <div class="mk">
        <aside class="mk-yan">${yan}</aside>
        <div class="mk-ana">
          <div class="mk-tabs" role="tablist">${tabs}</div>
          <div class="card mk-ic">${ic}
            <div class="mh-alt"><small>${d.hata ? `<span class="cz-gec">${esc(d.hata)}</span>` : `Paraşüt'ten, ${saat} itibarıyla · ${num(v.adet || l.length)} hareket.`}</small></div></div>
        </div>
      </div>${raporHtml()}`;
  }

  function ozetHtml(v, l, a, e) {
    const bak = Number(v.bakiye) || 0;
    const [dk, dIk, dAd, dNeden] = bak <= 0.5 ? (bak < -0.5 ? ['ok', '✓', 'Fazla ödemişiz', `${tl2(-bak)} avans ya da alacağımız var`] : ['ok', '✓', 'Cari kapalı', 'Borcumuz yok'])
      : a.yas[3].t > 0.5 ? ['bad', '!', 'Eski borç var', `${tl(a.yas[3].t)} borç 90 günü geçti`] : a.yas[2].t > 0.5 ? ['warn', '!', 'Borç 60 günü geçti', `${tl(a.yas[2].t)} borç 61–90 gün arası`] : ['ok', '✓', 'Ödemeler düzenli', 'Borcun hepsi son 60 günde'];
    const aylar = (() => { const m = aylik(l), bas = ayKaydir(bugun().slice(0, 7), -11);
      return Array.from({ length: 12 }, (_, i) => { const k = ayKaydir(bas, i), x = m[k]; return { k, ad: AY[+k.slice(5, 7) - 1], uzun: ayUzun(k), s: x ? r2(x.alis - x.iade) : 0, o: x ? r2(x.nakit + x.evrak + x.ciro) : 0 }; }); })();
    const notlar = [
      a.sonAlis ? `<li><span class="mo-ik">▤</span><span>Son alış <b>${dt(a.sonAlis.t)}</b> (${once(gunFark(a.sonAlis.t, bugun()))}), <b class="num">${tl(a.sonAlis.tutar)}</b>${a.sonAlis.f?.ack || a.sonAlis.oto ? ' · ' + esc(a.sonAlis.f?.ack || a.sonAlis.oto) : ''}.</span></li>` : '<li><span class="mo-ik">▤</span><span>Paraşüt\'te alış faturası yok.</span></li>',
      a.sonOdeme ? `<li><span class="mo-ik">₺</span><span>Son ödeme <b>${dt(a.sonOdeme.t)}</b> (${once(gunFark(a.sonOdeme.t, bugun()))}), <b class="num">${tl(-a.sonOdeme.tutar)}</b> · ${esc(turAd(a.sonOdeme))}${a.sonOdeme.hesap ? ' · ' + esc(a.sonOdeme.hesap) : ''}.</span></li>` : '',
      e.kendi.length ? `<li><span class="mo-ik">▭</span><span>Verdiğimiz <b>${num(e.kendi.length)} evrak</b> henüz ödenmedi: <b class="num">${tl(e.kendiT)}</b>, ilk vade ${dt(e.yakin)} (${kalanGun(e.yakin) < 0 ? -kalanGun(e.yakin) + ' gün geçti' : kalanGun(e.yakin) + ' gün kaldı'}).</span></li>` : '',
      e.ciro.length ? `<li><span class="mo-ik">↪</span><span>Ciro ettiğimiz <b>${num(e.ciro.length)} müşteri evrakı</b> vadesini bekliyor: <b class="num">${tl(e.ciroT)}</b>. Müşteri ödemezse tedarikçi bize geri getirir.</span></li>` : '',
      e.bekleyen.length ? `<li class="mo-risk"><span class="mo-ik">!</span><span>Panelde çıkış bordrosuyla verilen <b>${num(e.bekleyen.length)} evrak</b> (<b class="num">${tl(e.bekT)}</b>) Paraşüt'te henüz ciro edilmedi; işlenince cari borç bu kadar düşer.</span></li>` : '',
      `<li class="mo-risk"><span class="mo-ik">Σ</span><span>Ödenecek toplam (cari ${bak < 0 ? 'avansı düşülmüş' : 'borç'} + verdiğimiz ödenmemiş evrak): <b class="num">${tl(Math.max(0, r2(bak + e.kendiT)))}</b></span></li>`
    ].filter(Boolean).join('');
    return `<div class="mo-durum ${dk}"><span class="mo-d-ik" aria-hidden="true">${dIk}</span><div><b>${dAd}</b><small>${esc(dNeden)}</small></div></div>
      <div class="mo-k">
        <div><span>Son 12 ay alım</span><b class="num">${tl(a.alim)}</b><small>${num(a.alimN)} fatura${a.iade > 0.5 ? ` · iade ${tl(a.iade)}` : ''}</small></div>
        <div><span>Son 12 ay ödeme</span><b class="num">${tl(a.odeme)}</b><small>kasa/banka, çek, senet, ciro</small></div>
        <div><span>Ortalama ödeme</span><b class="num">${a.ort !== null ? a.ort + ' gün' : '—'}</b><small>${a.ortV !== null && a.ortV - a.ort >= 5 ? `vadesiyle ${a.ortV} gün` : 'alıştan ödemeye'}</small></div>
        <div><span>Ödenmemiş fatura</span><b class="num">${a.acikFat.n ? tl(a.acikFat.t) : 'Yok'}</b><small>${a.acikFat.n ? `${num(a.acikFat.n)} fatura · en eski ${dt(a.acikFat.eski)}` : 'Paraşüt\'e göre'}</small></div>
      </div>
      ${a.acik > 0.5 ? `<h3 class="mk-h3">Borcumuz ne kadar eski? <small>toplam ${tl(a.acik)}</small></h3>
        <div class="mo-yas"><div class="mo-yas-bar" aria-hidden="true">${a.yas.map((y, i) => y.t > 0.5 ? `<i style="flex:${y.t.toFixed(2)};background:${YAS_RENK[i]}" title="${y.ad}: ${tl(y.t)}"></i>` : '').join('')}</div>
        <ul class="mo-yas-l">${a.yas.map((y, i) => `<li class="${y.t > 0.5 ? '' : 'bos'}"><i style="background:${YAS_RENK[i]}"></i><span>${y.ad}</span><b class="num">${y.t > 0.5 ? tl(y.t) : '—'}</b></li>`).join('')}</ul></div>
        <p class="hint mo-yas-not">Ödemeler en eski alıştan başlayarak düşülür; kalan borç hangi alışlardan kaldıysa o tarihlere göre ayrılır.</p>` : ''}
      <h3 class="mk-h3">Aylık alış ve ödeme <small>son 12 ay, aya dokunun</small></h3>${grafik(aylar, 'tdAy')}
      <ul class="mo-not">${notlar}</ul>
      <h3 class="mk-h3">Son hareketler</h3>
      ${l.length ? `<ul class="mh-l">${BASLIK}${l.slice(0, 6).map(satirHtml).join('')}</ul>` : '<p class="sub">Hareket yok.</p>'}
      <div class="mh-alt"><small>Ortalama ödeme ve borç yaşı, borcun ilk giren ilk kapanır sırasıyla ödendiği varsayılarak hesaplanır; çek ve senette veriliş günü sayılır, "vadesiyle" paranın çıktığı gündür.</small><span><button class="btn sm" data-act="tdTab" data-k="hareket">Bütün hareketler</button></span></div>`;
  }

  function hareketHtml(v, l) {
    const bas = basTarih(T.donem), donem = l.filter(x => !bas || x.t >= bas);
    const sec = donem.filter(x => T.tur === 'hepsi' || (T.tur === 'alis' ? x.tur === 'purchase_bill' : T.tur === 'evrak' ? !!x.c : x.tutar < 0));
    const once = bas ? l.find(x => x.t < bas) : null, devir = bas ? (once ? once.b : l.length ? r2(l.at(-1).b - l.at(-1).tutar) : 0) : null;
    const alis = top(donem.filter(alisMi), x => x.tutar), odeme = top(donem.filter(odemeMi), x => -x.tutar);
    return `<div class="mh-ust">
        <div class="chips mh-ch" role="group" aria-label="Dönem">${DONEM.map(([k, t]) => `<button class="chip" data-act="tdDonem" data-k="${k}" aria-pressed="${T.donem === k}">${t}</button>`).join('')}</div>
        <div class="chips mh-ch" role="group" aria-label="Tür">${TUR.map(([k, t]) => `<button class="chip" data-act="tdTur" data-k="${k}" aria-pressed="${T.tur === k}">${t}</button>`).join('')}</div>
      </div>
      <div class="mh-oz"><span>${bas ? dt(bas) + ' – bugün' : 'Bütün hareketler'}</span><span>Alış <b>${tl2(alis)}</b></span><span>Ödeme <b class="pos">${tl2(odeme)}</b></span></div>
      ${sec.length ? `<ul class="mh-l">${BASLIK}${sec.map(satirHtml).join('')}
        ${T.tur === 'hepsi' && devir !== null ? `<li class="mh-s devir"><div class="mh-sb"><span class="mh-ik"></span><span class="mh-tur"><b>Önceki dönemden kalan</b></span><span class="mh-ack"></span><span class="mh-t">${dt(bas)} öncesi</span><b class="mh-tt"></b><span class="mh-b num">${bakYaz(devir)}</span></div></li>` : ''}</ul>`
        : '<p class="sub mh-yok">Bu dönemde hareket yok.</p>'}`;
  }

  function alimHtml(l) {
    const m = aylik(l), yillar = [...new Set(Object.keys(m).map(k => k.slice(0, 4)))].sort().reverse();
    if (!yillar.length) return '<p class="sub">Paraşüt\'te hareket yok.</p>';
    const yil = yillar.includes(T.yil) ? T.yil : yillar[0];
    const aylar = AY.map((a, i) => yil + '-' + String(i + 1).padStart(2, '0')).filter(k => k <= bugun().slice(0, 7));
    const s = k => m[k] || { alis: 0, iade: 0, nakit: 0, evrak: 0, ciro: 0, satis: 0, diger: 0, n: 0 };
    const h = n => n > 0.005 ? tl(n) : '<span class="td-0">—</span>';
    const yt = f => top(aylar, k => f(s(k)));
    // o yıl hiç olmayan sütun (iade, ciro, satış) yazılmaz: tablo telefonda ve kartta sığsın
    const KOL = [['alis', 'Alış'], ['iade', 'İade'], ['nakit', 'Kasa / banka'], ['evrak', 'Çek / senet'], ['ciro', 'Ciro'], ['satis', 'Satış / mahsup']]
      .filter(([k]) => k === 'alis' || k === 'nakit' || yt(x => x[k]) > 0.005);
    const yilSatir = y => { const ks = Object.keys(m).filter(k => k.startsWith(y)), g = f => top(ks, k => f(m[k]));
      return { y, alis: g(x => x.alis), iade: g(x => x.iade), n: g(x => x.n), odeme: g(x => x.nakit + x.evrak + x.ciro), son: aySonu(l, y + '-12') }; };
    const ys = yillar.map(yilSatir), iadeVar = ys.some(r => r.iade > 0.005);
    return `<div class="chips td-ch" role="group" aria-label="Yıl">${yillar.map(y => `<button class="chip" data-act="tdYil" data-k="${y}" aria-pressed="${yil === y}">${y}</button>`).join('')}</div>
      <div class="tbl-wrap"><table class="tbl td-ma"><thead><tr><th>${yil}</th>${KOL.map(([, a]) => `<th class="r">${a}</th>`).join('')}<th class="r">Ay sonu borç</th></tr></thead>
        <tbody>${aylar.slice().reverse().map(k => { const x = s(k); return `<tr><td>${AY_UZUN[+k.slice(5, 7) - 1]}${x.n ? `<small class="td-n">${num(x.n)} fatura</small>` : ''}</td>${KOL.map(([c]) => `<td class="r num">${h(x[c])}</td>`).join('')}<td class="r num">${bakYaz(aySonu(l, k))}</td></tr>`; }).join('')}</tbody>
        <tfoot><tr><td><b>Toplam</b></td>${KOL.map(([c]) => `<td class="r num"><b>${h(yt(x => x[c]))}</b></td>`).join('')}<td></td></tr></tfoot></table></div>
      <h3 class="mk-h3">Yıllara göre</h3>
      <div class="tbl-wrap"><table class="tbl td-ma"><thead><tr><th>Yıl</th><th class="r">Alış</th><th class="r">Fatura</th>${iadeVar ? '<th class="r">İade</th>' : ''}<th class="r">Ödeme</th><th class="r">Yıl sonu borç</th></tr></thead>
        <tbody>${ys.map(r => `<tr class="row" data-act="tdYil" data-k="${r.y}"><td><b>${r.y}</b></td><td class="r num"><b>${tl(r.alis)}</b></td><td class="r num">${num(r.n)}</td>${iadeVar ? `<td class="r num">${h(r.iade)}</td>` : ''}<td class="r num">${tl(r.odeme)}</td><td class="r num">${r.y === bugun().slice(0, 4) ? `${bakYaz(l[0]?.b ?? 0)}<small class="td-n">bugün</small>` : bakYaz(r.son)}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint td-not">Ödeme = kasa/banka + verdiğimiz çek/senet + ciro edilen müşteri evrakı (cari borcu düşenler). Satış / mahsup: tedarikçiye kestiğimiz satış faturaları. Yıla dokununca o yılın ayları açılır.</p>`;
  }

  function evrakHtml(v, e) {
    const ev = v.evrak || [];
    const kapali = ev.filter(x => x.yon === 'verilen' && !(x.kalan > 0.009)).sort((a, b) => (b.vade || '').localeCompare(a.vade || ''));
    const ciroEski = ev.filter(x => x.yon === 'ciro' && !(sonGun(x) >= bugun())).sort((a, b) => (b.vade || '').localeCompare(a.vade || ''));
    const alinan = ev.filter(x => x.yon === 'alinan');
    const grup = (bas, alt, l, bos) => `<h3 class="mk-h3">${bas}${l.length ? ` <small>${num(l.length)} evrak · ${tl(top(l, x => x.yon === 'verilen' && x.kalan > 0.009 ? x.kalan : x.tutar))}</small>` : ''}</h3>${alt ? `<p class="hint td-not">${alt}</p>` : ''}${l.length ? `<ul class="cs-l">${l.map(x => evrakSatir(x)).join('')}</ul>` : `<p class="sub">${bos}</p>`}`;
    return grup('Ödenecek: verdiğimiz çek ve senetler', 'Firmanın kendi evrakı, vadesinde ödenecek. Ödenince Paraşüt\'te "ödendi" işlenmeli.', e.kendi, 'Ödenmemiş çek ya da senedimiz yok.')
      + grup('Ciro ettiğimiz müşteri evrakı', 'Müşteriden alınıp bu tedarikçiye verilen, son günü gelmemiş evrak. Cariden düşüldü; müşteri ödemezse geri gelir.', e.ciro, 'Vadesi gelmemiş ciro evrakı yok.')
      + (e.bekleyen.length ? `<h3 class="mk-h3">Panelde bordrosu hazır, Paraşüt'te ciro bekleyen <small>${tl(e.bekT)}</small></h3><ul class="cs-l">${e.bekleyen.map(x => evrakSatir({ ...x, yon: 'ciro', tarih: '' }, 'bordro ' + x.no + ' · ' + dt(x.btarih))).join('')}</ul>` : '')
      + (alinan.length ? grup('Tedarikçiden alınan', '', alinan, '') : '')
      + (kapali.length || ciroEski.length ? `<details class="td-kap"${T.kapali ? ' open' : ''}><summary data-act="tdKapali">Ödenmiş ve süresi dolmuş evraklar (${num(kapali.length + ciroEski.length)})</summary><ul class="cs-l">${[...kapali, ...ciroEski].map(x => evrakSatir(x)).join('')}</ul></details>` : '')
      + (v.bordro?.length ? `<h3 class="mk-h3">Çıkış bordroları</h3><ul class="mk-fav">${v.bordro.map(b => `<li><div><b>${esc(b.no)}</b><small>${dt(b.tarih)} · ${num(b.adet)} evrak</small></div><b class="num">${tl(b.tutar)}</b></li>`).join('')}</ul>` : '')
      + `<p class="hint td-not">Çek ve senet listesi Paraşüt'ten${v.evrakZaman ? ', ' + new Date(v.evrakZaman).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) + ' itibarıyla' : ''}. Senette son gün vade (tatilse sonraki iş günü) ve izleyen iki iş günüdür.</p>`;
  }

  function bilgiHtml(v) {
    const b = v.bilgi || {};
    const satir = (k, d, kopya) => `<dt>${k}</dt><dd>${d ? `${esc(d)}${kopya ? ` <button class="btn sm" data-act="copy" data-v="${esc(d)}">Kopyala</button>` : ''}` : '—'}</dd>`;
    return `<dl class="mk-dl">${satir('Telefon', b.tel, true)}${satir('E-posta', b.eposta)}${satir('Vergi no', [b.vd, b.vergi].filter(Boolean).join(' '))}${satir('Adres', b.adres)}${satir('IBAN', b.iban, true)}${b.kisa ? satir('Kısa ad', b.kisa) : ''}${satir('Paraşüt no', v.id)}</dl>
      <p class="hint td-not">Bilgiler Paraşüt'teki tedarikçi kartından; değiştirmek için Paraşüt'te tedarikçiyi düzenleyin.</p>`;
  }

  /* ---------- detaylı rapor (A4 PDF): iç rapor ya da tedarikçiye mutabakat ---------- */
  const tlE = v => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0) + ' ₺';
  const trT = d => d ? String(d).slice(0, 10).split('-').reverse().join('.') : '';
  const RDONEM = [['bu', 'Bu yıl'], ['12', 'Son 12 ay'], ['gecen', 'Geçen yıl'], ['3', 'Son 3 ay'], ['0', 'Hepsi']];
  const rpAralik = k => {
    const b = bugun(), y = +b.slice(0, 4);
    if (k === 'bu') return [y + '-01-01', b];
    if (k === 'gecen') return [(y - 1) + '-01-01', (y - 1) + '-12-31'];
    if (k === '12') return [gunEkle(b, -365), b];
    if (k === '3') return [gunEkle(b, -91), b];
    return ['', b];
  };
  const dosyaAd = (on, ad) => `${on}-${String(ad || '').toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]+/gi, '-').replace(/^-|-$/g, '')}-${bugun()}.pdf`;
  const STIL = `*{box-sizing:border-box}@page{size:A4;margin:0}
    table.sayfa{width:100%;table-layout:fixed;border-collapse:collapse}.sayfa>thead>tr>td,.sayfa>tfoot>tr>td,.sayfa>tbody>tr>td{padding:0;border:0;background:none!important;white-space:normal;text-align:left}.sayfa>thead>tr>td,.sayfa>tfoot>tr>td{height:14mm}
    body{margin:0;padding:0 13mm;color:#111;font:10px/1.45 "Segoe UI",system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .serif{font-family:"Didot","Bodoni MT","Playfair Display",Georgia,"Times New Roman",serif}
    .ust{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-top:4px}.ust img{height:52px}
    .ust .f{text-align:right;font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:#444;line-height:1.7}
    .cizgi{height:4px;border-top:1.6px solid #111;border-bottom:.5px solid #111;margin:10px 0 14px}
    .baslik{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin-bottom:12px}
    h1{font-size:26px;font-weight:400;margin:0;line-height:1.05}h1 small{display:block;font:600 8px/1 "Segoe UI",sans-serif;letter-spacing:.28em;color:#777;margin-bottom:7px;text-transform:uppercase}
    .meta{border:1px solid #111;border-radius:3px;min-width:220px}.meta div{display:flex;justify-content:space-between;gap:14px;padding:4px 9px}.meta div+div{border-top:.5px solid #bbb}
    .meta span{font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:#666;padding-top:1px}.meta b{font-weight:600;text-align:right;white-space:nowrap}
    .kutular{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid #111;border-radius:3px;margin:0 0 14px;break-inside:avoid}
    .kutular div{padding:8px 10px;border-right:.5px solid #bbb}.kutular div:last-child{border-right:0}
    .kutular span{display:block;font-size:7.5px;letter-spacing:.16em;text-transform:uppercase;color:#666}.kutular b{display:block;font-size:14px;font-weight:600;margin-top:3px;white-space:nowrap}
    .kutular small{display:block;font-size:8px;color:#666;margin-top:1px}.kutular .koyu{background:#111;color:#fff}.kutular .koyu span,.kutular .koyu small{color:#cfc6b8}
    h2{font:600 9px/1 "Segoe UI",sans-serif;letter-spacing:.22em;text-transform:uppercase;margin:16px 0 6px;padding-bottom:5px;border-bottom:1.2px solid #111;break-after:avoid}
    h2 small{float:right;letter-spacing:.04em;text-transform:none;font-weight:400;color:#555}
    table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
    th{font-size:7.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#555;text-align:right;padding:0 5px 5px;border-bottom:1px solid #111}
    td{padding:4px 5px;text-align:right;white-space:nowrap;border-bottom:.5px solid #d4d4d4}tbody tr:nth-child(even) td{background:#f5f5f3}
    th.l,td.l{text-align:left}td.w{white-space:normal}tfoot td{font-weight:600;border-bottom:0;border-top:1px solid #111}
    tr{break-inside:avoid}.yesil{color:#2c6a49}.kirmizi{color:#a1372d}.gri{color:#999}
    .not{margin-top:12px;padding:8px 11px;border:1px solid #111;border-radius:3px;font-size:9.5px;break-inside:avoid}
    .imza{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:22px;break-inside:avoid}
    .imza div{border-top:.8px solid #111;padding-top:5px;font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:#555;height:70px}.imza b{display:block;font-size:10px;letter-spacing:.02em;color:#111;text-transform:none;margin-top:3px}
    .son{margin-top:12px;text-align:center;font-size:8.5px;color:#777}`;
  const ustHtml = (alt, baslik, meta) => `<div class="ust"><img src="${new URL('logo-clk.png', location.href).href}" alt="CLK"><div class="f">CLK ÇANTA<br>Birlik Mah. 873 Sk. No:2/A Esenler / İstanbul<br>0534 077 88 67 · www.clkcanta.com</div></div>
    <div class="cizgi"></div><div class="baslik"><h1 class="serif"><small>${esc(alt)}</small>${esc(baslik)}</h1><div class="meta">${meta.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div></div>`;
  // yazdırırken her sayfada üst/alt boşluk: Satış faturası belgesindeki tablo düzeni (PDF'te html2pdf kenar boşluğu verir, yükseklikler sıfırlanır)
  const belge = (baslik, govde) => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(baslik)}</title><style>${STIL}</style></head><body><table class="sayfa"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot><tbody><tr><td>${govde}</td></tr></tbody></table></body></html>`;
  const borcYazi = b => b > 0.005 ? tlE(b) + ' borcumuz' : b < -0.005 ? tlE(-b) + ' alacağımız' : 'Kapalı';

  function raporBelgesi(id, o) {
    const v = T.d[id]?.v; if (!v) return '';
    const l = v.satirlar || [], [bas, son] = rpAralik(o.donem), mut = o.tur === 'mutabakat';
    const e = evrakHesap(v.evrak || [], v.bordro), bak = Number(v.bakiye) || 0, a = analiz(l);
    const icinde = l.filter(x => (!bas || x.t >= bas) && x.t <= son);
    const onceki = bas ? l.find(x => x.t < bas) : null, devir = bas ? (onceki ? onceki.b : l.length ? r2(l.at(-1).b - l.at(-1).tutar) : 0) : 0;
    const donemSon = l.find(x => x.t <= son)?.b ?? devir;
    const m = aylik(icinde);
    const aylar = Object.keys(m).sort();
    const g = f => top(aylar, k => f(m[k]));
    const meta = [['Tedarikçi', v.ad], ['Dönem', bas ? `${trT(bas)} – ${trT(son)}` : `– ${trT(son)}`], ['Rapor tarihi', trT(bugun())]];
    const kutular = mut
      ? `<div class="kutular"><div><span>Dönem başı</span><b>${tlE(Math.abs(devir))}</b><small>${devir > 0.005 ? 'borcumuz' : devir < -0.005 ? 'alacağımız' : 'kapalı'}</small></div><div><span>Dönem alış</span><b>${tlE(g(x => x.alis - x.iade))}</b><small>${num(g(x => x.n))} fatura</small></div><div><span>Dönem ödeme</span><b>${tlE(g(x => x.nakit + x.evrak + x.ciro + x.satis))}</b><small>para, evrak, mahsup</small></div><div class="koyu"><span>${trT(son)} bakiye</span><b>${tlE(Math.abs(donemSon))}</b><small>${donemSon > 0.005 ? 'borcumuz' : donemSon < -0.005 ? 'alacağımız' : 'kapalı'}</small></div></div>`
      : `<div class="kutular"><div><span>Cari bakiye</span><b>${tlE(Math.abs(bak))}</b><small>${bak > 0.005 ? 'borcumuz' : bak < -0.005 ? 'avans / alacağımız' : 'kapalı'}</small></div><div><span>Ödenmemiş evrakımız</span><b>${tlE(e.kendiT)}</b><small>${num(e.kendi.length)} çek/senet${e.yakin ? ', ilk vade ' + trT(e.yakin) : ''}</small></div><div class="koyu"><span>Ödenecek toplam</span><b>${tlE(Math.max(0, bak + e.kendiT))}</b><small>cari + evrak</small></div><div><span>Ciro riski</span><b>${tlE(e.ciroT)}</b><small>${num(e.ciro.length)} müşteri evrakı</small></div></div>`;
    const ozet = `<h2>Dönem özeti</h2><table><thead><tr><th class="l">Kalem</th><th>Tutar</th></tr></thead><tbody>
      <tr><td class="l">Dönem başı bakiye</td><td>${borcYazi(devir)}</td></tr>
      <tr><td class="l">Alış faturaları (${num(g(x => x.n))} adet)</td><td>${tlE(g(x => x.alis))}</td></tr>
      ${g(x => x.iade) > 0.005 ? `<tr><td class="l">Alış iadeleri</td><td>− ${tlE(g(x => x.iade))}</td></tr>` : ''}
      <tr><td class="l">Kasa / banka ödemeleri</td><td>− ${tlE(g(x => x.nakit))}</td></tr>
      <tr><td class="l">Verilen çek ve senetler</td><td>− ${tlE(g(x => x.evrak))}</td></tr>
      ${g(x => x.ciro) > 0.005 ? `<tr><td class="l">Ciro edilen müşteri evrakı</td><td>− ${tlE(g(x => x.ciro))}</td></tr>` : ''}
      ${g(x => x.satis) > 0.005 ? `<tr><td class="l">Satış faturaları (mahsup)</td><td>− ${tlE(g(x => x.satis))}</td></tr>` : ''}
      ${Math.abs(g(x => x.diger)) > 0.005 ? `<tr><td class="l">Diğer kayıtlar</td><td>${g(x => x.diger) < 0 ? '− ' : ''}${tlE(Math.abs(g(x => x.diger)))}</td></tr>` : ''}
      </tbody><tfoot><tr><td class="l">${trT(son)} itibarıyla bakiye</td><td>${borcYazi(donemSon)}</td></tr></tfoot></table>`;
    // dönemde hiç olmayan sütun (iade, ciro, mahsup) yazılmaz
    const RK = [['alis', 'Alış'], ['iade', 'İade'], ['nakit', 'Kasa / banka'], ['evrak', 'Çek / senet'], ['ciro', 'Ciro'], ['satis', 'Mahsup']].filter(([k]) => k === 'alis' || k === 'nakit' || g(x => x[k]) > 0.005);
    const ayTablo = aylar.length ? `<h2>Aylık döküm</h2><table><thead><tr><th class="l">Ay</th>${RK.map(([, a]) => `<th>${a}</th>`).join('')}<th>Ay sonu bakiye</th></tr></thead><tbody>
      ${aylar.map(k => { const x = m[k], c = n => n > 0.005 ? tlE(n) : '<span class="gri">—</span>'; return `<tr><td class="l">${ayUzun(k)}</td>${RK.map(([f]) => `<td>${c(x[f])}</td>`).join('')}<td>${borcYazi(aySonu(l, k))}</td></tr>`; }).join('')}</tbody>
      <tfoot><tr><td class="l">Toplam</td>${RK.map(([f]) => `<td>${tlE(g(x => x[f]))}</td>`).join('')}<td></td></tr></tfoot></table>` : '';
    const yillar = [...new Set(l.map(x => x.t.slice(0, 4)))].sort();
    const ym = aylik(l);
    const yilTablo = !mut && yillar.length > 1 ? `<h2>Yıllara göre alım</h2><table><thead><tr><th class="l">Yıl</th><th>Alış</th><th>Fatura</th><th>İade</th><th>Ödeme</th><th>Yıl sonu bakiye</th></tr></thead><tbody>
      ${yillar.map(y => { const ks = Object.keys(ym).filter(k => k.startsWith(y)), t = f => top(ks, k => f(ym[k])); return `<tr><td class="l">${y}</td><td>${tlE(t(x => x.alis))}</td><td>${num(t(x => x.n))}</td><td>${tlE(t(x => x.iade))}</td><td>${tlE(t(x => x.nakit + x.evrak + x.ciro))}</td><td>${borcYazi(aySonu(l, y + '-12'))}</td></tr>`; }).join('')}</tbody></table>` : '';
    const evSat = x => `<tr><td class="l">${trT(x.vade)}</td><td class="l">${esc(evrakAd(x))}</td><td class="l">${trT(x.tarih)}</td>${x.yon === 'ciro' ? `<td class="l w">${esc(x.kimden || '')}</td>` : ''}<td>${tlE(x.yon === 'verilen' ? x.kalan : x.tutar)}</td></tr>`;
    const evrakT = (e.kendi.length ? `<h2>Verdiğimiz, ödenmemiş çek ve senetler<small>${num(e.kendi.length)} evrak · ${tlE(e.kendiT)}</small></h2><table><thead><tr><th class="l">Vade</th><th class="l">Evrak</th><th class="l">Veriliş</th><th>Tutar</th></tr></thead><tbody>${e.kendi.map(evSat).join('')}</tbody></table>` : '')
      + (!mut && e.ciro.length ? `<h2>Ciro ettiğimiz müşteri evrakı<small>${num(e.ciro.length)} evrak · ${tlE(e.ciroT)}</small></h2><table><thead><tr><th class="l">Vade</th><th class="l">Evrak</th><th class="l">Alış</th><th class="l">Müşteri</th><th>Tutar</th></tr></thead><tbody>${e.ciro.map(evSat).join('')}</tbody></table>` : '');
    const hareket = o.hareket && icinde.length ? `<h2>Hesap hareketleri<small>${num(icinde.length)} hareket</small></h2><table><thead><tr><th class="l">Tarih</th><th class="l">İşlem</th><th class="l">Açıklama</th><th>Alış / borç</th><th>Ödeme</th><th>Bakiye</th></tr></thead><tbody>
      ${bas ? `<tr><td class="l">${trT(bas)}</td><td class="l" colspan="4"><i>Önceki dönemden devir</i></td><td>${borcYazi(devir)}</td></tr>` : ''}
      ${icinde.slice().reverse().map(x => `<tr><td class="l">${trT(x.t)}</td><td class="l">${esc(turAd(x))}</td><td class="l w">${esc(aciklama(x))}</td><td>${x.tutar > 0 ? tlE(x.tutar) : ''}</td><td>${x.tutar < 0 ? tlE(-x.tutar) : ''}</td><td>${borcYazi(x.b)}</td></tr>`).join('')}</tbody></table>` : '';
    const ic = !mut ? `<div class="not">Ortalama ödeme süremiz ${a.ort !== null ? `<b>${a.ort} gün</b>${a.ortV !== null && a.ortV - a.ort >= 5 ? ` (çek/senet vadesiyle ${a.ortV} gün)` : ''}` : 'hesaplanamadı'}; ödenmemiş alış faturası ${a.acikFat.n ? `<b>${num(a.acikFat.n)}</b> adet, <b>${tlE(a.acikFat.t)}</b> (en eski ${trT(a.acikFat.eski)})` : 'yok'}.${e.bekleyen.length ? ` Panelde bordrosu hazır, Paraşüt'te ciro bekleyen ${num(e.bekleyen.length)} evrak: <b>${tlE(e.bekT)}</b>.` : ''}</div>` : '';
    const mutabakat = mut ? `<div class="not">${trT(son)} tarihi itibarıyla firmamız kayıtlarına göre cari hesabınızda <b>${borcYazi(donemSon).replace('borcumuz', 'lehinize alacak bakiyesi').replace('alacağımız', 'aleyhinize borç bakiyesi')}</b> görünmektedir${e.kendi.length ? `; bu bakiyeye ek olarak vadesi gelmemiş ${num(e.kendi.length)} adet çek/senet (${tlE(e.kendiT)}) tarafınıza verilmiştir` : ''}. Mutabık olup olmadığınızı bildirmenizi, mutabık değilseniz hesap ekstrenizi göndermenizi rica ederiz.</div>
      <div class="imza"><div>CLK ÇANTA<b>Kaşe / imza</b></div><div>${esc(v.ad)}<b>Mutabıkız / mutabık değiliz · kaşe / imza</b></div></div>` : '';
    return belge((mut ? 'Mutabakat – ' : 'Tedarikçi raporu – ') + v.ad, ustHtml(mut ? 'Cari hesap mutabakatı' : 'Tedarikçi hesap raporu', v.ad, meta) + kutular + ozet + ayTablo + yilTablo + evrakT + hareket + ic + mutabakat
      + `<div class="son">Paraşüt kayıtlarından hazırlanmıştır · ${new Date().toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</div>`);
  }

  function genelBelge(o) {
    const R = gorunur().map(satirHesap).sort((a, b) => b.odenecek - a.odenecek || a.x.ad.localeCompare(b.x.ad, 'tr'));
    const yil = o.yil || bugun().slice(0, 4), aylar = AY.map((a, i) => yil + '-' + String(i + 1).padStart(2, '0'));
    const yillar = [...new Set(R.flatMap(r => Object.keys(r.x.ay || {}).map(k => k.slice(0, 4))))].sort();
    const yilT = (r, y) => r2(Object.entries(r.x.ay || {}).filter(([k]) => k.startsWith(y)).reduce((s, [, v]) => s + alisNet(v), 0));
    const c = n => n > 0.5 ? tlE(n) : '<span class="gri">—</span>';
    const meta = [['Tedarikçi', num(R.length)], ['Rapor tarihi', trT(bugun())], ['Kaynak', 'Paraşüt']];
    const kutu = `<div class="kutular"><div class="koyu"><span>Ödenecek toplam</span><b>${tlE(top(R, r => Math.max(0, r.odenecek)))}</b><small>cari + verdiğimiz evrak</small></div><div><span>Cari borcumuz</span><b>${tlE(top(R.filter(r => r.bakiye > 0.5), r => r.bakiye))}</b><small>${num(R.filter(r => r.bakiye > 0.5).length)} tedarikçi</small></div><div><span>Verdiğimiz evrak</span><b>${tlE(top(R, r => r.kendiT))}</b><small>${num(R.reduce((s, r) => s + r.kendi.length, 0))} çek/senet</small></div><div><span>${yil} alım</span><b>${tlE(top(R, r => yilT(r, yil)))}</b><small>iadeler düşülmüş</small></div></div>`;
    const bakiyeler = `<h2>Bakiyeler</h2><table><thead><tr><th class="l">Tedarikçi</th><th>Cari</th><th>Verdiğimiz evrak</th><th>İlk vade</th><th>Ödenecek</th><th>Ciro riski</th><th>Son alış</th><th>Son ödeme</th></tr></thead><tbody>
      ${R.map(r => `<tr><td class="l w">${esc(r.x.ad)}</td><td class="${r.bakiye < -0.5 ? 'yesil' : ''}">${r.bakiye < -0.5 ? '− ' : ''}${tlE(Math.abs(r.bakiye))}</td><td>${c(r.kendiT)}</td><td>${trT(r.yakin)}</td><td><b>${c(Math.max(0, r.odenecek))}</b></td><td>${c(r.ciroT)}</td><td>${r.x.sonAlis ? trT(r.x.sonAlis[0]) : ''}</td><td>${r.x.sonOdeme ? trT(r.x.sonOdeme[0]) : ''}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td class="l">Toplam</td><td>${tlE(top(R, r => r.bakiye))}</td><td>${tlE(top(R, r => r.kendiT))}</td><td></td><td>${tlE(top(R, r => Math.max(0, r.odenecek)))}</td><td>${tlE(top(R, r => r.ciroT))}</td><td></td><td></td></tr></tfoot></table>
      <p class="gri" style="margin:4px 0 0;font-size:8px">Cari: artı borcumuz, eksi (yeşil) avans / alacağımız. Ödenecek = cari + verdiğimiz ödenmemiş çek ve senet. Perakende firmaları (BenimPOS) dahil değil.</p>`;
    const aylikT = `<h2>${yil} aylık alım<small>bütün tedarikçiler</small></h2><table><thead><tr><th class="l">Ay</th><th>Alış</th><th>Ödeme</th><th>Kasa / banka</th><th>Çek / senet</th><th>Ciro</th><th class="l">En çok alınan</th></tr></thead><tbody>
      ${aylar.filter(k => k <= bugun().slice(0, 7)).map(k => { const s = top(R, r => alisNet(r.x.ay?.[k])), en = R.map(r => [r.x.ad, alisNet(r.x.ay?.[k])]).filter(([, t]) => t > 0.5).sort((p, q) => q[1] - p[1]).slice(0, 2);
        const t = i => top(R, r => r.x.ay?.[k]?.[i] || 0);
        return `<tr><td class="l">${AY_UZUN[+k.slice(5, 7) - 1]}</td><td>${c(s)}</td><td>${c(t(2) + t(3) + t(4))}</td><td>${c(t(2))}</td><td>${c(t(3))}</td><td>${c(t(4))}</td><td class="l w">${esc(en.map(([n]) => n).join(', '))}</td></tr>`; }).join('')}</tbody>
      <tfoot><tr><td class="l">Toplam</td><td>${tlE(top(R, r => yilT(r, yil)))}</td><td>${tlE(top(aylar, k => top(R, r => odemeTop(r.x.ay?.[k]))))}</td><td></td><td></td><td></td><td></td></tr></tfoot></table>`;
    const tedAy = `<h2>${yil} tedarikçi bazında aylık alım</h2><table style="font-size:8px"><thead><tr><th class="l">Tedarikçi</th>${AY.map(a => `<th>${a}</th>`).join('')}<th>Toplam</th></tr></thead><tbody>
      ${R.map(r => ({ r, d: aylar.map(k => alisNet(r.x.ay?.[k])) })).filter(s => s.d.some(v => v > 0.5)).sort((p, q) => q.d.reduce((a, b) => a + b, 0) - p.d.reduce((a, b) => a + b, 0))
        .map(s => `<tr><td class="l w">${esc(s.r.x.ad)}</td>${s.d.map(v => `<td>${v > 0.5 ? kisa(v) : '<span class="gri">·</span>'}</td>`).join('')}<td><b>${kisa(s.d.reduce((a, b) => a + b, 0))}</b></td></tr>`).join('')}</tbody></table>
      <p class="gri" style="margin:4px 0 0;font-size:8px">B = bin, Mn = milyon ₺.</p>`;
    const yilT2 = yillar.length > 1 ? `<h2>Yıllara göre alım</h2><table><thead><tr><th class="l">Tedarikçi</th>${yillar.map(y => `<th>${y}</th>`).join('')}</tr></thead><tbody>
      ${R.filter(r => yillar.some(y => yilT(r, y) > 0.5)).map(r => `<tr><td class="l w">${esc(r.x.ad)}</td>${yillar.map(y => `<td>${c(yilT(r, y))}</td>`).join('')}</tr>`).join('')}</tbody>
      <tfoot><tr><td class="l">Toplam</td>${yillar.map(y => `<td>${tlE(top(R, r => yilT(r, y)))}</td>`).join('')}</tr></tfoot></table>` : '';
    const ev = R.flatMap(r => r.kendi.map(e => ({ ...e, ad: r.x.ad }))).sort((a, b) => (a.vade || '').localeCompare(b.vade || ''));
    const evT = ev.length ? `<h2>Ödenecek çek ve senetlerimiz<small>${num(ev.length)} evrak · ${tlE(top(ev, e => e.kalan))}</small></h2><table><thead><tr><th class="l">Vade</th><th class="l">Tedarikçi</th><th class="l">Evrak</th><th class="l">Veriliş</th><th>Tutar</th></tr></thead><tbody>
      ${ev.map(e => `<tr><td class="l">${trT(e.vade)}</td><td class="l w">${esc(e.ad)}</td><td class="l">${esc(evrakAd(e))}</td><td class="l">${trT(e.tarih)}</td><td>${tlE(e.kalan)}</td></tr>`).join('')}</tbody></table>` : '';
    return belge('Tedarikçi bakiye raporu', ustHtml('Tedarikçi raporu', 'Bakiye ve alımlar', meta) + kutu + bakiyeler + evT + aylikT + tedAy + yilT2
      + `<div class="son">Paraşüt kayıtlarından hazırlanmıştır · ${new Date().toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</div>`);
  }

  // rapor penceresi: seçenekler, PDF indir, WhatsApp'a PDF, yazdır
  function raporHtml() {
    const o = T.rp; if (!o) return '';
    const v = o.id ? T.d[o.id]?.v : null, genel = !o.id;
    const yillar = genel ? [...new Set(gorunur().flatMap(x => Object.keys(x.ay || {}).map(k => k.slice(0, 4))))].sort().reverse() : [];
    return `<div class="mh-modal" data-act="tdRpKapat" role="dialog" aria-label="Rapor"><div class="mh-modal-in td-rp">
      <div class="mh-modal-h"><div><b>${genel ? 'Tedarikçi bakiye raporu' : o.tur === 'mutabakat' ? 'Mutabakat · ' + esc(v?.ad || '') : 'Detaylı rapor · ' + esc(v?.ad || '')}</b><small>A4 PDF · yazdırılır ya da WhatsApp'ta gönderilir</small></div><button class="btn sm ghost" data-act="tdRpKapat">Kapat</button></div>
      <div class="td-rp-f">
        ${genel ? `<div><span class="td-rp-e">Aylık tablolar</span><div class="chips">${yillar.map(y => `<button class="chip sm" data-act="tdRpYil" data-k="${y}" aria-pressed="${(o.yil || yillar[0]) === y}">${y}</button>`).join('')}</div></div>
          <p class="hint">Bütün tedarikçilerin cari bakiyesi, verdiğimiz evraklar, ödenecek toplam, seçili yılın aylık alımı ve yıllara göre alım. Perakende firmaları dahil değil.</p>`
        : `<div><span class="td-rp-e">Tür</span><div class="chips"><button class="chip sm" data-act="tdRpTur" data-k="ic" aria-pressed="${o.tur !== 'mutabakat'}">İç rapor</button><button class="chip sm" data-act="tdRpTur" data-k="mutabakat" aria-pressed="${o.tur === 'mutabakat'}">Tedarikçiye mutabakat</button></div></div>
          <div><span class="td-rp-e">Dönem</span><div class="chips">${RDONEM.map(([k, t]) => `<button class="chip sm" data-act="tdRpDonem" data-k="${k}" aria-pressed="${o.donem === k}">${t}</button>`).join('')}</div></div>
          <label class="bd-c"><input type="checkbox" id="tdRpHar" ${o.hareket ? 'checked' : ''}><span>Hesap hareketleri de yazılsın <small>(dönemdeki bütün alış, ödeme ve evraklar, yürüyen bakiyeyle)</small></span></label>
          <p class="hint">${o.tur === 'mutabakat' ? 'Tedarikçiye gönderilecek: dönem özeti, aylık döküm, verdiğimiz ödenmemiş evraklar ve imza yerleri. Ciro riski ve iç notlar yazılmaz.' : 'İç rapor: cari, ödenmemiş evrak, ödenecek toplam, ciro riski, aylık ve yıllık alım, ortalama ödeme süresi.'}</p>`}
      </div>
      <div class="mh-modal-d"><button class="btn ek-wa" data-act="tdRpWa" ${o.is ? 'disabled' : ''}>${o.is === 'w' ? 'PDF hazırlanıyor…' : o.pdf ? 'WhatsApp\'ta gönder' : 'WhatsApp'}</button><button class="btn dark" data-act="tdRpPdf" ${o.is ? 'disabled' : ''}>${o.is === 'p' ? 'PDF hazırlanıyor…' : 'PDF indir'}</button><button class="btn" data-act="tdRpYazdir" ${o.is ? 'disabled' : ''}>Yazdır</button></div>
    </div></div>`;
  }
  const raporBelge = o => o.id ? raporBelgesi(o.id, o) : genelBelge(o);
  const raporDosya = o => o.id ? dosyaAd(o.tur === 'mutabakat' ? 'mutabakat' : 'tedarikci-raporu', T.d[o.id]?.v?.ad) : dosyaAd('tedarikci-bakiye-raporu', 'clk');
  const raporAc = (id, tur) => { T.rp = { id, tur, donem: tur === 'mutabakat' ? '0' : 'bu', hareket: true }; ciz(); };
  async function raporPdf(paylas) {
    const o = T.rp; if (!o || o.is || !CLK.htmlBelge) return;
    if (paylas && o.pdf) { const r = await CLK.pdfPaylas(o.pdf, raporDosya(o), 'CLK Çanta'); if (r === 'tekrar') toast('PDF hazır: WhatsApp\'ta gönder\'e bir daha basın'); return; }
    o.is = paylas ? 'w' : 'p'; o.pdf = null; ciz();
    try {
      const html = raporBelge(o);
      if (paylas) {
        o.pdf = await CLK.htmlBelge.pdf(html, raporDosya(o), true);
        o.is = ''; ciz();
        const r = await CLK.pdfPaylas(o.pdf, raporDosya(o), 'CLK Çanta');
        if (r === 'tekrar') toast('PDF hazır: WhatsApp\'ta gönder\'e bir daha basın');
      } else { await CLK.htmlBelge.pdf(html, raporDosya(o)); toast('PDF indirildi'); }
    } catch (e) { toast(e.message); }
    o.is = ''; ciz();
  }

  views.tedarikciler = () => S.arg ? detayHtml(String(S.arg)) : listeHtml();
  views.bind_tedarikciler = () => {
    const q = $('#tdq'); q?.addEventListener('input', () => { T.q = q.value; clearTimeout(q.t); q.t = setTimeout(render.yazinca, 220); });
    $('#tdRpHar')?.addEventListener('change', e => { if (T.rp) { T.rp.hareket = e.target.checked; T.rp.pdf = null; } });
  };
  // ana panel ve başka sayfalar tedarikçiyi açabilsin
  CLK.tedarikciAc = id => { T.tab = 'ozet'; T.ay = ''; CLK.go('tedarikciler', String(id || '')); };

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (!act.startsWith('td')) return prevAct?.(act, el, e);
    const rp = T.rp;
    if (act === 'tdAc') { S.tdScroll = window.scrollY; T.tab = 'ozet'; T.ay = ''; CLK.go('tedarikciler', el.dataset.id); }
    else if (act === 'tdGeri') { T.ay = ''; CLK.go('tedarikciler'); requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: S.tdScroll || 0 }))); }
    else if (act === 'tdYenile') { T.at = Date.now(); T.deneme = 0; yukle(true); }
    else if (act === 'tdDYenile') detayYukle(el.dataset.id, true);
    else if (act === 'tdF') { T.f = el.dataset.k; ciz(); }
    else if (act === 'tdS') { T.s = el.dataset.k; ciz(); }
    else if (act === 'tdPer') { T.per = !T.per; ciz(); }
    else if (act === 'tdTablo') { T.tablo = el.dataset.k; ciz(); }
    else if (act === 'tdAy') { T.ay = el.dataset.k; ciz(); }
    else if (act === 'tdTab') { T.tab = el.dataset.k; T.ay = ''; ciz(); }
    else if (act === 'tdDonem') { T.donem = el.dataset.k; ciz(); }
    else if (act === 'tdTur') { T.tur = el.dataset.k; ciz(); }
    else if (act === 'tdYil') { T.yil = el.dataset.k; ciz(); }
    else if (act === 'tdKapali') { e.preventDefault(); T.kapali = !T.kapali; ciz(); }
    else if (act === 'tdRapor') raporAc(el.dataset.id, 'ic');
    else if (act === 'tdMutabakat') raporAc(el.dataset.id, 'mutabakat');
    else if (act === 'tdRaporGenel') { T.rp = { id: '', yil: '' }; ciz(); }
    else if (act === 'tdRpKapat') { if (el.classList.contains('mh-modal') && e.target !== el) return; T.rp = null; ciz(); }
    else if (!rp) return;
    else if (act === 'tdRpTur') { rp.tur = el.dataset.k; rp.pdf = null; if (rp.tur === 'mutabakat' && rp.donem === 'bu') rp.donem = '0'; ciz(); }
    else if (act === 'tdRpDonem') { rp.donem = el.dataset.k; rp.pdf = null; ciz(); }
    else if (act === 'tdRpYil') { rp.yil = el.dataset.k; rp.pdf = null; ciz(); }
    else if (act === 'tdRpPdf') raporPdf(false);
    else if (act === 'tdRpWa') raporPdf(true);
    else if (act === 'tdRpYazdir') { try { CLK.htmlBelge?.yazdir(raporBelge(rp)); } catch (err) { toast(err.message); } }
  };
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches?.('li.td-tr[data-act="tdAc"]')) { e.preventDefault(); e.target.click(); }
    if (e.key === 'Escape' && S.route === 'tedarikciler' && T.rp) { T.rp = null; ciz(); }
  });
})();
