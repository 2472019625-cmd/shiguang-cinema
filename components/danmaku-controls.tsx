'use client';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { MessageSquareText, SlidersHorizontal, Maximize, RotateCcw } from 'lucide-react';
import type { Movie } from '@/lib/catalog';
import type { DanmakuCandidate, DanmakuComment, DanmakuEpisode, DanmakuSegment } from '@/lib/danmaku-types';
import { episodeNumber } from '@/lib/danmaku-types';

function stored(key: string) { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } }
function store(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
async function get<T>(query: Record<string, string>, signal: AbortSignal): Promise<T> {
  const response = await fetch('/api/danmaku?' + new URLSearchParams(query), { signal });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || '弹幕暂时不可用');
  return data;
}

export function DanmakuControls({ videoRef, canvasRef, surfaceRef, movie, episodeName }: {
  videoRef: RefObject<HTMLVideoElement | null>; canvasRef: RefObject<HTMLCanvasElement | null>;
  surfaceRef: RefObject<HTMLDivElement | null>; movie: Movie; episodeName: string;
}) {
  const [enabled, setEnabled] = useState(true), [opacity, setOpacity] = useState(0.8), [density, setDensity] = useState(6), [offset, setOffset] = useState(0);
  const [candidates, setCandidates] = useState<DanmakuCandidate[]>([]), [cid, setCid] = useState(''), [episodes, setEpisodes] = useState<DanmakuEpisode[]>([]), [vid, setVid] = useState('');
  const [page, setPage] = useState(0), [total, setTotal] = useState(0), [message, setMessage] = useState('正在匹配弹幕…'), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  const [comments, setComments] = useState<DanmakuComment[]>([]);
  const loadedRef = useRef(false);
  useEffect(() => {
    const settings = stored('sg-danmaku-settings-v1');
    if (typeof settings.enabled === 'boolean') setEnabled(settings.enabled);
    if (Number.isFinite(settings.opacity)) setOpacity(Math.max(0.2, Math.min(1, settings.opacity)));
    if ([3, 6, 10].includes(settings.density)) setDensity(settings.density);
    loadedRef.current = true;
  }, []);
  useEffect(() => { if (loadedRef.current) store('sg-danmaku-settings-v1', { enabled, opacity, density }); }, [enabled, opacity, density]);

  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController(); setMessage('正在匹配弹幕…'); setFailed(false);
    get<{ candidates: DanmakuCandidate[] }>({ action: 'search', title: movie.title, year: /^\d{4}$/.test(movie.year) ? movie.year : '' }, abort.signal)
      .then(data => {
        setCandidates(data.candidates);
        const remembered = stored('sg-danmaku-matches-v1')[movie.key];
        const exact = data.candidates.filter(c => c.exact);
        const match = data.candidates.find(c => c.id === remembered) || (exact.length === 1 ? exact[0] : undefined);
        setPage(Math.floor(Math.max(0, (episodeNumber(episodeName) || 1) - 1) / 30));
        setCid(match?.id || '');
        if (!match) setMessage(data.candidates.length ? '请在设置中选择弹幕版本' : '暂未找到可匹配的弹幕');
      }).catch(error => { if (!abort.signal.aborted) { setMessage(error.message); setFailed(true); } });
    return () => abort.abort();
  }, [movie.key, movie.title, movie.year, episodeName, enabled, retry]);

  useEffect(() => {
    if (!cid || !enabled) return;
    const abort = new AbortController(); setVid(''); setEpisodes([]); setComments([]); setMessage('正在匹配分集…'); setFailed(false);
    get<{ episodes: DanmakuEpisode[]; total: number }>({ action: 'episodes', cid, page: String(page) }, abort.signal)
      .then(data => {
        setEpisodes(data.episodes); setTotal(data.total);
        const number = episodeNumber(episodeName);
        const exact = number !== null ? data.episodes.find(ep => ep.number === number) : data.episodes.find(ep => ep.name.replace(/\s/g, '') === episodeName.replace(/\s/g, ''));
        const chosen = exact || (data.episodes.length === 1 && /电影|片/.test(movie.type) ? data.episodes[0] : undefined);
        setVid(chosen?.id || '');
        if (!chosen) setMessage(data.episodes.length ? '请在设置中确认弹幕集数' : '该版本暂无可用弹幕分集');
      }).catch(error => { if (!abort.signal.aborted) { setMessage(error.message); setFailed(true); } });
    return () => abort.abort();
  }, [cid, page, episodeName, movie.type, enabled, retry]);

  useEffect(() => {
    const video = videoRef.current;
    if (!vid || !enabled || !video) { setComments([]); return; }
    const abort = new AbortController(), cache = new Map<number, DanmakuSegment>(), pending = new Set<number>(), unavailable = new Set<number>();
    setMessage('正在加载弹幕…'); setFailed(false); setComments([]);
    const load = async (bucket: number) => {
      if (bucket < 0 || cache.has(bucket) || pending.has(bucket) || unavailable.has(bucket)) return;
      pending.add(bucket);
      try {
        const data = await get<DanmakuSegment>({ action: 'segment', vid, time: String(bucket * 30) }, abort.signal);
        if (abort.signal.aborted) return;
        cache.set(bucket, data);
        if (cache.size > 6) { const oldest = [...cache.keys()].sort((a, b) => Math.abs(b - bucket) - Math.abs(a - bucket))[0]; cache.delete(oldest); }
        const combined = [...new Map([...cache.values()].flatMap(s => s.comments).map(c => [c.id, c])).values()].sort((a, b) => a.time - b.time);
        setComments(combined); setMessage(combined.length ? `已加载 ${combined.length} 条 · 腾讯弹幕` : '这个时间段暂无弹幕'); setFailed(false);
      } catch (error) {
        if (!abort.signal.aborted) { unavailable.add(bucket); setMessage(error instanceof Error ? error.message : '弹幕加载失败'); setFailed(true); }
      } finally { pending.delete(bucket); }
    };
    const tick = () => { const t = Math.max(0, video.currentTime + offset), bucket = Math.floor(t / 30); void load(bucket); if (t % 30 > 23) void load(bucket + 1); };
    tick(); video.addEventListener('timeupdate', tick); video.addEventListener('seeked', tick);
    return () => { abort.abort(); video.removeEventListener('timeupdate', tick); video.removeEventListener('seeked', tick); };
  }, [vid, enabled, offset, retry, videoRef]);

  // Canvas follows video.currentTime directly: pause, seek, speed changes and resume
  // all use the same clock. No wall-clock animation or generated comments.
  useEffect(() => {
    const video = videoRef.current, canvas = canvasRef.current, context = canvas?.getContext('2d');
    if (!video || !canvas || !context) return;
    let frame = 0, width = 0, height = 0;
    let tracks: { comment: DanmakuComment; row: number; width: number }[] = [];
    const fontSize = () => width < 600 ? 16 : 22;
    const speed = () => width < 600 ? 75 : 110;
    const draw = () => {
      cancelAnimationFrame(frame); context.clearRect(0, 0, width, height);
      if (enabled) {
        const now = video.currentTime + offset;
        context.font = `600 ${fontSize()}px "PingFang SC", sans-serif`; context.globalAlpha = opacity;
        context.textBaseline = 'top'; context.lineWidth = 3; context.strokeStyle = '#000000bb';
        for (const track of tracks) {
          const elapsed = now - track.comment.time;
          if (elapsed < 0) break;
          const x = width - elapsed * speed(); if (x + track.width < 0 || x > width) continue;
          const y = 10 + track.row * (fontSize() + 10);
          context.fillStyle = track.comment.color; context.strokeText(track.comment.text, x, y); context.fillText(track.comment.text, x, y);
        }
      }
      if (!video.paused && !video.ended && enabled) frame = requestAnimationFrame(draw);
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width; height = rect.height; canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.font = `600 ${fontSize()}px "PingFang SC", sans-serif`;
      const rows = Math.max(1, Math.min(density, Math.floor(height * 0.62 / (fontSize() + 10)))), free = Array(rows).fill(-Infinity); tracks = [];
      for (const comment of comments) {
        const row = free.findIndex(at => at <= comment.time); if (row < 0) continue;
        const measured = context.measureText(comment.text).width;
        free[row] = comment.time + (measured + 45) / speed(); tracks.push({ comment, row, width: measured });
      }
      draw();
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    const events = ['play', 'pause', 'seeked', 'ratechange', 'loadedmetadata', 'ended'];
    for (const event of events) video.addEventListener(event, draw);
    resize();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); for (const event of events) video.removeEventListener(event, draw); context.clearRect(0, 0, width, height); };
  }, [comments, enabled, opacity, density, offset, videoRef, canvasRef]);

  const fullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (surfaceRef.current?.requestFullscreen) await surfaceRef.current.requestFullscreen(); else setMessage('当前浏览器请使用行内播放查看弹幕'); }
    catch { setMessage('当前浏览器暂不支持弹幕全屏'); }
  };
  return <div className="danmaku-toolbar">
    <button className={'danmaku-toggle ' + (enabled ? 'on' : '')} aria-pressed={enabled} onClick={() => setEnabled(v => !v)}><MessageSquareText size={15}/>弹幕 {enabled ? '开' : '关'}</button>
    <span className="danmaku-status" role="status" title={message}>{enabled ? message : '弹幕已关闭'}</span>
    {failed && enabled && <button aria-label="重新加载弹幕" onClick={() => setRetry(v => v + 1)}><RotateCcw size={14}/></button>}
    <details className="danmaku-settings"><summary><SlidersHorizontal size={14}/><span>弹幕设置</span></summary><div className="danmaku-popover">
      <strong>弹幕设置</strong>
      <label>透明度 <output>{Math.round(opacity * 100)}%</output><input aria-label="弹幕透明度" type="range" min="0.2" max="1" step="0.05" value={opacity} onChange={e => setOpacity(Number(e.target.value))}/></label>
      <label>屏幕密度<select aria-label="弹幕密度" value={density} onChange={e => setDensity(Number(e.target.value))}><option value="3">轻量</option><option value="6">适中</option><option value="10">热闹</option></select></label>
      <label>时间偏移（秒）<input aria-label="弹幕时间偏移" type="number" min="-600" max="600" step="0.5" value={offset} onChange={e => setOffset(Math.max(-600, Math.min(600, Number(e.target.value) || 0)))}/><small>正值让弹幕提前，负值延后。</small></label>
      <label>弹幕版本<select aria-label="选择弹幕版本" value={cid} onChange={e => { setCid(e.target.value); setVid(''); setPage(Math.floor(Math.max(0, (episodeNumber(episodeName) || 1) - 1) / 30)); store('sg-danmaku-matches-v1', { ...stored('sg-danmaku-matches-v1'), [movie.key]: e.target.value }); }}><option value="">{candidates.length ? '请选择与影片一致的版本' : '暂未找到匹配版本'}</option>{candidates.map(c => <option key={c.id} value={c.id}>{c.title}{c.year ? ` · ${c.year}` : ''}</option>)}</select></label>
      <label>弹幕集数<select aria-label="选择弹幕集数" value={vid} onChange={e => setVid(e.target.value)}><option value="">请确认分集</option>{episodes.map(ep => <option key={ep.id} value={ep.id}>{ep.name}</option>)}</select></label>
      {cid && total > 30 && <div className="danmaku-pages"><button disabled={page === 0} onClick={() => setPage(p => p - 1)}>上一组</button><span>{page * 30 + 1}–{Math.min(total, page * 30 + 30)}</span><button disabled={(page + 1) * 30 >= total} onClick={() => setPage(p => p + 1)}>下一组</button></div>}
      <p>匹配腾讯公开弹幕；不同片源片头可能有差异，可调整时间偏移。暂无发送弹幕功能。</p>
    </div></details>
    <button aria-label="带弹幕全屏" className="danmaku-fullscreen" onClick={fullscreen}><Maximize size={15}/><span>全屏</span></button>
  </div>;
}
