/* CLK Yönetim — Ürün Giriş: tedarikçi fişi (fotoğraf ya da PDF) yüklenir, yapay zekâ satırları okur, kontrol edilip Paraşüt'e alış faturası olarak girilir.
   CLK ÇANTA dışındaki alıcılara giden gruplar ayrıca satış faturası olur. Fiş görselleri clk-N numarasıyla arşivde durur. */
(() => {
  const { sb, S, $, esc, toast, head, views, render, araKutu, araSec } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/siparis-parasut';
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  const D = (S.ui.ug ||= { yuklendi: false, hata: '', firmalar: [], fisler: [], urunler: null, musteriler: [], urunEsl: new Map(), musEsl: new Map(),
    secili: '', filtre: 'acik', secilen: [], mesaj: '', mesajTur: '', gonderiliyor: false, tas: {}, satis: {}, url: {}, mesgul: {}, uyari: {}, emin: {}, yeniFirma: { ad: '', kurallar: '' }, arsivAra: '', arsivFirma: '' });
  const tl = v => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(v) || 0) + ' ₺';
  const trT = d => d ? String(d).slice(0, 10).split('-').reverse().join('.') : '';
  const sayi = v => { if (typeof v === 'number') return v; const n = Number(String(v ?? '').trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const buyuk = s => String(s || '').toLocaleUpperCase('tr').replace(/\s+/g, ' ').trim();
  const normal = s => String(s || '').toLocaleUpperCase('tr').replace(/[^0-9A-ZÇĞİÖŞÜ]+/g, '');
  const kisa = id => String(id).slice(0, 8);
  const toplam = satirlar => (satirlar || []).reduce((a, s) => a + sayi(s.adet) * sayi(s.fiyat), 0);
  const DURUM = { okunuyor: 'Okunuyor…', okundu: 'Kontrol edin', hata: 'Okunamadı', aktariliyor: 'Aktarılıyor…', kaydedildi: 'Paraşüt\'e girildi' };

  async function sor(govde) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.hata) throw new Error(j?.hata || 'Sunucu ' + r.status);
    return j;
  }
  async function hepsi(tablo, alanlar) {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await sb.from(tablo).select(alanlar).range(i, i + 999);
      if (error) throw new Error(error.message);
      out.push(...data); if (data.length < 1000) return out;
    }
  }

  // --- veri ---
  async function fisleriAl() {
    const { data, error } = await sb.from('ug_fis').select('*').order('gonderilme', { ascending: false });
    if (error) throw new Error(error.message);
    D.fisler = data;
    await urlleriAl();
  }
  async function yukle() {
    D.yuklendi = true; D.hata = ''; D.hazir = false;
    try {
      const [firmalar, ue, me, mus] = await Promise.all([hepsi('ug_firma', '*'), hepsi('ug_urun_eslesme', '*'), hepsi('ug_musteri_eslesme', '*'), hepsi('sp_parasut_musteri', 'id,ad')]);
      D.firmalar = firmalar.sort((a, b) => (a.sira ?? 99) - (b.sira ?? 99) || a.ad.localeCompare(b.ad, 'tr'));
      D.urunEsl = new Map(ue.map(e => [e.firma + '|' + e.fis_adi, String(e.urun_id)]));
      D.musEsl = new Map(me.map(e => [e.grup, String(e.musteri_id)]));
      D.musteriler = mus.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
      if (!D.secili) { try { D.secili = localStorage.getItem('clk-ug-firma') || ''; } catch {} }
      if (!['__yeni', '__arsiv'].includes(D.secili) && !D.firmalar.some(f => f.ad === D.secili)) D.secili = D.firmalar[0]?.ad || '__yeni';
      await fisleriAl();
    } catch (e) { D.hata = e.message; }
    D.hazir = true; render();
    try { const v = await sor({ islem: 'urunler' }); D.urunler = v.urunler.map(([id, ad, alis, , , , , arsiv]) => ({ id: String(id), ad, alis: Number(alis) || 0, arsiv: !!arsiv })); urunListesi(); render(); }
    catch (e) { D.urunler = []; D.mesaj = 'Paraşüt ürünleri alınamadı: ' + e.message; D.mesajTur = 'err'; render(); }
    izle();
  }
  // okunan / aktarılan fiş varken liste 5 sn'de bir yenilenir
  let izleyici = null;
  function izle() {
    clearTimeout(izleyici);
    if (!D.fisler.some(f => f.durum === 'okunuyor' || f.durum === 'aktariliyor')) return;
    izleyici = setTimeout(async () => {
      if (S.route !== 'urungiris') return izle();
      try { await fisleriAl(); S.keepScroll = true; render(); } catch {}
      izle();
    }, 5000);
  }
  // fiş görselleri özel klasörde: 6 saatlik imzalı bağlantı
  async function urlleriAl() {
    const yollar = [...new Set(D.fisler.flatMap(f => (f.dosyalar || []).map(d => d.yol)).filter(y => y && !D.url[y]))];
    for (let i = 0; i < yollar.length; i += 100) {
      const { data } = await sb.storage.from('fisler').createSignedUrls(yollar.slice(i, i + 100), 6 * 3600);
      for (const u of data || []) if (u.signedUrl) D.url[u.path] = u.signedUrl;
    }
  }

  // Paraşüt ürünleri tek bir datalist'te (her çizimde yeniden yazılmasın diye sayfanın dışında)
  const urunAd = id => D.urunler?.find(u => u.id === String(id))?.ad || '';
  let adHarita = new Map();
  function urunListesi() {
    adHarita = new Map();
    for (const u of [...D.urunler].sort((a, b) => a.arsiv - b.arsiv)) if (!adHarita.has(u.ad)) adHarita.set(u.ad, u.id);
    let dl = document.getElementById('ugUrunListe');
    if (!dl) { dl = Object.assign(document.createElement('datalist'), { id: 'ugUrunListe' }); document.body.append(dl); }
    dl.innerHTML = [...adHarita.keys()].map(a => `<option value="${esc(a)}">`).join('');
  }
  // önce kaydedilmiş eşleşme; yoksa adı birebir tutan ya da "CLK-540" gibi tek bir ürün
  function urunTahmin(firma, ad) {
    const k = D.urunEsl.get(firma + '|' + buyuk(ad));
    if (k && urunAd(k)) return k;
    const n = normal(ad); if (!n || !D.urunler) return '';
    const tam = D.urunler.filter(u => normal(u.ad) === n || normal(u.ad) === 'CLK' + n);
    if (new Set(tam.map(u => u.ad)).size === 1) return adHarita.get(tam[0].ad) || tam[0].id;
    const kod = String(ad).trim().match(/^\d{2,}[A-Z]?$/i)?.[0].toLocaleUpperCase('tr');
    if (!kod) return '';
    const re = new RegExp('^(CLK[- ]?)?' + kod + '(?![0-9A-Z])', 'i');
    const bas = [...adHarita.entries()].filter(([a]) => re.test(a.trim()));
    return bas.length === 1 ? bas[0][1] : '';
  }
  // bir önceki alış: bu ürünün en son aktarılan fişteki fiyatı, yoksa Paraşüt'teki alış fiyatı
  function oncekiAlis(id, haric) {
    if (!id) return 0;
    let son = null;
    for (const f of D.fisler) {
      if (f.id === haric || f.durum !== 'kaydedildi') continue;
      for (const s of f.satirlar || []) if (String(s.parasutId) === String(id) && sayi(s.fiyat) > 0) {
        const t = f.tarih || f.gonderilme || '';
        if (!son || t > son.t) son = { t, fiyat: sayi(s.fiyat) };
      }
    }
    return son ? son.fiyat : D.urunler?.find(u => u.id === String(id))?.alis || 0;
  }
  // düzenleme taslağı: fiş açılınca satırlara Paraşüt ürünü tahmin edilir
  function taslak(f) {
    return D.tas[f.id] ||= { tarih: f.tarih || '', ust: f.ust || '', satirlar: (f.satirlar || []).map(s => {
      const id = s.parasutId && urunAd(s.parasutId) ? String(s.parasutId) : urunTahmin(f.firma, s.urun);
      return { adet: s.adet, urun: s.urun, fiyat: s.fiyat, grup: s.grup || '', parasutId: id, pAd: id ? urunAd(id) : (s.yeniAd || '') };
    }) };
  }
  // aynı fiş iki kez işlenmesin: ürün ve adetlerin çoğu ya da toplamı aynı olan başka fiş
  function benzerFis(f, satirlar) {
    const anahtar = s => normal(s.urun) + '|' + sayi(s.adet);
    const bu = satirlar.filter(s => s.urun).map(anahtar);
    if (!bu.length) return null;
    let enIyi = null;
    for (const o of D.fisler) {
      if (o.id === f.id || o.firma !== f.firma || !(o.satirlar || []).length) continue;
      if (o.durum !== 'kaydedildi' && o.gonderilme > f.gonderilme) continue;
      const kalan = o.satirlar.filter(s => s.urun).map(anahtar);
      let ayni = 0;
      for (const k of bu) { const i = kalan.indexOf(k); if (i >= 0) { ayni++; kalan.splice(i, 1); } }
      const oran = ayni / Math.max(bu.length, o.satirlar.length);
      const ayniTutar = toplam(o.satirlar) > 0 && Math.abs(toplam(o.satirlar) - toplam(satirlar)) < 0.01;
      if ((oran >= 0.6 && ayni >= Math.min(2, bu.length)) || (ayniTutar && ayni >= 1)) if (!enIyi || oran > enIyi.oran) enIyi = { fis: o, ayni, oran, ayniTutar };
    }
    return enIyi;
  }

  // --- satış: CLK ÇANTA / CLK DEPO / Esenler dışındaki alıcılar ---
  const clkMi = ad => { const a = buyuk(ad); return !a || a.includes('CLK') || a.includes('ESENLER'); };
  const grupAnahtar = ad => buyuk(ad).replace(/\(.*?\)/g, '').replace(/(^|\s)Ç\./g, '$1ÇANTA').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  function satisGruplari(satirlar) {
    const m = new Map();
    for (const s of satirlar || []) { if (clkMi(s.grup)) continue; const ad = String(s.grup).trim(); if (!m.has(ad)) m.set(ad, []); m.get(ad).push(s); }
    return [...m.entries()].map(([ad, satirlar]) => ({ ad, satirlar }));
  }
  function musteriTahmini(grup) {
    const k = grupAnahtar(grup);
    if (D.musEsl.has(k)) return D.musEsl.get(k);
    const kel = k.split(' ').filter(w => w.length > 1);
    const aday = D.musteriler.filter(m => kel.every(w => buyuk(m.ad).split(' ').some(mw => mw.startsWith(w))));
    return aday.length === 1 ? aday[0].id : '';
  }
  const karYuzde = (a, s) => a > 0 && s > 0 ? '%' + ((s - a) / a * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) : '–';
  const karDusuk = (a, s) => a > 0 && s > 0 && (s - a) / a < 0.1;
  const satisAcik = f => f.durum === 'kaydedildi' && satisGruplari(f.satirlar).some(g => !(f.satislar || []).some(x => x.grup === g.ad && x.durum === 'kaydedildi'));
  const acik = f => f.durum !== 'kaydedildi' || satisAcik(f);

  // --- yükleme ve okuma ---
  async function gorselHazirla(file) {
    try {
      const bmp = await createImageBitmap(file);
      const o = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * o), height: Math.round(bmp.height * o) });
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return await new Promise(r => c.toBlob(b => r(b || file), 'image/jpeg', 0.85));
    } catch { return file; }
  }
  let pdfjs;
  const pdfYukle = () => pdfjs ||= new Promise((ok, hata) => {
    if (window.pdfjsLib) return ok(window.pdfjsLib);
    const s = Object.assign(document.createElement('script'), { src: PDFJS + 'pdf.min.js', onload: () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(window.pdfjsLib); }, onerror: () => { pdfjs = null; hata(new Error('PDF okuyucu yüklenemedi')); } });
    document.head.append(s);
  });
  // PDF'in her sayfası görsele çevrilir (en çok 6 sayfa); hepsi tek fiş olarak okunur
  async function pdfGorseller(file) {
    const lib = await pdfYukle();
    const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise, out = [];
    for (let p = 1; p <= Math.min(pdf.numPages, 6); p++) {
      const sayfa = await pdf.getPage(p), v1 = sayfa.getViewport({ scale: 1 });
      const vp = sayfa.getViewport({ scale: Math.min(3, 2000 / Math.max(v1.width, v1.height)) });
      const c = Object.assign(document.createElement('canvas'), { width: Math.round(vp.width), height: Math.round(vp.height) });
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await sayfa.render({ canvasContext: ctx, viewport: vp }).promise;
      out.push(await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85)));
    }
    return out;
  }
  const bilinenUrunler = ad => [...new Set(D.fisler.filter(f => f.firma === ad).flatMap(f => (f.satirlar || []).map(s => s.parasutAd || s.urun)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  function okumaTalimati(firma) {
    const urunler = bilinenUrunler(firma.ad);
    return `Bu görsel(ler), ${firma.ad} adlı tedarikçinin fişi ya da faturasıdır (el yazısı sipariş fişi, fotoğraf ya da PDF sayfası; bazen tek fotoğrafta iki fiş olur). Alıcı firma CLK Çanta (Samet Çelik).
Her fişi oku ve SADECE şu JSON'u döndür:
{"fisler":[{"tarih":"YYYY-AA-GG","ust":"fişin üstündeki not (örn. Ambarlar) ya da boş","gruplar":[{"gonderilen":"bu grubun gittiği yer/kişi; yazmıyorsa firma kuralındaki varsayılan, o da yoksa boş","satirlar":[{"adet":10,"urun":"ÜRÜN ADI","fiyat":2300}]}],"fisToplami":0,"sorular":["..."]}]}
Kurallar:
- Satırlar ara toplam çizgileriyle gruplara ayrılır; grubun altına ya da okla yazılan isim o grubun "gonderilen"idir. Tırnak (") işareti üstteki satırdaki kelimeyi tekrarlar.
- Tutarı adet × fiyat ile kontrol et. Tutmazsa, üstü çizilmiş/düzeltilmiş değer varsa, okunamayan yer varsa "sorular"a kısa Türkçe soru yaz.
- Ürün adlarını BÜYÜK harfle yaz; kısaltmaları açma, aşağıdaki bilinen adlardan birine benziyorsa o adı kullan ve emin değilsen "sorular"a "X ile Y aynı mı?" diye sor.
- Birden çok görsel aynı belgenin sayfalarıysa tek fiş olarak döndür.
- Firma kuralları: ${(firma.kurallar || []).join('; ') || 'yok'}.
- Bilinen ürün adları: ${urunler.join(', ') || 'henüz yok'}.
- Fişin altında yazan büyük bakiye/cari toplamı (örn. 2.254.754) yok say, soru sorma.
- Fiyatlarda nokta binlik ayraçtır (2.300 = 2300). Rakam yaz, metin yazma.`;
  }
  async function okut(fis) {
    const firma = D.firmalar.find(x => x.ad === fis.firma);
    const { data } = await sb.auth.getSession();
    const r = await fetch('/.netlify/functions/fis-oku-background', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify({ fisId: fis.id, talimat: okumaTalimati(firma || { ad: fis.firma }) }) });
    if (!r.ok && r.status !== 202) throw new Error('Okuma başlatılamadı (' + r.status + ')');
  }
  async function gonder() {
    const firma = D.firmalar.find(f => f.ad === D.secili);
    if (!firma || !D.secilen.length || D.gonderiliyor) return;
    D.gonderiliyor = true; const dosyalar = D.secilen; D.secilen = [];
    let n = 0;
    try {
      for (const file of dosyalar) {
        n++; D.mesaj = `Yükleniyor (${n}/${dosyalar.length})…`; D.mesajTur = ''; render();
        const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        const bloblar = pdf ? await pdfGorseller(file) : [await gorselHazirla(file)];
        const id = crypto.randomUUID(), kayitlar = [];
        for (let i = 0; i < bloblar.length; i++) {
          const yol = `${id}/${i + 1}.jpg`;
          const { error } = await sb.storage.from('fisler').upload(yol, bloblar[i], { contentType: 'image/jpeg' });
          if (error) throw new Error('Görsel yüklenemedi: ' + error.message);
          kayitlar.push({ yol, ad: (file.name || 'fis') + (bloblar.length > 1 ? ` (s${i + 1})` : ''), tur: 'image/jpeg' });
        }
        const fis = { id, firma: firma.ad, dosyalar: kayitlar, durum: 'okunuyor', gonderilme: new Date().toISOString() };
        const { error } = await sb.from('ug_fis').insert(fis);
        if (error) throw new Error(error.message);
        D.fisler.unshift(fis);
        await okut(fis);
      }
      D.mesaj = `${dosyalar.length} belge gönderildi. Yapay zekâ okuyor; bir iki dakika içinde aşağıda "Kontrol edin" olarak görünecek.`; D.mesajTur = 'ok';
      D.filtre = 'acik';
    } catch (e) { D.mesaj = 'Gönderilemedi: ' + e.message; D.mesajTur = 'err'; D.secilen = dosyalar.slice(n - 1); }
    D.gonderiliyor = false;
    try { await fisleriAl(); } catch {}
    render(); izle();
  }

  // --- kaydetme ve Paraşüt ---
  const temizSatirlar = t => t.satirlar.filter(s => String(s.urun || '').trim() && sayi(s.adet) > 0).map(s => ({ adet: sayi(s.adet), urun: buyuk(s.urun), fiyat: sayi(s.fiyat), grup: String(s.grup || '').trim(),
    ...(s.parasutId ? { parasutId: s.parasutId, parasutAd: urunAd(s.parasutId) } : { yeniUrun: true, yeniAd: buyuk(s.pAd || s.urun) }) }));
  async function taslakKaydet(f) {
    const t = taslak(f);
    const veri = { tarih: t.tarih || null, ust: t.ust, satirlar: temizSatirlar(t), guncel: new Date().toISOString() };
    const { error } = await sb.from('ug_fis').update(veri).eq('id', f.id);
    if (error) throw new Error(error.message);
    Object.assign(f, veri);
  }
  async function aktar(id) {
    const f = D.fisler.find(x => x.id === id); if (!f || D.mesgul[id]) return;
    const t = taslak(f), sat = temizSatirlar(t);
    D.uyari[id] = '';
    if (!t.tarih) D.uyari[id] = 'Fiş tarihini girin.';
    else if (!sat.length) D.uyari[id] = 'Fişte satır yok.';
    else if (sat.some(s => !(s.fiyat > 0))) D.uyari[id] = 'Fiyatı boş ya da 0 olan satır var.';
    else if (benzerFis(f, sat) && !D.emin[id]) { D.emin[id] = true; D.uyari[id] = 'Bu fiş daha önceki bir fişe çok benziyor (yukarıdaki uyarı). Farklı bir fiş olduğundan eminseniz "Yine de aktar"a basın.'; }
    if (D.uyari[id]) return render();
    D.mesgul[id] = 'Paraşüt\'e giriliyor…'; render();
    try {
      await taslakKaydet(f);
      const r = await sor({ islem: 'fis_aktar', id, zorla: !!D.emin[id] });
      if (r.mukerrer) { D.emin[id] = true; D.uyari[id] = r.mukerrer + ' Aynı fişse aktarmayın, silin; farklıysa "Yine de aktar"a basın.'; }
      else {
        delete D.tas[id];
        for (const s of sat) if (s.parasutId) D.urunEsl.set(f.firma + '|' + s.urun, s.parasutId);
        toast(`${r.dosyaNo} Paraşüt'e girildi`);
        D.mesaj = r.ozet + ` Klasördeki fiş görselinin yeni adı: ${r.dosyaNo}.`; D.mesajTur = 'ok';
        const v = await sor({ islem: 'urunler', taze: true }).catch(() => null);
        if (v) { D.urunler = v.urunler.map(([id, ad, alis, , , , , arsiv]) => ({ id: String(id), ad, alis: Number(alis) || 0, arsiv: !!arsiv })); urunListesi(); }
      }
    } catch (e) { D.uyari[id] = 'Aktarılamadı: ' + e.message; }
    delete D.mesgul[id];
    try { await fisleriAl(); } catch {}
    render();
  }
  async function satisYap(id, grup) {
    const f = D.fisler.find(x => x.id === id); if (!f) return;
    const k = id + '|' + grup, g = satisGruplari(f.satirlar).find(x => x.ad === grup);
    const st = D.satis[k] ||= { musteri: musteriTahmini(grup), fiyatlar: {} };
    const fiyatlar = g.satirlar.map((_, i) => sayi(st.fiyatlar[i]));
    if (!st.musteri) { D.uyari[k] = 'Müşteriyi seçin.'; return render(); }
    if (fiyatlar.some(x => !(x > 0))) { D.uyari[k] = 'Tüm satış fiyatlarını girin.'; return render(); }
    D.uyari[k] = ''; D.mesgul[k] = 'Satış faturası giriliyor…'; render();
    try {
      const r = await sor({ islem: 'fis_satis', id, grup, musteriId: st.musteri, fiyatlar });
      D.musEsl.set(grupAnahtar(grup), String(st.musteri)); delete D.satis[k];
      toast(`${r.musteri} satışı Paraşüt'e girildi`);
    } catch (e) { D.uyari[k] = 'Girilemedi: ' + e.message; }
    delete D.mesgul[k];
    try { await fisleriAl(); } catch {}
    render();
  }
  async function sil(id) {
    const f = D.fisler.find(x => x.id === id); if (!f) return;
    if (!D.emin['sil' + id]) { D.emin['sil' + id] = true; return render(); }
    const { error } = await sb.from('ug_fis').delete().eq('id', id);
    if (error) { D.uyari[id] = 'Silinemedi: ' + error.message; return render(); }
    const yollar = (f.dosyalar || []).map(d => d.yol).filter(Boolean);
    // aynı fotoğraftan çıkan başka fiş görseli kullanıyorsa dosya kalır
    if (yollar.length && !D.fisler.some(o => o.id !== id && (o.dosyalar || []).some(d => yollar.includes(d.yol)))) sb.storage.from('fisler').remove(yollar).catch(() => {});
    D.fisler = D.fisler.filter(x => x.id !== id); delete D.tas[id];
    render();
  }
  async function yenidenOku(id) {
    const f = D.fisler.find(x => x.id === id); if (!f) return;
    const { error } = await sb.from('ug_fis').update({ durum: 'okunuyor', okuma_hata: null, guncel: new Date().toISOString() }).eq('id', id);
    if (error) { D.uyari[id] = error.message; return render(); }
    f.durum = 'okunuyor'; delete D.tas[id]; render();
    try { await okut(f); } catch (e) { D.uyari[id] = e.message; }
    izle(); render();
  }
  async function firmaEkle() {
    const ad = D.yeniFirma.ad.trim().replace(/\s+/g, ' ');
    if (!ad) { D.mesaj = 'Firma adını yazın.'; D.mesajTur = 'err'; return render(); }
    if (D.firmalar.some(f => f.ad.toLocaleLowerCase('tr') === ad.toLocaleLowerCase('tr'))) { D.mesaj = 'Bu firma zaten var.'; D.mesajTur = 'err'; return render(); }
    const yeni = { ad, tur: 'foto', kurallar: D.yeniFirma.kurallar.split('\n').map(s => s.trim()).filter(Boolean), sira: Math.max(0, ...D.firmalar.map(f => f.sira || 0)) + 1 };
    const { data, error } = await sb.from('ug_firma').insert(yeni).select().single();
    if (error) { D.mesaj = 'Eklenemedi: ' + error.message; D.mesajTur = 'err'; return render(); }
    D.firmalar.push(data); D.yeniFirma = { ad: '', kurallar: '' }; secFirma(ad);
    D.mesaj = `"${ad}" eklendi. Paraşüt'teki tedarikçi adı birebir aynı olmalı; ilk aktarımda tedarikçi adından bulunur.`; D.mesajTur = 'ok';
    render();
  }
  function secFirma(ad) { D.secili = ad; D.secilen = []; D.filtre = 'acik'; try { localStorage.setItem('clk-ug-firma', ad); } catch {} }

  // fiş görseli sayfanın içinde büyük açılır; tıklayınca yakınlaşır, döndürülür
  function fotoBuyut(url) {
    let derece = 0;
    const kutu = document.createElement('div');
    kutu.className = 'ug-buyuk'; kutu.setAttribute('role', 'dialog');
    kutu.innerHTML = `<div class="ug-buyuk-arac"><button class="btn" data-b="yak">Yakınlaştır</button><button class="btn" data-b="don">Döndür</button><button class="btn dark" data-b="kapat">Kapat</button></div><div class="ug-buyuk-alan"><img alt="Fiş" src="${esc(url)}"></div>`;
    const img = kutu.querySelector('img');
    const kapat = () => { kutu.remove(); removeEventListener('keydown', tus); };
    const tus = e => { if (e.key === 'Escape') kapat(); };
    kutu.addEventListener('click', e => {
      const b = e.target.closest('[data-b]')?.dataset.b;
      if (b === 'kapat' || e.target.classList.contains('ug-buyuk-alan')) kapat();
      else if (b === 'yak' || e.target === img) img.classList.toggle('yakin');
      else if (b === 'don') { derece = (derece + 90) % 360; img.style.transform = `rotate(${derece}deg)`; }
    });
    addEventListener('keydown', tus); document.body.append(kutu);
  }
  // görseli olmayan (panelden taşınan) fişe sonradan görsel eklenir
  function gorselEkle(id, i) {
    const f = D.fisler.find(x => x.id === id); if (!f) return;
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*,application/pdf' });
    inp.addEventListener('change', async () => {
      const file = inp.files[0]; if (!file) return;
      try {
        toast('Görsel yükleniyor…');
        const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        const blob = pdf ? (await pdfGorseller(file))[0] : await gorselHazirla(file);
        const yol = `${id}/${i + 1}.jpg`;
        const { error } = await sb.storage.from('fisler').upload(yol, blob, { contentType: 'image/jpeg', upsert: true });
        if (error) throw new Error(error.message);
        const dosyalar = [...(f.dosyalar || [])];
        dosyalar[i] = { yol, ad: dosyalar[i]?.ad || file.name, tur: 'image/jpeg' };
        const r = await sb.from('ug_fis').update({ dosyalar }).eq('id', id);
        if (r.error) throw new Error(r.error.message);
        f.dosyalar = dosyalar; delete D.url[yol];
        await urlleriAl(); toast('Görsel eklendi'); render();
      } catch (e) { toast('Yüklenemedi: ' + e.message); }
    });
    inp.click();
  }
  async function indir(id, i) {
    const f = D.fisler.find(x => x.id === id), d = f?.dosyalar?.[i], url = d && D.url[d.yol];
    if (!url) return;
    const blob = await (await fetch(url)).blob();
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: (f.dosya_no || 'fis') + (f.dosyalar.length > 1 ? '-' + (i + 1) : '') + '.jpg' });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // --- görünüm ---
  const fotolar = f => (f.dosyalar || []).length ? `<div class="ug-fotolar">${f.dosyalar.map((d, i) => d.yol && D.url[d.yol]
    ? `<button class="ug-foto" data-act="ugBuyut" data-id="${f.id}" data-i="${i}" aria-label="Fişi büyüt"><img src="${esc(D.url[d.yol])}" alt="Fiş ${i + 1}" loading="lazy"></button>`
    : `<button class="ug-foto bos" data-act="ugGorselEkle" data-id="${f.id}" data-i="${i}">Görsel yok<br><b>Görseli yükle</b><br><small>${esc(d.ad || '')}</small></button>`).join('')}</div>` : '';
  const pill = durum => `<span class="ug-pill p-${durum}">${DURUM[durum] || durum}</span>`;

  function duzenTablosu(f) {
    const t = taslak(f), p = 'ug-' + kisa(f.id);
    const satirlar = t.satirlar.map((s, i) => {
      const once = oncekiAlis(s.parasutId, f.id), yeni = sayi(s.fiyat), farkli = once > 0 && yeni > 0 && Math.abs(once - yeni) >= 0.01;
      const v = (alan, tip, sinif, ek = '') => `<input id="${p}-${i}-${alan}" data-ug="${f.id}" data-i="${i}" data-alan="${alan}" type="${tip}" class="${sinif}" value="${esc(s[alan] ?? '')}" ${ek}>`;
      return `<tr>
        <td>${v('adet', 'text', 'ug-adet', 'inputmode="numeric" aria-label="Adet"')}</td>
        <td class="l">${v('urun', 'text', 'ug-urun', 'aria-label="Fişteki ad"')}</td>
        <td class="l"><div class="ug-p">${v('pAd', 'text', 'ug-parasut' + (s.parasutId ? '' : ' yeni'), 'list="ugUrunListe" placeholder="Paraşüt\'te yoksa boş bırakın" aria-label="Paraşüt ürünü"')}${s.parasutId ? '' : '<span class="ug-yeni">yeni ürün</span>'}</div></td>
        <td>${v('fiyat', 'text', 'ug-fiyat', 'inputmode="decimal" aria-label="Fiyat"')}${farkli ? `<span class="wp-fark">Önceki alış ${tl(once)} (${yeni > once ? '+' : ''}${tl(yeni - once)})</span>` : ''}</td>
        <td class="ug-tutar">${tl(sayi(s.adet) * sayi(s.fiyat))}</td>
        <td class="l">${v('grup', 'text', 'ug-grup', 'placeholder="kime gitti" aria-label="Gönderilen"')}</td>
        <td><button class="ug-x" data-act="ugSatirSil" data-id="${f.id}" data-i="${i}" aria-label="Satırı sil">×</button></td></tr>`;
    }).join('');
    return `<div class="ug-ust-alan"><label>Fiş tarihi<input id="${p}-tarih" type="date" data-ug="${f.id}" data-alan="tarih" value="${esc(t.tarih)}"></label>
        <label class="ug-not">Üst not (faturaya açıklama)<input id="${p}-ust" data-ug="${f.id}" data-alan="ust" value="${esc(t.ust)}"></label></div>
      <div class="ul-tablo"><table class="ug-tablo"><thead><tr><th>Adet</th><th>Fişteki ad</th><th>Paraşüt ürünü</th><th>Fiyat</th><th>Tutar</th><th>Gönderilen</th><th></th></tr></thead><tbody>${satirlar}</tbody></table></div>
      <div class="ug-toplam"><button class="btn" data-act="ugSatirEkle" data-id="${f.id}">+ Satır ekle</button><span>${t.satirlar.reduce((a, s) => a + sayi(s.adet), 0)} adet · Toplam <b>${tl(toplam(t.satirlar))}</b></span></div>`;
  }
  function salt(f) {
    const s = f.satirlar || [];
    return `<div class="ul-tablo"><table class="ug-tablo"><thead><tr><th>Adet</th><th>Ürün</th><th>Fiyat</th><th>Tutar</th><th>Gönderilen</th></tr></thead><tbody>${s.map(r => `<tr><td>${r.adet}</td><td class="l">${esc(r.parasutAd || r.urun)}${r.parasutAd && r.parasutAd !== r.urun ? `<br><small class="ug-meta">fişte: ${esc(r.urun)}</small>` : ''}</td><td>${tl(r.fiyat)}</td><td>${tl(sayi(r.adet) * sayi(r.fiyat))}</td><td class="l">${esc(r.grup || '')}</td></tr>`).join('')}</tbody></table></div>
      <div class="ug-toplam"><span></span><span>${s.reduce((a, r) => a + sayi(r.adet), 0)} adet · Toplam <b>${tl(toplam(s))}</b></span></div>`;
  }
  function satisBolumu(f) {
    const gruplar = satisGruplari(f.satirlar); if (!gruplar.length) return '';
    return `<div class="ug-satislar"><div class="ug-etiket">Satışlar · CLK ÇANTA dışındaki alıcılar</div>${gruplar.map(g => {
      const kayit = (f.satislar || []).find(x => x.grup === g.ad && x.durum === 'kaydedildi'), k = f.id + '|' + g.ad;
      if (kayit) {
        const st = kayit.satirlar.reduce((a, r) => a + r.adet * r.satisFiyat, 0), at = kayit.satirlar.reduce((a, r) => a + r.adet * r.fiyat, 0);
        return `<div class="ug-satis"><div class="ug-satis-ust"><div><b>${esc(kayit.musteri)}</b><div class="ug-meta">Fişte: ${esc(g.ad)}${kayit.parasutNo ? ' · Paraşüt ' + esc(kayit.parasutNo) : ''}</div></div>${pill('kaydedildi')}</div>
          <div class="ul-tablo"><table class="ug-tablo"><thead><tr><th>Adet</th><th>Ürün</th><th>Alış</th><th>Satış</th><th>Kâr</th><th>Tutar</th></tr></thead><tbody>${kayit.satirlar.map(r => `<tr><td>${r.adet}</td><td class="l">${esc(r.urun)}</td><td>${tl(r.fiyat)}</td><td>${tl(r.satisFiyat)}</td><td class="${karDusuk(r.fiyat, r.satisFiyat) ? 'ug-dusuk' : 'ug-kar'}">${karYuzde(r.fiyat, r.satisFiyat)}</td><td>${tl(r.adet * r.satisFiyat)}</td></tr>`).join('')}</tbody></table></div>
          <div class="ug-toplam"><span>Kâr <b class="${karDusuk(at, st) ? 'ug-dusuk' : ''}">${tl(st - at)} · ${karYuzde(at, st)}</b></span><span>Satış toplamı <b>${tl(st)}</b></span></div></div>`;
      }
      const st = D.satis[k] ||= { musteri: musteriTahmini(g.ad), fiyatlar: {} }, p = 'ugs-' + kisa(f.id) + '-' + normal(g.ad).slice(0, 12);
      const at = g.satirlar.reduce((a, r) => a + r.adet * r.fiyat, 0), tt = g.satirlar.reduce((a, r, i) => a + r.adet * sayi(st.fiyatlar[i]), 0);
      const tamam = g.satirlar.every((_, i) => sayi(st.fiyatlar[i]) > 0);
      return `<div class="ug-satis"><div class="ug-satis-ust"><div><b>Fişte: ${esc(g.ad)}</b></div>
          ${araKutu(p + '-m', D.musteriler, D.musteriler.find(m => String(m.id) === String(st.musteri))?.ad || '', 'ugsMus', { sinif: st.musteri ? '' : 'wp-req', ek: `data-k="${esc(k)}"` })}</div>
        <div class="ul-tablo"><table class="ug-tablo"><thead><tr><th>Adet</th><th>Ürün</th><th>Alış</th><th>Satış fiyatı</th><th>Kâr</th><th>Tutar</th></tr></thead><tbody>${g.satirlar.map((r, i) => { const sf = sayi(st.fiyatlar[i]); return `<tr><td>${r.adet}</td><td class="l">${esc(r.parasutAd || r.urun)}</td><td>${tl(r.fiyat)}</td>
          <td><input id="${p}-${i}" data-ugs="${esc(k)}" data-i="${i}" class="ug-fiyat" inputmode="decimal" value="${esc(st.fiyatlar[i] ?? '')}" aria-label="Satış fiyatı"></td><td class="${karDusuk(r.fiyat, sf) ? 'ug-dusuk' : 'ug-kar'}">${karYuzde(r.fiyat, sf)}</td><td>${tl(r.adet * sf)}</td></tr>`; }).join('')}</tbody></table></div>
        <div class="ug-toplam"><span>Kâr <b class="${tamam && karDusuk(at, tt) ? 'ug-dusuk' : ''}">${tamam ? tl(tt - at) + ' · ' + karYuzde(at, tt) : '–'}</b></span><span>Satış toplamı <b>${tl(tt)}</b></span></div>
        ${D.uyari[k] ? `<div class="wp-uyari">${esc(D.uyari[k])}</div>` : ''}
        <div class="ek-dug"><button class="btn dark" data-act="ugSatis" data-id="${f.id}" data-grup="${esc(g.ad)}" ${D.mesgul[k] ? 'disabled' : ''}>${D.mesgul[k] ? esc(D.mesgul[k]) : 'Satış yap (Paraşüt\'e gir)'}</button></div></div>`;
    }).join('')}</div>`;
  }
  function fisKarti(f) {
    // Paraşüt ürün listesi gelmeden taslak açılmaz (ürün tahmini listeye bakar)
    const duzen = f.durum === 'okundu' && !!D.urunler, t = duzen ? taslak(f) : null;
    const benzer = duzen ? benzerFis(f, t.satirlar) : null;
    const baslik = [f.dosya_no, f.tarih ? trT(f.tarih) : '', f.firma].filter(Boolean).join(' · ');
    const meta = [f.ust && !duzen ? 'Fişte: ' + f.ust : '', 'Gönderildi ' + new Date(f.gonderilme).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }), f.parasut_id ? 'Paraşüt ' + f.parasut_id : ''].filter(Boolean).join(' · ');
    return `<article class="card ug-fis${duzen && (f.sorular || []).length ? ' ug-soru-var' : ''}">
      <div class="ug-fis-ust"><div><h3>${esc(baslik)}</h3><div class="ug-meta">${esc(meta)}</div></div>${pill(f.durum)}</div>
      ${f.dosya_no && f.durum === 'kaydedildi' ? `<div class="ug-no">Klasördeki fiş görselinin yeni adı: <b>${esc(f.dosya_no)}</b></div>` : ''}
      ${fotolar(f)}
      ${f.okuma_hata ? `<div class="wp-uyari">${esc(f.okuma_hata)}</div>` : ''}
      ${f.parasut_not && f.durum === 'kaydedildi' ? `<p class="wp-not">${esc(f.parasut_not)}</p>` : ''}
      ${duzen && (f.sorular || []).length ? `<div class="ug-sorular"><b>Kontrol etmeniz gerekenler</b><ol>${f.sorular.map(q => `<li>${esc(q)}</li>`).join('')}</ol><small>Tabloyu fişe bakarak düzeltin, sonra aktarın.</small></div>` : ''}
      ${benzer ? `<div class="wp-uyari"><b>Dikkat, bu fiş daha önce işlenmiş olabilir.</b> ${benzer.fis.tarih ? trT(benzer.fis.tarih) + ' tarihli' : 'Daha önce okunan'} ${esc(benzer.fis.dosya_no || '')} fişle ${benzer.ayni} satırı aynı (ürün ve adet)${benzer.ayniTutar ? ', toplamı da aynı' : ''}${benzer.fis.durum === 'kaydedildi' ? '; o fiş Paraşüt\'e girildi.' : '; o fiş henüz aktarılmadı.'} Aynı fişse aktarmayın, silin.</div>` : ''}
      ${f.durum === 'okundu' && !D.urunler ? '<p class="wp-not">Paraşüt ürünleri yükleniyor…</p>' : ''}
      ${duzen ? duzenTablosu(f) : (f.satirlar || []).length ? salt(f) : f.durum === 'okunuyor' ? '<p class="wp-not">Yapay zekâ fişi okuyor (bir iki dakika)…</p>' : ''}
      ${D.uyari[f.id] ? `<div class="wp-uyari">${esc(D.uyari[f.id])}</div>` : ''}
      ${duzen ? `<div class="ek-dug">
          <button class="btn dark" data-act="ugAktar" data-id="${f.id}" ${D.mesgul[f.id] ? 'disabled' : ''}>${D.mesgul[f.id] ? esc(D.mesgul[f.id]) : D.emin[f.id] ? 'Yine de aktar' : 'Paraşüt\'e aktar (alış)'}</button>
          <button class="btn" data-act="ugKaydet" data-id="${f.id}">Değişiklikleri kaydet</button>
          <button class="btn" data-act="ugOku" data-id="${f.id}">Yeniden oku</button>
          <button class="btn" data-act="ugSil" data-id="${f.id}">${D.emin['sil' + f.id] ? 'Silmek için tekrar basın' : 'Sil'}</button></div>` : ''}
      ${f.durum === 'hata' ? `<div class="ek-dug"><button class="btn dark" data-act="ugOku" data-id="${f.id}">Yeniden oku</button><button class="btn" data-act="ugSil" data-id="${f.id}">${D.emin['sil' + f.id] ? 'Silmek için tekrar basın' : 'Sil'}</button></div>` : ''}
      ${f.durum === 'kaydedildi' ? satisBolumu(f) : ''}
    </article>`;
  }
  function arsiv() {
    const q = normal(D.arsivAra), kayit = D.fisler.filter(f => f.dosya_no && (!D.arsivFirma || f.firma === D.arsivFirma))
      .sort((a, b) => (Number(String(b.dosya_no).replace(/\D/g, '')) || 0) - (Number(String(a.dosya_no).replace(/\D/g, '')) || 0))
      .filter(f => !q || normal([f.dosya_no, f.firma, trT(f.tarih), f.ust, f.parasut_id].join(' ')).includes(q));
    const sayac = {}; D.fisler.filter(f => f.dosya_no).forEach(f => sayac[f.firma] = (sayac[f.firma] || 0) + 1);
    return `<div class="card"><h3 class="wp-h">Fiş arşivi</h3><p class="wp-not">Paraşüt'e aktarılan her fişin görseli burada clk numarasıyla durur. "İndir" dosyayı clk numarasıyla kaydeder.</p>
      <div class="ug-klasor">${[['', 'Tüm firmalar', Object.values(sayac).reduce((a, b) => a + b, 0)], ...Object.keys(sayac).sort((a, b) => a.localeCompare(b, 'tr')).map(a => [a, a, sayac[a]])].map(([d, ad, n]) =>
        `<button class="sk-f" data-act="ugArsivFirma" data-ad="${esc(d)}" aria-pressed="${D.arsivFirma === d}"><b>${esc(ad)}</b><small>${n} fiş</small></button>`).join('')}</div>
      <div class="sk-arac"><input id="ugArsivAra" type="search" placeholder="clk no, firma ya da tarih ara" value="${esc(D.arsivAra)}"></div>
      <div class="ug-arsiv">${kayit.length ? kayit.map(f => { const d = (f.dosyalar || [])[0], u = d?.yol && D.url[d.yol]; return `<article class="ug-arsiv-kart">
        ${u ? `<button class="ug-foto" data-act="ugBuyut" data-id="${f.id}" data-i="0"><img src="${esc(u)}" alt="${esc(f.dosya_no)}" loading="lazy"></button>` : `<button class="ug-foto bos" data-act="ugGorselEkle" data-id="${f.id}" data-i="0">Görsel yok<br><b>Görseli yükle</b><br><small>${esc(d?.ad || '')}</small></button>`}
        <div><b class="ug-arsiv-no">${esc(f.dosya_no)}</b><div>${esc(f.firma)}</div><div class="ug-meta">${[trT(f.tarih), tl(toplam(f.satirlar)), f.parasut_id ? 'Paraşüt ' + f.parasut_id : ''].filter(Boolean).join(' · ')}</div>
        ${u ? `<div class="ek-dug">${f.dosyalar.map((_, i) => `<button class="btn" data-act="ugIndir" data-id="${f.id}" data-i="${i}">${f.dosyalar.length > 1 ? 'İndir ' + (i + 1) : 'İndir'}</button>`).join('')}</div>` : ''}</div></article>`; }).join('') : '<p class="wp-not">Aramaya uyan fiş yok.</p>'}</div></div>`;
  }

  views.urungiris = () => {
    if (!D.yuklendi) yukle();
    const ust = head('Paraşüt', 'Ürün Giriş', 'Tedarikçi fişinin fotoğrafını ya da PDF\'ini yükleyin; yapay zekâ okur. Kontrol edip "Paraşüt\'e aktar"a basınca alış faturası doğrudan Paraşüt\'e girilir, CLK dışındaki alıcılara satış faturası da buradan kesilir.');
    if (D.hata) return ust + `<div class="card empty"><h3>Veri alınamadı</h3><p>${esc(D.hata)}</p><button class="btn dark" data-act="ugYenile">Tekrar dene</button></div>`;
    if (!D.hazir) return ust + '<div class="card"><div class="skel" style="height:300px"></div></div>';
    const menu = `<div class="ug-menu">${D.firmalar.map(f => { const n = D.fisler.filter(x => x.firma === f.ad && acik(x)).length;
      return `<button class="sk-f" data-act="ugFirma" data-ad="${esc(f.ad)}" aria-pressed="${D.secili === f.ad}"><b>${esc(f.ad)}${n ? ` <span class="ug-rozet">${n}</span>` : ''}</b><small>${D.fisler.filter(x => x.firma === f.ad).length} fiş</small></button>`; }).join('')}
      <button class="sk-f" data-act="ugFirma" data-ad="__arsiv" aria-pressed="${D.secili === '__arsiv'}"><b>Fiş arşivi</b><small>${D.fisler.filter(f => f.dosya_no).length} fiş · clk no</small></button>
      <button class="sk-f" data-act="ugFirma" data-ad="__yeni" aria-pressed="${D.secili === '__yeni'}"><b>+ Yeni firma</b><small>tedarikçi ekle</small></button></div>`;
    const msj = D.mesaj ? `<p class="wp-msg ${D.mesajTur}" role="status">${esc(D.mesaj)}</p>` : '';
    if (D.secili === '__arsiv') return ust + menu + msj + arsiv();
    if (D.secili === '__yeni') return ust + menu + `<div class="card"><h3 class="wp-h">Yeni firma</h3>
      <div class="ek-form wp-form"><label class="ek-mus">Firma adı (Paraşüt'teki tedarikçi adıyla aynı)<input id="ugFirmaAd" value="${esc(D.yeniFirma.ad)}"></label></div>
      <label class="ug-kural-alan">Bu firmaya özel okuma kuralları (isteğe bağlı, her satıra bir kural)<textarea id="ugFirmaKural" rows="4">${esc(D.yeniFirma.kurallar)}</textarea></label>
      <div class="ek-dug"><button class="btn dark" data-act="ugFirmaEkle">Firmayı ekle</button></div>${msj}
      <p class="wp-not">Tedarikçi Paraşüt'te yoksa önce Paraşüt'te açın; buradan yeni tedarikçi açılmaz.</p></div>`;
    const firma = D.firmalar.find(f => f.ad === D.secili);
    const benim = D.fisler.filter(f => f.firma === D.secili);
    const gorunen = benim.filter(f => D.filtre === 'hepsi' || (D.filtre === 'kaydedildi' ? !acik(f) : acik(f)))
      .sort((a, b) => D.filtre === 'acik' ? String(a.gonderilme).localeCompare(String(b.gonderilme)) : String(b.tarih || b.gonderilme).localeCompare(String(a.tarih || a.gonderilme)));
    const ad = { acik: 'İşlem bekleyen', kaydedildi: 'Kaydedilen', hepsi: 'Hepsi' };
    return ust + menu + `<div class="card"><h3 class="wp-h">${esc(firma.ad)}</h3>
        ${(firma.kurallar || []).length ? `<details class="ug-kurallar"><summary>Okuma kuralları (${firma.kurallar.length})</summary><ul>${firma.kurallar.map(k => `<li>${esc(k)}</li>`).join('')}</ul></details>` : ''}
        <label class="wp-drop" id="ugDrop"><input type="file" id="ugDosya" accept="image/*,application/pdf" multiple hidden>
          <b>${D.secilen.length ? D.secilen.length + ' belge seçildi' : 'Fiş fotoğraflarını ya da PDF\'i seçin'}</b><small>Buraya sürükleyin ya da dokunup seçin · birden fazla seçebilirsiniz, her fotoğraf ayrı fiş olur</small></label>
        ${D.secilen.length ? `<div class="ug-secilen">${D.secilen.map((f, i) => `<span>${esc(f.name || 'fotoğraf')} <button class="ug-x" data-act="ugCikar" data-i="${i}" aria-label="Çıkar">×</button></span>`).join('')}</div>` : ''}
        <div class="ek-dug"><button class="btn dark" data-act="ugGonder" ${D.secilen.length && !D.gonderiliyor ? '' : 'disabled'}>${D.gonderiliyor ? 'Gönderiliyor…' : 'Gönder ve oku'}</button></div>${msj}</div>
      <div class="ug-filtre">${Object.entries(ad).map(([k, t]) => `<button class="btn${D.filtre === k ? ' dark' : ''}" data-act="ugFiltre" data-f="${k}">${t}${k === 'acik' ? ` (${benim.filter(acik).length})` : ''}</button>`).join('')}</div>
      ${gorunen.length ? gorunen.map(fisKarti).join('') : `<div class="card empty"><p>${benim.length ? (D.filtre === 'acik' ? 'Bekleyen fiş yok. Aktarılan fişler "Kaydedilen" altında.' : 'Bu filtrede fiş yok.') : 'Bu firmadan henüz fiş gönderilmedi.'}</p></div>`}`;
  };

  views.bind_urungiris = () => {
    const drop = $('#ugDrop'), dosya = $('#ugDosya');
    const ekle = list => { D.secilen = D.secilen.concat([...list].filter(f => f.type.startsWith('image/') || f.type === 'application/pdf' || /\.pdf$/i.test(f.name))); D.mesaj = ''; render(); };
    dosya?.addEventListener('change', () => { ekle(dosya.files); dosya.value = ''; });
    drop?.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('on'); });
    drop?.addEventListener('dragleave', () => drop.classList.remove('on'));
    drop?.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('on'); ekle(e.dataTransfer.files); });
    // fiş tablosu: her değişiklik taslağa yazılır; Paraşüt ürünü listeden birebir seçilince eşleşir
    // yazarken sayfa yeniden çizilmez (liste önerileri kapanmasın); alandan çıkınca ya da listeden ürün seçilince toplamlar güncellenir
    const ciz = () => { S.keepScroll = true; render(); };
    document.querySelectorAll('[data-ug]').forEach(inp => {
      inp.addEventListener('input', () => {
        const f = D.fisler.find(x => x.id === inp.dataset.ug); if (!f) return;
        const t = taslak(f), alan = inp.dataset.alan;
        D.uyari[f.id] = '';
        if (inp.dataset.i == null) return void (t[alan] = inp.value);
        const s = t.satirlar[+inp.dataset.i]; s[alan] = inp.value;
        if (alan === 'pAd') { const once = s.parasutId; s.parasutId = adHarita.get(inp.value.trim()) || ''; if (s.parasutId && s.parasutId !== once) ciz(); }
      });
      inp.addEventListener('change', ciz);
    });
    document.querySelectorAll('[data-ugs]').forEach(inp => {
      inp.addEventListener('input', () => {
        const st = D.satis[inp.dataset.ugs]; if (!st) return;
        if (inp.dataset.alan === 'musteri') st.musteri = inp.value; else st.fiyatlar[inp.dataset.i] = inp.value;
      });
      inp.addEventListener('change', ciz);
    });
    $('#ugFirmaAd')?.addEventListener('input', e => { D.yeniFirma.ad = e.target.value; });
    $('#ugFirmaKural')?.addEventListener('input', e => { D.yeniFirma.kurallar = e.target.value; });
    $('#ugArsivAra')?.addEventListener('input', e => { D.arsivAra = e.target.value; S.keepScroll = true; render(); });
  };

  araSec.ugsMus = (m, kutu) => { const st = D.satis[kutu.dataset.k]; if (st) st.musteri = m.id; };
  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    const id = el.dataset.id, f = id && D.fisler.find(x => x.id === id);
    if (act === 'ugFirma') { secFirma(el.dataset.ad); D.mesaj = ''; render(); }
    else if (act === 'ugFiltre') { D.filtre = el.dataset.f; render(); }
    else if (act === 'ugGonder') gonder();
    else if (act === 'ugCikar') { D.secilen.splice(+el.dataset.i, 1); render(); }
    else if (act === 'ugAktar') aktar(id);
    else if (act === 'ugKaydet') taslakKaydet(f).then(() => toast('Değişiklikler kaydedildi'), err => { D.uyari[id] = 'Kaydedilemedi: ' + err.message; render(); });
    else if (act === 'ugOku') yenidenOku(id);
    else if (act === 'ugSil') sil(id);
    else if (act === 'ugSatirSil') { taslak(f).satirlar.splice(+el.dataset.i, 1); S.keepScroll = true; render(); }
    else if (act === 'ugSatirEkle') { const t = taslak(f); t.satirlar.push({ adet: 1, urun: '', fiyat: '', grup: t.satirlar.at(-1)?.grup || '', parasutId: '', pAd: '' }); S.keepScroll = true; render(); }
    else if (act === 'ugSatis') satisYap(id, el.dataset.grup);
    else if (act === 'ugBuyut') { const d = f?.dosyalar?.[+el.dataset.i]; if (d && D.url[d.yol]) fotoBuyut(D.url[d.yol]); }
    else if (act === 'ugGorselEkle') gorselEkle(id, +el.dataset.i);
    else if (act === 'ugIndir') indir(id, +el.dataset.i).catch(err => toast('İndirilemedi: ' + err.message));
    else if (act === 'ugArsivFirma') { D.arsivFirma = el.dataset.ad; render(); }
    else if (act === 'ugFirmaEkle') firmaEkle();
    else if (act === 'ugYenile') { D.yuklendi = false; render(); }
    else prevAct?.(act, el, e);
  };
})();
