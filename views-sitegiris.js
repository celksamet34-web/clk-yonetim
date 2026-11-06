/* CLK Yönetim — müşteri adına siteye giriş (celik 06.11.2026: "müşterinin yanına tablet ile gidiyoruz. onun fiyatıyla onun kullanıcı adıyla
   web sitesine girmemiz lazım", "panel üzerinden müşteri girişi", "müşteriye veririm şifresini").
   Qukasoft'ta "üye olarak giriş" yok, API şifre yazamıyor. Yönetici müşteriye bir site şifresi belirler (panel kolay yazılır bir şifre önerir) ve
   Qukasoft yönetiminde üyenin "Yeni Şifre"sine kendisi yapıştırır; şifre Supabase site-giris'te saklanır, personel görmez.
   Müşteri sayfasında "Sitede bu müşteri olarak aç": site-giris `ac` 2 dakikalık tek kullanımlık kod verir, site giriş sayfası #clkgiris=<kod> ile açılır,
   temadaki "CLK MÜŞTERİ GİRİŞİ" kodu e-posta ve şifreyi alıp girişi kendisi yapar (şifre adres çubuğuna yazılmaz) ve sonucu bildirir.
   Müşterilerin site e-postaları 06.11'de kısa ada çevrildi (duman@clkcanta.com); sitede giriş kutusuna yalnız "duman" yazmak yeter.
   v2 (06.11): Kaydet'te sunucu şifreyi sitenin kendi giriş isteğiyle dener, tutmazsa API'yle yazmayı dener; o da olmazsa Qukasoft'a yapıştırma adımı
   ve "Yapıştırdım, dene" (dogrula) çıkar. Kartta sitede cariden ödeme için eksik olanlar (bayilik, vergi no, adres, eksi bakiye) yazar; yönetici
   eksi bakiyeyi buradan açar (`cari_ac`), adres ve vergi için Bilgileri düzenle açılır. Kullanıcı adı hâlâ p<id>@clkcanta.com olan üyeye kısa ad önerilir. */
