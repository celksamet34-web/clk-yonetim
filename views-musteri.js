/* CLK Yönetim — müşteri sayfasındaki Paraşüt hesap hareketleri (celik 06.11.2026: "müşterilerden x müşteriye girince paraşütten eski satışları yaz.
   hatta tarayıcıdan gir paraşüt gibi düzenle. ödeme gir senet gir cari hesabını borcu gör. daha farklı kolay yap onu. ekstre ve satış sayfalarını orda toplayalım").
   Paraşüt'ün müşteri ekranındaki "işlem geçmişi" (siparis-parasut gecmis → contacts/<id>/transaction_history_items) yeniden eskiye, Paraşüt'ün
   yürüyen bakiyesiyle listelenir; satışa dokununca kalemleri açılır, Satış faturası sayfasındaki kontrol listesi olarak yazdırılır ya da PDF olur.
   Ekstre resmi (Müşteri ekstresi sayfasındakiyle aynı) seçili dönemden çizilir. Yalnız okur; Paraşüt'e yazan tek şey numarasız faturaya CLK-SF numarası. */
(() => {
  const { sb, S, $, esc, tl2, dt, toast, views, render } = CLK;
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

  // eldeki hareketler seçili dönemin başından eskiye ulaşmadıysa sonraki sayfalar istenir
  const dahaGerek = v => {
    if (!v || v.yuk || v.hata || !v.sonraki) return false;
    const bas = basTarih(H.donem);
    return !bas || (v.satirlar.at(-1)?.t || '9999') >= bas;
  };
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
      <div class="mh-det-d"><button class="btn sm dark" data-act="mhYazdir" data-fid="${esc(x.fid)}" ${H.belge ? 'disabled' : ''}>${H.belge === 'y' ? 'Hazırlanıyor…' : 'Yazdır'}</button><button class="btn sm" data-act="mhPdf" data-fid="${esc(x.fid)}" ${H.belge ? 'disabled' : ''}>${H.belge === 'p' ? 'PDF hazırlanıyor…' : 'PDF indir'}</button>${CLK.izin('urunlistesi') ? '<small>Birkaç satışı tek listede yazdırmak için Satış faturası sayfası.</small>' : ''}</div>
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

  // müşteri sayfasındaki "Hesap hareketleri" sekmesi
  function html(u) {
    if (!gorur()) return '';
    const uid = String(u.id), pid = H.pid[uid];
    if (pid === undefined) { if (!H.pidYuk[uid]) setTimeout(() => pidBul(uid), 0); return '<p class="hint">Paraşüt eşleşmesi aranıyor…</p><div class="skel" style="height:220px"></div>'; }
    if (!pid) return `<div class="mh-bos"><b>Bu üye Paraşüt'te bir müşteriyle eşleşmemiş.</b><p>Eşleşince satışları, ödemeleri ve bakiyesi burada görünür.${CLK.izin('eslestirme') ? ' <button class="link" data-go="eslestirme">Eşleştirme sayfası</button>' : ''}</p></div>`;
    const v = H.v[pid];
    if (!v) { setTimeout(() => yukle(pid), 0); return '<p class="hint">Paraşüt\'ten hareketler okunuyor…</p><div class="skel" style="height:260px"></div>'; }
    if (!v.zaman && v.hata) return `<div class="mh-bos"><p class="msg err">${esc(v.hata)}</p><button class="btn sm dark" data-act="mhYenile" data-pid="${esc(pid)}">Tekrar dene</button></div>`;
    if (!v.zaman) return '<p class="hint">Paraşüt\'ten hareketler okunuyor…</p><div class="skel" style="height:260px"></div>';
    const { l: hepsi, devir, bas } = donemSatirlari(v);
    const l = hepsi.filter(x => H.tur === 'hepsi' || (H.tur === 'satis' ? !!x.fid : odemeMi(x)));
    const satis = hepsi.filter(x => x.fid && x.yon > 0).reduce((a, x) => a + x.tutar, 0);
    const odeme = hepsi.filter(odemeMi).reduce((a, x) => a - x.tutar, 0);
    const saat = new Date(v.zaman).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const yukleniyor = v.yuk || dahaGerek(v);
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
        <span>${H.donem !== '0' && !yukleniyor && (v.sonraki || v.satirlar.some(x => bas && x.t < bas)) ? '<button class="btn sm" data-act="mhDaha">Daha eskisini göster</button>' : ''}<button class="btn sm ghost" data-act="mhYenile" data-pid="${esc(pid)}" ${v.yuk ? 'disabled' : ''}>Yenile</button></span>
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
    if (dahaGerek(v)) { toast('Hareketler okunuyor, birkaç saniye sonra tekrar basın'); return; }
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

  CLK.mHesap = {
    html, ekstreHtml, gorur,
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
    else if (act === 'mhEkstre') { const pid = H.pid[String(el.dataset.u)]; if (pid) ekstreHazirla(pid); }
    else if (act === 'mhEkKapat') { if (el.classList.contains('mh-modal') && e.target !== el) return; ekstreKapat(); }
    else if (act === 'mhEkPaylas') { if (H.ek) CLK.belge?.paylas(H.ek.blob, H.ek.url, H.ek.dosya, 'Hesap özeti'); }
    else if (act === 'mhEkIndir') { if (H.ek) { CLK.belge?.indir(H.ek.url, H.ek.dosya); toast('Resim indirildi'); } }
    else if (act === 'mhEkYazdir') { if (H.ek) CLK.belge?.yazdir(H.ek.url, 'Hesap özeti – ' + (H.v[H.pid[String(S.arg)]]?.ad || '')); }
    else prevAct?.(act, el, e);
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && H.ek && S.route === 'musteri') ekstreKapat(); });
})();
