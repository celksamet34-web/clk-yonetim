/* CLK Yönetim — anasayfa banner stüdyosu: Photoroom AI arka planla banner görseli, onaydan sonra Qukasoft paneline yüklenir */
(() => {
  const { S, $, esc, P, head, views, render, sb, toast } = CLK;
  const BUCKET = 'product-images';
  // Sahne hazırları: panelde Türkçe ad, Photoroom'a İngilizce tarif. Hepsine yazı, logo ve insan yasağı eklenir.
  const SCENES = [
    ['luks', 'Lüks mermer', 'a polished beige marble pedestal in a softly lit high-end boutique, warm golden accent light, elegant minimal composition, premium fashion campaign photography'],
    ['koyu', 'Koyu stüdyo', 'a dark charcoal studio backdrop with a soft spotlight from above and a subtle warm gold rim light, luxury product campaign photography'],
    ['okul', 'Okula dönüş', 'a cheerful back-to-school scene, soft pastel classroom background with blurred colorful books and pencils on a light wooden desk, bright natural daylight, clean and playful'],
    ['seyahat', 'Seyahat', 'a blurred modern airport terminal with warm sunlight through large windows, premium travel lifestyle photography'],
    ['sonbahar', 'Sonbahar', 'warm golden-hour light, blurred autumn leaves and cozy knit textures on a wooden surface, premium editorial look'],
    ['yaz', 'Yaz', 'a bright summer terrace with soft sea view bokeh, white stone surface, airy natural light, fresh premium lifestyle photography']
  ];
  const TAIL = ' No text, no letters, no logos, no people.';
  const B = (S.ui.bn ||= { q: '', code: '', scene: 'luks', custom: '', title: '', sub: '', btn: 'İncele', link: '', busy: '', out: null, approved: null });
  try { if (!B.approved) B.approved = JSON.parse(localStorage.getItem('clk-banner-approved') || 'null'); } catch {}
  const product = () => S.products.find(p => String(p.code) === String(B.code));
  const promptText = () => (B.custom.trim() || (SCENES.find(s => s[0] === B.scene) || SCENES[0])[2]) + TAIL;

  // Önizleme: Qukasoft'un banner üstüne koyduğu siyah başlık, alt yazı ve düğme kutuları (sitedekiyle aynı yerleşim)
  const overlay = () => `<div class="bn-ov">${B.title ? `<span class="t">${esc(B.title)}</span>` : ''}${B.sub ? `<span class="s">${esc(B.sub)}</span>` : ''}${B.btn ? `<span class="b">${esc(B.btn)}</span>` : ''}</div>`;

  views.banner = () => {
    const p = product(), img = p && P.img(p);
    const list = S.products.filter(x => P.img(x));
    const out = B.out;
    return head('Mağaza', 'Banner stüdyosu', 'Anasayfa banner görselleri · Photoroom AI arka plan · onaylamadan yayına çıkmaz') + `
    <div class="grid2 bn">
      <div class="bn-form">
        <section class="step"><div class="step-h"><span class="no">01</span><div><h2>Ürün</h2><p>Banner'da görünecek çanta. İlk fotoğrafı kullanılır, arka planı Photoroom temizler.</p></div></div>
          <div class="step-b"><label class="f"><span>Ürün ara</span><input type="search" id="bnq" list="bn-products" placeholder="Ürün adı ya da kodu" value="${esc(p ? `${p.code} — ${p.name}` : B.q)}"></label>
            <datalist id="bn-products">${list.map(x => `<option value="${esc(x.code)} — ${esc(x.name)}">`).join('')}</datalist>
            ${img ? `<div class="bn-pick"><img src="${esc(img)}" alt=""><div><b>${esc(p.name)}</b><small>${esc(p.code)}</small></div></div>` : ''}</div></section>
        <section class="step"><div class="step-h"><span class="no">02</span><div><h2>Sahne</h2><p>Çantanın arkasına üretilecek ortam. Kendi tarifini yazarsan hazır sahne yerine o kullanılır.</p></div></div>
          <div class="step-b"><div class="chips" style="margin:0">${SCENES.map(([k, l]) => `<button class="chip" data-act="bnScene" data-k="${k}" aria-pressed="${B.scene === k && !B.custom.trim()}">${l}</button>`).join('')}</div>
            <label class="f"><span>Kendi tarifin (isteğe bağlı, İngilizce daha iyi sonuç verir)</span><textarea id="bncustom" rows="2" placeholder="ör. a velvet armchair in a luxury hotel lobby, warm evening light">${esc(B.custom)}</textarea></label></div></section>
        <section class="step"><div class="step-h"><span class="no">03</span><div><h2>Banner yazıları</h2><p>Qukasoft bu yazıları görselin üstüne kendisi yazar; önizlemede nasıl duracağı görünür.</p></div></div>
          <div class="step-b bn-txt">
            <label class="f"><span>Başlık</span><input type="text" id="bntitle" value="${esc(B.title)}" placeholder="ör. Yeni Sezon Sırt Çantaları"></label>
            <label class="f"><span>Alt yazı</span><input type="text" id="bnsub" value="${esc(B.sub)}" placeholder="ör. Okul ve seyahat için yeni modeller"></label>
            <label class="f"><span>Düğme</span><input type="text" id="bnbtn" value="${esc(B.btn)}" placeholder="ör. İncele"></label>
            <label class="f"><span>Bağlantı</span><input type="url" id="bnlink" value="${esc(B.link)}" placeholder="ör. https://www.clkcanta.com/sirt-cantasi"></label></div></section>
        <div class="bn-acts"><button class="btn dark" data-act="bnMake" ${!img || B.busy ? 'disabled' : ''}>${B.busy ? esc(B.busy) : out ? 'Yeniden üret' : 'Görsel üret'}</button><span class="bn-cost">Photoroom AI · görsel başı ~0,10 $</span></div>
      </div>
      <aside class="bn-prev"><div class="sum-card">
        <div class="bn-frame">${out ? `<img src="${esc(out.preview)}" alt="Banner önizleme">` : `<div class="bn-empty">${img ? 'Önizleme burada görünecek' : 'Önce ürün seç'}</div>`}${out ? overlay() : ''}${B.busy ? `<div class="busy">${esc(B.busy)}</div>` : ''}</div>
        ${out ? `<p class="bn-note">${out.sandbox ? '<b>Deneme (filigranlı, ücretsiz).</b> ' : ''}1248×1664 (3:4) · sahne: ${esc(out.scene)}</p>
          <div class="sum-acts"><button class="btn gold" data-act="bnApprove" ${out.sandbox || out.approved ? 'disabled' : ''}>${out.approved ? 'Onaylandı' : 'Onayla'}</button><button class="btn" data-act="bnDrop">Vazgeç</button></div>` : ''}
        ${B.approved ? `<div class="bn-ok"><b>Onaylanan banner</b><span>${esc(B.approved.title || 'Başlıksız')}${B.approved.link ? ' · ' + esc(B.approved.link) : ''}</span><small>Qukasoft'a yüklenmeyi bekliyor. Claude'a "banner'ı yükle" deyin.</small><a class="btn sm" href="${esc(B.approved.url)}" target="_blank" rel="noopener">Görseli aç</a></div>` : ''}
      </div></aside>
    </div>`;
  };

  views.bind_banner = () => {
    const q = $('#bnq'); q?.addEventListener('change', () => { B.q = q.value; const code = q.value.split(' — ')[0].trim(); const p = S.products.find(x => String(x.code) === code); B.code = p ? p.code : ''; render(); });
    const bindTxt = (id, k, rerender) => $(id)?.addEventListener('input', e => { B[k] = e.target.value; if (rerender) { clearTimeout(bindTxt.t); bindTxt.t = setTimeout(() => { S.keepScroll = true; render(); }, 400); } });
    bindTxt('#bncustom', 'custom'); bindTxt('#bntitle', 'title', true); bindTxt('#bnsub', 'sub', true); bindTxt('#bnbtn', 'btn', true); bindTxt('#bnlink', 'link');
  };

  // Photoroom'a giden girdi: ürün 1248×1664 beyaz tuvalde üst kısma yerleştirilir (genişliğin en çok %62'si, alt kenarı %68'de).
  // Photoroom AI arka planda ürünü bu yerde bırakır (referenceBox=originalImage); alt kısım sahneye kalır, Qukasoft yazıları oraya gelir.
  const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = () => no(new Error('Ürün fotoğrafı açılamadı.')); i.src = src; });
  async function placeBag(src) {
    const im = await loadImg(src), c0 = document.createElement('canvas'); c0.width = im.width; c0.height = im.height;
    const x0 = c0.getContext('2d'); x0.drawImage(im, 0, 0);
    const d = x0.getImageData(0, 0, im.width, im.height).data; let l = im.width, t = im.height, r = -1, b = -1;
    for (let y = 0; y < im.height; y += 2) for (let i = 0; i < im.width; i += 2) { const q = (y * im.width + i) * 4; if (d[q] < 235 || d[q + 1] < 235 || d[q + 2] < 235) { if (i < l) l = i; if (i > r) r = i; if (y < t) t = y; if (y > b) b = y; } }
    if (r < 0) { l = 0; t = 0; r = im.width - 1; b = im.height - 1; } // açık renkli ürün ayırt edilemezse tüm fotoğraf
    const bw = r - l + 1, bh = b - t + 1, W = 1248, H = 1664, s = Math.min(W * 0.62 / bw, H * 0.58 / bh), w = bw * s, h = bh * s;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(c0, l, t, bw, bh, (W - w) / 2, H * 0.68 - h, w, h);
    return c.toDataURL('image/jpeg', 0.92);
  }
  async function make(sandbox, opts = {}) {
    const p = product(); if (!p) return toast('Önce ürün seç.');
    B.busy = sandbox ? 'Deneme üretiliyor…' : 'Photoroom sahne üretiyor… (10-30 sn)'; S.keepScroll = true; render();
    try {
      const { data } = await sb.auth.getSession(); const t = data.session?.access_token; if (!t) throw new Error('Oturum kapandı. Yeniden giriş yap.');
      const scene = B.custom.trim() ? 'kendi tarif' : (SCENES.find(s => s[0] === B.scene) || SCENES[0])[1];
      const r = await fetch('/.netlify/functions/ai-product-image', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'banner', image: await placeBag(P.img(p)), prompt: promptText(), sandbox: !!sandbox, layout: opts.layout, model: opts.model }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.image) throw new Error(j.message || 'Banner üretilemedi.');
      B.out = { preview: j.image, sandbox: !!j.sandbox, scene, code: p.code };
    } catch (e) { toast(e.message); }
    B.busy = ''; S.keepScroll = true; render();
  }
  CLK.bannerTest = opts => make(true, opts); // ücretsiz, filigranlı deneme (Photoroom sandbox); arayüzde düğmesi yok. opts: { layout, model }
  async function approve() {
    const o = B.out; if (!o || o.sandbox) return;
    B.busy = 'Kaydediliyor…'; S.keepScroll = true; render();
    try {
      const path = `${S.user.id}/clk-yonetim/banner-${crypto.randomUUID()}.jpg`;
      const blob = await fetch(o.preview).then(r => r.blob());
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false }); if (error) throw new Error('Görsel kaydedilemedi.');
      const { data, error: e2 } = await sb.storage.from(BUCKET).createSignedUrl(path, 604800); if (e2) throw new Error('Bağlantı oluşturulamadı.');
      o.approved = true;
      B.approved = { path, url: data.signedUrl, title: B.title, sub: B.sub, btn: B.btn, link: B.link, code: o.code, at: Date.now() };
      try { localStorage.setItem('clk-banner-approved', JSON.stringify(B.approved)); } catch {}
      toast('Banner onaylandı.');
    } catch (e) { toast(e.message); }
    B.busy = ''; S.keepScroll = true; render();
  }

  const prevAct = views.onAct;
  views.onAct = (act, el, e) => {
    if (act === 'bnScene') { B.scene = el.dataset.k; B.custom = ''; S.keepScroll = true; render(); }
    else if (act === 'bnMake') make(false);
    else if (act === 'bnApprove') approve();
    else if (act === 'bnDrop') { B.out = null; S.keepScroll = true; render(); }
    else prevAct?.(act, el, e);
  };
})();
