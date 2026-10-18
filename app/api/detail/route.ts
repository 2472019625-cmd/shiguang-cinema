import { movieFrom, parseLines, providers, providerFetch } from '@/lib/catalog';
export async function GET(request: Request) {
  const url = new URL(request.url), source = providers.find(p => p.id === url.searchParams.get('source')), id = url.searchParams.get('id') || '';
  if (!source || !/^\d{1,12}$/.test(id)) return Response.json({ error: '影片参数不正确' }, { status: 400 });
  try {
    const data = await providerFetch(source, { ac: 'detail', ids: id });
    const row = (data.list as Record<string, unknown>[]).find(r => String(r.vod_id) === id);
    if (!row) return Response.json({ error: '该影片已下架或不存在' }, { status: 404 });
    return Response.json({ movie: movieFrom(row, source), lines: parseLines(row, source) });
  } catch (error) { console.warn('Detail source unavailable:', source.id, error instanceof Error ? error.message : 'unknown'); return Response.json({ error: '暂时无法取得剧集，请重试或选择其他来源' }, { status: 502 }); }
}
