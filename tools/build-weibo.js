#!/usr/bin/env node
/**
 * 根据 scripts/weibo.js 里的 SCHEMA 生成两个微博模块。
 * 改了设置项之后运行：node tools/build-weibo.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { $done() {}, console: { log() {} } };
vm.runInNewContext(fs.readFileSync(path.join(root, 'scripts/weibo.js'), 'utf8'), ctx);
const { SCHEMA, VERSION, ENTRY_ID, PAGE_PATH } = ctx;

const RAW = 'https://raw.githubusercontent.com/leetingo/surge-rules/main';
const SCRIPT = `${RAW}/scripts/weibo.js?v=${VERSION}`;
const PAGE_URL = `https://api.weibo.cn${PAGE_PATH}`;

function defaultText(item) {
  if (item.type === 'bool') return item.def ? 'true' : 'false';
  if (item.type === 'multi') return item.def.join('|');
  return String(item.def);
}

function argumentsLine(mod) {
  const s = SCHEMA[mod];
  return s.items.map((i) => `${i.key}:${defaultText(i)}`).concat(s.fixed.map((f) => `${f.key}:${f.def}`)).join(',');
}

const FIXED_DESC = {
  biz_domain: ['[域名] 广告平台域名 biz.weibo.com', '    ├ REJECT: 拦截', '    └ DIRECT: 不拦截', '广告图片，以及广告的曝光和点击上报。只能在这里改。'],
  huodong_domain: ['[域名] 活动域名 huodong.weibo.cn', '    ├ REJECT: 拦截', '    └ DIRECT: 不拦截', '活动页面。只能在这里改。'],
  entry: ['[入口] “我”页面里的“模块设置”入口', '填 false 不显示。只能在这里改。'],
};

function argumentsDesc(mod) {
  const s = SCHEMA[mod];
  const blocks = ['开关类填 true 或 false。在微博里“我”页面的“模块设置”中改过的项目，优先于这里的值。'];
  for (const i of s.items) {
    const lines = [`${i.key}: [${i.group}] ${i.title}`];
    if (i.type === 'select') i.options.forEach((o, n) => lines.push(`    ${n === i.options.length - 1 ? '└' : '├'} ${o[0]}: ${o[1]}`));
    if (i.type === 'multi') {
      i.options.forEach((o, n) => lines.push(`    ${n === i.options.length - 1 ? '└' : '├'} ${o[0]}${o[0] === o[1] ? '' : ': ' + o[1]}`));
      lines.push('多个值用 | 分隔。');
    }
    lines.push(i.desc);
    blocks.push(lines.join('\\n'));
  }
  for (const f of s.fixed) blocks.push(`${f.key}: ` + FIXED_DESC[f.key].join('\\n'));
  return blocks.join('\\n\\n');
}

function scriptArgument(mod) {
  const s = SCHEMA[mod];
  const keys = s.items.map((i) => i.key).concat(s.fixed.map((f) => f.key));
  return `"module=${mod}&` + keys.map((k) => `${k}={{{${k}}}}`).join('&') + '"';
}

// “我”页面的入口用响应改写来加，两个模块写的是同一条，已经有入口时不会重复加
const ENTRY_JQ = [
  'if ("{{{entry}}}" | ascii_downcase | test("^(false|0|off|no|关|关闭|否)$")) then .',
  'elif type == "object" and (.items | type) == "array" then .items |= map(',
  'if type == "object" and ((.itemId // "") | tostring | endswith("_-_top8")) and (.items | type) == "array"',
  `and (any(.items[]; type == "object" and .itemId == "${ENTRY_ID}") | not)`,
  'then (.items | map(select(type == "object" and .type == "iconInfo" and (.content | type) == "object" and (.image | type) == "object"))) as $cells',
  '| if ($cells | length) == 0 then . else .items += [',
  '(($cells | map(select((.itemId // "") | tostring | endswith("_-_draft"))) | .[0]) // $cells[-1])',
  `| del(.dot) | .itemId = "${ENTRY_ID}" | .content.content = "模块设置"`,
  `| .image.iconUrl = "${RAW}/assets/weibo-settings.png"`,
  '| (if (.image.style | type) == "object" then del(.image.style.darkMode) else . end)',
  `| .click = {executeType: "depend", type: "group", modules: [{type: "scheme", scheme: "${PAGE_URL}"}]}`,
  '] end else . end) else . end',
].join(' ');

const ENTRY_RULE = [
  '# 在“我”页面的快捷入口里加一个“模块设置”，点开是微博里的管理页面。参数 entry 填 false 可以去掉',
  `http-response-jq ^https:\\/\\/api\\.weibo\\.cn\\/2\\/profile\\/me '${ENTRY_JQ}'`,
];

function header(mod, desc) {
  return [
    `#!name=${SCHEMA[mod].name}`,
    `#!desc=${desc}`,
    '#!category=微博',
    '#!author=leetingo',
    '#!homepage=https://github.com/leetingo/surge-rules',
    `#!version=${VERSION}`,
    `#!arguments=${argumentsLine(mod)}`,
    `#!arguments-desc=${argumentsDesc(mod)}`,
    '',
  ];
}

const settingsLine = (mod) =>
  `weibo.${mod}.settings = type=http-request, pattern=^https:\\/\\/api\\.weibo\\.cn\\/surge-rules\\/weibo\\/(?:settings|api\\/${mod})(?:\\?|$), requires-body=1, max-size=65536, script-path=${SCRIPT}, argument=${scriptArgument(mod)}`;

const ad = header('ad', '去掉微博的广告，以及内容里的推广、推荐和提示。每一项都能单独开关：在模块参数里改，或者在微博“我”页面的“模块设置”里改。').concat([
  '[Rule]',
  '# 广告平台的域名：广告图片，以及广告的曝光和点击上报',
  'DOMAIN-SUFFIX,biz.weibo.com,{{{biz_domain}}}',
  '# 活动页面的域名',
  'DOMAIN,huodong.weibo.cn,{{{huodong_domain}}}',
  '',
  '[Body Rewrite]',
  ...ENTRY_RULE,
  '',
  '[Script]',
  '# 改写响应：开屏、信息流、发现页、详情页、评论区、消息页、启动配置、签到',
  `weibo.ad.response = type=http-response, pattern=^https:\\/\\/(?:api\\.weibo\\.cn\\/2\\/(?:statuses\\/container_(?:timeline|detail\\?|detail_comment|positive)|search\\/(?:finder\\?|container_timeline)|messageflow\\/notice|push\\/active|checkin\\/show)|bootpreload\\.uve\\.weibo\\.com\\/v[12]\\/ad\\/preload), requires-body=1, max-size=2097152, timeout=10, script-path=${SCRIPT}, argument=${scriptArgument('ad')}`,
  '# 直接返回空结果的请求：开屏广告的实时请求、通知开关引导的配置、热门微博聚光',
  `weibo.ad.block = type=http-request, pattern=^https:\\/\\/(?:bootrealtime\\.uve\\.weibo\\.com\\/v[23]\\/ad\\/realtime|api\\.weibo\\.cn\\/2\\/(?:push\\/daily|hot\\/hours_spotlight\\?)), script-path=${SCRIPT}, argument=${scriptArgument('ad')}`,
  '# 微博里的管理页面，以及它读写设置用的接口',
  settingsLine('ad'),
  '',
  '[MITM]',
  'hostname = %APPEND% api.weibo.cn, bootpreload.uve.weibo.com, bootrealtime.uve.weibo.com',
  '',
]);

const ui = header('ui', '精简微博的页面布局：“我”页面、私信列表、首页直播条。每一项都能单独设置：在模块参数里改，或者在微博“我”页面的“模块设置”里改。').concat([
  '[Body Rewrite]',
  ...ENTRY_RULE,
  '',
  '[Script]',
  '# 改写响应：“我”页面、私信列表、首页直播条',
  `weibo.ui.response = type=http-response, pattern=^https:\\/\\/api\\.weibo\\.cn\\/2\\/(?:profile\\/me|direct_messages\\/user_list|live\\/media_homelist), requires-body=1, max-size=2097152, timeout=10, script-path=${SCRIPT}, argument=${scriptArgument('ui')}`,
  '# 微博里的管理页面，以及它读写设置用的接口',
  settingsLine('ui'),
  '',
  '[MITM]',
  'hostname = %APPEND% api.weibo.cn',
  '',
]);

fs.writeFileSync(path.join(root, 'modules/weibo-adblock.sgmodule'), ad.join('\n'));
fs.writeFileSync(path.join(root, 'modules/weibo-ui.sgmodule'), ui.join('\n'));
console.log(`已生成 modules/weibo-adblock.sgmodule 和 modules/weibo-ui.sgmodule，版本 ${VERSION}`);
