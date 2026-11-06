/* CLK Yönetim — Personel (sayfa #personel, yalnız yönetici; celik 01.11.2026):
   "bu sisteme personel giriş yapacak onlara şifre kullanıcı tanımamız lazım ama bütün menüye girişleri olmasın bizim seçtiklerimiz olsun",
   "mesela çek senet görmesin cari görmesin".
   Hesaplar Supabase'te açılır (kullanıcı adı → <ad>@personel.clkcanta.com), yetkiler panel_kullanici tablosunda durur;
   menü, sayfalar ve sunucu fonksiyonları aynı listeye bakar. İşleyişi Supabase edge fonksiyonu `personel`. */
(() => {
  const { S, $, $$, esc, dtt, head, skel, views, render, toast, sb } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/personel';
  const D = (S.ui.pers ||= { liste: null, yuk: false, hata: '', form: null, sonuc: null, isliyor: '' });
  // cari, çek-senet ve para bilgisi gösteren sayfalar: seçerken uyarı rengiyle işaretlenir
  const HASSAS = ['cari', 'ekstre', 'musteriler', 'urunlistesi', 'gider', 'senet', 'cek', 'ciro', 'eslestirme'];

  async function sor(govde) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.hata) throw new Error(j.hata || (r.status === 404 ? 'Personel sunucusu henüz kurulmadı.' : 'Sunucu ' + r.status));
    return j;
  }
  async function yukle() {
    D.yuk = true; D.hata = ''; render();
    try { D.liste = (await sor({ islem: 'liste' })).kullanicilar || []; } catch (e) { D.hata = e.message; }
    D.yuk = false; render();
  }

  const sayfaGruplari = () => CLK.MENU.filter(([g]) => g && g !== 'Ayarlar').map(([g, l]) => [g, l.filter(([k]) => k !== 'panel' && k !== 'odemeler' && k !== 'parasut')])
    .concat([['Ek yetkiler', CLK.EK_YETKI]]);
  const sayfaAdi = k => { for (const [, l] of sayfaGruplari()) { const x = l.find(([a]) => a === k); if (x) return x[1]; } return k; };
  const sifreUret = () => { const h = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; const a = crypto.getRandomValues(new Uint32Array(8)); for (const x of a) s += h[x % h.length]; return s; };
  const bosForm = () => ({ user_id: '', ad: '', kullanici: '', elle: false, sifre: sifreUret(), sayfalar: ['siparisgir', 'siparisler', 'urunler', 'stok'] });

  function formHtml() {
    const f = D.form, yeni = !f.user_id;
    const kutu = ([k, l]) => `<label class="pr-sec ${HASSAS.includes(k) ? 'hassas' : ''}"><input type="checkbox" data-pr-sayfa="${esc(k)}" ${f.sayfalar.includes(k) ? 'checked' : ''}><span>${esc(l)}</span></label>`;
    return `<div class="card pr-form"><div class="card-h"><div><h3>${yeni ? 'Yeni personel' : esc(f.ad || f.kullanici) + ' · düzenle'}</h3>
        <p class="sub">${yeni ? 'Kullanıcı adı ve şifreyi personele verin; panele bu bilgilerle girer.' : 'Seçtiğiniz sayfalar personelin bir sonraki sayfa açışında geçerli olur.'}</p></div>
        <button class="btn sm ghost" data-act="prKapat">Vazgeç</button></div>
      <div class="pr-alan">
        <label class="f"><span>Ad soyad</span><input type="text" id="pr-ad" value="${esc(f.ad)}" placeholder="Örn. Ahmet Yılmaz" autocomplete="off"></label>
        <label class="f"><span>Kullanıcı adı</span><input type="text" id="pr-kul" value="${esc(f.kullanici)}" ${yeni ? '' : 'disabled'} placeholder="ahmet" autocapitalize="none" spellcheck="false" autocomplete="off"></label>
        <label class="f"><span>${yeni ? 'Şifre' : 'Yeni şifre (değişmeyecekse boş bırakın)'}</span><div class="pr-sifre"><input type="text" id="pr-sifre" value="${esc(f.sifre)}" autocomplete="new-password" spellcheck="false"><button class="btn sm" data-act="prSifreUret" type="button">Üret</button></div></label>
      </div>
      <div class="pr-ust"><b>Görebileceği sayfalar</b><span><button class="btn sm ghost" data-act="prHepsi" type="button">Hepsini seç</button><button class="btn sm ghost" data-act="prHicbiri" type="button">Temizle</button></span></div>
      <p class="sub" style="margin:0 0 8px">Panel herkese açıktır; ciro, cari ve çek-senet rakamları yalnız o yetki işaretliyse görünür. <span class="pr-not">Kırmızı çerçeveli</span> sayfalar cari, finans ya da para bilgisi içerir.</p>
      <div class="pr-gruplar">${sayfaGruplari().map(([g, l]) => `<div class="pr-grup"><div class="pr-g">${esc(g)}</div>${l.map(kutu).join('')}</div>`).join('')}</div>
      <div class="pr-alt"><button class="btn dark" data-act="prKaydet" ${D.isliyor ? 'disabled' : ''}>${D.isliyor === 'kaydet' ? 'Kaydediliyor…' : yeni ? 'Personeli oluştur' : 'Değişiklikleri kaydet'}</button></div></div>`;
  }

  function sonucHtml() {
    const r = D.sonuc; if (!r) return '';
    const metin = `CLK Yönetim paneli\nAdres: ${location.origin + location.pathname.replace(/index\.html$/, '')}\nKullanıcı adı: ${r.kullanici}\nŞifre: ${r.sifre}`;
    return `<div class="card pr-sonuc"><div class="card-h"><div><h3>${esc(r.ad || r.kullanici)} ${r.yeni ? 'oluşturuldu' : 'için yeni şifre'}</h3><p class="sub">Bu bilgiyi personele iletin. Şifre bir daha gösterilmez.</p></div><button class="btn sm ghost" data-act="prSonucKapat">Kapat</button></div>
      <pre class="pr-bilgi">${esc(metin)}</pre>
      <div class="pr-alt"><button class="btn sm" data-act="prKopyala">Kopyala</button><a class="btn sm dark" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(metin)}">WhatsApp ile gönder</a></div></div>`;
  }

  function kisiHtml(k) {
    const ben = k.user_id === S.user?.id, yon = k.rol === 'yonetici';
    const sayfalar = yon ? '<span class="pill gold">Tüm sayfalar</span>' : (k.sayfalar || []).length ? k.sayfalar.map(x => `<span class="pill ${HASSAS.includes(x) ? 'bad' : ''}">${esc(sayfaAdi(x))}</span>`).join('') : '<span class="pill off">Sayfa seçilmemiş</span>';
    return `<div class="pr-kisi ${k.aktif ? '' : 'kapali'}"><div class="pr-k1"><b>${esc(k.ad || k.kullanici)}</b>
        <small>${esc(k.kullanici)} · ${yon ? 'Yönetici' : 'Personel'}${k.aktif ? '' : ' · <b class="neg">Kapalı</b>'} · ${k.son_giris ? 'son giriş ' + dtt(k.son_giris) : 'henüz girmedi'}</small></div>
      <div class="pr-k2">${sayfalar}</div>
      ${yon ? (ben ? '<div class="pr-k3"><small class="sub">Siz</small></div>' : '') : `<div class="pr-k3">
        <button class="btn sm" data-act="prDuzenle" data-id="${esc(k.user_id)}">Düzenle</button>
        <button class="btn sm" data-act="prSifre" data-id="${esc(k.user_id)}">Yeni şifre</button>
        <button class="btn sm ${k.aktif ? 'ghost' : 'dark'}" data-act="prAktif" data-id="${esc(k.user_id)}">${k.aktif ? 'Girişini kapat' : 'Girişini aç'}</button>
        <button class="btn sm ghost neg" data-act="prSil" data-id="${esc(k.user_id)}">Sil</button></div>`}</div>`;
  }

  views.personel = () => {
    if (!CLK.yonetici()) return head('Ayarlar', 'Personel', '') + '<div class="card empty"><h3>Yalnız yönetici</h3></div>';
    if (!D.liste && !D.yuk && !D.hata) setTimeout(yukle, 0);
    const acts = `<button class="btn sm" data-act="prYenile" ${D.yuk ? 'disabled' : ''}>${D.yuk ? 'Yükleniyor' : 'Yenile'}</button>${D.form ? '' : '<button class="btn dark sm" data-act="prYeni">+ Personel ekle</button>'}`;
    const l = D.liste || [];
    const govde = D.hata ? `<div class="card empty"><h3>Liste alınamadı</h3><p>${esc(D.hata)}</p><button class="btn dark" data-act="prYenile">Tekrar dene</button></div>`
      : !D.liste ? skel()
      : `<div class="card"><div class="card-h"><div><h3>Hesaplar</h3><p class="sub">${l.filter(k => k.rol !== 'yonetici').length} personel</p></div></div>
          <div class="pr-liste">${l.map(kisiHtml).join('')}</div></div>`;
    return head('Ayarlar', 'Personel', 'Personel hesapları ve her birinin görebileceği sayfalar', acts) + `<div class="stack">${sonucHtml()}${D.form ? formHtml() : ''}${govde}</div>`;
  };

  views.bind_personel = () => {
    const f = D.form; if (!f) return;
    const ad = $('#pr-ad'), kul = $('#pr-kul'), sif = $('#pr-sifre');
    ad?.addEventListener('input', () => { f.ad = ad.value; if (!f.user_id && !f.elle && kul) { f.kullanici = CLK.kullaniciAdi(ad.value.split(' ')[0]); kul.value = f.kullanici; } });
    kul?.addEventListener('input', () => { f.kullanici = kul.value; f.elle = true; });
    sif?.addEventListener('input', () => { f.sifre = sif.value; });
    $$('[data-pr-sayfa]').forEach(c => c.addEventListener('change', () => {
      const k = c.dataset.prSayfa; f.sayfalar = c.checked ? [...new Set([...f.sayfalar, k])] : f.sayfalar.filter(x => x !== k);
    }));
  };

  const bul = id => (D.liste || []).find(k => k.user_id === id);
  async function islem(ad, govde, tamam) {
    D.isliyor = ad; S.keepScroll = true; render();
    try { const r = await sor(govde); await tamam?.(r); await yukle(); }
    catch (e) { toast(e.message); }
    D.isliyor = ''; S.keepScroll = true; render();
  }

  const onceki = views.onAct;
  views.onAct = (act, a, e) => {
    if (!act.startsWith('pr')) return onceki?.(act, a, e);
    const f = D.form;
    if (act === 'prYenile') return yukle();
    if (act === 'prYeni') { D.form = bosForm(); D.sonuc = null; return render(); }
    if (act === 'prKapat') { D.form = null; return render(); }
    if (act === 'prSonucKapat') { D.sonuc = null; S.keepScroll = true; return render(); }
    if (act === 'prSifreUret') { f.sifre = sifreUret(); const s = $('#pr-sifre'); if (s) s.value = f.sifre; return; }
    if (act === 'prHepsi' || act === 'prHicbiri') { f.sayfalar = act === 'prHepsi' ? sayfaGruplari().flatMap(([, l]) => l.map(([k]) => k)) : []; S.keepScroll = true; return render(); }
    if (act === 'prKopyala') { const t = $('.pr-bilgi')?.textContent || ''; navigator.clipboard?.writeText(t).then(() => toast('Kopyalandı'), () => toast('Kopyalanamadı')); return; }
    if (act === 'prDuzenle') { const k = bul(a.dataset.id); if (!k) return; D.form = { user_id: k.user_id, ad: k.ad || '', kullanici: k.kullanici, sifre: '', sayfalar: [...(k.sayfalar || [])] }; D.sonuc = null; render(); window.scrollTo({ top: 0 }); return; }
    if (act === 'prKaydet') {
      const yeni = !f.user_id, kul = CLK.kullaniciAdi(f.kullanici);
      if (yeni && kul.length < 3) return toast('Kullanıcı adı en az 3 harf olmalı.');
      if ((yeni || f.sifre) && String(f.sifre).length < 6) return toast('Şifre en az 6 karakter olmalı.');
      if (!f.sayfalar.length && !confirm('Hiç sayfa seçilmedi; personel yalnız paneli görür. Devam edilsin mi?')) return;
      const govde = yeni ? { islem: 'ekle', ad: f.ad.trim(), kullanici: kul, sifre: f.sifre, sayfalar: f.sayfalar }
        : { islem: 'guncelle', user_id: f.user_id, ad: f.ad.trim(), sayfalar: f.sayfalar, ...(f.sifre ? { sifre: f.sifre } : {}) };
      return islem('kaydet', govde, () => {
        D.sonuc = yeni || f.sifre ? { yeni, ad: f.ad.trim(), kullanici: kul, sifre: f.sifre } : null;
        D.form = null; toast(yeni ? 'Personel oluşturuldu' : 'Kaydedildi');
      });
    }
    if (act === 'prSifre') {
      const k = bul(a.dataset.id); if (!k) return;
      const s = sifreUret();
      if (!confirm(`${k.ad || k.kullanici} için yeni şifre: ${s}\nEski şifre geçersiz olur. Devam edilsin mi?`)) return;
      return islem('sifre', { islem: 'guncelle', user_id: k.user_id, sifre: s }, () => { D.sonuc = { yeni: false, ad: k.ad, kullanici: k.kullanici, sifre: s }; });
    }
    if (act === 'prAktif') {
      const k = bul(a.dataset.id); if (!k) return;
      if (k.aktif && !confirm(`${k.ad || k.kullanici} panele giremeyecek. Devam edilsin mi?`)) return;
      return islem('aktif', { islem: 'guncelle', user_id: k.user_id, aktif: !k.aktif }, () => toast(k.aktif ? 'Girişi kapatıldı' : 'Girişi açıldı'));
    }
    if (act === 'prSil') {
      const k = bul(a.dataset.id); if (!k) return;
      if (!confirm(`${k.ad || k.kullanici} hesabı silinsin mi? Bu geri alınmaz (girdiği kayıtlar silinmez).`)) return;
      return islem('sil', { islem: 'sil', user_id: k.user_id }, () => toast('Hesap silindi'));
    }
  };
})();
