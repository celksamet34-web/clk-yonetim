// CLK Yönetim — ürün görseli: dekupe ve mankenli görsel (OpenAI görüntü düzenleme)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://prkzzaqinfeptmmbkqsd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_0sbTUikCycbokrRbzxtBAg_JGTfJtr4';

// Manken seçimi: panelde seçilen kitleye göre görseldeki kişi ve ölçek için boyu (cm)
const AUDIENCE = {
  kadin: ['one adult Turkish female fashion model', 170],
  erkek: ['one adult Turkish male fashion model', 182],
  'kiz-cocuk': ['one Turkish girl child model, around 8 to 10 years old, in modest age-appropriate casual clothing', 135],
  'erkek-cocuk': ['one Turkish boy child model, around 8 to 10 years old, in modest age-appropriate casual clothing', 138]
};
const cm = v => { const n = Number(v); return n > 0 && n < 300 ? Math.round(n) : 0; };
// Taşıma şekli: panelde seçilir, mankenin çantayı nasıl taşıdığı
const CARRY = {
  capraz: 'worn crossbody on the chest, with its shoulder strap running diagonally over the opposite shoulder',
  omuz: 'hanging at the hip from its strap over the near shoulder',
  el: 'held by its handle in the hand, arm relaxed at the side',
  // Sırtta: logo kameraya baksın diye manken arkadan çekilir (önden çekimde çanta göğse geliyordu)
  sirt: 'worn as a backpack on the back with both shoulder straps over the shoulders. The model is photographed from behind (rear view, back to the camera, head may turn slightly to the side), so the backpack sits on the upper back and its front panel with the logo faces the camera. Never show the model from the front and never place the bag on the chest'
};
// Ölçek rehberinde poz tarifi: taşıma şekline göre
const GUIDE_POSE = {
  sirt: 'Show the model from behind so the backpack is worn on the back exactly there, both shoulder straps over the shoulders',
  capraz: 'Pose the person so the bag sits naturally there, worn with its strap across the body',
  omuz: 'Pose the person so the bag sits naturally there, hanging from its strap over the shoulder'
};
// "Elde" seçiminde manken yerine yakın çekim el: kimin eli ve ölçek için el boyu (bilekten parmak ucuna, cm)
const HAND = { kadin: ["a woman's hand", 17.5], erkek: ["a man's hand", 19], 'kiz-cocuk': ["a young girl's hand", 14], 'erkek-cocuk': ["a young boy's hand", 14.5] };
function handPrompt(audience, size) {
  const [who, hand] = HAND[audience] || HAND.kadin, w = cm(size?.w), h = cm(size?.h), d = cm(size?.d), r = v => Math.round(v * 10) / 10;
  const dims = [w && `${w} cm wide`, h && `${h} cm tall`, d && `${d} cm deep`].filter(Boolean).join(', ');
  const scale = w || h
    ? ` True scale is critical: the bag is ${dims} and the hand is about ${hand} cm long from wrist to fingertip, so ${[h && `the bag's height is about ${r(h / hand)} times the hand length`, w && `its width about ${r(w / hand)} times the hand length`].filter(Boolean).join(' and ')}. Render the bag at exactly this real size relative to the hand; never enlarge or shrink it for styling.`
    : ' Keep the bag at a realistic real-world size relative to the hand.';
  return `Create a photorealistic premium ecommerce close-up product photo of the exact bag in the reference photo, held by its handle in ${who}. Show only the hand, wrist and a little of the forearm entering the frame from above or the side; no face, no full body. Preserve the bag's exact logo and lettering, brand marks, typography, label position, shape, color, material, hardware, stitching and proportions; never redraw, reinterpret, replace, correct or invent a logo or text. The bag hangs naturally from the hand, front-facing and upright, with the logo side facing the camera, flat, sharp and not covered by the fingers.${scale} Minimal bright studio, white to very light gray background, soft shadow, full product clearly visible, tasteful modern catalog styling, square composition, exactly one bag, no text.`;
}
// Görüntü modelleri santimetreyi zayıf anlar; ölçüyü mankenin baş boyu ve gövdesi cinsinden de tarif ederiz.
// scaled: ikinci görsel ölçek rehberi (panel çantayı kadraja göre gerçek boyunda yerleştirdi)
function scaleText(size, height, child, scaled, carry) {
  const w = cm(size?.w), h = cm(size?.h), d = cm(size?.d);
  if (!w && !h) return `Keep the bag at a realistic real-world size relative to a person about ${height} cm tall.`;
  const head = height / (child ? 6.5 : 7.5), torso = height * 0.3, shoulders = height * (child ? 0.22 : 0.25);
  const r = v => Math.round(v * 10) / 10;
  const dims = [w && `${w} cm wide`, h && `${h} cm tall`, d && `${d} cm deep`].filter(Boolean).join(', ');
  const rel = [
    h && `its height is about ${r(h / head)} times the model's head height and about ${Math.round(h / torso * 100)}% of the torso length (shoulder to hip)`,
    w && `its width is about ${r(w / head)} head heights, about ${Math.round(w / shoulders * 100)}% of the shoulder width`
  ].filter(Boolean).join('; ');
  // Kadraj baştan uyluk ortasına (boyun ~%62'si) olduğunda çantanın karede kaplaması gereken oran
  const frame = height * (child ? 0.66 : 0.62) / 0.93;
  const pct = [h && `its height must be about ${Math.round(h / frame * 100)}% of the image height`, w && `its width about ${Math.round(w / frame * 100)}% of the image width`].filter(Boolean).join(' and ');
  const share = scaled && pct ? ` In the final image ${pct}; the bag must look small relative to the body, never dominant.` : '';
  // Panel çantayı kadraja göre gerçek boyunda yerleştirdiyse (scaled), girdi görseli bir ölçek rehberidir.
  const guide = scaled
    ? ` Two input images are given. Image 1 is the exact product: copy it faithfully, same color, logo, lettering and details. Image 2 is only a scale and layout guide: it shows the same bag already drawn at its exact real-world size and position for the final framing, which shows the model from the top of the head (near the top edge) down to mid-thigh (bottom edge). Use this framing and keep the bag at exactly the size and roughly the position shown in image 2, front-facing and upright, not tilted. ${GUIDE_POSE[carry] || 'Pose the person so the bag sits naturally there (worn with its strap across the body or over the shoulder, or held by its handle)'}; hands, hair and straps must not cover the bag.`
    : ' Choose a framing (full body or three-quarter) that makes the size comparison obvious.';
  return `True scale is critical: the bag is ${dims} and the model is about ${height} cm tall (head about ${Math.round(head)} cm, shoulders about ${Math.round(shoulders)} cm wide). So ${rel}. Render the bag at exactly this real size relative to the body; never enlarge or shrink it for styling.${guide}${share}`;
}

