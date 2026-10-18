import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateVideoPage, playerFrameUrl } from '../lib/link-player.ts';

test('仅允许指定平台页面，拒绝伪装域名、危险协议和凭证', () => {
  for (const value of ['javascript:alert(1)','http://v.qq.com/x/page/1.html','https://v.qq.com.evil.test/x','https://evilv.qq.com.evil.test/x','https://user:pass@v.qq.com/x','https://127.0.0.1/x','https://v.qq.com:444/x']) assert.throws(() => validateVideoPage(value));
  assert.equal(validateVideoPage('https://v.qq.com/x/page/one.html#share'),'https://v.qq.com/x/page/one.html');
});

test('分享链接完整编码，不把源查询参数当成播放器参数', () => {
  const url='https://www.iqiyi.com/v_1.html?a=1&b=2';
  const frame=new URL(playerFrameUrl('txnp',url));
  assert.equal(frame.origin,'https://bfq.txnp.cn');
  assert.equal(frame.searchParams.get('url'),url);
  assert.equal([...frame.searchParams.keys()].length,1);
  assert.throws(() => playerFrameUrl('custom',url));
});

test('腾讯超长推荐链接规范化，保留真正分集信息', () => {
 const page='https://v.qq.com/x/cover/mzc002001bk7moh/f4102coahzq.html';
 assert.equal(validateVideoPage(page+'?report_recomm_player='+ 'x'.repeat(4000)), page);
 assert.equal(new URL(playerFrameUrl('lxyy',page+'?report_recomm_player=tracking')).searchParams.get('url'),page);
 assert.equal(validateVideoPage('https://www.bilibili.com/video/BV123?p=2'),'https://www.bilibili.com/video/BV123?p=2');
});
