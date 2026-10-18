import { test } from 'node:test';
import assert from 'node:assert/strict';
import { episodeNumber, normalizeComments } from '../lib/danmaku-types.ts';

test('分集匹配不会把日期、片名或预告中的数字误当集数', () => {
  assert.equal(episodeNumber('第001集'), 1);
  assert.equal(episodeNumber('1'), 1);
  assert.equal(episodeNumber('第12话 初战'), 12);
  assert.equal(episodeNumber('2026-10-18 第2期'), null);
  assert.equal(episodeNumber('预告1'), null);
  assert.equal(episodeNumber('HD国语'), null);
});

test('弹幕时间从毫秒转换，去重排序，并限制异常输入', () => {
  const data = normalizeComments([{ id:'2', time_offset:'2100', content:'后面' }, { id:'1', time_offset:'1000', content:'前面' }, { id:'1', time_offset:'1000', content:'前面' }, { id:'3', time_offset:-1, content:'无效' }, { id:'4', time_offset:'NaN', content:'无效' }, { id:'5', time_offset:2, content:' ' }]);
  assert.deepEqual(data.map(c => [c.time,c.text]), [[1,'前面'],[2.1,'后面']]);
  assert.equal(normalizeComments(null).length, 0);
  assert.equal(normalizeComments([{time_offset:0,content:'a'.repeat(200)}])[0].text.length, 120);
});
