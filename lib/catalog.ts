import { qualityFromLabel } from './playback-quality.ts';
import { mergeMovies } from './movie-merge.ts';
export { mergeMovies } from './movie-merge.ts';
export type Variant = { source: string; sourceName: string; id: string };
export type Movie = { key: string; title: string; year: string; area: string; type: string; poster: string; remarks: string; description: string; actors: string; director: string; variants: Variant[] };
export type Episode = { name: string; url: string };
export type Line = { id: string; name: string; episodes: Episode[]; quality?: { height: number; verified: boolean } };
export type CatalogResult = { movies: Movie[]; sources: { id: string; name: string; ok: boolean; count: number; error?: string }[]; page: number; hasMore: boolean };
export const providers = [
  { id: 'ff', name: '非凡资源', api: 'https://api.ffzyapi.com/api.php/provide/vod/' },
  { id: 'hn', name: '红牛资源', api: 'https://www.hongniuzy2.com/api.php/provide/vod/' },
  { id: 'xl', name: '新浪资源', api: 'https://api.xinlangapi.com/xinlangapi.php/provide/vod/' },
  { id: 'jy', name: '金鹰资源', api: 'https://jyzyapi.com/provide/vod/' },
  { id: 'lz', name: '量子资源', api: 'https://cj.lziapi.com/api.php/provide/vod/' },
  { id: 'md', name: '魔都资源', api: 'https://www.mdzyapi.com/api.php/provide/vod/' },
  { id: 'sb', name: '速播资源', api: 'https://subocaiji.com/api.php/provide/vod/' },
  { id: 'hh', name: '豪华资源', api: 'https://hhzyapi.com/api.php/provide/vod/' },
];
export function clean(value: unknown): string { return String(value ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim(); }
export function safeUrl(value: unknown): string { try { const url = new URL(String(value)); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; } }
function seasonNumber(value: string) {
  if (/^\d+$/.test(value)) return String(Number(value));
  const digits = '零一二三四五六七八九';
  if (value.includes('十')) {
    const [tens, ones] = value.split('十');
    return String((tens ? digits.indexOf(tens) : 1) * 10 + (ones ? digits.indexOf(ones) : 0));
  }
  return String(digits.indexOf(value));
}
export function normalizeTitle(value: unknown) {
  return clean(value)
    .replace(/[（(](?:国语|粤语|普通话|原声|高清|蓝光|完整版|中字|正片)(?:版)?[）)]/g, '')
    .replace(/\s+/g, '')
    .replace(/第([一二三四五六七八九十\d]{1,3})(季|部)/g, (_, n: string, unit: string) => `第${seasonNumber(n)}${unit}`)
    .toLowerCase();
}
export function movieFrom(row: Record<string, unknown>, source: typeof providers[number]): Movie {
  const title = clean(row.vod_name), year = clean(row.vod_year);
  return { key: normalizeTitle(title) + ':' + year, title, year, area: clean(row.vod_area), type: clean(row.type_name), poster: safeUrl(row.vod_pic), remarks: clean(row.vod_remarks), description: clean(row.vod_content), actors: clean(row.vod_actor), director: clean(row.vod_director), variants: [{ source: source.id, sourceName: source.name, id: String(row.vod_id) }] };
}
export function parseLines(row: Record<string, unknown>, source: typeof providers[number]): Line[] {
  const from = String(row.vod_play_from ?? '').split('$$$');
  return String(row.vod_play_url ?? '').split('$$$').flatMap((group, index) => {
    const episodes = group.split('#').flatMap((entry, i) => {
      const sep = entry.indexOf('$'); const url = safeUrl(sep < 0 ? entry : entry.slice(sep + 1));
      return url && /\.(m3u8|mp4|m4v|webm)(?:[?#]|$)/i.test(url) ? [{ name: clean(sep < 0 ? `第${i + 1}集` : entry.slice(0, sep)), url }] : [];
    });
    return episodes.length ? [{ id: `${source.id}:${row.vod_id}:${index}`, quality: { height: qualityFromLabel([row.vod_name, row.vod_remarks, from[index]].join(' ')), verified: false }, name: source.name + (clean(row.vod_name).match(/[（(]([^）)]+)[）)]/)?.[1] ? ' · ' + clean(row.vod_name).match(/[（(]([^）)]+)[）)]/)![1] : from[index]?.includes('m3u8') ? ' · HLS' : ' · ' + (from[index] || '直连')), episodes }] : [];
  });
}
const cache = new Map<string, { at: number; value: Promise<Record<string, unknown>> }>();
const detailRows = new Map<string, { at: number; row: Record<string, unknown> }>();
export async function providerFetch(source: typeof providers[number], params: Record<string, string>) {
  // Search already requests ac=detail. Reuse those full records rather than
  // fetching the same large episode lists a second time for every source.
  if (params.ids) {
    const saved = detailRows.get(source.id + ':' + params.ids);
    if (saved && Date.now() - saved.at < 60000) return { list: [saved.row] };
  }
  const url = new URL(source.api); for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const key = url.href, hit = cache.get(key); if (hit && Date.now() - hit.at < 60000) return hit.value;
  const value = (async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json', 'User-Agent': 'ShiguangCinema/1.0' } });
    if (!response.ok) throw new Error(`来源暂时不可用（${response.status}）`);
    const data = await response.json() as Record<string, unknown>;
    if (!Array.isArray(data.list)) throw new Error('来源返回的数据格式不兼容');
    for (const row of data.list) {
      if (!row || typeof row !== 'object' || row.vod_id === undefined) continue;
      if (detailRows.size >= 160) detailRows.delete(detailRows.keys().next().value!);
      detailRows.set(source.id + ':' + row.vod_id, { at: Date.now(), row });
    }
    return data;
  })();
  if (cache.size >= 160) cache.delete(cache.keys().next().value!); cache.set(key, { at: Date.now(), value });
  try { return await value; } catch (error) { cache.delete(key); throw error; }
}
export async function searchCatalog(query: string, page = 1): Promise<CatalogResult> {
  const results = await Promise.all(providers.map(async source => {
    try {
      const data = await providerFetch(source, { ac: 'detail', pg: String(page), ...(query ? { wd: query } : {}) });
      const movies = (data.list as Record<string, unknown>[]).filter(r => !/伦理片|伦理|福利|情色|写真|成人/.test(clean(r.type_name))).map(row => movieFrom(row, source));
      return { movies, source: { id: source.id, name: source.name, ok: true, count: movies.length }, hasMore: page < Number(data.pagecount || 1) };
    } catch { return { movies: [], source: { id: source.id, name: source.name, ok: false, count: 0, error: '暂时无法连接，请稍后重试' }, hasMore: false }; }
  }));
  return { movies: mergeMovies(results.flatMap(r => r.movies)), sources: results.map(r => r.source), page, hasMore: results.some(r => r.hasMore) };
}

