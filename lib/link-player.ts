export const linkPlayers = [
  { id: 'lxyy', name: '线路一', domain: 'jx.lxyy.club', endpoint: 'https://jx.lxyy.club/index.php?url=' },
  { id: 'txnp', name: '线路二', domain: 'bfq.txnp.cn', endpoint: 'https://bfq.txnp.cn/player?url=' },
] as const;

const platforms = ['v.qq.com', 'iqiyi.com', 'youku.com', 'bilibili.com', 'b23.tv', 'mgtv.com', 'tv.sohu.com'];
export function validateVideoPage(value: string): string {
  if (value.length > 16384) throw new Error('链接过长，请使用影片页面的分享链接。');
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('请输入完整的视频页面链接。'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !platforms.some(host => url.hostname === host || url.hostname.endsWith('.' + host))) {
    throw new Error('请使用腾讯视频、爱奇艺、优酷、B站、芒果TV或搜狐的 HTTPS 视频页面链接。');
  }
  if (url.pathname === '/' && !url.search) throw new Error('请粘贴具体影片或剧集的页面链接。');
  // Tencent cover/page paths fully identify the episode. Recommendation
  // query strings can exceed 2KB and confuse third-party parsers.
  if (url.hostname === 'v.qq.com' && /^\/x\/(cover\/[^/]+\/|page\/)[^/]+\.html$/.test(url.pathname)) url.search = '';
  url.hash = '';
  return url.href;
}

export function playerFrameUrl(id: string, page: string): string {
  const provider = linkPlayers.find(p => p.id === id);
  if (!provider) throw new Error('播放线路不存在。');
  return provider.endpoint + encodeURIComponent(validateVideoPage(page));
}
