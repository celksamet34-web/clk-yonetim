/* CLK Yönetim — Çek ve senet (celik isteği 31.10.2026: "paraşütte çekler senetler var, onlarla ilgili bir çalışma yap").
   Paraşüt'teki bütün çek ve senetler yalnız okunur (sunucu: gider-cek, 10 dakika saklanır); giriş ve ödeme Paraşüt'ten yapılır.
   Verilen: firmanın kendi çek/senedi (ödenecek). Portföy: müşteriden alınıp elde duran. Ciro: müşteriden alınıp tedarikçiye verilen;
   Paraşüt'te kapanmış görünür ama vadesi gelene kadar müşteri ödemezse tedarikçi firmaya döner. */
(() => {
  const { sb, S, $, esc, tl, num, dt, dtt, toast, head, views, render, araKutu, araSec, ARA } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/gider-cek';
  const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const AYLAR_UZUN = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const BANKA = { GARANTI: 'Garanti BBVA', GARANTIV2: 'Garanti BBVA', ZIRAATBANKASI: 'Ziraat Bankası', HALKBANK: 'Halkbank', VAKIFBANK: 'VakıfBank', TURKIYEFINANS: 'Türkiye Finans',
    FINANSBANK: 'QNB', YAPIKREDI: 'Yapı Kredi', DENIZBANK: 'Denizbank', AKBANK: 'Akbank', TEB: 'TEB', ALBARAKA: 'Albaraka Türk', ISBANKASI: 'İş Bankası', KUVEYTTURK: 'Kuveyt Türk',
    ING: 'ING', SEKERBANK: 'Şekerbank', ODEABANK: 'Odeabank', HSBC: 'HSBC', VAKIFKATILIM: 'Vakıf Katılım', ZIRAATKATILIM: 'Ziraat Katılım', EMLAKKATILIM: 'Emlak Katılım',
    FIBABANKA: 'Fibabanka', ANADOLUBANK: 'Anadolubank', ALTERNATIFBANK: 'Alternatif Bank', BURGAN: 'Burgan Bank' };
  const D = (S.ui.cs ||= { v: null, yuk: false, hata: '', sekme: 'odenecek', ara: '', ay: '', goster: 60, rm: '', rGecmis: false, rResim: '', rDurum: '', rHazir: false });
  let rBlob = null;
  const bugun = () => new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);
  const gunFark = v => Math.round((Date.parse(v) - Date.parse(bugun())) / 864e5);
  const ayKaydir = (a, n) => new Date(Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 7);
  const ayKisa = a => AYLAR[+a.slice(5, 7) - 1] + (a.slice(0, 4) !== bugun().slice(0, 4) ? " '" + a.slice(2, 4) : '');
  const ayUzun = a => AYLAR_UZUN[+a.slice(5, 7) - 1] + ' ' + a.slice(0, 4);
  const buyukHarf = s => String(s || '').toLocaleUpperCase('tr');
  const baslik = s => String(s || '').toLocaleLowerCase('tr').replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('tr'));
  const kisa = n => new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

  // Paraşüt'te senet için banka yerine "Diğer" seçilip banka adına "senet" yazılıyor
  const senetMi = c => /sen+e?t|seet/i.test(c.bankaAd) || /senet/i.test(c.seri) || (c.banka === 'OTHER' && !c.bankaAd);
  const tur = c => (senetMi(c) ? 'Senet' : 'Çek');
  const banka = c => senetMi(c) ? '' : c.banka && c.banka !== 'OTHER' ? BANKA[c.banka] || baslik(c.banka) : baslik(c.bankaAd);
  const acik = c => (c.yon === 'verilen' || c.yon === 'alinan') ? c.kalan > 0.009 : c.yon === 'ciro' && c.vade >= bugun();
  const SEKME = {
    odenecek: ['Ödenecek', c => c.yon === 'verilen' && c.kalan > 0.009],
    portfoy: ['Portföyde', c => c.yon === 'alinan' && c.kalan > 0.009],
    ciro: ['Ciro edilen', c => c.yon === 'ciro' && c.vade >= bugun()],
    kapanan: ['Kapananlar', c => !acik(c)],
    hepsi: ['Tümü', () => true]
  };
  const ACIKLAMA = {
    odenecek: 'Firmanın verdiği, henüz ödenmemiş çek ve senetler. Vadesi gelen ödenince Paraşüt\'te "ödendi" olarak işlenmeli.',
    portfoy: 'Müşteriden alınıp elde duran, tahsil edilmemiş evraklar.',
    ciro: 'Müşteriden alınıp tedarikçiye verilen, vadesi gelmemiş evraklar. Paraşüt\'te kapanmış görünür ama müşteri ödemezse tedarikçi firmaya döner.',
    kapanan: 'Ödenmiş, tahsil edilmiş ya da vadesi geçmiş ciro edilmiş evraklar.',
    hepsi: 'Paraşüt\'teki bütün çek ve senetler.'
  };

  async function sor(govde) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.hata) throw new Error(j?.hata || 'Sunucu ' + r.status);
    return j;
  }
  async function yukle(yenile) {
    if (D.yuk) return;
    D.yuk = true; D.hata = ''; S.keepScroll = true; render();
    try { D.v = await sor({ islem: 'cekler', yenile: !!yenile }); } catch (e) { D.hata = e.message; }
    D.yuk = false; S.keepScroll = true; render();
  }

  const toplam = l => l.reduce((s, c) => s + (c.yon === 'ciro' ? c.tutar : c.kalan || c.tutar), 0);
  const tutar = c => (acik(c) && c.yon !== 'ciro' ? c.kalan : c.tutar);
  const vadeNot = c => {
    if (!acik(c)) return c.yon === 'verilen' ? '<span class="pill ok">Ödendi</span>' : c.yon === 'alinan' ? '<span class="pill ok">Tahsil edildi</span>' : '<span class="pill off">Ciro, vadesi geçti</span>';
    const n = gunFark(c.vade);
    return n < 0 ? `<span class="pill bad">${-n} gün geçti</span>` : n === 0 ? '<span class="pill bad">Bugün</span>' : n <= 7 ? `<span class="pill warn">${n} gün kaldı</span>` : n <= 31 ? `<span class="pill gold">${n} gün</span>` : `<span class="pill off">${n} gün</span>`;
  };
  const kimHtml = c => {
    const tel = t => t ? ` <a class="cs-tel" href="tel:${esc(t.replace(/[^\d+]/g, ''))}" title="Ara">☎</a>` : '';
    if (c.yon === 'verilen') return `<span class="cs-yon">Verilen</span> ${esc(c.kime || 'Kişi yok')}${tel(c.kimeTel)}`;
    if (c.yon === 'alinan') return `<span class="cs-yon al">Alınan</span> ${esc(c.kimden || 'Kişi yok')}${tel(c.kimdenTel)}`;
    if (c.yon === 'ciro') return `${esc(c.kimden || '?')}${tel(c.kimdenTel)} <span class="cs-ok">→</span> ${esc(c.kime || '?')}`;
    return esc([c.kimden, c.kime].filter(Boolean).join(' → '));
  };

  function satir(c) {
    const n = acik(c) ? gunFark(c.vade) : 99;
    const b = banka(c), alt = [tur(c), b, c.seri ? 'No ' + c.seri : '', c.aciklama, (c.yon === 'verilen' ? 'veriliş ' : 'alış ') + dt(c.tarih)].filter(Boolean);
    return `<li class="cs-r ${n < 0 ? 'gecti' : n <= 7 ? 'yakin' : ''} ${acik(c) ? '' : 'kapali'}">
      <div class="cs-vade"><b>${c.vade.slice(8, 10)}</b><small>${AYLAR[+c.vade.slice(5, 7) - 1]} ${c.vade.slice(2, 4)}</small></div>
      <div class="cs-orta"><b>${kimHtml(c)}</b><small>${alt.map(esc).join(' · ')}</small></div>
      <div class="cs-sag"><b>${tl(tutar(c))}</b>${vadeNot(c)}</div></li>`;
  }

  // önümüzdeki 12 ayın vadeleri: ödenecek, tahsil edilecek ve ciro (müşterinin ödeyeceği)
  function takvim(l) {
    const bas = bugun().slice(0, 7), aylar = Array.from({ length: 12 }, (_, i) => ayKaydir(bas, i));
    const say = a => {
      const x = l.filter(c => acik(c) && c.vade.startsWith(a));
      return { a, od: toplam(x.filter(c => c.yon === 'verilen')), al: toplam(x.filter(c => c.yon === 'alinan')), ci: toplam(x.filter(c => c.yon === 'ciro')), n: x.length };
    };
    const s = aylar.map(say), en = Math.max(1, ...s.map(x => Math.max(x.od, x.al, x.ci)));
    const h = v => (v ? Math.max(4, Math.round(v / en * 100)) : 0);
    return `<div class="card cs-tk">
      <div class="cs-tk-h"><div><h3>Vade takvimi</h3><p class="sub">Önümüzdeki 12 ay. Bir aya dokunun, o ayın evrakları listelensin.</p></div>
        <div class="cs-lej"><span><i class="od"></i>Ödenecek</span><span><i class="al"></i>Tahsil edilecek</span><span><i class="ci"></i>Ciro (müşteri ödeyecek)</span></div></div>
      <div class="cs-tk-k"><div class="cs-tk-g">${s.map(x => `<button class="cs-ay" data-act="csAy" data-a="${x.a}" aria-pressed="${D.ay === x.a}" title="${ayUzun(x.a)}: ödenecek ${tl(x.od)}, tahsil ${tl(x.al)}, ciro ${tl(x.ci)}">
        <span class="cs-ay-t">${x.od ? kisa(x.od) : x.n ? '' : '·'}</span>
        <span class="cs-ay-b"><i class="od" style="height:${h(x.od)}%"></i><i class="al" style="height:${h(x.al)}%"></i><i class="ci" style="height:${h(x.ci)}%"></i></span>
        <span class="cs-ay-a">${ayKisa(x.a)}</span><span class="cs-ay-n">${x.n ? num(x.n) + ' evrak' : ''}</span></button>`).join('')}</div></div>
    </div>`;
  }

  function grupKart(baslikM, alt, l, anahtar, sinif) {
    const g = {};
    for (const c of l) { const k = c[anahtar] || 'Kişi yok'; const x = g[k] ||= { t: 0, n: 0, ilk: c.vade }; x.t += tutar(c); x.n++; if (c.vade < x.ilk) x.ilk = c.vade; }
    const s = Object.entries(g).sort((a, b) => b[1].t - a[1].t), en = s[0]?.[1].t || 1;
    if (!s.length) return '';
    return `<div class="card cs-grup ${sinif}"><h3>${baslikM}</h3><p class="sub">${alt}</p>
      <div class="bars">${s.slice(0, 10).map(([ad, x]) => `<button class="bar cs-bar" data-act="csAra" data-q="${esc(ad)}"><span>${esc(ad)} <small>${num(x.n)} evrak · ilk vade ${dt(x.ilk)}</small></span><b>${tl(x.t)}</b><i><em style="width:${Math.max(3, x.t / en * 100)}%"></em></i></button>`).join('')}</div>
      ${s.length > 10 ? `<p class="hint">ve ${num(s.length - 10)} kişi daha</p>` : ''}</div>`;
  }

  /* ---------- müşteriye vade raporu (celik 01.11.2026: "müşteriye rapor vade alış tarihleri ile göndermeyi ekle") ----------
     Müşterinin verdiği çek ve senetler (portföyde ya da ciro edilmiş) alış ve vade tarihleriyle resim olarak hazırlanır, WhatsApp'tan paylaşılır.
     Evrakın kime ciro edildiği rapora yazılmaz. */
  const trE = d => d ? d.split('-').reverse().join('.') : '';
  const tlE = v => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' ₺';
  const musteriler = () => {
    const m = {};
    for (const c of D.v?.cekler || []) if ((c.yon === 'ciro' || c.yon === 'alinan') && c.kimden) { const x = m[c.kimden] ||= { ad: c.kimden, id: c.kimden, acik: 0 }; if (acik(c)) x.acik++; }
    return Object.values(m).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  };
  const musteriEvrak = (ad, gecmis) => (D.v?.cekler || []).filter(c => (c.yon === 'ciro' || c.yon === 'alinan') && c.kimden === ad && (gecmis || c.vade >= bugun()))
    .sort((a, b) => a.vade.localeCompare(b.vade) || a.tarih.localeCompare(b.tarih));
  const evrakAdi = c => [tur(c), banka(c), c.seri ? 'No ' + c.seri : ''].filter(Boolean).join(' · ');
  const durumYaz = c => {
    const n = gunFark(c.vade);
    if (c.yon === 'alinan' && c.kalan <= 0.009) return ['Ödendi', '#1a7f4b'];
    if (n > 0) return [n + ' gün kaldı', '#1d2433'];
    if (n === 0) return ['Vadesi bugün', '#b45309'];
    return c.yon === 'alinan' ? ['Vadesi geçti', '#b42318'] : ['Vadesi geldi', '#5b6475'];
  };

  function raporCiz(ad, l) {
    const W = 1080, P = 56, SAT = 50, F = "system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";
    const gelecek = l.filter(c => c.vade >= bugun()), top = gelecek.reduce((s, c) => s + c.tutar, 0);
    const H = 520 + (l.length + 1) * SAT + 130;
    const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2;
    const g = cv.getContext('2d'); g.scale(2, 2);
    const yaz = (t, x, y, { b = 400, z = 20, r = false, renk = '#1d2433' } = {}) => { g.font = `${b} ${z}px ${F}`; g.fillStyle = renk; g.textAlign = r ? 'right' : 'left'; g.fillText(t, x, y); };
    const kisalt = (t, z, en, b = 400) => { g.font = `${b} ${z}px ${F}`; while (t.length > 4 && g.measureText(t).width > en) t = t.slice(0, -2).trimEnd() + '…'; return t; };
    const kutu = (x, y, w, h, rd, renk, cizgi) => { g.beginPath(); g.roundRect(x, y, w, h, rd); if (renk) { g.fillStyle = renk; g.fill(); } if (cizgi) { g.strokeStyle = cizgi; g.lineWidth = 1.5; g.stroke(); } };
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    yaz('CLK ÇANTA', P, 86, { b: 800, z: 38 });
    yaz('Birlik Mah. 873 Sok. No:2/A Esenler / İstanbul', P, 118, { z: 18, renk: '#5b6475' });
    yaz('0534 077 88 67', P, 144, { z: 18, renk: '#5b6475' });
    yaz('ÇEK / SENET DÖKÜMÜ', W - P, 86, { b: 800, z: 28, r: true });
    yaz(trE(bugun()) + ' itibarıyla', W - P, 118, { z: 18, r: true, renk: '#5b6475' });
    g.fillStyle = '#1d2433'; g.fillRect(P, 168, W - 2 * P, 4);
    yaz('Sayın', P, 214, { z: 17, renk: '#5b6475' });
    yaz(kisalt(ad, 30, W - 2 * P, 800), P, 250, { b: 800, z: 30 });
    kutu(P, 278, W - 2 * P, 104, 14, '#1d2433');
    yaz('Vadesi gelmemiş', P + 30, 322, { z: 20, renk: '#fff' });
    yaz(`çek ve senetleriniz (${gelecek.length} adet)`, P + 30, 352, { z: 20, renk: '#fff' });
    yaz(tlE(top), W - P - 30, 348, { b: 800, z: 46, r: true, renk: '#fff' });
    const ilk = gelecek[0], son = gelecek[gelecek.length - 1], kw = (W - 2 * P - 12) / 2;
    [['En yakın vade', ilk ? `${trE(ilk.vade)} · ${tlE(ilk.tutar)}` : '—'], ['Son vade', son ? `${trE(son.vade)} · ${tlE(son.tutar)}` : '—']].forEach(([t, v], i) => {
      const x = P + i * (kw + 12);
      kutu(x, 402, kw, 84, 12, null, '#dde2ea');
      yaz(t, x + 18, 434, { z: 16, renk: '#5b6475' });
      yaz(v, x + 18, 468, { b: 700, z: 22 });
    });
    const kol = { a: P + 6, e: P + 150, v: 570, t: 860, d: W - P - 6 };
    let y = 536;
    [['ALIŞ TARİHİ', kol.a], ['EVRAK', kol.e], ['VADE', kol.v]].forEach(([t, x]) => yaz(t, x, y, { b: 700, z: 14, renk: '#5b6475' }));
    yaz('TUTAR', kol.t, y, { b: 700, z: 14, r: true, renk: '#5b6475' }); yaz('DURUM', kol.d, y, { b: 700, z: 14, r: true, renk: '#5b6475' });
    g.fillStyle = '#1d2433'; g.fillRect(P, y + 12, W - 2 * P, 3);
    y += 15;
    for (const [i, c] of l.entries()) {
      if (i % 2) { g.fillStyle = '#f7f8fa'; g.fillRect(P, y, W - 2 * P, SAT); }
      const yy = y + 32, gecti = c.vade < bugun();
      yaz(trE(c.tarih), kol.a, yy, { z: 18, renk: gecti ? '#5b6475' : '#1d2433' });
      yaz(kisalt(evrakAdi(c), 18, kol.v - kol.e - 24), kol.e, yy, { z: 18, renk: gecti ? '#5b6475' : '#1d2433' });
      yaz(trE(c.vade), kol.v, yy, { b: 700, z: 18, renk: gecti ? '#5b6475' : '#1d2433' });
      yaz(tlE(c.tutar), kol.t, yy, { b: 700, z: 18, r: true, renk: gecti ? '#5b6475' : '#1d2433' });
      const [d, renk] = durumYaz(c);
      yaz(d, kol.d, yy, { b: 700, z: 16, r: true, renk });
      y += SAT;
    }
    if (!l.length) { yaz('Gösterilecek evrak yok.', P + 6, y + 32, { z: 18, renk: '#5b6475' }); y += SAT; }
    g.fillStyle = '#dde2ea'; g.fillRect(P, y + 14, W - 2 * P, 1);
    yaz('Vade tarihlerinde ödemenizi rica ederiz. Kayıtlarınızla farklılık varsa lütfen bize bildirin.', P, y + 52, { z: 18, renk: '#5b6475' });
    yaz('Teşekkür ederiz.', P, y + 82, { z: 18, renk: '#5b6475' });
    return new Promise(res => cv.toBlob(res, 'image/png'));
  }
  const raporMetni = (ad, l) => {
    const gelecek = l.filter(c => c.vade >= bugun());
    return `Sayın ${ad},\nCLK Çanta'daki çek ve senetleriniz (${trE(bugun())} itibarıyla):\n\n` +
      l.map(c => `• ${evrakAdi(c)}: alış ${trE(c.tarih)}, vade ${trE(c.vade)}, ${tlE(c.tutar)} (${durumYaz(c)[0].toLocaleLowerCase('tr')})`).join('\n') +
      `\n\nVadesi gelmemiş toplam: ${tlE(gelecek.reduce((s, c) => s + c.tutar, 0))} (${gelecek.length} adet).\nVade tarihlerinde ödemenizi rica ederiz. Teşekkür ederiz.\nCLK Çanta · 0534 077 88 67`;
  };
  const waNo = t => { const d = String(t).replace(/\D/g, ''); return d.startsWith('90') ? d : d.startsWith('0') ? '9' + d : d.length === 10 ? '90' + d : d; };
  const raporDosya = () => `cek-senet-${D.rm.toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]+/gi, '-').replace(/^-|-$/g, '')}-${bugun()}.png`;
  const raporSifirla = () => { if (D.rResim) URL.revokeObjectURL(D.rResim); D.rResim = ''; rBlob = null; D.rDurum = ''; };
  async function raporHazirla() {
    if (!D.rm || !musteriler().some(m => m.ad === D.rm)) { D.rDurum = 'Listeden bir müşteri seçin.'; S.keepScroll = true; render(); return; }
    const l = musteriEvrak(D.rm, D.rGecmis);
    raporSifirla();
    if (!l.length) { D.rDurum = 'Bu müşterinin vadesi gelmemiş evrakı yok. Geçmiş evrakları da göstermek için kutuyu işaretleyin.'; S.keepScroll = true; render(); return; }
    rBlob = await raporCiz(D.rm, l);
    D.rResim = URL.createObjectURL(rBlob);
    D.rDurum = `${l.length} evrak rapora yazıldı.`;
    S.keepScroll = true; render();
  }
  function raporKart() {
    const ml = musteriler(), m = ml.find(x => x.ad === D.rm);
    const tel = m ? (D.v.cekler.find(c => c.kimden === D.rm && c.kimdenTel)?.kimdenTel || '') : '';
    return `<div class="card cs-rapor" id="csRapor">
      <h3>Müşteriye vade raporu</h3><p class="sub">Müşterinin verdiği çek ve senetler alış ve vade tarihleriyle resim olarak hazırlanır, WhatsApp'tan gönderilir. Evrakın kime ciro edildiği yazılmaz.</p>
      <div class="cs-r-form">
        <div class="f ara-alan"><span>Müşteri</span>${araKutu('csRm', ml, D.rm, 'csRm', { yer: `Müşteri adı yazın (${ml.length} müşteri)` })}</div>
        <label class="toggle"><input type="checkbox" id="csRGecmis" ${D.rGecmis ? 'checked' : ''}> Vadesi geçmiş evraklar da olsun</label>
      </div>
      <div class="ek-dug">
        <button class="btn dark" data-act="csRHazirla">Raporu hazırla</button>
        <button class="btn ek-wa" data-act="csRPaylas" ${D.rResim ? '' : 'disabled'}>WhatsApp'ta paylaş</button>
        <button class="btn" data-act="csRIndir" ${D.rResim ? '' : 'disabled'}>Resmi indir</button>
        <button class="btn" data-act="csRMetin" ${D.rResim ? '' : 'disabled'}>Yazı olarak kopyala</button>
        ${D.rResim && tel ? `<a class="btn" href="https://wa.me/${esc(waNo(tel))}" target="_blank" rel="noopener">WhatsApp'ta sohbeti aç</a>` : ''}
      </div>
      ${D.rDurum ? `<p class="ek-durum" role="status">${esc(D.rDurum)}</p>` : ''}
      ${D.rResim ? `<div class="ek-on"><img src="${D.rResim}" alt="Çek ve senet dökümü: ${esc(D.rm)}"></div>` : ''}
    </div>`;
  }
  async function raporPaylas() {
    if (!rBlob) return;
    const dosya = new File([rBlob], raporDosya(), { type: 'image/png' });
    try { if (navigator.canShare?.({ files: [dosya] })) { await navigator.share({ files: [dosya], title: 'Çek ve senet dökümü' }); return; } }
    catch (err) { if (err.name === 'AbortError') return; }
    raporIndir(); toast('Bu cihaz doğrudan paylaşmaya izin vermedi; resim indirildi');
  }
  function raporIndir() { const a = Object.assign(document.createElement('a'), { href: D.rResim, download: raporDosya() }); document.body.append(a); a.click(); a.remove(); }
  araSec.csRm = m => { if (m.ad !== D.rm) raporSifirla(); D.rm = m.ad; };

  views.cek = () => {
    if (!D.v && !D.yuk && !D.hata) yukle();
    const acts = `<button class="btn" data-act="csYenile" ${D.yuk ? 'disabled' : ''}>${D.yuk ? 'Paraşüt\'ten okunuyor…' : 'Yenile'}</button>`;
    const ust = head('Finans', 'Çek ve senet', `Paraşüt'teki çek ve senetler${D.v ? ' (' + dtt(D.v.zaman) + ' itibarıyla)' : ''}. Bu sayfa yalnız gösterir; çek ve senet girişi, ödemesi Paraşüt'ten yapılır.`, acts);
    if (!D.v) return ust + (D.hata ? `<div class="card empty"><h3>Liste alınamadı</h3><p>${esc(D.hata)}</p><button class="btn dark" data-act="csYenile">Tekrar dene</button></div>`
      : '<div class="card"><p class="hint" style="margin-bottom:12px">Paraşüt\'ten bütün çek ve senetler okunuyor, yarım dakika sürebilir…</p><div class="skel" style="height:120px"></div><div class="skel" style="height:260px;margin-top:14px"></div></div>');
    const l = D.v.cekler || [];
    const od = l.filter(SEKME.odenecek[1]), pf = l.filter(SEKME.portfoy[1]), ci = l.filter(SEKME.ciro[1]);
    const ay = bugun().slice(0, 7);
    const buAy = od.filter(c => c.vade.slice(0, 7) <= ay), otuz = od.filter(c => gunFark(c.vade) <= 30);
    const enYakin = [...od].sort((a, b) => a.vade.localeCompare(b.vade))[0];
    const bugunku = [...od, ...pf].filter(c => gunFark(c.vade) <= 0).sort((a, b) => a.vade.localeCompare(b.vade)), hafta = od.filter(c => gunFark(c.vade) > 0 && gunFark(c.vade) <= 7);
    const ciroHafta = ci.filter(c => gunFark(c.vade) <= 7);

    // liste: sekme + ay + arama
    const q = buyukHarf(D.ara.trim());
    const ayF = c => !D.ay || c.vade.startsWith(D.ay);
    const araF = c => !q || buyukHarf([c.kimden, c.kime, c.seri, banka(c), c.bankaAd, c.aciklama, tur(c), String(c.tutar)].join(' ')).includes(q);
    const say = k => l.filter(c => SEKME[k][1](c) && ayF(c) && araF(c)).length;
    const liste = l.filter(c => SEKME[D.sekme][1](c) && ayF(c) && araF(c))
      .sort((a, b) => (acik(a) && acik(b) ? a.vade.localeCompare(b.vade) : acik(a) !== acik(b) ? (acik(a) ? -1 : 1) : b.vade.localeCompare(a.vade)));

    return `${ust}
      <div class="kpis cs-kpis">
        <div class="kpi hero"><div class="k">Ödenecek çek ve senet</div><div class="v">${tl(toplam(od))}</div>
          <div class="s">${num(od.length)} evrak${enYakin ? ` · en yakın vade ${dt(enYakin.vade)}, ${tl(enYakin.kalan)} (${esc(enYakin.kime)})` : ''}</div></div>
        <div class="kpi ${buAy.length ? 'bad' : ''}"><div class="k">Bu ay ödenecek</div><div class="v">${tl(toplam(buAy))}</div><div class="s">${num(buAy.length)} evrak, gecikenler dahil · 30 gün içinde ${tl(toplam(otuz))}</div></div>
        <div class="kpi"><div class="k">Portföyde</div><div class="v">${tl(toplam(pf))}</div><div class="s">${num(pf.length)} müşteri evrakı elde</div></div>
        <div class="kpi"><div class="k">Ciro edilen</div><div class="v">${tl(toplam(ci))}</div><div class="s">${num(ci.length)} evrak, vadesi gelmedi</div></div>
      </div>
      ${bugunku.length || hafta.length || ciroHafta.length ? `<div class="cs-uyarilar">
        ${bugunku.length ? `<div class="cs-uy bad"><b>Vadesi bugün ya da geçmiş: ${num(bugunku.length)} evrak, ${tl(toplam(bugunku))}</b><span>${bugunku.map(c => `${esc(tur(c))} ${c.yon === 'alinan' ? esc(c.kimden) + ' (tahsil edilecek)' : esc(c.kime)} ${tl(c.kalan)}, vade ${dt(c.vade)}`).join(' · ')}</span><small>Ödendiyse ya da tahsil edildiyse Paraşüt'te işlenmeli; bu sayfa Paraşüt'teki durumu gösterir.</small></div>` : ''}
        ${hafta.length ? `<div class="cs-uy warn"><b>7 gün içinde ödenecek: ${num(hafta.length)} evrak, ${tl(toplam(hafta))}</b><span>${hafta.map(c => `${esc(c.kime)} ${tl(c.kalan)} (${dt(c.vade)})`).join(' · ')}</span></div>` : ''}
        ${ciroHafta.length ? `<div class="cs-uy gold"><b>7 gün içinde vadesi gelen müşteri evrakı: ${num(ciroHafta.length)}, ${tl(toplam(ciroHafta))}</b><span>${ciroHafta.slice(0, 8).map(c => `${esc(c.kimden)} ${tl(c.tutar)}`).join(' · ')}${ciroHafta.length > 8 ? ' …' : ''}</span><small>Ciro ettiğiniz evraklar; müşteriye hatırlatmak isteyebilirsiniz.</small></div>` : ''}
      </div>` : ''}
      ${takvim(l)}
      <div class="grid2 cs-gruplar">
        ${grupKart('Kime ödeyeceğiz', 'Verdiğimiz, ödenmemiş çek ve senetler kişi başına.', od, 'kime', 'cs-g-od')}
        ${grupKart('Ciro ettiğimiz müşteri evrakları', 'Vadesi gelmemiş; müşteri ödemezse tedarikçi bize döner.', ci, 'kimden', 'cs-g-ci')}
      </div>
      ${raporKart()}
      <div class="card cs-liste-k">
        <div class="cs-sekmeler" role="tablist">${Object.entries(SEKME).map(([k, [ad]]) => `<button class="chip" role="tab" data-act="csSekme" data-k="${k}" aria-pressed="${D.sekme === k}">${ad} <b>${num(say(k))}</b></button>`).join('')}</div>
        <div class="cs-arac"><input id="csAra" type="search" placeholder="Kişi, seri no, banka ya da tutar ara" value="${esc(D.ara)}" aria-label="Ara">
          ${D.ay ? `<button class="chip" data-act="csAy" data-a="${D.ay}" aria-pressed="true">${ayUzun(D.ay)} ×</button>` : ''}</div>
        <p class="hint cs-ac">${ACIKLAMA[D.sekme]}</p>
        ${liste.length ? `<div class="cs-top"><span>${num(liste.length)} evrak</span><b>${tl(toplam(liste))}</b></div><ul class="cs-l">${liste.slice(0, D.goster).map(satir).join('')}</ul>
          ${liste.length > D.goster ? `<div class="ek-dug"><button class="btn sm" data-act="csDaha">Daha fazla göster (${num(liste.length - D.goster)})</button></div>` : ''}`
          : '<p class="cs-bos">Bu seçimde evrak yok.</p>'}
      </div>`;
  };

  views.bind_cek = () => {
    $('#csRGecmis')?.addEventListener('change', e => { D.rGecmis = e.target.checked; if (D.rResim) raporHazirla(); });
    const a = $('#csAra');
    a?.addEventListener('input', () => { clearTimeout(a.t); a.t = setTimeout(() => { D.ara = a.value; D.goster = 60; S.keepScroll = true; render(); }, 200); });
  };

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    const ciz = () => { S.keepScroll = true; render(); };
    if (act === 'csYenile') { D.hata = ''; yukle(true); }
    else if (act === 'csSekme') { D.sekme = el.dataset.k; D.goster = 60; ciz(); }
    else if (act === 'csAy') {
      D.ay = D.ay === el.dataset.a ? '' : el.dataset.a; D.goster = 60;
      // ay seçilince o ayda evrak olan sekmeye geçilir
      if (D.ay && !(D.v?.cekler || []).some(c => SEKME[D.sekme][1](c) && c.vade.startsWith(D.ay))) {
        const k = ['odenecek', 'portfoy', 'ciro'].find(k => (D.v?.cekler || []).some(c => SEKME[k][1](c) && c.vade.startsWith(D.ay)));
        if (k) D.sekme = k;
      }
      ciz();
      if (D.ay) setTimeout(() => $('.cs-liste-k')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
    else if (act === 'csAra') { if (el.closest('.cs-g-ci') && D.rm !== el.dataset.q) { raporSifirla(); D.rm = el.dataset.q; delete ARA.csRm; } D.ara = el.dataset.q; D.ay = ''; D.goster = 60; D.sekme = el.closest('.cs-grup')?.classList.contains('cs-g-ci') ? 'ciro' : 'odenecek'; ciz(); setTimeout(() => $('.cs-liste-k')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }
    else if (act === 'csDaha') { D.goster += 100; ciz(); }
    else if (act === 'csRHazirla') raporHazirla();
    else if (act === 'csRPaylas') raporPaylas();
    else if (act === 'csRIndir') { if (D.rResim) { raporIndir(); toast('Resim indirildi'); } }
    else if (act === 'csRMetin') {
      const l = musteriEvrak(D.rm, D.rGecmis), t = raporMetni(D.rm, l);
      (navigator.clipboard?.writeText(t) || Promise.reject()).then(() => toast('Rapor yazısı kopyalandı; WhatsApp\'a yapıştırabilirsiniz')).catch(() => { window.prompt('Yazıyı kopyalayın:', t); });
    }
    else prevAct?.(act, el, e);
  };
})();
