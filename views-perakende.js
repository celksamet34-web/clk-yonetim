/* CLK Yönetim — CLK Perakende: mağazadaki BenimPOS kasasının stoğu ve satışları (celik 06.11.2026: "orda ki stoğu da görsek iyi olur",
   "form üzerinde clk perakende mi yapsak", "mağaza bayan çantaları ve cüzdanlar var", "diğer ürünler west valiz seventeen dağcı sırt vs toptan bölümünden veriyoruz").
   Mağazaya özel bayan çanta ve cüzdanlar yalnız BenimPOS'ta kalır (celik 06.11 karar kartında "Hayır, BenimPOS'ta kalsın"); toptandan gelen ürünler
   Paraşüt ürünüyle eşleştirilir. Bu sürüm yalnız okur; BenimPOS'a ve Paraşüt'e yazma sonra, tek üründe denenerek açılacak.
   Sunucu: Supabase edge fonksiyonu `benimpos` (kaynak proje dosyalarında sunucu/benimpos). */
(() => {
  const { sb, S, $, esc, tl, num, dtt, toast, head, views, render, yonetici } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/benimpos';
  const D = (S.ui.pk ||= {
    durum: null, durumYuk: false, hata: '', urunler: null, uYuk: false, uHata: '', tam: '', sekme: 'stok', filtre: 'hepsi', ara: '', goster: 80,
    aralik: 'bugun', satis: null, sYuk: false, sHata: '', acikFis: null, form: { sube: '', api: '', gizli: '' }, kaydediyor: false, formHata: '',
    secim: null, pAra: '', pListe: null, isleniyor: ''
  });
  const fmt = v => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(v) || 0);
  const kucuk = s => String(s || '').toLocaleLowerCase('tr');

  async function sor(govde) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.hata) throw new Error(j?.hata || 'Sunucu ' + r.status);
    return j;
  }

  // ---------- yükleme ----------
  async function durumAl() {
    D.durumYuk = true; D.hata = ''; render();
    try { D.durum = await sor({ islem: 'durum' }); } catch (e) { D.hata = e.message; }
    D.durumYuk = false; render();
    if (D.durum?.ok) { urunlerAl(); satisAl(); }
  }
  async function urunlerAl(zorla) {
    if (D.uYuk) return;
    D.uYuk = true; D.uHata = ''; render();
    try { const r = await sor({ islem: 'urunler', ...(zorla ? { zorla } : {}) }); D.urunler = r.urunler || []; D.tam = r.tam; }
    catch (e) { D.uHata = e.message; }
    D.uYuk = false; S.keepScroll = true; render();
  }
  const gun = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const ARALIK = {
    bugun: ['Bugün', () => { const g = gun(new Date()); return [g, g]; }],
    dun: ['Dün', () => { const d = new Date(); d.setDate(d.getDate() - 1); const g = gun(d); return [g, g]; }],
    hafta: ['Son 7 gün', () => { const d = new Date(); d.setDate(d.getDate() - 6); return [gun(d), gun(new Date())]; }],
    ay: ['Bu ay', () => { const d = new Date(); return [gun(new Date(d.getFullYear(), d.getMonth(), 1)), gun(d)]; }],
    gecenay: ['Geçen ay', () => { const d = new Date(); return [gun(new Date(d.getFullYear(), d.getMonth() - 1, 1)), gun(new Date(d.getFullYear(), d.getMonth(), 0))]; }]
  };
  let satisSira = 0;
  async function satisAl() {
    const [bas, son] = ARALIK[D.aralik][1](), tur = ++satisSira;
    D.sYuk = true; D.sHata = ''; render();
    try { const r = await sor({ islem: 'satislar', bas, son }); if (tur === satisSira) D.satis = r; }
    catch (e) { if (tur === satisSira) D.sHata = e.message; }
    if (tur === satisSira) { D.sYuk = false; S.keepScroll = true; render(); }
  }

  // ---------- anahtar girişi ----------
  const kurulum = () => {
    const y = D.durum?.yonetici !== false && yonetici();
    const f = D.form;
    return `<div class="card pk-kur">
      <h3>BenimPOS bağlantısı bekleniyor</h3>
      <ol class="pk-adim">
        <li>BenimPOS'ta <b>Entegrasyonlar › API Entegrasyonu</b> modülünü açın (yıllık 1.500 ₺ + KDV).</li>
        <li>Aynı sayfadaki <b>Şube ID</b>, <b>Api Key</b> ve <b>Secret Key</b> değerlerini aşağıya yapıştırın.</li>
        <li>Panel önce yalnız okur: mağaza stoğu, satışlar ve Paraşüt eşleşmesi. BenimPOS'a ve Paraşüt'e bir şey yazılmaz.</li>
      </ol>
      ${y ? `<div class="pk-form">
        <label class="f"><span>Şube ID (Branch-ID)</span><input id="pkSube" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" value="${esc(f.sube)}"></label>
        <label class="f"><span>Api Key</span><input id="pkApi" type="password" autocomplete="off" spellcheck="false" value="${esc(f.api)}"></label>
        <label class="f"><span>Secret Key</span><input id="pkGizli" type="password" autocomplete="off" spellcheck="false" value="${esc(f.gizli)}"></label>
        <button class="btn dark" data-act="pkKaydet" ${D.kaydediyor ? 'disabled' : ''}>${D.kaydediyor ? 'Deneniyor…' : 'Kaydet ve bağlantıyı dene'}</button>
      </div>
      ${D.formHata ? `<p class="pk-hata">${esc(D.formHata)}</p>` : ''}
      <p class="pk-not">Anahtarlar yalnız sunucuda saklanır, panelde ve personelde görünmez. Yanlış anahtar kaydedilmez.</p>`
      : '<p class="pk-not">Anahtarları yönetici girer. Girildiğinde bu sayfa kendiliğinden açılır.</p>'}
    </div>`;
  };

  // ---------- özet ----------
  const DURUM = { toptan: ['Toptandan', 'ok'], magaza: ['Mağazaya özel', 'gold'], eslesmedi: ['Eşleşmedi', 'warn'] };
  const rozet = d => `<span class="pill ${DURUM[d]?.[1] || 'off'}">${DURUM[d]?.[0] || esc(d)}</span>`;
  // satış satırının durumu ürün listesinden okunur: eşleştirme değişince satışlar yeniden okunmadan da doğru görünür
  let durumKaynak = null, durumMap = new Map();
  const durumu = s => { if (durumKaynak !== D.urunler) { durumKaynak = D.urunler; durumMap = new Map((D.urunler || []).map(x => [x.b, x.durum])); } return durumMap.get(s.b) || s.d; };
  const ozet = () => {
    const u = (D.urunler || []).filter(x => x.aktif);
    const stok = u.filter(x => x.adet > 0);
    const adet = stok.reduce((a, x) => a + x.adet, 0), alis = stok.reduce((a, x) => a + x.adet * x.alis, 0), satis = stok.reduce((a, x) => a + x.adet * x.satis, 0);
    const f = D.satis?.fisler || [];
    const ciro = f.reduce((a, x) => a + x.tutar, 0);
    const ayir = d => f.reduce((a, x) => a + x.satirlar.filter(s => durumu(s) === d).reduce((b, s) => b + s.tutar, 0), 0);
    const bekleyen = u.filter(x => x.durum === 'eslesmedi').length;
    const ad = ARALIK[D.aralik][0];
    return `<div class="mini-kpis pk-kpis">
      <div><span>Mağaza stoğu</span><b>${D.urunler ? num(adet) + ' adet' : '…'}</b><small>${D.urunler ? num(stok.length) + ' üründe' : ''}</small></div>
      <div><span>Stok değeri</span><b>${D.urunler ? tl(satis) : '…'}</b><small>${D.urunler ? 'alış ' + tl(alis) : ''}</small></div>
      <div><span>${esc(ad)} satış</span><b>${D.satis ? tl(ciro) : '…'}</b><small>${D.satis ? num(f.length) + ' fiş' : ''}</small></div>
      <div><span>Toptan / Mağaza</span><b>${D.satis ? tl(ayir('toptan')) : '…'}</b><small>${D.satis ? 'mağazaya özel ' + tl(ayir('magaza')) + (ayir('eslesmedi') ? ' · eşleşmeyen ' + tl(ayir('eslesmedi')) : '') : ''}</small></div>
    </div>${bekleyen ? `<button class="card pk-uyari" data-act="pkSekme" data-k="esle">${num(bekleyen)} ürün eşleşmedi: toptandan mı, mağazaya özel mi? <b>Eşleştir →</b></button>` : ''}`;
  };

  // ---------- stok ----------
  const FILTRE = {
    hepsi: ['Hepsi', x => x.aktif],
    stokta: ['Stokta', x => x.aktif && x.adet > 0],
    toptan: ['Toptandan', x => x.aktif && x.durum === 'toptan'],
    magaza: ['Mağazaya özel', x => x.aktif && x.durum === 'magaza'],
    eslesmedi: ['Eşleşmedi', x => x.aktif && x.durum === 'eslesmedi'],
    eksi: ['Eksi stok', x => x.aktif && x.adet < 0]
  };
  const arandi = x => { const q = kucuk(D.ara).trim(); return !q || kucuk(x.ad).includes(q) || x.b.includes(q) || kucuk(x.kat).includes(q) || kucuk(x.kod).includes(q) || kucuk(x.p?.ad).includes(q); };
  const parasutSatir = x => x.p ? `<small class="pk-par">Paraşüt: ${esc(x.p.ad)}${x.p.stok !== null ? ` · toptan stok ${fmt(x.p.stok)}` : ''}${x.kaynak === 'ad' ? ' · adı aynı' : ''}</small>` : '';
  const stokSatir = x => `<div class="pk-satir">
      <div class="pk-ad"><b>${esc(x.ad)}</b><small>${esc(x.b)}${x.kat ? ' · ' + esc(x.kat) : ''}${x.kod ? ' · ' + esc(x.kod) : ''}</small>${parasutSatir(x)}</div>
      <div class="pk-say ${x.adet < 0 ? 'eksi' : !x.adet ? 'sifir' : ''}"><span>Stok</span><b>${fmt(x.adet)}</b></div>
      <div class="pk-say"><span>Fiyat</span><b>${tl(x.satis)}</b>${x.alis ? `<small>alış ${tl(x.alis)}</small>` : ''}</div>
      <div class="pk-d">${rozet(x.durum)}</div></div>`;
  const stokHtml = () => {
    if (!D.urunler) return D.uHata ? hataKart(D.uHata, 'pkUrunYenile') : '<div class="card"><p class="pk-not">Mağaza ürünleri BenimPOS\'tan okunuyor…</p></div>';
    const l = D.urunler.filter(FILTRE[D.filtre][1]).filter(arandi).sort((a, b) => (b.adet > 0) - (a.adet > 0) || a.ad.localeCompare(b.ad, 'tr'));
    return `<div class="sk-filtre">${Object.entries(FILTRE).map(([k, [ad, f]]) => `<button class="sk-f" data-act="pkFiltre" data-k="${k}" aria-pressed="${D.filtre === k}"><b>${num(D.urunler.filter(f).length)}</b><small>${ad}</small></button>`).join('')}</div>
      <div class="card"><div class="sk-arac"><input id="pkAra" type="search" placeholder="Ürün, barkod ya da kategori ara" value="${esc(D.ara)}" aria-label="Ürün ara"><span class="sk-say">${num(l.length)} ürün${D.tam ? ' · liste ' + dtt(D.tam) : ''}</span></div>
      <div class="pk-liste">${l.length ? l.slice(0, D.goster).map(stokSatir).join('') : '<p class="pk-not">Bu filtrede ürün yok.</p>'}</div>
      ${l.length > D.goster ? `<div class="ek-dug"><button class="btn" data-act="pkDaha">Daha fazla göster (${num(l.length - D.goster)} kaldı)</button></div>` : ''}</div>`;
  };

  // ---------- satışlar ----------
  const fisHtml = (f, i) => {
    const acik = D.acikFis === i;
    const odeme = f.parcali?.length > 1 ? f.parcali.map(p => `${esc(p.ad)} ${tl(p.tutar)}`).join(' + ') : esc(f.odeme);
    return `<div class="pk-fis ${acik ? 'acik' : ''}">
      <button class="pk-fis-h" data-act="pkFis" data-i="${i}" aria-expanded="${acik}">
        <span class="pk-saat">${esc(D.aralik === 'bugun' || D.aralik === 'dun' ? String(f.saat).slice(0, 5) : String(f.tarih).split('-').reverse().slice(0, 2).join('.') + ' ' + String(f.saat).slice(0, 5))}</span>
        <span class="pk-fis-ad">${esc(f.satirlar.map(s => s.ad).filter(Boolean).slice(0, 2).join(', ') || 'Ürünsüz fiş')}${f.satirlar.length > 2 ? ` +${f.satirlar.length - 2}` : ''}<small>${odeme}${f.personel ? ' · ' + esc(f.personel) : ''}${f.iskonto ? ' · %' + fmt(f.iskonto) + ' iskonto' : ''}</small></span>
        <b class="pk-tutar ${f.tutar < 0 ? 'eksi' : ''}">${tl(f.tutar)}</b></button>
      ${acik ? `<ul class="pk-fis-l">${f.satirlar.map(s => `<li><span>${esc(s.ad || s.b)}<small>${esc(s.b)}</small></span><span class="pk-fis-a">${fmt(s.adet)} × ${tl(s.fiyat)}</span><b>${tl(s.tutar)}</b>${rozet(durumu(s))}</li>`).join('')}</ul>
        <p class="pk-not">Fiş ${esc(f.kod)}${f.not ? ' · ' + esc(f.not) : ''}</p>` : ''}</div>`;
  };
  const satisHtml = () => {
    const ara = `<div class="chips">${Object.entries(ARALIK).map(([k, [ad]]) => `<button class="chip" data-act="pkAralik" data-k="${k}" aria-pressed="${D.aralik === k}">${ad}</button>`).join('')}</div>`;
    if (!D.satis) return ara + (D.sHata ? hataKart(D.sHata, 'pkSatisYenile') : '<div class="card"><p class="pk-not">Satışlar BenimPOS\'tan okunuyor…</p></div>');
    const f = D.satis.fisler || [];
    const tip = {};
    for (const x of f) for (const p of (x.parcali?.length ? x.parcali : [{ ad: x.odeme, tutar: x.tutar }])) tip[p.ad || '—'] = (tip[p.ad || '—'] || 0) + p.tutar;
    const elle = [D.satis.iptal ? `${num(D.satis.iptal)} iptal edilen fiş` : '', D.satis.etkisiz ? `${num(D.satis.etkisiz)} stok düzeltmesi (Etkisiz)` : ''].filter(Boolean).join(', ');
    return `${ara}<div class="card">
      <div class="pk-tip">${Object.entries(tip).sort((a, b) => b[1] - a[1]).map(([a, t]) => `<span><small>${esc(a)}</small><b>${tl(t)}</b></span>`).join('') || '<span><small>Satış yok</small><b>0 ₺</b></span>'}</div>
      ${D.sYuk ? '<p class="pk-not">Yenileniyor…</p>' : ''}
      <div class="pk-fisler">${f.length ? f.map(fisHtml).join('') : '<p class="pk-not">Bu aralıkta satış yok.</p>'}</div>
      ${elle ? `<p class="pk-not">Sayılmayanlar: ${elle}.</p>` : ''}</div>`;
  };

  // ---------- eşleştirme ----------
  // Paraşüt ürünü seçme: yazarken yalnız sonuç kutusu yenilenir (telefonda kutu yeniden oluşunca klavye bozuluyordu)
  const pSonuc = x => {
    const q = kucuk(D.pAra).trim(), kilit = D.isleniyor === x.b ? 'disabled' : '';
    if (!D.pListe) return '<p class="pk-not">Paraşüt ürünleri yükleniyor…</p>';
    if (q.length < 2) return '';
    const l = D.pListe.filter(p => kucuk(p[1]).includes(q)).slice(0, 12);
    return l.map(p => `<button class="pk-p" data-act="pkEsle" data-b="${esc(x.b)}" data-p="${esc(p[0])}" ${kilit}>${esc(p[1])}<small>${esc(p[3] || 'Kategorisiz')} · toptan stok ${fmt(p[2])}</small></button>`).join('') || '<p class="pk-not">Bulunamadı.</p>';
  };
  const esleSatir = x => {
    const secili = D.secim === x.b, kilit = D.isleniyor === x.b ? 'disabled' : '';
    const arama = !secili ? '' : `<div class="pk-psec"><input id="pkPAra" type="search" placeholder="Paraşüt ürünü ara (en az 2 harf)" value="${esc(D.pAra)}" aria-label="Paraşüt ürünü ara" autocomplete="off">
        <div id="pkPSonuc">${pSonuc(x)}</div></div>`;
    return `<div class="pk-satir pk-es">
      <div class="pk-ad"><b>${esc(x.ad)}</b><small>${esc(x.b)}${x.kat ? ' · ' + esc(x.kat) : ''} · stok ${fmt(x.adet)} · ${tl(x.satis)}</small>${parasutSatir(x)}
        ${x.oneri ? `<small class="pk-oneri">Benziyor: ${esc(x.oneri.ad)} (%${x.oneri.puan})</small>` : ''}</div>
      <div class="pk-es-d">
        ${x.oneri && x.durum === 'eslesmedi' ? `<button class="btn sm dark" data-act="pkEsle" data-b="${esc(x.b)}" data-p="${esc(x.oneri.id)}" ${kilit}>Bu ürün</button>` : ''}
        ${x.durum !== 'magaza' ? `<button class="btn sm" data-act="pkEsle" data-b="${esc(x.b)}" data-p="" ${kilit}>Mağazaya özel</button>` : ''}
        <button class="btn sm" data-act="pkSec" data-b="${esc(x.b)}" aria-expanded="${secili}">${x.p ? 'Değiştir' : 'Paraşüt\'ten seç'}</button>
        ${x.kaynak === 'elle' ? `<button class="btn sm" data-act="pkKaldir" data-b="${esc(x.b)}" ${kilit}>Geri al</button>` : ''}
      </div>${arama}</div>`;
  };
  const esleHtml = () => {
    if (!D.urunler) return stokHtml();
    const u = D.urunler.filter(x => x.aktif);
    const bekleyen = u.filter(x => x.durum === 'eslesmedi').sort((a, b) => !!b.oneri - !!a.oneri || b.adet - a.adet);
    const adla = u.filter(x => x.kaynak === 'ad'), elle = u.filter(x => x.kaynak === 'elle');
    const kat = {};
    for (const x of u) if (x.kat) { const k = (kat[x.kat] ||= { n: 0, bekleyen: 0, magaza: 0 }); k.n++; if (x.durum === 'eslesmedi') k.bekleyen++; if (x.kaynak === 'kategori') k.magaza++; }
    const katlar = Object.entries(kat).sort((a, b) => b[1].bekleyen - a[1].bekleyen || a[0].localeCompare(b[0], 'tr'));
    return `<div class="pk-kartlar"><div class="card"><h3 class="pk-h">Kategoriye göre</h3><p class="pk-not">Bayan çanta ve cüzdan gibi bütün kategori mağazaya özelse tek dokunuşla işaretleyin; içindeki ürünler Paraşüt'e gitmez. Tek tek eşleştirilen ürün önce gelir.</p>
      <div class="pk-katlar">${katlar.map(([k, v]) => `<button class="chip" data-act="pkKat" data-k="${esc(k)}" aria-pressed="${v.magaza > 0}" ${D.isleniyor === 'kat:' + k ? 'disabled' : ''}>${esc(k)} <b>${num(v.n)}${v.bekleyen ? ' · ' + num(v.bekleyen) + ' bekliyor' : ''}</b></button>`).join('') || '<span class="pk-not">BenimPOS ürünlerinde kategori yok.</span>'}</div></div>
      <div class="card"><h3 class="pk-h">Eşleşmeyenler (${num(bekleyen.length)})</h3><p class="pk-not">Toptandan verilen ürünü Paraşüt ürünüyle eşleştirin; mağazada satılınca Paraşüt'e o ürün gidecek (yazma henüz kapalı).</p>
      <div class="pk-liste">${bekleyen.slice(0, D.goster).map(esleSatir).join('') || '<p class="pk-not">Eşleşmeyen ürün yok.</p>'}</div>
      ${bekleyen.length > D.goster ? `<div class="ek-dug"><button class="btn" data-act="pkDaha">Daha fazla göster (${num(bekleyen.length - D.goster)} kaldı)</button></div>` : ''}</div>
      ${adla.length ? `<div class="card"><h3 class="pk-h">Adından eşleşenler (${num(adla.length)})</h3><p class="pk-not">BenimPOS'taki adı Paraşüt'teki adıyla birebir aynı olanlar kendiliğinden eşleşti; yanlışsa değiştirin.</p><div class="pk-liste">${adla.slice(0, 40).map(esleSatir).join('')}</div></div>` : ''}
      ${elle.length ? `<div class="card"><h3 class="pk-h">Elle eşleştirilenler (${num(elle.length)})</h3><div class="pk-liste">${elle.slice(0, 60).map(esleSatir).join('')}</div></div>` : ''}</div>`;
  };

  const hataKart = (m, act) => `<div class="card empty"><h3>BenimPOS okunamadı</h3><p>${esc(m)}</p><button class="btn dark" data-act="${act}">Tekrar dene</button></div>`;

  views.perakende = () => {
    if (!D.durum && !D.durumYuk && !D.hata) durumAl();
    const bagli = D.durum?.ok;
    const acts = bagli ? `<button class="btn" data-act="pkYenile" ${D.uYuk || D.sYuk ? 'disabled' : ''}>${D.uYuk || D.sYuk ? 'Okunuyor…' : 'Yenile'}</button>` : '';
    const bitis = D.durum?.bitis ? ` API ${String(D.durum.bitis).slice(0, 10).split('-').reverse().join('.')} tarihine kadar açık.` : '';
    const ust = head('Satış', 'CLK Perakende', `Mağazadaki BenimPOS kasasının stoğu ve satışları. Mağazaya özel bayan çanta ve cüzdanlar yalnız BenimPOS'ta kalır; toptandan verilen ürünler Paraşüt ürünüyle eşleşir.${bitis}`, acts);
    if (!D.durum) return ust + (D.hata ? hataKart(D.hata, 'pkDurum') : '<div class="card"><p class="pk-not">BenimPOS bağlantısına bakılıyor…</p></div>');
    if (!D.durum.anahtar) return ust + kurulum();
    if (!bagli) return ust + `<div class="card empty"><h3>BenimPOS'a bağlanılamadı</h3><p>${esc(D.durum.hata || '')}</p><button class="btn dark" data-act="pkDurum">Tekrar dene</button>${D.durum.yonetici !== false && yonetici() ? ' <button class="btn" data-act="pkAnahtar">Anahtarları değiştir</button>' : ''}</div>` + (D.anahtarFormu ? kurulum() : '');
    const bekleyen = (D.urunler || []).filter(x => x.aktif && x.durum === 'eslesmedi').length;
    const SEKME = [['stok', 'Stok'], ['satis', 'Satışlar'], ['esle', 'Eşleştirme' + (bekleyen ? ` (${num(bekleyen)})` : '')]];
    return `${ust}${ozet()}
      <div class="chips pk-sekmeler" role="tablist">${SEKME.map(([k, ad]) => `<button class="chip" role="tab" data-act="pkSekme" data-k="${k}" aria-pressed="${D.sekme === k}">${ad}</button>`).join('')}</div>
      ${D.sekme === 'satis' ? satisHtml() : D.sekme === 'esle' ? esleHtml() : stokHtml()}`;
  };

  views.bind_perakende = () => {
    const ara = $('#pkAra'); ara?.addEventListener('input', () => { D.ara = ara.value; D.goster = 80; render(); });
    const pa = $('#pkPAra');
    pa?.addEventListener('input', () => { D.pAra = pa.value; const x = (D.urunler || []).find(u => u.b === D.secim), k = $('#pkPSonuc'); if (x && k) k.innerHTML = pSonuc(x); });
    if (pa && D.odakla) { D.odakla = false; pa.focus({ preventScroll: true }); }
    for (const [id, k] of [['#pkSube', 'sube'], ['#pkApi', 'api'], ['#pkGizli', 'gizli']]) $(id)?.addEventListener('input', e => { D.form[k] = e.target.value; });
  };

  async function anahtarKaydet() {
    const f = D.form;
    if (!f.sube.trim() || !f.api.trim() || !f.gizli.trim()) { D.formHata = 'Üç alan da gerekli.'; render(); return; }
    D.kaydediyor = true; D.formHata = ''; render();
    try {
      const r = await sor({ islem: 'ayar', sube: f.sube, api: f.api, gizli: f.gizli });
      D.form = { sube: '', api: '', gizli: '' }; D.anahtarFormu = false;
      toast(`BenimPOS bağlandı${r.odemeTipleri ? ` (${r.odemeTipleri} ödeme tipi okundu)` : ''}.`);
      D.durum = null; D.urunler = null; D.satis = null;
      D.kaydediyor = false; durumAl(); return;
    } catch (e) { D.formHata = e.message; }
    D.kaydediyor = false; render();
  }
  async function esle(b, p) {
    D.isleniyor = b; render();
    try {
      await sor({ islem: 'eslesme', barkod: b, p });
      D.secim = null; D.pAra = '';
      const x = (D.urunler || []).find(u => u.b === b);
      if (x) { // sunucudan tazesi gelene kadar yerinde güncellenir
        if (p === null) { x.kaynak = ''; x.durum = 'eslesmedi'; x.p = null; }
        else if (p) { const pr = D.pListe?.find(r => r[0] === p); x.kaynak = 'elle'; x.durum = 'toptan'; x.p = pr ? { id: p, ad: pr[1], stok: pr[2], kat: pr[3] } : x.oneri?.id === p ? x.oneri : { id: p, ad: 'Paraşüt ürünü', stok: null }; }
        else { x.kaynak = 'elle'; x.durum = 'magaza'; x.p = null; }
      }
    } catch (e) { toast(e.message); }
    D.isleniyor = ''; S.keepScroll = true; render();
    urunlerAl();
  }
  async function katIsaretle(k) {
    const acik = (D.urunler || []).some(x => x.kat === k && x.kaynak === 'kategori');
    D.isleniyor = 'kat:' + k; render();
    try { await sor({ islem: 'magaza_kategori', kat: k, magaza: !acik }); toast(acik ? `${k}: mağazaya özel işareti kaldırıldı.` : `${k}: bütün ürünler mağazaya özel sayılacak.`); }
    catch (e) { toast(e.message); }
    D.isleniyor = ''; await urunlerAl();
  }

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'pkDurum') { D.durum = null; D.hata = ''; durumAl(); }
    else if (act === 'pkKaydet') anahtarKaydet();
    else if (act === 'pkAnahtar') { D.anahtarFormu = true; render(); }
    else if (act === 'pkYenile') { urunlerAl('yenile'); satisAl(); }
    else if (act === 'pkUrunYenile') urunlerAl('yenile');
    else if (act === 'pkSatisYenile') satisAl();
    else if (act === 'pkSekme') { D.sekme = el.dataset.k; D.goster = 80; render(); }
    else if (act === 'pkFiltre') { D.filtre = el.dataset.k; D.goster = 80; render(); }
    else if (act === 'pkDaha') { D.goster += 200; S.keepScroll = true; render(); }
    else if (act === 'pkAralik') { D.aralik = el.dataset.k; D.acikFis = null; D.satis = null; satisAl(); }
    else if (act === 'pkFis') { const i = Number(el.dataset.i); D.acikFis = D.acikFis === i ? null : i; S.keepScroll = true; render(); }
    else if (act === 'pkSec') {
      D.secim = D.secim === el.dataset.b ? null : el.dataset.b; D.pAra = ''; D.odakla = !!D.secim; S.keepScroll = true; render();
      if (D.secim && !D.pListe) sor({ islem: 'parasut_urunler' }).then(r => { D.pListe = r.urunler || []; S.keepScroll = true; render(); }).catch(x => toast(x.message));
    }
    else if (act === 'pkEsle') esle(el.dataset.b, el.dataset.p);
    else if (act === 'pkKaldir') esle(el.dataset.b, null);
    else if (act === 'pkKat') katIsaretle(el.dataset.k);
    else prevAct?.(act, el, e);
  };
})();
