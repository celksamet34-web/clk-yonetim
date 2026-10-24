// CLK Yönetim — Qukasoft web servis köprüsü: ürün formunun ek işlemleri (benzer ürün, kombin, uyumluluk, birim)
// Yalnızca aşağıdaki uç noktalara izin verilir; anahtarlar Netlify ortam değişkenlerinde durur.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://prkzzaqinfeptmmbkqsd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_0sbTUikCycbokrRbzxtBAg_JGTfJtr4';
const API = process.env.QUKASOFT_API_URL || 'https://www.clkcanta.com/api/v2/';
const ALLOWED = {
  'product/combines': 'GET', 'unit/lists': 'GET', 'compability/lists': 'GET', 'compability/values': 'GET',
  'product/updateSimilars': 'POST', 'product/updateCombines': 'POST', 'product/updateCompabilities': 'POST'
};

function reply(statusCode, payload) {
  return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(payload) };
}
function header(headers, name) {
  const key = Object.keys(headers || {}).find(item => item.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : '';
}

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return reply(405, { success: false, message: 'Yalnızca POST kabul edilir.' });
  const bearer = /^Bearer\s+(.+)$/i.exec(header(event.headers, 'authorization'));
  if (!bearer) return reply(401, { success: false, message: 'Önce uygulamadaki hesabında oturum aç.' });
  const apiKey = process.env.QUKASOFT_API_KEY, apiSecret = process.env.QUKASOFT_API_SECRET;
  if (!apiKey || !apiSecret) return reply(503, { success: false, message: 'Qukasoft anahtarları (QUKASOFT_API_KEY, QUKASOFT_API_SECRET) bu sitede tanımlı değil.' });
  try {
    const user = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${bearer[1]}` } });
    if (!user.ok) return reply(401, { success: false, message: 'Oturum geçersiz veya süresi dolmuş.' });
    const body = JSON.parse(event.body || '{}'), path = String(body.path || ''), method = ALLOWED[path];
    if (!method) return reply(400, { success: false, message: 'Bu işleme izin verilmiyor.' });
    const url = new URL(path, API);
    if (method === 'GET') Object.entries(body.query || {}).forEach(([k, v]) => v !== undefined && v !== '' && url.searchParams.set(k, String(v).slice(0, 100)));
    const r = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json', apikey: apiKey, apisecret: apiSecret }, signal: AbortSignal.timeout(20000),
      body: method === 'POST' ? JSON.stringify(body.data || {}) : undefined
    });
    const j = await r.json().catch(() => ({}));
    const ok = r.ok && j?.code === 'SUCCESS';
    return reply(ok ? 200 : 422, { success: ok, apiCode: String(j?.code || r.status), result: j?.result ?? null, message: ok ? '' : String(j?.message || j?.error || `Qukasoft işlemi tamamlanmadı (${j?.code || r.status}).`).slice(0, 300) });
  } catch (e) {
    return reply(502, { success: false, message: e?.name === 'TimeoutError' ? 'Qukasoft yanıt vermedi.' : 'Qukasoft bağlantısı kurulamadı.' });
  }
};
