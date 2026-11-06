#!/usr/bin/env python3
# Netlify fonksiyonlarının Supabase kopyalarını üretir (celik 06.11.2026: Netlify kredisi bitti, panel GitHub Pages'e taşındı).
# Netlify dosyası değişirse bunu çalıştır, çıkan index.ts'yi Supabase'e aynı adla yükle.
import pathlib, re
KOK = pathlib.Path(__file__).resolve().parent.parent
ESLER = {  # netlify dosyası -> (supabase adı, arka plan mı)
    'ai-product-image': ('ai-gorsel', False),
    'qukasoft': ('qukasoft-ek', False),
    'fis-oku-background': ('fis-oku', True),
}
SON = '''
// ---- Supabase sarmalayıcısı: Netlify olayını taklit eder ----
const IZINLI = /^https:\\/\\/([a-z0-9-]+(--[a-z0-9-]+)?\\.netlify\\.app|celksamet34-web\\.github\\.io)$/i;
Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const izin = !origin || IZINLI.test(origin);
  const cors = izin && origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '600' } : {};
  if (req.method === 'OPTIONS') return new Response(null, { status: izin ? 204 : 403, headers: cors });
  if (!izin) return new Response(JSON.stringify({ success: false, message: 'Bu istek uygulamanın yayın adresinden gelmeli.' }), { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  const headers = {}; req.headers.forEach((v, k) => { headers[k] = v; });
  const event = { httpMethod: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? '' : await req.text(), queryStringParameters: Object.fromEntries(new URL(req.url).searchParams) };
%GOVDE%
});
'''
ON = '''// @ts-nocheck
// ÜRETİLMİŞ DOSYA: netlify/functions/%KAYNAK%.js kopyası (supabase/netlify-kopya.py). Elle değiştirme; Netlify dosyasını değiştirip yeniden üret.
import { Buffer } from 'node:buffer';
import process from 'node:process';
'''
for kaynak, (ad, arka) in ESLER.items():
    js = (KOK / 'netlify/functions' / (kaynak + '.js')).read_text()
    assert js.count('exports.handler = ') == 1, kaynak
    js = js.replace('exports.handler = ', 'const handler = ')
    govde = ("  // arka plan işi: hemen 202 döner, iş bitene kadar sürer\n  EdgeRuntime.waitUntil(handler(event).catch(() => {}));\n  return new Response(null, { status: 202, headers: cors });"
             if arka else
             "  const r = await handler(event);\n  return new Response(r?.body ?? '', { status: r?.statusCode || 200, headers: { ...(r?.headers || {}), ...cors } });")
    hedef = KOK / 'supabase/functions' / ad / 'index.ts'
    hedef.parent.mkdir(parents=True, exist_ok=True)
    hedef.write_text(ON.replace('%KAYNAK%', kaynak) + js.rstrip() + '\n' + SON.replace('%GOVDE%', govde))
    print('yazıldı', hedef.relative_to(KOK))
