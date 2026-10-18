'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Link2, Play, RotateCcw } from 'lucide-react';
import { linkPlayers, playerFrameUrl, validateVideoPage } from '@/lib/link-player';

export default function LinkPlayback() {
  const [input, setInput] = useState('');
  const [page, setPage] = useState('');
  const [provider, setProvider] = useState<string>('lxyy');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [slow, setSlow] = useState(false);
  const frameUrl = page ? playerFrameUrl(provider, page) : '';
  const current = linkPlayers.find(p => p.id === provider)!;

  useEffect(() => {
    if (!page) return;
    const timer = setTimeout(() => setSlow(true), 18000);
    return () => clearTimeout(timer);
  }, [page, provider, attempt]);

  function play() {
    try {
      const url = validateVideoPage(input);
      setError(''); setInput(url); setSlow(false); setPage(url); setAttempt(n => n + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '链接格式不正确。'); }
  }

  return <main className="link-page">
    <header className="link-header"><a href="/" className="link-back"><ArrowLeft size={16}/>返回片库</a><a href="/" className="link-brand">拾光</a><span>链接播放</span></header>
    <section className="link-intro"><div className="eyebrow">PASTE. PLAY. ENJOY.</div><h1>好故事，<span>一键接着看。</span></h1><p>粘贴官方视频页面链接，尝试第三方线路。</p></section>
    <form className="link-form" onSubmit={e => { e.preventDefault(); play(); }}>
      <label htmlFor="video-page">视频页面链接</label>
      <div className="link-input-row"><Link2 size={19}/><input id="video-page" type="url" required maxLength={16384} autoComplete="off" placeholder="https://v.qq.com/… 或其他视频页面链接" value={input} onChange={e => setInput(e.target.value)} aria-describedby="link-help"/><button className="search-submit" type="submit"><Play size={15}/>开始播放</button></div>
      <p id="link-help">支持腾讯视频、爱奇艺、优酷、B站、芒果TV、搜狐。提交的链接会发送给所选第三方播放器。</p>
      {error && <p className="link-error" role="alert">{error}</p>}
    </form>
    <section className="link-screen" aria-label="链接播放器">
      <div className="link-frame">{frameUrl ? <iframe key={`${provider}:${page}:${attempt}`} src={frameUrl} title={`${current.name}第三方播放器`} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="no-referrer" onError={() => setSlow(true)}/> : <div className="link-placeholder"><Play size={35} strokeWidth={1}/><p>粘贴视频链接，开始下一段故事</p></div>}</div>
      <div className="link-controls"><div role="group" aria-label="播放线路">{linkPlayers.map(p => <button type="button" key={p.id} className={provider === p.id ? 'selected' : ''} aria-pressed={provider === p.id} onClick={() => { setProvider(p.id); setSlow(false); }}>{p.name}</button>)}</div>{page && <button className="link-retry" onClick={() => { setAttempt(n => n + 1); setSlow(false); }}><RotateCcw size={13}/>重新加载</button>}<span>{current.domain} · 第三方线路</span></div>
    </section>
    {page && <div className="link-feedback" role="status"><p>{slow ? '还没有播放画面？可以换一条线路，或打开播放器页面重试。' : '页面加载后，请点击播放器内的播放按钮；自动播放可能被浏览器阻止。'}</p><a href={frameUrl} target="_blank" rel="noopener noreferrer">打开播放器页面<ExternalLink size={13}/></a></div>}
    <p className="link-footnote">清晰度、片源和弹幕由第三方播放器提供，本站无法验证其画质或同步收藏、观看进度。线路可能暂时不可用。</p>
  </main>;
}
