/**
 * 微博模块脚本
 * 仓库：https://github.com/leetingo/surge-rules
 *
 * 供两个模块共用：
 *   modules/weibo-adblock.sgmodule  去广告，以及内容里的推广、推荐和提示
 *   modules/weibo-ui.sgmodule       界面，“我”页面、私信列表、直播条
 *
 * Surge 对同一个请求或响应只运行一个脚本，所以每个接口只归其中一个模块。
 *
 * 每一项设置的取值顺序，后面的覆盖前面的：
 *   1. 本文件里的默认值
 *   2. Surge 模块参数，由模块通过 argument 传入
 *   3. 应用内管理页面保存的值，存在 $persistentStore
 */
'use strict';

var VERSION = '5.2.0';
var PAGE_PATH = '/surge-rules/weibo/settings';
var API_PATH = '/surge-rules/weibo/api/';
var ENTRY_ID = '100505_-_modulesettings';
var BIG_MARK = '@@wbBigInt@@';

var SCHEMA = {
  ad: {
    name: '微博：去广告',
    tab: '去广告',
    store: 'leetingo_weibo_ad',
    items: [
      { key: 'splash', group: '开屏', title: '开屏广告', type: 'bool', def: true,
        desc: '清空预加载的开屏广告，并拦下开屏广告的实时请求。' },
      { key: 'feed_ad', group: '信息流', title: '信息流广告', type: 'bool', def: true,
        desc: '首页、热门、分组、搜索、超话、转发列表和视频流里的广告微博与广告卡片。' },
      { key: 'profile_ad', group: '个人主页', title: '他人个人主页广告', type: 'bool', def: true,
        desc: '个人主页时间线里带广告标记的微博和卡片。保留正常微博、置顶内容和普通推荐。' },
      { key: 'follow_rec', group: '信息流', title: '关注流里的推荐微博', type: 'select', def: 'titled',
        options: [['titled', '只去掉带推荐标题的'], ['all', '未关注的一律去掉'], ['off', '不处理']],
        desc: '带推荐标题指“关注 X 的人也关注”这一类。选“未关注的一律去掉”时，你关注的超话里的帖子和你自己的微博也可能被去掉。' },
      { key: 'notify_nag', group: '信息流', title: '“开启通知”横幅', type: 'bool', def: true,
        desc: '信息流里提示打开推送通知的横幅。' },
      { key: 'discover_banner', group: '发现页', title: '顶部轮播窗', type: 'bool', def: true,
        desc: '发现页顶部的推广轮播图。' },
      { key: 'hot_search_ad', group: '发现页', title: '热搜里的推广条目', type: 'bool', def: true,
        desc: '热搜列表里带推广标记的条目。' },
      { key: 'detail_ad', group: '微博详情', title: '广告卡片', type: 'bool', def: true,
        desc: '正文下方的广告卡片和横版广告。' },
      { key: 'detail_hot_search', group: '微博详情', title: '“大家都在搜”卡片', type: 'bool', def: true,
        desc: '正文下方的相关搜索卡片。' },
      { key: 'detail_reward', group: '微博详情', title: '赞赏信息', type: 'bool', def: true,
        desc: '正文下方的赞赏按钮和赞赏说明。' },
      { key: 'detail_share_tip', group: '微博详情', title: '分享里的红包提示', type: 'bool', def: true,
        desc: '只去掉红包提示，分享本身不受影响。' },
      { key: 'detail_positive', group: '微博详情', title: '互动后的推荐内容', type: 'bool', def: true,
        desc: '点赞或评论之后插入的推荐内容。' },
      { key: 'comment_ad', group: '评论区', title: '评论区广告', type: 'bool', def: true,
        desc: '插在评论之间的广告微博。' },
      { key: 'comment_tip', group: '评论区', title: '顶部提示条', type: 'bool', def: true,
        desc: '评论区顶部带“查看详情”的提示条，例如铁粉关系。' },
      { key: 'comment_ai', group: '评论区', title: 'AI 总结和调查卡片', type: 'bool', def: true,
        desc: '“罗伯特总结”和“你对此评论区是否满意”这类卡片。' },
      { key: 'message_ad', group: '消息页', title: '动态里的广告卡片', type: 'bool', def: true,
        desc: '消息页动态里带广告标记的卡片。' },
      { key: 'message_rec', group: '消息页', title: '推荐关注', type: 'bool', def: true,
        desc: '消息页动态里的“推荐关注”，你关注的人的动态提醒会保留。' },
      { key: 'popup_float', group: '弹窗和引导', title: '悬浮窗', type: 'bool', def: true,
        desc: '各页面的悬浮窗，包括强制展示的。' },
      { key: 'redpacket', group: '弹窗和引导', title: '信息流红包图标', type: 'bool', def: true,
        desc: '信息流里的红包图标。' },
      { key: 'launch_guide', group: '弹窗和引导', title: '启动引导和横幅', type: 'bool', def: true,
        desc: '发博引导、登录引导、个人页动画、红包和图片横幅的配置。' },
      { key: 'checkin', group: '弹窗和引导', title: '签到弹窗', type: 'bool', def: true,
        desc: '打开微博时的签到弹窗。' },
      { key: 'push_daily', group: '弹窗和引导', title: '通知开关引导', type: 'bool', def: true,
        desc: '拦下引导打开通知、评分等提示所用的配置请求。' },
      { key: 'hot_spotlight', group: '弹窗和引导', title: '热门微博聚光', type: 'bool', def: true,
        desc: '拦下“热门微博聚光”的请求。' }
    ],
    fixed: [
      { key: 'biz_domain', title: '广告平台域名 biz.weibo.com', def: 'REJECT' },
      { key: 'huodong_domain', title: '活动域名 huodong.weibo.cn', def: 'REJECT' },
      { key: 'entry', title: '“我”页面里的“模块设置”入口', def: 'true' }
    ]
  },
  ui: {
    name: '微博：界面',
    tab: '界面',
    store: 'leetingo_weibo_ui',
    items: [
      { key: 'me_vip', group: '“我”页面', title: '会员头图和会员入口', type: 'bool', def: true,
        desc: '顶部的会员背景图、会员图标和“领会员”入口。' },
      { key: 'me_shortcuts', group: '“我”页面', title: '保留的快捷入口', type: 'multi', def: ['album', 'like', 'watchhistory', 'draft'],
        options: [['album', '我的相册'], ['like', '赞/收藏'], ['watchhistory', '浏览记录'], ['draft', '草稿箱'],
          ['pay', '我的钱包'], ['ordercenter', '微博购订单'], ['productcenter', '创作中心'], ['dress', '个性皮肤']],
        free: true, allowAll: true,
        desc: '只显示选中的入口。all 表示全部保留，不改动。其他入口可以直接填它的标识。' },
      { key: 'me_cards', group: '“我”页面', title: '任务和活动卡片', type: 'bool', def: true,
        desc: '用户任务、活动、会员推广这一类卡片，以及入口上附带的推广数据。' },
      { key: 'me_wallet', group: '“我”页面', title: '钱包一栏', type: 'bool', def: true,
        desc: '“我的钱包”那一整栏。' },
      { key: 'me_recommend', group: '“我”页面', title: '为你推荐', type: 'bool', def: true,
        desc: '页面底部的“为你推荐”用户列表。' },
      { key: 'dm_hide', group: '私信列表', title: '隐藏的入口', type: 'multi', def: ['群推荐', '活动通知'],
        options: [['群推荐', '群推荐'], ['活动通知', '活动通知'], ['微博智搜', '微博智搜'], ['服务通知', '服务通知'],
          ['上新通知', '上新通知'], ['创作者小助手', '创作者小助手'], ['微博任务', '微博任务'], ['微博小秘书', '微博小秘书']],
        free: true, allowAll: false,
        desc: '按名称隐藏私信列表里的入口。其他名称可以直接填写。' },
      { key: 'live_strip', group: '首页', title: '直播条里的推荐直播', type: 'bool', def: true,
        desc: '首页顶部直播条里推荐来的直播，你关注的人的直播会保留。' }
    ],
    fixed: [
      { key: 'entry', title: '“我”页面里的“模块设置”入口', def: 'true' }
    ]
  }
};

