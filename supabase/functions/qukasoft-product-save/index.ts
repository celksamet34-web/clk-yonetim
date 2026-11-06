// CLK Yönetim: ürün formundan Qukasoft'a ürün kaydı (product/save; kod varsa günceller). 06.11.2026'ya kadar clkcanta Netlify fonksiyonuna köprüydü;
// Netlify kredisi bitince doğrudan Qukasoft'a bağlandı (anahtarlar Supabase sırlarında: QUKASOFT_API_KEY / QUKASOFT_API_SECRET).
// İstek: POST { product } ya da { products: [...] } (en çok 5)  Yanıt: { success, message, result }
const SB = Deno.env.get('SUPABASE_URL') || 'https://prkzzaqinfeptmmbkqsd.supabase.co';
const PUB = 'sb_publishable_0sbTUikCycbokrRbzxtBAg_JGTfJtr4';
const Q = 'https://www.clkcanta.com/api/v2/';
const IZINLI = /^https:\/\/([a-z0-9-]+(--[a-z0-9-]+)?\.netlify\.app|celksamet34-web\.github\.io)$/i;
const bekle = (ms: number) => new Promise(r => setTimeout(r, ms));

async function quka(yol: string, govde?: unknown) {
  for (let i = 0; ; i++) {
    const r = await fetch(Q + yol, { method: govde ? 'POST' : 'GET', headers: { apikey: Deno.env.get('QUKASOFT_API_KEY')!, apisecret: Deno.env.get('QUKASOFT_API_SECRET')!, 'Content-Type': 'application/json' }, body: govde ? JSON.stringify(govde) : undefined, signal: AbortSignal.timeout(govde ? 140000 : 30000) });
    const j = await r.json().catch(() => ({}));
    const sinir = r.status === 429 || /rate limit/i.test(String(j?.message || ''));
    if (sinir && i < 3) { await bekle(1500 * (i + 1)); continue; }
    return { ok: r.ok && (!j?.code || j.code === 'SUCCESS'), j, status: r.status };
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const izin = !origin || IZINLI.test(origin);
  const cors: Record<string, string> = izin && origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '600' } : {};
  const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors } });
  if (req.method === 'OPTIONS') return new Response(null, { status: izin ? 204 : 403, headers: cors });
  if (!izin) return json(403, { success: false, message: 'Bu istek uygulamanın yayın adresinden gelmeli.' });
  const auth = req.headers.get('authorization') || '';
  const kim = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: PUB, Authorization: auth } });
  if (!kim.ok) return json(401, { success: false, message: 'Oturum geçersiz veya süresi dolmuş.' });
  const y = await fetch(`${SB}/rest/v1/rpc/panel_yetki`, { method: 'POST', headers: { apikey: PUB, Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ istenen: ['yeni', 'urunler', 'stok'] }) });
  // personel: ürün kaydı yalnız Yeni ürün / Ürünler / Stok yetkisiyle (celik 01.11.2026)
  if (y.status !== 404 && !(y.ok && (await y.json().catch(() => false)) === true)) return json(403, { success: false, message: 'Ürün kaydetme yetkiniz yok.' });
  if (req.method !== 'POST') return json(405, { success: false, message: 'Yalnızca POST kabul edilir.' });
  const g = await req.json().catch(() => ({}));
  const urunler = Array.isArray(g?.products) ? g.products : g?.product ? [g.product] : [];
  if (!urunler.length || urunler.length > 5 || urunler.some((x: any) => !x || typeof x !== 'object')) return json(400, { success: false, message: 'Gönderilecek ürün yok (tek seferde en çok 5).' });
  try {
    const { ok, j, status } = await quka('product/save', { products: urunler });
    if (!ok) return json(422, { success: false, apiCode: String(j?.code || status), result: j?.result ?? null, message: String(j?.message || j?.error || `Qukasoft kaydı tamamlanmadı (${j?.code || status}).`).slice(0, 300) });
    return json(200, { success: true, apiCode: String(j?.code || 'SUCCESS'), result: j?.result ?? null, message: 'Qukasoft’a gönderildi.' });
  } catch (e) {
    return json(502, { success: false, message: (e as Error)?.name === 'TimeoutError' ? 'Qukasoft yanıt vermedi.' : 'Qukasoft bağlantısı kurulamadı.' });
  }
});
