// CLK Yönetim — Ürün Giriş: tedarikçi fişinin (el yazısı fotoğraf ya da PDF sayfaları) satırlarını yapay zekâyla okur.
// Arka plan fonksiyonu: hemen 202 döner, sonucu giriş yapan kullanıcının oturumuyla ug_fis satırına yazar; panel satırı izler.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://prkzzaqinfeptmmbkqsd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_0sbTUikCycbokrRbzxtBAg_JGTfJtr4';
const MODEL = process.env.OPENAI_FIS_MODEL || 'gpt-4.1';

const sayi = v => { if (typeof v === 'number') return v; const n = Number(String(v ?? '').replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

exports.handler = async event => {
  const bearer = /^Bearer\s+(.+)$/i.exec(event.headers.authorization || event.headers.Authorization || '')?.[1];
  const body = JSON.parse(event.body || '{}');
  const fisId = String(body.fisId || '').replace(/[^0-9a-f-]/gi, '');
  if (!bearer || !fisId) return;
  const H = { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${bearer}` };
  const yaz = (veri, yol = `ug_fis?id=eq.${fisId}`, method = 'PATCH') => fetch(`${SUPABASE_URL}/rest/v1/${yol}`, { method, headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(veri) });
  try {
    const fis = (await (await fetch(`${SUPABASE_URL}/rest/v1/ug_fis?id=eq.${fisId}&select=*`, { headers: H })).json())?.[0];
    if (!fis) return;
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY eksik');
    const gorseller = [];
    for (const d of fis.dosyalar || []) {
      if (!d.yol) continue;
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/fisler/${d.yol}`, { headers: H });
      if (!r.ok) throw new Error('Fiş görseli alınamadı (' + r.status + ')');
      gorseller.push(`data:${r.headers.get('content-type') || 'image/jpeg'};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`);
    }
    if (!gorseller.length) throw new Error('Fişte görsel yok');
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(240000),
      body: JSON.stringify({ model: MODEL, temperature: 0, response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [{ type: 'text', text: String(body.talimat || '').slice(0, 12000) }, ...gorseller.map(url => ({ type: 'image_url', image_url: { url, detail: 'high' } }))] }] })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message || 'OpenAI ' + r.status);
    const ham = JSON.parse(j?.choices?.[0]?.message?.content || '{}');
    const liste = Array.isArray(ham?.fisler) ? ham.fisler : [];
    if (!liste.length) throw new Error('Fişte satır bulunamadı');
    const sonuc = liste.map(f => {
      const satirlar = (f.gruplar || []).flatMap(g => (g.satirlar || []).map(s => ({ adet: sayi(s.adet), urun: String(s.urun || '').trim().toLocaleUpperCase('tr'), fiyat: sayi(s.fiyat), grup: String(g.gonderilen || '').trim() })));
      const toplam = satirlar.reduce((a, s) => a + s.adet * s.fiyat, 0);
      const sorular = (f.sorular || []).map(String).filter(Boolean);
      if (sayi(f.fisToplami) && Math.abs(sayi(f.fisToplami) - toplam) > 0.5) sorular.push(`Fişte toplam ${sayi(f.fisToplami).toLocaleString('tr-TR')} ₺ yazıyor, satırların toplamı ${toplam.toLocaleString('tr-TR')} ₺.`);
      return { tarih: /^\d{4}-\d{2}-\d{2}$/.test(f.tarih || '') ? f.tarih : null, ust: String(f.ust || ''), satirlar, sorular };
    });
    await yaz({ ...sonuc[0], durum: 'okundu', okuma_hata: null, guncel: new Date().toISOString() });
    // tek fotoğrafta birden çok fiş: her biri ayrı kayıt olur
    for (const ek of sonuc.slice(1)) await yaz({ ...ek, firma: fis.firma, dosyalar: fis.dosyalar, durum: 'okundu' }, 'ug_fis', 'POST');
  } catch (e) {
    await yaz({ durum: 'hata', okuma_hata: String(e?.message || e).slice(0, 300), guncel: new Date().toISOString() }).catch(() => {});
  }
};