var TRUE_WORDS = ['true', '1', 'on', 'yes', '开', '开启', '是'];
var FALSE_WORDS = ['false', '0', 'off', 'no', '关', '关闭', '否'];

var changed = 0;

function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
function isArr(x) { return Array.isArray(x); }
function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function log(msg) { try { console.log('[微博模块] ' + msg); } catch (e) {} }

/* ---------- 设置 ---------- */

function parseArgs(s) {
  var out = {};
  if (typeof s !== 'string') return out;
  var parts = s.trim().replace(/^"(.*)"$/, '$1').split('&');
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].indexOf('=');
    if (p < 1) continue;
    var k = parts[i].slice(0, p).trim();
    var v = parts[i].slice(p + 1).trim().replace(/^"(.*)"$/, '$1');
    if (/\{\{\{.*\}\}\}/.test(v)) continue; // 占位符没有被替换，当作没有传
    out[k] = v;
  }
  return out;
}

function splitList(s) {
  var raw = String(s).split(/[|,，、\s]+/);
  var out = [];
  for (var i = 0; i < raw.length; i++) {
    var t = raw[i].trim();
    if (t && out.indexOf(t) < 0) out.push(t);
  }
  return out;
}

// 把外部给的值变成这一项认可的值；不认可时返回 undefined
function coerce(item, raw) {
  if (raw === undefined || raw === null) return undefined;
  if (item.type === 'bool') {
    if (raw === true || raw === false) return raw;
    var w = String(raw).trim().toLowerCase();
    if (TRUE_WORDS.indexOf(w) >= 0) return true;
    if (FALSE_WORDS.indexOf(w) >= 0) return false;
    return undefined;
  }
  if (item.type === 'select') {
    var s = String(raw).trim().toLowerCase();
    for (var i = 0; i < item.options.length; i++) if (item.options[i][0] === s) return s;
    return undefined;
  }
  if (item.type === 'multi') {
    var list = isArr(raw) ? splitList(raw.join('|')) : splitList(raw);
    if (item.allowAll && list.indexOf('all') >= 0) return ['all'];
    if (!item.free) {
      var known = item.options.map(function (o) { return o[0]; });
      list = list.filter(function (x) { return known.indexOf(x) >= 0; });
    }
    return list;
  }
  return undefined;
}

function readStore(mod) {
  try {
    var raw = $persistentStore.read(SCHEMA[mod].store);
    if (!raw) return {};
    var j = JSON.parse(raw);
    return isObj(j) && isObj(j.set) ? j.set : {};
  } catch (e) { return {}; }
}

function writeStore(mod, set) {
  var keys = Object.keys(set);
  return $persistentStore.write(keys.length ? JSON.stringify({ v: 1, set: set }) : null, SCHEMA[mod].store);
}

// 返回 { values: {key: 值}, detail: [{key, value, source, argValue}] }
function effective(mod, args) {
  var saved = readStore(mod);
  var values = {};
  var detail = [];
  var items = SCHEMA[mod].items;
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var value = it.def;
    var source = 'default';
    var fromArg = has(args, it.key) ? coerce(it, args[it.key]) : undefined;
    if (fromArg !== undefined) { value = fromArg; source = 'arg'; }
    var argValue = value;
    var fromPage = has(saved, it.key) ? coerce(it, saved[it.key]) : undefined;
    if (fromPage !== undefined) { value = fromPage; source = 'page'; }
    values[it.key] = value;
    detail.push({ key: it.key, value: value, source: source, argValue: argValue });
  }
  return { values: values, detail: detail };
}

/* ---------- 大整数保护 ---------- */

