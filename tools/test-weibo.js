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
const adModuleText = fs.readFileSync(path.join(root, 'modules/weibo-adblock.sgmodule'), 'utf8');
const uiModuleText = fs.readFileSync(path.join(root, 'modules/weibo-ui.sgmodule'), 'utf8');
const adPattern = new RegExp(adModuleText.match(/weibo\.ad\.response = .*?pattern=([^,]+)/)[1]);
const uiPattern = new RegExp(uiModuleText.match(/weibo\.ui\.response = .*?pattern=([^,]+)/)[1]);
const normal = { id: 'normal', user: { following: false }, text: '普通微博', retweeted_status: { is_ad: 1 } };
const ad = { id: 'advert', mblogtypename: '广告' };
const feed = (data) => ({ category: 'feed', data });

function runMod(mod, urlOrEndpoint, input, args = '', saved = null) {
  const url = urlOrEndpoint.startsWith('http') ? urlOrEndpoint : 'https://api.weibo.cn/2/' + urlOrEndpoint;
  const pat = mod === 'ad' ? adPattern : uiPattern;
  assert.ok(pat.test(url), `${mod} 模块未接入 ${url}`);
  let output;
  const errors = [];
  const body = typeof input === 'string' ? input : JSON.stringify(input);
  vm.runInNewContext(source, {
    $request: { url }, $response: { body }, $argument: `module=${mod}&` + args,
    $persistentStore: { read: () => saved && JSON.stringify({ v: 1, set: saved }) },
    $done: (value) => { output = value; },
    console: { log: (line) => { if (line.includes('出错')) errors.push(line); } },
  });
  assert.deepEqual(errors, []);
  assert.ok(output);
  return output.body === undefined ? body : output.body;
}

const run = (endpoint, input, args, saved) => runMod('ad', endpoint, input, args, saved);
const runUi = (endpoint, input, args, saved) => runMod('ui', endpoint, input, args, saved);

test('他人主页与微博分页：去掉嵌套广告和关注弹窗，保留未关注用户、置顶和普通推荐', () => {
  const pinned = { category: 'feed', data: { ...normal, id: 'pinned', readtimetype: 'adMblog', ad_marked: false }, isTop: true };
  const recommendation = { category: 'card', data: { card_type: 10, desc: '可能感兴趣的人' } };
  const input = {
    userInfo: { name: '用户' },
    loadedInfo: { follow_guide_info: { text: '关注' }, other: 1 },
    items: [pinned, feed(ad), { category: 'group', items: [feed(normal), feed(ad)] }, recommendation],
  };
  const expected = {
    userInfo: { name: '用户' },
    loadedInfo: { other: 1 },
    items: [pinned, { category: 'group', items: [feed(normal)] }, recommendation],
  };
  assert.deepEqual(JSON.parse(run('profile/container_timeline?uid=123', input, 'follow_rec=all')), expected);
  assert.deepEqual(JSON.parse(run('profile/statuses/tab?uid=123', { cards: [{ mblog: ad }, { mblog: normal }] })), { cards: [{ mblog: normal }] });
});

test('个人主页关注操作与底栏推荐：清理推荐卡片、催更、赞赏和弹窗', () => {
  const followInput = {
    cards: [{ id: 'rec1' }],
    toolbar_menus_new: { items: [{ identifier: 'chat' }, { identifier: 'recommend' }, { identifier: 'reward_1' }] },
  };
  const followExpected = {
    cards: [],
    toolbar_menus_new: { items: [{ identifier: 'chat' }] },
  };
  for (const ep of ['profile/dealatt?', 'friendships/create?', 'friendships/destroy?']) {
    assert.deepEqual(JSON.parse(run(ep, followInput)), followExpected);
    assert.equal(run(ep, followInput, 'profile_follow_rec=false'), JSON.stringify(followInput));
  }
  const userinfoInput = {
    footer: { data: { toolbar_menus_new: { lottie_guide: {}, servicePopup: { subData: {} }, items: [{ identifier: 'urge' }, { identifier: 'dm' }] } } },
  };
  const userinfoExpected = {
    footer: { data: { toolbar_menus_new: { servicePopup: {}, items: [{ identifier: 'dm' }] } } },
  };
  assert.deepEqual(JSON.parse(run('profile/userinfo?', userinfoInput)), userinfoExpected);
});

