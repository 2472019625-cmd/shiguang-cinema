export type DanmakuComment = { id: string; time: number; text: string; color: string };
export type DanmakuEpisode = { id: string; name: string; number: number | null; duration: number };
export type DanmakuCandidate = { id: string; title: string; year: string; exact: boolean };
export type DanmakuSegment = { start: number; end: number; comments: DanmakuComment[] };

export function episodeNumber(name: string): number | null {
  const match = name.trim().match(/^(?:第\s*)?(\d{1,4})\s*(?:集|话|期|$)/);
  return match ? Number(match[1]) : null;
}

export function normalizeComments(rows: unknown): DanmakuComment[] {
  if (!Array.isArray(rows)) return [];
  const unique = new Map<string, DanmakuComment>();
  for (const row of rows.slice(0, 3000)) {
    const time = Number(row?.time_offset) / 1000;
    const text = String(row?.content ?? '').trim().slice(0, 120);
    if (!Number.isFinite(time) || time < 0 || time > 172800 || !text) continue;
    const key = String(row?.id || `${time}:${text}`);
    unique.set(key, { id: key, time, text, color: '#ffffff' });
  }
  return [...unique.values()].sort((a, b) => a.time - b.time);
}