// JavaScript 的数字超过 16 位会丢精度。解析前把这类整数换成带标记的字符串，输出时再换回来。
function protectBigInts(text) {
  if (!/\d{16}/.test(text)) return text;
  var out = '';
  var last = 0;
  var i = 0;
  var n = text.length;
  var inStr = false;
  while (i < n) {
    var c = text.charCodeAt(i);
    if (inStr) {
      if (c === 92) { i += 2; continue; }
      if (c === 34) inStr = false;
      i++;
      continue;
    }
    if (c === 34) { inStr = true; i++; continue; }
    if (c === 45 || (c >= 48 && c <= 57)) {
      var j = i + 1;
      while (j < n) { var d = text.charCodeAt(j); if (d >= 48 && d <= 57) j++; else break; }
      var next = j < n ? text.charCodeAt(j) : 0;
      var digits = j - i - (c === 45 ? 1 : 0);
      if (digits >= 16 && next !== 46 && next !== 101 && next !== 69) {
        out += text.slice(last, i) + '"' + BIG_MARK + text.slice(i, j) + '"';
        last = j;
      } else {
        while (j < n) {
          var e = text.charCodeAt(j);
          if ((e >= 48 && e <= 57) || e === 46 || e === 101 || e === 69 || e === 43 || e === 45) j++; else break;
        }
      }
      i = j;
      continue;
    }
    i++;
  }
  return out + text.slice(last);
}

function restoreBigInts(text) {
  if (text.indexOf(BIG_MARK) < 0) return text;
  return text.replace(/"@@wbBigInt@@(-?\d+)"/g, '$1');
}

/* ---------- 广告判定 ---------- */

function isAdData(d, allowReadtime) {
  if (!isObj(d)) return false;
  if (d.mblogtypename === '广告' || d.mblogtypename === '热推') return true;
  if (d.is_ad === 1 || d.is_ad === '1' || d.ad_state === 1 || d.ad_state === '1') return true;
  if (allowReadtime !== false && d.readtimetype === 'adMblog') return true;
  if (d.is_ad_card === 1) return true;
  var p = d.promotion;
  if (isObj(p)) {
    if (p.recommend === '广告' || p.recommend === '热推') return true;
    if (typeof p.type === 'string' && /(^|[^a-z])ad([^a-z]|$)/i.test(p.type)) return true;
  }
  var c = d.content_auth_info;
  if (isObj(c) && (c.content_auth_title === '广告' || c.content_auth_title === '热推')) return true;
  var m = d.ads_material_info;
  if (isObj(m) && m.is_ads === true) return true;
  return false;
}
function isAdItem(it, allowReadtime) {
  return isObj(it) && (isAdData(it, allowReadtime) || isAdData(it.data, allowReadtime) || isAdData(it.mblog, allowReadtime));
}
function isBanner(it) { return isObj(it) && isObj(it.data) && it.data.card_type === 118 && it.data.itemid === 'finder_window'; }
function isNag(it) {
  if (!isObj(it) || it.category !== 'cell' || !isObj(it.title)) return false;
  var t = it.title.content;
  return /开启通知/.test(t === undefined || t === null ? '' : String(t));
}

// 递归清理：去掉 node.items 里命中的条目，再对留下的条目做同样的事
function cleanItems(node, drop) {
  if (!isObj(node) || !isArr(node.items)) return;
  var kept = [];
  for (var i = 0; i < node.items.length; i++) {
    var it = node.items[i];
    if (drop(it)) { changed++; continue; }
    kept.push(it);
    cleanItems(it, drop);
  }
  if (kept.length !== node.items.length) node.items = kept;
}

function filterArray(owner, key, drop) {
  if (!isObj(owner) || !isArr(owner[key])) return;
  var kept = [];
  for (var i = 0; i < owner[key].length; i++) {
    if (drop(owner[key][i])) changed++; else kept.push(owner[key][i]);
  }
  if (kept.length !== owner[key].length) owner[key] = kept;
}

function removeKey(owner, key) {
  if (isObj(owner) && has(owner, key)) { delete owner[key]; changed++; }
}

function feedDrop(cfg) {
  return function (it) {
    return (cfg.feed_ad && isAdItem(it)) || (cfg.discover_banner && isBanner(it)) || (cfg.notify_nag && isNag(it));
  };
}

/* ---------- 去广告模块：响应 ---------- */

function adSplashPreload(obj, cfg) {
  if (!cfg.splash || !isObj(obj) || !isArr(obj.ads) || obj.ads.length === 0) return;
  obj.ads = [];
  changed++;
}

function adTimeline(obj, cfg, url) {
  if (!isObj(obj)) return;
  cleanItems(obj, feedDrop(cfg));
  if (cfg.follow_rec !== 'off' && /\/2\/statuses\/container_timeline(_unread)?\?/.test(url)) {
    var all = cfg.follow_rec === 'all';
    filterArray(obj, 'items', function (it) {
      if (!isObj(it) || it.category !== 'feed' || !isObj(it.data) || !isObj(it.data.user)) return false;
      if (it.data.user.following !== false) return false;
      if (all) return true;
      var t = it.data.title;
      if (!isObj(t)) return false;
      var text = t.text === undefined || t.text === null || t.text === false ? '' : String(t.text);
      return text.length > 0;
    });
  }
}

function hotSearchPromo(node) {
  if (!isObj(node) || !isArr(node.items)) return;
  for (var i = 0; i < node.items.length; i++) {
    var it = node.items[i];
    if (isObj(it) && isObj(it.data) && it.data.card_type === 17) {
      filterArray(it.data, 'group', function (g) { return isObj(g) && has(g, 'promotion'); });
    }
    hotSearchPromo(it);
  }
}

function adFinder(obj, cfg) {
  if (!isObj(obj)) return;
  var drop = feedDrop(cfg);
  if (isObj(obj.channelInfo) && isArr(obj.channelInfo.channels)) {
    for (var i = 0; i < obj.channelInfo.channels.length; i++) {
      var ch = obj.channelInfo.channels[i];
      if (isObj(ch) && isObj(ch.payload)) cleanItems(ch.payload, drop);
    }
  }
  if (isObj(obj.header) && isObj(obj.header.data)) {
    cleanItems(obj.header.data, drop);
    if (cfg.hot_search_ad) hotSearchPromo(obj.header.data);
  }
}

