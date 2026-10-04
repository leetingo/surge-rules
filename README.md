# surge-rules

自用的 Surge 规则、模块和脚本。

## 目录

| 目录 | 内容 | 说明 |
|---|---|---|
| `rules/` | 规则集 | 每行一条规则，不带策略名，由配置里的 `RULE-SET` 引用 |
| `modules/` | 模块 | `.sgmodule` 文件，在 Surge 里用地址安装 |
| `scripts/` | 脚本 | 模块引用的脚本 |
| `tools/` | 生成工具 | 根据脚本里的设置项生成模块文件 |
| `assets/` | 图片 | 模块用到的图标 |

## 规则集

| 文件 | 用途 |
|---|---|
| `rules/netflix.list` | 只含 Netflix 自有域名，不含共享云后缀和共享云地址段 |
| `rules/apns.list` | 只含 Apple 推送服务的域名和地址段 |
| `rules/meituan-shark.list` | 美团私有长连接接入服务器所在的地址段，只给美团外卖模块用，不单独引用 |

```
RULE-SET,https://raw.githubusercontent.com/leetingo/surge-rules/main/rules/netflix.list,Netflix,extended-matching,no-resolve
RULE-SET,https://raw.githubusercontent.com/leetingo/surge-rules/main/rules/apns.list,"Apple APN",extended-matching,no-resolve
```

## 微博模块

微博拆成两个模块，可以只装一个，也可以都装。需要已安装并信任 Surge 的 MITM 证书。

| 模块 | 负责的内容 | 安装地址 |
|---|---|---|
| 微博：去广告 | 广告，以及内容里的推广、推荐和提示：开屏、信息流、发现页、微博详情、评论区、消息页、弹窗和引导 | `https://raw.githubusercontent.com/leetingo/surge-rules/main/modules/weibo-adblock.sgmodule` |
| 微博：界面 | 页面布局：“我”页面、私信列表、首页直播条 | `https://raw.githubusercontent.com/leetingo/surge-rules/main/modules/weibo-ui.sgmodule` |

Surge 对同一个响应只运行一个脚本，所以每个接口只归其中一个模块。信息流、详情页和评论区的接口归去广告模块，这几页里不是广告的推荐和提示也放在它里面。

### 每一项都能单独设置

有两个地方可以改，改的是同一批设置项：

1. **模块参数**。在 Surge 的模块列表里编辑参数。开关类填 `true` 或 `false`，选项类填说明里列出的值，多个值用 `|` 分隔。
2. **微博里的管理页面**。两个模块都会在“我”页面的快捷入口里加一个“模块设置”，点开就是管理页面，每一项是开关或选项，改动立即保存。

取值顺序是：默认值，然后是模块参数，最后是管理页面保存的值。管理页面里改过的项目会标出“已改”，点“恢复为模块参数”可以清除。

三项只能在模块参数里改：两条域名规则 `biz_domain` 和 `huodong_domain`，以及是否显示入口 `entry`。

### 去广告模块的设置项

| 参数 | 分组 | 内容 | 默认 |
|---|---|---|---|
| `splash` | 开屏 | 开屏广告 | `true` |
| `feed_ad` | 信息流 | 信息流广告 | `true` |
| `follow_rec` | 信息流 | 关注流里的推荐微博：`titled` 只去掉带推荐标题的，`all` 未关注的一律去掉，`off` 不处理 | `titled` |
| `notify_nag` | 信息流 | “开启通知”横幅 | `true` |
| `discover_banner` | 发现页 | 顶部轮播窗 | `true` |
| `hot_search_ad` | 发现页 | 热搜里的推广条目 | `true` |
| `detail_ad` | 微博详情 | 广告卡片 | `true` |
| `detail_hot_search` | 微博详情 | “大家都在搜”卡片 | `true` |
| `detail_reward` | 微博详情 | 赞赏信息 | `true` |
| `detail_share_tip` | 微博详情 | 分享里的红包提示 | `true` |
| `detail_positive` | 微博详情 | 互动后的推荐内容 | `true` |
| `comment_ad` | 评论区 | 评论区广告 | `true` |
| `comment_tip` | 评论区 | 顶部提示条 | `true` |
| `comment_ai` | 评论区 | AI 总结和调查卡片 | `true` |
| `message_ad` | 消息页 | 动态里的广告卡片 | `true` |
| `message_rec` | 消息页 | 推荐关注 | `true` |
| `popup_float` | 弹窗和引导 | 悬浮窗 | `true` |
| `redpacket` | 弹窗和引导 | 信息流红包图标 | `true` |
| `launch_guide` | 弹窗和引导 | 启动引导和横幅 | `true` |
| `checkin` | 弹窗和引导 | 签到弹窗 | `true` |
| `push_daily` | 弹窗和引导 | 通知开关引导 | `true` |
| `hot_spotlight` | 弹窗和引导 | 热门微博聚光 | `true` |
| `biz_domain` | 域名 | 广告平台域名 `biz.weibo.com`：`REJECT` 拦截，`DIRECT` 不拦截 | `REJECT` |
| `huodong_domain` | 域名 | 活动域名 `huodong.weibo.cn`：`REJECT` 拦截，`DIRECT` 不拦截 | `REJECT` |
| `entry` | 入口 | “我”页面里的“模块设置”入口 | `true` |

### 界面模块的设置项

