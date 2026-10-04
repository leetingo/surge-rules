/**
 * 美团外卖模块脚本
 * 仓库：https://github.com/leetingo/surge-rules
 *
 * 美团的接口默认走私有长连接（Shark）：按 IP 直连接入服务器，不是 TLS，Surge 看不到内容。
 * 长连接连不上时，大部分接口会改走普通的 HTTP（外卖接口是明文 HTTP），内容是 JSON，可以改写。
 * 但有一部分接口（例如“神抢手”页面）不会改走 HTTP，长连接不通就直接失败。
 * 所以不能一直拦着长连接。做法是：只在应用刚启动或闲置后重新连接的头几秒拦，
 * 让开屏、弹窗和首页第一屏的请求走 HTTP 并改写，之后放行长连接，其余功能照常。
 *
 * 角色由模块传入的 role 参数决定：
 *   window   规则脚本：现在是否处于拦截时段
 *   learned  规则脚本：目的地址是不是已学到的接入点，并且处于拦截时段
 *   learn    读应用自己的监控上报（走普通 HTTPS），把它连过的接入点记在本机
 *   rewrite  改写退回 HTTP 的接口响应：开屏广告、弹窗、信息流里的广告和推广
 */
'use strict';

var VERSION = '0.4.0';
var STORE_KEY = 'leetingo_meituan_shark';
var MAX_ENDPOINTS = 300;
var WINDOW_KEY = 'leetingo_meituan_window';
// 长连接超过这么久没有新的连接尝试，下一次尝试就当作应用重新开始使用
var IDLE_MS = 30000;
var BIG_MARK = '@@mtBigInt@@';

function log(msg) { try { console.log('[美团模块] ' + msg); } catch (e) {} }

function parseArgs(s) {
  var out = {};
  if (typeof s !== 'string') return out;
  var parts = s.trim().replace(/^"(.*)"$/, '$1').split('&');
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].indexOf('=');
    if (p < 1) continue;
    var v = parts[i].slice(p + 1).trim();
    if (/\{\{\{.*\}\}\}/.test(v)) continue;
    out[parts[i].slice(0, p).trim()] = v;
  }
  return out;
}

function isOn(value, fallback) {
  if (value === undefined || value === null) return fallback;
  var w = String(value).trim().toLowerCase();
  if (['true', '1', 'on', 'yes', '开', '开启', '是'].indexOf(w) >= 0) return true;
  if (['false', '0', 'off', 'no', '关', '关闭', '否'].indexOf(w) >= 0) return false;
  return fallback;
}

/* ---------- 已学到的接入点 ---------- */

function loadEndpoints() {
  try {
    var raw = $persistentStore.read(STORE_KEY);
    var j = raw ? JSON.parse(raw) : null;
    if (j && j.endpoints && typeof j.endpoints === 'object' && !Array.isArray(j.endpoints)) return j.endpoints;
  } catch (e) {}
  return {};
}

function saveEndpoints(endpoints) {
  var keys = Object.keys(endpoints);
  if (keys.length > MAX_ENDPOINTS) {
    keys.sort(function (a, b) { return endpoints[b] - endpoints[a]; });
    var kept = {};
    for (var i = 0; i < MAX_ENDPOINTS; i++) kept[keys[i]] = endpoints[keys[i]];
    endpoints = kept;
  }
  $persistentStore.write(JSON.stringify({ v: 1, endpoints: endpoints }), STORE_KEY);
}

/* ---------- 解开监控上报：base64 → gzip → 文本 ---------- */

function base64ToBytes(text) {
  var table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var map = {};
  for (var i = 0; i < 64; i++) map[table.charAt(i)] = i;
  map['-'] = 62; map['_'] = 63;
  var out = new Uint8Array(Math.floor(text.length * 3 / 4) + 3);
  var n = 0, buf = 0, bits = 0;
  for (var k = 0; k < text.length; k++) {
    var v = map[text.charAt(k)];
    if (v === undefined) continue; // 跳过 =、换行和其他字符
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) { bits -= 8; out[n++] = (buf >> bits) & 255; }
  }
  return out.subarray(0, n);
}

// RFC 1951 解压。输入是 gzip 里 deflate 数据的起始位置。
var LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
var LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
var DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
var DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
var CODE_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

function buildCodes(lengths, from, count) {
  var perLength = new Uint16Array(16);
  var symbols = new Uint16Array(count);
  var offsets = new Uint16Array(16);
  var i;
  for (i = 0; i < count; i++) perLength[lengths[from + i]]++;
  perLength[0] = 0;
  for (i = 1; i < 15; i++) offsets[i + 1] = offsets[i] + perLength[i];
  for (i = 0; i < count; i++) {
    var len = lengths[from + i];
    if (len !== 0) symbols[offsets[len]++] = i;
  }
  return { perLength: perLength, symbols: symbols };
}

