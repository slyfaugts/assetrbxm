// Vercel Edge Function: info asset (nama, creator, tipe, thumbnail)
export const config = { runtime: 'edge', regions: ['sin1', 'hnd1', 'iad1'] };

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', Accept: 'application/json' };
const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': s === 200 ? 'public, max-age=300' : 'no-store' } });

export default async function handler(req) {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^\d{1,19}$/.test(id)) return json({ error: 'ID tidak valid' }, 400);

  try {
    const [d, t] = await Promise.all([
      fetch(`https://economy.roblox.com/v2/assets/${id}/details`, { headers: UA }),
      fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${id}&size=420x420&format=Png&isCircular=false`, { headers: UA }),
    ]);
    if (!d.ok) {
      const body = (await d.text().catch(() => '')).slice(0, 200);
      return json({ error: `Roblox economy API: HTTP ${d.status}${body ? ' - ' + body : ''}` }, d.status === 404 || d.status === 400 ? 404 : 502);
    }
    const a = await d.json();
    const th = await t.json().catch(() => null);
    return json({
      id: a.AssetId,
      name: a.Name,
      description: a.Description,
      typeId: a.AssetTypeId,
      creator: a.Creator ? { name: a.Creator.Name, type: a.Creator.CreatorType, id: a.Creator.Id } : null,
      created: a.Created,
      updated: a.Updated,
      price: a.PriceInRobux,
      forSale: a.IsForSale,
      publicDomain: a.IsPublicDomain,
      thumb: th && th.data && th.data[0] && th.data[0].imageUrl ? th.data[0].imageUrl : null,
    });
  } catch (e) {
    return json({ error: 'Gagal menghubungi Roblox: ' + (e && e.message) }, 502);
  }
}
