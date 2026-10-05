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
| `profile_ad` | 个人主页 | 他人个人主页时间线中明确标记的广告 | `true` |
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

### 5.2.1 修正

5.2.0 曾发布没有实际广告 HAR 验证的接口扩展，5.2.1 已撤回：旧版热门／分组／转发流、卡片列表、额外搜索、视频流和预加载、旧版评论及详情，以及新增的 `mapi.weibo.com` 覆盖。现有功能恢复到 5.1.1 的处理范围，只新增经过真实 HAR 验证的 `api.weibo.cn/2/profile/container_timeline`。

主页只处理抓包确认的顶层 `items[].data`，不深入未知容器或转发正文；普通历史转发也会带 `readtimetype=adMblog`，因此主页不单凭这一项删帖。`profile_ad` 默认开启，可单独关闭。

验证样本：`2026-10-05-104213.har`。主页 26 条记录中精确移除 2 条明确广告，其余 24 条、分页及导航元数据保持一致；关闭开关时响应逐字保留。已验证的是离线响应改写，手机更新后的实际显示还需复测。原始 HAR 不进入仓库。

## 开屏广告模块

| 模块 | 状态 | 安装地址 |
|---|---|---|
| 美团外卖：去开屏广告 | 可用 | `https://raw.githubusercontent.com/leetingo/surge-rules/main/modules/meituan-waimai.sgmodule` |
| 京东：去开屏广告（第一步） | 取证版，还不删任何内容 | `https://raw.githubusercontent.com/leetingo/surge-rules/main/modules/jd.sgmodule` |

### 美团外卖

只做一件事：拦下开屏广告的图片和视频素材。素材下载不下来，开屏广告就无法显示。

- 图片素材在 `img.meituan.net/bizad/bizad_brandCpt_*`，失败后会改用 `p10.meituan.net` 等备用图片域名重试；模块同时匹配 `img` 和 `p` 加数字的域名，仍只拦这条开屏素材路径。视频素材在 `s3plus.meituan.net/v1/<桶>/brandcpt-vedio/`。
- 0.5.1 根据抓包补上备用图片域名：原域名被拒后，`p10.meituan.net` 下载的四张图片与原素材内容完全相同。三份 HAR 的离线匹配检查覆盖了 17 次开屏素材请求，没有匹配其中其余 1214 次请求；更新后的手机实测仍需确认。
- 已经下载到手机里的素材不受影响，会显示到排期结束。想立刻见效，在应用里清一次缓存。
- 不碰应用的接口。美团外卖的接口走私有长连接，一直拦着它会让“神抢手”等页面打不开；只在启动时短暂拦截的做法试过，效果有限，已经放弃。那一版在提交 `be1cf9d` 里。

### 京东

京东的主接口同样走私有通道。第一步模块只包含一条规则，让它退回普通 HTTPS，用来抓包找出开屏广告的接口和素材地址。找到之后改成只拦素材的做法。

## 维护

新增拦截逻辑或扩大接口范围，必须先用含实际目标广告的真实 HAR 回放，验证广告被移除、正常内容和分页保留，再发布。合成测试、语法检查、没有目标广告的 HAR，以及参考其他作者规则，都不能替代这一步。没有证据的遗漏只能列为待验证，不能一起发布。

微博主页发布验证：`WEIBO_HAR_PATH=/本机抓包路径.har node --test tools/test-weibo.js`。未提供真实 HAR 时检查失败。

改完文件后提交并推送到 `main`。Surge 默认每 24 小时重新下载一次规则集，也可以在外部资源里手动更新；模块在模块列表里手动更新。

微博模块的设置项都定义在 `scripts/weibo.js` 的 `SCHEMA` 里，两个模块文件由它生成，不要手改：

```
node tools/build-weibo.js
```

改了脚本要同时改 `VERSION`。模块里的脚本地址带版本号，更新模块后 Surge 会重新下载脚本。
