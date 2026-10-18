import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLines, normalizeTitle, searchCatalog, providers, mergeMovies } from '../lib/catalog.ts';

test('剧集解析：保留 HLS 和 MP4，忽略网页线路与危险协议', () => {
  const lines = parseLines({ vod_id: 1, vod_name: '测试', vod_play_from: 'web$$$hls', vod_play_url: '网页$https://example.com/share/1$$$第1集$https://example.com/1.m3u8?token=a$b#第2集$https://example.com/2.mp4#无效$javascript:alert(1)' }, providers[0]);
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0].episodes.map(e => e.name), ['第1集', '第2集']);
  assert.equal(lines[0].episodes[0].url, 'https://example.com/1.m3u8?token=a$b');
});

test('同一影片的语言版本可归并，不合并续集', () => {
  assert.equal(normalizeTitle('新警察故事 （国语版）'), normalizeTitle('新警察故事（粤语版）'));
  assert.notEqual(normalizeTitle('新警察故事2'), normalizeTitle('新警察故事'));
  assert.equal(normalizeTitle('现在就出发 第4季'), normalizeTitle('现在就出发第四季'));
  assert.notEqual(normalizeTitle('现在就出发第三季'), normalizeTitle('现在就出发第四季'));
  assert.equal(normalizeTitle('第十一季'), normalizeTitle('第11季'));
});

test('跨来源合并保留所有版本，并去除重复版本 ID', () => {
  const base = { key: '同片:2024', title: '同片', year: '2024', type: '电影' };
  const a = { ...base, variants: [{ source: 'ff', id: '1' }] };
  const b = { ...base, variants: [{ source: 'hn', id: '2' }, { source: 'ff', id: '1' }] };
  const result = mergeMovies([a, b]);
  assert.equal(result.length, 1);
  assert.equal(result[0].variants.length, 2);
  assert.equal(a.variants.length, 1);
});

test('独立来源聚合，并在一个来源失败时保留可用结果', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    if (new URL(url).hostname !== 'www.hongniuzy2.com') throw new Error('source unavailable');
    return Response.json({ pagecount: 2, list: [{ vod_id: 7, vod_name: '测试影片', vod_year: '2024', type_name: '动作片' }] });
  };
  try {
    const result = await searchCatalog('adapter-test-unique');
    assert.equal(result.movies.length, 1);
    assert.equal(result.sources.filter(s => s.ok).length, 1);
    assert.equal(result.hasMore, true);
  } finally { globalThis.fetch = original; }
});