function inflate(src, start) {
  var pos = start, bitBuf = 0, bitCnt = 0;
  var out = new Uint8Array(Math.max(1024, src.length * 6));
  var n = 0;

  function need(bytes) {
    if (n + bytes <= out.length) return;
    var bigger = new Uint8Array(Math.max(out.length * 2, n + bytes));
    bigger.set(out.subarray(0, n));
    out = bigger;
  }
  function bits(count) {
    while (bitCnt < count) {
      if (pos >= src.length) throw new Error('数据不完整');
      bitBuf |= src[pos++] << bitCnt;
      bitCnt += 8;
    }
    var value = bitBuf & ((1 << count) - 1);
    bitBuf >>>= count;
    bitCnt -= count;
    return value;
  }
  function symbol(codes) {
    var code = 0, first = 0, index = 0;
    for (var len = 1; len <= 15; len++) {
      code |= bits(1);
      var count = codes.perLength[len];
      if (code - count < first) return codes.symbols[index + (code - first)];
      index += count;
      first += count;
      first <<= 1;
      code <<= 1;
    }
    throw new Error('编码表无效');
  }
  function block(litCodes, distCodes) {
    for (;;) {
      var sym = symbol(litCodes);
      if (sym === 256) return;
      if (sym < 256) { need(1); out[n++] = sym; continue; }
      sym -= 257;
      if (sym >= 29) throw new Error('长度码无效');
      var length = LEN_BASE[sym] + bits(LEN_EXTRA[sym]);
      var ds = symbol(distCodes);
      if (ds >= 30) throw new Error('距离码无效');
      var dist = DIST_BASE[ds] + bits(DIST_EXTRA[ds]);
      if (dist > n) throw new Error('距离超出范围');
      need(length);
      for (var k = 0; k < length; k++) { out[n] = out[n - dist]; n++; }
    }
  }

  var fixedLit = null, fixedDist = null;
  for (;;) {
    var last = bits(1);
    var type = bits(2);
    if (type === 0) {
      bitBuf = 0; bitCnt = 0;
      if (pos + 4 > src.length) throw new Error('数据不完整');
      var len = src[pos] | (src[pos + 1] << 8);
      pos += 4;
      if (pos + len > src.length) throw new Error('数据不完整');
      need(len);
      out.set(src.subarray(pos, pos + len), n);
      n += len; pos += len;
    } else if (type === 1) {
      if (!fixedLit) {
        var fl = new Uint8Array(288 + 30), i;
        for (i = 0; i < 144; i++) fl[i] = 8;
        for (; i < 256; i++) fl[i] = 9;
        for (; i < 280; i++) fl[i] = 7;
        for (; i < 288; i++) fl[i] = 8;
        for (i = 0; i < 30; i++) fl[288 + i] = 5;
        fixedLit = buildCodes(fl, 0, 288);
        fixedDist = buildCodes(fl, 288, 30);
      }
      block(fixedLit, fixedDist);
    } else if (type === 2) {
      var nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4;
      if (nlen > 286 || ndist > 30) throw new Error('编码表过大');
      var lengths = new Uint8Array(320), j;
      for (j = 0; j < ncode; j++) lengths[CODE_ORDER[j]] = bits(3);
      var lenCodes = buildCodes(lengths, 0, 19);
      var all = new Uint8Array(nlen + ndist), idx = 0;
      while (idx < nlen + ndist) {
        var s = symbol(lenCodes);
        if (s < 16) { all[idx++] = s; continue; }
        var prev = 0, repeat;
        if (s === 16) {
          if (idx === 0) throw new Error('重复码无效');
          prev = all[idx - 1];
          repeat = 3 + bits(2);
        } else if (s === 17) repeat = 3 + bits(3);
        else repeat = 11 + bits(7);
        if (idx + repeat > nlen + ndist) throw new Error('重复码越界');
        while (repeat--) all[idx++] = prev;
      }
      block(buildCodes(all, 0, nlen), buildCodes(all, nlen, ndist));
    } else {
      throw new Error('块类型无效');
    }
    if (last) break;
  }
  return out.subarray(0, n);
}

function gunzip(bytes) {
  if (bytes.length < 18 || bytes[0] !== 0x1f || bytes[1] !== 0x8b || bytes[2] !== 8) throw new Error('不是 gzip');
  var flags = bytes[3];
  var pos = 10;
  if (flags & 4) pos += 2 + (bytes[pos] | (bytes[pos + 1] << 8));
  if (flags & 8) { while (pos < bytes.length && bytes[pos] !== 0) pos++; pos++; }
  if (flags & 16) { while (pos < bytes.length && bytes[pos] !== 0) pos++; pos++; }
  if (flags & 2) pos += 2;
  return inflate(bytes, pos);
}