(() => {
  const { sb, S, esc, toast, views, render, dt, dtt } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/site-giris';
  const SITE = 'https://www.clkcanta.com';
  // d: üye → durum, yuk/hata: okuma durumu, form: yöneticinin kurma formu, acilan: açılmakta olan üye
  const G = (S.ui.sgi ||= { d: {}, yuk: {}, hata: {}, form: null, acilan: '' });
  const ciz = () => { if (S.route === 'musteri') { S.keepScroll = true; render(); } };
  const yon = () => CLK.yonetici();
  const gorur = () => yon() || CLK.izin('musteriler') || CLK.izin('cari') || CLK.izin('siparisgir');
  const kAd = e => String(e || '').replace(/@clkcanta\.com$/i, '');
  const telNo = t => { let d = String(t || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.length === 11 && d[0] === '0') d = '9' + d; else if (d.length === 10 && d[0] === '5') d = '90' + d; return /^90\d{10}$/.test(d) ? d : ''; };

  async function sor(govde) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.hata) throw new Error(/bilinmeyen işlem/.test(j?.hata || '') ? 'Sunucu güncellemesi bekleniyor.' : j?.hata || (r.status === 404 ? 'Site girişi sunucusu bulunamadı.' : 'Sunucu ' + r.status));
    return j;
  }
  function durumAl(uid, zorla) {
    if (G.yuk[uid] || (!zorla && (G.d[uid] || G.hata[uid]))) return;
    G.yuk[uid] = true; G.hata[uid] = '';
    sor({ islem: 'durum', uye: Number(uid) }).then(d => { G.d[uid] = d; }, e => { G.hata[uid] = e.message; }).finally(() => { G.yuk[uid] = false; ciz(); });
  }

  const durumYazi = d => d.durum === 'tamam' ? `Son giriş ${dtt(d.son_giris)}`
    : d.durum === 'hatali' ? `<span class="sgi-k">Son denemede giriş olmadı${d.son_hata ? ': ' + esc(d.son_hata) : ''}. Şifre Qukasoft'taki ile aynı mı?</span>`
    : 'Henüz denenmedi. Şifre Qukasoft\'a girildiyse ilk açılışta denenir.';

  function formHtml(u) {
    const f = G.form, ilk = !G.d[String(u.id)]?.kurulu, dis = f.is ? 'disabled' : '';
    if (f.adim) return `<div class="sgi-form">
      <small class="mk-et">ŞİFREYİ SİTEYE GİRİN</small>
      <small class="sgi-n"><span class="sgi-k">Site bu şifreyi kendiliğinden almadı${f.mesaj ? ' (' + esc(f.mesaj) + ')' : ''}.</span></small>
      <dl><dt>Kullanıcı adı</dt><dd><b>${esc(f.kullanici || kAd(u.email))}</b></dd><dt>Şifre</dt><dd><b class="sgi-s">${esc(f.sifre)}</b></dd></dl>
      <ol>
        <li><button class="btn sm mk-koyu" data-act="sgiKopya" data-v="sifre">Şifreyi kopyala</button></li>
        <li>Qukasoft yönetimi › Müşteriler › Üyeler'de <b>#${u.id}</b> satırındaki anahtar düğmesine (Yeni Şifre) yapıştırıp "Şifreyi Oluştur"a basın. <a href="${SITE}/admin/customer/index" target="_blank" rel="noopener">Qukasoft'u aç</a></li>
        <li>Buraya dönüp "Yapıştırdım, dene"ye basın.</li>
      </ol>
      ${f.hata ? `<p class="sgi-k">${esc(f.hata)}</p>` : ''}
      <div class="mk-dug"><button class="btn gold" data-act="sgiDene" data-u="${u.id}" ${dis}>${f.is ? 'Deneniyor…' : 'Yapıştırdım, dene'}</button><button class="btn mk-koyu" data-act="sgiVazgec" ${dis}>Sonra</button></div>
    </div>`;
    return `<div class="sgi-form">
      <small class="mk-et">${ilk ? 'SİTE GİRİŞİ KUR' : 'ŞİFREYİ DEĞİŞTİR'}</small>
      ${f.adDegisir ? `<label>Kullanıcı adı<input id="sgiAd" value="${esc(f.kullanici)}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Site kullanıcı adı" ${dis}></label>
        <small class="sgi-n">Şimdiki giriş adı ${esc(u.email || '')}; kısa adla değişir (müşteri sitede bu adla girer).</small>`
        : `<dl><dt>Kullanıcı adı</dt><dd><b>${esc(kAd(u.email))}</b> <small>(${esc(u.email || '')})</small></dd></dl>`}
      <label>Şifre<span class="sgi-sat"><input id="sgiSifre" value="${esc(f.sifre)}" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="text" aria-label="Site şifresi" ${dis}>
        <button class="btn sm mk-koyu" data-act="sgiOneri" ${dis}>Yeni öner</button></span></label>
      <small class="sgi-n">Kaydet'e basınca site bu şifreyi dener; tutmazsa Qukasoft'a yapıştırma adımı çıkar.</small>
      ${f.hata ? `<p class="sgi-k">${esc(f.hata)}</p>` : ''}
      <div class="mk-dug"><button class="btn gold" data-act="sgiKaydet" data-u="${u.id}" ${dis}>${f.is ? 'Kaydediliyor ve deneniyor…' : 'Kaydet'}</button><button class="btn mk-koyu" data-act="sgiVazgec" ${dis}>Vazgeç</button></div>
    </div>`;
  }

  // sitede cariden ödeme şartlarından eksik olanlar (sunucu `durum` → eksik): yönetici ve cari yetkisi görür
  function eksikHtml(u, d) {
    if (!d?.eksik?.length || !(yon() || CLK.izin('cari'))) return '';
    const uid = String(u.id), cariEksik = d.eksik.some(x => /^Eksi bakiye|^Bayi/.test(x)), bilgiEksik = d.eksik.some(x => /Vergi|adres/.test(x));
    const bal = Number(u.balance) || 0, oneri = Math.max(100000, Math.ceil((-bal * 1.5) / 10000) * 10000);
    const c = G.cari?.uid === uid ? G.cari : null;
    return `<div class="sgi-eks"><small class="sgi-n"><span class="sgi-k">Sitede cariden ödeme için eksik:</span></small>
      <ul class="sgi-eksik">${d.eksik.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      ${bilgiEksik && (CLK.izin('musteriler') || CLK.izin('cari')) ? `<div class="mk-dug"><button class="btn sm mk-koyu" data-act="sgiBilgi" data-u="${uid}">Bilgileri düzenle</button></div>` : ''}
      ${cariEksik && yon() ? `<div class="sgi-cari"><input id="sgiLimit" data-u="${uid}" inputmode="numeric" value="${esc(c?.limit ?? String(oneri))}" aria-label="Eksi bakiye limiti (TL)" ${c?.is ? 'disabled' : ''}>
        <button class="btn sm gold" data-act="sgiCari" data-u="${uid}" ${c?.is ? 'disabled' : ''}>${c?.is ? 'Açılıyor…' : d.uye && !d.uye.bayi ? 'Bayi yap, eksi bakiyeyi aç' : 'Eksi bakiyeyi aç'}</button></div>
        <small class="sgi-n">Limit kadar borçla sitede cariden ödeyebilir.</small>${c?.hata ? `<small class="sgi-n sgi-k">${esc(c.hata)}</small>` : ''}` : ''}
    </div>`;
  }

  // müşteri sayfasındaki koyu yan kart için blok
  function html(u, pasif) {
    if (!u || pasif || !gorur()) return '';
    const uid = String(u.id);
    if (G.form?.uid === uid && yon()) return `<div class="sgi">${formHtml(u)}</div>`;
    durumAl(uid);
    const d = G.d[uid];
    const fiyatNot = yon() && Number(u.dealerStatus) === 1 && !Number(u.priceType)
      ? '<small class="sgi-n">Fiyat tanımı "Varsayılan": sitede site fiyatını görür. Bayi fiyatı için Bilgiler › Bilgileri düzenle.</small>' : '';
    if (!d) return `<div class="sgi"><small class="mk-et">SİTE GİRİŞİ</small><small class="sgi-n">${G.hata[uid] ? `<span class="sgi-k">${esc(G.hata[uid])}</span> <button class="btn sm mk-koyu" data-act="sgiYenile" data-u="${uid}">Tekrar dene</button>` : 'Yükleniyor…'}</small></div>`;
    if (!d.kurulu) return `<div class="sgi"><small class="mk-et">SİTE GİRİŞİ</small>
      ${yon() ? `<small class="sgi-n">Bu müşteri için site şifresi yok. Kurunca tabletten onun hesabıyla siteye girilir.</small><div class="mk-dug"><button class="btn mk-koyu" data-act="sgiKur" data-u="${uid}">Site girişi kur</button></div>`
        : '<small class="sgi-n">Site girişi kurulmamış, yönetici kurar.</small>'}${fiyatNot}${eksikHtml(u, d)}</div>`;
    const acilan = G.acilan === uid;
    return `<div class="sgi"><small class="mk-et">SİTE GİRİŞİ</small>
      <div class="mk-dug"><button class="btn gold" data-act="sgiAc" data-u="${uid}" ${acilan ? 'disabled' : ''}>${acilan ? 'Site açılıyor…' : 'Sitede bu müşteri olarak aç'}</button></div>
      <dl><dt>Kullanıcı adı</dt><dd><b>${esc(d.kullanici)}</b></dd>${yon() && d.sifre ? `<dt>Şifre</dt><dd><b class="sgi-s">${esc(d.sifre)}</b> <button class="btn sm mk-koyu" data-act="sgiKopya" data-v="kayitli" data-u="${uid}">Kopyala</button></dd>` : ''}</dl>
      <small class="sgi-n">${G.dene === uid ? 'Site şifreyi deniyor…' : durumYazi(d)}</small>${fiyatNot}
      ${yon() ? `<div class="sgi-yon"><button class="btn sm mk-koyu" data-act="sgiWa" data-u="${uid}"><span aria-hidden="true" class="sgi-wa">✆</span> Müşteriye gönder</button><button class="btn sm mk-koyu" data-act="sgiDene" data-u="${uid}" ${G.dene ? 'disabled' : ''}>Şifreyi dene</button><button class="btn sm mk-koyu" data-act="sgiKur" data-u="${uid}">Şifreyi değiştir</button></div>` : ''}
      ${eksikHtml(u, d)}
    </div>`;
  }

  async function kurAc(uid) {
    const d = G.d[uid];
    G.form = { uid, sifre: d?.sifre || '', is: !d?.sifre, hata: '', adim: false, adDegisir: !!(d && d.kisaAd === false && d.oneriAd), kullanici: d?.oneriAd || '' };
    ciz();
    if (!d?.sifre) {
      try { G.form.sifre = (await sor({ islem: 'oneri' })).sifre; } catch (e) { G.form.hata = e.message; }
      if (G.form?.uid === uid) { G.form.is = false; ciz(); }
    }
  }
  async function kaydet(uid) {
    const f = G.form; if (!f || f.is) return;
    const sifre = String(document.getElementById('sgiSifre')?.value ?? f.sifre).trim();
    f.sifre = sifre;
    if (f.adDegisir) f.kullanici = String(document.getElementById('sgiAd')?.value ?? f.kullanici).trim().toLowerCase();
    if (sifre.length < 6 || /\s/.test(sifre)) { f.hata = 'Şifre en az 6 karakter olmalı, boşluk olmamalı.'; ciz(); return; }
    if (f.adDegisir && !/^[a-z0-9]{3,20}$/.test(f.kullanici)) { f.hata = 'Kullanıcı adı 3–20 harf ya da rakam olmalı (Türkçe harf, boşluk, nokta yok).'; ciz(); return; }
    f.is = true; f.hata = ''; ciz();
    try {
      const r = await sor({ islem: 'kaydet', uye: Number(uid), sifre, ...(f.adDegisir ? { kullanici: f.kullanici } : {}) });
      G.d[uid] = r;
      // kullanıcı adı değiştiyse paneldeki üye e-postası da
      const u = (S.users || []).find(x => String(x.id) === uid); if (u && r.eposta) u.email = r.eposta;
      if (r.durum === 'tamam') { G.form = null; toast('Site girişi kaydedildi, şifre çalışıyor'); }
      else Object.assign(f, { is: false, adim: true, kullanici: r.kullanici || f.kullanici, mesaj: r.son_hata || r.deneme?.sonra?.mesaj || r.deneme?.once?.mesaj || '' });
    } catch (e) { f.is = false; f.hata = e.message; }
    ciz();
  }
  // kayıtlı şifreyi sunucudan sitenin giriş isteğiyle dener (tarayıcıda oturum açılmaz)
  async function dene(uid) {
    const f = G.form?.uid === uid ? G.form : null;
    if (f) { if (f.is) return; f.is = true; f.hata = ''; } else { if (G.dene) return; G.dene = uid; }
    ciz();
    try {
      const r = await sor({ islem: 'dogrula', uye: Number(uid) });
      G.d[uid] = r;
      if (r.dogrula?.ok) { if (f) G.form = null; toast('Şifre çalışıyor, site girişi hazır'); }
      else if (f) Object.assign(f, { hata: 'Site yine kabul etmedi' + (r.dogrula?.mesaj ? ': ' + r.dogrula.mesaj : '') + '. Qukasoft\'ta doğru üyeye mi yapıştırıldı?' });
      else toast('Site şifreyi kabul etmedi' + (r.dogrula?.mesaj ? ': ' + r.dogrula.mesaj : ''));
    } catch (e) { if (f) f.hata = e.message; else toast(e.message); }
    if (f) f.is = false; G.dene = '';
    ciz();
  }
  // sitede eksi bakiye (ve bayilik): borçlu müşteri cariden ödeyebilsin
  async function cariAc(uid) {
    const d = G.d[uid]; if (G.cari?.is) return;
    const limit = Number(String(document.getElementById('sgiLimit')?.value || '').replace(/\D/g, '')) || 0;
    G.cari = { uid, limit: String(limit), is: true, hata: '' };
    if (limit <= 0) { G.cari = { uid, limit: '', is: false, hata: 'Limit yazın.' }; ciz(); return; }
    ciz();
    try {
      const r = await sor({ islem: 'cari_ac', uye: Number(uid), limit, bayi: !!(d?.uye && !d.uye.bayi) });
      G.d[uid] = { ...d, ...r };
      const u = (S.users || []).find(x => String(x.id) === uid);
      if (u) { u.nBalanceStatus = 1; u.nBalanceLimit = limit; if (d?.uye && !d.uye.bayi) u.dealerStatus = 1; }
      G.cari = null; toast(r.uyari || 'Eksi bakiye açıldı');
    } catch (e) { G.cari = { uid, limit: String(limit), is: false, hata: e.message }; }
    ciz();
  }
  async function ac(uid) {
    if (G.acilan) return;
    // açılır pencere kullanıcının dokunuşuyla hemen açılır (yoksa tarayıcı engeller), adresi kod gelince verilir
    let w = null;
    try { w = window.open('about:blank', '_blank'); } catch { w = null; }
    G.acilan = uid; ciz();
    try {
      const j = await sor({ islem: 'ac', uye: Number(uid) });
      if (w && !w.closed) { try { w.opener = null; } catch {} w.location.href = j.adres; }
      else location.href = j.adres;
      // sonucu (son giriş ya da hata) birkaç saniye sonra yeniden oku
      setTimeout(() => durumAl(uid, true), 15000);
      setTimeout(() => durumAl(uid, true), 45000);
    } catch (e) { try { w?.close(); } catch {} toast(e.message); }
    G.acilan = ''; ciz();
  }
  function waGonder(uid) {
    const d = G.d[uid], u = (S.users || []).find(x => String(x.id) === uid);
    if (!d?.sifre) return;
    const metin = `Merhaba, CLK Çanta sitesinde sizin için bayi girişi açtık.\n\nSite: ${SITE}/uye-giris\nKullanıcı adı: ${d.kullanici}\nŞifre: ${d.sifre}\n\nGiriş yaptıktan sonra ürünleri görüp siparişinizi verebilirsiniz.`;
    const tel = telNo(u?.phone);
    if (!tel) toast('Telefon yok ya da eksik: WhatsApp\'ta kişiyi seçin');
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(metin)}`, '_blank', 'noopener');
  }
  const kopya = v => navigator.clipboard?.writeText(v).then(() => toast('Kopyalandı'), () => toast('Kopyalanamadı'));

  // yazılanlar arka plandaki yeniden çizimlerde kaybolmasın
  document.addEventListener('input', e => {
    const id = e.target.id;
    if (id === 'sgiSifre' && G.form) G.form.sifre = e.target.value;
    else if (id === 'sgiAd' && G.form) G.form.kullanici = e.target.value;
    else if (id === 'sgiLimit') { const uid = e.target.dataset.u; G.cari = { ...(G.cari?.uid === uid ? G.cari : { uid, is: false, hata: '' }), limit: e.target.value }; }
  });
  CLK.siteGiris = { html };
  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'sgiAc') ac(el.dataset.u);
    else if (act === 'sgiKur') kurAc(el.dataset.u);
    else if (act === 'sgiVazgec') { G.form = null; ciz(); }
    else if (act === 'sgiKaydet') kaydet(el.dataset.u);
    else if (act === 'sgiOneri') { if (!G.form) return; G.form.is = true; ciz(); sor({ islem: 'oneri' }).then(j => { if (G.form) G.form.sifre = j.sifre; }, x => { if (G.form) G.form.hata = x.message; }).finally(() => { if (G.form) G.form.is = false; ciz(); }); }
    else if (act === 'sgiKopya') kopya(el.dataset.v === 'sifre' ? String(document.getElementById('sgiSifre')?.value ?? G.form?.sifre ?? '') : G.d[el.dataset.u]?.sifre || '');
    else if (act === 'sgiWa') waGonder(el.dataset.u);
    else if (act === 'sgiYenile') durumAl(el.dataset.u, true);
    else if (act === 'sgiDene') dene(el.dataset.u);
    else if (act === 'sgiCari') cariAc(el.dataset.u);
    else if (act === 'sgiBilgi') { if (S.ui.mt) S.ui.mt.tab = 'bilgi'; prevAct?.('bdAc', el, e); }
    else prevAct?.(act, el, e);
  };
})();