function reply(statusCode, payload) {
  return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(payload) };
}
function header(headers, name) {
  const key = Object.keys(headers || {}).find(item => item.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : '';
}

// Mankenli görsel için Google Gemini (Nano Banana Pro): ürün tutarlılığında daha iyi. GEMINI_API_KEY yoksa ya da hata verirse OpenAI kullanılır.
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3-pro-image';
async function gemini(key, prompt, images) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 70000); // OpenAI yedeğine süre kalsın
  try {
    const parts = [{ text: prompt }, ...images.map(([mime, b]) => ({ inlineData: { mimeType: mime, data: b.toString('base64') } }))];
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } } })
    });
    const j = await r.json().catch(() => ({}));
    const out = (j?.candidates?.[0]?.content?.parts || []).map(p => p.inlineData || p.inline_data).find(d => d?.data);
    if (!r.ok || !out) throw new Error(j?.error?.message || j?.candidates?.[0]?.finishReason || 'Gemini görsel döndürmedi.');
    return `data:${out.mimeType || out.mime_type || 'image/png'};base64,${out.data}`;
  } finally { clearTimeout(timeout); }
}

// Mankenli görsel için fal.ai (varsayılan Seedream 4.5 düzenleme modeli; FAL_IMAGE_MODEL ile değiştirilebilir).
// Üretim Netlify fonksiyon süresini aştığı için kuyruk kullanılır: istek bırakılır, panel sonucu ayrı çağrılarla sorar.
const FAL_MODEL = process.env.FAL_IMAGE_MODEL || 'fal-ai/bytedance/seedream/v4.5/edit';
const falError = j => { const d = j?.detail; return (Array.isArray(d) ? d[0]?.msg : d) || j?.error || j?.message; };
async function falSubmit(key, prompt, images) {
  const r = await fetch(`https://queue.fal.run/${FAL_MODEL}`, {
    method: 'POST', headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ prompt, image_urls: images.map(([mime, b]) => `data:${mime};base64,${b.toString('base64')}`), image_size: { width: 1920, height: 1920 }, num_images: 1 })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.status_url || !j.response_url) throw new Error(falError(j) || `fal.ai ${r.status}`);
  return { status: j.status_url, result: j.response_url };
}
const isFalQueue = u => typeof u === 'string' && u.startsWith('https://queue.fal.run/'); // anahtarı yalnızca fal kuyruğuna gönder
async function falPoll(key, job) {
  if (!isFalQueue(job?.status) || !isFalQueue(job?.result)) throw new Error('Geçersiz iş bilgisi.');
  const H = { Authorization: `Key ${key}` };
  const s = await fetch(job.status, { headers: H, signal: AbortSignal.timeout(10000) }).then(r => r.json()).catch(() => ({}));
  if (s.status !== 'COMPLETED') return { pending: true, state: s.status || 'BİLİNMİYOR' };
  if (s.error) throw new Error(s.error);
  const j = await fetch(job.result, { headers: H, signal: AbortSignal.timeout(15000) }).then(r => r.json()).catch(() => ({}));
  const url = j?.images?.[0]?.url; if (!url) throw new Error(falError(j) || 'fal.ai görsel döndürmedi.');
  // Küçükse veriyi biz taşırız; Netlify yanıt sınırını (6 MB) aşacaksa panel görseli doğrudan fal CDN'inden alır.
  const img = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const buf = Buffer.from(await img.arrayBuffer());
  return { image: buf.length < 4 * 1024 * 1024 ? `data:${img.headers.get('content-type') || 'image/png'};base64,${buf.toString('base64')}` : url };
}

