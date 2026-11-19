// Vercel Edge Function: info asset. Kalau API info ditolak (403 dll), tetap balas "partial"
// supaya file tetap bisa diunduh dan tipenya dideteksi dari isi file.
export const config = { runtime: 'edge', regions: ['sin1', 'hnd1', 'iad1'] };

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', Accept: 'application/json' };
const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': s === 200 && !o.partial ? 'public, max-age=300' : 'no-store' } });
const get = async url => { try { return await fetch(url, { headers: UA }); } catch { return null; } };

export default async function handler(req) {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^\d{1,19}$/.test(id)) return json({ error: 'ID tidak valid' }, 400);

  const [eco, th] = await Promise.all([
    get(`https://economy.roblox.com/v2/assets/${id}/details`),
    get(`https://thumbnails.roblox.com/v1/assets?assetIds=${id}&size=420x420&format=Png&isCircular=false`),
  ]);
  const thumbJ = th && th.ok ? await th.json().catch(() => null) : null;
  const thumb = thumbJ && thumbJ.data && thumbJ.data[0] && thumbJ.data[0].imageUrl || null;
  const log = [];

  if (eco && eco.ok) {
    const a = await eco.json();
    return json({
      id: a.AssetId, name: a.Name, description: a.Description, typeId: a.AssetTypeId,
      creator: a.Creator ? { name: a.Creator.Name, type: a.Creator.CreatorType, id: a.Creator.Id } : null,
      created: a.Created, updated: a.Updated, price: a.PriceInRobux, forSale: a.IsForSale, thumb,
    });
  }
  if (eco && (eco.status === 400 || eco.status === 404)) return json({ error: 'Asset tidak ditemukan' }, 404);
  log.push('economy: ' + (eco ? 'HTTP ' + eco.status : 'gagal terhubung'));

  // Cadangan: toolbox service
  const tb = await get(`https://apis.roblox.com/toolbox-service/v1/items/details?assetIds=${id}`);
  if (tb && tb.ok) {
    const j = await tb.json().catch(() => null);
    const it = j && j.data && j.data[0], as = it && it.asset;
    if (as && as.typeId != null) {
      return json({
        id: as.id, name: as.name, description: as.description, typeId: as.typeId,
        creator: it.creator ? { name: it.creator.name, type: it.creator.type === 2 ? 'Group' : 'User', id: it.creator.id } : null,
        created: as.createTime, updated: as.updateTime, price: null, forSale: false, thumb,
      });
    }
  }
  log.push('toolbox: ' + (tb ? 'HTTP ' + tb.status : 'gagal terhubung'));

  // Terakhir: info minimal, tipe akan dideteksi dari file
  return json({ id, name: 'Asset ' + id, description: '', typeId: null, partial: true, debug: log.join(' | '), thumb });
}