function adSearchTimeline(obj, cfg) {
  cleanItems(obj, feedDrop(cfg));
  if (cfg.feed_ad) cleanCards(obj);
}

// 旧式列表用 cards/card_group 包装微博；只检查卡片本身和直接承载的微博，
// 不深入 retweeted_status，避免因为引用了广告微博而删掉正常用户的转发。
function cleanCards(node, drop) {
  if (!isObj(node)) return;
  drop = drop || isAdItem;
  ['cards', 'card_group'].forEach(function (key) {
    filterArray(node, key, drop);
    if (isArr(node[key])) node[key].forEach(function (card) { cleanCards(card, drop); });
  });
}

function adProfile(obj, cfg) {
  if (!cfg.profile_ad) return;
  // 实际主页里普通历史转发也会带 adMblog，不能仅凭阅读计时分类删除。
  var drop = function (item) { return isAdItem(item, false); };
  cleanItems(obj, drop);
  cleanCards(obj, drop);
}

function adLegacyFeed(obj, cfg) {
  if (!cfg.feed_ad || !isObj(obj)) return;
  cleanItems(obj, isAdItem);
  cleanCards(obj);
  ['statuses', 'reposts', 'hot_reposts'].forEach(function (key) { filterArray(obj, key, isAdData); });
  // 这些是旧版时间线单独下发的广告槽位，分页信息和普通 trends 保持不变。
  removeKey(obj, 'ad');
  removeKey(obj, 'advertises');
}

function adVideoCache(obj, cfg) {
  if (!cfg.feed_ad || !isObj(obj) || !isArr(obj.lists)) return;
  obj.lists.forEach(function (list) { cleanItems(list, isAdItem); });
}

function adLegacyComment(obj, cfg) {
  if (!cfg.comment_ad) return;
  filterArray(obj, 'datas', function (item) {
    return isObj(item) && (item.adType === '广告' || item.adType === '热推' || isAdItem(item) || isAdData(item.blog));
  });
}

function adLegacyDetail(obj, cfg) {
  if (!isObj(obj)) return;
  if (cfg.detail_reward) removeKey(obj, 'reward_info');
  if (!cfg.detail_ad) return;
  filterArray(obj, 'head_cards', isAdItem);
  var trend = obj.trend;
  if (!isObj(trend)) return;
  var extra = trend.extra_struct;
  var button = isObj(extra) && extra.extBtnInfo;
  if (isAdItem(trend) || (isObj(button) && typeof button.btn_picurl === 'string' && button.btn_picurl.indexOf('timeline_icon_ad_delete') >= 0)) {
    removeKey(obj, 'trend');
  }
}

function adDetail(obj, cfg) {
  if (!isObj(obj)) return;
  if (isObj(obj.pageHeader) && isObj(obj.pageHeader.data)) {
    cleanItems(obj.pageHeader.data, function (it) {
      if (cfg.detail_ad && (isAdItem(it) || isBanner(it))) return true;
      if (cfg.detail_hot_search && isObj(it) && isObj(it.data) && it.data.card_type === 248 && it.data.itemid === 'top_searching') return true;
      return false;
    });
  }
  var info = obj.detailInfo;
  if (!isObj(info)) return;
  if (cfg.detail_reward) {
    removeKey(info.extend, 'reward_info');
    removeKey(info.status, 'reward_info');
  }
  if (cfg.detail_share_tip && isObj(info.extend) && isObj(info.extend.sharecontent)) {
    var sc = info.extend.sharecontent;
    ['rp_share_tip', 'rp_alert_scheme', 'rp_passcode', 'show_additional_indication', 'additional_indication_icon_url']
      .forEach(function (k) { removeKey(sc, k); });
  }
}

function adComment(obj, cfg) {
  filterArray(obj, 'items', function (it) {
    if (!isObj(it)) return false;
    if (it.type === 'trend' && isObj(it.data) && (has(it.data, 'adType') || isAdData(it.data.blog))) return cfg.comment_ad;
    if (it.category === 'card' && isAdData(it.data)) return cfg.comment_ad;
    if (it.type === 'comment_header_tip') return cfg.comment_tip;
    if (it.category === 'card' && isObj(it.data) && it.data.card_type === 236) return cfg.comment_ai;
    return false;
  });
}

function adPositive(obj, cfg) {
  if (!cfg.detail_positive || !isObj(obj) || !isArr(obj.items) || obj.items.length === 0) return;
  obj.items = [];
  changed++;
}

function adNotice(obj, cfg) {
  filterArray(obj, 'messages', function (m) {
    if (!isObj(m)) return false;
    // 广告卡片通常也带推荐标记，先按广告算，两个开关互不影响
    if (isObj(m.msg_card) && (has(m.msg_card, 'ad_tag') || has(m.msg_card, 'ad_click_actionlog'))) return cfg.message_ad;
    return cfg.message_rec && m.isrecommend === true;
  });
}

function adActive(obj, cfg) {
  if (!isObj(obj)) return;
  if (cfg.popup_float) {
    if (isArr(obj.floating_windows) && obj.floating_windows.length > 0) { obj.floating_windows = []; changed++; }
    if (has(obj, 'disable_floating_window') && obj.disable_floating_window !== '1') { obj.disable_floating_window = '1'; changed++; }
    removeKey(obj, 'floating_windows_force_show');
  }
  if (cfg.redpacket && isObj(obj.feed_redpacket)) {
    obj.feed_redpacket.starttime = '2208960000';
    obj.feed_redpacket.endtime = '2209046399';
    obj.feed_redpacket.interval = '31536000';
    changed++;
  }
  if (cfg.launch_guide) {
    ['compose_add_guide', 'loginconfig', 'profile_lotties', 'ug_red_paper', 'weibo_pic_banner']
      .forEach(function (k) { removeKey(obj, k); });
  }
}

function adCheckin(obj, cfg) {
  if (!cfg.checkin || !isObj(obj) || !has(obj, 'show') || obj.show === 0) return;
  obj.show = 0;
  changed++;
}

/* ---------- 界面模块：响应 ---------- */