// Dekupe için Photoroom: ürünün piksellerine dokunmadan yalnızca arka planı siler (şeffaf PNG döner).
async function photoroom(key, mime, bytes) {
  const form = new FormData();
  form.append('image_file', new Blob([bytes], { type: mime }), 'product.jpg');
  form.append('format', 'png');
  const r = await fetch('https://sdk.photoroom.com/v1/segment', { method: 'POST', headers: { 'x-api-key': key }, body: form, signal: AbortSignal.timeout(30000) });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j?.detail || j?.message || j?.error?.message || `Photoroom ${r.status}`); }
  return `data:image/png;base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
}

// Ürün açıklaması: paneldeki bilgilerden Türkçe, şık bir HTML metin. Bilgi uydurmaması için yalnızca verilen alanlar kullanılır.
const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini';
async function describe(key, facts) {
  const f = Object.fromEntries(Object.entries(facts || {}).filter(([, v]) => v !== '' && v != null && !(Array.isArray(v) && !v.length)).map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 300) : v]));
  const sys = 'Sen premium bir Türk çanta markası (CLK Çanta) için e-ticaret metin yazarısın. Akıcı, zarif ve güven veren bir Türkçeyle yazarsın; abartılı reklam dili, ünlem ve emoji kullanmazsın. YALNIZCA verilen bilgileri kullanırsın: bölme sayısı, fermuar türü, garanti, iade, kargo gibi verilmeyen hiçbir özellik uydurmazsın; "kaliteli", "birinci sınıf", "hakiki", "dayanıklı" gibi ürün hakkında doğrulanmamış övgü sıfatları kullanmazsın. Yanıtı JSON olarak verirsin: {"long": "...", "short": "..."}.';
  const user = `Ürün bilgileri (JSON): ${JSON.stringify(f)}

