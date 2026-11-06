// CLK Yönetim: sitedeki (Qukasoft) kategori listesi. 06.11.2026'ya kadar clkcanta Netlify fonksiyonuna köprüydü;
// Netlify kredisi bitince doğrudan Qukasoft'a bağlandı (anahtarlar Supabase sırlarında: QUKASOFT_API_KEY / QUKASOFT_API_SECRET).
// İstek: ?parentId=0  Yanıt: { success, categories: [...] }
const SB = Deno.env.get('SUPABASE_URL') || 'https://prkzzaqinfeptmmbkqsd.supabase.co';
const PUB = 'sb_publishable_0sbTUikCycbokrRbzxtBAg_JGTfJtr4';
const Q = 'https://www.clkcanta.com/api/v2/';
const IZINLI = /^https:\/\/([a-z0-9-]+(--[a-z0-9-]+)?\.netlify\.app|celksamet34-web\.github\.io)$/i;
const bekle = (ms: number) => new Promise(r => setTimeout(r, ms));

async function quka(yol: string) {
  for (let i = 0; ; i++) {
    const r = await fetch(Q + yol, { headers: { apikey: Deno.env.get('QUKASOFT_API_KEY')!, apisecret: Deno.env.get('QUKASOFT_API_SECRET')! }, signal: AbortSignal.timeout(30000) });
    const j = await r.json().catch(() => ({}));
    const sinir = r.status === 429 || /rate limit/i.test(String(j?.message || ''));
    if (sinir && i < 3) { await bekle(1500 * (i + 1)); continue; }
    return { ok: r.ok && (!j?.code || j.code === 'SUCCESS'), j, status: r.status };
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const izin = !origin || IZINLI.test(origin);
  const cors: Record<string, string> = izin && origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '600' } : {};
  const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors } });
  if (req.method === 'OPTIONS') return new Response(null, { status: izin ? 204 : 403, headers: cors });
  if (!izin) return json(403, { success: false, message: 'Bu istek uygulamanın yayın adresinden gelmeli.' });
  const auth = req.headers.get('authorization') || '';
  const kim = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: PUB, Authorization: auth } });
  if (!kim.ok) return json(401, { success: false, message: 'Oturum geçersiz veya süresi dolmuş.' });
  const y = await fetch(`${SB}/rest/v1/rpc/panel_yetki`, { method: 'POST', headers: { apikey: PUB, Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ istenen: null }) });
  if (y.status !== 404 && !(y.ok && (await y.json().catch(() => false)) === true)) return json(403, { success: false, message: 'Bu panele giriş yetkiniz yok.' });
  const u = new URL(req.url);
  const ust = String(parseInt(u.searchParams.get('parentId') || '0') || 0);
  try {
    const { ok, j, status } = await quka('category/lists?' + new URLSearchParams({ parentId: ust, pageStart: '0', pageSize: '100' }));
    if (!ok) return json(502, { success: false, message: String(j?.message || `Qukasoft kategori listesi alınamadı (${j?.code || status}).`).slice(0, 300) });
    const r = j?.result || {};
    let list = Array.isArray(r) ? r : (r.list || []);
    // parentId yok sayılırsa diye süz
    if (list.some((c: any) => c && 'parentId' in c)) list = list.filter((c: any) => String(c.parentId ?? 0) === ust);
    return json(200, { success: true, categories: list });
  } catch (e) {
    return json(502, { success: false, message: (e as Error)?.name === 'TimeoutError' ? 'Qukasoft yanıt vermedi.' : 'Qukasoft bağlantısı kurulamadı.' });
  }
});
