// Vercel Edge Function: ambil file asset dari Roblox (streaming).
// Urutan: v2 assetId -> v1 asset/?id= (cara yang dipakai tombol download BTRoblox) -> v1 batch
export const config = { runtime: 'edge', regions: ['sin1', 'hnd1', 'iad1'] };

const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const json = (o, s) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const okHost = u => { try { return /(\.rbxcdn\.com|\.roblox\.com)$/.test(new URL(u).hostname); } catch { return false; } };
const stream = r => new Response(r.body, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' } });

export default async function handler(req) {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^\d{1,19}$/.test(id)) return json({ error: 'ID tidak valid' }, 400);
  const log = [];
  const H = { 'User-Agent': BROWSER, Accept: 'application/json' };

  // 1) v2 assetId -> lokasi CDN
  try {
    const r = await fetch(`https://assetdelivery.roblox.com/v2/assetId/${id}`, { headers: H });
    const j = await r.json().catch(() => ({}));
    const loc = j.locations && j.locations[0] && j.locations[0].location;
    if (loc && okHost(loc)) { const f = await fetch(loc, { headers: { 'User-Agent': BROWSER } }); if (f.ok) return stream(f); log.push('cdn: HTTP ' + f.status); }
    else log.push('v2: HTTP ' + r.status + (j.errors && j.errors[0] ? ' ' + (j.errors[0].message || j.errors[0].code) : ''));
  } catch (e) { log.push('v2: ' + e.message); }

  // 2) v1 asset/?id= (redirect ke CDN; sama seperti link download BTRoblox)
  try {
    const r = await fetch(`https://assetdelivery.roblox.com/v1/asset/?id=${id}`, { headers: { 'User-Agent': BROWSER } });
    if (r.ok && okHost(r.url)) return stream(r);
    log.push('v1/asset: HTTP ' + r.status);
  } catch (e) { log.push('v1/asset: ' + e.message); }

  // 3) v1 batch (untuk asset seperti audio yang menolak GET biasa)
  try {
    const r = await fetch('https://assetdelivery.roblox.com/v1/assets/batch', {
      method: 'POST',
      headers: { 'User-Agent': 'Roblox/WinInet', 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify([{ assetId: Number(id), requestId: '0' }]),
    });
    const j = await r.json().catch(() => null);
    const it = Array.isArray(j) ? j[0] : null, loc = it && it.location;
    if (loc && okHost(loc)) { const f = await fetch(loc, { headers: { 'User-Agent': BROWSER } }); if (f.ok) return stream(f); log.push('batch-cdn: HTTP ' + f.status); }
    else log.push('batch: HTTP ' + r.status + (it && it.errors && it.errors[0] ? ' ' + (it.errors[0].Message || it.errors[0].message || it.errors[0].Code) : ''));
  } catch (e) { log.push('batch: ' + e.message); }

  const denied = log.some(l => /403|authoriz|permission|forbidden/i.test(l));
  return json({ error: (denied ? 'Roblox menolak akses (asset private / tanpa izin, atau IP server diblokir). ' : 'File asset tidak tersedia. ') + '[' + log.join(' | ') + ']' }, denied ? 403 : 404);
}
