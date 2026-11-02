/* CLK Yönetim — Cari hesap › Ödeme gir (celik 02.11.2026: "cari hesap kısmında ödeme gir diye buton yapar mısın hiç paraşütle uğraşmayayım",
   "paraşütte ki bankaları çekersin direk").
   Müşteriden alınan nakit, havale ya da kart ödemesi Paraşüt'e cari tahsilat olarak seçilen kasa/bankaya girilir, site carisine de yazılır
   (sunucu: Supabase gider-cek, işlem tahsilat_kaynak ve tahsilat). Paraşüt'te silme ya da değiştirme yok.
   Senetle ödediyse (celik 02.11.2026: "ödeme sayfasına senet giri de ekler misin") ödeme şekli Senet seçilir: Senet gir'in adımları
   ve özeti burada çizilir (views-senet.js CLK.senetGom), senet Paraşüt'e müşteriden alınan senet olarak açılır. Çek Paraşüt'ten girilir. */
(() => {
  const { sb, S, $, esc, tl2, num, dt, dtt, toast, views, render, araKutu, araSec, ARA } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/gider-cek';
  const bugun = () => new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);
  const gunEkle = (g, n) => new Date(Date.parse(g + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const bekle = ms => new Promise(r => setTimeout(r, ms));
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
  const SON_HESAP = 'clk-tahsilat-hesap';
  const sonHesap = () => { try { return localStorage.getItem(SON_HESAP) || ''; } catch { return ''; } };
  const yeniForm = (sekil = 'para') => ({ kisi: null, sekil, tutar: '', tarih: bugun(), hesap: sonHesap(), aciklama: '' });
  // senetle ödeme yalnız Senet gir yetkisi olana açılır
  const senetVar = () => !!CLK.senetGom && CLK.izin('senet');
  const senetMi = () => T.f.sekil === 'senet' && senetVar();
  const T = (S.ui.th ||= { acik: false, k: null, yuk: false, hata: '', f: yeniForm(), onay: false, kaydediyor: false, sonuc: null, uyari: '', siteSec: 0, istek: '' });

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
  const ciz = () => { S.keepScroll = true; render(); };

  // müşteri sayfasından açılınca sitedeki üye Paraşüt müşterisiyle eşleştirilir
  function siteSecUygula() {
    if (!T.siteSec || !T.k) return;
    const m = T.k.musteriler.find(x => x.site === T.siteSec);
    if (m) { T.f.kisi = m; delete ARA.thKisi; }
    T.siteSec = 0;
  }
  async function yukle(yenile) {
    if (T.yuk) return;
    T.yuk = true; T.hata = ''; ciz();
    try {
      T.k = await sor({ islem: 'tahsilat_kaynak', yenile: !!yenile });
      if (!T.f.hesap || !T.k.hesaplar.some(h => h.id === T.f.hesap)) T.f.hesap = (T.k.hesaplar.find(h => h.tur === 'cash') || T.k.hesaplar[0])?.id || '';
      siteSecUygula();
    } catch (e) { T.hata = e.message; }
    T.yuk = false; ciz();
  }

  const hesap = id => (T.k?.hesaplar || []).find(h => h.id === id);
  const siteUye = m => (m?.site ? (S.users || []).find(u => Number(u.id) === m.site) : null);
  function eksik() {
    const f = T.f, e = [];
    if (!f.kisi) e.push('Müşteriyi seçin.');
    if (!para(f.tutar)) e.push('Tutarı girin.');
    if (!f.tarih) e.push('Tarihi seçin.');
    else if (f.tarih > gunEkle(bugun(), 1)) e.push('İleri tarihli ödeme girilmez.');
    else if (f.tarih < gunEkle(bugun(), -400)) e.push('Tarih çok eski.');
    if (!hesap(f.hesap)) e.push('Paranın girdiği kasa ya da bankayı seçin.');
    return e;
  }
  // aynı gün aynı müşteriden aynı tutar panelden zaten girildiyse uyarılır
  const ayniVar = () => {
    const f = T.f, t = para(f.tutar);
    return t && f.kisi ? (T.k?.gecmis || []).find(g => g.kisiId === f.kisi.id && g.tarih === f.tarih && Math.abs(g.tutar - t) < 0.01) : null;
  };

  // özet: yazdıkça yalnız bu bölüm yenilenir (bütün sayfa çizilirse telefonda klavye kapanıyor)
  function ozetHtml() {
    const f = T.f, t = para(f.tutar), h = hesap(f.hesap), e = eksik(), ayni = ayniVar(), u = siteUye(f.kisi);
    const satir = (k, v) => `<div class="gd-oz-s"><span>${k}</span><b>${v}</b></div>`;
    const bal = u ? Number(u.balance) || 0 : null;
    return `<div class="gd-oz-k">Müşteriden tahsilat</div>
      <div class="gd-oz-t">${t ? tl2(t) : '0,00 ₺'}</div>
      ${satir('Müşteri', f.kisi ? esc(f.kisi.ad) : 'Seçilmedi')}
      ${satir('Tarih', f.tarih ? dt(f.tarih) : '—')}
      ${satir('Nereye', h ? esc(h.ad) : 'Kasa/banka seçin')}
      ${bal !== null ? satir('Site carisi', `${tl2(bal)}${t ? ' → ' + tl2(bal + t) : ''}`) : f.kisi ? satir('Site carisi', 'Sitede eşleşmemiş') : ''}
      ${f.aciklama.trim() ? `<p class="gd-oz-a">“${esc(f.aciklama.trim())}”</p>` : ''}
      ${ayni ? `<p class="gd-oz-u">Bu müşteriden bu tarihte aynı tutarda ödeme panelden zaten girildi (${esc(ayni.hesap)}). İkinci kez girmediğinizden emin olun.</p>` : ''}
      ${T.uyari ? `<p class="gd-oz-h">${esc(T.uyari)}</p>` : ''}
      <button class="btn gold gd-kaydet" data-act="thKaydet" ${T.kaydediyor || !T.k ? 'disabled' : ''}>${T.kaydediyor ? 'Paraşüt\'e kaydediliyor…' : T.onay ? (ayni ? 'Evet, yine de kaydet' : 'Evet, kaydet') : 'Tahsilatı kaydet'}</button>
      <p class="gd-oz-n">${T.onay ? 'Bilgileri kontrol edip bir kez daha basın.' : e.length && (f.tutar || f.kisi) ? esc(e[0]) : 'Paraşüt\'e tahsilat olarak girilir, site carisine de yazılır. Hiçbir kayıt silinmez.'}</p>`;
  }
  const ozetYenile = () => { const o = $('#thOzet'); if (o) o.innerHTML = ozetHtml(); };

  function sonucHtml() {
    const r = T.sonuc;
    if (!r) return '';
    const s = r.site || {}, kismi = s.durum === 'hata' || (r.uyari || []).length;
    return `<div class="gd-sonuc ${kismi ? 'kismi' : ''}" role="status">
      <div class="gd-tik">✓</div>
      <div><b>${esc(r.kisi)}: ${tl2(r.tutar)} tahsilat Paraşüt'e girildi</b>
        <small>${dt(r.tarih)} · ${esc(r.hesap)}${r.aciklama ? ' · ' + esc(r.aciklama) : ''}</small>
        <small class="${s.durum === 'hata' ? 'gd-kirmizi' : ''}">${esc(s.mesaj || '')}</small>
        ${(r.uyari || []).map(u => `<small class="gd-kirmizi">${esc(u)}</small>`).join('')}</div>
      <button class="gd-x" data-act="thSonucKapat" aria-label="Kapat">×</button></div>`;
  }

  function formHtml() {
    const f = T.f, k = T.k, dun = gunEkle(bugun(), -1);
    if (!k) return `<div class="card gd-form">${T.hata ? `<p class="msg err">${esc(T.hata)}</p><button class="btn dark" data-act="thYenile">Tekrar dene</button>` : '<p class="hint">Paraşüt\'teki müşteriler, kasa ve bankalar okunuyor…</p><div class="skel" style="height:300px"></div>'}</div>`;
    const u = siteUye(f.kisi), bal = u ? Number(u.balance) || 0 : 0;
    const sekil = senetVar() ? `<div class="gd-seg odm-sekil" role="group" aria-label="Nasıl ödedi">
        <button data-act="thSekil" data-o="para" aria-pressed="${!senetMi()}">Nakit, havale, kart</button>
        <button data-act="thSekil" data-o="senet" aria-pressed="${senetMi()}">Senet</button></div>` : '';
    if (senetMi()) return `<div class="card gd-form">
      ${sonucHtml()}
      <div class="gd-adim"><span>1</span><h3>Kimden, nasıl?</h3></div>
      <div class="f ara-alan">${araKutu('thKisi', k.musteriler, f.kisi?.ad || '', 'thKisi', { yer: `Paraşüt müşterisi ara (${num(k.musteriler.length)})` })}
        ${f.kisi ? `<small class="hint">${u ? `Site carisi ${tl2(bal)}${bal < 0 ? ' (borç)' : bal > 0 ? ' (alacak)' : ''}` : 'Bu müşteri sitede üye olarak eşleşmemiş; senet yalnız Paraşüt\'e yazılır.'}</small>` : ''}</div>
      ${sekil}
      ${CLK.senetGom.html(f.kisi, 2)}
    </div>`;
    return `<div class="card gd-form">
      ${sonucHtml()}
      <div class="gd-adim"><span>1</span><h3>${sekil ? 'Kimden, nasıl?' : 'Kimden?'}</h3></div>
      <div class="f ara-alan">${araKutu('thKisi', k.musteriler, f.kisi?.ad || '', 'thKisi', { yer: `Paraşüt müşterisi ara (${num(k.musteriler.length)})` })}
        ${f.kisi ? `<small class="hint">${u ? `Site carisi ${tl2(bal)}${bal < 0 ? ' (borç)' : bal > 0 ? ' (alacak)' : ''}` : 'Bu müşteri sitede üye olarak eşleşmemiş; yalnız Paraşüt\'e yazılır.'}</small>` : ''}</div>
      ${sekil}

      <div class="gd-adim"><span>2</span><h3>Ne kadar?</h3></div>
      <div class="gd-tutar"><input id="thTutar" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(f.tutar)}" aria-label="Tutar"><b>₺</b></div>
      ${u && bal < -0.009 ? `<div class="gd-hizli"><button class="chip" data-act="thTamami" data-v="${Math.abs(bal).toFixed(2).replace('.', ',')}">Borcun tamamı ${tl2(Math.abs(bal))}</button></div>` : ''}
      <div class="gd-tarih">
        <label class="f"><span>Ödeme tarihi</span><input id="thTarih" type="date" value="${esc(f.tarih)}" max="${bugun()}"></label>
        <div class="gd-hizli"><button class="chip" data-act="thTarihSec" data-g="${bugun()}" aria-pressed="${f.tarih === bugun()}">Bugün</button><button class="chip" data-act="thTarihSec" data-g="${dun}" aria-pressed="${f.tarih === dun}">Dün</button></div>
      </div>

      <div class="gd-adim"><span>3</span><h3>Nereye girdi?</h3></div>
      ${k.hesaplar.length ? `<div class="gd-hesaplar" role="group" aria-label="Kasa ya da banka">${k.hesaplar.map(h => `<button class="gd-hesap" data-act="thHesap" data-id="${h.id}" aria-pressed="${f.hesap === h.id}"><i>${h.tur === 'cash' ? '₺' : '▭'}</i><span>${esc(h.ad)}</span></button>`).join('')}</div>`
        : '<p class="msg err">Paraşüt\'te kasa ya da banka hesabı bulunamadı.</p>'}
      <label class="f gd-acik"><span>Açıklama</span><input id="thAciklama" type="text" maxlength="200" autocomplete="off" placeholder="isteğe bağlı, ör. elden nakit, Ekim ödemesi" value="${esc(f.aciklama)}"></label>
      <p class="hint">${senetVar() ? 'Senetle ödediyse yukarıdan <b>Senet</b>\'i seçin. ' : ''}Çekle ödediyse buradan girmeyin, çek Paraşüt'ten girilir.</p>
    </div>`;
  }

  function gecmisHtml() {
    const l = (T.k?.gecmis || []).slice(0, 8);
    if (!l.length) return '';
    return `<div class="card odm-gecmis"><h3>Panelden girilen ödemeler</h3>
      <ul class="odm-l">${l.map(g => `<li><div><b>${esc(g.kisi)}</b><small>${dt(g.tarih)} · ${esc(g.hesap)}${g.aciklama ? ' · ' + esc(g.aciklama) : ''}${g.kim ? ' · ' + esc(String(g.kim).split('@')[0]) : ''}${g.site?.durum === 'hata' ? ' · <span class="gd-kirmizi">siteye yazılamadı</span>' : ''}</small></div><b class="num pos">+${tl2(g.tutar)}</b></li>`).join('')}</ul></div>`;
  }

  // Cari hesap sayfasının üstünde açılan form
  function kart() {
    if (!T.acik) return '';
    if (!T.k && !T.yuk && !T.hata) setTimeout(() => yukle(false), 0);
    return `<section class="odm" id="thKart">
      <div class="odm-h"><div><h2>Ödeme gir</h2><p class="sub">Müşteriden tahsilat: nakit, havale, kart${senetVar() ? ' ya da senet' : ''}. Paraşüt'te müşterinin carisine tahsilat olarak girer, kasa ve bankalar Paraşüt'ten gelir.</p></div>
        <button class="btn sm ghost" data-act="thKapat">Kapat</button></div>
      <div class="gd-ust">${formHtml()}<div class="gd-sag">${senetMi() && T.k ? `<div class="card gd-ozet" id="snOzet">${CLK.senetGom.ozet()}</div>` : `<div class="card gd-ozet" id="thOzet">${ozetHtml()}</div>`}${gecmisHtml()}</div></div>
    </section>`;
  }
  function ac(siteId) {
    T.acik = true; T.sonuc = null; T.uyari = ''; T.onay = false;
    if (siteId) { T.f = yeniForm(); delete ARA.thKisi; T.siteSec = Number(siteId); siteSecUygula(); }
    if (S.route !== 'cari') CLK.go('cari'); else ciz();
    setTimeout(() => $('#thKart')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }
  // Cari hesap sayfası çizilince: senet seçiliyse senet alanlarının olayları bağlanır
  const bagla = () => { if (T.acik && senetMi() && T.k) CLK.senetGom.bagla(); };
  CLK.tahsilat = { kart, ac, bagla, dugme: (siteId) => CLK.izin('cari') ? `<button class="btn gold sm" data-act="thAc"${siteId ? ` data-u="${esc(siteId)}"` : ''}>Ödeme gir</button>` : '' };

  araSec.thKisi = m => { T.f.kisi = m; T.onay = false; T.uyari = ''; };

  async function kaydet() {
    const f = T.f, e = eksik();
    if (e.length) { T.uyari = e[0]; T.onay = false; ozetYenile(); return; }
    if (!T.onay) { T.onay = true; T.uyari = ''; ozetYenile(); setTimeout(() => { if (T.onay && !T.kaydediyor) { T.onay = false; ozetYenile(); } }, 10000); return; }
    T.kaydediyor = true; T.onay = false; T.uyari = ''; T.sonuc = null; ciz();
    const istek = T.istek ||= uuid();
    try {
      const r = await yazIstek({ islem: 'tahsilat', istek, musteri: f.kisi.id, tutar: para(f.tutar), tarih: f.tarih, hesap: f.hesap, aciklama: f.aciklama.trim() });
      T.sonuc = r; T.istek = '';
      try { localStorage.setItem(SON_HESAP, f.hesap); } catch { }
      T.f = yeniForm(); delete ARA.thKisi;
      toast(`${r.kisi}: ${tl2(r.tutar)} tahsilat Paraşüt'e girildi`);
      T.kaydediyor = false; ciz();
      $('#thKart')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // geçmiş ve (site carisine yazıldıysa) site bakiyeleri yenilenir
      yukle(false);
      if (r.site?.durum === 'tamam') { CLK.loadUsers(true); CLK.loadBalance(true); }
    } catch (err) {
      // bağlantı hatası değilse istek numarası bırakılır (düzeltilip yeniden denenebilsin); bağlantı koptuysa aynı numara tutulur, ikinci kayıt açılmaz
      if (!err.ag) T.istek = '';
      T.uyari = err.message; T.kaydediyor = false; ciz();
    }
  }

  document.addEventListener('input', e => {
    const id = e.target?.id;
    if (id === 'thTutar') { T.f.tutar = e.target.value; T.onay = false; T.uyari = ''; ozetYenile(); }
    else if (id === 'thAciklama') { T.f.aciklama = e.target.value; T.onay = false; ozetYenile(); }
  });
  document.addEventListener('change', e => {
    if (e.target?.id === 'thTarih') { T.f.tarih = e.target.value; T.onay = false; T.uyari = ''; ciz(); }
  });

  const prevAct = views.onAct;
  views.onAct = (act, el, ev) => {
    if (act === 'thAc') ac(el.dataset.u);
    else if (act === 'thKapat') { T.acik = false; T.onay = false; ciz(); }
    else if (act === 'thYenile') yukle(true);
    else if (act === 'thHesap') { T.f.hesap = el.dataset.id; T.onay = false; T.uyari = ''; ciz(); }
    else if (act === 'thTarihSec') { T.f.tarih = el.dataset.g; T.onay = false; ciz(); }
    else if (act === 'thTamami') { T.f.tutar = el.dataset.v; T.onay = false; ciz(); }
    else if (act === 'thSekil') { T.f.sekil = el.dataset.o === 'senet' ? 'senet' : 'para'; T.onay = false; T.uyari = ''; ciz(); }
    else if (act === 'thKaydet') kaydet();
    else if (act === 'thSonucKapat') { T.sonuc = null; ciz(); }
    else prevAct?.(act, el, ev);
  };
})();