function uiMe(obj, cfg) {
  if (!isObj(obj)) return;
  if (cfg.me_vip) removeKey(obj, 'vipHeaderBgImage');
  if (!isArr(obj.items)) return;

  filterArray(obj, 'items', function (it) {
    if (!isObj(it)) return false;
    if (cfg.me_cards && it.category === 'mine' && it.type === 'card5') return true;
    if (cfg.me_cards && it.category === 'card' && isObj(it.data) && it.data.card_type === 236) return true;
    if (cfg.me_wallet && it.itemId === '100505_-_mypay_new') return true;
    if (cfg.me_recommend && ((it.category === 'mine' && it.type === 'mineAttent') || it.itemId === 'mine_attent_title')) return true;
    return false;
  });

  var keep = cfg.me_shortcuts;
  var trim = isArr(keep) && keep.length > 0 && keep.indexOf('all') < 0;
  for (var i = 0; i < obj.items.length; i++) {
    var it = obj.items[i];
    if (!isObj(it)) continue;
    if (cfg.me_vip && it.itemId === 'profileme_mine' && isObj(it.header)) {
      removeKey(it.header, 'vipView');
      removeKey(it.header, 'vipCenter');
      removeKey(it.header, 'vipIcon');
    }
    if (!isArr(it.items)) continue;
    if (cfg.me_cards) {
      for (var k = 0; k < it.items.length; k++) removeKey(it.items[k], 'adData');
    }
    if (trim && typeof it.itemId === 'string' && /_-_top8$/.test(it.itemId)) {
      var real = 0;
      var kept = it.items.filter(function (cell) {
        if (!isObj(cell) || typeof cell.itemId !== 'string') return false;
        if (cell.itemId === ENTRY_ID) return true;
        var id = cell.itemId.replace(/^.*_-_/, '');
        if (keep.indexOf(id) >= 0) { real++; return true; }
        return false;
      });
      // 一个都没对上说明标识变了，这时不动原来的入口
      if (real > 0 && kept.length !== it.items.length) { it.items = kept; changed++; }
    }
  }

  if (cfg.me_recommend && isObj(obj.moreInfo) && obj.moreInfo.noMore !== true) {
    obj.moreInfo.noMore = true;
    changed++;
  }
}

function uiDmList(obj, cfg) {
  var names = cfg.dm_hide;
  if (!isArr(names) || names.length === 0) return;
  filterArray(obj, 'user_list', function (u) {
    if (!isObj(u) || !isObj(u.user)) return false;
    if (names.indexOf(u.user.screen_name) >= 0 || names.indexOf(u.user.name) >= 0) return true;
    return names.indexOf('群推荐') >= 0 && u.user.id === 101;
  });
}

function uiLive(obj, cfg) {
  if (!cfg.live_strip) return;
  filterArray(obj, 'data', function (x) { return isObj(x) && x.from_tuijian === true; });
}

/* ---------- 路由 ---------- */

var RESPONSE_ROUTES = [
  { mod: 'ad', re: /^https:\/\/bootpreload\.uve\.weibo\.com\/v[12]\/ad\/preload/, fn: adSplashPreload },
  { mod: 'ad', re: /^https:\/\/api\.weibo\.cn\/2\/statuses\/container_timeline/, fn: adTimeline },
  { mod: 'ad', re: /^https:\/\/(?:api\.weibo\.cn|mapi\.weibo\.com)\/2\/profile\/container_timeline(?:\?|$)/, fn: adProfile },
  { mod: 'ad', re: /^https:\/\/(?:api\.weibo\.cn|mapi\.weibo\.com)\/2\/(?:cardlist|page|flowlist|groups\/timeline|statuses\/(?:friends\/timeline|unread_friends_timeline|unread_hot_timeline|repost_timeline|video_mixtimeline)|video\/(?:community_tab|tiny_stream_video_list))(?:\?|$)/, fn: adLegacyFeed },
  { mod: 'ad', re: /^https:\/\/api\.weibo\.cn\/2\/video\/flow_stream_cache(?:\?|$)/, fn: adVideoCache },
  { mod: 'ad', re: /^https:\/\/(?:api\.weibo\.cn|mapi\.weibo\.com)\/2\/comments\/build_comments(?:\?|$)/, fn: adLegacyComment },
  { mod: 'ad', re: /^https:\/\/(?:api\.weibo\.cn|mapi\.weibo\.com)\/2\/statuses\/extend(?:\?|$)/, fn: adLegacyDetail },
  { mod: 'ad', re: /^https:\/\/api\.weibo\.cn\/2\/search\/finder\?/, fn: adFinder },
  { mod: 'ad', re: /^https:\/\/api\.weibo\.cn\/2\/search\/container_timeline/, fn: adSearchTimeline },
  { mod: 'ad', re: /^https:\/\/(?:api\.weibo\.cn|mapi\.weibo\.com)\/2\/(?:searchall|search\/container_discover)(?:\?|$)/, fn: adSearchTimeline },
  { mod: 'ad', re: /^https:\/\/api\.weibo\.cn\/2\/statuses\/container_detail\?/, fn: adDetail },
  { mod: 'ad', re: /^https:\/\/api\.weibo\.cn\/2\/statuses\/container_detail_comment/, fn: adComment },
  { mod: 'ad', re: /^https:\/\/api\.weibo\.cn\/2\/statuses\/container_positive/, fn: adPositive },
  { mod: 'ad', re: /^https:\/\/api\.weibo\.cn\/2\/messageflow\/notice/, fn: adNotice },
  { mod: 'ad', re: /^https:\/\/api\.weibo\.cn\/2\/push\/active/, fn: adActive },
  { mod: 'ad', re: /^https:\/\/api\.weibo\.cn\/2\/checkin\/show/, fn: adCheckin },
  { mod: 'ui', re: /^https:\/\/api\.weibo\.cn\/2\/profile\/me/, fn: uiMe },
  { mod: 'ui', re: /^https:\/\/api\.weibo\.cn\/2\/direct_messages\/user_list/, fn: uiDmList },
  { mod: 'ui', re: /^https:\/\/api\.weibo\.cn\/2\/live\/media_homelist/, fn: uiLive }
];

