// Vercel Edge Function: proxy file asset dari Roblox (streaming, tanpa batas 4.5MB)
export const config = { runtime: 'edge', regions: ['sin1', 'hnd1', 'iad1'] };

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', Accept: 'application/json' };
const json = (o, s) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const okHost = u => /(\.rbxcdn\.com|\.roblox\.com)$/.test(new URL(u).hostname);

// Beberapa endpoint delivery dicoba berurutan; yang pertama sukses dipakai
async function findLocation(id) {
  const tries = [
    `https://assetdelivery.roblox.com/v2/assetId/${id}`,
    `https://apis.roblox.com/asset-delivery-api/v1/assetId/${id}`,
    `https://assetdelivery.roblox.com/v1/assetId/${id}`,
  ];
  const log = [];
  for (const url of tries) {
    try {
      const r = await fetch(url, { headers: { ...UA, 'Roblox-Place-Id': '0' } });
      const j = await r.json().catch(() => ({}));
      const loc = j.location || (j.locations && j.locations[0] && j.locations[0].location);
      if (loc) return { loc, log };
      const e = j.errors && j.errors[0];
      log.push(`${new URL(url).host}${new URL(url).pathname.split('/').slice(0, 3).join('/')}: HTTP ${r.status}${e ? ' ' + (e.message || e.code) : ''}`);
    } catch (e) {
      log.push(`${url}: ${e.message}`);
    }
  }
  return { loc: null, log };
}

export default async function handler(req) {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^\d{1,19}$/.test(id)) return json({ error: 'ID tidak valid' }, 400);

  try {
    const { loc, log } = await findLocation(id);
    if (!loc) {
      const denied = log.some(l => /403|not authorized|permission/i.test(l));
      return json({ error: (denied ? 'Roblox menolak akses (403): asset private / tidak ada izin, atau IP server diblokir. ' : 'File asset tidak tersedia. ') + '[' + log.join(' | ') + ']' }, denied ? 403 : 404);
    }
    if (!okHost(loc)) return json({ error: 'Lokasi file tidak valid' }, 400);

    const f = await fetch(loc, { headers: { 'User-Agent': UA['User-Agent'] } });
    if (!f.ok) return json({ error: `Gagal mengambil file dari CDN (HTTP ${f.status})` }, 502);

    return new Response(f.body, {
      headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (e) {
    return json({ error: 'Gagal menghubungi Roblox: ' + (e && e.message) }, 502);
  }
}