test('开屏旧接口：sdkad.php 保留 OK 后缀，wbpullad.lua 清空缓存广告', () => {
  const sdkInput = JSON.stringify({ needlocation: true, show_push_splash_ad: true, ads: [{ id: 1 }] }) + 'OK';
  const sdkOut = run('https://sdkapp.uve.weibo.com/interface/sdk/sdkad.php', sdkInput);
  assert.ok(sdkOut.endsWith('OK'));
  assert.deepEqual(JSON.parse(sdkOut.slice(0, -2)), { needlocation: false, show_push_splash_ad: false, ads: [] });
  assert.equal(run('https://sdkapp.uve.weibo.com/interface/sdk/sdkad.php', sdkInput, 'splash=false'), sdkInput);

  const wbInput = { cached_ad: { ads: [{ id: 1 }] } };
  assert.deepEqual(JSON.parse(run('https://wbapp.uve.weibo.com/wbapplua/wbpullad.lua?', wbInput)), { cached_ad: { ads: [] } });
});

test('视频流、小视频详情和预加载：支持视频广告清理及自动连播开关', () => {
  const streamInput = { statuses: [normal, ad], tab_list: [{ id: 1 }] };
  assert.deepEqual(JSON.parse(run('video/full_screen_stream?', streamInput)), { statuses: [normal], tab_list: [{ id: 1 }] });
  assert.deepEqual(JSON.parse(run('video/tiny_stream_video_list?', streamInput)), { statuses: [normal], tab_list: [{ id: 1 }] });
  assert.deepEqual(JSON.parse(run('video/tiny_stream_video_list?', streamInput, 'video_autoplay=true')), { statuses: [], tab_list: [] });
  assert.equal(run('video/full_screen_stream?', streamInput, 'video_ad=false'), JSON.stringify(streamInput));

  const midInput = { status: { video_info: { shopping: [{ id: 1 }], bottom_banner: { title: '搜' }, float_info: { id: 2 }, url: 'v.mp4' } } };
  assert.deepEqual(JSON.parse(run('video/tiny_stream_mid_detail?', midInput)), { status: { video_info: { shopping: [], url: 'v.mp4' } } });

  const cacheInput = { lists: [{ items: [feed(ad), feed(normal)], moreInfo: { since_id: 'next' } }] };
  assert.deepEqual(JSON.parse(run('video/flow_stream_cache?', cacheInput)), { lists: [{ items: [feed(normal)], moreInfo: { since_id: 'next' } }] });
});

test('超话搜索页、卡片流与热搜页：清理推广话题、广告词和置顶热搜', () => {
  const chSearch = { items: [{ data: { card_type: 1007 } }, { data: { card_type: 9, title: '正常' } }] };
  assert.deepEqual(JSON.parse(run('shproxy/chaohua/discovery/searchactive?', chSearch)), { items: [{ data: { card_type: 9, title: '正常' } }] });

  const pageInput = {
    top: { banner: 1 },
    cards: [
      { itemid: 'infeed_may_interest_in' },
      { itemid: 'infeed_weibo_mall' },
      { card_group: [{ actionlog: { ext: 'ads_word' } }, { mblog: normal }, { mblog: ad }] },
    ],
  };
  assert.deepEqual(JSON.parse(run('page?containerid=100', pageInput)), { cards: [{ card_group: [{ mblog: normal }] }] });

  const flowpageInput = {
    items: [
      { data: { itemid: 'hot-search-push-notice' } },
      { items: [{ data: { promotion: {} } }, { data: { pic: 'a_img_search_stick.png' } }, { data: { desc: '正常热搜' } }] },
    ],
  };
  assert.deepEqual(JSON.parse(run('flowpage?', flowpageInput)), { items: [{ items: [{ data: { desc: '正常热搜' } }] }] });
});

