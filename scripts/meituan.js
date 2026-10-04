/**
 * 美团外卖模块脚本
 * 仓库：https://github.com/leetingo/surge-rules
 *
 * 美团的接口默认走私有长连接（Shark）：按 IP 直连接入服务器，不是 TLS，Surge 看不到内容。
 * 长连接连不上时，应用会把请求改走 HTTPS。但接入服务器很多，除了美团自己的地址段，
 * 还有放在各家云厂商上的，而且会换，没法预先列全。
 *
 * 这个脚本让模块自己学：应用会把“这次连了哪台接入服务器”写进自己的监控上报里，
 * 上报走的是普通 HTTPS。脚本读这份上报，把里面的接入点地址记下来，之后发往这些地址的
 * 长连接一律拒绝。全部数据只在本机处理，记下来的只有 IP 和端口。
 *
 * 两个角色，由 Surge 的脚本类型决定：
 *   http-request  读 catdot.dianping.com 的监控上报，学习接入点；可选地断开已连上的长连接
 *   rule          判断一条连接的目的地址是不是已学到的接入点
 */
'use strict';

var VERSION = '0.3.0';
var STORE_KEY = 'leetingo_meituan_shark';
var MAX_ENDPOINTS = 300;

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

/* ---------- 两个角色 ---------- */

function onRule(args) {
  var matched = false;
  try {
    if (isOn(args.learn, true) && $request && $request.hostname) {
      matched = !!loadEndpoints()[$request.hostname + ':' + $request.destPort];
    }
  } catch (e) {}
  $done({ matched: matched });
}

function onReport(args) {
  var finished = false;
  function finish() { if (!finished) { finished = true; $done({}); } }
  try {
    var body = $request.body;
    if (!isOn(args.learn, true) || typeof body !== 'string' || body.length === 0) return finish();
    var text = decodeReport(body);
    if (!text) return finish();
    var found = extractEndpoints(text);
    if (found.length === 0) return finish();

    var endpoints = loadEndpoints();
    var now = Math.floor(Date.now() / 1000);
    var fresh = found.filter(function (ep) { return !endpoints[ep]; });
    found.forEach(function (ep) { endpoints[ep] = now; });
    saveEndpoints(endpoints);
    if (fresh.length) log('新学到 ' + fresh.length + ' 个长连接接入点：' + fresh.join('、'));

    // 已经连上的长连接不会再过规则，要主动断开，应用重连时才会被拒
    if (!isOn(args.kill, true) || typeof $httpAPI !== 'function') return finish();
    setTimeout(finish, 1500);
    $httpAPI('GET', '/v1/requests/active', null, function (result) {
      try {
        var requests = (result && result.requests) || [];
        var killed = 0;
        for (var i = 0; i < requests.length; i++) {
          var r = requests[i];
          if (!r || String(r.method).toUpperCase() !== 'TCP' || !endpoints[r.remoteHost]) continue;
          killed++;
          $httpAPI('POST', '/v1/requests/kill', { id: r.id }, function () {});
        }
        if (killed) log('断开 ' + killed + ' 条正在使用的长连接');
      } catch (e) {}
      finish();
    });
  } catch (e) {
    log('读取监控上报出错，已原样放行：' + (e && e.message));
    finish();
  }
}

(function main() {
  var args = parseArgs(typeof $argument === 'string' ? $argument : '');
  var type = (typeof $script !== 'undefined' && $script && $script.type) || '';
  var isHTTP = typeof $request !== 'undefined' && $request && typeof $request.url === 'string' && /^https?:/i.test($request.url);
  if (type === 'rule' || (type === '' && !isHTTP)) return onRule(args);
  return onReport(args);
})();
