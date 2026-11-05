/* CLK Yönetim — Paraşüt bağlantısı (sayfa #parasut, yalnız yönetici; celik 05.11.2026, Paraşüt'ün e-postası:
   "grant_type=password 10 Aralık itibarıyla çalışmayacak", yeni giriş id.parasut.com üzerinden OAuth 2.0 + PKCE).
   Yönetici DevHub'dan aldığı Client ID ve Client secret'ı girer, "Paraşüt'e bağlan"a basar, Paraşüt'ün kendi ekranında giriş yapıp
   izin verir; Paraşüt panele geri döner. Anahtarlar ve token yalnız sunucuda (Supabase `parasut-baglan`, tablo parasut_baglanti) durur,
   panel secret'ı bir daha göstermez. Bütün eşitleme ve finans fonksiyonları token'ı oradan alır. */
(() => {
  const { S, $, esc, dtt, head, skel, views, render, toast, sb } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/parasut-baglan';
  const SON_GUN = new Date('2026-12-10T00:00:00+03:00');
  const D = (S.ui.pb ||= { d: null, yuk: false, hata: '', isliyor: '', test: null, donus: '' });

  // Paraşüt'ten dönüşte adres ?pb=ok|uyari|hata#parasut olur; okunup adresten silinir
  try {
    const q = new URLSearchParams(location.search).get('pb');
    if (q) { D.donus = q; history.replaceState(null, '', location.pathname + '#parasut'); }
  } catch {}

  async function sor(govde) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.hata) throw new Error(j.hata || (r.status === 404 ? 'Paraşüt bağlantı sunucusu henüz kurulmadı.' : 'Sunucu ' + r.status));
    return j;
  }
  async function yukle() {
    D.yuk = true; D.hata = ''; render();
    try { D.d = await sor({ islem: 'durum' }); } catch (e) { D.hata = e.message; }
    D.yuk = false; S.keepScroll = true; render();
  }
  const gunKaldi = t => Math.ceil((new Date(t) - Date.now()) / 86400000);

  function durumKart(d) {
    const kalan = gunKaldi(SON_GUN);
    const rGun = d.refresh_bitis ? gunKaldi(d.refresh_bitis) : null;
    const bagli = d.bagli
      ? `<span class="pill ok">Bağlı</span> <small class="mut">${esc(d.bagli_kisi || '')}${d.baglanti_zaman ? ' · ' + dtt(d.baglanti_zaman) + ' bağlandı' : ''}</small>`
      : `<span class="pill bad">Bağlı değil</span>`;
    const donus = D.donus === 'ok' ? '<p class="msg ok">Paraşüt bağlandı. Aşağıdan "Bağlantıyı dene" ile kontrol edin.</p>'
      : D.donus ? `<p class="msg err">${esc(d.son_sonuc || 'Bağlantı kurulamadı.')}</p>` : '';
    return `<div class="card"><div class="card-h"><div><h3>Yeni Paraşüt bağlantısı</h3>
        <p class="sub">Eski e-posta/şifre girişi <b>${kalan > 0 ? kalan + ' gün sonra' : 'artık'}</b> (10 Aralık) kapanıyor. Yeni bağlantı kurulunca eşitleme, sipariş, gider, senet ve ekstre kendiliğinden ona geçer.</p></div></div>
      ${donus}
      <div class="pb-satir"><b>Durum</b><span>${bagli}</span></div>
      ${d.bagli ? `<div class="pb-satir"><b>Son yenileme</b><span>${d.refresh_zaman ? dtt(d.refresh_zaman) : '—'}${rGun !== null ? ` · anahtar ${rGun} gün geçerli (6 saatte bir kendiliğinden yenilenir)` : ''}</span></div>` : ''}
      ${d.son_hata ? `<div class="pb-satir"><b>Son hata</b><span class="neg">${esc(d.son_hata)}${d.son_hata_zaman ? ' · ' + dtt(d.son_hata_zaman) : ''}</span></div>` : ''}
      ${d.kesif_hata ? `<div class="pb-satir"><b>Paraşüt kimlik sunucusu</b><span class="neg">${esc(d.kesif_hata)}</span></div>` : ''}
      ${D.test ? `<p class="msg ${D.test.ok ? 'ok' : 'err'}">${esc(D.test.mesaj || '')}${D.test.kisi ? ' (' + esc(D.test.kisi) + ')' : ''}</p>` : ''}
      <div class="pr-alt">${d.bagli ? `<button class="btn sm" data-act="pbTest" ${D.isliyor ? 'disabled' : ''}>${D.isliyor === 'test' ? 'Deneniyor…' : 'Bağlantıyı dene'}</button>
        <button class="btn sm ghost" data-act="pbBaglan" ${D.isliyor ? 'disabled' : ''}>Yeniden bağlan</button>
        <button class="btn sm ghost neg" data-act="pbKes" ${D.isliyor ? 'disabled' : ''}>Bağlantıyı kes</button>` : ''}</div></div>`;
  }

  function adimlar(d) {
    return `<div class="card"><div class="card-h"><div><h3>Kurulum</h3><p class="sub">Bir kez yapılır. Paraşüt şifreniz bu panele hiç girilmez.</p></div></div>
      <ol class="pb-adim">
        <li><b>Paraşüt'te yetkiyi açın:</b> Paraşüt › Ayarlar › Kullanıcılar › kendi adınız › Düzenle › <b>Uygulama Entegrasyonları</b> açık olsun.</li>
        <li><b>DevHub'da başvuru:</b> Paraşüt Geliştirici Portalı'na (DevHub) Paraşüt hesabınızla girin, <b>"Paraşüt Kullanıcısıyım"</b> ile yeni uygulama açın. Uygulama adı: <b>CLK Yönetim</b>. Yönlendirme (redirect) adresi olarak aşağıdakini yapıştırın:
          <div class="pb-kopya"><code id="pb-redirect">${esc(d.redirect_uri)}</code><button class="btn sm" data-act="pbKopya" type="button">Kopyala</button></div></li>
        <li><b>Anahtarları girin:</b> DevHub'ın verdiği Client ID ve Client secret:
          <div class="pr-alan pb-alan">
            <label class="f"><span>Client ID</span><input type="text" id="pb-id" value="${esc(d.client_id)}" autocomplete="off" spellcheck="false" autocapitalize="none"></label>
            <label class="f"><span>Client secret ${d.secret_var ? '(kayıtlı; değişmeyecekse boş bırakın)' : ''}</span><input type="password" id="pb-secret" value="" autocomplete="new-password" spellcheck="false" placeholder="${d.secret_var ? '••••••••' : ''}"></label>
          </div>
          <button class="btn sm" data-act="pbKaydet" ${D.isliyor ? 'disabled' : ''}>${D.isliyor === 'kaydet' ? 'Kaydediliyor…' : 'Kaydet'}</button></li>
        <li><b>Bağlanın:</b> Paraşüt'ün giriş ekranı açılır; giriş yapıp izin verin, panel kendiliğinden geri gelir.
          <div class="pr-alt"><button class="btn dark" data-act="pbBaglan" ${!d.client_id || !d.secret_var || D.isliyor ? 'disabled' : ''}>${D.isliyor === 'baglan' ? 'Açılıyor…' : "Paraşüt'e bağlan"}</button></div></li>
      </ol></div>`;
  }

  views.parasut = () => {
    if (!CLK.yonetici()) return head('Ayarlar', 'Paraşüt bağlantısı', '') + '<div class="card empty"><h3>Yalnız yönetici</h3></div>';
    if (!D.d && !D.yuk && !D.hata) setTimeout(yukle, 0);
    const acts = `<button class="btn sm" data-act="pbYenile" ${D.yuk ? 'disabled' : ''}>${D.yuk ? 'Yükleniyor' : 'Yenile'}</button>`;
    const govde = D.hata ? `<div class="card empty"><h3>Durum alınamadı</h3><p>${esc(D.hata)}</p><button class="btn dark" data-act="pbYenile">Tekrar dene</button></div>`
      : !D.d ? skel() : durumKart(D.d) + adimlar(D.d);
    return head('Ayarlar', 'Paraşüt bağlantısı', "Paraşüt'ün yeni giriş sistemi (10 Aralık'tan sonra zorunlu)", acts) + `<div class="stack">${govde}</div>`;
  };

  async function islem(ad, f) {
    D.isliyor = ad; S.keepScroll = true; render();
    try { await f(); } catch (e) { toast(e.message); }
    D.isliyor = ''; S.keepScroll = true; render();
  }
  const onceki = views.onAct;
  views.onAct = (act, a, e) => {
    if (!act.startsWith('pb')) return onceki?.(act, a, e);
    if (act === 'pbYenile') { D.test = null; return yukle(); }
    if (act === 'pbKopya') { navigator.clipboard?.writeText($('#pb-redirect')?.textContent || '').then(() => toast('Kopyalandı'), () => toast('Kopyalanamadı')); return; }
    if (act === 'pbKaydet') {
      const client_id = ($('#pb-id')?.value || '').trim(), client_secret = ($('#pb-secret')?.value || '').trim();
      if (!client_id) return toast('Client ID girin.');
      if (!client_secret && !D.d?.secret_var) return toast('Client secret girin.');
      return islem('kaydet', async () => { await sor({ islem: 'ayar', client_id, client_secret }); toast('Kaydedildi'); D.d = await sor({ islem: 'durum' }); });
    }
    if (act === 'pbBaglan') return islem('baglan', async () => { const { url } = await sor({ islem: 'basla' }); location.href = url; });
    if (act === 'pbTest') return islem('test', async () => { D.test = await sor({ islem: 'test' }); });
    if (act === 'pbKes') {
      if (!confirm('Yeni Paraşüt bağlantısı kesilsin mi? (10 Aralık\'a kadar eski giriş çalışır, sonra eşitleme durur.)')) return;
      return islem('kes', async () => { await sor({ islem: 'kes' }); D.test = null; D.d = await sor({ islem: 'durum' }); });
    }
  };
})();
