// Vercel Edge Function: info asset (nama, creator, tipe, thumbnail)
export const config = { runtime: 'edge' };

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } });

export default async function handler(req) {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^\d{1,19}$/.test(id)) return json({ error: 'ID tidak valid' }, 400);

  try {
    const [d, t] = await Promise.all([
      fetch(`https://economy.roblox.com/v2/assets/${id}/details`),
      fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${id}&size=420x420&format=Png&isCircular=false`),
    ]);
    if (!d.ok) return json({ error: d.status === 400 || d.status === 404 ? 'Asset tidak ditemukan' : `Roblox error (HTTP ${d.status})` }, d.status === 404 || d.status === 400 ? 404 : 502);
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
    return json({ error: 'Gagal menghubungi Roblox' }, 502);
  }
}
