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
// Görüntü modelleri santimetreyi zayıf anlar; ölçüyü mankenin baş boyu ve gövdesi cinsinden de tarif ederiz.
function scaleText(size, height, child, scaled) {
  const w = cm(size?.w), h = cm(size?.h), d = cm(size?.d);
  if (!w && !h) return `Keep the bag at a realistic real-world size relative to a person about ${height} cm tall.`;
  const head = height / (child ? 6.5 : 7.5), torso = height * 0.3, shoulders = height * (child ? 0.22 : 0.25);
  const r = v => Math.round(v * 10) / 10;
  const dims = [w && `${w} cm wide`, h && `${h} cm tall`, d && `${d} cm deep`].filter(Boolean).join(', ');
  const rel = [
    h && `its height is about ${r(h / head)} times the model's head height and about ${Math.round(h / torso * 100)}% of the torso length (shoulder to hip)`,
    w && `its width is about ${r(w / head)} head heights, about ${Math.round(w / shoulders * 100)}% of the shoulder width`
  ].filter(Boolean).join('; ');
  // Panel çantayı kadraja göre gerçek boyunda yerleştirdiyse (scaled), girdi görseli bir ölçek rehberidir.
  const guide = scaled
    ? ' Two input images are given. Image 1 is the exact product: copy it faithfully, same color, logo, lettering and details. Image 2 is only a scale and layout guide: it shows the same bag already drawn at its exact real-world size and position for the final framing, which shows the model from the top of the head (near the top edge) down to mid-thigh (bottom edge). Use this framing and keep the bag at exactly the size and roughly the position shown in image 2, front-facing and upright, not tilted. Pose the person so the bag sits naturally there (worn with its strap across the body or over the shoulder, or held by its handle); hands, hair and straps must not cover the bag.'
    : ' Choose a framing (full body or three-quarter) that makes the size comparison obvious.';
  return `True scale is critical: the bag is ${dims} and the model is about ${height} cm tall (head about ${Math.round(head)} cm, shoulders about ${Math.round(shoulders)} cm wide). So ${rel}. Render the bag at exactly this real size relative to the body; never enlarge or shrink it for styling.${guide}`;
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

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return reply(405, { success: false, message: 'Yalnızca POST kabul edilir.' });
  const bearer = /^Bearer\s+(.+)$/i.exec(header(event.headers, 'authorization'));
  if (!bearer) return reply(401, { success: false, message: 'Önce uygulamadaki hesabında oturum aç.' });
  const apiKey = process.env.OPENAI_API_KEY, geminiKey = process.env.GEMINI_API_KEY;
  try {
    const user = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${bearer[1]}` } });
    if (!user.ok) return reply(401, { success: false, message: 'Oturum geçersiz veya süresi dolmuş.' });
    const body = JSON.parse(event.body || '{}');
    const action = ['model', 'original'].includes(body.action) ? body.action : 'cutout';
    const [person, height] = AUDIENCE[body.audience] || AUDIENCE.kadin;
    const kind = String(body.kind || '').replace(/[^\p{L}\p{N} ›/-]/gu, '').slice(0, 120);
    if (action !== 'original' && !apiKey && !(action === 'model' && geminiKey)) return reply(503, { success: false, message: 'Mankenli görsel servisi için OPENAI_API_KEY Netlify ortam değişkeni eksik.' });
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ''));
    if (!match) return reply(422, { success: false, message: 'Ürün fotoğrafı okunamadı.' });
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length > 6 * 1024 * 1024) return reply(413, { success: false, message: 'Fotoğraf çok büyük. Daha küçük bir görsel seç.' });
    if (action === 'original') return reply(200, { success: true, action, image: body.image });
    // Ölçek rehberi ikinci görsel olarak gider; ilk görsel (ürün) en yüksek sadakatle korunur
    const guideMatch = action === 'model' && body.scaled === true ? /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.guide || '')) : null;
    const guideBytes = guideMatch ? Buffer.from(guideMatch[2], 'base64') : null;
    if (guideBytes && guideBytes.length > 4 * 1024 * 1024) return reply(413, { success: false, message: 'Ölçek görseli çok büyük.' });
    const prompt = action === 'cutout'
      ? 'Edit this exact product photo into a professional ecommerce cutout. Treat the entire bag as a protected foreground: preserve its original pixels and visible viewing angle as closely as possible. Change only the background. Do not redraw, redesign, beautify, reshape, recolor or retouch the bag. Preserve the exact logo, all lettering, brand marks, label placement, typography, hardware, seams, texture and proportions. Never invent, replace or correct logo letters; keep even unclear markings exactly as photographed. Remove the entire original background, center the product, add a natural soft grounding shadow, and use a pure white seamless background. No text, no props, no people, square composition.'
      : `Create a photorealistic premium ecommerce lifestyle image using the exact product in the reference photo. Use the reference bag as a protected product foreground. Preserve its exact logo and lettering, brand marks, typography, label position, shape, color, material, hardware, stitching and proportions. Never redraw, reinterpret, replace, correct or invent a logo or text. Keep the reference viewing angle and product details; adapt the person and pose around the bag. Prioritize product and logo fidelity over styling. Show ${person} naturally wearing or holding the product according to its real use${kind ? ` (product type: ${kind})` : ''}. ${scaleText(body.size, height, /cocuk$/.test(body.audience || ''), body.scaled === true)} Keep the logo side facing the camera, flat, sharp and unobstructed by hands, hair or straps. Minimal bright studio, white to very light gray background, soft shadow, full product clearly visible, tasteful modern catalog styling, square composition, no text and no extra products.`;
    let geminiError = '';
    if (action === 'model' && geminiKey) {
      try { return reply(200, { success: true, action, engine: 'gemini', image: await gemini(geminiKey, prompt, [[match[1], bytes], ...(guideBytes ? [[guideMatch[1], guideBytes]] : [])]) }); }
      catch (e) { geminiError = e?.name === 'AbortError' ? 'zaman aşımı' : String(e?.message || e); if (!apiKey) return reply(422, { success: false, message: 'Gemini: ' + geminiError }); }
    }
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
    return reply(200, { success: true, action, engine: 'openai', geminiError: geminiError || undefined, image: `data:image/jpeg;base64,${image}` });
  } catch (error) {
    return reply(502, { success: false, message: error?.name === 'AbortError' ? 'Görsel üretimi zaman aşımına uğradı.' : 'Görsel servisine bağlanılamadı.' });
  }
};
