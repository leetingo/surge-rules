#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { isDeepStrictEqual } = require('node:util');
const { test } = require('node:test');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'scripts/weibo.js'), 'utf8');
const moduleText = fs.readFileSync(path.join(root, 'modules/weibo-adblock.sgmodule'), 'utf8');
const pattern = new RegExp(moduleText.match(/weibo\.ad\.response = .*?pattern=([^,]+)/)[1]);
const normal = { id: 'normal', user: { following: false }, text: '普通微博', retweeted_status: { is_ad: 1 } };
const ad = { id: 'advert', mblogtypename: '广告' };
const feed = (data) => ({ category: 'feed', data });

function run(endpoint, input, args = '', saved = null) {
  const url = 'https://api.weibo.cn/2/' + endpoint;
  assert.ok(pattern.test(url), '模块未接入 ' + endpoint);
  let output;
  const errors = [];
  const body = typeof input === 'string' ? input : JSON.stringify(input);
  vm.runInNewContext(source, {
    $request: { url }, $response: { body }, $argument: 'module=ad&' + args,
    $persistentStore: { read: () => saved && JSON.stringify({ v: 1, set: saved }) },
    $done: (value) => { output = value; },
    console: { log: (line) => { if (line.includes('出错')) errors.push(line); } },
  });
  assert.deepEqual(errors, []);
  assert.ok(output);
  return output.body === undefined ? body : output.body;
}

test('他人主页：过滤顶层广告，保留普通转发、置顶、推荐和未知容器', () => {
  const pinned = { category: 'feed', data: { ...normal, id: 'pinned', readtimetype: 'adMblog', ad_marked: false }, isTop: true };
  const recommendation = { category: 'card', data: { card_type: 10, desc: '可能感兴趣的人' } };
  const input = { userInfo: { name: '用户' }, items: [pinned, feed(ad), { category: 'group', items: [feed(normal), feed(ad)] }, recommendation] };
  const expected = { ...input, items: [pinned, { category: 'group', items: [feed(normal), feed(ad)] }, recommendation] };
  assert.deepEqual(JSON.parse(run('profile/container_timeline?uid=123', input, 'follow_rec=all')), expected);
});

test('主页广告开关独立，关闭后原样放行', () => {
  const input = { items: [feed(ad), feed(normal)] };
  assert.equal(run('profile/container_timeline?uid=123', input, 'profile_ad=false'), JSON.stringify(input));
  assert.deepEqual(JSON.parse(run('profile/container_timeline?uid=123', input, 'feed_ad=false')), { items: [feed(normal)] });
  assert.equal(run('profile/container_timeline?uid=123', input, 'profile_ad=true', { profile_ad: false }), JSON.stringify(input));
});

test('新增处理保留大整数，异常响应原样放行', () => {
  const result = run('profile/container_timeline?', '{"items":[{"data":{"id":1234567890123456789}},{"data":{"is_ad":1}}]}');
  assert.ok(result.includes('1234567890123456789'));
  for (const body of ['not json', 'null', '[]', '{"items":null}', '{"items":[null]}']) {
    assert.equal(run('profile/container_timeline?', body), body);
  }
});

test('模块不匹配写入接口、个人中心、用户资料和无关域名', () => {
  for (const url of ['https://api.weibo.cn/2/profile/me?', 'https://api.weibo.cn/2/users/show?', 'https://api.weibo.cn/2/page/button?', 'https://api.weibo.cn/2/statuses/repost?', 'https://other.example/2/profile/container_timeline?']) {
    assert.equal(pattern.test(url), false, url);
  }
});

test('未获实际广告 HAR 验证的扩展接口不发布', () => {
  for (const endpoint of ['cardlist', 'page', 'flowlist', 'groups/timeline', 'statuses/friends/timeline', 'statuses/unread_friends_timeline', 'statuses/unread_hot_timeline', 'statuses/repost_timeline', 'statuses/video_mixtimeline', 'video/community_tab', 'video/tiny_stream_video_list', 'video/flow_stream_cache', 'comments/build_comments', 'statuses/extend', 'searchall', 'search/container_discover']) {
    assert.equal(pattern.test('https://api.weibo.cn/2/' + endpoint + '?'), false, endpoint);
  }
  assert.equal(pattern.test('https://mapi.weibo.com/2/profile/container_timeline?'), false);
});

// 必须传入真实抓包才能通过发布验证；不复制 HAR 到仓库，不输出查询参数。
  test('HAR 回放：主页只移除广告，其余条目和全部元数据保持一致', () => {
    assert.ok(process.env.WEIBO_HAR_PATH, '发布验证必须设置 WEIBO_HAR_PATH，合成测试不能替代真实 HAR');
    const entries = JSON.parse(fs.readFileSync(process.env.WEIBO_HAR_PATH, 'utf8')).log.entries;
    let profiles = 0;
    let adverts = 0;
    for (const entry of entries) {
      const url = new URL(entry.request.url);
      if (url.hostname !== 'api.weibo.cn' || url.pathname !== '/2/profile/container_timeline') continue;
      const content = entry.response?.content;
      if (!content?.text || content.encoding) continue;
      const original = JSON.parse(content.text);
      // 独立使用抓包中的显式“广告”标签作为预期，不调用实现中的广告判定函数。
      const keep = original.items.filter((item) => item.data?.mblogtypename !== '广告');
      adverts += original.items.length - keep.length;
      profiles++;
      // 失败时只输出摘要，避免断言展开包含用户资料的完整响应。
      assert.ok(isDeepStrictEqual(JSON.parse(run('profile/container_timeline?replay=1', content.text)), { ...original, items: keep }), '主页发生了预期之外的改动');
      assert.ok(run('profile/container_timeline?replay=1', content.text, 'profile_ad=false') === content.text, '关闭过滤后响应应逐字保留');
    }
    assert.ok(profiles > 0, 'HAR 中必须有主页响应');
    assert.ok(adverts > 0, 'HAR 中必须有实际广告');
    console.log(`HAR: ${profiles} 个主页响应，精确移除 ${adverts} 条广告`);
  });