"long" için yalnızca şu HTML etiketlerini kullan: <p>, <h3>, <ul>, <li>, <strong>. Yapı:
1) Ürünün kimliğini ve kullanım alanını anlatan 2 kısa paragraf (ilk paragrafta marka ve ürün adı <strong> ile).
2) <h3>Öne çıkan özellikler</h3> ve verilen bilgilere dayanan 3-5 madde.
3) <h3>Ürün bilgileri</h3> ve "<strong>Alan:</strong> değer" biçiminde maddeler: alan adlarını verildiği gibi yaz; yalnızca Marka, Ürün kodu, Kategori, Malzeme, Ölçüler, Renk ve Su geçirmez alanlarından verilmiş olanları listele.
4) <h3>Bakım önerisi</h3> ve malzemeye uygun tek paragraf.
Toplam 120-200 kelime. "short" için listelerde görünecek, 90 karakteri geçmeyen tek cümle yaz.`;
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(25000),
    body: JSON.stringify({ model: TEXT_MODEL, temperature: 0.7, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `OpenAI ${r.status}`);
  const out = JSON.parse(j?.choices?.[0]?.message?.content || '{}');
  if (!out.long) throw new Error('Boş yanıt');
  return { long: String(out.long), short: String(out.short || '').slice(0, 120) };
}

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return reply(405, { success: false, message: 'Yalnızca POST kabul edilir.' });
  const bearer = /^Bearer\s+(.+)$/i.exec(header(event.headers, 'authorization'));
  if (!bearer) return reply(401, { success: false, message: 'Önce uygulamadaki hesabında oturum aç.' });
  const apiKey = process.env.OPENAI_API_KEY, geminiKey = process.env.GEMINI_API_KEY, falKey = process.env.FAL_KEY, photoroomKey = process.env.PHOTOROOM_API_KEY;
  try {
    const user = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${bearer[1]}` } });
    if (!user.ok) return reply(401, { success: false, message: 'Oturum geçersiz veya süresi dolmuş.' });
    const body = JSON.parse(event.body || '{}');
    if (body.action === 'falResult') {
      if (!falKey) return reply(503, { success: false, message: 'FAL_KEY eksik.' });
      try { return reply(200, { success: true, action: 'model', engine: 'fal', ...(await falPoll(falKey, body.job)) }); }
      catch (e) { return reply(422, { success: false, message: 'fal: ' + String(e?.message || e) }); }
    }
    if (body.action === 'describe') {
      if (!apiKey) return reply(503, { success: false, message: 'OPENAI_API_KEY eksik.' });
      try { return reply(200, { success: true, ...(await describe(apiKey, body.facts)) }); }
      catch (e) { return reply(422, { success: false, message: 'Açıklama yazılamadı: ' + String(e?.message || e) }); }
    }
    const action = ['model', 'original'].includes(body.action) ? body.action : 'cutout';
    const [person, audienceHeight] = AUDIENCE[body.audience] || AUDIENCE.kadin;
    const height = Number(body.height) >= 80 && Number(body.height) <= 220 ? Math.round(Number(body.height)) : audienceHeight; // paneldeki manken boyu
    const carryText = CARRY[body.carry] || 'naturally wearing or holding the product according to its real use';
    const kind = String(body.kind || '').replace(/[^\p{L}\p{N} ›/-]/gu, '').slice(0, 120);
    if (action !== 'original' && !apiKey && !(action === 'model' && (geminiKey || falKey)) && !(action === 'cutout' && photoroomKey)) return reply(503, { success: false, message: 'Mankenli görsel servisi için OPENAI_API_KEY Netlify ortam değişkeni eksik.' });
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ''));
    if (!match) return reply(422, { success: false, message: 'Ürün fotoğrafı okunamadı.' });
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length > 6 * 1024 * 1024) return reply(413, { success: false, message: 'Fotoğraf çok büyük. Daha küçük bir görsel seç.' });
    if (action === 'original') return reply(200, { success: true, action, image: body.image });
    // Ölçek rehberi ikinci görsel olarak gider; ilk görsel (ürün) en yüksek sadakatle korunur
    const guideMatch = action === 'model' && body.scaled === true && body.carry !== 'el' ?/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.guide || '')) : null;
    const guideBytes = guideMatch ? Buffer.from(guideMatch[2], 'base64') : null;
    if (guideBytes && guideBytes.length > 4 * 1024 * 1024) return reply(413, { success: false, message: 'Ölçek görseli çok büyük.' });
    const prompt = action === 'model' && body.carry === 'el' ? handPrompt(body.audience, body.size) : action === 'cutout'
      ? 'Edit this exact product photo into a professional ecommerce cutout. Treat the entire bag as a protected foreground: preserve its original pixels and visible viewing angle as closely as possible. Change only the background. Do not redraw, redesign, beautify, reshape, recolor or retouch the bag. Preserve the exact logo, all lettering, brand marks, label placement, typography, hardware, seams, texture and proportions. Never invent, replace or correct logo letters; keep even unclear markings exactly as photographed. Remove the entire original background, center the product, add a natural soft grounding shadow, and use a pure white seamless background. No text, no props, no people, square composition.'
      : `Create a photorealistic premium ecommerce lifestyle image using the exact product in the reference photo. Use the reference bag as a protected product foreground. Preserve its exact logo and lettering, brand marks, typography, label position, shape, color, material, hardware, stitching and proportions. Never redraw, reinterpret, replace, correct or invent a logo or text. Keep the reference viewing angle and product details; adapt the person and pose around the bag. Prioritize product and logo fidelity over styling. Show ${person}, about ${height} cm tall, with the bag ${carryText}${kind ? ` (product type: ${kind})` : ''}. ${scaleText(body.size, height, /cocuk$/.test(body.audience || ''), body.scaled === true && !!guideBytes, body.carry)} Keep the logo side facing the camera, flat, sharp and unobstructed by hands, hair or straps. Minimal bright studio, white to very light gray background, soft shadow, full product clearly visible, tasteful modern catalog styling, square composition, no text and no extra products.`;
    // Sıra: dekupede Photoroom; mankende fal.ai, sonra Gemini. Hepsi yoksa ya da hata verirse OpenAI.
    const refs = [[match[1], bytes], ...(guideBytes ? [[guideMatch[1], guideBytes]] : [])];
    const errors = [];
    if (action === 'model' && falKey && body.skipFal !== true) {
      try { return reply(200, { success: true, action, engine: 'fal', pending: true, job: await falSubmit(falKey, prompt, refs) }); }
      catch (e) { errors.push(`fal: ${e?.name === 'TimeoutError' ? 'zaman aşımı' : String(e?.message || e)}`); }
    }
    const engines = action === 'cutout' ? [['photoroom', photoroomKey, () => photoroom(photoroomKey, match[1], bytes)]]
      : [['gemini', geminiKey, () => gemini(geminiKey, prompt, refs)]];
    for (const [engine, key, run] of engines) {
      if (!key) continue;
      try { return reply(200, { success: true, action, engine, image: await run() }); }
      catch (e) { errors.push(`${engine}: ${e?.name === 'AbortError' || e?.name === 'TimeoutError' ? 'zaman aşımı' : String(e?.message || e)}`); }
    }
    const engineError = errors.join(' | ');
    if (errors.length && !apiKey) return reply(422, { success: false, message: engineError });
    // Logo ve yazıların korunması için yüksek girdi sadakati; model reddederse ayarsız tekrar dener.
    const edit = async fidelity => {
      const form = new FormData();
      form.append('model', 'gpt-image-1.5');
      form.append('prompt', prompt);
      form.append('size', '1024x1024');
      form.append('quality', 'medium');
      form.append('output_format', 'jpeg');
      if (fidelity) form.append('input_fidelity', 'high');
      form.append('image[]', new Blob([bytes], { type: match[1] }), 'product.jpg');
      if (guideBytes) form.append('image[]', new Blob([guideBytes], { type: guideMatch[1] }), 'scale-guide.jpg');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 110000);
      try {
        const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: controller.signal });
        return [r, await r.json().catch(() => ({}))];
      } finally { clearTimeout(timeout); }
    };
    let [response, result] = await edit(true);
    if (!response.ok && /input_fidelity/i.test(result?.error?.message || '')) [response, result] = await edit(false);
    const image = result?.data?.[0]?.b64_json;
    if (!response.ok || !image) return reply(422, { success: false, message: result?.error?.message || 'Görsel üretilemedi.' });
    return reply(200, { success: true, action, engine: 'openai', engineError: engineError || undefined, image: `data:image/jpeg;base64,${image}` });
  } catch (error) {
    return reply(502, { success: false, message: error?.name === 'AbortError' ? 'Görsel üretimi zaman aşımına uğradı.' : 'Görsel servisine bağlanılamadı.' });
  }
};