| 参数 | 分组 | 内容 | 默认 |
|---|---|---|---|
| `me_vip` | “我”页面 | 会员头图和会员入口 | `true` |
| `me_shortcuts` | “我”页面 | 保留的快捷入口，`all` 表示不改动 | `album\|like\|watchhistory\|draft` |
| `me_cards` | “我”页面 | 任务和活动卡片 | `true` |
| `me_wallet` | “我”页面 | 钱包一栏 | `true` |
| `me_recommend` | “我”页面 | 为你推荐 | `true` |
| `dm_hide` | 私信列表 | 按名称隐藏的入口 | `群推荐\|活动通知` |
| `live_strip` | 首页 | 直播条里的推荐直播 | `true` |
| `entry` | 入口 | “我”页面里的“模块设置”入口 | `true` |

快捷入口的标识：`album` 我的相册，`like` 赞/收藏，`watchhistory` 浏览记录，`draft` 草稿箱，`pay` 我的钱包，`ordercenter` 微博购订单，`productcenter` 创作中心，`dress` 个性皮肤。

### 实现

- `scripts/weibo.js` 是两个模块共用的脚本，负责改写响应、拦下几个请求，以及提供管理页面和它读写设置用的接口。管理页面的地址是 `https://api.weibo.cn/surge-rules/weibo/settings`，由脚本在本机直接返回，不会发到微博服务器。
- 管理页面保存的值放在 Surge 的持久化存储里，键是 `leetingo_weibo_ad` 和 `leetingo_weibo_ui`。
- “模块设置”入口由一条响应改写规则添加，两个模块写的是同一条，已经有入口时不会重复加。
- 广告按接口返回里的标记判断：`mblogtypename` 为“广告”或“热推”，`is_ad` 或 `ad_state` 为 1，`readtimetype` 为 `adMblog`，`is_ad_card` 为 1，以及 `promotion`、`content_auth_info`、`ads_material_info` 里的广告标记。

## 美团外卖模块

| 模块 | 负责的内容 | 安装地址 |
|---|---|---|
| 美团外卖：去广告 | 开屏广告、启动弹窗、首页第一屏信息流里的广告和推广卡片 | `https://raw.githubusercontent.com/leetingo/surge-rules/main/modules/meituan-waimai.sgmodule` |

### 为什么只管启动的头几秒

美团外卖的接口平时不走普通的 HTTP，而是走私有长连接，按 IP 直连接入服务器的 443 端口，Surge 看不到内容。长连接连不上时，大部分接口会退回明文 HTTP，内容是普通 JSON，可以改写。但有一部分接口不会退回，例如“神抢手”页面，长连接不通就直接打不开。

所以模块不一直拦着长连接，只在应用启动、或闲置后重新连接的头几秒拦。这段时间里开屏、弹窗和首页第一屏的接口走 HTTP 并被改写，之后放行，其余功能照常。代价是往下滑加载出来的后续内容不经过改写。

### 设置项

| 参数 | 内容 | 默认 |
|---|---|---|
| `window` | 启动后拦截长连接的秒数。`0` 完全不拦，也就不去广告；`always` 一直拦，去得最全，但“神抢手”等页面会打不开 | `10` |
| `upstream` | 退回的接口用什么协议发出去。`https` 由 Surge 升级成 HTTPS；`http` 保持应用原本的明文方式 | `https` |
| `learn` | 自动学习长连接的接入点 | `true` |
| `splash` | 开屏广告 | `true` |
| `popup` | 启动弹窗 | `true` |
| `feed_ad` | 信息流广告：创意广告卡片，以及付费推广的店铺 | `true` |
| `feed_promo` | 信息流里的推广卡片：“特价外卖”卡片和活动专题卡片 | `true` |

### 实现

- 两条规则只匹配按 IP 直连、既不是 TLS 也不是 HTTP 的 TCP 连接，并且只在拦截时段内生效，不影响按域名访问的普通请求。
- **固定清单** `rules/meituan-shark.list`：APNIC 注册库里登记在美团名下的全部网段，外加抓包里见过的云上接入点。
- **自动学习**：云上的接入点会换，没法预先列全。应用会把连过的接入服务器写进自己的监控上报，这份上报走普通 HTTPS。`scripts/meituan.js` 读出里面的地址记在本机，上报内容原样放行，记下来的只有 IP 和端口。
- **拦截时段**由规则脚本判断：闲置 30 秒以上之后的第一次连接尝试开始计时，满了设定的秒数就放行。一轮拦截最多持续设定的时长，不会因为应用反复重试而一直拦下去。
- 外卖接口退回时用的是明文 HTTP，登录凭证会不加密地经过网络。模块用一条改写规则把它升级成 HTTPS 再发出去，应用感觉不到。
- 付费推广的店铺按接口里的标记判断：带广告标记、广告类型不为 0，或带计费信息。这类店铺有的并不显示“广告”字样。

## 维护

改完文件后提交并推送到 `main`。Surge 默认每 24 小时重新下载一次规则集，也可以在外部资源里手动更新；模块在模块列表里手动更新。

微博模块的设置项都定义在 `scripts/weibo.js` 的 `SCHEMA` 里，两个模块文件由它生成，不要手改：

```
node tools/build-weibo.js
```

改了脚本要同时改 `VERSION`。模块里的脚本地址带版本号，更新模块后 Surge 会重新下载脚本。