function bytesToText(bytes) {
  var parts = [];
  for (var i = 0; i < bytes.length; i += 8192) {
    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, bytes.length))));
  }
  return parts.join('');
}

// 上报正文是 base64 过的 gzip，以 H4sI 开头；可能被表单编码过
function decodeReport(body) {
  var at = body.indexOf('H4sI');
  if (at < 0) {
    try { body = decodeURIComponent(body); } catch (e) { return null; }
    at = body.indexOf('H4sI');
    if (at < 0) return null;
  }
  var text = body.slice(at);
  if (text.indexOf('%') >= 0) { try { text = decodeURIComponent(text); } catch (e) {} }
  var end = text.indexOf('&');
  if (end >= 0) text = text.slice(0, end);
  return bytesToText(gunzip(base64ToBytes(text.replace(/ /g, '+'))));
}

function isPublicIPv4(ip) {
  var p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(function (x) { return !(x >= 0 && x <= 255); })) return false;
  if (p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224) return false;
  if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return false;
  if (p[0] === 169 && p[1] === 254) return false;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return false;
  if (p[0] === 192 && p[1] === 168) return false;
  if (p[0] === 198 && (p[1] === 18 || p[1] === 19)) return false;
  return true;
}

// 长连接记录里的写法：cn1.2.3.4:443[...] 是实际连的，*1.2.3.4:443[...] 是候选
function extractEndpoints(text) {
  var found = {};
  var re = /(?:cn|\*)(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})\[/g;
  var m;
  while ((m = re.exec(text)) !== null) {
    var port = Number(m[2]);
    if (port < 1 || port > 65535 || !isPublicIPv4(m[1])) continue;
    found[m[1] + ':' + port] = true;
  }
  return Object.keys(found);
}

/* ---------- 拦截时段 ---------- */

// 状态：{ start: 本次拦截开始的时间, last: 上一次连接尝试的时间, open: 是否已放行 }
function loadWindow() {
  try {
    var j = JSON.parse($persistentStore.read(WINDOW_KEY) || 'null');
    if (j && typeof j.start === 'number' && typeof j.last === 'number') return { start: j.start, last: j.last, open: j.open === true };
  } catch (e) {}
  return { start: 0, last: 0, open: true };
}

// 每次有长连接要建立时调用一次，返回这次要不要拦。
// 拦截中：从开始算起满了时长就放行。放行后：闲置够久再有新的连接尝试，才开始下一轮拦截。
// 这样拦截最多持续设定的秒数，不会因为应用反复重试而一直拦下去。
function shouldBlock(args) {
  var mode = String(args.window === undefined ? '10' : args.window).trim().toLowerCase();
  if (mode === 'always') return true;
  var seconds = Number(mode);
  if (!(seconds > 0)) return false;
  var now = Date.now();
  var st = loadWindow();
  var block;
  if (!st.open) {
    block = now - st.start < seconds * 1000;
    if (!block) st.open = true;
  } else if (now - st.last > IDLE_MS) {
    st.start = now;
    st.open = false;
    block = true;
  } else {
    block = false;
  }
  st.last = now;
  $persistentStore.write(JSON.stringify(st), WINDOW_KEY);
  return block;
}

/* ---------- 规则脚本 ---------- */

function onRuleWindow(args) {
  var matched = false;
  try { matched = shouldBlock(args); } catch (e) {}
  $done({ matched: matched });
}

function onRuleLearned(args) {
  var matched = false;
  try {
    if (isOn(args.learn, true) && $request && $request.hostname && loadEndpoints()[$request.hostname + ':' + $request.destPort]) {
      matched = shouldBlock(args);
    }
  } catch (e) {}
  $done({ matched: matched });
}

/* ---------- 学习接入点 ---------- */

function onLearn(args) {
  try {
    var body = $request.body;
    if (isOn(args.learn, true) && typeof body === 'string' && body.length > 0) {
      var text = decodeReport(body);
      var found = text ? extractEndpoints(text) : [];
      if (found.length > 0) {
        var endpoints = loadEndpoints();
        var now = Math.floor(Date.now() / 1000);
        var fresh = found.filter(function (ep) { return !endpoints[ep]; });
        found.forEach(function (ep) { endpoints[ep] = now; });
        saveEndpoints(endpoints);
        if (fresh.length) log('新学到 ' + fresh.length + ' 个长连接接入点：' + fresh.join('、'));
      }
    }
  } catch (e) {
    log('读取监控上报出错，已原样放行：' + (e && e.message));
  }
  $done({});
}

/* ---------- 改写响应 ---------- */

function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }

// 超过 16 位的整数先换成带标记的字符串，输出时换回来，避免丢精度
function protectBigInts(text) {
  if (!/\d{16}/.test(text)) return text;
  var out = '', last = 0, i = 0, n = text.length, inStr = false;
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
  return text.replace(/"@@mtBigInt@@(-?\d+)"/g, '$1');
}

