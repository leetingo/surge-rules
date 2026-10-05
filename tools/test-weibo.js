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

test('他人主页：去掉嵌套广告，保留未关注用户、置顶和普通推荐', () => {
  const pinned = { category: 'feed', data: { ...normal, id: 'pinned', readtimetype: 'adMblog', ad_marked: false }, isTop: true };
  const recommendation = { category: 'card', data: { card_type: 10, desc: '可能感兴趣的人' } };
  const input = { userInfo: { name: '用户' }, items: [pinned, feed(ad), { category: 'group', items: [feed(normal), feed(ad)] }, recommendation] };
  const expected = { ...input, items: [pinned, { category: 'group', items: [feed(normal)] }, recommendation] };
  assert.deepEqual(JSON.parse(run('profile/container_timeline?uid=123', input, 'follow_rec=all')), expected);
});

test('主页广告开关独立，关闭后原样放行', () => {
  const input = { items: [feed(ad), feed(normal)] };
  assert.equal(run('profile/container_timeline?uid=123', input, 'profile_ad=false'), JSON.stringify(input));
  assert.deepEqual(JSON.parse(run('profile/container_timeline?uid=123', input, 'feed_ad=false')), { items: [feed(normal)] });
  assert.equal(run('profile/container_timeline?uid=123', input, 'profile_ad=true', { profile_ad: false }), JSON.stringify(input));
});

test('卡片列表递归去广告，保留无广告标记的卡片和分页信息', () => {
  const card = { card_type: 9, mblog: normal };
  const banner = { card_type: 118, title: '正常横幅' };
  const input = { cards: [{ card_group: [card, { card_type: 9, mblog: ad }, banner] }], cardlistInfo: { since_id: 'next' } };
  for (const endpoint of ['cardlist?containerid=100', 'page?containerid=100', 'video/community_tab?type=1']) {
    assert.deepEqual(JSON.parse(run(endpoint, input)), { ...input, cards: [{ card_group: [card, banner] }] });
    assert.equal(run(endpoint, input, 'feed_ad=false'), JSON.stringify(input));
  }
});

test('旧版时间线、转发流和搜索：兼容各自列表结构', () => {
  for (const endpoint of ['statuses/unread_hot_timeline?', 'statuses/friends/timeline?', 'statuses/unread_friends_timeline?', 'groups/timeline?', 'statuses/video_mixtimeline?', 'video/tiny_stream_video_list?']) {
    const input = { statuses: [normal, ad], ad: { id: 'slot' }, advertises: [ad], next_cursor: 123 };
    assert.deepEqual(JSON.parse(run(endpoint, input)), { statuses: [normal], next_cursor: 123 });
  }
  assert.deepEqual(JSON.parse(run('statuses/repost_timeline?', { reposts: [ad, normal], hot_reposts: [normal, ad] })), { reposts: [normal], hot_reposts: [normal] });
  for (const endpoint of ['searchall?', 'search/container_discover?', 'flowlist?']) {
    assert.deepEqual(JSON.parse(run(endpoint, { items: [feed(ad), feed(normal)] })), { items: [feed(normal)] });
  }
});

test('视频预加载：过滤每组广告，保留普通视频及翻页信息', () => {
  const input = { lists: [{ items: [feed(ad), feed(normal)], moreInfo: { since_id: 'next' } }] };
  assert.deepEqual(JSON.parse(run('video/flow_stream_cache?', input)), { lists: [{ items: [feed(normal)], moreInfo: { since_id: 'next' } }] });
});

test('旧版评论广告：不删除普通评论及相关内容', () => {
  const comment = { id: 'comment', text: '评论' };
  const related = { adType: '相关内容', text: '相关内容' };
  const input = { datas: [comment, { adType: '广告' }, { adType: '热推' }, related] };
  assert.deepEqual(JSON.parse(run('comments/build_comments?', input)), { datas: [comment, related] });
  assert.equal(run('comments/build_comments?', input, 'comment_ad=false'), JSON.stringify(input));
});

test('旧版详情：只移除明确广告，保留正文、操作菜单和普通卡片', () => {
  const input = { head_cards: [{ is_ad: 1 }, { title: '普通卡片' }], trend: { extra_struct: { extBtnInfo: { btn_picurl: 'https://h5.sinaimg.cn/timeline_icon_ad_delete.png' } } }, custom_action_list: [{ type: 'share' }], text: '正文' };
  assert.deepEqual(JSON.parse(run('statuses/extend?', input)), { head_cards: [{ title: '普通卡片' }], custom_action_list: input.custom_action_list, text: '正文' });
  assert.equal(run('statuses/extend?', input, 'detail_ad=false'), JSON.stringify(input));
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

test('关闭新增过滤时不改变内容，支持 mapi 域名且与界面模块互斥', () => {
  const uiText = fs.readFileSync(path.join(root, 'modules/weibo-ui.sgmodule'), 'utf8');
  const uiPattern = new RegExp(uiText.match(/weibo\.ui\.response = .*?pattern=([^,]+)/)[1]);
  const input = { items: [feed(ad), feed(normal)], statuses: [ad, normal], lists: [{ items: [feed(ad)] }] };
  for (const endpoint of ['flowlist', 'cardlist', 'page', 'statuses/repost_timeline', 'video/flow_stream_cache', 'searchall', 'search/container_discover']) {
    assert.equal(run(endpoint, input, 'feed_ad=false&discover_banner=false&notify_nag=false'), JSON.stringify(input));
    assert.equal(uiPattern.test('https://api.weibo.cn/2/' + endpoint), false);
  }
  assert.equal(pattern.test('https://mapi.weibo.com/2/profile/container_timeline?'), true);
  assert.equal(uiPattern.test('https://api.weibo.cn/2/profile/container_timeline?'), false);
});

// 可选：在本机传入实际抓包，HAR 本身不复制到仓库，也不输出 URL 查询参数。
if (process.env.WEIBO_HAR_PATH) {
  test('HAR 回放：主页只移除广告，其余条目和全部元数据保持一致', () => {
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
}