// 直接返回空结果的请求：[模块, 地址, 对应的开关]
var BLOCK_ROUTES = [
  { mod: 'ad', re: /^https:\/\/bootrealtime\.uve\.weibo\.com\/v[23]\/ad\/realtime/, key: 'splash' },
  { mod: 'ad', re: /^https:\/\/api\.weibo\.cn\/2\/push\/daily/, key: 'push_daily' },
  { mod: 'ad', re: /^https:\/\/api\.weibo\.cn\/2\/hot\/hours_spotlight\?/, key: 'hot_spotlight' }
];

function onResponse(mod, args, url) {
  var route = null;
  for (var i = 0; i < RESPONSE_ROUTES.length; i++) {
    if (RESPONSE_ROUTES[i].mod === mod && RESPONSE_ROUTES[i].re.test(url)) { route = RESPONSE_ROUTES[i]; break; }
  }
  var body = $response.body;
  if (!route || typeof body !== 'string' || body.length === 0) return $done({});
  var obj;
  try { obj = JSON.parse(protectBigInts(body)); } catch (e) { return $done({}); }
  route.fn(obj, effective(mod, args).values, url);
  if (changed === 0) return $done({});
  log(url.replace(/\?.*$/, '').replace(/^https:\/\/[^/]+/, '') + ' 改动 ' + changed + ' 处');
  $done({ body: restoreBigInts(JSON.stringify(obj)) });
}

/* ---------- 请求：拦截和管理页面 ---------- */

function header(name) {
  var h = ($request && $request.headers) || {};
  var want = name.toLowerCase();
  for (var k in h) if (has(h, k) && k.toLowerCase() === want) return h[k];
  return undefined;
}

function reply(status, type, body) {
  $done({ response: { status: status, headers: { 'Content-Type': type, 'Cache-Control': 'no-store' }, body: body } });
}
function replyJSON(status, obj) { reply(status, 'application/json; charset=utf-8', JSON.stringify(obj)); }

function stateOf(mod, args) {
  var eff = effective(mod, args);
  var schema = SCHEMA[mod];
  var byKey = {};
  eff.detail.forEach(function (d) { byKey[d.key] = d; });
  return {
    ok: true,
    module: mod,
    name: schema.name,
    version: VERSION,
    items: schema.items.map(function (it) {
      var d = byKey[it.key];
      return {
        key: it.key, group: it.group, title: it.title, desc: it.desc, type: it.type,
        options: it.options || null, free: !!it.free, allowAll: !!it.allowAll, def: it.def,
        value: d.value, source: d.source, argValue: d.argValue
      };
    }),
    fixed: schema.fixed.map(function (f) {
      return { key: f.key, title: f.title, value: has(args, f.key) ? args[f.key] : f.def };
    })
  };
}

function onApi(mod, args) {
  var method = String($request.method || 'GET').toUpperCase();
  if (method === 'GET') return replyJSON(200, stateOf(mod, args));
  if (method !== 'POST') return replyJSON(405, { ok: false, error: 'method' });
  // 只接受管理页面自己发出的请求
  if (header('X-Weibo-Module') !== '1') return replyJSON(403, { ok: false, error: 'forbidden' });
  var req;
  try { req = JSON.parse(typeof $request.body === 'string' ? $request.body : ''); } catch (e) { req = null; }
  if (!isObj(req)) return replyJSON(400, { ok: false, error: 'body' });

  var saved = readStore(mod);
  var items = SCHEMA[mod].items;
  if (req.reset === true) saved = {};
  if (isArr(req.unset)) req.unset.forEach(function (k) { delete saved[k]; });
  if (isObj(req.set)) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!has(req.set, it.key)) continue;
      var v = coerce(it, req.set[it.key]);
      if (v === undefined) return replyJSON(400, { ok: false, error: 'value', key: it.key });
      saved[it.key] = v;
    }
  }
  writeStore(mod, saved);
  replyJSON(200, stateOf(mod, args));
}

