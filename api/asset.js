// Vercel Edge Function: proxy file asset dari Roblox (menghindari CORS, streaming tanpa batas 4.5MB)
export const config = { runtime: 'edge' };

const json = (o, s) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export default async function handler(req) {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^\d{1,19}$/.test(id)) return json({ error: 'ID tidak valid' }, 400);

  try {
    const r = await fetch(`https://assetdelivery.roblox.com/v2/assetId/${id}`, { headers: { Accept: 'application/json' } });
    const j = await r.json().catch(() => ({}));

    if (j.errors && j.errors.length) {
      const e = j.errors[0];
      const code = [403, 404].includes(e.code) ? e.code : 502;
      return json({ error: code === 403 ? 'Tidak ada izin akses ke asset ini (private / bukan milik publik)' : e.message || 'Asset tidak tersedia' }, code);
    }
    const loc = j.locations && j.locations[0] && j.locations[0].location;
    if (!loc) return json({ error: 'File asset tidak tersedia' }, 404);

    const host = new URL(loc).hostname;
    if (!/(\.rbxcdn\.com|\.roblox\.com)$/.test(host)) return json({ error: 'Lokasi file tidak valid' }, 400);

    const f = await fetch(loc);
    if (!f.ok) return json({ error: `Gagal mengambil file (HTTP ${f.status})` }, 502);

    return new Response(f.body, {
      headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (e) {
    return json({ error: 'Gagal menghubungi Roblox' }, 502);
  }
}
