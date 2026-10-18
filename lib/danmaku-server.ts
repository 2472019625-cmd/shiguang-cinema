import { clean, normalizeTitle } from './catalog';
import { episodeNumber, normalizeComments } from './danmaku-types.ts';
import type { DanmakuCandidate, DanmakuEpisode, DanmakuSegment } from './danmaku-types';

// Only these fixed public JSON endpoints are used. No user-supplied URLs/proxies.
const SEARCH = 'https://pbaccess.video.qq.com/trpc.videosearch.mobile_search.MultiTerminalSearch/MbSearch?vplatform=2';
const EPISODES = 'https://pbaccess.video.qq.com/trpc.universal_backend_service.page_server_rpc.PageServer/GetPageData?video_appid=3000010&vversion_name=8.2.96&vversion_platform=2';
const cache = new Map<string, { at: number; value: Promise<unknown> }>();
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 300000) return hit.value as Promise<T>;
  if (cache.size >= 96) cache.delete(cache.keys().next().value!);
  const value = load(); cache.set(key, { at: Date.now(), value });
  try { return await value; } catch (error) { cache.delete(key); throw error; }
}
async function json(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': 'ShiguangCinema/1.0', 'Content-Type': 'application/json', Accept: 'application/json', Referer: 'https://v.qq.com/', Origin: 'https://v.qq.com' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error('弹幕来源暂时不可用');
  return response.json() as Promise<Record<string, any>>;
}
export function danmakuSearch(title: string, year: string) {
  return cached(`search:${title}:${year}`, async () => {
    const data = await json(SEARCH, {
      query: title, clientType: 1, version: '25071701', uuid: crypto.randomUUID(),
      pagenum: 0, pagesize: 30, isPrefetch: true, queryFrom: 0, filterValue: '', retry: 0,
      searchDatakey: '', transInfo: '', isneedQc: true, preQid: '', adClientInfo: '',
      extraInfo: { multi_terminal_pc: '1', themeType: '1', sugRelatedIds: '{}', appVersion: '' },
    });
    if (data.ret !== 0) throw new Error('弹幕搜索暂时不可用');
    const rows = [...(data.data?.normalList?.itemList || []), ...(data.data?.areaBoxList || []).flatMap((b: any) => b.itemList || [])];
    const found = new Map<string, DanmakuCandidate>();
    for (const row of rows) {
      const video = row.videoInfo, id = String(row.doc?.id || '');
      if (row.doc?.dataType !== 2 || !/^[a-zA-Z0-9]{10,20}$/.test(id) || !video) continue;
      const sites = [...(video.episodeSites || []), ...(video.playSites || [])];
      if (!sites.some(s => s.enName === 'qq' && s.episodeInfoList?.some((ep: any) => /^[a-zA-Z0-9]{11}$/.test(ep.id)))) continue;
      const name = clean(video.title), candidateYear = video.year ? String(video.year) : '';
      const exact = normalizeTitle(name) === normalizeTitle(title) && (!year || !candidateYear || year === candidateYear);
      found.set(id, { id, title: name, year: candidateYear, exact });
    }
    return [...found.values()].sort((a, b) => Number(b.exact) - Number(a.exact)).slice(0, 20);
  });
}
export function danmakuEpisodes(cid: string, page: number) {
  return cached(`episodes:${cid}:${page}`, async () => {
    const context = new URLSearchParams({ cid, detail_page_type: '1', req_from: 'web_vsite', req_type: '0', page_num: String(page), page_size: '30', episode_begin: String(page * 30 + 1), episode_end: String(page * 30 + 30), episode_step: '30', tab_type: '1', id_type: '1' });
    const data = await json(EPISODES, { has_cache: 1, page_params: { req_from: 'web_vsite', page_id: 'vsite_episode_list', page_type: 'detail_operation', id_type: '1', page_size: '30', cid, vid: '', lid: '', page_num: String(page), page_context: context.toString(), detail_page_type: '1' } });
    if (data.ret !== 0) throw new Error('暂时无法获取弹幕分集');
    const found = new Map<string, DanmakuEpisode>(); let total = 0;
    function visit(value: any, depth = 0) {
      if (!value || depth > 16) return;
      if (Array.isArray(value)) { for (const item of value) visit(item, depth + 1); return; }
      if (typeof value !== 'object') return;
      if (value.tabs && typeof value.tabs === 'string') {
        try { for (const tab of JSON.parse(value.tabs)) total = Math.max(total, Number(tab.end) || 0); } catch {}
      }
      if (/^[a-zA-Z0-9]{11}$/.test(String(value.vid || '')) && value.title !== undefined) {
        const name = clean(value.title), label = clean(value.union_title || name);
        if (!/预告|花絮|解说|片段|抢先|彩蛋/.test(label)) found.set(value.vid, { id: value.vid, name: label || name, number: episodeNumber(name), duration: Number(value.duration) || 0 });
        return;
      }
      for (const child of Object.values(value)) visit(child, depth + 1);
    }
    visit(data.data);
    return { episodes: [...found.values()], total, page };
  });
}
export function danmakuSegment(vid: string, time: number) {
  const bucket = Math.floor(time / 30);
  return cached(`segment:${vid}:${bucket}`, async (): Promise<DanmakuSegment> => {
    const base = await cached(`base:${vid}`, () => json(`https://dm.video.qq.com/barrage/base/${vid}`));
    const segments = Object.values((base as any).segment_index || {}) as { segment_start: string; segment_name: string }[];
    const selected = segments.find(s => Number(s.segment_start) <= time * 1000 && Number(s.segment_name.split('/').at(-1)) > time * 1000);
    if (!selected || !/^[a-zA-Z0-9/_-]{1,100}$/.test(selected.segment_name)) return { start: bucket * 30, end: bucket * 30 + 30, comments: [] };
    const data = await json(`https://dm.video.qq.com/barrage/segment/${vid}/${selected.segment_name}`);
    return { start: Number(selected.segment_start) / 1000, end: Number(selected.segment_name.split('/').at(-1)) / 1000, comments: normalizeComments(data.barrage_list) };
  });
}
