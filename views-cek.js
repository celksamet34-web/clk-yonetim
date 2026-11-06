/* CLK Yönetim — Çek ve senet (celik isteği 31.10.2026: "paraşütte çekler senetler var, onlarla ilgili bir çalışma yap").
   Paraşüt'teki bütün çek ve senetler yalnız okunur (sunucu: gider-cek, 10 dakika saklanır); senet girişi Senet gir sayfasında (views-senet.js), çek girişi ve ödeme Paraşüt'ten.
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
  const D = (S.ui.cs ||= { v: null, yuk: false, hata: '', sekme: 'odenecek', ara: '', ay: '', goster: 60, rm: '', rGecmis: false, rResim: '', rDurum: '', rHazir: false, rTur: 'rapor', mTarih: '', rMakbuz: null });
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
  /* Senette ödeme ve protesto günü (celik 02.11.2026: "31 ekim vadesi olanı resmi 3. iş gününde ödemesi oluyor. bu şekilde bana olan evrakları uyar";
     gönderdiği tablo: Perşembe → Pazartesi, Cuma → Salı, Cumartesi/Pazar/Pazartesi → Çarşamba, Salı → Perşembe, Çarşamba → Cuma, bayram → ödeme gününü izleyen iki iş günü).
     Vade iş günü değilse (cumartesi, pazar, resmi tatil) ödeme günü sonraki ilk iş günüdür; protesto ödeme gününü izleyen iki iş günü içinde, son gün 15:00'a kadar çekilir.
     Müşteri o güne kadar ödeyebilir; panel müşteri senedini son gün geçince "ödenmedi" sayar. Çekte bu süre yok (ibrazda ödenir), son gün vadedir.
     Arefe ve 28 Ekim yarım gün: iş günü sayılır (son gün erken çıkar, güvenli taraf), son gün oraya denk gelirse "öğlene kadar" yazılır.
     Dini bayramlar Diyanet takviminden (2027: Ramazan 9–11 Mart, Kurban 16–19 Mayıs); 2028 ve sonrası açıklanınca eklenmeli (eksik bayram son günü erken gösterir, geç göstermez). */
  const SABIT_TATIL = ['01-01', '04-23', '05-01', '05-19', '07-15', '08-30', '10-29'];
  const BAYRAM = ['2026-03-20', '2026-03-21', '2026-03-22', '2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30', '2027-03-09', '2027-03-10', '2027-03-11', '2027-05-16', '2027-05-17', '2027-05-18', '2027-05-19'];
  const YARIM = ['2026-03-19', '2026-05-26', '2027-03-08', '2027-05-15'];
  const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'], GUNK = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const gunEkle = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const haftaGunu = d => new Date(d + 'T00:00:00Z').getUTCDay();
  const isGunu = d => { const g = haftaGunu(d); return g !== 0 && g !== 6 && !SABIT_TATIL.includes(d.slice(5)) && !BAYRAM.includes(d); };
  const yarimGun = d => YARIM.includes(d) || d.slice(5) === '10-28';
  const PG = {};
  function protestoGunu(vade) {
    if (PG[vade]) return PG[vade];
    let d = vade;
    for (let i = 0; i < 20 && !isGunu(d); i++) d = gunEkle(d, 1);
    for (let k = 0; k < 2; k++) { d = gunEkle(d, 1); for (let i = 0; i < 20 && !isGunu(d); i++) d = gunEkle(d, 1); }
    return (PG[vade] = d);
  }
  const sonGun = c => (c.vade && senetMi(c) ? protestoGunu(c.vade.slice(0, 10)) : c.vade);
  const kisaGun = d => `${GUNK[haftaGunu(d)]} ${d.slice(8, 10)}.${d.slice(5, 7)}`;
  const sonYaz = d => `${+d.slice(8, 10)} ${AYLAR_UZUN[+d.slice(5, 7) - 1]} ${GUNLER[haftaGunu(d)]} ${yarimGun(d) ? 'öğlene' : "15:00'a"} kadar`;
  // müşteri evrakı: gelecek (vadesi gelmedi), surede (vadesi geldi, son gün gelmedi), songun (bugün son gün), gecti (son gün geçti)
  const odemeDurum = c => { const v = gunFark(c.vade), s = gunFark(sonGun(c)); return v > 0 ? 'gelecek' : s > 0 ? 'surede' : s === 0 ? 'songun' : 'gecti'; };
  const acik = c => (c.yon === 'verilen' || c.yon === 'alinan') ? c.kalan > 0.009 : c.yon === 'ciro' && sonGun(c) >= bugun();
  // evrak listeleri alış (veriliş) tarihine göre sıralanır, vadeye göre değil (celik 02.11: "çek ve senetleri sıralarken alış tarihini baz al vadeyi değil")
  const alisSira = (a, b) => (a.tarih || '').localeCompare(b.tarih || '') || (a.vade || '').localeCompare(b.vade || '') || String(a.seri || '').localeCompare(String(b.seri || ''), 'tr');
  CLK.evrak = { senetMi, tur, banka, sonGun, kisaGun, sonYaz, odemeDurum, alisSira };
  // Senet gir sayfasında tedarikçiye çıkış bordrosu hazırlanmış ama Paraşüt'te henüz ciro edilmemiş evraklar: id → bordro
  let AYR = {};
  function ayrilanlar() {
    const m = {}, l = D.v?.cekler || [];
    for (const b of D.v?.bordrolar || []) for (const e of b.evraklar || []) { const c = l.find(x => x.id === e.id); if (c && c.yon === 'alinan' && c.kalan > 0.009) m[e.id] = b; }
    return m;
  }
  const SEKME = {
    odenecek: ['Ödenecek', c => c.yon === 'verilen' && c.kalan > 0.009],
    portfoy: ['Portföyde', c => c.yon === 'alinan' && c.kalan > 0.009],
    ciro: ['Ciro edilen', c => c.yon === 'ciro' && sonGun(c) >= bugun()],
    kapanan: ['Kapananlar', c => !acik(c)],
    hepsi: ['Tümü', () => true]
  };
  const ACIKLAMA = {
    odenecek: 'Firmanın verdiği, henüz ödenmemiş çek ve senetler. Vadesi gelen ödenince Paraşüt\'te "ödendi" olarak işlenmeli.',
    portfoy: 'Müşteriden alınıp elde duran, tahsil edilmemiş evraklar. Senette son gün: vade (tatilse sonraki iş günü) ve izleyen iki iş günü, 15:00\'a kadar.',
    ciro: 'Müşteriden alınıp tedarikçiye verilen, ödeme süresi dolmamış evraklar. Paraşüt\'te kapanmış görünür ama müşteri ödemezse tedarikçi firmaya döner.',
    kapanan: 'Ödenmiş, tahsil edilmiş ya da ödeme süresi geçmiş ciro edilmiş evraklar.',
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
    if (c.yon !== 'verilen' && senetMi(c) && n <= 0) {
      const d = odemeDurum(c);
      if (d === 'surede') return `<span class="pill warn">Son gün ${kisaGun(sonGun(c))}</span>`;
      if (d === 'songun') return '<span class="pill bad">Bugün son gün</span>';
    }
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
    const bd = c.yon === 'alinan' ? AYR[c.id] : null;
    const sd = acik(c) && c.yon !== 'verilen' && senetMi(c) && n <= 7 ? odemeDurum(c) : '';
    const b = banka(c), alt = [tur(c), b, c.seri ? 'No ' + c.seri : '', c.aciklama, (c.yon === 'verilen' ? 'veriliş ' : 'alış ') + dt(c.tarih), sd ? 'son gün ' + sonYaz(sonGun(c)) : '', bd ? `${bd.no} ile ${bd.kisi} firmasına verildi, Paraşüt'te ciro bekliyor` : ''].filter(Boolean);
    const cls = sd ? (sd === 'songun' || sd === 'gecti' ? 'gecti' : 'yakin') : n < 0 ? 'gecti' : n <= 7 ? 'yakin' : '';
    return `<li class="cs-r ${cls} ${acik(c) ? '' : 'kapali'}">
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
  const musteriEvrak = (ad, gecmis) => (D.v?.cekler || []).filter(c => (c.yon === 'ciro' || c.yon === 'alinan') && c.kimden === ad && (gecmis || sonGun(c) >= bugun()))
    .sort(alisSira);
  const evrakAdi = c => [tur(c), banka(c), c.seri ? 'No ' + c.seri : ''].filter(Boolean).join(' · ');
  const durumYaz = c => {
    const n = gunFark(c.vade);
    if (c.yon === 'alinan' && c.kalan <= 0.009) return ['Ödendi', '#1a7f4b'];
    if (n > 0) return [n + ' gün kaldı', '#1d2433'];
    if (senetMi(c)) { const d = odemeDurum(c); if (d === 'surede') return ['Son gün ' + kisaGun(sonGun(c)), '#b45309']; if (d === 'songun') return ['Bugün son gün', '#b45309']; }
    if (n === 0) return ['Vadesi bugün', '#b45309'];
    return c.yon === 'alinan' ? ['Vadesi geçti', '#b42318'] : ['Vadesi geldi', '#5b6475'];
  };

  /* ---------- tahsilat makbuzu (celik 01.11.2026: "heh tahsilat makbuzu", "bunu demeye çalıştım") ----------
     Müşteriden alınan çek ve senetler için müşteriye verilen makbuz: evraklar, toplam ve yazıyla tutar, teslim eden / teslim alan imza yerleri.
     Senet gir sayfası da kullanır (CLK.makbuz). */
  const BIR = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'], ONL = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
  const uclu = n => [Math.floor(n / 100) ? (Math.floor(n / 100) > 1 ? BIR[Math.floor(n / 100)] + ' ' : '') + 'yüz' : '', ONL[Math.floor(n % 100 / 10)], BIR[n % 10]].filter(Boolean).join(' ');
  function yaziyla(v) {
    const kurus = Math.round(Number(v) * 100), lira = Math.floor(kurus / 100), kr = kurus % 100, adlar = ['milyar', 'milyon', 'bin', ''];
    const parca = [Math.floor(lira / 1e9) % 1000, Math.floor(lira / 1e6) % 1000, Math.floor(lira / 1e3) % 1000, lira % 1000]
      .map((x, i) => (!x ? '' : i === 2 && x === 1 ? 'bin' : [uclu(x), adlar[i]].filter(Boolean).join(' '))).filter(Boolean);
    const t = (parca.join(' ') || 'sıfır') + ' Türk lirası' + (kr ? ' ' + uclu(kr) + ' kuruş' : '');
    return t.charAt(0).toLocaleUpperCase('tr') + t.slice(1);
  }
  const evrakTur = l => { const s = l.filter(senetMi).length; return s === l.length ? 'senet' : s ? 'çek ve senet' : 'çek'; };
  // m: { kisi, tarih, evraklar: [{ seri, banka, bankaAd, vade, tutar }] }
  function makbuzCiz(m) {
    const l = m.evraklar || [], W = 1080, P = 56, SAT = 52, F = "system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";
    const top = l.reduce((s, e) => s + e.tutar, 0);
    const H = 620 + (l.length + 1) * SAT + 400;
    const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2;
    const g = cv.getContext('2d'); g.scale(2, 2);
    const yaz = (t, x, y, { b = 400, z = 20, r = false, renk = '#1d2433' } = {}) => { g.font = `${b} ${z}px ${F}`; g.fillStyle = renk; g.textAlign = r ? 'right' : 'left'; g.fillText(t, x, y); };
    const kisalt = (t, z, en, b = 400) => { t = String(t || ''); g.font = `${b} ${z}px ${F}`; while (t.length > 4 && g.measureText(t).width > en) t = t.slice(0, -2).trimEnd() + '…'; return t; };
    const sigdir = (t, z, en, b = 400) => { for (; z > 13; z--) { g.font = `${b} ${z}px ${F}`; if (g.measureText(t).width <= en) break; } return z; };
    const kutu = (x, y, w, h, rd, renk, cizgi) => { g.beginPath(); g.roundRect(x, y, w, h, rd); if (renk) { g.fillStyle = renk; g.fill(); } if (cizgi) { g.strokeStyle = cizgi; g.lineWidth = 1.5; g.stroke(); } };
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    yaz('CLK ÇANTA', P, 86, { b: 800, z: 38 });
    yaz('Birlik Mah. 873 Sok. No:2/A Esenler / İstanbul', P, 118, { z: 18, renk: '#5b6475' });
    yaz('0534 077 88 67', P, 144, { z: 18, renk: '#5b6475' });
    yaz('TAHSİLAT MAKBUZU', W - P, 86, { b: 800, z: 28, r: true });
    yaz('Tarih ' + trE(m.tarih), W - P, 118, { b: 700, z: 19, r: true });
    g.fillStyle = '#1d2433'; g.fillRect(P, 168, W - 2 * P, 4);
    yaz('Sayın', P, 214, { z: 17, renk: '#5b6475' });
    yaz(kisalt(m.kisi, 30, W - 2 * P, 800), P, 250, { b: 800, z: 30 });
    kutu(P, 278, W - 2 * P, 104, 14, '#1d2433');
    yaz('Tahsil edilen', P + 30, 322, { z: 20, renk: '#fff' });
    yaz(`${evrakTur(l)} (${l.length} adet)`, P + 30, 352, { z: 20, renk: '#fff' });
    yaz(tlE(top), W - P - 30, 348, { b: 800, z: 44, r: true, renk: '#fff' });
    kutu(P, 402, W - 2 * P, 84, 12, null, '#dde2ea');
    yaz('Yalnız', P + 18, 434, { z: 16, renk: '#5b6475' });
    const yt = yaziyla(top), yz = sigdir(yt, 22, W - 2 * P - 36, 700);
    yaz(yt, P + 18, 468, { b: 700, z: yz });
    const kol = { n: P + 6, e: P + 52, v: 640, t: W - P - 6 };
    let y = 536;
    [['#', kol.n], ['EVRAK', kol.e], ['VADE', kol.v]].forEach(([t, x]) => yaz(t, x, y, { b: 700, z: 14, renk: '#5b6475' }));
    yaz('TUTAR', kol.t, y, { b: 700, z: 14, r: true, renk: '#5b6475' });
    g.fillStyle = '#1d2433'; g.fillRect(P, y + 12, W - 2 * P, 3);
    y += 15;
    for (const [i, e] of l.entries()) {
      if (i % 2) { g.fillStyle = '#f7f8fa'; g.fillRect(P, y, W - 2 * P, SAT); }
      const yy = y + 33;
      yaz(String(i + 1), kol.n, yy, { z: 17, renk: '#5b6475' });
      yaz(kisalt(evrakAdi(e), 18, kol.v - kol.e - 24), kol.e, yy, { z: 18 });
      yaz(trE(e.vade), kol.v, yy, { b: 700, z: 18 });
      yaz(tlE(e.tutar), kol.t, yy, { b: 700, z: 18, r: true });
      y += SAT;
    }
    g.fillStyle = '#1d2433'; g.fillRect(P, y + 4, W - 2 * P, 2);
    yaz('TOPLAM', kol.e, y + 40, { b: 800, z: 18 });
    yaz(tlE(top), kol.t, y + 40, { b: 800, z: 20, r: true });
    y += SAT + 14;
    yaz(`Yukarıdaki ${evrakTur(l)} cari hesabınıza karşılık alınmıştır.`, P, y + 26, { z: 18, renk: '#1d2433' });
    yaz('Çek ve senetle yapılan ödemeler, evrak vadesinde tahsil edildikten sonra geçerlidir.', P, y + 56, { z: 17, renk: '#5b6475' });
    y += 86;
    const kw = (W - 2 * P - 12) / 2;
    [['TESLİM EDEN', m.kisi], ['TESLİM ALAN', 'CLK ÇANTA']].forEach(([t, ad], i) => {
      const x = P + i * (kw + 12);
      kutu(x, y, kw, 190, 12, null, '#dde2ea');
      yaz(t, x + 18, y + 34, { b: 700, z: 14, renk: '#5b6475' });
      yaz(kisalt(ad, 20, kw - 36, 700), x + 18, y + 64, { b: 700, z: 20 });
      yaz('Ad soyad', x + 18, y + 110, { z: 15, renk: '#5b6475' });
      yaz(i ? 'İmza / kaşe' : 'İmza', x + 18, y + 164, { z: 15, renk: '#5b6475' });
      g.fillStyle = '#c9ced8'; g.fillRect(x + 110, y + 112, kw - 130, 1); g.fillRect(x + 110, y + 166, kw - 130, 1);
    });
    return new Promise(res => cv.toBlob(res, 'image/png'));
  }
  const makbuzMetni = m => { const l = m.evraklar || [], top = l.reduce((s, e) => s + e.tutar, 0);
    return `CLK Çanta – tahsilat makbuzu (${trE(m.tarih)})\nSayın ${m.kisi}, cari hesabınıza karşılık alınan ${evrakTur(l)}:\n\n`
      + l.map((e, i) => `${i + 1}) ${evrakAdi(e)} – vade ${trE(e.vade)} – ${tlE(e.tutar)}`).join('\n')
      + `\n\nToplam: ${tlE(top)} (yalnız ${yaziyla(top).toLocaleLowerCase('tr')})\nÇek ve senetle yapılan ödemeler, evrak vadesinde tahsil edildikten sonra geçerlidir.\nCLK Çanta · 0534 077 88 67`; };
  const dosyaAdi = (on, ad, tarih) => `${on}-${String(ad || '').toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]+/gi, '-').replace(/^-|-$/g, '')}-${tarih}.png`;
  // ortak: resmi paylaş, indir, yazdır (makbuz, bordro, vade raporu)
  const belge = {
    indir(url, dosya) { const a = Object.assign(document.createElement('a'), { href: url, download: dosya }); document.body.append(a); a.click(); a.remove(); },
    async paylas(blob, url, dosya, baslik) {
      const f = new File([blob], dosya, { type: 'image/png' });
      try { if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: baslik }); return; } }
      catch (err) { if (err.name === 'AbortError') return; }
      belge.indir(url, dosya); toast('Bu cihaz doğrudan paylaşmaya izin vermedi; resim indirildi');
    },
    yazdir(url, baslik) {
      const w = window.open('', '_blank');
      if (!w) { toast('Yazdırma penceresi açılamadı; resmi indirip yazdırın'); return; }
      w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(baslik)}</title><style>@page{margin:10mm}body{margin:0}img{display:block;width:100%}</style><img src="${url}" onload="setTimeout(function(){print()},200)">`);
      w.document.close();
    },
    kopyala(t, ne) { (navigator.clipboard?.writeText(t) || Promise.reject()).then(() => toast(ne + ' yazısı kopyalandı; WhatsApp\'a yapıştırabilirsiniz')).catch(() => { window.prompt('Yazıyı kopyalayın:', t); }); }
  };
  CLK.makbuz = { ciz: makbuzCiz, metin: makbuzMetni, dosya: m => dosyaAdi('tahsilat-makbuzu', m.kisi, m.tarih), yaziyla };
  CLK.belge = belge;
  // müşterinin evrak aldığı günler (makbuz için): en yeni önce
  const alisGunleri = ad => {
    const g = {};
    for (const c of D.v?.cekler || []) if ((c.yon === 'ciro' || c.yon === 'alinan') && c.kimden === ad && c.tarih) { const x = g[c.tarih] ||= { tarih: c.tarih, n: 0, t: 0 }; x.n++; x.t += c.tutar; }
    return Object.values(g).sort((a, b) => b.tarih.localeCompare(a.tarih)).slice(0, 15);
  };
  async function makbuzHazirla() {
    if (!D.rm || !musteriler().some(m => m.ad === D.rm)) { D.rDurum = 'Listeden bir müşteri seçin.'; S.keepScroll = true; render(); return; }
    const gl = alisGunleri(D.rm), tarih = gl.some(x => x.tarih === D.mTarih) ? D.mTarih : gl[0]?.tarih;
    raporSifirla();
    if (!tarih) { D.rDurum = 'Bu müşteriden alınmış çek ya da senet yok.'; S.keepScroll = true; render(); return; }
    const l = (D.v.cekler || []).filter(c => (c.yon === 'ciro' || c.yon === 'alinan') && c.kimden === D.rm && c.tarih === tarih).sort(alisSira);
    D.rMakbuz = { kisi: D.rm, tarih, evraklar: l.map(c => ({ seri: c.seri, banka: c.banka, bankaAd: c.bankaAd, vade: c.vade, tutar: c.tutar })) };
    rBlob = await makbuzCiz(D.rMakbuz);
    D.rResim = URL.createObjectURL(rBlob); D.rTur = 'makbuz';
    D.rDurum = `${dt(tarih)} tarihinde alınan ${l.length} evrak için tahsilat makbuzu hazırlandı.`;
    S.keepScroll = true; render();
  }

  function raporCiz(ad, l) {
    const W = 1080, P = 56, SAT = 50, F = "system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif";
    const gelecek = l.filter(c => sonGun(c) >= bugun()), top = gelecek.reduce((s, c) => s + c.tutar, 0);
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
    yaz('Ödeme süresi dolmamış', P + 30, 322, { z: 20, renk: '#fff' });
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
      const yy = y + 32, gecti = sonGun(c) < bugun();
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
    const gelecek = l.filter(c => sonGun(c) >= bugun());
    return `Sayın ${ad},\nCLK Çanta'daki çek ve senetleriniz (${trE(bugun())} itibarıyla):\n\n` +
      l.map(c => `• ${evrakAdi(c)}: alış ${trE(c.tarih)}, vade ${trE(c.vade)}, ${tlE(c.tutar)} (${durumYaz(c)[0].toLocaleLowerCase('tr')})`).join('\n') +
      `\n\nÖdeme süresi dolmamış toplam: ${tlE(gelecek.reduce((s, c) => s + c.tutar, 0))} (${gelecek.length} adet).\nVade tarihlerinde ödemenizi rica ederiz. Teşekkür ederiz.\nCLK Çanta · 0534 077 88 67`;
  };
  const waNo = t => { const d = String(t).replace(/\D/g, ''); return d.startsWith('90') ? d : d.startsWith('0') ? '9' + d : d.length === 10 ? '90' + d : d; };
  const raporDosya = () => (D.rTur === 'makbuz' && D.rMakbuz ? CLK.makbuz.dosya(D.rMakbuz) : dosyaAdi('cek-senet', D.rm, bugun()));
  const raporSifirla = () => { if (D.rResim) URL.revokeObjectURL(D.rResim); D.rResim = ''; rBlob = null; D.rDurum = ''; };
  async function raporHazirla() {
    if (!D.rm || !musteriler().some(m => m.ad === D.rm)) { D.rDurum = 'Listeden bir müşteri seçin.'; S.keepScroll = true; render(); return; }
    const l = musteriEvrak(D.rm, D.rGecmis);
    raporSifirla();
    if (!l.length) { D.rDurum = 'Bu müşterinin ödeme süresi dolmamış evrakı yok. Geçmiş evrakları da göstermek için kutuyu işaretleyin.'; S.keepScroll = true; render(); return; }
    rBlob = await raporCiz(D.rm, l);
    D.rResim = URL.createObjectURL(rBlob); D.rTur = 'rapor';
    D.rDurum = `${l.length} evrak rapora yazıldı.`;
    S.keepScroll = true; render();
  }
  function raporKart() {
    const ml = musteriler(), m = ml.find(x => x.ad === D.rm);
    const tel = m ? (D.v.cekler.find(c => c.kimden === D.rm && c.kimdenTel)?.kimdenTel || '') : '';
    return `<div class="card cs-rapor" id="csRapor">
      <h3>Müşteriye vade raporu ve tahsilat makbuzu</h3><p class="sub">Vade raporu: müşterinin verdiği çek ve senetler alış ve vade tarihleriyle (kime ciro edildiği yazılmaz). Tahsilat makbuzu: seçilen gün müşteriden alınan evraklar, tutar yazıyla, imza yerleriyle. İkisi de resim olarak WhatsApp'tan gönderilir ya da yazdırılır.</p>
      <div class="cs-r-form">
        <div class="f ara-alan"><span>Müşteri</span>${araKutu('csRm', ml, D.rm, 'csRm', { yer: `Müşteri adı yazın (${ml.length} müşteri)` })}</div>
        <label class="toggle"><input type="checkbox" id="csRGecmis" ${D.rGecmis ? 'checked' : ''}> Vadesi geçmiş evraklar da olsun</label>
      </div>
      ${m ? (() => { const gl = alisGunleri(D.rm); return gl.length ? `<label class="f cs-m-gun"><span>Makbuz için evrak alınan gün</span><select id="csMTarih">${gl.map(x => `<option value="${x.tarih}" ${x.tarih === D.mTarih ? 'selected' : ''}>${dt(x.tarih)} · ${num(x.n)} evrak · ${tl(x.t)}</option>`).join('')}</select></label>` : ''; })() : ''}
      <div class="ek-dug">
        <button class="btn dark" data-act="csRHazirla">Vade raporu</button>
        <button class="btn dark" data-act="csMHazirla" ${m && alisGunleri(D.rm).length ? '' : 'disabled'}>Tahsilat makbuzu</button>
        <button class="btn ek-wa" data-act="csRPaylas" ${D.rResim ? '' : 'disabled'}>WhatsApp'ta paylaş</button>
        <button class="btn" data-act="csRIndir" ${D.rResim ? '' : 'disabled'}>Resmi indir</button>
        <button class="btn" data-act="csRYazdir" ${D.rResim ? '' : 'disabled'}>Yazdır</button>
        <button class="btn" data-act="csRMetin" ${D.rResim ? '' : 'disabled'}>Yazı olarak kopyala</button>
        ${D.rResim && tel ? `<a class="btn" href="https://wa.me/${esc(waNo(tel))}" target="_blank" rel="noopener">WhatsApp'ta sohbeti aç</a>` : ''}
      </div>
      ${D.rDurum ? `<p class="ek-durum" role="status">${esc(D.rDurum)}</p>` : ''}
      ${D.rResim ? `<div class="ek-on"><img src="${D.rResim}" alt="${D.rTur === 'makbuz' ? 'Tahsilat makbuzu' : 'Çek ve senet dökümü'}: ${esc(D.rm)}"></div>` : ''}
    </div>`;
  }
  const raporBaslik = () => (D.rTur === 'makbuz' ? 'Tahsilat makbuzu' : 'Çek ve senet dökümü');
  function raporPaylas() { if (rBlob) belge.paylas(rBlob, D.rResim, raporDosya(), raporBaslik()); }
  function raporIndir() { belge.indir(D.rResim, raporDosya()); }
  araSec.csRm = m => { if (m.ad !== D.rm) { raporSifirla(); D.mTarih = ''; } D.rm = m.ad; };

  views.cek = () => {
    if (!D.v && !D.yuk && !D.hata) yukle();
    const acts = `<button class="btn" data-act="csYenile" ${D.yuk ? 'disabled' : ''}>${D.yuk ? 'Paraşüt\'ten okunuyor…' : 'Yenile'}</button><button class="btn" data-act="csTedVer">Tedarikçiye ver</button><button class="btn dark" data-go="senet">Senet gir</button>`;
    const ust = head('Finans', 'Çek ve senet', `Paraşüt'teki çek ve senetler${D.v ? ' (' + dtt(D.v.zaman) + ' itibarıyla)' : ''}. Senet "Senet gir" sayfasından girilir, portföydeki evraklar "Tedarikçiye ver" ile çıkış bordrosuna yazılır; çek girişi, ciro ve ödemeler Paraşüt'ten yapılır.`, acts);
    if (!D.v) return ust + (D.hata ? `<div class="card empty"><h3>Liste alınamadı</h3><p>${esc(D.hata)}</p><button class="btn dark" data-act="csYenile">Tekrar dene</button></div>`
      : '<div class="card"><p class="hint" style="margin-bottom:12px">Paraşüt\'ten bütün çek ve senetler okunuyor, yarım dakika sürebilir…</p><div class="skel" style="height:120px"></div><div class="skel" style="height:260px;margin-top:14px"></div></div>');
    const l = D.v.cekler || [];
    const od = l.filter(SEKME.odenecek[1]), pf = l.filter(SEKME.portfoy[1]), ci = l.filter(SEKME.ciro[1]);
    const ay = bugun().slice(0, 7);
    const buAy = od.filter(c => c.vade.slice(0, 7) <= ay), otuz = od.filter(c => gunFark(c.vade) <= 30);
    const enYakin = [...od].sort((a, b) => a.vade.localeCompare(b.vade))[0];
    const bugunku = [...od, ...pf.filter(c => !senetMi(c))].filter(c => gunFark(c.vade) <= 0).sort((a, b) => a.vade.localeCompare(b.vade)), hafta = od.filter(c => gunFark(c.vade) > 0 && gunFark(c.vade) <= 7);
    // müşteri senetleri: ödeme ve protesto günü (vade, tatilse sonraki iş günü, ve izleyen iki iş günü)
    const snPf = pf.filter(senetMi).sort((a, b) => a.vade.localeCompare(b.vade)), snD = d => snPf.filter(c => odemeDurum(c) === d);
    const snSon = snD('songun'), snSure = snD('surede'), snGec = snD('gecti').reverse(), snHafta = snD('gelecek').filter(c => gunFark(c.vade) <= 7);
    const kisaL = (l, f, en = 8) => l.slice(0, en).map(f).join(' · ') + (l.length > en ? ` · ve ${num(l.length - en)} evrak daha` : '');
    const snUyari = (snSon.length ? `<div class="cs-uy bad"><b>Bugün son gün: ${num(snSon.length)} müşteri senedi, ${tl(toplam(snSon))}</b><span>${kisaL(snSon, c => `${esc(c.kimden || 'Kişi yok')} ${tl(c.kalan)} (vade ${dt(c.vade)})`)}</span><small>Ödenmezse bugün ${snSon.some(c => yarimGun(sonGun(c))) ? 'öğlene' : "15:00'a"} kadar protesto için notere verilmeli. Tahsil edildiyse Paraşüt'te işleyin.</small></div>` : '')
      + (snSure.length ? `<div class="cs-uy warn"><b>Ödeme süresinde: ${num(snSure.length)} müşteri senedi, ${tl(toplam(snSure))}</b><span>${kisaL(snSure, c => `${esc(c.kimden || 'Kişi yok')} ${tl(c.kalan)}, vade ${dt(c.vade)} → son gün ${sonYaz(sonGun(c))}`)}</span><small>Vadesi geldi; müşteri son güne kadar ödeyebilir. Ödemezse son gün protesto çekilir.</small></div>` : '')
      + (snGec.length ? `<div class="cs-uy bad"><b>Süresi geçti, tahsil edilmedi: ${num(snGec.length)} müşteri senedi, ${tl(toplam(snGec))}</b><span>${kisaL(snGec, c => `${esc(c.kimden || 'Kişi yok')} ${tl(c.kalan)} (son gün ${dt(sonGun(c))} idi)`)}</span><small>Tahsil edildiyse Paraşüt'te işlenmeli; edilmediyse protesto edildi mi bakın.</small></div>` : '')
      + (snHafta.length ? `<div class="cs-uy gold"><b>7 gün içinde vadesi gelen müşteri senedi: ${num(snHafta.length)}, ${tl(toplam(snHafta))}</b><span>${kisaL(snHafta, c => `${esc(c.kimden || 'Kişi yok')} ${tl(c.kalan)}, vade ${dt(c.vade)} → son gün ${kisaGun(sonGun(c))}`)}</span><small>Portföydeki senetler; müşteriye hatırlatmak isteyebilirsiniz.</small></div>` : '');
    const ciroHafta = ci.filter(c => gunFark(c.vade) <= 7);
    AYR = ayrilanlar();
    const bekBordro = Object.entries(AYR).map(([id, b]) => ({ c: l.find(x => x.id === id), b })), bekGrup = {};
    for (const x of bekBordro) (bekGrup[x.b.no] ||= { b: x.b, n: 0 }).n++;

    // liste: sekme + ay + arama
    const q = buyukHarf(D.ara.trim());
    const ayF = c => !D.ay || c.vade.startsWith(D.ay);
    const araF = c => !q || buyukHarf([c.kimden, c.kime, c.seri, banka(c), c.bankaAd, c.aciklama, tur(c), String(c.tutar)].join(' ')).includes(q);
    const say = k => l.filter(c => SEKME[k][1](c) && ayF(c) && araF(c)).length;
    const liste = l.filter(c => SEKME[D.sekme][1](c) && ayF(c) && araF(c))
      .sort((a, b) => (acik(a) && acik(b) ? alisSira(a, b) : acik(a) !== acik(b) ? (acik(a) ? -1 : 1) : alisSira(b, a)));

    return `${ust}
      <div class="kpis cs-kpis">
        <div class="kpi hero"><div class="k">Ödenecek çek ve senet</div><div class="v">${tl(toplam(od))}</div>
          <div class="s">${num(od.length)} evrak${enYakin ? ` · en yakın vade ${dt(enYakin.vade)}, ${tl(enYakin.kalan)} (${esc(enYakin.kime)})` : ''}</div></div>
        <div class="kpi ${buAy.length ? 'bad' : ''}"><div class="k">Bu ay ödenecek</div><div class="v">${tl(toplam(buAy))}</div><div class="s">${num(buAy.length)} evrak, gecikenler dahil · 30 gün içinde ${tl(toplam(otuz))}</div></div>
        <div class="kpi"><div class="k">Portföyde</div><div class="v">${tl(toplam(pf))}</div><div class="s">${num(pf.length)} müşteri evrakı elde</div></div>
        <div class="kpi"><div class="k">Ciro edilen</div><div class="v">${tl(toplam(ci))}</div><div class="s">${num(ci.length)} evrak, süresi dolmadı</div></div>
      </div>
      ${snUyari || bugunku.length || hafta.length || ciroHafta.length || bekBordro.length ? `<div class="cs-uyarilar">
        ${snUyari}
        ${bekBordro.length ? `<div class="cs-uy warn"><b>Tedarikçiye verildi, Paraşüt'te ciro edilmedi: ${num(bekBordro.length)} evrak, ${tl(bekBordro.reduce((t, x) => t + (x.c?.tutar || 0), 0))}</b><span>${Object.values(bekGrup).map(x => `${esc(x.b.no)} ${esc(x.b.kisi)} (${num(x.n)} evrak)`).join(' · ')}</span><small>Paraşüt'te tedarikçiye ödeme olarak girin (ödeme şekli çek/senet, portföyden seçin); girilince bu uyarı kalkar.</small></div>` : ''}
        ${bugunku.length ? `<div class="cs-uy bad"><b>Vadesi bugün ya da geçmiş: ${num(bugunku.length)} evrak, ${tl(toplam(bugunku))}</b><span>${kisaL(bugunku, c => `${esc(tur(c))} ${c.yon === 'alinan' ? esc(c.kimden) + ' (tahsil edilecek)' : esc(c.kime)} ${tl(c.kalan)}, vade ${dt(c.vade)}`, 12)}</span><small>Ödendiyse ya da tahsil edildiyse Paraşüt'te işlenmeli; bu sayfa Paraşüt'teki durumu gösterir.</small></div>` : ''}
        ${hafta.length ? `<div class="cs-uy warn"><b>7 gün içinde ödenecek: ${num(hafta.length)} evrak, ${tl(toplam(hafta))}</b><span>${hafta.map(c => `${esc(c.kime)} ${tl(c.kalan)} (${dt(c.vade)})`).join(' · ')}</span></div>` : ''}
        ${ciroHafta.length ? `<div class="cs-uy gold"><b>7 gün içinde vadesi gelen müşteri evrakı: ${num(ciroHafta.length)}, ${tl(toplam(ciroHafta))}</b><span>${ciroHafta.slice(0, 8).map(c => `${esc(c.kimden)} ${tl(c.tutar)} (${senetMi(c) && gunFark(c.vade) <= 0 ? 'son gün ' + kisaGun(sonGun(c)) : 'vade ' + dt(c.vade)})`).join(' · ')}${ciroHafta.length > 8 ? ' …' : ''}</span><small>Ciro ettiğiniz evraklar; müşteriye hatırlatmak isteyebilirsiniz.</small></div>` : ''}
      </div>` : ''}
      ${panelSenet()}
      ${takvim(l)}
      <div class="grid2 cs-gruplar">
        ${grupKart('Kime ödeyeceğiz', 'Verdiğimiz, ödenmemiş çek ve senetler kişi başına.', od, 'kime', 'cs-g-od')}
        ${grupKart('Ciro ettiğimiz müşteri evrakları', 'Ödeme süresi dolmamış; müşteri ödemezse tedarikçi bize döner.', ci, 'kimden', 'cs-g-ci')}
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
    pnBagla();
    $('#csRGecmis')?.addEventListener('change', e => { D.rGecmis = e.target.checked; if (D.rResim && D.rTur !== 'makbuz') raporHazirla(); });
    $('#csMTarih')?.addEventListener('change', e => { D.mTarih = e.target.value; if (D.rResim && D.rTur === 'makbuz') makbuzHazirla(); });
    const a = $('#csAra');
    a?.addEventListener('input', () => { clearTimeout(a.t); a.t = setTimeout(() => { D.ara = a.value; D.goster = 60; S.keepScroll = true; render.yazinca(); }, 200); });
  };

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    const ciz = () => { S.keepScroll = true; render(); };
    if (act === 'csYenile') { D.hata = ''; yukle(true); }
    else if (act === 'csTedVer') {
      // Senet gir › Tedarikçiye verdik › Portföydeki müşteri evrakı açılır
      const sn = S.ui.sn;
      if (sn) { if (sn.f.yon !== 'verilen') { sn.f.yon = 'verilen'; sn.f.kisi = null; } sn.f.tur = 'portfoy'; sn.onay = false; if (D.v && !sn.c) sn.c = D.v; }
      CLK.go('senet');
    }
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
    else if (act === 'csMHazirla') makbuzHazirla();
    else if (act === 'csRYazdir') { if (D.rResim) belge.yazdir(D.rResim, raporBaslik() + ' – ' + D.rm); }
    else if (act === 'csRMetin') {
      if (D.rTur === 'makbuz' && D.rMakbuz) belge.kopyala(makbuzMetni(D.rMakbuz), 'Makbuz');
      else belge.kopyala(raporMetni(D.rm, musteriEvrak(D.rm, D.rGecmis)), 'Rapor');
    }
    else prevAct?.(act, el, e);
  };

  /* ---------- Panel: senetlerin tahsil durumu (celik 01.11.2026: "Ana sayfada senetlerde tahsil edilmiş ve edilecek total…
     Ödenenler yeşil, ödenecekler turuncu, ödenmeyen kırmızı. Müşteri bazlı da ödenen ve ödenecek olanları ayrı görelim")
     Müşteri tarafı: müşteriden alınan evrak (portföyde duran ve tedarikçiye ciro edilen).
       Yeşil  = Paraşüt'te tahsil edilen kısım; ciro edilip ödeme süresi geçen evrak da (karşılıksız dönmediyse) müşteri ödemiş sayılır.
       Turuncu = ödeme süresi dolmamış portföy ve ciro evrakı (senette son gün, yani vade ve izleyen iki iş günü dahil; çekte vade günü dahil).
       Kırmızı = ödeme süresi geçmiş, Paraşüt'te tahsil edilmemiş portföy evrakı (02.11.2026'dan önce vade geçince kırmızıydı).
     Tedarikçi tarafı: firmanın verdiği evrak (ödendi / ödenecek / vadesi geçti, ödenmedi). Yalnız TL evrak toplanır. */
  const PN = (S.ui.csp ||= { yon: 'alinan', tur: 'senet', ara: '', acik: '', hepsi: false, denendi: false, at: 0 });
  const pnAl = () => PN.yon !== 'verilen';
  const pnKisi = c => (c.yon === 'verilen' ? { id: c.kimeId, ad: c.kime } : { id: c.kimdenId, ad: c.kimden });
  function pnParca(c) {
    const t = bugun();
    if (c.yon === 'ciro') return sonGun(c) < t ? { y: c.tutar, t: 0, k: 0, ciro: 0 } : { y: 0, t: c.tutar, k: 0, ciro: c.tutar };
    const kalan = Math.max(0, Math.min(c.tutar, Number(c.kalan) || 0));
    const gec = kalan > 0.009 && (c.yon === 'alinan' && senetMi(c) ? sonGun(c) < t : (c.vade < t || c.durum === 'overdue'));
    return { y: c.tutar - kalan, t: gec ? 0 : kalan, k: gec ? kalan : 0, ciro: 0 };
  }
  function pnOzet() {
    const al = pnAl(), ay = bugun().slice(0, 7), top = { y: 0, t: 0, k: 0, ciro: 0, ny: 0, nt: 0, nk: 0, buAy: 0, ciroY: 0, nSure: 0 }, kisi = {};
    let dvz = 0;
    for (const c of D.v?.cekler || []) {
      if (al ? !(c.yon === 'alinan' || c.yon === 'ciro') : c.yon !== 'verilen') continue;
      if (PN.tur !== 'hepsi' && (PN.tur === 'senet') !== senetMi(c)) continue;
      if (c.doviz && c.doviz !== 'TRL') { dvz++; continue; }
      const p = pnParca(c), ki = pnKisi(c), ad = String(ki.ad || '').trim() || 'Kişi yok', key = ki.id || ad;
      const k = (kisi[key] ||= { id: key, ad, y: 0, t: 0, k: 0, n: 0, sonraki: '', gecGun: 0, l: [] });
      for (const a of ['y', 't', 'k']) { top[a] += p[a]; k[a] += p[a]; }
      if (p.y > 0.009) { top.ny++; if (c.yon === 'ciro') top.ciroY += p.y; }
      if (p.t > 0.009) { top.nt++; if (c.vade.startsWith(ay)) top.buAy += p.t; if (!k.sonraki || c.vade < k.sonraki) k.sonraki = c.vade; if (al && senetMi(c) && gunFark(c.vade) <= 0) top.nSure++; }
      if (p.k > 0.009) { top.nk++; k.gecGun = Math.max(k.gecGun, -gunFark(c.vade)); }
      top.ciro += p.ciro; k.n++; k.l.push(c);
    }
    const kisiler = Object.values(kisi).sort((a, b) => b.k - a.k || b.t - a.t || b.y - a.y || a.ad.localeCompare(b.ad, 'tr'));
    return { top, kisiler, dvz };
  }
  const pnTutar = (v, cls) => v > 0.009 ? `<b class="${cls}">${tl(v)}</b>` : '<b class="sp-yok">—</b>';
  function pnEvrakDurum(c) {
    const p = pnParca(c), n = gunFark(c.vade), al = c.yon !== 'verilen';
    if (p.k > 0.009) return `<span class="sp-d k">${-n} gün geçti${p.y > 0.009 ? `, ${tl(p.k)} kaldı` : ''}</span>`;
    const sure = al && senetMi(c) && n <= 0 ? odemeDurum(c) : '';
    if (p.t > 0.009) return `<span class="sp-d t">${c.yon === 'ciro' ? 'Ciroda, ' : ''}${sure === 'songun' ? 'bugün son gün' : sure ? 'son gün ' + kisaGun(sonGun(c)) : n === 0 ? 'vadesi bugün' : n + ' gün kaldı'}${p.y > 0.009 ? `, ${tl(p.t)} kaldı` : ''}</span>`;
    return `<span class="sp-d y">${c.yon === 'ciro' ? 'Ciro edildi, süresi geçti' : al ? 'Tahsil edildi' : 'Ödendi'}</span>`;
  }
  function pnEvraklar(k) {
    const l = k.l.slice().sort((a, b) => { const r = x => { const p = pnParca(x); return p.k > 0.009 ? 0 : p.t > 0.009 ? 1 : 2; }; return r(a) - r(b) || (r(a) === 2 ? alisSira(b, a) : alisSira(a, b)); });
    return `<div class="sp-ev">${l.map(c => {
      const p = pnParca(c), cls = p.k > 0.009 ? 'k' : p.t > 0.009 ? 't' : 'y', bk = banka(c);
      return `<div class="sp-e ${cls}"><span class="sp-e-n"><b>${esc(tur(c))}${c.seri ? ' ' + esc(c.seri) : ''}</b>${bk ? `<small>${esc(bk)}</small>` : ''}</span>
        <span class="sp-e-t">Alış ${dt(c.tarih)}<br>Vade ${dt(c.vade)}</span><b class="sp-e-v">${tl(c.tutar)}</b>${pnEvrakDurum(c)}</div>`;
    }).join('')}</div>`;
  }
  function pnTablo(o) {
    const al = pnAl(), q = PN.ara.trim().toLocaleLowerCase('tr');
    const l = q ? o.kisiler.filter(k => k.ad.toLocaleLowerCase('tr').includes(q)) : o.kisiler, EN = 8, g = PN.hepsi || q ? l : l.slice(0, EN);
    if (!o.kisiler.length) return `<p class="sp-bos">${al ? 'Müşteriden alınmış' : 'Tedarikçiye verilmiş'} ${PN.tur === 'cek' ? 'çek' : PN.tur === 'senet' ? 'senet' : 'evrak'} yok.</p>`;
    return `<div class="sp-r sp-bas"><span>${al ? 'Müşteri' : 'Tedarikçi'}</span><span class="y">${al ? 'Tahsil edildi' : 'Ödendi'}</span><span class="t">${al ? 'Tahsil edilecek' : 'Ödenecek'}</span><span class="k">Ödenmedi</span></div>
      ${g.map(k => `<button class="sp-r ${PN.acik === k.id ? 'acik' : ''}" data-act="spAc" data-id="${esc(k.id)}" aria-expanded="${PN.acik === k.id}">
        <span class="sp-ad"><b>${esc(k.ad)}</b><small>${num(k.n)} evrak${k.gecGun ? ` · <em class="k">${num(k.gecGun)} gün gecikme</em>` : k.sonraki ? ` · sonraki vade ${dt(k.sonraki)}` : ''}</small></span>
        ${pnTutar(k.y, 'y')}${pnTutar(k.t, 't')}${pnTutar(k.k, 'k')}</button>${PN.acik === k.id ? pnEvraklar(k) : ''}`).join('') || '<p class="sp-bos">Aramaya uyan kişi yok.</p>'}
      ${!q && l.length > EN ? `<div class="sp-alt"><button class="btn sm ghost" data-act="spHepsi">${PN.hepsi ? 'Daha az göster' : `Tümünü göster (${num(l.length)})`}</button></div>` : ''}`;
  }
  function panelSenet() {
    const ust = (alt) => `<div class="card-h"><div><h3>Senetler</h3><p class="sub">${alt}</p></div></div>`;
    if (!D.v) return `<div class="card sp" id="spKart">${ust('Paraşüt\'ten okunuyor…')}${D.hata ? `<p class="msg err">${esc(D.hata)}</p><button class="btn sm" data-act="spYenile" style="margin-top:10px">Tekrar dene</button>` : '<div class="skel" style="height:170px"></div>'}</div>`;
    const o = pnOzet(), t = o.top, T = t.y + t.t + t.k, al = pnAl(), zm = D.v.zaman ? new Date(D.v.zaman).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
    const seg = (act, deger, l) => `<div class="gd-seg" role="group">${l.map(([k, ad]) => `<button data-act="${act}" data-o="${k}" aria-pressed="${deger === k}">${ad}</button>`).join('')}</div>`;
    const kutu = (c, ad, v, alt) => `<div class="sp-k ${c}"><span>${ad}</span><b>${tl(v)}</b><small>${alt}</small></div>`;
    return `<div class="card sp" id="spKart">${ust(`${al ? 'Müşteriden alınan' : 'Tedarikçiye verdiğimiz'} ${PN.tur === 'cek' ? 'çekler' : PN.tur === 'senet' ? 'senetler' : 'çek ve senetler'} · Paraşüt${zm ? ', ' + zm : ''}${D.yuk ? ' · yenileniyor…' : ''}`)}
      <div class="sp-secim">${seg('spYon', PN.yon, [['alinan', 'Müşteriden alınan'], ['verilen', 'Tedarikçiye verilen']])}${seg('spTur', PN.tur, [['senet', 'Senet'], ['cek', 'Çek'], ['hepsi', 'Hepsi']])}</div>
      <div class="sp-kutular">
        ${kutu('y', al ? 'Tahsil edildi' : 'Ödendi', t.y, `${num(t.ny)} evrak${al && t.ciroY > 0.009 ? ` · ${tl(t.ciroY)} ciro edilip vadesi geçen` : ''}`)}
        ${kutu('t', al ? 'Tahsil edilecek' : 'Ödenecek', t.t, `${num(t.nt)} evrak${t.nSure ? ` · ${num(t.nSure)} ödeme süresinde` : ''}${t.buAy > 0.009 ? ` · bu ay ${tl(t.buAy)}` : ''}${t.ciro > 0.009 ? ` · ${tl(t.ciro)} ciroda` : ''}`)}
        ${kutu('k', 'Ödenmedi', t.k, t.nk ? `${num(t.nk)} evrak, ${al ? 'süresi' : 'vadesi'} geçti` : al ? 'Süresi geçmiş evrak yok' : 'Vadesi geçmiş evrak yok')}
      </div>
      ${T > 0.009 ? `<div class="sp-bar" aria-hidden="true">${['y', 't', 'k'].map(a => t[a] > 0.009 ? `<i class="${a}" style="width:${(t[a] / T * 100).toFixed(2)}%"></i>` : '').join('')}</div>` : ''}
      <div class="sp-ara"><h4>${al ? 'Müşteri bazında' : 'Tedarikçi bazında'}</h4><input id="spAra" type="search" placeholder="${al ? 'Müşteri' : 'Tedarikçi'} ara" value="${esc(PN.ara)}" autocomplete="off" aria-label="Kişi ara"></div>
      <div class="sp-tablo" id="spTablo">${pnTablo(o)}</div>
      <p class="sp-not">${al ? 'Senette son gün vade (tatilse sonraki iş günü) ve izleyen iki iş günüdür, 15:00\'a kadar; kırmızıya son gün geçince düşer. Ciro edilip süresi geçen evrak, müşteriye geri dönmediyse ödenmiş sayılır. ' : ''}${o.dvz ? `${num(o.dvz)} döviz evrakı toplama katılmadı. ` : ''}Satıra dokununca evraklar açılır.</p>
    </div>`;
  }
  /* Ana panel: önümüzdeki 7 günün senetleri (celik 02.11.2026: "bu 7 gün içinde olan senetleri bana ana panelde göster. senetleri ordan kaldır.
     ana ekrandan sadece ödemesi gelen ve ödenecek senetleri vadeleri ile yaz"). Büyük senet kartı (yeşil/turuncu/kırmızı, kişi bazında) Çek ve senet sayfasına taşındı.
     celik 02.11: "senetlerde tedarikçiye vermiş olsam dahi orda göster. senet kimin senet nerde tarih ve vade. ödenecekler formu gibi düşün":
     Ödemesi gelen: müşteri senedi portföyde ya da tedarikçiye ciro edilmiş (çıkış bordrosuna yazılıp Paraşüt'te işlenmemiş olan da), vadesi 7 gün içinde
     ya da vadesi geçmiş ama son günü gelmemiş. Sütunlar: vade, senet kimin, nerede, alış tarihi, tutar, durum.
     Ödenecek: firmanın verdiği, ödenmemiş senet, vadesi 7 gün içinde ya da geçmiş (gecikmiş de ödenecek sayılır). Yalnız TL.
     celik 02.11: "senetler 7 gün de çekler senetler gelmedi": çekler de girer (çekte son gün vadedir); o gün yaklaşan evrakların çoğu ciro edilmişti. */
  function panelKisa() {
    const ust = alt => `<div class="card-h"><div><h3>Çek ve senetler · 7 gün</h3><p class="sub">${alt}</p></div><button class="btn sm ghost" data-go="cek">Çek ve senet</button></div>`;
    if (!D.v) return `<div class="card sk7">${ust('Paraşüt\'ten okunuyor…')}${D.hata ? `<p class="msg err">${esc(D.hata)}</p><button class="btn sm" data-act="spYenile" style="margin-top:10px">Tekrar dene</button>` : '<div class="skel" style="height:120px"></div>'}</div>`;
    const tut = c => (c.yon === 'ciro' ? c.tutar : c.kalan);
    const ayr = ayrilanlar();
    const l = (D.v.cekler || []).filter(c => (!c.doviz || c.doviz === 'TRL') && c.vade && (c.yon === 'ciro' ? c.tutar > 0.009 : c.kalan > 0.009));
    const sira = (a, b) => alisSira(a, b) || (a.kimden || a.kime || '').localeCompare(b.kimden || b.kime || '', 'tr');
    const gel = l.filter(c => (c.yon === 'alinan' || c.yon === 'ciro') && gunFark(c.vade) <= 7 && gunFark(sonGun(c)) >= 0).sort(sira);
    const ver = l.filter(c => c.yon === 'verilen' && gunFark(c.vade) <= 7).sort(sira);
    const top = x => x.reduce((t, c) => t + tut(c), 0);
    const tarihK = d => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '–');
    const durum = c => {
      const n = gunFark(c.vade);
      if (c.yon !== 'verilen' && n <= 0) { const s = gunFark(sonGun(c)); return s === 0 ? ['bad', 'Bugün son gün'] : ['warn', 'Son gün ' + kisaGun(sonGun(c))]; }
      return n < 0 ? ['bad', `${-n} gün gecikti`] : n === 0 ? ['bad', 'Bugün'] : n === 1 ? ['warn', 'Yarın'] : ['gold', `${n} gün kaldı`];
    };
    const nerede = c => {
      if (c.yon === 'ciro') return `<b>${esc(c.kime || 'Tedarikçi')}</b><small>Ciro edildi</small>`;
      const b = ayr[c.id];
      if (b) return `<b>${esc(b.kisi)}</b><small>Bordro ${esc(b.no)} · Paraşüt'te ciro bekliyor</small>`;
      return '<b class="sk7-pf">Portföyde</b><small>Elimizde</small>';
    };
    const vadeH = c => `<div class="cs-vade"><b>${c.vade.slice(8, 10)}</b><small>${AYLAR[+c.vade.slice(5, 7) - 1]} ${GUNK[haftaGunu(c.vade)]}</small></div>`;
    const no = c => `${tur(c)}${banka(c) ? ' ' + esc(banka(c)) : ''}${c.seri ? ' no ' + esc(c.seri) : ''}${c.vade.slice(0, 4) !== bugun().slice(0, 4) ? ' · vade ' + c.vade.slice(0, 4) : ''}`;
    const satir = (c, gelen) => { const [cls, yaz] = durum(c); return `<li class="sk7-tr${c.yon === 'ciro' || ayr[c.id] ? ' ted' : ''}">
      <div class="v">${vadeH(c)}</div>
      <div class="k"><b>${esc((gelen ? c.kimden : c.kime) || 'Kişi yok')}</b><small>${no(c)}</small></div>
      ${gelen ? `<div class="n"><span class="m">Nerede: </span>${nerede(c)}</div>` : ''}
      <div class="t"><span class="m">${gelen ? 'Alış' : 'Veriliş'} </span>${tarihK(c.tarih)}</div>
      <div class="tu">${tl(tut(c))}</div>
      <div class="d"><span class="pill ${cls}">${yaz}</span></div></li>`; };
    const tablo = (cls, baslik, alt, x, bos, gelen) => `<section class="sk7-kol ${cls}">
      <div class="sk7-b"><span>${baslik}</span><b>${tl(top(x))}</b><small>${alt}</small></div>
      ${x.length ? `<ul class="sk7-tb ${gelen ? 'gelen' : 'oden'}"><li class="sk7-th" aria-hidden="true"><span>Vade</span><span>${gelen ? 'Kimin' : 'Kime verildi'}</span>${gelen ? '<span>Nerede</span>' : ''}<span>${gelen ? 'Alış tarihi' : 'Veriliş tarihi'}</span><span class="r">Tutar</span><span class="r">Durum</span></li>${x.map(c => satir(c, gelen)).join('')}</ul>` : `<p class="sk7-bos">${bos}</p>`}</section>`;
    const pf = gel.filter(c => c.yon === 'alinan' && !ayr[c.id]), td = gel.filter(c => c.yon === 'ciro' || ayr[c.id]);
    const gelAlt = gel.length ? `${num(gel.length)} evrak${td.length ? ` · portföyde ${tl(top(pf))}, tedarikçide ${tl(top(td))}` : ''}` : '';
    const zm = D.v.zaman ? new Date(D.v.zaman).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
    return `<div class="card sk7">${ust(`Vadesi önümüzdeki 7 günde olan çek ve senetler · Paraşüt${zm ? ', ' + zm : ''}${D.yuk ? ' · yenileniyor…' : ''}`)}
      <div class="sk7-g">${tablo('al', 'Ödemesi gelen', gelAlt, gel, '7 gün içinde vadesi gelen müşteri çeki ya da senedi yok.', true)}${tablo('ver', 'Ödenecek', ver.length ? num(ver.length) + ' evrak' : '', ver, '7 gün içinde ödenecek çek ya da senet yok.', false)}</div>
      <p class="sp-not">Ödemesi gelen: müşterilerin çek ve senetleri, portföyde ya da tedarikçiye verilmiş olsa da. Çekte son gün vadedir; senette son gün vade (tatilse sonraki iş günü) ve izleyen iki iş günüdür, 15:00'a kadar.</p></div>`;
  }
  const pnYukle = () => { if (!D.yuk && (!D.v ? !PN.denendi : Date.now() - PN.at > 10 * 6e4)) { PN.denendi = true; PN.at = Date.now(); setTimeout(() => yukle(false), 0); } };
  const pnBagla = () => {
    const a = $('#spAra');
    a?.addEventListener('input', () => { clearTimeout(a.t); a.t = setTimeout(() => { PN.ara = a.value; PN.acik = ''; const b = $('#spTablo'); if (b) b.innerHTML = pnTablo(pnOzet()); }, 180); });
  };
  CLK.senetPanel = {
    html: panelSenet, kisa: panelKisa,
    // ilk açılışta ve 10 dakikadan eski veride Paraşüt listesi (sunucuda 10 dk saklanır) arka planda alınır
    bind() { pnYukle(); pnBagla(); }
  };
  const prevAct2 = views.onAct;
  views.onAct = (act, el, e) => {
    const ciz = () => { S.keepScroll = true; render(); };
    if (act === 'spYon') { if (PN.yon !== el.dataset.o) { PN.yon = el.dataset.o; PN.acik = ''; PN.hepsi = false; PN.ara = ''; } ciz(); }
    else if (act === 'spTur') { PN.tur = el.dataset.o; PN.acik = ''; ciz(); }
    else if (act === 'spAc') { PN.acik = PN.acik === el.dataset.id ? '' : el.dataset.id; const b = $('#spTablo'); if (b) b.innerHTML = pnTablo(pnOzet()); else ciz(); }
    else if (act === 'spHepsi') { PN.hepsi = !PN.hepsi; const b = $('#spTablo'); if (b) b.innerHTML = pnTablo(pnOzet()); }
    else if (act === 'spYenile') { D.hata = ''; PN.at = Date.now(); yukle(false); }
    else prevAct2?.(act, el, e);
  };
})();
