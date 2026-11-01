/* CLK Yönetim — Gider gir (celik isteği 31.10.2026: "giderleri ben buradan gireyim, sen oraya işle").
   Gider Paraşüt'e ayrıntısız gider fişi olarak açılır (sunucu: gider-cek); "Ödendi" seçilirse seçilen kasa ya da bankadan ödemesi de girilir.
   Ödenmemiş gidere sonradan ödeme eklenebilir. Paraşüt'te hiçbir kayıt silinmez ya da değiştirilmez; yanlış girilen gider Paraşüt'ten düzeltilir. */
(() => {
  const { sb, S, $, esc, tl, tl2, num, dt, dtt, toast, head, views, render, araKutu, araSec, ARA } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/gider-cek';
  // sık kullanılan gider kategorileri (Paraşüt'te olanlar düğme olarak çıkar)
  const SIK = ['YAKIT', 'MARKET', 'MUHASEBE', 'BANKA', 'AMBAR', 'FERİBOT', 'TUR MASRAF', 'KDV'];
  // Paraşüt'te henüz olmayan, ilk kullanıldığında açılacak kategori önerileri
  const ONERI = ['KİRA', 'ELEKTRİK', 'SU', 'DOĞALGAZ', 'İNTERNET', 'TELEFON', 'YEMEK', 'KARGO', 'NAKLİYE', 'PERSONEL', 'VERGİ', 'SGK', 'TAMİR BAKIM', 'KIRTASİYE', 'REKLAM', 'TEMİZLİK', 'OTOPARK', 'KÖPRÜ OTOYOL'];
  const KDV = [[0, 'KDV yok'], [1, '%1'], [10, '%10'], [20, '%20']];
  const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const bugun = () => new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);
  const gunEkle = (g, n) => new Date(Date.parse(g + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const ayAdi = a => AYLAR[Number(a.slice(5, 7)) - 1] + ' ' + a.slice(0, 4);
  const ayKaydir = (a, n) => { const d = new Date(Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  const buyuk = s => String(s || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr');
  const bekle = ms => new Promise(s => setTimeout(s, ms));
  const uuid = () => (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^a-z0-9-]/gi, '');
  // "1.250,50", "1250.5", "1.250" ve "1250" hepsi okunur
  const para = v => {
    let s = String(v ?? '').replace(/[\s₺TLtl]/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    return Number.isFinite(n) && n > 0 && n < 1e8 ? Math.round(n * 100) / 100 : 0;
  };
  const kdvTutar = (t, o) => (o ? Math.round((t - t / (1 + o / 100)) * 100) / 100 : 0);

  const yeniForm = (o = {}) => ({ kat: '', yeniKat: '', diger: false, tutar: '', kdv: 0, tarih: o.tarih || bugun(), aciklama: '', odeme: o.odeme || 'odendi', hesap: o.hesap || '', vade: '', ted: null, belge: '', ek: false });
  const D = (S.ui.gd ||= { k: null, l: null, yuk: false, hata: '', f: yeniForm(), kaydediyor: false, onay: false, sonuc: null, uyari: '', ode: null, ay: '', goster: 25 });

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
  // kayıt isteği: bağlantı koparsa aynı istek numarasıyla tekrar sorulur, sunucu ikinci kez kaydetmez
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
      sor({ islem: 'kaynak', yenile: !!yenile }).then(k => {
        D.k = k;
        if (!D.f.hesap || !k.hesaplar.some(h => h.id === D.f.hesap)) D.f.hesap = (k.hesaplar.find(h => h.tur === 'cash') || k.hesaplar[0])?.id || '';
        S.keepScroll = true; render();
      }),
      sor({ islem: 'giderler' }).then(l => { D.l = l; S.keepScroll = true; render(); })
    ]);
    const h = iki.find(x => x.status === 'rejected');
    if (h) D.hata = h.reason?.message || 'Veri alınamadı';
    D.yuk = false; S.keepScroll = true; render();
  }

  // gider sayılan kayıtlar: ayrıntısız fişler; tedarikçi adıyla açılmış kategoriler (YEFA, FUAT, WEST…) tedarikçi kaydıdır, gider değil
  const giderMi = g => !g.detayli && g.tur === 'purchase_bill' && !(g.tedarikci && g.kategori && buyuk(g.tedarikci).startsWith(buyuk(g.kategori).split(' ')[0]));
  const giderler = () => (D.l?.giderler || []).filter(giderMi);
  const kategori = id => (D.k?.kategoriler || []).find(k => k.id === id);
  const hesap = id => (D.k?.hesaplar || []).find(h => h.id === id);
  const kimGirdi = id => (D.l?.gecmis || []).find(g => g.id === id && g.islem === 'gider')?.kim || '';

  function cipler() {
    const kat = D.k?.kategoriler || [];
    const say = {};
    for (const g of giderler()) say[g.katId] = (say[g.katId] || 0) + 1;
    for (const g of D.l?.gecmis || []) { const k = kat.find(x => x.ad === g.kategori); if (k) say[k.id] = (say[k.id] || 0) + 2; }
    const sira = k => { const i = SIK.indexOf(buyuk(k.ad)); return i < 0 ? 99 : i; };
    const l = kat.filter(k => SIK.includes(buyuk(k.ad)) || say[k.id]).sort((a, b) => (say[b.id] || 0) - (say[a.id] || 0) || sira(a) - sira(b)).slice(0, 12);
    const sec = kategori(D.f.kat);
    if (sec && !l.includes(sec)) l.push(sec);
    return l;
  }

  function eksik() {
    const f = D.f, e = [];
    if (!f.kat && !buyuk(f.yeniKat)) e.push('Kategori seçin.');
    else if (!f.kat && buyuk(f.yeniKat).length < 2) e.push('Yeni kategori adı en az 2 harf olmalı.');
    if (!para(f.tutar)) e.push('Tutar girin.');
    if (!f.tarih) e.push('Tarih seçin.');
    else if (f.tarih > gunEkle(bugun(), 60)) e.push('Tarih çok ileride.');
    if (f.odeme === 'odendi' && !hesap(f.hesap)) e.push('Ödemenin çıktığı kasa ya da bankayı seçin.');
    if (f.odeme === 'odenecek' && f.vade && f.vade < f.tarih) e.push('Son ödeme tarihi gider tarihinden önce olamaz.');
    return e;
  }
  const katAdi = () => (D.f.kat ? kategori(D.f.kat)?.ad || '' : buyuk(D.f.yeniKat));
  const ayniVar = () => {
    const f = D.f, t = para(f.tutar), ad = buyuk(katAdi());
    return t ? (D.l?.giderler || []).find(g => g.tarih === f.tarih && Math.abs(g.tutar - t) < 0.01 && buyuk(g.kategori) === ad) : null;
  };

  // özet kartı: yazdıkça yalnız bu bölüm yenilenir (bütün sayfa çizilirse telefonda klavye kapanıyor)
  function ozetHtml() {
    const f = D.f, t = para(f.tutar), ad = katAdi(), kdv = kdvTutar(t, f.kdv), e = eksik(), ayni = ayniVar();
    const h = hesap(f.hesap);
    const satir = (k, v) => `<div class="gd-oz-s"><span>${k}</span><b>${v}</b></div>`;
    return `<div class="gd-oz-t">${t ? tl2(t) : '0,00 ₺'}</div>
      <div class="gd-oz-k">${ad ? esc(ad) + (f.kat ? '' : ' <em>yeni kategori</em>') : 'Kategori seçilmedi'}</div>
      ${satir('Tarih', f.tarih ? dt(f.tarih) : '—')}
      ${f.kdv ? satir(`KDV %${f.kdv}`, tl2(kdv)) + satir('KDV hariç', tl2(t - kdv)) : satir('KDV', 'Yok')}
      ${f.odeme === 'odendi' ? satir('Ödendi', h ? esc(h.ad) : 'Kasa/banka seçin') : satir('Son ödeme', dt(f.vade || f.tarih) + ' · ödenecek')}
      ${f.ted ? satir('Tedarikçi', esc(f.ted.ad)) : ''}${f.belge.trim() ? satir('Belge no', esc(f.belge.trim())) : ''}
      ${f.aciklama.trim() ? `<p class="gd-oz-a">“${esc(f.aciklama.trim())}”</p>` : ''}
      ${ayni ? `<p class="gd-oz-u">Bu tarihte aynı tutarda bir ${esc(ad)} gideri zaten var (${esc(ayni.aciklama || ad)}). İkinci kez girmediğinizden emin olun.</p>` : ''}
      ${D.uyari ? `<p class="gd-oz-h">${esc(D.uyari)}</p>` : ''}
      <button class="btn dark gd-kaydet" data-act="gdKaydet" ${D.kaydediyor || !D.k ? 'disabled' : ''}>${D.kaydediyor ? 'Paraşüt\'e kaydediliyor…' : D.onay ? (ayni ? 'Evet, yine de kaydet' : 'Evet, Paraşüt\'e kaydet') : 'Gideri Paraşüt\'e kaydet'}</button>
      <p class="gd-oz-n">${D.onay ? 'Bilgileri kontrol edip bir kez daha basın.' : e.length && (f.tutar || f.kat || f.yeniKat) ? esc(e[0]) : 'Paraşüt\'e yalnız yeni gider eklenir, hiçbir kayıt silinmez.'}</p>`;
  }
  const ozetYenile = () => { const o = $('#gdOzet'); if (o) o.innerHTML = ozetHtml(); };

  function sonucHtml() {
    const r = D.sonuc;
    if (!r) return '';
    const odemeNot = r.odeme ? (r.odeme.ok ? `ödendi (${esc(r.odeme.hesap)})` : `<b class="gd-kirmizi">Ödeme girilemedi: ${esc(r.odeme.hata)}</b>. Gider açıldı; ödemesini aşağıdaki "Ödenecek giderler"den girin.`) : `Son ödeme ${dt(r.vade)}, ödenecek giderlere eklendi`;
    return `<div class="gd-sonuc ${r.odeme && !r.odeme.ok ? 'kismi' : ''}" role="status">
      <div class="gd-tik">✓</div>
      <div><b>Paraşüt'e kaydedildi: ${esc(r.kategori)} ${tl2(r.tutar)}</b>
        <small>${esc(r.aciklama)} · ${dt(r.tarih)} · ${odemeNot}${r.yeniKat ? ` · "${esc(r.kategori)}" kategorisi Paraşüt'te açıldı` : ''}</small>
        ${(r.uyari || []).map(u => `<small class="gd-kirmizi">${esc(u)}</small>`).join('')}</div>
      <button class="gd-x" data-act="gdSonucKapat" aria-label="Kapat">×</button></div>`;
  }

  function formHtml() {
    const f = D.f, k = D.k;
    if (!k) return `<div class="card gd-form">${D.hata ? `<p class="msg err">${esc(D.hata)}</p><button class="btn dark" data-act="gdYenile">Tekrar dene</button>` : '<div class="skel" style="height:420px"></div>'}</div>`;
    const sik = cipler();
    const tumu = [...k.kategoriler].sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
    const oneri = ONERI.filter(o => !k.kategoriler.some(x => buyuk(x.ad) === o));
    const dun = gunEkle(bugun(), -1);
    return `<div class="card gd-form">
      ${sonucHtml()}
      <div class="gd-adim"><span>1</span><h3>Ne için?</h3></div>
      <div class="gd-katlar" role="group" aria-label="Kategori">
        ${sik.map(c => `<button class="gd-kat" data-act="gdKat" data-id="${c.id}" aria-pressed="${f.kat === c.id}" style="--k:${esc(c.renk || '#b48f55')}"><i></i>${esc(c.ad)}</button>`).join('')}
        <button class="gd-kat diger" data-act="gdDiger" aria-pressed="${f.diger || !!buyuk(f.yeniKat)}">${buyuk(f.yeniKat) ? '+ ' + esc(buyuk(f.yeniKat)) : 'Diğer…'}</button>
      </div>
      ${f.diger ? `<div class="gd-diger">
        <label class="f"><span>Tüm kategoriler</span><select id="gdKatSec"><option value="">Seçin</option>${tumu.map(c => `<option value="${c.id}" ${f.kat === c.id ? 'selected' : ''}>${esc(c.ad)}</option>`).join('')}</select></label>
        <label class="f"><span>ya da yeni kategori</span><input id="gdYeniKat" type="text" list="gdOneri" autocomplete="off" maxlength="40" placeholder="ör. KİRA, ELEKTRİK" value="${esc(f.yeniKat)}"></label>
        <datalist id="gdOneri">${oneri.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
        <p class="hint">Yeni kategori, gider kaydedilince Paraşüt'te açılır.</p></div>` : ''}
      <label class="f gd-acik"><span>Açıklama</span><input id="gdAciklama" type="text" maxlength="250" autocomplete="off" placeholder="ör. Ekim kirası, depo yakıtı, kırtasiye" value="${esc(f.aciklama)}"></label>

      <div class="gd-adim"><span>2</span><h3>Ne kadar?</h3></div>
      <div class="gd-tutar"><input id="gdTutar" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(f.tutar)}" aria-label="Tutar (KDV dahil)"><b>₺</b></div>
      <p class="hint gd-tutar-n">KDV dahil toplam tutarı yazın.</p>
      <div class="gd-seg" role="group" aria-label="KDV">${KDV.map(([o, l]) => `<button data-act="gdKdv" data-o="${o}" aria-pressed="${f.kdv === o}">${l}</button>`).join('')}</div>
      <div class="gd-tarih">
        <label class="f"><span>Gider tarihi</span><input id="gdTarih" type="date" value="${esc(f.tarih)}" max="${gunEkle(bugun(), 60)}"></label>
        <div class="gd-hizli"><button class="chip" data-act="gdTarihSec" data-g="${bugun()}" aria-pressed="${f.tarih === bugun()}">Bugün</button><button class="chip" data-act="gdTarihSec" data-g="${dun}" aria-pressed="${f.tarih === dun}">Dün</button></div>
      </div>

      <div class="gd-adim"><span>3</span><h3>Ödendi mi?</h3></div>
      <div class="gd-seg gd-odeme" role="group" aria-label="Ödeme durumu">
        <button data-act="gdOdeme" data-o="odendi" aria-pressed="${f.odeme === 'odendi'}">Ödendi</button>
        <button data-act="gdOdeme" data-o="odenecek" aria-pressed="${f.odeme === 'odenecek'}">Sonra ödenecek</button></div>
      ${f.odeme === 'odendi'
        ? `<div class="gd-hesaplar" role="group" aria-label="Kasa ya da banka">${k.hesaplar.map(h => `<button class="gd-hesap" data-act="gdHesap" data-id="${h.id}" aria-pressed="${f.hesap === h.id}"><i>${h.tur === 'cash' ? '₺' : '▭'}</i><span>${esc(h.ad)}</span></button>`).join('')}</div>`
        : `<div class="gd-tarih"><label class="f"><span>Son ödeme tarihi</span><input id="gdVade" type="date" value="${esc(f.vade || f.tarih)}" min="${esc(f.tarih)}"></label>
            <div class="gd-hizli">${[[7, '1 hafta'], [30, '1 ay']].map(([n, l]) => `<button class="chip" data-act="gdVadeSec" data-g="${gunEkle(f.tarih || bugun(), n)}">${l}</button>`).join('')}</div></div>`}

      <button class="gd-ek-dug" data-act="gdEk" aria-expanded="${f.ek}">${f.ek ? '−' : '+'} Tedarikçi ve belge no${f.ted || f.belge ? ' (girildi)' : ' (isteğe bağlı)'}</button>
      ${f.ek ? `<div class="gd-ek">
        <div class="f ara-alan"><span>Tedarikçi</span>${araKutu('gdTed', k.tedarikciler, f.ted?.ad || '', 'gdTed', { yer: `Paraşüt tedarikçisi ara (${k.tedarikciler.length})` })}${f.ted ? `<button class="link" data-act="gdTedSil">Tedarikçiyi kaldır</button>` : ''}</div>
        <label class="f"><span>Fiş / fatura no</span><input id="gdBelge" type="text" maxlength="40" autocomplete="off" value="${esc(f.belge)}" placeholder="isteğe bağlı"></label></div>` : ''}
    </div>`;
  }

  function ozetKart() {
    const g = giderler(), simdi = bugun().slice(0, 7);
    const ay = D.ay || simdi;
    const ayl = [simdi, ayKaydir(simdi, -1), ayKaydir(simdi, -2)];
    const top = a => g.filter(x => x.tarih.startsWith(a)).reduce((s, x) => s + x.tutar, 0);
    const bu = g.filter(x => x.tarih.startsWith(ay));
    const kat = {};
    for (const x of bu) { const k = kat[x.kategori || 'Kategorisiz'] ||= { t: 0, n: 0, renk: x.renk }; k.t += x.tutar; k.n++; }
    const l = Object.entries(kat).sort((a, b) => b[1].t - a[1].t), en = l[0]?.[1].t || 1;
    const toplam = top(ay), onceki = top(ayKaydir(ay, -1));
    const fark = onceki ? Math.round((toplam - onceki) / onceki * 100) : null;
    return `<div class="card gd-ay">
      <div class="gd-ay-h"><h3>Giderler</h3><div class="chips">${ayl.map(a => `<button class="chip" data-act="gdAy" data-a="${a}" aria-pressed="${ay === a}">${AYLAR[+a.slice(5, 7) - 1]}</button>`).join('')}</div></div>
      <div class="gd-ay-t">${tl(toplam)}<small>${ayAdi(ay)} · ${num(bu.length)} gider${fark !== null && toplam > 0 && ay !== ayl[2] ? ` · geçen aya göre <b class="${fark > 0 ? 'gd-kirmizi' : 'gd-yesil'}">${fark > 0 ? '+' : ''}${fark}%</b>` : ''}</small></div>
      ${l.length ? `<div class="bars">${l.map(([ad, k]) => `<div class="bar"><span><i class="gd-nokta" style="background:${esc(k.renk || '#b48f55')}"></i>${esc(ad)} <small>(${k.n})</small></span><b>${tl(k.t)}</b><i><em style="width:${Math.max(3, k.t / en * 100)}%"></em></i></div>`).join('')}</div>`
        : `<p class="hint">${D.l ? 'Bu ay henüz gider girilmedi.' : 'Giderler okunuyor…'}</p>`}
    </div>`;
  }

  const vadeNot = v => {
    if (!v) return '';
    const n = Math.round((Date.parse(v) - Date.parse(bugun())) / 864e5);
    return n < 0 ? `<span class="pill bad">${-n} gün geçti</span>` : n === 0 ? '<span class="pill warn">Bugün</span>' : n <= 7 ? `<span class="pill warn">${n} gün kaldı</span>` : `<span class="pill off">${dt(v)}</span>`;
  };

  function odenecekKart() {
    const l = giderler().filter(g => g.kalan > 0.009).sort((a, b) => (a.vade || a.tarih).localeCompare(b.vade || b.tarih));
    const tekrar = (D.l?.giderler || []).filter(g => g.tur === 'recurring_purchase_bill');
    if (!D.l) return '';
    if (!l.length && !tekrar.length) return '';
    const o = D.ode, k = D.k;
    return `<div class="card gd-od">
      <h3>Ödenecek giderler</h3><p class="sub">${l.length ? `${num(l.length)} gider, toplam ${tl(l.reduce((s, g) => s + g.kalan, 0))}` : 'Ödenmemiş gider yok.'}</p>
      <ul class="gd-liste">${l.map(g => `<li>
        <div class="gd-l-sol"><i class="gd-nokta" style="background:${esc(g.renk || '#b48f55')}"></i><div><b>${esc(g.aciklama || g.kategori)}</b><small>${esc(g.kategori)}${g.tedarikci ? ' · ' + esc(g.tedarikci) : ''} · ${dt(g.tarih)}</small></div></div>
        <div class="gd-l-sag"><b>${tl2(g.kalan)}</b>${vadeNot(g.vade || g.tarih)}${o?.id === g.id ? '' : `<button class="btn sm" data-act="gdOdeAc" data-id="${g.id}">Öde</button>`}</div>
        ${o?.id === g.id ? `<div class="gd-ode">
          <label class="f"><span>Nereden</span><select id="gdOdeHesap">${(k?.hesaplar || []).map(h => `<option value="${h.id}" ${o.hesap === h.id ? 'selected' : ''}>${esc(h.ad)}</option>`).join('')}</select></label>
          <label class="f"><span>Tutar</span><input id="gdOdeTutar" type="text" inputmode="decimal" value="${esc(o.tutar)}"></label>
          <label class="f"><span>Tarih</span><input id="gdOdeTarih" type="date" value="${esc(o.tarih)}"></label>
          <div class="gd-ode-d"><button class="btn sm" data-act="gdOdeKapat">Vazgeç</button><button class="btn sm dark" data-act="gdOdeKaydet" ${o.calisiyor ? 'disabled' : ''}>${o.calisiyor ? 'Kaydediliyor…' : o.onay ? 'Evet, ödemeyi kaydet' : 'Ödemeyi Paraşüt\'e kaydet'}</button></div>
          ${o.hata ? `<p class="msg err">${esc(o.hata)}</p>` : ''}</div>` : ''}
      </li>`).join('')}</ul>
      ${tekrar.length ? `<p class="hint gd-tekrar">Paraşüt'te her ay kendiliğinden açılan: ${tekrar.map(g => `<b>${esc(g.aciklama || g.kategori)}</b> ${tl(g.tutar)} (sonraki ${dt(g.tarih)})`).join(', ')}</p>` : ''}
    </div>`;
  }

  function sonKart() {
    if (!D.l) return `<div class="card"><h3>Son giderler</h3><div class="skel" style="height:220px;margin-top:14px"></div></div>`;
    const l = giderler();
    const durum = g => g.kalan <= 0.009 ? '<span class="pill ok">Ödendi</span>' : g.kalan < g.tutar - 0.009 ? '<span class="pill warn">Kısmi</span>' : '<span class="pill off">Ödenecek</span>';
    return `<div class="card gd-son">
      <h3>Son giderler</h3><p class="sub">Paraşüt'teki son 3 ayın giderleri${D.l.zaman ? ` (${dtt(D.l.zaman)})` : ''}. Tedarikçi alış faturaları burada gösterilmez.</p>
      ${l.length ? `<ul class="gd-liste">${l.slice(0, D.goster).map(g => { const kim = kimGirdi(g.id); return `<li>
        <div class="gd-l-sol"><i class="gd-nokta" style="background:${esc(g.renk || '#b48f55')}"></i><div><b>${esc(g.aciklama || g.kategori)}</b><small>${esc(g.kategori)}${g.tedarikci ? ' · ' + esc(g.tedarikci) : ''} · ${dt(g.tarih)}${g.kdv ? ' · KDV ' + tl2(g.kdv) : ''}${kim ? ' · panelden ' + esc(kim.split('@')[0]) : ''}</small></div></div>
        <div class="gd-l-sag"><b>${tl2(g.tutar)}</b>${durum(g)}</div></li>`; }).join('')}</ul>
        ${l.length > D.goster ? `<div class="ek-dug"><button class="btn sm" data-act="gdDaha">Daha fazla (${num(l.length - D.goster)})</button></div>` : ''}` : '<p class="hint">Son 3 ayda gider yok.</p>'}
    </div>`;
  }

  views.gider = () => {
    if (!D.k && !D.l && !D.yuk && !D.hata) yukle();
    const acts = `<button class="btn" data-act="gdYenile" ${D.yuk ? 'disabled' : ''}>${D.yuk ? 'Okunuyor…' : 'Yenile'}</button>`;
    return `${head('Finans', 'Gider gir', 'Giderinizi buradan girin, Paraşüt\'e gider fişi olarak işlenir. Ödendiyse kasa ya da bankadan ödemesi de girilir.', acts)}
      ${D.hata && D.k ? `<p class="msg err" style="margin-bottom:14px">${esc(D.hata)}</p>` : ''}
      <div class="gd-ust">
        <div class="gd-sol">${formHtml()}</div>
        <div class="gd-sag"><div class="card gd-ozet" id="gdOzet">${ozetHtml()}</div>${ozetKart()}</div>
      </div>
      <div class="gd-alt">${odenecekKart()}${sonKart()}</div>`;
  };

  views.bind_gider = () => {
    const f = D.f;
    const metin = (id, alan, tam) => $('#' + id)?.addEventListener('input', e => { f[alan] = e.target.value; D.onay = false; D.uyari = ''; if (tam) { S.keepScroll = true; render(); } else ozetYenile(); });
    metin('gdTutar', 'tutar'); metin('gdAciklama', 'aciklama'); metin('gdBelge', 'belge');
    $('#gdYeniKat')?.addEventListener('input', e => { f.yeniKat = e.target.value; if (buyuk(f.yeniKat)) f.kat = ''; D.onay = false; ozetYenile(); const s = $('#gdKatSec'); if (s && buyuk(f.yeniKat)) s.value = ''; });
    $('#gdYeniKat')?.addEventListener('change', () => { S.keepScroll = true; render(); });
    $('#gdKatSec')?.addEventListener('change', e => { f.kat = e.target.value; if (f.kat) f.yeniKat = ''; D.onay = false; S.keepScroll = true; render(); });
    $('#gdTarih')?.addEventListener('change', e => { f.tarih = e.target.value; if (f.vade && f.vade < f.tarih) f.vade = f.tarih; D.onay = false; S.keepScroll = true; render(); });
    $('#gdVade')?.addEventListener('change', e => { f.vade = e.target.value; D.onay = false; ozetYenile(); });
    // tutar yazılınca biçimlenir: 1250,5 → 1.250,50
    $('#gdTutar')?.addEventListener('blur', e => { const t = para(e.target.value); if (t) { f.tutar = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(t); e.target.value = f.tutar; ozetYenile(); } });
    const o = D.ode;
    if (o) {
      $('#gdOdeHesap')?.addEventListener('change', e => { o.hesap = e.target.value; o.onay = false; });
      $('#gdOdeTutar')?.addEventListener('input', e => { o.tutar = e.target.value; o.onay = false; });
      $('#gdOdeTarih')?.addEventListener('change', e => { o.tarih = e.target.value; o.onay = false; });
    }
  };
  araSec.gdTed = m => { D.f.ted = m; D.onay = false; };

  async function kaydet() {
    const f = D.f, e = eksik();
    if (e.length) { D.uyari = e[0]; D.onay = false; S.keepScroll = true; render(); return; }
    if (!D.onay) { D.onay = true; D.uyari = ''; ozetYenile(); setTimeout(() => { if (D.onay && !D.kaydediyor) { D.onay = false; ozetYenile(); } }, 10000); return; }
    D.kaydediyor = true; D.onay = false; D.uyari = ''; D.sonuc = null; S.keepScroll = true; render();
    const govde = { islem: 'ekle', istek: uuid(), tarih: f.tarih, tutar: para(f.tutar), kdv: f.kdv, aciklama: f.aciklama.trim(), odeme: f.odeme,
      hesap: f.odeme === 'odendi' ? f.hesap : '', vade: f.odeme === 'odenecek' ? (f.vade || f.tarih) : '', tedarikci: f.ted?.id || '', belge: f.belge.trim(),
      ...(f.kat ? { kategori: f.kat } : { yeniKategori: buyuk(f.yeniKat) }) };
    try {
      const r = await yazIstek(govde);
      D.sonuc = r;
      D.f = yeniForm(f);
      delete ARA.gdTed;
      toast(`${r.kategori} ${tl2(r.tutar)} Paraşüt'e kaydedildi.`);
      D.kaydediyor = false; S.keepScroll = true; render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // liste ve (yeni kategori açıldıysa) kategoriler yenilenir
      yukle(false);
    } catch (err) {
      D.uyari = err.message; D.kaydediyor = false; S.keepScroll = true; render();
    }
  }

  async function odemeKaydet() {
    const o = D.ode; if (!o) return;
    const g = giderler().find(x => x.id === o.id), t = para(o.tutar);
    if (!g) return;
    if (!t) { o.hata = 'Tutar girin.'; S.keepScroll = true; render(); return; }
    if (t > g.kalan + 0.009) { o.hata = `Kalan tutardan (${tl2(g.kalan)}) fazla ödeme girilemez.`; S.keepScroll = true; render(); return; }
    if (!o.onay) { o.onay = true; o.hata = ''; S.keepScroll = true; render(); return; }
    o.calisiyor = true; o.onay = false; o.hata = ''; S.keepScroll = true; render();
    try {
      const r = await yazIstek({ islem: 'ode', istek: o.istek ||= uuid(), id: o.id, hesap: o.hesap, tutar: t, tarih: o.tarih });
      D.ode = null;
      toast(`${tl2(r.tutar)} ödeme Paraşüt'e girildi (${r.hesap}).`);
      S.keepScroll = true; render();
      yukle(false);
    } catch (err) { o.hata = err.message; o.calisiyor = false; o.istek = ''; S.keepScroll = true; render(); }
  }

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    const f = D.f;
    const ciz = () => { S.keepScroll = true; render(); };
    if (act === 'gdYenile') { D.hata = ''; yukle(true); }
    else if (act === 'gdKat') { f.kat = el.dataset.id; f.yeniKat = ''; f.diger = false; D.onay = false; D.uyari = ''; ciz(); }
    else if (act === 'gdDiger') { f.diger = !f.diger; ciz(); if (f.diger) setTimeout(() => $('#gdKatSec')?.focus(), 50); }
    else if (act === 'gdKdv') { f.kdv = Number(el.dataset.o); D.onay = false; ciz(); }
    else if (act === 'gdTarihSec') { f.tarih = el.dataset.g; if (f.vade && f.vade < f.tarih) f.vade = f.tarih; D.onay = false; ciz(); }
    else if (act === 'gdVadeSec') { f.vade = el.dataset.g; D.onay = false; ciz(); }
    else if (act === 'gdOdeme') { f.odeme = el.dataset.o; D.onay = false; D.uyari = ''; ciz(); }
    else if (act === 'gdHesap') { f.hesap = el.dataset.id; D.onay = false; D.uyari = ''; ciz(); }
    else if (act === 'gdEk') { f.ek = !f.ek; ciz(); }
    else if (act === 'gdTedSil') { f.ted = null; delete ARA.gdTed; ciz(); }
    else if (act === 'gdKaydet') kaydet();
    else if (act === 'gdSonucKapat') { D.sonuc = null; ciz(); }
    else if (act === 'gdAy') { D.ay = el.dataset.a; ciz(); }
    else if (act === 'gdDaha') { D.goster += 50; ciz(); }
    else if (act === 'gdOdeAc') { const g = giderler().find(x => x.id === el.dataset.id); if (g) { D.ode = { id: g.id, hesap: D.f.hesap || D.k?.hesaplar[0]?.id || '', tutar: String(g.kalan).replace('.', ','), tarih: bugun(), onay: false, hata: '' }; ciz(); } }
    else if (act === 'gdOdeKapat') { D.ode = null; ciz(); }
    else if (act === 'gdOdeKaydet') odemeKaydet();
    else prevAct?.(act, el, e);
  };
})();
