/* CLK Yönetim — Senet gir (celik 01.11.2026: "senet gir işlemini yapabilir misin, hem sıra no veririz"; "çek girişinde açıklamaya senet yazıyoruz").
   Senet Paraşüt'e çek olarak açılır: bankası "Diğer", banka adı SENET, numarası panelin verdiği sıra no (SN0001, SN0002…).
   Müşteriden alınan senet müşterinin carisinden düşer ve sitedeki cariye tahsilat olarak yazılır; tedarikçiye verilen senet ödenecek olur.
   Birden çok senet (taksit) bir kerede girilir. Paraşüt'te hiçbir kayıt silinmez ya da değiştirilmez (sunucu: gider-cek). */
(() => {
  const { sb, S, $, $$, esc, tl, tl2, num, dt, dtt, toast, head, views, render, araKutu, araSec, ARA, go } = CLK;
  const FN = 'https://prkzzaqinfeptmmbkqsd.supabase.co/functions/v1/gider-cek';
  const EN_COK = 12;
  const bugun = () => new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);
  const gunEkle = (g, n) => new Date(Date.parse(g + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const aySonuMu = g => new Date(Date.parse(g + 'T00:00:00Z') + 864e5).getUTCDate() === 1;
  // aya göre ilerler; ilk vade ay sonuysa hepsi ay sonu olur (30.11 → 31.12 → 31.01 → 28.02)
  const ayEkle = (g, n, sonu) => {
    const y = +g.slice(0, 4), m = +g.slice(5, 7) - 1 + n, son = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, sonu ? son : Math.min(+g.slice(8, 10), son))).toISOString().slice(0, 10);
  };
  const aySonu = g => ayEkle(g, 0, true);
  const bekle = ms => new Promise(s => setTimeout(s, ms));
  const uuid = () => (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^a-z0-9-]/gi, '');
  const para = v => {
    let s = String(v ?? '').replace(/[\s₺TLtl]/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    return Number.isFinite(n) && n > 0 && n < 1e8 ? Math.round(n * 100) / 100 : 0;
  };
  const yaz = n => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const siraMetni = n => 'SN' + String(n).padStart(4, '0');
  const senetMi = c => /sen+e?t|seet/i.test(c.bankaAd) || /senet/i.test(c.seri) || (c.banka === 'OTHER' && !c.bankaAd);

  const yeniForm = (o = {}) => ({ yon: o.yon || 'alinan', kisi: null, adet: 1, mod: 'her', tutar: '', ilk: o.ilk || aySonu(gunEkle(bugun(), 28)), aralik: 'ay', tarih: o.tarih || bugun(), aciklama: '', satirlar: [] });
  const D = (S.ui.sn ||= { k: null, c: null, yuk: false, hata: '', f: yeniForm(), kaydediyor: false, onay: false, sonuc: null, uyari: '', goster: 15 });

  async function sor(govde) {
    const { data } = await sb.auth.getSession();
    let r;
    try { r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session?.access_token }, body: JSON.stringify(govde) }); }
    catch { throw Object.assign(new Error('Bağlantı koptu.'), { ag: true }); }
    const j = await r.json().catch(() => null);
    if (!j) throw Object.assign(new Error('Sunucu yanıt vermedi (' + r.status + ').'), { ag: r.status >= 500 });
    if (!r.ok || j.hata) throw new Error(j.hata || 'Sunucu ' + r.status);
    return j;
  }
  // bağlantı koparsa aynı istek numarasıyla tekrar sorulur: sunucu aynı senedi ikinci kez açmaz
  async function yazIstek(govde) {
    let son;
    for (let i = 0; i < 3; i++) {
      try { return await sor(govde); } catch (e) { son = e; if (!e.ag) break; await bekle(3000 * (i + 1)); }
    }
    throw son;
  }

  async function yukle(yenile) {
    if (D.yuk) return;
    D.yuk = true; D.hata = ''; S.keepScroll = true; render();
    const iki = await Promise.allSettled([
      sor({ islem: 'senet_kaynak', yenile: !!yenile }).then(k => { D.k = k; S.keepScroll = true; render(); }),
      // açık senetleri göstermek ve aynı senedi iki kez girmemek için Paraşüt'teki çek/senet listesi (10 dakika saklanır)
      sor({ islem: 'cekler', yenile: !!yenile }).then(c => { D.c = c; if (S.ui.cs) S.ui.cs.v = c; S.keepScroll = true; render(); })
    ]);
    const h = iki.find(x => x.status === 'rejected');
    if (h) D.hata = h.reason?.message || 'Veri alınamadı';
    D.yuk = false; S.keepScroll = true; render();
  }

  /* ---------- taksitler ---------- */
  function dagit() {
    const f = D.f, n = Math.min(EN_COK, Math.max(1, Number(f.adet) || 1)), t = para(f.tutar), eski = f.satirlar;
    const kurus = f.mod === 'toplam' ? Math.round(t * 100) : 0;
    const parca = f.mod === 'toplam' ? Math.floor(kurus / n) : 0;
    f.satirlar = Array.from({ length: n }, (_, i) => {
      const vade = !f.ilk ? '' : f.aralik === 'ay' ? ayEkle(f.ilk, i, aySonuMu(f.ilk)) : gunEkle(f.ilk, i * (f.aralik === '15' ? 15 : 7));
      const tu = !t ? '' : f.mod === 'her' ? yaz(t) : yaz((i === n - 1 ? kurus - parca * (n - 1) : parca) / 100);
      return { no: i + 1, vade, tutar: tu, sira: eski[i]?.sira || '' };
    });
  }
  const satirlar = () => D.f.satirlar.map(s => ({ ...s, t: para(s.tutar) }));
  const toplamAdet = () => Math.max(Number(D.f.adet) || 1, ...D.f.satirlar.map(s => s.no));
  // sıra no önizlemesi: boş bırakılanlara sıradaki numaralar verilir (kaydederken sunucu kesinleştirir)
  function siraOnizle() {
    let n = parseInt(String(D.k?.sira || '').replace(/\D/g, ''), 10) || 1;
    return D.f.satirlar.map(s => (s.sira.trim() ? s.sira.trim() : siraMetni(n++)));
  }
  const kisiler = () => (D.f.yon === 'alinan' ? D.k?.musteriler : D.k?.tedarikciler) || [];
  // seçilen kişinin Paraşüt'teki açık senet ve çekleri
  function acikEvrak() {
    const k = D.f.kisi; if (!k || !D.c) return null;
    const l = (D.c.cekler || []).filter(c => D.f.yon === 'alinan' ? c.kimdenId === k.id && c.yon === 'alinan' && c.kalan > 0.009 : c.kimeId === k.id && c.yon === 'verilen' && c.kalan > 0.009);
    const ciro = D.f.yon === 'alinan' ? (D.c.cekler || []).filter(c => c.kimdenId === k.id && c.yon === 'ciro' && c.vade >= bugun()) : [];
    return { l, ciro };
  }
  function ayniVar() {
    const k = D.f.kisi; if (!k || !D.c) return [];
    const l = D.c.cekler || [];
    return satirlar().map(s => s.t && s.vade ? l.find(c => (D.f.yon === 'alinan' ? c.kimdenId === k.id && c.yon !== 'verilen' : c.kimeId === k.id && c.yon === 'verilen') && c.vade === s.vade && Math.abs(c.tutar - s.t) < 0.01) : null)
      .map((c, i) => c ? { i, c } : null).filter(Boolean);
  }

  function eksik() {
    const f = D.f, e = [];
    if (!f.kisi) e.push(f.yon === 'alinan' ? 'Senedi veren müşteriyi seçin.' : 'Senedin verildiği tedarikçiyi seçin.');
    if (!f.tarih) e.push('Alış tarihini seçin.');
    else if (f.tarih > gunEkle(bugun(), 60)) e.push('Tarih çok ileride.');
    const l = satirlar();
    if (!l.length) e.push('Senet tutarını ve vadesini girin.');
    l.forEach((s, i) => {
      const ad = l.length > 1 ? `${i + 1}. senedin ` : 'Senedin ';
      if (!s.t) e.push(ad + 'tutarını girin.');
      if (!s.vade) e.push(ad + 'vadesini girin.');
      else if (f.tarih && s.vade < f.tarih) e.push(ad + 'vadesi alış tarihinden önce olamaz.');
    });
    const sira = siraOnizle().map(x => x.toLocaleUpperCase('tr'));
    if (new Set(sira).size !== sira.length) e.push('Aynı sıra no iki senette yazılmış.');
    return e;
  }

  /* ---------- özet (yazdıkça yalnız bu bölüm yenilenir, telefonda klavye kapanmasın) ---------- */
  function ozetHtml() {
    const f = D.f, l = satirlar(), top = l.reduce((t, s) => t + s.t, 0), e = eksik(), sira = siraOnizle(), ayni = ayniVar();
    const satir = (k, v) => `<div class="gd-oz-s"><span>${k}</span><b>${v}</b></div>`;
    return `<div class="gd-oz-t">${tl2(top)}</div>
      <div class="gd-oz-k">${l.length} senet <em>${f.yon === 'alinan' ? 'müşteriden alınan' : 'tedarikçiye verilen'}</em></div>
      ${satir(f.yon === 'alinan' ? 'Veren' : 'Verilen', f.kisi ? esc(f.kisi.ad) : 'Seçilmedi')}
      ${satir(f.yon === 'alinan' ? 'Alış tarihi' : 'Veriliş tarihi', f.tarih ? dt(f.tarih) : '—')}
      <div class="sn-oz-l">${l.map((s, i) => `<div><span>${esc(sira[i])}</span><span>${s.vade ? dt(s.vade) : 'vade yok'}</span><b>${s.t ? tl2(s.t) : '—'}</b></div>`).join('')}</div>
      ${f.aciklama.trim() ? `<p class="gd-oz-a">“${esc(f.aciklama.trim())}”</p>` : ''}
      ${ayni.length ? `<p class="gd-oz-u">${ayni.map(({ i, c }) => `${l.length > 1 ? i + 1 + '. senet: ' : ''}bu kişide ${dt(c.vade)} vadeli ${tl2(c.tutar)} tutarında bir evrak zaten var${c.seri ? ' (no ' + esc(c.seri) + ')' : ''}.`).join(' ')} İkinci kez girmediğinizden emin olun.</p>` : ''}
      ${D.uyari ? `<p class="gd-oz-h">${esc(D.uyari)}</p>` : ''}
      <button class="btn dark gd-kaydet" data-act="snKaydet" ${D.kaydediyor || !D.k ? 'disabled' : ''}>${D.kaydediyor ? 'Paraşüt\'e kaydediliyor…' : D.onay ? (ayni.length ? 'Evet, yine de kaydet' : `Evet, ${l.length} senedi kaydet`) : (l.length > 1 ? `${l.length} senedi Paraşüt'e kaydet` : 'Senedi Paraşüt\'e kaydet')}</button>
      <p class="gd-oz-n">${D.onay ? 'Bilgileri kontrol edip bir kez daha basın.' : e.length && (f.kisi || para(f.tutar)) ? esc(e[0]) : f.yon === 'alinan' ? 'Senet müşterinin carisinden düşer, sitedeki carisine de tahsilat olarak yazılır.' : 'Senet tedarikçiye ödenecek olarak Paraşüt\'e işlenir.'}</p>`;
  }
  const ozetYenile = () => {
    const o = $('#snOzet'); if (o) o.innerHTML = ozetHtml();
    const p = siraOnizle(); $$('[data-sn-sira]').forEach((el, i) => { el.placeholder = p[i] || ''; });
  };

  function satirHtml() {
    const f = D.f, p = siraOnizle(), cok = f.satirlar.length > 1;
    if (!f.satirlar.length) return '';
    return `<div class="sn-satirlar">${f.satirlar.map((s, i) => `<div class="sn-satir">
      <span class="sn-no" title="Taksit">${cok ? s.no + '/' + toplamAdet() : '1'}</span>
      <label class="f"><span>Sıra no</span><input data-sn-sira="${i}" type="text" maxlength="30" autocomplete="off" placeholder="${esc(p[i])}" value="${esc(s.sira)}"></label>
      <label class="f"><span>Vade</span><input data-sn-vade="${i}" type="date" value="${esc(s.vade)}" min="${esc(f.tarih)}"></label>
      <label class="f"><span>Tutar</span><input data-sn-tutar="${i}" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(s.tutar)}"></label>
    </div>`).join('')}</div>
    <p class="hint">Sıra no boş kalırsa sıradaki numara verilir (${esc(p.find((x, i) => !f.satirlar[i].sira.trim()) || D.k?.sira || 'SN0001')}…). Senedin üstünde başka bir numara yazıyorsa onu yazın.</p>`;
  }
  const satirYenile = () => { const o = $('#snSatirlar'); if (o) o.innerHTML = satirHtml(); ozetYenile(); };

  function sonucHtml() {
    const r = D.sonuc;
    if (!r) return '';
    const s = r.site;
    const siteNot = !s ? '' : s.durum === 'tamam' ? `<small>✓ ${esc(s.mesaj)}</small>` : s.durum === 'bekle' ? `<small>⏳ ${esc(s.mesaj)}</small>` : s.durum === 'yok' ? `<small>${esc(s.mesaj)}</small>` : `<small class="gd-kirmizi">${esc(s.mesaj)}</small>`;
    const kismi = !r.ok || (r.uyari || []).length || r.senetler.some(x => x.uyari?.length) || s?.durum === 'hata';
    return `<div class="gd-sonuc ${kismi ? 'kismi' : ''}" role="status">
      <div class="gd-tik">${r.senetler.length ? '✓' : '!'}</div>
      <div>${r.senetler.length ? `<b>${r.senetler.length} senet Paraşüt'e kaydedildi: ${esc(r.kisi)}, ${tl2(r.toplam)}</b>` : `<b>Senet kaydedilemedi</b>`}
        ${r.senetler.length ? `<div class="sn-sonuc-l">${r.senetler.map(x => `<span><b>${esc(x.sira)}</b> vade ${dt(x.vade)} · ${tl2(x.tutar)}</span>`).join('')}</div>` : ''}
        ${siteNot}
        ${[...(r.uyari || []), ...r.senetler.flatMap(x => (x.uyari || []).map(u => x.sira + ': ' + u))].map(u => `<small class="gd-kirmizi">${esc(u)}</small>`).join('')}
        ${r.hata ? `<small class="gd-kirmizi"><b>${esc(r.hata)}</b>${r.belirsiz ? '' : r.senetler.length ? ' Kaydedilemeyen senetler formda duruyor; kontrol edip tekrar kaydedin.' : ''}</small>` : ''}
        <div class="sn-sonuc-d">${r.yon === 'alinan' && r.senetler.length ? `<button class="btn sm" data-act="snRapor" data-ad="${esc(r.kisi)}">Müşteriye vade raporu</button>` : ''}<button class="btn sm" data-go="cek">Çek ve senet sayfası</button></div>
      </div>
      <button class="gd-x" data-act="snSonucKapat" aria-label="Kapat">×</button></div>`;
  }

  function formHtml() {
    const f = D.f, k = D.k;
    if (!k) return `<div class="card gd-form">${D.hata ? `<p class="msg err">${esc(D.hata)}</p><button class="btn dark" data-act="snYenile">Tekrar dene</button>` : '<div class="skel" style="height:460px"></div>'}</div>`;
    const ae = acikEvrak(), dun = gunEkle(bugun(), -1), l = kisiler();
    const ilkler = [[aySonu(bugun()), 'Bu ay sonu'], [aySonu(ayEkle(bugun(), 1, false)), 'Gelecek ay sonu'], [ayEkle(f.tarih || bugun(), 1, false), '1 ay sonra']];
    return `<div class="card gd-form">
      ${sonucHtml()}
      <div class="gd-adim"><span>1</span><h3>Kimden, kime?</h3></div>
      <div class="gd-seg sn-yon" role="group" aria-label="Senet yönü">
        <button data-act="snYon" data-o="alinan" aria-pressed="${f.yon === 'alinan'}">Müşteriden aldık</button>
        <button data-act="snYon" data-o="verilen" aria-pressed="${f.yon === 'verilen'}">Tedarikçiye verdik</button></div>
      <div class="f ara-alan"><span>${f.yon === 'alinan' ? 'Müşteri' : 'Tedarikçi'}</span>${araKutu('snKisi_' + f.yon, l, f.kisi?.ad || '', 'snKisi', { yer: `Paraşüt ${f.yon === 'alinan' ? 'müşterisi' : 'tedarikçisi'} ara (${l.length})` })}</div>
      ${ae ? `<p class="hint sn-acik">${ae.l.length ? `${f.yon === 'alinan' ? 'Portföyde bu müşteriden' : 'Bu tedarikçiye verilmiş, ödenmemiş'} ${num(ae.l.length)} evrak var, toplam ${tl(ae.l.reduce((t, c) => t + c.kalan, 0))}; son vade ${dt(ae.l.map(c => c.vade).sort().at(-1))}.` : f.yon === 'alinan' ? 'Portföyde bu müşteriden açık evrak yok.' : 'Bu tedarikçiye verilmiş ödenmemiş evrak yok.'}${ae.ciro.length ? ` Ciro edilmiş, vadesi gelmemiş ${num(ae.ciro.length)} evrakı var (${tl(ae.ciro.reduce((t, c) => t + c.tutar, 0))}).` : ''}</p>` : ''}

      <div class="gd-adim"><span>2</span><h3>Kaç senet, ne kadar?</h3></div>
      <div class="sn-ust">
        <div class="f"><span>Senet sayısı</span><div class="sn-adet"><button data-act="snAdet" data-d="-1" aria-label="Azalt" ${f.adet <= 1 ? 'disabled' : ''}>−</button><b>${f.adet}</b><button data-act="snAdet" data-d="1" aria-label="Artır" ${f.adet >= EN_COK ? 'disabled' : ''}>+</button></div></div>
        ${f.adet > 1 ? `<div class="f"><span>Tutar</span><div class="gd-seg" role="group" aria-label="Tutar nasıl girilecek"><button data-act="snMod" data-o="her" aria-pressed="${f.mod === 'her'}">Her senet</button><button data-act="snMod" data-o="toplam" aria-pressed="${f.mod === 'toplam'}">Toplam, eşit böl</button></div></div>` : ''}
      </div>
      <div class="gd-tutar"><input id="snTutar" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(f.tutar)}" aria-label="${f.adet > 1 && f.mod === 'toplam' ? 'Toplam tutar' : 'Senet tutarı'}"><b>₺</b></div>
      <p class="hint gd-tutar-n">${f.adet > 1 ? (f.mod === 'toplam' ? `Toplam tutarı yazın, ${f.adet} senede eşit bölünür (kuruş farkı son senede).` : `Bir senedin tutarını yazın; ${f.adet} senet aynı tutarda olur. Farklıysa aşağıdan değiştirin.`) : 'Senedin tutarını yazın.'}</p>
      <div class="gd-tarih">
        <label class="f"><span>${f.adet > 1 ? 'İlk vade' : 'Vade'}</span><input id="snIlk" type="date" value="${esc(f.ilk)}" min="${esc(f.tarih)}"></label>
        <div class="gd-hizli">${ilkler.map(([g, ad]) => `<button class="chip" data-act="snIlkSec" data-g="${g}" aria-pressed="${f.ilk === g}">${ad}</button>`).join('')}</div>
      </div>
      ${f.adet > 1 ? `<div class="f"><span>Vadeler arası</span><div class="gd-seg" role="group" aria-label="Vadeler arası"><button data-act="snAralik" data-o="ay" aria-pressed="${f.aralik === 'ay'}">Her ay</button><button data-act="snAralik" data-o="15" aria-pressed="${f.aralik === '15'}">15 günde bir</button><button data-act="snAralik" data-o="hafta" aria-pressed="${f.aralik === 'hafta'}">Her hafta</button></div></div>` : ''}
      <div id="snSatirlar">${satirHtml()}</div>

      <div class="gd-adim"><span>3</span><h3>Tarih ve not</h3></div>
      <div class="gd-tarih">
        <label class="f"><span>${f.yon === 'alinan' ? 'Alış tarihi' : 'Veriliş tarihi'}</span><input id="snTarih" type="date" value="${esc(f.tarih)}" max="${gunEkle(bugun(), 60)}"></label>
        <div class="gd-hizli"><button class="chip" data-act="snTarihSec" data-g="${bugun()}" aria-pressed="${f.tarih === bugun()}">Bugün</button><button class="chip" data-act="snTarihSec" data-g="${dun}" aria-pressed="${f.tarih === dun}">Dün</button></div>
      </div>
      <label class="f gd-acik"><span>Not (isteğe bağlı)</span><input id="snAciklama" type="text" maxlength="200" autocomplete="off" placeholder="ör. Ekim cari bakiyesi için" value="${esc(f.aciklama)}"></label>
      <p class="hint">Paraşüt'te açıklamaya "SENET ${f.adet > 1 ? '1/' + f.adet : ''}" ve notunuz yazılır, banka adı SENET olur.</p>
    </div>`;
  }

  function sonKart() {
    if (!D.k) return '';
    const l = D.k.gecmis || [];
    const site = g => !g.site ? '' : g.site.durum === 'tamam' ? '<span class="pill ok">Siteye yazıldı</span>' : g.site.durum === 'bekle' ? '<span class="pill warn">Site bekliyor</span>' : g.site.durum === 'hata' ? '<span class="pill bad">Site hatası</span>' : '';
    return `<div class="card gd-son">
      <h3>Panelden girilen senetler</h3><p class="sub">Paraşüt'e bu sayfadan girilen son senetler. Tüm çek ve senetler Çek ve senet sayfasında.</p>
      ${l.length ? `<ul class="gd-liste">${l.slice(0, D.goster).map(g => { const s = g.senetler || []; return `<li>
        <div class="gd-l-sol"><i class="gd-nokta" style="background:${g.yon === 'alinan' ? 'var(--ok)' : 'var(--gold)'}"></i><div><b>${esc(g.kisi)}</b><small>${g.yon === 'alinan' ? 'Alınan' : 'Verilen'} · ${num(s.length)} senet${s.length ? ' · ' + esc(s[0].sira) + (s.length > 1 ? '–' + esc(s.at(-1).sira) : '') : ''}${s.length ? ' · vade ' + dt(s[0].vade) + (s.length > 1 ? '–' + dt(s.at(-1).vade) : '') : ''} · ${dtt(g.zaman)}${g.kim ? ' · ' + esc(String(g.kim).split('@')[0]) : ''}</small></div></div>
        <div class="gd-l-sag"><b>${tl2(g.tutar)}</b>${site(g)}${g.hata ? '<span class="pill bad">Yarım</span>' : ''}</div></li>`; }).join('')}</ul>
        ${l.length > D.goster ? `<div class="ek-dug"><button class="btn sm" data-act="snDaha">Daha fazla</button></div>` : ''}` : '<p class="hint">Panelden henüz senet girilmedi.</p>'}
    </div>`;
  }

  views.senet = () => {
    if (!D.k && !D.yuk && !D.hata) yukle();
    if (!D.f.satirlar.length) dagit();
    const acts = `<button class="btn" data-act="snYenile" ${D.yuk ? 'disabled' : ''}>${D.yuk ? 'Okunuyor…' : 'Yenile'}</button>`;
    return `${head('Finans', 'Senet gir', 'Müşteriden alınan ya da tedarikçiye verilen senedi buradan girin; Paraşüt\'e senet olarak işlenir, sıra no kendiliğinden verilir. Birden çok taksit bir kerede girilir.', acts)}
      ${D.hata && D.k ? `<p class="msg err" style="margin-bottom:14px">${esc(D.hata)}</p>` : ''}
      <div class="gd-ust">
        <div class="gd-sol">${formHtml()}</div>
        <div class="gd-sag"><div class="card gd-ozet" id="snOzet">${ozetHtml()}</div></div>
      </div>
      <div class="gd-alt">${sonKart()}</div>`;
  };

  views.bind_senet = () => {
    const f = D.f;
    const sifirla = () => { D.onay = false; D.uyari = ''; };
    $('#snTutar')?.addEventListener('input', e => { f.tutar = e.target.value; sifirla(); dagit(); satirYenile(); });
    $('#snTutar')?.addEventListener('blur', e => { const t = para(e.target.value); if (t) { f.tutar = yaz(t); e.target.value = f.tutar; } });
    $('#snAciklama')?.addEventListener('input', e => { f.aciklama = e.target.value; sifirla(); ozetYenile(); });
    $('#snIlk')?.addEventListener('change', e => { f.ilk = e.target.value; sifirla(); dagit(); S.keepScroll = true; render(); });
    $('#snTarih')?.addEventListener('change', e => { f.tarih = e.target.value; sifirla(); S.keepScroll = true; render(); });
    const kutu = $('#snSatirlar');
    kutu?.addEventListener('input', e => {
      const el = e.target, s = f.satirlar[+(el.dataset.snSira ?? el.dataset.snTutar ?? el.dataset.snVade)];
      if (!s) return;
      if ('snSira' in el.dataset) s.sira = el.value; else if ('snTutar' in el.dataset) s.tutar = el.value; else s.vade = el.value;
      sifirla(); ozetYenile();
    });
    kutu?.addEventListener('blur', e => { const el = e.target; if (!('snTutar' in el.dataset)) return; const t = para(el.value), s = f.satirlar[+el.dataset.snTutar]; if (t && s) { s.tutar = yaz(t); el.value = s.tutar; } }, true);
  };
  araSec.snKisi = m => { D.f.kisi = m; D.onay = false; D.uyari = ''; };

  // sitedeki cariye yazım eşitleme yüzünden beklediyse 20 saniyede bir tekrar sorulur
  async function siteBekle(istek) {
    for (let i = 0; i < 15; i++) {
      await bekle(20000);
      if (D.sonuc?.istek !== istek) return;
      try {
        const s = await sor({ islem: 'senet_site', istek });
        if (s.durum !== 'bekle') { D.sonuc.site = s; S.keepScroll = true; render(); if (s.durum === 'tamam') toast('Senet site carisine yazıldı.'); return; }
      } catch { /* bir sonraki denemede */ }
    }
  }

  async function kaydet() {
    const f = D.f, e = eksik();
    if (e.length) { D.uyari = e[0]; D.onay = false; S.keepScroll = true; render(); return; }
    if (!D.onay) { D.onay = true; D.uyari = ''; ozetYenile(); setTimeout(() => { if (D.onay && !D.kaydediyor) { D.onay = false; ozetYenile(); } }, 10000); return; }
    D.kaydediyor = true; D.onay = false; D.uyari = ''; D.sonuc = null; S.keepScroll = true; render();
    const l = satirlar(), istek = uuid();
    const govde = { islem: 'senet', istek, yon: f.yon, kisi: f.kisi.id, tarih: f.tarih, adet: toplamAdet(), aciklama: f.aciklama.trim(),
      satirlar: l.map(s => ({ no: s.no, tutar: s.t, vade: s.vade, sira: s.sira.trim() })) };
    try {
      const r = await yazIstek(govde);
      D.sonuc = { ...r, istek };
      if (D.k && r.sira) D.k.sira = r.sira;
      if (r.ok) { D.f = yeniForm({ yon: f.yon, tarih: f.tarih }); dagit(); delete ARA['snKisi_alinan']; delete ARA['snKisi_verilen']; toast(`${r.senetler.length} senet Paraşüt'e kaydedildi.`); }
      // yarım kaldıysa kaydedilenler formdan çıkar, kalanlar durur (tekrar basınca yalnız onlar girilir)
      else if (r.senetler.length) { f.satirlar = f.satirlar.slice(r.senetler.length); if (r.belirsiz) f.satirlar = []; }
      D.kaydediyor = false; S.keepScroll = true; render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (r.site?.durum === 'bekle') siteBekle(istek);
      // liste ve sıra no yenilenir
      D.c = null; yukle(false);
    } catch (err) {
      D.uyari = err.message; D.kaydediyor = false; S.keepScroll = true; render();
    }
  }

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    const f = D.f;
    const ciz = () => { S.keepScroll = true; render(); };
    if (act === 'snYenile') { D.hata = ''; yukle(true); }
    else if (act === 'snYon') { if (f.yon !== el.dataset.o) { f.yon = el.dataset.o; f.kisi = null; } D.onay = false; D.uyari = ''; ciz(); }
    else if (act === 'snAdet') { f.adet = Math.min(EN_COK, Math.max(1, f.adet + Number(el.dataset.d))); if (f.adet === 1) f.mod = 'her'; D.onay = false; dagit(); ciz(); }
    else if (act === 'snMod') { f.mod = el.dataset.o; D.onay = false; dagit(); ciz(); }
    else if (act === 'snAralik') { f.aralik = el.dataset.o; D.onay = false; dagit(); ciz(); }
    else if (act === 'snIlkSec') { f.ilk = el.dataset.g; D.onay = false; dagit(); ciz(); }
    else if (act === 'snTarihSec') { f.tarih = el.dataset.g; D.onay = false; ciz(); }
    else if (act === 'snKaydet') kaydet();
    else if (act === 'snSonucKapat') { D.sonuc = null; ciz(); }
    else if (act === 'snDaha') { D.goster += 30; ciz(); }
    else if (act === 'snRapor') {
      // Çek ve senet sayfasındaki müşteri vade raporu bu müşteriyle açılır
      const cs = S.ui.cs;
      if (cs) { cs.rm = el.dataset.ad; cs.rResim = ''; cs.rDurum = ''; cs.rHazir = false; cs.v = null; }
      delete ARA.csRm;
      go('cek');
      setTimeout(() => $('#csRapor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 900);
    }
    else prevAct?.(act, el, e);
  };
})();