function onRequest(mod, args, url) {
  var path = url.replace(/^https?:\/\/[^/]+/, '').replace(/[?#].*$/, '');
  if (path === PAGE_PATH) return reply(200, 'text/html; charset=utf-8', PAGE_HTML);
  if (path.indexOf(API_PATH) === 0) {
    var target = path.slice(API_PATH.length);
    if (target !== mod) return $done({});
    return onApi(mod, args);
  }
  for (var i = 0; i < BLOCK_ROUTES.length; i++) {
    var r = BLOCK_ROUTES[i];
    if (r.mod !== mod || !r.re.test(url)) continue;
    if (effective(mod, args).values[r.key]) return replyJSON(200, {});
    break;
  }
  $done({});
}

/* ---------- 管理页面 ---------- */

var PAGE_HTML = [
'<!doctype html>',
'<html lang="zh-CN"><head><meta charset="utf-8">',
'<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
'<meta name="color-scheme" content="light dark">',
'<title>微博模块设置</title>',
'<style>',
':root{--bg:#f2f3f5;--card:#fff;--text:#1f2329;--sub:#7a828e;--line:#e6e8eb;--accent:#ff8200;--accent-soft:#fff3e6;--off:#d5d8dc;--danger:#d93f3f}',
'@media (prefers-color-scheme:dark){:root{--bg:#111315;--card:#1c1f23;--text:#e8eaed;--sub:#949ba6;--line:#2c3036;--accent:#ff9a33;--accent-soft:#3a2a17;--off:#4a4f57;--danger:#ff6b6b}}',
'*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}',
'html{-webkit-text-size-adjust:100%}',
'body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",sans-serif;padding:0 16px calc(32px + env(safe-area-inset-bottom))}',
'.wrap{max-width:640px;margin:0 auto}',
'header{padding:20px 4px 12px}',
'h1{font-size:22px;line-height:1.3;margin:0 0 6px;font-weight:700}',
'.lead{margin:0;color:var(--sub);font-size:13px}',
'.tabs{display:flex;gap:4px;background:var(--line);border-radius:10px;padding:3px;margin:8px 0 16px;position:sticky;top:8px;z-index:2}',
'.tabs button{flex:1;border:0;background:transparent;color:var(--sub);font:inherit;font-size:15px;font-weight:600;padding:8px 0;border-radius:8px}',
'.tabs button[aria-selected="true"]{background:var(--card);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.12)}',
'.status{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px;color:var(--sub);padding:0 4px 10px}',
'.link{border:0;background:none;color:var(--accent);font:inherit;font-size:13px;padding:4px 0}',
'.link:disabled{color:var(--off)}',
'h2{font-size:13px;font-weight:600;color:var(--sub);margin:18px 4px 6px}',
'.card{background:var(--card);border-radius:12px;overflow:hidden}',
'.row{padding:12px 14px;border-top:1px solid var(--line)}',
'.row:first-child{border-top:0}',
'.head{display:flex;align-items:center;justify-content:space-between;gap:12px}',
'.title{font-size:16px;font-weight:500;min-width:0}',
'.badge{display:inline-block;font-size:11px;font-weight:600;color:var(--accent);background:var(--accent-soft);border-radius:4px;padding:0 5px;margin-left:6px;vertical-align:2px}',
'.desc{margin:4px 0 0;color:var(--sub);font-size:13px}',
'.switch{position:relative;flex:none;width:50px;height:30px}',
'.switch input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0}',
'.switch span{position:absolute;inset:0;border-radius:15px;background:var(--off);transition:background .15s}',
'.switch span:after{content:"";position:absolute;left:2px;top:2px;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .15s}',
'.switch input:checked+span{background:var(--accent)}',
'.switch input:checked+span:after{transform:translateX(20px)}',
'.switch input:focus-visible+span{outline:2px solid var(--accent);outline-offset:2px}',
'select,input[type=text]{font:inherit;font-size:15px;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:7px 10px;max-width:100%}',
'select{flex:none;max-width:58%}',
'.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
'.chip{border:1px solid var(--line);background:var(--bg);color:var(--text);font:inherit;font-size:14px;border-radius:16px;padding:5px 12px}',
'.chip[aria-pressed="true"]{border-color:var(--accent);background:var(--accent-soft);color:var(--accent);font-weight:600}',
'.free{display:flex;gap:8px;margin-top:10px}',
'.free input{flex:1;min-width:0}',
'.free button{flex:none;border:0;border-radius:8px;background:var(--accent);color:#fff;font:inherit;font-size:14px;font-weight:600;padding:0 14px}',
'.fixed .title{font-size:15px}',
'.fixed code{flex:none;font:13px ui-monospace,Menlo,monospace;color:var(--sub);background:var(--bg);border-radius:6px;padding:2px 8px}',
'.empty{background:var(--card);border-radius:12px;padding:28px 18px;text-align:center;color:var(--sub);font-size:14px}',
'.empty b{display:block;color:var(--text);font-size:16px;margin-bottom:6px}',
'footer{margin:24px 4px 0;color:var(--sub);font-size:12px}',
'#toast{position:fixed;left:50%;bottom:calc(28px + env(safe-area-inset-bottom));transform:translateX(-50%);background:rgba(20,22,25,.92);color:#fff;font-size:14px;border-radius:18px;padding:8px 16px;opacity:0;pointer-events:none;transition:opacity .2s;white-space:nowrap}',
'#toast.show{opacity:1}',
'#toast.bad{background:var(--danger)}',
'</style></head><body><div class="wrap">',
'<header><h1>微博模块设置</h1><p class="lead">改动立即保存。回到微博后重新加载对应页面才会看到效果，开屏和弹窗类要重新打开微博。</p></header>',
'<div class="tabs" role="tablist" id="tabs"></div>',
'<main id="main"></main>',
'<footer id="foot"></footer>',
'</div><div id="toast" role="status"></div>',
'<script>',
'(function(){',
'var MODS=[["ad","去广告"],["ui","界面"]];',
'var API="' + API_PATH + '";',
'var state={};var current=null;var toastTimer=null;',
'function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined&&text!==null)e.textContent=text;return e;}',
'function toast(msg,bad){var t=document.getElementById("toast");t.textContent=msg;t.className=bad?"show bad":"show";clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.className="";},1600);}',
'function call(mod,body){',
'  var opt=body?{method:"POST",headers:{"Content-Type":"application/json","X-Weibo-Module":"1"},body:JSON.stringify(body),cache:"no-store"}:{headers:{"X-Weibo-Module":"1"},cache:"no-store"};',
'  return fetch(API+mod,opt).then(function(r){return r.json();}).then(function(j){if(!j||j.ok!==true||j.module!==mod)throw new Error("unavailable");return j;});',
'}',
'function save(mod,body,okText){',
'  return call(mod,body).then(function(j){state[mod]=j;render();toast(okText||"已保存");}).catch(function(){toast("保存失败，请确认模块已启用",true);render();});',
'}',
'function setValue(mod,key,value){var s={};s[key]=value;return save(mod,{set:s});}',
'function listValue(item){return (item.value||[]).slice();}',
'function controlBool(mod,item){',
'  var l=el("label","switch");var i=el("input");i.type="checkbox";i.checked=item.value===true;i.setAttribute("aria-label",item.title);',
'  i.addEventListener("change",function(){setValue(mod,item.key,i.checked);});l.appendChild(i);l.appendChild(el("span"));return l;',
'}',
'function controlSelect(mod,item){',
'  var s=el("select");s.setAttribute("aria-label",item.title);',
'  item.options.forEach(function(o){var op=el("option",null,o[1]);op.value=o[0];if(o[0]===item.value)op.selected=true;s.appendChild(op);});',
'  s.addEventListener("change",function(){setValue(mod,item.key,s.value);});return s;',
'}',
'function controlMulti(mod,item,row){',
'  var known=item.options.map(function(o){return o[0];});var value=listValue(item);var isAll=value.indexOf("all")>=0;',
'  var chips=el("div","chips");',
'  if(item.allowAll){var a=el("button","chip","全部保留");a.type="button";a.setAttribute("aria-pressed",isAll?"true":"false");',
'    a.addEventListener("click",function(){setValue(mod,item.key,isAll?item.def.slice():["all"]);});chips.appendChild(a);}',
'  item.options.forEach(function(o){var on=isAll||value.indexOf(o[0])>=0;var b=el("button","chip",o[1]);b.type="button";b.setAttribute("aria-pressed",on?"true":"false");',
'    b.addEventListener("click",function(){var base=isAll?known.slice():value.slice();var p=base.indexOf(o[0]);if(p>=0)base.splice(p,1);else base.push(o[0]);setValue(mod,item.key,base);});chips.appendChild(b);});',
'  value.forEach(function(v){if(v==="all"||known.indexOf(v)>=0)return;var b=el("button","chip",v+" ×");b.type="button";b.setAttribute("aria-pressed","true");',
'    b.addEventListener("click",function(){setValue(mod,item.key,value.filter(function(x){return x!==v;}));});chips.appendChild(b);});',
'  row.appendChild(chips);',
'  if(item.free){var f=el("form","free");var inp=el("input");inp.type="text";inp.placeholder="添加其他，多个用 | 分隔";inp.setAttribute("aria-label",item.title+"，添加其他");inp.autocapitalize="off";inp.autocomplete="off";',
'    var btn=el("button",null,"添加");btn.type="submit";f.appendChild(inp);f.appendChild(btn);',
'    f.addEventListener("submit",function(ev){ev.preventDefault();var extra=inp.value.split(/[|,，、\\s]+/).filter(function(x){return x;});if(!extra.length)return;',
'      var base=isAll?[]:value.slice();extra.forEach(function(x){if(base.indexOf(x)<0)base.push(x);});setValue(mod,item.key,base);});row.appendChild(f);}',
'}',
'function renderModule(mod,main){',
'  var s=state[mod];',
'  if(s===undefined){main.appendChild(el("div","empty","正在读取…"));return;}',
'  if(s===null){var e=el("div","empty");e.appendChild(el("b",null,"这个模块没有启用"));e.appendChild(document.createTextNode("在 Surge 里安装并启用对应的模块后，再回到这里。"));main.appendChild(e);return;}',
'  var overridden=s.items.filter(function(i){return i.source==="page";}).length;',
'  var st=el("div","status");st.appendChild(el("span",null,s.name+" · "+s.version+(overridden?" · 这里改过 "+overridden+" 项":"")));',
'  var reset=el("button","link","恢复为模块参数");reset.type="button";reset.disabled=!overridden;',
'  reset.addEventListener("click",function(){save(mod,{reset:true},"已恢复");});st.appendChild(reset);main.appendChild(st);',
'  var groups=[];var map={};',
'  s.items.forEach(function(i){if(!map[i.group]){map[i.group]=[];groups.push(i.group);}map[i.group].push(i);});',
'  groups.forEach(function(g){',
'    main.appendChild(el("h2",null,g));var card=el("div","card");',
'    map[g].forEach(function(item){',
'      var row=el("div","row");var head=el("div","head");var t=el("div","title",item.title);',
'      if(item.source==="page")t.appendChild(el("span","badge","已改"));',
'      head.appendChild(t);',
'      if(item.type==="bool")head.appendChild(controlBool(mod,item));',
'      if(item.type==="select")head.appendChild(controlSelect(mod,item));',
'      row.appendChild(head);',
'      if(item.desc)row.appendChild(el("p","desc",item.desc));',
'      if(item.type==="multi")controlMulti(mod,item,row);',
'      card.appendChild(row);',
'    });',
'    main.appendChild(card);',
'  });',
'  if(s.fixed&&s.fixed.length){',
'    main.appendChild(el("h2",null,"只能在 Surge 的模块参数里修改"));var c=el("div","card fixed");',
'    s.fixed.forEach(function(f){var row=el("div","row");var head=el("div","head");head.appendChild(el("div","title",f.title));head.appendChild(el("code",null,f.key+" = "+f.value));row.appendChild(head);c.appendChild(row);});',
'    main.appendChild(c);',
'  }',
'}',
'function render(){',
'  var tabs=document.getElementById("tabs");tabs.textContent="";',
'  MODS.forEach(function(m){var b=el("button",null,m[1]);b.type="button";b.setAttribute("role","tab");b.setAttribute("aria-selected",m[0]===current?"true":"false");',
'    b.addEventListener("click",function(){current=m[0];try{sessionStorage.setItem("wbtab",current);}catch(e){}render();});tabs.appendChild(b);});',
'  var main=document.getElementById("main");main.textContent="";renderModule(current,main);',
'  document.getElementById("foot").textContent="设置的取值顺序：默认值，然后是 Surge 模块参数，最后是这里保存的值。这里改过的项目优先，点“恢复为模块参数”可以清除。";',
'}',
'function load(){',
'  var saved=null;try{saved=sessionStorage.getItem("wbtab");}catch(e){}',
'  current=saved||MODS[0][0];render();var pending=MODS.length;',
'  MODS.forEach(function(m){call(m[0]).then(function(j){state[m[0]]=j;}).catch(function(){state[m[0]]=null;}).then(function(){',
'    pending--;if(pending===0&&!saved&&state[current]===null){for(var i=0;i<MODS.length;i++){if(state[MODS[i][0]]){current=MODS[i][0];break;}}}render();});});',
'}',
'load();',
'})();',
'</script></body></html>'
].join('\n');

/* ---------- 入口 ---------- */

function main() {
  var args = parseArgs(typeof $argument === 'string' ? $argument : '');
  var mod = has(SCHEMA, args.module) ? args.module : null;
  var url = (typeof $request !== 'undefined' && $request && $request.url) || '';
  if (!mod || !url) return $done({});
  if (typeof $response === 'undefined') return onRequest(mod, args, url);
  return onResponse(mod, args, url);
}

try {
  main();
} catch (e) {
  log('出错，已放行原始内容：' + (e && e.message));
  $done({});
}
