/* CLK Yönetim — Yeni müşteri (celik 06.11.2026: "yeni müşteri ekleme de yap", "bilgilerini de girelim. yeni müşteriye girince panelden uğraşmayalım
   adres ıvır zıvır girelim hepsini kaydı kuydu oluştur", "quka cari ödeme için bazı bilgileri şart koyuyor onlara göre bak").
   Tek formla müşteri Paraşüt'te ve sitede birlikte açılır (Supabase site-giris `musteri_yeni`): Paraşüt müşterisi, sitede bayi üye (kısa kullanıcı adı
   <ad>@clkcanta.com, şifre), eşleşme. Sitede "Cariden Ödeme" yalnız bayilere açık ve vergi no/TC, il, ilçe, adres ister; borçlu müşteri eksi bakiye
   açık değilse cariden ödeyemez: bu yüzden bu alanlar zorunlu, eksi bakiye varsayılan 100.000 TL ile açılır. İl ve ilçe sitenin kendi listesinden (il-ilce.js).
   Aynı ünvan, vergi no ya da telefon sitede veya Paraşüt'te varsa önce gösterilir: var olan Paraşüt müşterisi seçilebilir (Paraşüt'te ikinci kayıt açılmaz).
   Fiyat tanımı, iskonto ve eksi bakiye limiti yalnız yönetici ya da cari yetkisiyle değişir; şifreyi yalnız yönetici görür. Form yazarken çizilmez (telefonda klavye). */
