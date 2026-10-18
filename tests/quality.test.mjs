import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qualityFromLabel, manifestHeight, rankPlaybackLines } from '../lib/playback-quality.ts';

test('只识别明确清晰度，HLS和蓝光不会伪装成1080P', () => {
  assert.equal(qualityFromLabel('HLS 蓝光 HD'), 0);
  assert.equal(qualityFromLabel('4K 2160P'), 2160);
  assert.equal(qualityFromLabel('1080P 抢先版'), 1);
  assert.equal(manifestHeight('#EXT-X-STREAM-INF:BANDWIDTH=1,RESOLUTION=1920x1080\na.m3u8\n#EXT-X-STREAM-INF:RESOLUTION=3840x2160\nb.m3u8'),2160);
});

test('清单分辨率优先，检测失败不丢线路，使用续播集检测', async () => {
  const original=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async url=>{calls.push(url);if(url.includes('fail'))throw new Error('CORS');return new Response('#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=1920x'+(url.includes('best')?'2160':'1080')+'\nv.m3u8');};
  const line=(id,height=0)=>({id,name:id,quality:{height,verified:false},episodes:[{name:'第1集',url:`https://example.com/${id}-1.m3u8`},{name:'第2集',url:`https://example.com/${id}-2.m3u8`}]});
  try {
    const result=await rankPlaybackLines([line('low'),line('fail',4320),line('best')],'第2集');
    assert.deepEqual(result.map(l=>l.id),['best','low','fail']);
    assert.equal(result[0].quality.verified,true);
    assert.ok(calls.every(url=>url.includes('-2.')));
  } finally {globalThis.fetch=original;}
});
