/* CLK Yönetim — müşteri sayfasındaki Paraşüt hesap hareketleri (celik 06.11.2026: "müşterilerden x müşteriye girince paraşütten eski satışları yaz.
   hatta tarayıcıdan gir paraşüt gibi düzenle. ödeme gir senet gir cari hesabını borcu gör. daha farklı kolay yap onu. ekstre ve satış sayfalarını orda toplayalım").
   Paraşüt'ün müşteri ekranındaki "işlem geçmişi" (siparis-parasut gecmis → contacts/<id>/transaction_history_items) yeniden eskiye, Paraşüt'ün
   yürüyen bakiyesiyle listelenir; satışa dokununca kalemleri açılır, Satış faturası sayfasındaki kontrol listesi olarak yazdırılır ya da PDF olur.
   Ekstre resmi (Müşteri ekstresi sayfasındakiyle aynı) seçili dönemden çizilir. Yalnız okur; Paraşüt'e yazan tek şey numarasız faturaya CLK-SF numarası. */
(() => {
  const { sb, S, $, esc, tl, tl2, dt, toast, views, render } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/siparis-parasut';
  const bugun = () => new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);
  const gunEkle = (g, n) => new Date(Date.parse(g + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const bekle = ms => new Promise(r => setTimeout(r, ms));
  // pid: site üye no → Paraşüt müşteri no ('' = eşleşmemiş); v: Paraşüt no → okunan hareketler
  const H = (S.ui.mh ||= { pid: {}, pidYuk: {}, v: {}, donem: '90', tur: 'hepsi', acik: '', detay: {}, dYuk: '', dHata: '', belge: '', ek: null });
  const DONEM = [['90', 'Son 3 ay'], ['180', '6 ay'], ['365', '1 yıl'], ['0', 'Hepsi']];
  const TUR = [['hepsi', 'Hepsi'], ['satis', 'Satışlar'], ['odeme', 'Ödemeler']];
  const basTarih = d => d === '0' ? '' : gunEkle(bugun(), -Number(d));
  const ciz = () => { if (S.route === 'musteri') { S.keepScroll = true; render(); } };
  const gorur = () => CLK.izin('cari') || CLK.izin('ekstre');

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
    if (r.status === 401 && govde.islem === 'gecmis') throw new Error('Paraşüt hareketleri için sunucu güncellemesi bekleniyor.');
    if (!r.ok || j?.hata) throw new Error(j?.hata || 'Sunucu ' + r.status);
    return j;
  }

  // site üyesinin Paraşüt müşterisi (eşitlemenin eşleşme tablosu)
  async function pidBul(uid) {
    if (H.pidYuk[uid]) return;
    H.pidYuk[uid] = true;
    try {
      const { data, error } = await sb.from('sp_musteri_eslesme').select('parasut_id').eq('site_ad', 'u:' + uid).maybeSingle();
      if (error) throw error;
      H.pid[uid] = data?.parasut_id ? String(data.parasut_id) : '';
    } catch { H.pid[uid] = ''; }
    H.pidYuk[uid] = false; ciz();
  }

  // eldeki hareketler istenen tarihten eskiye ulaşmadıysa sonraki sayfalar istenir: seçili dönem, ama özet için en az son 1 yıl
  const yilBas = () => gunEkle(bugun(), -365);
  const eksik = (v, bas) => !!v && !v.hata && !!v.sonraki && (!bas || (v.satirlar.at(-1)?.t || '9999') >= bas);
  const hedef = () => { const b = basTarih(H.donem); return !b ? '' : b < yilBas() ? b : yilBas(); };
  const dahaGerek = v => !!v && !v.yuk && eksik(v, hedef());
  async function yukle(pid, sayfa = 1) {
    const v = H.v[pid] ||= { satirlar: [], sonraki: 1, yuk: false, hata: '' };
    if (v.yuk) return;
    v.yuk = true; v.hata = ''; ciz();
    try {
      const j = await sor({ islem: 'gecmis', id: pid, sayfa, adet: sayfa === 1 ? 2 : 4 });
      if (sayfa === 1) { v.satirlar = []; v.bakiye = j.bakiye; v.ad = j.ad; v.zaman = Date.now(); }
      const var_ = new Set(v.satirlar.map(x => x.id));
      v.satirlar.push(...j.satirlar.filter(x => !var_.has(x.id)));
      v.sonraki = j.sonraki; v.toplam = j.toplamAdet;
    } catch (e) { v.hata = e.message; }
    v.yuk = false; ciz();
    if (dahaGerek(v) && S.route === 'musteri') yukle(pid, v.sonraki);
  }
  // ödeme ya da senet girilince (views-tahsilat, views-senet) hareketler yeniden okunur
  document.addEventListener('clk:cari', e => {
    const pid = String(e.detail?.musteri || '');
    if (pid && H.v[pid]) { delete H.v[pid]; if (S.route === 'musteri') setTimeout(() => yukle(pid), 1500); }
  });

  /* ---------- satırlar ---------- */
  const senetMi = x => !!x.cek?.senet;
  const turAd = x => ({
    sales_invoice: x.yon < 0 ? 'İade faturası' : 'Satış faturası', contact_credit: 'Tahsilat', contact_debit: 'Müşteriye ödeme',
    check_in: senetMi(x) ? 'Alınan senet' : 'Alınan çek', check_out: senetMi(x) ? 'Verilen senet' : 'Verilen çek',
    purchase_bill: 'Alış faturası', opening_balance: 'Açılış bakiyesi', contact_transfer: 'Cari virman'
  }[x.tur] || (x.yon < 0 ? 'Alacak kaydı' : 'Borç kaydı'));
  const aciklama = x => {
    if (x.cek) return [x.cek.banka && x.cek.banka !== 'OTHER' ? x.cek.banka : '', x.cek.seri ? '#' + x.cek.seri : '', x.cek.vade ? 'vade ' + dt(x.cek.vade) : '', x.ack].filter(Boolean).join(' · ');
    if (x.fid) return [x.no, x.oto || x.ack].filter(Boolean).join(' · ');
    return [x.hesap, x.ack || x.oto].filter(Boolean).join(' · ');
  };
  const odemeMi = x => ['contact_credit', 'check_in'].includes(x.tur) || (x.tur === 'sales_invoice' && x.yon < 0);
  const ikon = x => x.fid ? (x.yon < 0 ? '↺' : '▤') : x.cek ? '▭' : x.yon < 0 ? '₺' : '↗';
  // bakiye: artı = müşterinin borcu (Paraşüt'teki gibi), eksi = fazla ödeme
  const bakYaz = b => b < -0.005 ? `<span class="mh-fazla">${tl2(-b)} fazla</span>` : tl2(b);

  function donemSatirlari(v) {
    const bas = basTarih(H.donem);
    const l = v.satirlar.filter(x => !bas || x.t >= bas);
    const once = bas ? v.satirlar.find(x => x.t < bas) : null;
    // dönemin başındaki bakiye: dönemden önceki ilk hareketin bakiyesi; daha eskisi okunmadıysa bilinmiyor
    const devir = !bas ? null : once ? once.b : v.sonraki ? undefined : 0;
    return { l, devir, bas };
  }

  function detayHtml(x) {
    const d = H.detay[x.fid];
    if (H.dYuk === x.fid) return '<li class="mh-det"><p class="hint">Satışın kalemleri Paraşüt\'ten okunuyor…</p></li>';
    if (!d) return H.dHata ? `<li class="mh-det"><p class="msg err">${esc(H.dHata)}</p></li>` : '';
    const adet = d.kalemler.reduce((a, k) => a + (Number(k[1]) || 0), 0);
    return `<li class="mh-det"><div class="mh-det-in">
      <div class="mh-det-h"><b>${esc(d.no || x.no || 'Numarasız fatura')}</b><span>${d.kalemler.length} kalem · ${adet} adet · ${tl2(d.toplam)}</span></div>
      <ul class="mh-kal">${d.kalemler.map(([urun, miktar, fiyat, tutar, renk]) => `<li><div><b>${esc(urun)}</b>${renk ? `<small>${esc(renk)}</small>` : ''}</div><span class="num">${miktar} × ${tl2(fiyat)}</span><b class="num">${tl2(tutar)}</b></li>`).join('')}</ul>
      ${d.aciklama ? `<p class="hint">${esc(d.aciklama)}</p>` : ''}
      <div class="mh-det-d"><button class="btn sm dark" data-act="mhYazdir" data-fid="${esc(x.fid)}" ${H.belge ? 'disabled' : ''}>${H.belge === 'y' ? 'Hazırlanıyor…' : 'Yazdır'}</button><button class="btn sm" data-act="mhPdf" data-fid="${esc(x.fid)}" ${H.belge ? 'disabled' : ''}>${H.belge === 'p' ? 'PDF hazırlanıyor…' : 'PDF indir'}</button><button class="btn sm ek-wa" data-act="mhWaPdf" data-fid="${esc(x.fid)}" ${H.belge ? 'disabled' : ''}>${H.belge === 'w' ? 'PDF hazırlanıyor…' : H.pdf?.fid === x.fid ? 'WhatsApp\'ta gönder' : 'WhatsApp'}</button></div>
    </div></li>`;
  }

  function satirHtml(x) {
    const acik = x.fid && H.acik === x.fid;
    const pill = x.fid && x.yon > 0 && x.kalan > 0.005 ? `<span class="pill ${x.kalan < x.tutar - 0.005 ? 'warn' : 'bad'}">${x.kalan < x.tutar - 0.005 ? 'Kalan ' + tl2(x.kalan) : 'Ödenmedi'}</span>` : '';
    const ic = `<span class="mh-ik" aria-hidden="true">${ikon(x)}</span>
      <span class="mh-tur"><b>${esc(turAd(x))}</b>${pill}</span>
      <span class="mh-ack">${esc(aciklama(x))}</span>
      <span class="mh-t">${dt(x.t)}</span>
      <b class="mh-tt num ${x.tutar < 0 ? 'pos' : ''}">${x.tutar < 0 ? '−' : ''}${tl2(Math.abs(x.tutar))}</b>
      <span class="mh-b num">${bakYaz(x.b)}</span>`;
    return x.fid
      ? `<li class="mh-s fat${acik ? ' on' : ''}"><button class="mh-sb" data-act="mhFatura" data-fid="${esc(x.fid)}" aria-expanded="${acik}">${ic}</button></li>${acik ? detayHtml(x) : ''}`
      : `<li class="mh-s"><div class="mh-sb">${ic}</div></li>`;
  }

  // müşterinin Paraşüt hareketleri: eşleşme aranır, okunur; hazır değilse yerine gösterilecek kutu döner
  function veri(u) {
    const uid = String(u.id), pid = H.pid[uid], okunuyor = '<p class="hint">Paraşüt\'ten hareketler okunuyor…</p><div class="skel" style="height:260px"></div>';
    if (pid === undefined) { if (!H.pidYuk[uid]) setTimeout(() => pidBul(uid), 0); return { bos: '<p class="hint">Paraşüt eşleşmesi aranıyor…</p><div class="skel" style="height:220px"></div>' }; }
    if (!pid) return { bos: `<div class="mh-bos"><b>Bu üye Paraşüt'te bir müşteriyle eşleşmemiş.</b><p>Eşleşince satışları, ödemeleri ve bakiyesi burada görünür.${CLK.izin('eslestirme') ? ' <button class="link" data-go="eslestirme">Eşleştirme sayfası</button>' : ''}</p></div>` };
    const v = H.v[pid];
    if (!v) { setTimeout(() => yukle(pid), 0); return { bos: okunuyor }; }
    if (!v.zaman && v.hata) return { bos: `<div class="mh-bos"><p class="msg err">${esc(v.hata)}</p><button class="btn sm dark" data-act="mhYenile" data-pid="${esc(pid)}">Tekrar dene</button></div>` };
    if (!v.zaman) return { bos: okunuyor };
    // sayfadan çıkılıp dönülünce yarım kalan okuma sürer
    if (dahaGerek(v)) setTimeout(() => yukle(pid, v.sonraki), 0);
    return { pid, v };
  }

  // müşteri sayfasındaki "Hesap hareketleri" sekmesi
  function html(u) {
    if (!gorur()) return '';
    const { bos, pid, v } = veri(u);
    if (bos) return bos;
    const { l: hepsi, devir, bas } = donemSatirlari(v);
    const l = hepsi.filter(x => H.tur === 'hepsi' || (H.tur === 'satis' ? !!x.fid : odemeMi(x)));
    const satis = hepsi.filter(x => x.fid && x.yon > 0).reduce((a, x) => a + x.tutar, 0);
    const odeme = hepsi.filter(odemeMi).reduce((a, x) => a - x.tutar, 0);
    const saat = new Date(v.zaman).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const yukleniyor = eksik(v, bas);
    return `<div class="mh-ust">
        <div class="chips mh-ch" role="group" aria-label="Dönem">${DONEM.map(([k, t]) => `<button class="chip" data-act="mhDonem" data-k="${k}" aria-pressed="${H.donem === k}">${t}</button>`).join('')}</div>
        <div class="chips mh-ch" role="group" aria-label="Tür">${TUR.map(([k, t]) => `<button class="chip" data-act="mhTur" data-k="${k}" aria-pressed="${H.tur === k}">${t}</button>`).join('')}</div>
      </div>
      <div class="mh-oz"><span>${bas ? dt(bas) + ' – bugün' : 'Bütün hareketler'}</span><span>Satış <b>${tl2(satis)}</b></span><span>Ödeme <b class="pos">${tl2(odeme)}</b></span></div>
      ${l.length ? `<ul class="mh-l"><li class="mh-th"><span></span><span>İşlem</span><span>Açıklama</span><span>Tarih</span><span class="r">Tutar</span><span class="r">Bakiye</span></li>${l.map(satirHtml).join('')}
        ${H.tur === 'hepsi' && devir !== undefined && devir !== null ? `<li class="mh-s devir"><div class="mh-sb"><span class="mh-ik"></span><span class="mh-tur"><b>Önceki dönemden kalan</b></span><span class="mh-ack"></span><span class="mh-t">${dt(bas)} öncesi</span><b class="mh-tt"></b><span class="mh-b num">${bakYaz(devir)}</span></div></li>` : ''}</ul>`
        : `<p class="sub mh-yok">${yukleniyor ? 'Okunuyor…' : 'Bu dönemde hareket yok.'}</p>`}
      <div class="mh-alt">
        <small>${yukleniyor ? 'Eski hareketler Paraşüt\'ten okunuyor…' : v.hata ? `<span class="cz-gec">${esc(v.hata)}</span>` : `Paraşüt'ten, ${saat} itibarıyla · ${v.toplam || v.satirlar.length} hareket. Satışa dokununca ürünleri açılır.`}</small>
        <span>${H.donem !== '0' && !yukleniyor && (v.sonraki || v.satirlar.some(x => bas && x.t < bas)) ? '<button class="btn sm" data-act="mhDaha">Daha eskisini göster</button>' : ''}${CLK.izin('urunlistesi') && CLK.satisListesiAc ? `<button class="btn sm" data-act="mhSatisListe" data-pid="${esc(pid)}" title="Seçtiğiniz satışları tek kontrol listesinde yazdırın">Birkaç satışı tek listede</button>` : ''}<button class="btn sm ghost" data-act="mhYenile" data-pid="${esc(pid)}" ${v.yuk ? 'disabled' : ''}>Yenile</button></span>
      </div>`;
  }

  /* ---------- ekstre resmi ---------- */
  // Paraşüt hareketleri Müşteri ekstresi sayfasının biçimine çevrilir (CLK.ekstre.ciz)
  function ekstreVeri(v) {
    const m = { ad: v.ad, bakiye: v.bakiye ?? v.satirlar[0]?.b ?? 0, satis: [], iade: [], odeme: [], verilen: [] };
    for (const x of v.satirlar) {
      const t = Math.abs(x.tutar);
      if (x.fid && x.yon > 0) m.satis.push([x.t, x.no, t, x.oto || x.ack]);
      else if (x.fid) m.iade.push([x.t, x.no, t]);
      else if (x.tur === 'check_in') m.odeme.push([x.t, 'c', t, x.cek?.vade || '', x.cek?.seri || '', '', senetMi(x) ? 1 : 0]);
      else if (x.yon < 0) m.odeme.push([x.t, 'n', t, '', '', [x.hesap, x.ack].filter(Boolean).join(' · ') || turAd(x)]);
      else m.verilen.push([x.t, [x.hesap || turAd(x), x.ack].filter(Boolean).join(' · '), t]);
    }
    return m;
  }
  async function ekstreHazirla(pid) {
    const v = H.v[pid];
    if (!v?.zaman || !CLK.ekstre) return;
    if (eksik(v, basTarih(H.donem))) { toast('Hareketler okunuyor, birkaç saniye sonra tekrar basın'); return; }
    const son = bugun(), bas = basTarih(H.donem) || v.satirlar.at(-1)?.t || son;
    const blob = await CLK.ekstre.ciz(ekstreVeri(v), bas, son);
    if (H.ek?.url) URL.revokeObjectURL(H.ek.url);
    H.ek = { blob, url: URL.createObjectURL(blob), dosya: `ekstre-${String(v.ad || 'musteri').toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]+/gi, '-').replace(/^-|-$/g, '')}-${son}.png`, bas, son };
    ciz();
  }
  const ekstreKapat = () => { if (H.ek?.url) URL.revokeObjectURL(H.ek.url); H.ek = null; ciz(); };
  const ekstreHtml = () => !H.ek ? '' : `<div class="mh-modal" data-act="mhEkKapat" role="dialog" aria-label="Ekstre"><div class="mh-modal-in">
      <div class="mh-modal-h"><div><b>Hesap özeti</b><small>${dt(H.ek.bas)} – ${dt(H.ek.son)} · dönemi üstteki seçimden değişir</small></div><button class="btn sm ghost" data-act="mhEkKapat">Kapat</button></div>
      <div class="mh-modal-img"><img src="${H.ek.url}" alt="Ekstre"></div>
      <div class="mh-modal-d"><button class="btn ek-wa" data-act="mhEkPaylas">WhatsApp'ta paylaş</button><button class="btn" data-act="mhEkIndir">Resmi indir</button><button class="btn" data-act="mhEkYazdir">Yazdır</button></div>
    </div></div>`;

  async function faturaAc(fid) {
    if (H.acik === fid) { H.acik = ''; ciz(); return; }
    H.acik = fid; H.dHata = '';
    if (H.detay[fid]) { ciz(); return; }
    H.dYuk = fid; ciz();
    try { H.detay[fid] = await sor({ islem: 'satis', id: fid }); }
    catch (e) { H.dHata = 'Satış okunamadı: ' + e.message; }
    if (H.dYuk === fid) H.dYuk = '';
    ciz();
  }
  async function belge(fid, pdf) {
    const d = H.detay[fid];
    if (!d || !CLK.satisBelge || H.belge) return;
    H.belge = pdf ? 'p' : 'y'; ciz();
    try {
      const no = await CLK.satisBelge(d, pdf);
      // numarası yeni yazıldıysa listedeki satır da güncellenir
      for (const v of Object.values(H.v)) for (const x of v.satirlar || []) if (x.fid === fid && !x.no && no) x.no = no;
    } catch (e) { toast(e.message); }
    H.belge = ''; ciz();
  }

  // satışın PDF'i WhatsApp'a dosya olarak (celik 06.11: "pdf indir yazdır butonun yanına whatsapp ekle"); hazırlanan PDF ikinci basış için saklanır
  async function waPdf(fid) {
    const d = H.detay[fid];
    if (!d || !CLK.satisBelge || !CLK.pdfPaylas || H.belge) return;
    if (H.pdf?.fid !== fid) {
      H.belge = 'w'; ciz();
      try {
        const r = await CLK.satisBelge(d, 'blob');
        H.pdf = { fid, ...r };
        for (const v of Object.values(H.v)) for (const x of v.satirlar || []) if (x.fid === fid && !x.no && r.no) x.no = r.no;
      } catch (e) { toast(e.message); }
      H.belge = ''; ciz();
      if (H.pdf?.fid !== fid) return;
    }
    const r = await CLK.pdfPaylas(H.pdf.blob, H.pdf.ad, (d.musteri || 'Satış') + (H.pdf.no ? ' – ' + H.pdf.no : ''));
    if (r === 'tekrar') toast('PDF hazır: göndermek için WhatsApp\'ta gönder\'e bir daha basın');
  }

  /* ---------- müşteri karnesi: "Özet" sekmesi (celik 06.11.2026: "paraşüte bağlı kalma ekstra kendinde bişeyler kat") ----------
     Paraşüt'ün ekranında olmayanlar, aynı hareketlerden hesaplanır: durum, son 12 ay alım/tahsilat, ortalama ödeme süresi ve açık borcun yaşı
     (borç ilk giren ilk kapanır sırasıyla eşlenir; çekle/senetle ödemede vade günü sayılır), aylık grafik, alım düzeni, elimizdeki çek/senet ve toplam risk. */
  const gunFark = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
  const r2 = n => Math.round(n * 100) / 100;
  const tahsilatMi = x => x.tur === 'contact_credit' || x.tur === 'check_in';
  const satisMi = x => x.tur === 'sales_invoice' && x.yon > 0;
  const YAS = [[30, '0–30 gün'], [60, '31–60 gün'], [90, '61–90 gün'], [Infinity, '90 günden eski']];
  // tek renk tonu, açıktan koyuya: borç eskidikçe koyulaşır (yanında tutar yazar, renk tek başına anlam taşımaz)
  const YAS_RENK = ['#f1c48e', '#e08b3e', '#bb5a1f', '#842f10'];
  function analiz(v) {
    const l = v.satirlar, bg = bugun(), yb = yilBas();
    const en = l.at(-1), acilis = en ? r2(en.b - en.tutar) : 0;
    // açık borç kalemleri (eskiden yeniye) ve fazla ödeme
    const kuyruk = []; let kredi = 0, agir = 0, agirV = 0, odenen = 0;
    if (acilis > 0.005) kuyruk.push({ t: '', k: acilis }); else if (acilis < -0.005) kredi = -acilis;
    for (let i = l.length - 1; i >= 0; i--) {
      const x = l[i];
      if (x.tutar > 0.005) { const m = Math.min(kredi, x.tutar); kredi -= m; if (x.tutar - m > 0.005) kuyruk.push({ t: x.t, k: x.tutar - m }); }
      else if (x.tutar < -0.005) {
        let p = -x.tutar;
        const ot = x.cek?.vade && x.cek.vade > x.t ? x.cek.vade : x.t;
        while (p > 0.005 && kuyruk.length) {
          const q = kuyruk[0], m = Math.min(q.k, p);
          // ortalama ödeme süresi: son 1 yılın tahsilatları, tarihi bilinen borç kalemleriyle; ödeme ya da evrakın alındığı gün,
          // ayrıca çek/senet vadesiyle (paranın gerçekten geldiği gün)
          if (q.t && tahsilatMi(x) && x.t >= yb) { agir += m * Math.max(0, gunFark(q.t, x.t)); agirV += m * Math.max(0, gunFark(q.t, ot)); odenen += m; }
          q.k -= m; p -= m;
          if (q.k <= 0.005) kuyruk.shift();
        }
        if (p > 0.005) kredi += p;
      }
    }
    const yas = YAS.map(([, ad]) => ({ ad, t: 0 }));
    for (const q of kuyruk) { const g = q.t ? gunFark(q.t, bg) : Infinity; yas[YAS.findIndex(([s]) => g <= s)].t += q.k; }
    const enEski = kuyruk.find(q => q.k > 0.005);
    const yil = l.filter(x => x.t >= yb), satislar = yil.filter(satisMi);
    const gunler = [...new Set(satislar.map(x => x.t))].sort();
    const sonSatis = l.find(satisMi)?.t || '';
    return {
      acik: r2(kuyruk.reduce((a, q) => a + q.k, 0)), kredi: r2(kredi), yas,
      enEski: enEski ? { t: enEski.t, gun: enEski.t ? gunFark(enEski.t, bg) : null } : null,
      ort: odenen > 0.5 ? Math.round(agir / odenen) : null, ortV: odenen > 0.5 ? Math.round(agirV / odenen) : null,
      alim: r2(satislar.reduce((a, x) => a + x.tutar, 0)), alimN: satislar.length,
      odeme: r2(yil.filter(tahsilatMi).reduce((a, x) => a - x.tutar, 0)),
      siklik: gunler.length > 1 ? Math.round(gunFark(gunler[0], gunler.at(-1)) / (gunler.length - 1)) : null,
      sonSatis, sonGun: sonSatis ? gunFark(sonSatis, bg) : null
    };
  }
  const durum = a => {
    if (a.acik <= 0.5) return a.kredi > 0.5 ? ['ok', '✓', 'Fazla ödemesi var', `${tl2(a.kredi)} alacaklı`] : ['ok', '✓', 'Borcu yok', 'Hesap kapalı'];
    const ort = a.ort !== null ? `ortalama ${a.ort} günde ödüyor${a.ortV - a.ort >= 5 ? ` (çek/senet vadesiyle ${a.ortV} gün)` : ''}` : '';
    if (a.yas[3].t > 0.5) return ['bad', '!', 'Riskli', [`${tl(a.yas[3].t)} borç 90 günü geçti`, ort].filter(Boolean).join(', ')];
    if (a.yas[2].t > 0.5 || (a.ort ?? 0) > 60) return ['warn', '!', 'Ödemesi yavaş', [a.yas[2].t > 0.5 ? `${tl(a.yas[2].t)} borç 60 günü geçti` : '', ort].filter(Boolean).join(', ')];
    return ['ok', '✓', 'Düzenli ödüyor', ort || 'Borcunun hepsi son 60 günde'];
  };

  // son 12 ay: aylık satış ve tahsilat (tek eksen, aynı birim)
  function aylar(v) {
    const [y, m] = bugun().split('-').map(Number), l = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      l.push({ k: d.toISOString().slice(0, 7), ad: d.toLocaleDateString('tr-TR', { month: 'short', timeZone: 'UTC' }), uzun: d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' }), s: 0, o: 0 });
    }
    const ay = Object.fromEntries(l.map(a => [a.k, a]));
    for (const x of v.satirlar) { const a = ay[String(x.t).slice(0, 7)]; if (!a) continue; if (satisMi(x)) a.s += x.tutar; else if (tahsilatMi(x)) a.o -= x.tutar; }
    return l;
  }
  const tavan = n => { if (n <= 0) return 1; const p = 10 ** Math.floor(Math.log10(n)), f = n / p; return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(k => f <= k + 1e-9)) * p; };
  const kisa = n => n >= 1e6 ? (n / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + ' Mn' : n >= 1e3 ? (n / 1e3).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' B' : String(Math.round(n));
  function grafikHtml(v) {
    const l = aylar(v), max = Math.max(...l.map(a => Math.max(a.s, a.o)));
    if (max <= 0) return '<p class="sub">Son 12 ayda satış ya da tahsilat yok.</p>';
    const top = tavan(max), h = n => n > 0 ? Math.max(1.5, n / top * 100).toFixed(1) : 0;
    const sec = l.find(a => a.k === H.ay) || l.at(-1);
    return `<div class="mo-gr-w">
      <div class="mo-lej" aria-hidden="true"><span><i class="s"></i>Satış</span><span><i class="o"></i>Tahsilat</span></div>
      <div class="mo-gr"><div class="mo-y" aria-hidden="true"><span style="bottom:100%">${kisa(top)}</span><span style="bottom:50%">${kisa(top / 2)}</span><span style="bottom:0">0</span></div>
        <div class="mo-cols">${l.map(a => `<button class="mo-ay${a === sec ? ' on' : ''}" data-act="mhAy" data-k="${a.k}" aria-pressed="${a === sec}" aria-label="${esc(a.uzun)}: satış ${tl(a.s)}, tahsilat ${tl(a.o)}" title="${esc(a.uzun)}&#10;Satış ${tl(a.s)}&#10;Tahsilat ${tl(a.o)}"><span class="mo-cub"><i class="s" style="height:${h(a.s)}%"></i><i class="o" style="height:${h(a.o)}%"></i></span><small>${esc(a.ad)}</small></button>`).join('')}</div></div>
      <p class="mo-oku"><b>${esc(sec.uzun)}</b><span><i class="s"></i>Satış <b class="num">${tl(sec.s)}</b></span><span><i class="o"></i>Tahsilat <b class="num">${tl(sec.o)}</b></span></p>
    </div>`;
  }
  const yasHtml = a => a.acik <= 0.5 ? '' : `<div class="mo-yas">
      <div class="mo-yas-bar" aria-hidden="true">${a.yas.map((y, i) => y.t > 0.5 ? `<i style="flex:${y.t.toFixed(2)};background:${YAS_RENK[i]}" title="${y.ad}: ${tl(y.t)}"></i>` : '').join('')}</div>
      <ul class="mo-yas-l">${a.yas.map((y, i) => `<li class="${y.t > 0.5 ? '' : 'bos'}"><i style="background:${YAS_RENK[i]}"></i><span>${y.ad}</span><b class="num">${y.t > 0.5 ? tl(y.t) : '—'}</b></li>`).join('')}</ul>
    </div>`;
  // müşterinin elimizdeki (tahsil edilmemiş ya da ciro edilip süresi dolmamış) çek ve senetleri: Çek ve senet sayfasının verisinden
  function evrakHtml(pid, v, a) {
    const ev = CLK.senetPanel?.musteri?.(pid, v.ad);
    if (ev === undefined) return '';
    if (ev === null) return '<li><span class="mo-ik">▭</span><span>Çek ve senetleri okunuyor…</span></li>';
    if (!ev.length) return '<li><span class="mo-ik">▭</span><span>Elimizde vadesi gelmemiş çeki ya da senedi yok.</span></li>';
    const tut = c => c.yon === 'ciro' ? c.tutar : c.kalan;
    const top = ev.reduce((s, c) => s + tut(c), 0), ciro = ev.filter(c => c.yon === 'ciro').length, snt = ev.filter(c => CLK.evrak?.senetMi(c)).length;
    const yakin = ev.map(c => c.vade).filter(Boolean).sort()[0];
    return `<li><span class="mo-ik">▭</span><span>Elimizde <b>${ev.length} evrak</b> (${snt ? `${snt} senet` : ''}${snt && ev.length - snt ? ', ' : ''}${ev.length - snt ? `${ev.length - snt} çek` : ''}): <b class="num">${tl(top)}</b>${yakin ? `, en yakın vade ${dt(yakin)}` : ''}${ciro ? `. ${ciro} tanesi tedarikçiye ciro edildi, müşteri ödeyene kadar risk` : ''}.</span></li>
      <li class="mo-risk"><span class="mo-ik">Σ</span><span>Toplam risk (açık borç + elimizdeki evrak): <b class="num">${tl(Math.max(0, a.acik) + top)}</b></span></li>`;
  }

  function ozetHtml(u, favHtml = '') {
    if (!gorur()) return favHtml;
    const { bos, pid, v } = veri(u);
    if (bos) return bos + favHtml;
    const a = analiz(v), [dk, dIk, dAd, dNeden] = durum(a);
    const tamam = !eksik(v, yilBas());
    const alim = a.sonSatis ? (a.siklik && a.alimN > 1
      ? `Son 1 yılda <b>${a.alimN} satış</b>, ortalama <b>${a.siklik} günde bir</b> alıyor. Son alım ${a.sonGun === 0 ? 'bugün' : `${a.sonGun} gün önce`}.${a.sonGun > Math.max(2 * a.siklik, 30) ? ' <b class="mo-uyari">Normalden uzun süredir almıyor, aramak iyi olabilir.</b>' : ''}`
      : `Son alım ${dt(a.sonSatis)} (${a.sonGun === 0 ? 'bugün' : `${a.sonGun} gün önce`}).`) : 'Paraşüt\'te satışı yok.';
    return `<div class="mo-durum ${dk}"><span class="mo-d-ik" aria-hidden="true">${dIk}</span><div><b>${dAd}</b><small>${esc(dNeden)}</small></div></div>
      <div class="mo-k">
        <div><span>Son 12 ay alım</span><b class="num">${tl(a.alim)}</b><small>${a.alimN} satış</small></div>
        <div><span>Son 12 ay ödeme</span><b class="num">${tl(a.odeme)}</b><small>tahsilat, çek ve senet</small></div>
        <div><span>Ortalama ödeme</span><b class="num">${a.ort !== null ? a.ort + ' gün' : '—'}</b><small>${a.ortV !== null && a.ortV - a.ort >= 5 ? `vadesiyle ${a.ortV} gün` : 'satıştan ödemeye'}</small></div>
        <div><span>En eski borç</span><b class="num">${a.acik <= 0.5 ? 'Yok' : a.enEski?.gun !== null && a.enEski?.gun !== undefined ? a.enEski.gun + ' gün' : v.sonraki ? '1 yıldan eski' : 'Devir'}</b><small>${a.acik > 0.5 && a.enEski?.t ? dt(a.enEski.t) + ' satışı' : a.acik > 0.5 ? 'açık borç ' + tl(a.acik) : 'açık borç yok'}</small></div>
      </div>
      ${tamam ? '' : '<p class="hint mo-yuk">1 yıllık hareketler okunuyor, rakamlar tamamlanıyor…</p>'}
      ${a.acik > 0.5 ? `<h3 class="mk-h3">Ödenmemiş borç ne kadar eski? <small>toplam ${tl(a.acik)}</small></h3>${yasHtml(a)}<p class="hint mo-yas-not">Ödemeler en eski satıştan başlayarak düşülür; kalan borç hangi satışlardan kaldıysa o satışların tarihine göre ayrılır.</p>` : ''}
      <h3 class="mk-h3">Aylık satış ve tahsilat <small>son 12 ay, aya dokunun</small></h3>${grafikHtml(v)}
      <ul class="mo-not"><li><span class="mo-ik">↻</span><span>${alim}</span></li>${evrakHtml(pid, v, a)}</ul>
      ${favHtml}
      <h3 class="mk-h3">Son hareketler</h3>
      <ul class="mh-l"><li class="mh-th"><span></span><span>İşlem</span><span>Açıklama</span><span>Tarih</span><span class="r">Tutar</span><span class="r">Bakiye</span></li>${v.satirlar.slice(0, 5).map(satirHtml).join('')}</ul>
      <div class="mh-alt"><small>Ortalama ödeme ve borç yaşı, borcun ilk giren ilk kapanır sırasıyla ödendiği varsayılarak hesaplanır. Ortalama ödemede çek ve senedin alındığı gün sayılır; "vadesiyle" paranın geldiği gündür.</small><span><button class="btn sm" data-act="mTab" data-k="hareket">Bütün hareketler</button></span></div>`;
  }

  /* ---------- WhatsApp ile borç hatırlatma: mesaj hazırlanır, değiştirilebilir, WhatsApp'ta gönderen kişi basar ---------- */
  const telNo = t => { let d = String(t || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.length === 11 && d[0] === '0') d = '9' + d; else if (d.length === 10 && d[0] === '5') d = '90' + d; return /^90\d{10}$/.test(d) ? d : ''; };
  function waAc(el) {
    const uid = String(el.dataset.u), pid = H.pid[uid], v = pid ? H.v[pid] : null, a = v?.zaman ? analiz(v) : null;
    // Paraşüt bakiyesi (okunduysa ve borç gösteriyorsa), değilse sitedeki bakiye (eksi = borç)
    const pb = v?.zaman ? (v.bakiye ?? v.satirlar[0]?.b ?? 0) : 0, borc = pb > 0.5 ? pb : -(Number(el.dataset.bal) || 0);
    const satir = [`Merhaba ${el.dataset.ad},`, `${dt(bugun())} itibarıyla CLK Çanta'ya ${tl2(Math.max(0, borc))} borç bakiyeniz bulunuyor.`];
    if (a?.enEski?.t && a.enEski.gun > 0) satir.push(`En eski ödenmemiş satış ${dt(a.enEski.t)} tarihli (${a.enEski.gun} gün).`);
    satir.push('Hesap özetinizi isterseniz hemen gönderelim.', '', 'İyi çalışmalar,', 'CLK Çanta · 0534 077 88 67');
    H.wa = { tel: el.dataset.tel || '', metin: satir.join('\n') };
    ciz();
  }
  const waHtml = () => !H.wa ? '' : `<div class="mh-modal" data-act="mhWaKapat" role="dialog" aria-label="Borç hatırlatma"><div class="mh-modal-in mo-wa">
      <div class="mh-modal-h"><div><b>Borç hatırlatma</b><small>WhatsApp'ta açılır; göndermeden önce değiştirebilirsiniz.</small></div><button class="btn sm ghost" data-act="mhWaKapat">Kapat</button></div>
      <div class="mo-wa-f"><label class="f"><span>Telefon</span><input id="mhWaTel" type="tel" inputmode="tel" autocomplete="off" placeholder="05xx xxx xx xx" value="${esc(H.wa.tel)}"></label>
        <label class="f"><span>Mesaj</span><textarea id="mhWaMetin" rows="8">${esc(H.wa.metin)}</textarea></label>
        <small class="hint">Telefon boşsa WhatsApp'ta kişiyi siz seçersiniz. Hesap özeti resmi için Ekstre gönder.</small></div>
      <div class="mh-modal-d"><button class="btn ek-wa" data-act="mhWaGonder">WhatsApp'ta aç</button><button class="btn" data-act="mhWaKopya">Mesajı kopyala</button></div>
    </div></div>`;
  document.addEventListener('input', e => {
    if (!H.wa) return;
    if (e.target.id === 'mhWaMetin') H.wa.metin = e.target.value;
    else if (e.target.id === 'mhWaTel') H.wa.tel = e.target.value;
  });

  CLK.mHesap = {
    html, ozetHtml, ekstreHtml: () => ekstreHtml() + waHtml(), gorur,
    pid: uid => H.pid[String(uid)],
    // aside'daki bakiye kutusu için Paraşüt bakiyesi (yüklendiyse)
    bakiye: uid => { const p = H.pid[String(uid)]; const v = p ? H.v[p] : null; return v?.zaman ? (v.bakiye ?? v.satirlar[0]?.b ?? 0) : null; },
    hazir: uid => { const p = H.pid[String(uid)]; return !!(p && H.v[p]?.zaman && !H.v[p].yuk); }
  };

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'mhDonem') { H.donem = el.dataset.k; ciz(); for (const [pid, v] of Object.entries(H.v)) if (dahaGerek(v) && pid === H.pid[String(S.arg)]) yukle(pid, v.sonraki); }
    else if (act === 'mhTur') { H.tur = el.dataset.k; ciz(); }
    else if (act === 'mhDaha') { const i = DONEM.findIndex(([k]) => k === H.donem); H.donem = DONEM[Math.min(i + 1, DONEM.length - 1)][0]; const pid = H.pid[String(S.arg)], v = H.v[pid]; ciz(); if (dahaGerek(v)) yukle(pid, v.sonraki); }
    else if (act === 'mhYenile') { const pid = el.dataset.pid; if (H.v[pid]) { H.v[pid].hata = ''; H.v[pid].sonraki = 1; } yukle(pid); }
    else if (act === 'mhFatura') faturaAc(el.dataset.fid);
    else if (act === 'mhYazdir') belge(el.dataset.fid, false);
    else if (act === 'mhPdf') belge(el.dataset.fid, true);
    else if (act === 'mhWaPdf') waPdf(el.dataset.fid);
    else if (act === 'mhSatisListe') CLK.satisListesiAc?.(el.dataset.pid);
    else if (act === 'mhEkstre') { const pid = H.pid[String(el.dataset.u)]; if (pid) ekstreHazirla(pid); }
    else if (act === 'mhEkKapat') { if (el.classList.contains('mh-modal') && e.target !== el) return; ekstreKapat(); }
    else if (act === 'mhEkPaylas') { if (H.ek) CLK.belge?.paylas(H.ek.blob, H.ek.url, H.ek.dosya, 'Hesap özeti'); }
    else if (act === 'mhEkIndir') { if (H.ek) { CLK.belge?.indir(H.ek.url, H.ek.dosya); toast('Resim indirildi'); } }
    else if (act === 'mhEkYazdir') { if (H.ek) CLK.belge?.yazdir(H.ek.url, 'Hesap özeti – ' + (H.v[H.pid[String(S.arg)]]?.ad || '')); }
    else if (act === 'mhAy') { H.ay = el.dataset.k; ciz(); }
    else if (act === 'mhWa') waAc(el);
    else if (act === 'mhWaKapat') { if (el.classList.contains('mh-modal') && e.target !== el) return; H.wa = null; ciz(); }
    else if (act === 'mhWaGonder') {
      if (!H.wa) return;
      const tel = telNo(H.wa.tel);
      if (!tel) toast('Telefon yok ya da eksik: WhatsApp\'ta kişiyi seçin');
      window.open(`https://wa.me/${tel}?text=${encodeURIComponent(H.wa.metin)}`, '_blank', 'noopener');
    }
    else if (act === 'mhWaKopya') { if (H.wa) navigator.clipboard?.writeText(H.wa.metin).then(() => toast('Mesaj kopyalandı'), () => toast('Kopyalanamadı')); }
    else prevAct?.(act, el, e);
  };
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || S.route !== 'musteri') return;
    if (H.wa) { H.wa = null; ciz(); } else if (H.ek) ekstreKapat();
  });
})();