(() => {
  const { sb, S, esc, toast, views, render, go, tl, $ } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/site-giris';
  const SITE = 'https://www.clkcanta.com';
  const FIYAT = { 0: 'Varsayılan (site fiyatı)', 2: 'Bayi fiyatı 1', 3: 'Bayi fiyatı 2', 4: 'Bayi fiyatı 3', 5: 'Bayi fiyatı 4' };
  const LIMIT = 100000;
  const yon = () => CLK.yonetici();
  const fiyatYetki = () => yon() || CLK.izin('cari');
  const istekNo = () => 'ym-' + Array.from(crypto.getRandomValues(new Uint8Array(10)), x => x.toString(16).padStart(2, '0')).join('');
  const bosForm = () => ({ unvan: '', yetkili: '', telefon: '', eposta: '', il: '', ilce: '', adres: '', vergi: '', vergiDaire: '', kullanici: '', sifre: sifreUret(),
    fiyat: '2', iskonto: '0', limit: String(LIMIT) });
  // Y: form, istek (aynı istek iki kez yazılmaz), adElle (kullanıcı adını kişi yazdı), onay (özet gösteriliyor), is, hata, benzer, sonuc
  const Y = (S.ui.ym ||= { form: null });
  function yeni() { Object.assign(Y, { form: bosForm(), istek: istekNo(), adElle: false, onay: false, is: false, hata: '', benzer: null, sonuc: null, parasutId: '', zorla: false }); }
  const ciz = () => { if (S.route === 'yenimusteri') { S.keepScroll = true; render(); } };

  async function sor(govde) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.hata) throw new Error(/bilinmeyen işlem/.test(j?.hata || '') ? 'Sunucu güncellemesi bekleniyor: yeni müşteri sunucusu henüz yayında değil.' : j?.hata || 'Sunucu ' + r.status);
    return j;
  }

  // kolay yazılır şifre (sunucudakiyle aynı kural): 3 harf + 5 rakam, karışan harfler yok
  function sifreUret() {
    const H = 'abcdefghjkmnprstuvyz', b = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(b.slice(0, 3), x => H[x % H.length]).join('') + Array.from(b.slice(3), x => String(x % 10)).join('');
  }
  // ünvandan kısa kullanıcı adı (sunucudaki adOner ile aynı): genel kelimeler atlanır, ilk anlamlı kelime; doluysa iki kelime, sonra sayı
  const GENEL = new Set(['kirtasiye', 'canta', 'cantacilik', 'cantalari', 'bayi', 'bayii', 'ltd', 'sti', 'tic', 'ticaret', 'san', 'sanayi', 've', 'magaza', 'magazasi', 'market', 'avm',
    'as', 'limited', 'sirketi', 'pazarlama', 'ithalat', 'ihracat', 'saraciye', 'oyuncak', 'tekstil', 'giyim', 'abi', 'kardesler', 'ltdsti', 'gida', 'insaat', 'deri',
    'kirtasiyecilik', 'toptan', 'perakende', 'evi', 'dunyasi', 'merkezi', 'otomotiv', 'hediyelik', 'esya', 'aksesuar']);
  const AYRILMIS = new Set(['info', 'admin', 'destek', 'satis', 'muhasebe', 'celiksamet', 'samet', 'celik', 'iletisim', 'siparis', 'noreply', 'test', 'deneme', 'clk', 'clkcanta',
    'bayi', 'yonetim', 'yonetici', 'kargo', 'fatura', 'odeme', 'web', 'www', 'mail', 'posta', 'postmaster', 'abuse', 'hostmaster', 'webmaster', 'root']);
  const asc = v => String(v || '').trim().toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, c => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' })[c]);
  const doluAdlar = () => new Set([...(S.users || []), ...(S.pasifUsers || [])].map(u => String(u.email || '').toLowerCase()));
  function adOner(unvan) {
    const k = asc(unvan).split(/[^a-z0-9]+/).filter(Boolean), anl = k.filter(w => !GENEL.has(w) && w.length >= 2), l = [];
    const ekle = x => { x = x.replace(/[^a-z0-9]/g, '').slice(0, 20); if (x.length >= 3 && !AYRILMIS.has(x) && !l.includes(x)) l.push(x); };
    if (anl[0]) ekle(anl[0]); if (anl[0] && anl[1]) ekle(anl[0] + anl[1]); if (!l.length) { if (k[0]) ekle(k[0]); ekle(k.join('')); }
    if (!l.length) return '';
    const dolu = doluAdlar();
    for (const a of l) if (!dolu.has(a + '@clkcanta.com')) return a;
    for (let i = 2; i < 100; i++) { const a = l[0].slice(0, 18) + i; if (!dolu.has(a + '@clkcanta.com')) return a; }
    return '';
  }
  const rakam = v => String(v ?? '').replace(/\D/g, '');
  function telefon(v) {
    let d = rakam(v);
    if (d.startsWith('0090')) d = d.slice(4); else if (d.startsWith('90') && d.length === 12) d = d.slice(2); else if (d.startsWith('0') && d.length === 11) d = d.slice(1);
    return d.length === 10 ? d : '';
  }
  const ilceler = il => (CLK.ILCE || []).find(([a]) => a === il)?.[1] || [];

  function denetle() {
    const f = Y.form, h = [], v = rakam(f.vergi), ka = asc(f.kullanici);
    if (f.unvan.trim().length < 2) h.push('Firma ünvanını yazın.');
    if (!telefon(f.telefon)) h.push('Telefon 10 hane olmalı (5xx xxx xx xx).');
    if (f.eposta.trim() && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(f.eposta.trim())) h.push('E-posta adresi geçersiz.');
    if (!f.il || !f.ilce) h.push('İl ve ilçe seçin.');
    if (f.adres.trim().length < 5) h.push('Adresi yazın (sitede cariden ödeme ister).');
    if (![10, 11].includes(v.length)) h.push('Vergi no 10, TC kimlik no 11 hane olmalı (sitede cariden ödeme ister).');
    if (v.length === 10 && !f.vergiDaire.trim()) h.push('Vergi dairesini yazın.');
    if (!/^[a-z0-9]{3,20}$/.test(ka)) h.push('Kullanıcı adı 3–20 harf ya da rakam olmalı (boşluk, nokta yok).');
    else if (AYRILMIS.has(ka)) h.push(`"${ka}" ayrılmış bir ad, başka ad yazın.`);
    else if (doluAdlar().has(ka + '@clkcanta.com')) h.push(`"${ka}" kullanıcı adı başka bir müşteride var.`);
    if (yon() && (f.sifre.trim().length < 6 || /\s/.test(f.sifre.trim()))) h.push('Şifre en az 6 karakter olmalı, boşluk olmamalı.');
    if (fiyatYetki()) {
      const isk = Number(String(f.iskonto || '0').replace(',', '.')), lim = Number(rakam(f.limit) || 0);
      if (!Number.isFinite(isk) || isk < 0 || isk > 100) h.push('İskonto 0 ile 100 arasında olmalı.');
      if (lim > 50000000) h.push('Eksi bakiye limiti en çok 50.000.000.');
    }
    return h;
  }

  async function gonder() {
    if (Y.is) return;
    const f = Y.form;
    Y.is = true; Y.hata = ''; ciz();
    const govde = { islem: 'musteri_yeni', istek: Y.istek, unvan: f.unvan.trim(), yetkili: f.yetkili.trim(), telefon: f.telefon, eposta: f.eposta.trim(),
      il: f.il, ilce: f.ilce, adres: f.adres.trim(), vergi: rakam(f.vergi), vergiDaire: f.vergiDaire.trim(), kullanici: asc(f.kullanici),
      ...(yon() ? { sifre: f.sifre.trim() } : {}),
      ...(fiyatYetki() ? { fiyat: Number(f.fiyat), iskonto: Number(String(f.iskonto || '0').replace(',', '.')) || 0, limit: Number(rakam(f.limit) || 0) } : {}),
      ...(Y.parasutId ? { parasutId: Y.parasutId } : {}), ...(Y.zorla ? { zorla: true } : {}) };
    try {
      const r = await sor(govde);
      if (r.benzer) { Y.benzer = r; Y.onay = false; }
      else if (r.tamam) { Y.sonuc = { ...r, unvan: govde.unvan, sifre: govde.sifre || '', telefon: telefon(f.telefon) }; Y.onay = false; Y.benzer = null; CLK.loadUsers(true); toast('Müşteri açıldı'); }
      else Y.hata = 'Sunucudan beklenmeyen yanıt geldi.';
    } catch (e) { Y.hata = e.message; Y.onay = false; }
    Y.is = false; ciz();
    const yer = Y.sonuc ? null : Y.benzer ? '.ym-benzer' : Y.hata ? '.msg.err' : null;
    if (Y.sonuc) window.scrollTo({ top: 0 }); else if (yer) requestAnimationFrame(() => document.querySelector(yer)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  const alan = (k, ad, ek = {}) => {
    const f = Y.form, gerekli = ek.gerekli ? ' <i aria-hidden="true">*</i>' : '';
    const dis = Y.is || Y.onay ? 'disabled' : '';
    const ust = `<label class="bd-a${ek.genis ? ' bd-genis' : ''}" for="ym-${k}"><span>${ad}${gerekli}</span>`;
    if (ek.secim) return `${ust}<select id="ym-${k}" data-ym="${k}" ${ek.gerekli ? 'aria-required="true"' : ''} ${dis}>${ek.secim}</select>${ek.not ? `<small class="ym-n">${ek.not}</small>` : ''}</label>`;
    return `${ust}<input id="ym-${k}" data-ym="${k}" value="${esc(f[k])}" type="${ek.tip || 'text'}" ${ek.im ? `inputmode="${ek.im}"` : ''} autocomplete="off" ${ek.ac === false ? 'autocapitalize="off" spellcheck="false"' : ''} ${ek.ph ? `placeholder="${esc(ek.ph)}"` : ''} ${ek.gerekli ? 'aria-required="true"' : ''} ${dis}>${ek.not ? `<small class="ym-n">${ek.not}</small>` : ''}</label>`;
  };
  const ilSecim = () => `<option value="">İl seçin</option>` + (CLK.ILCE || []).map(([il]) => `<option${Y.form.il === il ? ' selected' : ''}>${esc(il)}</option>`).join('');
  const ilceSecim = () => !Y.form.il ? '<option value="">Önce il seçin</option>' : `<option value="">İlçe seçin</option>` + ilceler(Y.form.il).map(x => `<option${Y.form.ilce === x ? ' selected' : ''}>${esc(x)}</option>`).join('');

  function formHtml() {
    const f = Y.form, fy = fiyatYetki();
    return `<div class="card ym">
      <h3 class="ym-h">Firma</h3>
      <div class="bd-g">${alan('unvan', 'Firma ünvanı', { gerekli: true, genis: true, ph: 'Örn. DUMAN KIRTASİYE' })}
        ${alan('telefon', 'Telefon', { gerekli: true, tip: 'tel', im: 'tel', ac: false, ph: '05xx xxx xx xx' })}
        ${alan('yetkili', 'Yetkili kişi', { ph: 'Ad soyad', not: 'İsteğe bağlı, Paraşüt\'te müşterinin yetkilisi olur.' })}
        ${alan('eposta', 'E-posta', { tip: 'email', ac: false, genis: true, not: 'İsteğe bağlı, yalnız Paraşüt\'e yazılır. Müşteri sitede kullanıcı adıyla girer.' })}</div>
      <h3 class="ym-h">Adres</h3>
      <div class="bd-g">${alan('il', 'İl', { gerekli: true, secim: ilSecim() })}${alan('ilce', 'İlçe', { gerekli: true, secim: ilceSecim() })}
        ${alan('adres', 'Açık adres', { gerekli: true, genis: true, ph: 'Mahalle, sokak, no', not: 'Fatura ve teslimat adresi aynı yazılır.' })}</div>
      <h3 class="ym-h">Vergi</h3>
      <div class="bd-g">${alan('vergi', 'Vergi no ya da TC kimlik no', { gerekli: true, im: 'numeric', ac: false, not: 'Vergi no 10, TC 11 hane.' })}
        ${alan('vergiDaire', 'Vergi dairesi', { not: 'Vergi no yazıldıysa gerekli.' })}</div>
      ${fy ? `<h3 class="ym-h">Sitede fiyat ve cari</h3>
      <div class="bd-g">${alan('fiyat', 'Fiyat tanımı', { secim: Object.entries(FIYAT).map(([v, t]) => `<option value="${v}"${String(f.fiyat) === v ? ' selected' : ''}>${t}</option>`).join('') })}
        ${alan('iskonto', 'İskonto %', { im: 'decimal', ac: false })}
        ${alan('limit', 'Eksi bakiye limiti (TL)', { im: 'numeric', ac: false, genis: true, not: 'Borçlu müşteri sitede bu tutara kadar cariden ödeyebilir. 0 yazılırsa eksi bakiye kapalı kalır.' })}</div>` : ''}
      <h3 class="ym-h">Site girişi</h3>
      <div class="bd-g">${alan('kullanici', 'Kullanıcı adı', { gerekli: true, ac: false, not: 'Müşteri sitede bu adla girer (sonuna @clkcanta.com eklenir). Ünvandan önerilir, değiştirebilirsiniz.' })}
        ${yon() ? `<label class="bd-a" for="ym-sifre"><span>Şifre <i aria-hidden="true">*</i></span><span class="ym-sat"><input id="ym-sifre" data-ym="sifre" type="text" value="${esc(f.sifre)}" autocomplete="off" autocapitalize="off" spellcheck="false" ${Y.is || Y.onay ? 'disabled' : ''}><button class="btn sm" data-act="ymSifre" ${Y.is || Y.onay ? 'disabled' : ''}>Yeni öner</button></span><small class="ym-n">Müşteriye bu şifreyi verirsiniz.</small></label>` : '<p class="hint bd-genis">Şifreyi sunucu üretir, yönetici müşteri sayfasında görür.</p>'}</div>
      <p class="hint">* işaretli alanlar zorunlu: sitede cariden ödeme için bayilik, vergi no ya da TC, il, ilçe ve adres gerekir. Müşteri Paraşüt'te ve sitede bayi olarak açılır.</p>
      ${Y.hata ? `<p class="msg err">${esc(Y.hata)}</p>` : ''}
      ${Y.onay ? '' : `<div class="bd-d"><button class="btn gold" data-act="ymDevam" ${Y.is ? 'disabled' : ''}>Devam</button><button class="btn" data-go="musteriler" ${Y.is ? 'disabled' : ''}>Vazgeç</button></div>`}
    </div>`;
  }

  function ozetHtml() {
    const f = Y.form, fy = fiyatYetki(), lim = fy ? Number(rakam(f.limit) || 0) : LIMIT;
    const pSecili = Y.parasutId ? (Y.benzer?.parasut || []).find(x => String(x.id) === String(Y.parasutId)) : null;
    return `<div class="card ym-ozet" role="region" aria-label="Açılacak müşteri">
      <h3 class="ym-h">Kontrol edin</h3>
      <dl class="mk-dl">
        <dt>Paraşüt</dt><dd>${pSecili ? `Var olan müşteriye bağlanır: <b>${esc(pSecili.ad)}</b>` : `Yeni müşteri açılır: <b>${esc(f.unvan.trim())}</b>`}</dd>
        <dt>Site</dt><dd>Bayi üye, ${esc(FIYAT[fy ? f.fiyat : 2] || '')}${fy && Number(f.iskonto) ? `, iskonto %${esc(f.iskonto)}` : ''}</dd>
        <dt>Eksi bakiye</dt><dd>${lim > 0 ? tl(lim) + ' limitle açık' : 'Kapalı'}</dd>
        <dt>Telefon</dt><dd>${esc(f.telefon)}${f.yetkili.trim() ? ' · ' + esc(f.yetkili.trim()) : ''}</dd>
        <dt>Adres</dt><dd>${esc(f.adres.trim())}, ${esc(f.ilce)} / ${esc(f.il)}</dd>
        <dt>${rakam(f.vergi).length === 11 ? 'TC kimlik' : 'Vergi'}</dt><dd>${esc(f.vergiDaire.trim())} ${esc(rakam(f.vergi))}</dd>
        <dt>Kullanıcı adı</dt><dd><b>${esc(asc(f.kullanici))}</b></dd>${yon() ? `<dt>Şifre</dt><dd><b class="ym-s">${esc(f.sifre.trim())}</b></dd>` : ''}
      </dl>
      ${Y.hata ? `<p class="msg err">${esc(Y.hata)}</p>` : ''}
      <div class="bd-d"><button class="btn gold" data-act="ymAc" ${Y.is ? 'disabled' : ''}>${Y.is ? 'Açılıyor… (yarım dakika sürebilir)' : 'Onayla, müşteriyi aç'}</button><button class="btn" data-act="ymDuzelt" ${Y.is ? 'disabled' : ''}>Düzelt</button></div>
    </div>`;
  }

  function benzerHtml() {
    const b = Y.benzer; if (!b) return '';
    return `<div class="card ym-benzer" role="alert">
      <h3 class="ym-h">Bu müşteri zaten olabilir</h3>
      ${b.site?.length ? `<p class="sub">Sitede:</p><ul class="ym-l">${b.site.map(x => `<li><div><b>${esc(x.ad)}</b><small>#${esc(x.id)} · ${esc(x.neden)}</small></div><button class="btn sm" data-user="${esc(x.id)}">Müşteriyi aç</button></li>`).join('')}</ul>` : ''}
      ${b.parasut?.length ? `<p class="sub">Paraşüt'te (sitede üyesi yok):</p><ul class="ym-l">${b.parasut.map(x => `<li><div><b>${esc(x.ad)}</b><small>${esc(x.neden)}</small></div><button class="btn sm dark" data-act="ymPid" data-pid="${esc(x.id)}" ${Y.is ? 'disabled' : ''}>Bunu kullan</button></li>`).join('')}</ul>
        <p class="hint">"Bunu kullan" Paraşüt'te yeni kayıt açmaz, sitede bu müşteriye bağlı üye açar.</p>` : ''}
      <div class="bd-d"><button class="btn" data-act="ymZorla" ${Y.is ? 'disabled' : ''}>Hiçbiri değil, yeni müşteri aç</button><button class="btn" data-act="ymDuzelt" ${Y.is ? 'disabled' : ''}>Forma dön</button></div>
    </div>`;
  }

  function sonucHtml() {
    const r = Y.sonuc, girdi = r.giris === 'tamam';
    return `<div class="card ym-sonuc">
      <p class="msg ok">${esc(r.unvan)} açıldı${r.tekrar ? ' (daha önce açılmıştı)' : ''}.</p>
      <dl class="mk-dl">
        <dt>Paraşüt</dt><dd>${r.parasutYeni ? 'Yeni müşteri açıldı' : 'Var olan müşteriye bağlandı'}</dd>
        <dt>Site</dt><dd>Bayi üye #${esc(r.uye)}</dd>
        <dt>Kullanıcı adı</dt><dd><b>${esc(r.kullanici)}</b></dd>
        ${r.sifre ? `<dt>Şifre</dt><dd><b class="ym-s">${esc(r.sifre)}</b> <button class="btn sm" data-act="ymKopya">Kopyala</button></dd>` : ''}
      </dl>
      ${girdi ? '<p class="hint">Site girişi denendi, çalışıyor. Müşteri sayfasındaki "Sitede bu müşteri olarak aç" ile tabletten onun hesabıyla girilir.</p>'
        : `<div class="ym-adim"><b>Bir adım kaldı: şifreyi siteye girin</b>
          <p>Site şifreyi kendiliğinden almadı${r.girisMesaj ? ` (${esc(r.girisMesaj)})` : ''}. ${yon() ? `Şifreyi kopyalayın, Qukasoft yönetimi › Müşteriler › Üyeler'de <b>#${esc(r.uye)}</b> satırındaki anahtar düğmesine (Yeni Şifre) yapıştırıp "Şifreyi Oluştur"a basın. Sonra müşteri sayfasında "Şifreyi dene".` : 'Yönetici şifreyi Qukasoft yönetiminde bu üyeye girecek.'}</p>
          ${yon() ? `<a class="btn sm dark" href="${SITE}/admin/customer/index" target="_blank" rel="noopener">Qukasoft'u aç</a>` : ''}</div>`}
      ${r.uyari?.length ? `<p class="msg err">${r.uyari.map(esc).join('<br>')}</p>` : ''}
      <div class="bd-d"><button class="btn gold" data-act="ymGit" data-u="${esc(r.uye)}">Müşteri sayfasını aç</button>${yon() && r.sifre ? '<button class="btn" data-act="ymWa"><span aria-hidden="true">✆</span> Giriş bilgisini WhatsApp\'la gönder</button>' : ''}<button class="btn" data-act="ymYeni">Yeni müşteri daha</button></div>
    </div>`;
  }

  views.yenimusteri = () => {
    if (!Y.form) yeni();
    if (!S.uLoaded && !S.uLoading) CLK.loadUsers(); // kullanıcı adı önerisi doluları görsün
    const back = '<button class="btn sm" data-go="musteriler">← Müşteriler</button>';
    const govde = Y.sonuc ? sonucHtml() : (Y.onay ? '' : benzerHtml()) + formHtml() + (Y.onay ? ozetHtml() : '');
    return CLK.head('Satış', 'Yeni müşteri', 'Paraşüt\'te ve sitede birlikte açılır, cariden ödeme için gereken bilgilerle', back) + govde;
  };
  views.bind_yenimusteri = () => {
    document.querySelectorAll('[data-ym]').forEach(i => {
      const k = i.dataset.ym;
      i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', () => {
        if (!Y.form) return;
        let v = i.value;
        if (k === 'kullanici') { const t = asc(v).replace(/[^a-z0-9]/g, ''); if (t !== v) { i.value = t; v = t; } Y.adElle = !!t; }
        Y.form[k] = v;
        if (k === 'il') {
          // ilçe listesi yalnız kendi kutusunda yenilenir (sayfa çizilmez)
          Y.form.ilce = '';
          const s = $('#ym-ilce'); if (s) s.innerHTML = ilceSecim();
        }
        if (k === 'unvan' && !Y.adElle) {
          clearTimeout(i.t);
          i.t = setTimeout(() => { const a = adOner(Y.form.unvan); Y.form.kullanici = a; const ki = $('#ym-kullanici'); if (ki) ki.value = a; }, 250);
        }
      });
    });
  };

  function waGonder() {
    const r = Y.sonuc; if (!r?.sifre) return;
    const metin = `Merhaba, CLK Çanta sitesinde sizin için bayi girişi açtık.\n\nSite: ${SITE}/uye-giris\nKullanıcı adı: ${r.kullanici}\nŞifre: ${r.sifre}\n\nGiriş yaptıktan sonra ürünleri görüp siparişinizi verebilirsiniz.`;
    const tel = r.telefon ? '90' + r.telefon : '';
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(metin)}`, '_blank', 'noopener');
  }

  // Sipariş gir ya da başka sayfalar yeni müşteri formunu ünvanla açabilir
  CLK.yeniMusteri = (unvan) => { yeni(); if (unvan) { Y.form.unvan = String(unvan); Y.form.kullanici = adOner(unvan); } go('yenimusteri'); };

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'ymDevam') {
      const h = denetle();
      if (h.length) { Y.hata = h.join(' '); ciz(); requestAnimationFrame(() => document.querySelector('.ym .msg.err')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return; }
      Y.hata = ''; Y.onay = true; ciz();
      requestAnimationFrame(() => document.querySelector('.ym-ozet')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
    else if (act === 'ymDuzelt') { Y.onay = false; Y.benzer = null; Y.parasutId = ''; Y.zorla = false; Y.hata = ''; ciz(); }
    else if (act === 'ymAc') gonder();
    else if (act === 'ymPid') { Y.parasutId = el.dataset.pid; Y.zorla = true; Y.hata = ''; Y.onay = true; ciz(); }
    else if (act === 'ymZorla') { Y.parasutId = ''; Y.zorla = true; Y.hata = ''; Y.onay = true; ciz(); }
    else if (act === 'ymSifre') { if (Y.form) { Y.form.sifre = sifreUret(); const i = $('#ym-sifre'); if (i) i.value = Y.form.sifre; } }
    else if (act === 'ymKopya') navigator.clipboard?.writeText(Y.sonuc?.sifre || '').then(() => toast('Kopyalandı'), () => toast('Kopyalanamadı'));
    else if (act === 'ymWa') waGonder();
    else if (act === 'ymYeni') { yeni(); ciz(); window.scrollTo({ top: 0 }); }
    else if (act === 'ymGit') { const id = el.dataset.u; S.ui.mDon = { r: 'musteriler' }; yeni(); go('musteri', id); if (!(S.users || []).some(u => String(u.id) === String(id))) CLK.loadUsers(true); }
    else prevAct?.(act, el, e);
  };
})();