test('旧版评论与旧版详情：过滤广告、提示和调查卡片，保留普通评论与正文', () => {
  const comment = { id: 'comment', text: '评论' };
  const input = { datas: [comment, { adType: '广告' }, { type: 6 }, { type: 15 }, { type: 41 }] };
  assert.deepEqual(JSON.parse(run('comments/build_comments?', input)), { datas: [comment] });
  assert.equal(run('comments/build_comments?', input, 'comment_ad=false&comment_tip=false&comment_ai=false'), JSON.stringify(input));

  const detailInput = {
    head_cards: [{ is_ad: 1 }, { title: '普通卡片' }],
    top_cards: [{ id: 'search' }],
    reward_info: { text: '赞赏' },
    floating_button: { id: 'cart' },
    has_common_struct: true,
    trend: { titles: { title: '博主好物种草' } },
    text: '正文',
  };
  assert.deepEqual(JSON.parse(run('statuses/extend?', detailInput)), {
    head_cards: [{ title: '普通卡片' }],
    has_common_struct: false,
    text: '正文',
  });
  assert.deepEqual(JSON.parse(run('statuses/show?', { is_ad: 0, reward_info: {}, text: '正文' })), { is_ad: 0, text: '正文' });
});

test('界面模块扩展：首页顶部推广标签、发布菜单精简、超话底部频道精简', () => {
  const groupsInput = { pageDatas: [{ pageDataType: 'homeFeed' }, { pageDataType: 'homeExtend', title: '推广' }] };
  assert.deepEqual(JSON.parse(runUi('groups/allgroups/v2?', groupsInput)), { pageDatas: [{ pageDataType: 'homeFeed' }] });
  assert.equal(runUi('groups/allgroups/v2?', groupsInput, 'home_tabs=false'), JSON.stringify(groupsInput));

  const pubInput = { elements: [{ app_name: '写微博' }, { app_name: '图片' }, { app_name: '视频' }, { app_name: '直播推广' }] };
  assert.deepEqual(JSON.parse(runUi('client/publisher_list?', pubInput)), {
    elements: [{ app_name: '写微博' }, { app_name: '图片' }, { app_name: '视频' }],
  });

  const chInput = { button_configs: {}, channelInfo: { channel_list: [{ title: '超话' }, { title: '广场' }] } };
  assert.deepEqual(JSON.parse(runUi('!/huati/discovery_home_bottom_channels?', chInput)), {
    channelInfo: { channel_list: [{ title: '超话' }] },
  });
});

test('新增处理保留大整数，异常响应原样放行，且两个模块路由完全互斥', () => {
  const result = run('profile/container_timeline?', '{"items":[{"data":{"id":1234567890123456789}},{"data":{"is_ad":1}}]}');
  assert.ok(result.includes('1234567890123456789'));
  for (const body of ['not json', 'null', '[]', '{"items":null}', '{"items":[null]}']) {
    assert.equal(run('profile/container_timeline?', body), body);
  }
  for (const url of ['https://api.weibo.cn/2/profile/me?', 'https://api.weibo.cn/2/groups/allgroups/v2?', 'https://api.weibo.cn/2/client/publisher_list?', 'https://api.weibo.cn/2/!/huati/discovery_home_bottom_channels?']) {
    assert.equal(adPattern.test(url), false, url);
    assert.equal(uiPattern.test(url), true, url);
  }
});

test('可视化管理页面 API：返回完整新增分组和开关，并支持持久化保存与重置', () => {
  for (const mod of ['ad', 'ui']) {
    let apiRes;
    vm.runInNewContext(source, {
      $request: { url: `https://api.weibo.cn/surge-rules/weibo/api/${mod}`, method: 'GET', headers: { 'X-Weibo-Module': '1' } },
      $argument: `module=${mod}`,
      $persistentStore: { read: () => null, write: () => true },
      $done: (val) => { apiRes = JSON.parse(val.response.body); },
      console: { log() {} },
    });
    assert.equal(apiRes.ok, true);
    assert.equal(apiRes.version, '5.3.0');
    const keys = apiRes.items.map((i) => i.key);
    if (mod === 'ad') {
      for (const k of ['video_ad', 'video_autoplay', 'profile_follow_rec', 'chaohua_ad']) {
        assert.ok(keys.includes(k), `去广告可视化页面缺少 ${k}`);
      }
    } else {
      for (const k of ['home_tabs', 'home_publisher', 'chaohua_tabs']) {
        assert.ok(keys.includes(k), `界面可视化页面缺少 ${k}`);
      }
    }
  }
});
