import type { Line } from './catalog';

export function qualityFromLabel(label: string): number {
  if (/抢先|枪版|\b(?:cam|tsrip)\b/i.test(label)) return 1;
  if (/\b8k\b|4320p/i.test(label)) return 4320;
  if (/\b4k\b|2160p|超高清/i.test(label)) return 2160;
  if (/1080[pi]/i.test(label)) return 1080;
  if (/720p/i.test(label)) return 720;
  if (/480p/i.test(label)) return 480;
  return 0;
}

export function manifestHeight(text: string): number {
  return Math.max(0, ...[...text.matchAll(/#EXT-X-STREAM-INF:[^\r\n]*RESOLUTION=\d+x(\d+)/gi)].map(m => Number(m[1])));
}

export function qualityLabel(line: Line): string {
  const q = line.quality;
  if (!q?.height) return '清晰度未知';
  const name = q.height === 1 ? '抢先版' : `${q.height}P`;
  return name + (q.verified ? ' · 清单实测' : ' · 来源标注未验证');
}

/** Bounded client-side probes: fixed media already returned by the catalog,
 * no server proxy. CORS/timeouts leave quality unknown rather than inventing it. */
export async function rankPlaybackLines(lines: Line[], episodeName?: string): Promise<Line[]> {
  const ranked = await Promise.all(lines.map(async line => {
    const episode = line.episodes.find(e => e.name === episodeName) || line.episodes[0];
    if (!episode || !/\.m3u8(?:[?#]|$)/i.test(episode.url)) return line;
    try {
      const response = await fetch(episode.url, { signal: AbortSignal.timeout(3000), credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) return line;
      const text = (await response.text()).slice(0, 524288);
      if (!text.trimStart().startsWith('#EXTM3U')) return line;
      const height = manifestHeight(text);
      return height ? { ...line, quality: { height, verified: true } } : line;
    } catch { return line; }
  }));
  return ranked.sort((a,b) => Number(!!b.quality?.verified) - Number(!!a.quality?.verified) || (b.quality?.height || 0) - (a.quality?.height || 0));
}
