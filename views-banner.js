/* CLK Yönetim — anasayfa görsel stüdyosu: banner, slider (manşet) ve kategori görselleri; yapay zekâ sahnesi, onaydan sonra Qukasoft paneline yüklenir */
(() => {
  const { S, $, esc, P, head, views, render, sb, toast } = CLK;
  const BUCKET = 'product-images';
  // Sahne hazırları: panelde Türkçe ad, modele İngilizce tarif
  const SCENES = [
    ['luks', 'Lüks mermer', 'a polished beige marble pedestal in a softly lit high-end boutique, warm golden accent light, elegant minimal composition, premium fashion campaign photography'],
    ['krem', 'Krem stüdyo', 'a warm cream studio backdrop with a large soft pale beige circle behind the product and a thin delicate golden arc line, soft even light, minimal luxury catalog style'],
    ['koyu', 'Koyu stüdyo', 'a dark charcoal studio backdrop with a soft spotlight from above and a subtle warm gold rim light, luxury product campaign photography'],
    ['okul', 'Okula dönüş', 'a cheerful back-to-school scene, soft pastel classroom background with blurred colorful books and pencils on a light wooden desk, bright natural daylight, clean and playful'],
    ['seyahat', 'Seyahat', 'a blurred modern airport terminal with warm sunlight through large windows, premium travel lifestyle photography'],
    ['sonbahar', 'Sonbahar', 'warm golden-hour light, blurred autumn leaves and cozy knit textures on a wooden surface, premium editorial look'],
    ['yaz', 'Yaz', 'a bright summer terrace with soft sea view bokeh, white stone surface, airy natural light, fresh premium lifestyle photography']
  ];
  const TAIL = ' No text, no letters, no logos, no people.';
  // Biçimler: [anahtar, ad, genişlik, yükseklik, yerleşim]. Yerleşim: ürünün en büyük genişlik/yükseklik oranı, alt kenarı ve yatay merkezi.
  // Slider masaüstünde ürün sağda, sol taraf Qukasoft yazılarına boş; banner ve mobil sliderda ürün üstte, alt kısım yazıya; kategori kutusunda ortada.
  const FORMATS = [
    ['banner', 'Anasayfa banner', 1248, 1664, { w: 0.62, h: 0.58, bottom: 0.68, cx: 0.5 }],
    ['slider', 'Slider masaüstü', 1920, 850, { w: 0.34, h: 0.76, bottom: 0.9, cx: 0.71 }],
    ['slider-m', 'Slider mobil', 1080, 1440, { w: 0.64, h: 0.5, bottom: 0.6, cx: 0.5 }],
    ['kategori', 'Kategori kutusu', 800, 1000, { w: 0.68, h: 0.6, bottom: 0.82, cx: 0.5 }]
  ];
  // Motorlar: fal.ai Seedream (girdiyi düzenler, ~0,04 $) ya da Photoroom AI arka plan (Plus planı, ~0,10 $)
  const ENGINES = [['fal', 'Seedream (fal.ai)', '~0,04 $'], ['photoroom', 'Photoroom', '~0,10 $']];
  const B = (S.ui.bn ||= { q: '', code: '', scene: 'luks', custom: '', title: '', sub: '', btn: 'İncele', link: '', engine: 'fal', format: 'banner', busy: '', out: null, approved: null, approvals: [] });
  B.engine ||= 'fal'; B.format ||= 'banner'; B.approvals ||= [];
  try { if (!B.approvals.length) B.approvals = JSON.parse(localStorage.getItem('clk-banner-approvals') || '[]'); } catch {}
  const product = () => S.products.find(p => String(p.code) === String(B.code));
  const fmt = (k = B.format) => FORMATS.find(f => f[0] === k) || FORMATS[0];
  const sceneText = () => B.custom.trim() || (SCENES.find(s => s[0] === B.scene) || SCENES[0])[2];
  // Seedream'e sahne düz gider (sunucu düzenleme istemine sarar; "logo yok" çantanın logosunu sildirebilir)
  const promptText = () => B.engine === 'fal' ? sceneText() + '.' : sceneText() + TAIL;
  const engine = () => ENGINES.find(e => e[0] === B.engine) || ENGINES[0];

  // Önizleme: Qukasoft'un görselin üstüne koyduğu yazılar. Banner ve mobil sliderda altta siyah kutular, masaüstü sliderda solda, kategoride altta ad.
  const overlay = f => f === 'kategori' ? `<div class="bn-ov cat"><span>${esc(B.title || 'KATEGORİ ADI')}</span></div>`
    : `<div class="bn-ov ${f === 'slider' ? 'side' : ''}">${B.title ? `<span class="t">${esc(B.title)}</span>` : ''}${B.sub ? `<span class="s">${esc(B.sub)}</span>` : ''}${B.btn ? `<span class="b">${esc(B.btn)}</span>` : ''}</div>`;

  views.banner = () => {
    const p = product(), img = p && P.img(p), list = S.products.filter(x => P.img(x)), out = B.out, [fk, fl, fw, fh] = fmt();
    return head('Mağaza', 'Görsel stüdyosu', 'Anasayfa banner, slider ve kategori görselleri · yapay zekâ sahnesi · onaylamadan yayına çıkmaz') + `
    <div class="grid2 bn">
      <div class="bn-form">
        <div class="chips" style="margin:0">${FORMATS.map(([k, l, w, h]) => `<button class="chip" data-act="bnFormat" data-k="${k}" aria-pressed="${B.format === k}">${l} <b>${w}×${h}</b></button>`).join('')}</div>
        <section class="step"><div class="step-h"><span class="no">01</span><div><h2>Ürün</h2><p>Görselde yer alacak çanta. İlk fotoğrafı kullanılır, yerinde ve aynen kalır.</p></div></div>
          <div class="step-b"><label class="f"><span>Ürün ara</span><input type="search" id="bnq" list="bn-products" placeholder="Ürün adı ya da kodu" value="${esc(p ? `${p.code} — ${p.name}` : B.q)}"></label>
            <datalist id="bn-products">${list.map(x => `<option value="${esc(x.code)} — ${esc(x.name)}">`).join('')}</datalist>
            ${img ? `<div class="bn-pick"><img src="${esc(img)}" alt=""><div><b>${esc(p.name)}</b><small>${esc(p.code)}</small></div></div>` : ''}</div></section>
        <section class="step"><div class="step-h"><span class="no">02</span><div><h2>Sahne</h2><p>Çantanın arkasına üretilecek ortam. Kendi tarifini yazarsan hazır sahne yerine o kullanılır.</p></div></div>
          <div class="step-b"><div class="chips" style="margin:0">${SCENES.map(([k, l]) => `<button class="chip" data-act="bnScene" data-k="${k}" aria-pressed="${B.scene === k && !B.custom.trim()}">${l}</button>`).join('')}</div>
            <label class="f"><span>Kendi tarifin (isteğe bağlı, İngilizce daha iyi sonuç verir)</span><textarea id="bncustom" rows="2" placeholder="ör. a velvet armchair in a luxury hotel lobby, warm evening light">${esc(B.custom)}</textarea></label></div></section>
        <section class="step"><div class="step-h"><span class="no">03</span><div><h2>${fk === 'kategori' ? 'Kategori' : 'Yazılar'}</h2><p>${fk === 'kategori' ? 'Kategori adı Qukasoft\'ta kutunun altına yazılır; önizleme içindir.' : 'Qukasoft bu yazıları görselin üstüne kendisi yazar; önizlemede nasıl duracağı görünür.'}</p></div></div>
          <div class="step-b bn-txt">
            <label class="f"><span>${fk === 'kategori' ? 'Kategori adı' : 'Başlık'}</span><input type="text" id="bntitle" value="${esc(B.title)}" placeholder="${fk === 'kategori' ? 'ör. SIRT VE DAĞCI ÇANTALARI' : 'ör. Yeni Sezon Sırt Çantaları'}"></label>
            ${fk === 'kategori' ? '' : `<label class="f"><span>Alt yazı</span><input type="text" id="bnsub" value="${esc(B.sub)}" placeholder="ör. Okul ve seyahat için yeni modeller"></label>
            <label class="f"><span>Düğme</span><input type="text" id="bnbtn" value="${esc(B.btn)}" placeholder="ör. İncele"></label>`}
            <label class="f"><span>Bağlantı</span><input type="url" id="bnlink" value="${esc(B.link)}" placeholder="ör. https://www.clkcanta.com/kolej-sirtlar"></label></div></section>
        <div class="chips" style="margin:0">${ENGINES.map(([k, l, c]) => `<button class="chip" data-act="bnEngine" data-k="${k}" aria-pressed="${B.engine === k}">${l} <b>${c}</b></button>`).join('')}</div>
        <div class="bn-acts"><button class="btn dark" data-act="bnMake" ${!img || B.busy ? 'disabled' : ''}>${B.busy ? esc(B.busy) : out ? 'Yeniden üret' : 'Görsel üret'}</button><span class="bn-cost">${fl} ${fw}×${fh} · ${engine()[1]} · görsel başı ${engine()[2]}</span></div>
      </div>
      <aside class="bn-prev"><div class="sum-card">
        <div class="bn-frame" style="aspect-ratio:${out ? `${fmt(out.format)[2]}/${fmt(out.format)[3]}` : `${fw}/${fh}`}">${out ? `<img src="${esc(out.preview)}" alt="Önizleme">` : `<div class="bn-empty">${img ? 'Önizleme burada görünecek' : 'Önce ürün seç'}</div>`}${out ? overlay(out.format) : ''}${B.busy ? `<div class="busy">${esc(B.busy)}</div>` : ''}</div>
        ${out ? `<p class="bn-note">${out.sandbox ? '<b>Deneme (filigranlı, ücretsiz).</b> ' : ''}${esc(fmt(out.format)[1])} ${fmt(out.format)[2]}×${fmt(out.format)[3]} · ${esc(out.engine || 'Photoroom')} · sahne: ${esc(out.scene)}</p>
          <div class="sum-acts"><button class="btn gold" data-act="bnApprove" ${out.sandbox || out.approved ? 'disabled' : ''}>${out.approved ? 'Onaylandı' : 'Onayla'}</button><button class="btn" data-act="bnDrop">Vazgeç</button></div>` : ''}
        ${B.approvals.length ? `<div class="bn-ok"><b>Onaylananlar</b><small>Qukasoft'a yüklenmeyi bekliyor. Claude'a "onaylananları yükle" deyin.</small>
          ${B.approvals.slice(0, 12).map(a => `<a class="bn-app" href="${esc(a.url)}" target="_blank" rel="noopener"><span>${esc(fmt(a.format)[1])}</span>${esc(a.title || 'Başlıksız')}</a>`).join('')}</div>` : ''}
      </div></aside>
    </div>`;
  };

  views.bind_banner = () => {
    const q = $('#bnq'); q?.addEventListener('change', () => { B.q = q.value; const code = q.value.split(' — ')[0].trim(); const p = S.products.find(x => String(x.code) === code); B.code = p ? p.code : ''; render(); });
    const bindTxt = (id, k, rerender) => $(id)?.addEventListener('input', e => { B[k] = e.target.value; if (rerender) { clearTimeout(bindTxt.t); bindTxt.t = setTimeout(() => { S.keepScroll = true; render(); }, 400); } });
    bindTxt('#bncustom', 'custom'); bindTxt('#bntitle', 'title', true); bindTxt('#bnsub', 'sub', true); bindTxt('#bnbtn', 'btn', true); bindTxt('#bnlink', 'link');
  };

  // Modele giden girdi: ürün biçimin boyutundaki beyaz tuvale biçimin yerleşimine göre konur. Model ürünü bu yerde bırakır
  // (Photoroom: referenceBox=originalImage; Seedream: "yerinde ve aynen bırak" istemi); boş kalan alan sahneye ve yazılara kalır.
  const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = () => no(new Error('Fotoğraf açılamadı.')); i.src = src; });
  async function placeBag(src, f) {
    const [, , W, H, L] = f, im = await loadImg(src), c0 = document.createElement('canvas'); c0.width = im.width; c0.height = im.height;
    const x0 = c0.getContext('2d'); x0.drawImage(im, 0, 0);
    const d = x0.getImageData(0, 0, im.width, im.height).data; let l = im.width, t = im.height, r = -1, b = -1;
    for (let y = 0; y < im.height; y += 2) for (let i = 0; i < im.width; i += 2) { const q = (y * im.width + i) * 4; if (d[q] < 235 || d[q + 1] < 235 || d[q + 2] < 235) { if (i < l) l = i; if (i > r) r = i; if (y < t) t = y; if (y > b) b = y; } }
    if (r < 0) { l = 0; t = 0; r = im.width - 1; b = im.height - 1; } // açık renkli ürün ayırt edilemezse tüm fotoğraf
    const bw = r - l + 1, bh = b - t + 1, s = Math.min(W * L.w / bw, H * L.h / bh), w = bw * s, h = bh * s;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(c0, l, t, bw, bh, W * L.cx - w / 2, H * L.bottom - h, w, h);
    return c.toDataURL('image/jpeg', 0.92);
  }
  // Sonuç biçimin tam boyutunda JPEG'e getirilir (Seedream daha büyük ama aynı oranda döner)
  async function fitTo(src, f) {
    const [, , W, H] = f, im = await loadImg(src), c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), s = Math.max(W / im.width, H / im.height), w = im.width * s, h = im.height * s;
    x.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); return c.toDataURL('image/jpeg', 0.92);
  }
  const fn = (t, body) => fetch('/.netlify/functions/ai-product-image', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.message || 'Görsel üretilemedi.'); return j; });
  async function make(sandbox, opts = {}) {
    const p = product(); if (!p) return toast('Önce ürün seç.');
    const eng = sandbox ? 'photoroom' : B.engine, f = fmt(); // sandbox yalnızca Photoroom'da var
    B.busy = sandbox ? 'Deneme üretiliyor…' : eng === 'fal' ? 'Seedream sahne üretiyor… (30-90 sn)' : 'Photoroom sahne üretiyor… (10-30 sn)'; S.keepScroll = true; render();
    try {
      const { data } = await sb.auth.getSession(); const t = data.session?.access_token; if (!t) throw new Error('Oturum kapandı. Yeniden giriş yap.');
      const scene = B.custom.trim() ? 'kendi tarif' : (SCENES.find(s => s[0] === B.scene) || SCENES[0])[1];
      let j = await fn(t, { action: 'banner', format: f[0], engine: eng, image: await placeBag(P.img(p), f), prompt: promptText(), sandbox: !!sandbox, layout: opts.layout, model: opts.model });
      if (j.pending) { // fal.ai kuyruğu: 3 sn arayla sor (en çok ~3 dk)
        const job = j.job;
        for (let i = 0; i < 60 && j.pending; i++) { await new Promise(ok => setTimeout(ok, 3000)); j = await fn(t, { action: 'falResult', job }); }
        if (j.pending) throw new Error('Seedream zaman aşımı.');
      }
      if (!j.image) throw new Error(j.message || 'Görsel üretilemedi.');
      B.out = { preview: await fitTo(j.image, f), format: f[0], sandbox: !!j.sandbox, scene, code: p.code, engine: eng === 'fal' ? 'Seedream' : 'Photoroom' };
    } catch (e) { toast(e.message); }
    B.busy = ''; S.keepScroll = true; render();
  }
  CLK.bannerTest = opts => make(true, opts); // ücretsiz, filigranlı deneme (Photoroom sandbox); arayüzde düğmesi yok. opts: { layout, model }
  async function approve() {
    const o = B.out; if (!o || o.sandbox) return;
    B.busy = 'Kaydediliyor…'; S.keepScroll = true; render();
    try {
      const path = `${S.user.id}/clk-yonetim/${o.format}-${crypto.randomUUID()}.jpg`;
      const blob = await fetch(o.preview).then(r => r.blob());
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false }); if (error) throw new Error('Görsel kaydedilemedi.');
      const { data, error: e2 } = await sb.storage.from(BUCKET).createSignedUrl(path, 604800); if (e2) throw new Error('Bağlantı oluşturulamadı.');
      o.approved = true;
      B.approved = { path, url: data.signedUrl, format: o.format, title: B.title, sub: o.format === 'kategori' ? '' : B.sub, btn: o.format === 'kategori' ? '' : B.btn, link: B.link, code: o.code, at: Date.now() };
      B.approvals = [B.approved, ...B.approvals].slice(0, 30);
      try { localStorage.setItem('clk-banner-approvals', JSON.stringify(B.approvals)); } catch {}
      toast('Görsel onaylandı.');
    } catch (e) { toast(e.message); }
    B.busy = ''; S.keepScroll = true; render();
  }

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'bnEngine') { B.engine = el.dataset.k; S.keepScroll = true; render(); }
    else if (act === 'bnFormat') { B.format = el.dataset.k; if (B.format === 'kategori' && !B.custom.trim()) B.scene = 'krem'; B.out = null; S.keepScroll = true; render(); }
    else if (act === 'bnScene') { B.scene = el.dataset.k; B.custom = ''; S.keepScroll = true; render(); }
    else if (act === 'bnMake') make(false);
    else if (act === 'bnApprove') approve();
    else if (act === 'bnDrop') { B.out = null; S.keepScroll = true; render(); }
    else prevAct?.(act, el, e);
  };
})();
