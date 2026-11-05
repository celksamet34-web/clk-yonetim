/* CLK Yönetim — Valiz sipariş (celik 05.11.2026: "valiz sipariş gir formu oluştur. tedarikçiye göndermek adına").
   Paraşüt'teki VALİZ ürünleri seri ve boya göre listelenir (stok ve son alış ile); adet ve istenirse renk yazılır,
   tedarikçiye gönderilecek sipariş formu resim (WhatsApp, indir, yazdır) ya da yazı olarak hazırlanır.
   Paraşüt'e ya da siteye hiçbir şey yazılmaz. Siparişler Supabase tedarik_siparis tablosunda (SQL: proje dosyaları sunucu/tedarik-siparis.sql);
   tablo yoksa bu cihazda saklanır. */
(() => {
  const { sb, S, $, esc, tl, num, toast, head, views, render } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/siparis-parasut';
  const TASLAK = 'clk-valiz-siparis', YEREL = 'clk-valiz-siparis-gecmis';
  const TED = [['yefa', 'YEFA SARACİYE', 'Yefa'], ['acun', 'AHMET ACUN', 'Acun'], ['diger', '', 'Diğer']];
  const BOYLAR = ['KÜÇÜK (KABİN)', 'ORTA', 'BÜYÜK', 'BATTAL', 'ORTA + KÜÇÜK', 'BÜYÜK + ORTA', 'SET', 'SET KÖRÜKLÜ', 'MAKYAJ', ''];
  const RENKLER = ['SİYAH', 'LACİVERT', 'GRİ', 'ANTRASİT', 'FÜME', 'KIRMIZI', 'BORDO', 'MOR', 'LİLA', 'PEMBE', 'PUDRA', 'ROSE GOLD', 'MAVİ', 'SAKS', 'TURKUAZ', 'YEŞİL', 'HAKİ', 'TURUNCU', 'SARI', 'BEYAZ', 'KREM', 'BEJ', 'VİZON', 'KAHVE', 'ŞAMPANYA', 'GOLD', 'GÜMÜŞ'];
  const DURUM = { gonderildi: ['Gönderildi', ''], geldi: ['Geldi', 'ok'], iptal: ['İptal', 'bad'] };
  const AD = 'CLK ÇANTA', ADRES = 'Birlik Mah. 873 Sok. No:2/A Esenler / İstanbul', TEL = '0534 077 88 67';
  const bugun = () => new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);
  const trT = g => (g ? g.slice(8, 10) + '.' + g.slice(5, 7) + '.' + g.slice(0, 4) : '');
  const buyuk = s => String(s || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr');
  const sayi = v => { const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10); return Number.isFinite(n) ? Math.min(n, 9999) : 0; };
  const no = id => (id ? 'VS' + String(id).padStart(4, '0') : '');
  const fmt = v => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(v) || 0);

  // Paraşüt adından seri ve boy: "YEFA ÜÇGEN PP KABİN BOY" → YEFA ÜÇGEN PP / KÜÇÜK (KABİN), "YEFA BATTAL BOY ABS" → YEFA ABS / BATTAL
  function coz(ad) {
    let s = buyuk(ad), boy = '';
    const b = s.match(/^YEFA BATTAL BOY (.+)$/);
    if (b) { s = 'YEFA ' + b[1]; boy = 'BATTAL'; }
    else {
      for (const [re, x] of [[/ (KABİN|KÜÇÜK) BOY$/, 'KÜÇÜK (KABİN)'], [/ ORTA KÜÇÜK$/, 'ORTA + KÜÇÜK'], [/ B ?\+ ?O$/, 'BÜYÜK + ORTA'], [/ ORTA BOY$/, 'ORTA'],
        [/ (BÜYÜK BOY|TEK BÜYÜK)$/, 'BÜYÜK'], [/ SET KÖRÜKLÜ$/, 'SET KÖRÜKLÜ'], [/ SET$/, 'SET'], [/ MAKYAJ$/, 'MAKYAJ']]) {
        if (re.test(s)) { s = s.replace(re, ''); boy = x; break; }
      }
    }
    s = s.replace(/^YEFA HAVUÇ ABS$/, 'YEFA ABS HAVUÇ').replace(/[\s-]+$/, '');
    const ted = /^(YEFA|KARE ABS)\b/.test(s) ? 'yefa' : /^ACUN\b/.test(s) ? 'acun' : 'diger';
    return { seri: s || buyuk(ad), boy, ted };
  }
  const boySira = b => { const i = BOYLAR.indexOf(b); return i < 0 ? 99 : i; };

  let taslak = {};
  try { taslak = JSON.parse(localStorage.getItem(TASLAK) || '{}') || {}; } catch {}
  const D = (S.ui.vs ||= {
    urunler: null, zaman: '', yuk: false, hata: '', kaynak: '',
    tedTur: taslak.tedTur || 'yefa', tedAd: taslak.tedAd || '', sec: taslak.sec || {}, ek: taslak.ek || [], not: taslak.not || '', tarih: bugun(), fiyatli: !!taslak.fiyatli,
    duzenle: taslak.duzenle || null, liste: 'ted', ara: '', azalan: false, renkAcik: '', ekForm: null,
    gecmis: null, tablo: null, gYuk: false, kaydediyor: false, uyari: '', hazir: null, gGoster: 8
  });
  const sakla = () => { try { localStorage.setItem(TASLAK, JSON.stringify({ tedTur: D.tedTur, tedAd: D.tedAd, sec: D.sec, ek: D.ek, not: D.not, fiyatli: D.fiyatli, duzenle: D.duzenle })); } catch {} };
  const tedAdi = () => D.tedTur === 'diger' ? buyuk(D.tedAd) : TED.find(t => t[0] === D.tedTur)[1];

  async function sor(govde) {
    const { data } = await sb.auth.getSession();
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.hata) throw new Error(j?.hata || 'Sunucu ' + r.status);
    return j;
  }
  const yok = e => /PGRST20[25]|42P01|42883|does not exist|schema cache|Could not find/i.test((e?.code || '') + ' ' + (e?.message || ''));

  // Paraşüt'teki VALİZ ürünleri: önce valiz_urunler() (personel de okuyabilir), yoksa Siteye gönder'in ürün listesi
  async function yukle() {
    if (D.yuk) return;
    D.yuk = true; D.hata = ''; S.keepScroll = true; render();
    try {
      let l = null;
      const r = await sb.rpc('valiz_urunler');
      if (!r.error && r.data) { l = r.data.urunler || []; D.zaman = r.data.zaman || ''; D.kaynak = 'rpc'; }
      else if (r.error && !yok(r.error)) throw new Error(r.error.message);
      else if (!r.error && !r.data) throw new Error('Valiz listesini görme yetkiniz yok.');
      if (!l) {
        const v = await sor({ islem: 'urunler' });
        l = (v.urunler || []).filter(x => !x[7] && buyuk(x[8]) === 'VALİZ').map(x => [x[0], x[1], x[2], x[4]]);
        D.zaman = v.zaman || ''; D.kaynak = 'eski';
      }
      D.urunler = l.map(([id, ad, alis, stok]) => ({ id: String(id), ad: buyuk(ad), alis: Number(alis) || 0, stok: Number(stok) || 0, ...coz(ad) }));
    } catch (e) { D.hata = e.message; }
    D.yuk = false; S.keepScroll = true; render();
  }
  async function gecmisYukle() {
    if (D.gYuk) return;
    D.gYuk = true;
    const r = await sb.from('tedarik_siparis').select('*').order('id', { ascending: false }).limit(60);
    if (r.error) { D.tablo = false; let l = []; try { l = JSON.parse(localStorage.getItem(YEREL) || '[]'); } catch {} D.gecmis = l; }
    else { D.tablo = true; D.gecmis = r.data; }
    D.gYuk = false; S.keepScroll = true; render();
  }

  // seçilenler: { pid: { adet, renk: { SİYAH: 5 } } } + listede olmayan ek satırlar
  const satirAdet = x => { const r = Object.values(x?.renk || {}).reduce((s, n) => s + (Number(n) || 0), 0); return r || Number(x?.adet) || 0; };
  function kalemler() {
    const u = Object.fromEntries((D.urunler || []).map(x => [x.id, x]));
    const l = [];
    for (const [pid, x] of Object.entries(D.sec)) {
      const a = satirAdet(x); if (!a) continue;
      const p = u[pid] || x.p; if (!p) continue;
      l.push({ pid, ad: p.ad, seri: p.seri, boy: p.boy, adet: a, renkler: Object.entries(x.renk || {}).filter(([, n]) => n > 0), alis: p.alis || 0 });
    }
    for (const e of D.ek) if (e.adet > 0 && buyuk(e.ad)) { const c = coz(e.ad); l.push({ pid: '', ad: buyuk(e.ad), seri: c.seri, boy: c.boy, adet: e.adet, renkler: e.renk ? [[buyuk(e.renk), e.adet]] : [], alis: Number(e.fiyat) || 0, ek: true }); }
    return l.sort((a, b) => a.seri.localeCompare(b.seri, 'tr') || boySira(a.boy) - boySira(b.boy));
  }
  const imza = () => JSON.stringify([tedAdi(), kalemler(), D.not.trim(), D.fiyatli, D.tarih]);
  const toplam = l => ({ adet: l.reduce((s, k) => s + k.adet, 0), tutar: l.reduce((s, k) => s + k.adet * (k.alis || 0), 0), fiyatsiz: l.filter(k => !k.alis).length });
  const seriler = l => { const m = new Map(); for (const k of l) { if (!m.has(k.seri)) m.set(k.seri, []); m.get(k.seri).push(k); } return [...m]; };
  const renkYazi = k => k.renkler.length ? k.renkler.map(([r, n]) => k.renkler.length === 1 && n === k.adet ? r : `${r} ${n}`).join(' · ') : '';

  // ── sipariş formu resmi (1080 px; makbuz/bordro biçiminde) ──
  function resimCiz(o) {
    const W = 1080, P = 56, F = "system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif", fiyatli = o.fiyatli;
    const kol = fiyatli ? { n: P + 6, u: P + 46, r: 372, a: 718, b: 858, t: W - P - 6, rEn: 300, uEn: 300 } : { n: P + 6, u: P + 46, r: 432, a: W - P - 6, rEn: 470, uEn: 360 };
    const olc = document.createElement('canvas').getContext('2d');
    const satirla = (t, z, en, b = 400, ara = ' · ') => {
      olc.font = `${b} ${z}px ${F}`; const out = []; let s = '';
      for (const p of String(t || '').split(ara)) { const d = s ? s + ara + p : p; if (s && olc.measureText(d).width > en) { out.push(s); s = p; } else s = d; }
      if (s) out.push(s); return out.length ? out : [''];
    };
    const gruplar = seriler(o.kalemler);
    const satirlar = [];
    for (const [seri, l] of gruplar) {
      satirlar.push({ tur: 'seri', seri, h: 46 });
      for (const k of l) { const r = satirla(renkYazi(k), 19, kol.rEn - 16); const u = satirla(k.boy || k.ad, 21, kol.uEn - 16, 700, ' '); satirlar.push({ tur: 'k', k, r, u, h: Math.max(r.length, u.length) * 26 + 22 }); }
    }
    const t = toplam(o.kalemler), notS = o.notlar ? satirla(o.notlar.replace(/\s*\n\s*/g, ' '), 19, W - 2 * P - 36, 400, ' ') : [];
    const H = 470 + satirlar.reduce((s, x) => s + x.h, 0) + 90 + (notS.length ? notS.length * 28 + 70 : 0) + 210;
    const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2;
    const g = cv.getContext('2d'); g.scale(2, 2);
    const yaz = (s, x, y, { b = 400, z = 20, r = false, renk = '#1d2433' } = {}) => { g.font = `${b} ${z}px ${F}`; g.fillStyle = renk; g.textAlign = r ? 'right' : 'left'; g.fillText(s, x, y); };
    const kutu = (x, y, w, h, rd, renk, cizgi) => { g.beginPath(); g.roundRect(x, y, w, h, rd); if (renk) { g.fillStyle = renk; g.fill(); } if (cizgi) { g.strokeStyle = cizgi; g.lineWidth = 1.5; g.stroke(); } };
    const kisalt = (s, z, en, b = 400) => { s = String(s || ''); g.font = `${b} ${z}px ${F}`; while (s.length > 4 && g.measureText(s).width > en) s = s.slice(0, -2).trimEnd() + '…'; return s; };
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    yaz(AD, P, 86, { b: 800, z: 38 });
    yaz(ADRES, P, 118, { z: 18, renk: '#5b6475' });
    yaz(TEL, P, 144, { z: 18, renk: '#5b6475' });
    yaz('SİPARİŞ FORMU', W - P, 86, { b: 800, z: 28, r: true });
    yaz('Tarih ' + trT(o.tarih), W - P, 118, { b: 700, z: 19, r: true });
    if (o.no) yaz('No ' + o.no, W - P, 144, { b: 700, z: 19, r: true, renk: '#5b6475' });
    g.fillStyle = '#1d2433'; g.fillRect(P, 168, W - 2 * P, 4);
    yaz('Sayın', P, 214, { z: 17, renk: '#5b6475' });
    yaz(kisalt(o.tedarikci, 30, W - 2 * P, 800), P, 250, { b: 800, z: 30 });
    kutu(P, 278, W - 2 * P, 96, 14, '#1d2433');
    yaz('Aşağıdaki ürünleri sipariş ediyoruz', P + 30, 318, { z: 20, renk: '#fff' });
    yaz(`${gruplar.length} seri · ${o.kalemler.length} kalem`, P + 30, 348, { z: 18, renk: '#c9ced8' });
    yaz(fiyatli && t.tutar ? tl(t.tutar) : `${num(t.adet)} adet`, W - P - 30, 342, { b: 800, z: 40, r: true, renk: '#fff' });
    let y = 426;
    [['#', kol.n], ['ÜRÜN / BOY', kol.u], ['RENK', kol.r]].forEach(([s, x]) => yaz(s, x, y, { b: 700, z: 14, renk: '#5b6475' }));
    yaz('ADET', kol.a, y, { b: 700, z: 14, r: true, renk: '#5b6475' });
    if (fiyatli) { yaz('BİRİM', kol.b, y, { b: 700, z: 14, r: true, renk: '#5b6475' }); yaz('TUTAR', kol.t, y, { b: 700, z: 14, r: true, renk: '#5b6475' }); }
    y += 16;
    let i = 0;
    for (const s of satirlar) {
      if (s.tur === 'seri') {
        kutu(P, y + 8, W - 2 * P, 34, 8, '#f1f3f7');
        yaz(kisalt(s.seri, 18, W - 2 * P - 30, 800), P + 14, y + 32, { b: 800, z: 18 });
        y += s.h; continue;
      }
      const k = s.k, yy = y + 30; i++;
      yaz(String(i), kol.n, yy, { z: 17, renk: '#5b6475' });
      s.u.forEach((u, j) => yaz(u, kol.u, yy + j * 26, { b: 700, z: 21 }));
      s.r.forEach((r, j) => yaz(r, kol.r, yy + j * 26, { z: 19, renk: '#3a4252' }));
      yaz(num(k.adet), kol.a, yy, { b: 800, z: 22, r: true });
      if (fiyatli) { yaz(k.alis ? fmt(k.alis) : '—', kol.b, yy, { z: 18, r: true, renk: '#3a4252' }); yaz(k.alis ? fmt(k.alis * k.adet) : '—', kol.t, yy, { b: 700, z: 18, r: true }); }
      y += s.h;
      g.fillStyle = '#e6e9ef'; g.fillRect(P, y - 2, W - 2 * P, 1);
    }
    g.fillStyle = '#1d2433'; g.fillRect(P, y + 6, W - 2 * P, 2);
    yaz('TOPLAM', kol.u, y + 44, { b: 800, z: 19 });
    yaz(num(t.adet) + ' adet', kol.a, y + 44, { b: 800, z: 22, r: true });
    if (fiyatli && t.tutar) yaz(tl(t.tutar), kol.t, y + 44, { b: 800, z: 20, r: true });
    y += 90;
    if (notS.length) {
      kutu(P, y, W - 2 * P, notS.length * 28 + 50, 12, '#fbf6ec', '#ecdcbc');
      yaz('NOT', P + 18, y + 30, { b: 700, z: 14, renk: '#6a5226' });
      notS.forEach((s, j) => yaz(s, P + 18, y + 58 + j * 28, { z: 19 }));
      y += notS.length * 28 + 70;
    }
    kutu(P, y, W - 2 * P, 112, 12, null, '#dde2ea');
    yaz('TESLİM ADRESİ', P + 18, y + 32, { b: 700, z: 14, renk: '#5b6475' });
    yaz(`${AD} · ${ADRES}`, P + 18, y + 64, { b: 700, z: 19 });
    yaz(`Telefon ${TEL}`, P + 18, y + 92, { z: 18, renk: '#3a4252' });
    yaz('Siparişi teyit edip teslim tarihini bildirmenizi rica ederiz.', P, y + 152, { z: 17, renk: '#5b6475' });
    return new Promise(res => cv.toBlob(res, 'image/png'));
  }
  function metin(o) {
    const t = toplam(o.kalemler);
    const bas = `${AD} – sipariş formu${o.no ? ' ' + o.no : ''} (${trT(o.tarih)})\nSayın ${o.tedarikci},\naşağıdaki ürünleri sipariş ediyoruz:\n`;
    const govde = seriler(o.kalemler).map(([seri, l]) => `\n*${seri}*\n` + l.map(k => `• ${k.boy || k.ad}: ${num(k.adet)} adet${k.renkler.length ? ` (${renkYazi(k).replace(/ · /g, ', ')})` : ''}${o.fiyatli && k.alis ? ` × ${fmt(k.alis)} ₺` : ''}`).join('\n')).join('\n');
    return bas + govde + `\n\nToplam: ${num(t.adet)} adet${o.fiyatli && t.tutar ? ` · ${tl(t.tutar)}` : ''}` + (o.notlar ? `\nNot: ${o.notlar}` : '') + `\n\nTeslim: ${AD}, ${ADRES} · ${TEL}\nSiparişi teyit edip teslim tarihini bildirmenizi rica ederiz.`;
  }
  const dosya = o => `siparis-${(o.no || trT(o.tarih)).replace(/\./g, '-')}-${buyuk(o.tedarikci).toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]+/gi, '-').replace(/^-|-$/g, '')}.png`;

  async function onizle(o) {
    const eski = D.hazir?.url; if (eski) setTimeout(() => URL.revokeObjectURL(eski), 6e4);
    const blob = await resimCiz(o);
    D.hazir = { o, blob, url: URL.createObjectURL(blob), imza: imza() };
    S.keepScroll = true; render();
    setTimeout(() => $('#vsHazir')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  async function hazirla() {
    const l = kalemler(), ted = tedAdi();
    if (!ted) { D.uyari = 'Tedarikçi adını yazın.'; S.keepScroll = true; render(); return; }
    if (!l.length) { D.uyari = 'En az bir ürüne adet yazın.'; S.keepScroll = true; render(); return; }
    const t = toplam(l);
    const kayit = { tedarikci: ted, tarih: D.tarih || bugun(), kalemler: l, notlar: D.not.trim() || null, fiyatli: D.fiyatli, adet: t.adet, tutar: Math.round(t.tutar * 100) / 100 };
    D.kaydediyor = true; D.uyari = ''; S.keepScroll = true; render();
    let id = null;
    if (D.tablo !== false) {
      const kim = S.yetki?.ad || S.user?.email || '';
      let r = D.duzenle && /^\d+$/.test(String(D.duzenle))
        ? await sb.from('tedarik_siparis').update({ ...kayit, guncel: new Date().toISOString() }).eq('id', D.duzenle).select('id').maybeSingle()
        : null;
      if (!r || (!r.error && !r.data)) r = await sb.from('tedarik_siparis').insert({ ...kayit, kim }).select('id').single();
      if (!r.error && r.data) { id = r.data.id; D.tablo = true; }
      else if (r.error && !yok(r.error)) { D.uyari = 'Sipariş kaydedilemedi: ' + r.error.message; D.kaydediyor = false; S.keepScroll = true; render(); return; }
      else D.tablo = false;
    }
    if (!id) { // tablo yok: bu cihazda saklanır
      let g = []; try { g = JSON.parse(localStorage.getItem(YEREL) || '[]'); } catch {}
      const yid = D.duzenle && String(D.duzenle).startsWith('y') ? D.duzenle : 'y' + Date.now();
      g = [{ id: yid, ...kayit, durum: 'gonderildi', olusturma: new Date().toISOString() }, ...g.filter(x => x.id !== yid)].slice(0, 40);
      try { localStorage.setItem(YEREL, JSON.stringify(g)); } catch {}
      id = yid;
    }
    D.duzenle = id; sakla();
    D.kaydediyor = false; D.gecmis = null;
    await onizle({ ...kayit, id, no: /^\d+$/.test(String(id)) ? no(id) : '' });
    toast(/^\d+$/.test(String(id)) ? `Sipariş ${no(id)} kaydedildi` : 'Sipariş bu cihazda kaydedildi');
  }

  function formuTemizle() {
    D.sec = {}; D.ek = []; D.not = ''; D.duzenle = null; D.uyari = ''; D.renkAcik = ''; D.ekForm = null; D.tarih = bugun();
    const eski = D.hazir?.url; if (eski) setTimeout(() => URL.revokeObjectURL(eski), 6e4);
    D.hazir = null; sakla();
  }
  // geçmişten aç: forma yüklenir (düzenle = aynı sipariş, kopya = yeni sipariş)
  function forma(s, kopya) {
    formuTemizle();
    const t = TED.find(x => x[1] && x[1] === s.tedarikci);
    D.tedTur = t ? t[0] : 'diger'; D.tedAd = t ? '' : s.tedarikci;
    for (const k of s.kalemler || []) {
      if (k.ek || !k.pid) { D.ek.push({ id: 'e' + Math.random().toString(36).slice(2, 8), ad: k.ad, renk: k.renkler?.[0]?.[0] || '', adet: k.adet, fiyat: k.alis || '' }); continue; }
      const renk = Object.fromEntries((k.renkler || []).filter(([, n]) => n > 0));
      D.sec[k.pid] = { adet: Object.keys(renk).length ? 0 : k.adet, renk, p: { ad: k.ad, seri: k.seri, boy: k.boy, alis: k.alis, stok: 0 } };
    }
    D.not = s.notlar || ''; D.fiyatli = !!s.fiyatli;
    if (!kopya) { D.duzenle = s.id; D.tarih = s.tarih || bugun(); }
    sakla();
  }

  // ── görünüm ──
  function urunListesi() {
    if (D.hata && !D.urunler) return `<div class="card empty"><h3>Valizler okunamadı</h3><p>${esc(D.hata)}</p><button class="btn dark" data-act="vsYenile">Tekrar dene</button></div>`;
    if (!D.urunler) return `<div class="card"><div class="skel" style="height:60px"></div><div class="skel" style="height:320px;margin-top:14px"></div></div>`;
    const q = buyuk(D.ara);
    let l = D.urunler.filter(u => (D.liste === 'hepsi' || u.ted === D.tedTur) && (!q || u.ad.includes(q)) && (!D.azalan || u.stok <= 2 || satirAdet(D.sec[u.id])));
    const m = new Map();
    for (const u of l.sort((a, b) => a.seri.localeCompare(b.seri, 'tr') || boySira(a.boy) - boySira(b.boy))) { if (!m.has(u.seri)) m.set(u.seri, []); m.get(u.seri).push(u); }
    const bos = !m.size ? `<div class="card empty"><h3>Ürün yok</h3><p>${D.liste === 'ted' ? 'Bu tedarikçiye bağlı valiz bulunamadı. "Bütün valizler"i seçin ya da aşağıdan listede olmayan ürün ekleyin.' : 'Aramaya uyan valiz yok.'}</p></div>` : '';
    return bos + [...m].map(([seri, ul]) => {
      const sa = ul.reduce((s, u) => s + satirAdet(D.sec[u.id]), 0);
      return `<section class="card vs-seri"><div class="vs-seri-h"><h3>${esc(seri)}</h3>${sa ? `<span class="vs-rozet">${num(sa)} adet</span>` : ''}</div>${ul.map(satirHtml).join('')}</section>`;
    }).join('');
  }
  function satirHtml(u) {
    const x = D.sec[u.id] || {}, renk = Object.entries(x.renk || {}).filter(([, n]) => n > 0), a = satirAdet(x), acik = D.renkAcik === u.id;
    const stok = `<span class="vs-stok ${u.stok <= 0 ? 'bad' : u.stok <= 2 ? 'warn' : ''}">Stok ${num(u.stok)}</span>`;
    const adet = renk.length
      ? `<button class="vs-toplam" data-act="vsRenkAc" data-pid="${u.id}">${num(a)} adet</button>`
      : `<div class="vs-adet"><button data-act="vsEksi" data-pid="${u.id}" aria-label="Azalt">−</button><input id="vsA_${u.id}" class="vs-n" data-pid="${u.id}" inputmode="numeric" value="${a || ''}" placeholder="0" aria-label="${esc(u.ad)} adet"><button data-act="vsArti" data-pid="${u.id}" aria-label="Artır">+</button></div>`;
    return `<div class="vs-sat ${a ? 'secili' : ''}">
      <div class="vs-bilgi"><b>${esc(u.boy || u.ad)}</b><span>${stok}${u.alis ? `<span>Son alış ${fmt(u.alis)} ₺</span>` : '<span>Alış yok</span>'}<button class="vs-renk-dug" data-act="vsRenkAc" data-pid="${u.id}" aria-expanded="${acik}">${renk.length ? esc(renk.map(([r, n]) => `${r} ${n}`).join(' · ')) : 'Renk yaz'}</button></span></div>
      ${adet}
      ${acik ? renkPanel(u.id, Object.fromEntries(renk)) : ''}
    </div>`;
  }
  function renkPanel(pid, renk) {
    const onceki = new Set();
    for (const s of D.gecmis || []) for (const k of s.kalemler || []) for (const [r] of k.renkler || []) onceki.add(r);
    const liste = [...new Set([...Object.keys(renk), ...onceki, ...RENKLER])];
    return `<div class="vs-renk">
      <p class="hint">Renge dokunun, her dokunuş 1 adet ekler. Renk yazınca satırın adedi renklerin toplamı olur.</p>
      ${Object.keys(renk).length ? `<div class="vs-renk-sec">${Object.entries(renk).map(([r, n]) => `<span class="vs-renk-s"><b>${esc(r)}</b><button data-act="vsRenkEksi" data-pid="${pid}" data-r="${esc(r)}" aria-label="${esc(r)} azalt">−</button><i>${n}</i><button data-act="vsRenkArti" data-pid="${pid}" data-r="${esc(r)}" aria-label="${esc(r)} artır">+</button></span>`).join('')}</div>` : ''}
      <div class="vs-renkler">${liste.map(r => `<button class="chip" data-act="vsRenkArti" data-pid="${pid}" data-r="${esc(r)}" aria-pressed="${!!renk[r]}">${esc(r)}${renk[r] ? ` <b>${renk[r]}</b>` : ''}</button>`).join('')}</div>
      <div class="vs-renk-yeni"><input id="vsRenkYeni" placeholder="Başka renk (örn. ZÜMRÜT)" autocomplete="off"><button class="btn" data-act="vsRenkYeni" data-pid="${pid}">Ekle</button><button class="btn" data-act="vsRenkKapat">Tamam</button></div>
    </div>`;
  }
  function ekKart() {
    const f = D.ekForm;
    return `<section class="card vs-ek"><div class="vs-seri-h"><h3>Listede olmayan ürün</h3>${f ? '' : '<button class="btn" data-act="vsEkAc">+ Ekle</button>'}</div>
      ${D.ek.map(e => `<div class="vs-ek-s"><span><b>${esc(e.ad)}</b>${e.renk ? ` · ${esc(e.renk)}` : ''}${e.fiyat ? ` · ${fmt(e.fiyat)} ₺` : ''}</span><b>${num(e.adet)} adet</b><button class="vs-sil" data-act="vsEkSil" data-id="${e.id}" aria-label="Sil">✕</button></div>`).join('')}
      ${f ? `<div class="vs-ek-form">
        <label class="f vs-ek-ad"><span>Ürün</span><input id="vsEkAd" value="${esc(f.ad)}" placeholder="Örn. YEFA ÜÇGEN PP BÜYÜK BOY"></label>
        <label class="f"><span>Renk</span><input id="vsEkRenk" value="${esc(f.renk)}" placeholder="İsteğe bağlı"></label>
        <label class="f"><span>Adet</span><input id="vsEkAdet" inputmode="numeric" value="${esc(f.adet)}"></label>
        <label class="f"><span>Birim fiyat</span><input id="vsEkFiyat" inputmode="decimal" value="${esc(f.fiyat)}" placeholder="İsteğe bağlı"></label>
        <div class="vs-ek-dug"><button class="btn dark" data-act="vsEkKaydet">Ekle</button><button class="btn" data-act="vsEkKapat">Vazgeç</button></div>
      </div>` : !D.ek.length ? '<p class="hint" style="margin:6px 0 0">Paraşüt\'te açılmamış yeni bir model ya da boy için adını yazarak ekleyin.</p>' : ''}
    </section>`;
  }
  function tedKart() {
    const tedL = TED.map(([k, , etiket]) => `<button data-act="vsTed" data-t="${k}" aria-pressed="${D.tedTur === k}">${etiket}</button>`).join('');
    const once = [...new Set((D.gecmis || []).map(s => s.tedarikci).filter(x => x && !TED.some(t => t[1] === x)))];
    return `<section class="card vs-ted">
      <div class="gd-adim"><span>1</span><h3>Tedarikçi</h3></div>
      <div class="vs-ted-s"><div class="gd-seg">${tedL}</div>
      ${D.tedTur === 'diger' ? `<input id="vsTedAd" list="vsTedListe" value="${esc(D.tedAd)}" placeholder="Firma adı" autocomplete="off" aria-label="Tedarikçi adı"><datalist id="vsTedListe">${once.map(x => `<option value="${esc(x)}">`).join('')}</datalist>` : `<b>${esc(tedAdi())}</b>`}</div>
    </section>`;
  }
  function ozetHtml() {
    const l = kalemler(), t = toplam(l);
    return `<div class="vs-oz">
      <div class="gd-adim"><span>2</span><h3>Sipariş</h3></div>
      ${l.length ? `<ul class="vs-oz-l">${seriler(l).map(([seri, kl]) => `<li><b>${esc(seri)}</b>${kl.map(k => `<div><span>${esc(k.boy || (k.ek ? 'yeni ürün' : k.ad))}${k.renkler.length ? ` <em>${esc(renkYazi(k))}</em>` : ''}</span><i>${num(k.adet)}</i></div>`).join('')}</li>`).join('')}</ul>
        <div class="vs-oz-t"><span>${l.length} kalem</span><b>${num(t.adet)} adet</b></div>
        ${t.tutar ? `<div class="vs-oz-t ince"><span>Son alışlarla${t.fiyatsiz ? ` (${t.fiyatsiz} kalemde alış yok)` : ''}</span><span>${tl(t.tutar)}</span></div>` : ''}`
        : '<p class="hint" style="margin:0">Listeden ürünlere adet yazın.</p>'}
      <div class="gd-adim"><span>3</span><h3>Gönder</h3></div>
      <label class="f"><span>Tarih</span><input type="date" id="vsTarih" value="${esc(D.tarih)}"></label>
      <label class="f"><span>Not (tedarikçiye)</span><textarea id="vsNot" rows="2" placeholder="Örn. Cuma'ya kadar teslim, setler karışık renk">${esc(D.not)}</textarea></label>
      <label class="vs-tik"><input type="checkbox" id="vsFiyatli" ${D.fiyatli ? 'checked' : ''}> Fiyatlar formda yazılsın (son alış)</label>
      ${D.uyari ? `<p class="msg err" style="margin:0">${esc(D.uyari)}</p>` : ''}
      <button class="btn gold vs-hazirla" data-act="vsHazirla" ${D.kaydediyor ? 'disabled' : ''}>${D.kaydediyor ? 'Hazırlanıyor…' : D.duzenle ? 'Formu güncelle' : 'Sipariş formunu hazırla'}</button>
      ${l.length || D.duzenle ? `<button class="btn vs-temizle" data-act="vsTemizle">${D.duzenle ? 'Yeni sipariş başlat' : 'Formu temizle'}</button>` : ''}
      ${D.duzenle ? `<p class="hint" style="margin:0">${/^\d+$/.test(String(D.duzenle)) ? no(D.duzenle) + ' düzenleniyor' : 'Kayıtlı sipariş düzenleniyor'}; hazırlayınca aynı sipariş güncellenir.</p>` : ''}
    </div>`;
  }
  function hazirKart() {
    const h = D.hazir; if (!h) return '';
    return `<section class="card vs-hazir" id="vsHazir">
      <div class="vs-seri-h"><h3>Sipariş formu hazır${h.o.no ? ' · ' + h.o.no : ''}</h3><button class="btn" data-act="vsHazirKapat">Kapat</button></div>
      <p class="hint">${esc(h.o.tedarikci)} · ${num(toplam(h.o.kalemler).adet)} adet. Resmi WhatsApp'tan tedarikçiye gönderin ya da yazı olarak kopyalayın.</p>
      <div class="vs-dug"><button class="btn gold" data-act="vsPaylas">WhatsApp'ta paylaş</button><button class="btn" data-act="vsKopyala">Yazı olarak kopyala</button><button class="btn" data-act="vsIndir">İndir</button><button class="btn" data-act="vsYazdir">Yazdır</button></div>
      <img class="vs-resim" src="${h.url}" alt="Sipariş formu">
    </section>`;
  }
  function gecmisKart() {
    if (D.gecmis === null) return '';
    const l = D.gecmis.slice(0, D.gGoster);
    return `<section class="card vs-gecmis"><div class="vs-seri-h"><h3>Son siparişler</h3>${D.tablo === false ? '<span class="vs-rozet">bu cihazda</span>' : ''}</div>
      ${!l.length ? '<p class="hint" style="margin:6px 0 0">Henüz sipariş yok.</p>' : l.map(s => {
        const [dy, dk] = DURUM[s.durum] || DURUM.gonderildi;
        return `<div class="vs-g">
          <div class="vs-g-b"><b>${esc(no(/^\d+$/.test(String(s.id)) ? s.id : '') || trT(s.tarih))}</b><span>${trT(s.tarih)} · ${esc(s.tedarikci)} · ${num(s.adet)} adet${s.fiyatli && Number(s.tutar) ? ' · ' + tl(s.tutar) : ''}</span>
            <span class="vs-g-k">${esc(seriler(s.kalemler || []).map(([seri, kl]) => seri.replace(/^YEFA /, '') + ' ' + kl.reduce((t, k) => t + k.adet, 0)).join(', '))}</span></div>
          <span class="vs-durum ${dk}">${dy}</span>
          <div class="vs-g-d"><button class="btn" data-act="vsGAc" data-id="${s.id}">Formu aç</button><button class="btn" data-act="vsGDuzenle" data-id="${s.id}">Düzenle</button><button class="btn" data-act="vsGKopya" data-id="${s.id}">Tekrarla</button>
            ${s.durum !== 'geldi' ? `<button class="btn" data-act="vsGDurum" data-id="${s.id}" data-d="geldi">Geldi</button>` : ''}${s.durum !== 'iptal' ? `<button class="btn" data-act="vsGDurum" data-id="${s.id}" data-d="iptal">İptal</button>` : `<button class="btn" data-act="vsGDurum" data-id="${s.id}" data-d="gonderildi">Geri al</button>`}</div>
        </div>`;
      }).join('')}
      ${D.gecmis.length > D.gGoster ? '<button class="btn" data-act="vsGDaha" style="margin-top:10px">Daha fazla</button>' : ''}
    </section>`;
  }
  function altBar() {
    const t = toplam(kalemler());
    if (!t.adet) return '';
    const paylas = D.hazir && D.hazir.imza === imza();
    return `<div class="vs-alt"><span><b>${num(t.adet)} adet</b> · ${esc(tedAdi() || 'tedarikçi seçin')}</span>${paylas ? '<button class="btn gold" data-act="vsPaylas">WhatsApp\'ta paylaş</button>' : `<button class="btn gold" data-act="vsHazirla" ${D.kaydediyor ? 'disabled' : ''}>Formu hazırla</button>`}</div>`;
  }

  views.valizsiparis = () => {
    if (!D.urunler && !D.yuk && !D.hata) yukle();
    if (D.gecmis === null && !D.gYuk) gecmisYukle();
    const filtre = `<div class="vs-filtre">
      <div class="gd-seg"><button data-act="vsListe" data-l="ted" aria-pressed="${D.liste === 'ted'}">${esc(TED.find(t => t[0] === D.tedTur)[2])} ürünleri</button><button data-act="vsListe" data-l="hepsi" aria-pressed="${D.liste === 'hepsi'}">Bütün valizler</button></div>
      <button class="chip" data-act="vsAzalan" aria-pressed="${D.azalan}">Stoğu azalan (≤2)</button>
      <input type="search" id="vsAra" value="${esc(D.ara)}" placeholder="Ara: üçgen, set, kabin…" autocomplete="off">
    </div>`;
    const kaynak = D.urunler ? `<p class="hint vs-kaynak">Paraşüt'teki VALİZ kategorisi, ${num(D.urunler.length)} ürün${D.zaman ? ` · liste ${new Date(D.zaman).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}. Stok ve son alış Paraşüt'ten; Paraşüt'e ya da siteye bir şey yazılmaz.</p>` : '';
    return `${head('Alış', 'Valiz sipariş', 'Tedarikçiye gönderilecek valiz siparişini hazırlayın: seri ve boya adet, istenirse renk yazın; form resim ya da yazı olarak WhatsApp\'tan gider.', `<button class="btn" data-act="vsYenile" ${D.yuk ? 'disabled' : ''}>${D.yuk ? 'Okunuyor…' : 'Yenile'}</button>`)}
      ${hazirKart()}
      <div class="vs-ust">
        <div class="vs-sol">${tedKart()}${filtre}${kaynak}${urunListesi()}${ekKart()}</div>
        <div class="vs-sag"><div class="card">${ozetHtml()}</div>${gecmisKart()}</div>
      </div>
      ${altBar()}`;
  };

  const ciz = () => { sakla(); S.keepScroll = true; render(); };
  const ozetCiz = () => { // yazarken yalnız özet ve alt çubuk yenilenir (odak kaybolmasın)
    sakla();
    const o = $('.vs-sag > .card'); if (o && !o.contains(document.activeElement)) o.innerHTML = ozetHtml();
    const a = $('.vs-alt'), yeni = altBar();
    if (a) { if (yeni) a.outerHTML = yeni; else a.remove(); } else if (yeni) $('.vs-ust')?.insertAdjacentHTML('afterend', yeni);
  };
  views.bind_valizsiparis = () => {
    $('#vsAra')?.addEventListener('input', e => { D.ara = e.target.value; S.keepScroll = true; render(); });
    document.querySelectorAll('.vs-n').forEach(i => i.addEventListener('input', e => {
      const pid = e.target.dataset.pid, n = sayi(e.target.value);
      const x = D.sec[pid] ||= {}; x.adet = n; x.renk = {};
      const u = (D.urunler || []).find(y => y.id === pid); if (u) x.p = { ad: u.ad, seri: u.seri, boy: u.boy, alis: u.alis };
      if (!n) delete D.sec[pid];
      e.target.closest('.vs-sat')?.classList.toggle('secili', n > 0);
      ozetCiz();
    }));
    document.querySelectorAll('.vs-n').forEach(i => i.addEventListener('change', () => { S.keepScroll = true; render(); }));
    $('#vsTedAd')?.addEventListener('input', e => { D.tedAd = e.target.value; D.uyari = ''; sakla(); const a = $('.vs-alt span'); if (a) a.innerHTML = `<b>${num(toplam(kalemler()).adet)} adet</b> · ${esc(tedAdi() || 'tedarikçi seçin')}`; });
    $('#vsNot')?.addEventListener('input', e => { D.not = e.target.value; sakla(); });
    $('#vsTarih')?.addEventListener('change', e => { D.tarih = e.target.value || bugun(); sakla(); });
    $('#vsFiyatli')?.addEventListener('change', e => { D.fiyatli = e.target.checked; sakla(); });
    $('#vsRenkYeni')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('[data-act="vsRenkYeni"]')?.click(); } });
    const f = D.ekForm;
    if (f) [['vsEkAd', 'ad'], ['vsEkRenk', 'renk'], ['vsEkAdet', 'adet'], ['vsEkFiyat', 'fiyat']].forEach(([id, k]) => $('#' + id)?.addEventListener('input', e => { f[k] = e.target.value; }));
  };

  const urunP = pid => { const u = (D.urunler || []).find(y => y.id === pid); return u ? { ad: u.ad, seri: u.seri, boy: u.boy, alis: u.alis } : D.sec[pid]?.p; };
  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (!act.startsWith('vs')) return prevAct?.(act, el, e);
    const pid = el.dataset.pid;
    if (act === 'vsYenile') { D.urunler = null; D.hata = ''; D.gecmis = null; yukle(); gecmisYukle(); }
    else if (act === 'vsTed') { D.tedTur = el.dataset.t; D.uyari = ''; ciz(); if (D.tedTur === 'diger') setTimeout(() => $('#vsTedAd')?.focus(), 50); }
    else if (act === 'vsListe') { D.liste = el.dataset.l; ciz(); }
    else if (act === 'vsAzalan') { D.azalan = !D.azalan; ciz(); }
    else if (act === 'vsArti' || act === 'vsEksi') {
      const x = D.sec[pid] ||= {}; x.adet = Math.max(0, (Number(x.adet) || 0) + (act === 'vsArti' ? 1 : -1)); x.renk = {}; x.p = urunP(pid);
      if (!x.adet) delete D.sec[pid];
      ciz();
    }
    else if (act === 'vsRenkAc') { D.renkAcik = D.renkAcik === pid ? '' : pid; ciz(); }
    else if (act === 'vsRenkKapat') { D.renkAcik = ''; ciz(); }
    else if (act === 'vsRenkArti' || act === 'vsRenkEksi' || act === 'vsRenkYeni') {
      const r = act === 'vsRenkYeni' ? buyuk($('#vsRenkYeni')?.value) : el.dataset.r;
      if (!r) return;
      const x = D.sec[pid] ||= {}; x.p = urunP(pid); x.renk ||= {};
      // renk ilk kez yazılıyorsa satırdaki adet ilk renge geçmez; renkler toplamı satırın adedi olur
      x.renk[r] = Math.max(0, (Number(x.renk[r]) || 0) + (act === 'vsRenkEksi' ? -1 : 1));
      if (!x.renk[r]) delete x.renk[r];
      x.adet = 0;
      if (!Object.keys(x.renk).length) delete D.sec[pid];
      ciz();
      if (act === 'vsRenkYeni') setTimeout(() => $('#vsRenkYeni')?.focus(), 30);
    }
    else if (act === 'vsEkAc') { D.ekForm = { ad: '', renk: '', adet: '1', fiyat: '' }; ciz(); setTimeout(() => $('#vsEkAd')?.focus(), 50); }
    else if (act === 'vsEkKapat') { D.ekForm = null; ciz(); }
    else if (act === 'vsEkKaydet') {
      const f = D.ekForm, a = sayi(f.adet), fi = Number(String(f.fiyat || '').replace(/\./g, '').replace(',', '.')) || 0;
      if (!buyuk(f.ad) || !a) { toast('Ürün adı ve adet yazın'); return; }
      D.ek.push({ id: 'e' + Math.random().toString(36).slice(2, 8), ad: buyuk(f.ad), renk: buyuk(f.renk), adet: a, fiyat: fi || '' });
      D.ekForm = null; ciz();
    }
    else if (act === 'vsEkSil') { D.ek = D.ek.filter(x => x.id !== el.dataset.id); ciz(); }
    else if (act === 'vsHazirla') hazirla();
    else if (act === 'vsTemizle') { formuTemizle(); ciz(); }
    else if (act === 'vsHazirKapat') { const eski = D.hazir?.url; if (eski) setTimeout(() => URL.revokeObjectURL(eski), 6e4); D.hazir = null; ciz(); }
    else if (act === 'vsPaylas' && D.hazir) CLK.belge?.paylas(D.hazir.blob, D.hazir.url, dosya(D.hazir.o), 'Sipariş formu');
    else if (act === 'vsIndir' && D.hazir) CLK.belge?.indir(D.hazir.url, dosya(D.hazir.o));
    else if (act === 'vsYazdir' && D.hazir) CLK.belge?.yazdir(D.hazir.url, 'Sipariş formu');
    else if (act === 'vsKopyala' && D.hazir) CLK.belge?.kopyala(metin(D.hazir.o), 'Sipariş');
    else if (act === 'vsGDaha') { D.gGoster += 20; ciz(); }
    else if (act.startsWith('vsG')) {
      const s = (D.gecmis || []).find(x => String(x.id) === el.dataset.id); if (!s) return;
      if (act === 'vsGAc') onizle({ ...s, no: /^\d+$/.test(String(s.id)) ? no(s.id) : '' });
      else if (act === 'vsGDuzenle' || act === 'vsGKopya') { forma(s, act === 'vsGKopya'); ciz(); window.scrollTo({ top: 0, behavior: 'smooth' }); toast(act === 'vsGKopya' ? 'Sipariş forma kopyalandı; değiştirip yeniden hazırlayın' : 'Sipariş forma yüklendi'); }
      else if (act === 'vsGDurum') durum(s, el.dataset.d);
    }
  };
  async function durum(s, d) {
    if (/^\d+$/.test(String(s.id))) {
      const r = await sb.from('tedarik_siparis').update({ durum: d, guncel: new Date().toISOString() }).eq('id', s.id);
      if (r.error) { toast('Değiştirilemedi: ' + r.error.message); return; }
    } else {
      let g = []; try { g = JSON.parse(localStorage.getItem(YEREL) || '[]'); } catch {}
      g = g.map(x => (x.id === s.id ? { ...x, durum: d } : x));
      try { localStorage.setItem(YEREL, JSON.stringify(g)); } catch {}
    }
    s.durum = d; toast(`${no(/^\d+$/.test(String(s.id)) ? s.id : '') || 'Sipariş'}: ${DURUM[d][0]}`); ciz();
  }
  CLK.valizSiparis = { coz, metin, resimCiz };
})();