// 开屏：data.start_picture 是一段 JSON 文本，里面的 ad 数组就是开屏广告
function rewriteOpenScreen(obj, cfg) {
  if (!cfg.splash || !isObj(obj) || !isObj(obj.data) || typeof obj.data.start_picture !== 'string') return 0;
  var inner;
  try { inner = JSON.parse(obj.data.start_picture); } catch (e) { return 0; }
  if (!isObj(inner) || !Array.isArray(inner.ad) || inner.ad.length === 0) return 0;
  var removed = inner.ad.length;
  inner.ad = [];
  obj.data.start_picture = JSON.stringify(inner);
  return removed;
}

// 信息流里的一张卡片是不是广告或推广
function feedModuleKind(mod) {
  if (!isObj(mod)) return null;
  var id = typeof mod.module_id === 'string' ? mod.module_id : '';
  if (id.indexOf('creative_ad_card') === 0) return 'ad';
  if (id.indexOf('home_page_side_insert_card') === 0 || id.indexOf('operation_topic_module') === 0) return 'promo';
  if (typeof mod.string_data !== 'string' || mod.string_data.indexOf('"charge_info"') < 0 && mod.string_data.indexOf('"ad_mark"') < 0 && mod.string_data.indexOf('"ad_type"') < 0) return null;
  var data;
  try { data = JSON.parse(mod.string_data); } catch (e) { return null; }
  if (!isObj(data) || !('poi_name' in data || 'poi_id_str' in data)) return null;
  // 付费推广的店铺：带广告标记、广告类型不为 0，或带计费信息。有的并不显示“广告”字样
  if (data.ad_mark === true) return 'ad';
  if (data.ad_type !== undefined && data.ad_type !== null && data.ad_type !== 0 && data.ad_type !== '0' && data.ad_type !== '') return 'ad';
  if (typeof data.charge_info === 'string' && data.charge_info.length > 0) return 'ad';
  return null;
}

function rewriteFeed(obj, cfg) {
  if (!isObj(obj) || !isObj(obj.data)) return 0;
  var changed = 0;
  var data = obj.data;
  if (cfg.popup && isObj(data.json_data) && Array.isArray(data.json_data.marketing_window) && data.json_data.marketing_window.length > 0) {
    changed += data.json_data.marketing_window.length;
    data.json_data.marketing_window = [];
  }
  if (Array.isArray(data.module_list) && (cfg.feed_ad || cfg.feed_promo)) {
    var kept = data.module_list.filter(function (mod) {
      var kind = feedModuleKind(mod);
      return !((kind === 'ad' && cfg.feed_ad) || (kind === 'promo' && cfg.feed_promo));
    });
    if (kept.length !== data.module_list.length) {
      changed += data.module_list.length - kept.length;
      data.module_list = kept;
    }
  }
  return changed;
}

function onRewrite(args) {
  try {
    var url = $request.url || '';
    var body = $response.body;
    if (typeof body !== 'string' || body.length === 0) return $done({});
    var cfg = {
      splash: isOn(args.splash, true), popup: isOn(args.popup, true),
      feed_ad: isOn(args.feed_ad, true), feed_promo: isOn(args.feed_promo, true)
    };
    var handler = null;
    if (/\/api\/v\d+\/openscreen/.test(url)) handler = rewriteOpenScreen;
    else if (/\/api\/v\d+\/home\/feeds\/(?:tabs|mainlist)/.test(url)) handler = rewriteFeed;
    if (!handler) return $done({});
    var obj;
    try { obj = JSON.parse(protectBigInts(body)); } catch (e) { return $done({}); }
    var changed = handler(obj, cfg);
    if (!changed) return $done({});
    log(url.replace(/\?.*$/, '').replace(/^https?:\/\/[^/]+/, '') + ' 去掉 ' + changed + ' 项');
    $done({ body: restoreBigInts(JSON.stringify(obj)) });
  } catch (e) {
    log('改写出错，已放行原始内容：' + (e && e.message));
    $done({});
  }
}

(function main() {
  var args = parseArgs(typeof $argument === 'string' ? $argument : '');
  var role = args.role;
  if (!role) {
    // 没有传 role 时按脚本类型和请求推断
    var type = (typeof $script !== 'undefined' && $script && $script.type) || '';
    var isHTTP = typeof $request !== 'undefined' && $request && typeof $request.url === 'string' && /^https?:/i.test($request.url);
    if (typeof $response !== 'undefined') role = 'rewrite';
    else if (type === 'rule' || !isHTTP) role = 'learned';
    else role = 'learn';
  }
  if (role === 'window') return onRuleWindow(args);
  if (role === 'learned') return onRuleLearned(args);
  if (role === 'rewrite') return onRewrite(args);
  return onLearn(args);
})();
