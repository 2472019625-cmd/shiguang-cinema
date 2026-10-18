import { danmakuSearch, danmakuEpisodes, danmakuSegment } from '@/lib/danmaku-server';
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams, action = params.get('action');
  try {
    if (action === 'search') {
      const title = (params.get('title') || '').trim(), year = params.get('year') || '';
      if (!title || title.length > 100 || !/^\d{0,4}$/.test(year)) return Response.json({ error: '片名参数不正确' }, { status: 400 });
      return Response.json({ candidates: await danmakuSearch(title, year), source: '腾讯视频公开弹幕' });
    }
    if (action === 'episodes') {
      const cid = params.get('cid') || '', page = Number(params.get('page') || 0);
      if (!/^[a-zA-Z0-9]{10,20}$/.test(cid) || !Number.isInteger(page) || page < 0 || page > 499) return Response.json({ error: '弹幕分集参数不正确' }, { status: 400 });
      return Response.json(await danmakuEpisodes(cid, page));
    }
    if (action === 'segment') {
      const vid = params.get('vid') || '', time = Number(params.get('time') || 0);
      if (!/^[a-zA-Z0-9]{11}$/.test(vid) || !Number.isFinite(time) || time < 0 || time > 172800) return Response.json({ error: '弹幕时间参数不正确' }, { status: 400 });
      return Response.json(await danmakuSegment(vid, time));
    }
    return Response.json({ error: '未知弹幕操作' }, { status: 400 });
  } catch { return Response.json({ error: '弹幕来源暂时不可用，可稍后重试；不影响视频播放。' }, { status: 502 }); }
}
