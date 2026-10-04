# surge-rules

自用的 Surge 规则、模块和脚本。

## 目录

| 目录 | 内容 | 说明 |
|---|---|---|
| `rules/` | 规则集 | 每行一条规则，不带策略名，由配置里的 `RULE-SET` 引用 |
| `modules/` | 模块 | `.sgmodule` 文件，在 Surge 里用地址安装 |
| `scripts/` | 脚本 | 模块引用的脚本放这里，目前为空 |

## 规则集

| 文件 | 用途 |
|---|---|
| `rules/netflix.list` | 只含 Netflix 自有域名，不含共享云后缀和共享云地址段 |
| `rules/apns.list` | 只含 Apple 推送服务的域名和地址段 |

```
RULE-SET,https://raw.githubusercontent.com/leetingo/surge-rules/main/rules/netflix.list,Netflix,extended-matching,no-resolve
RULE-SET,https://raw.githubusercontent.com/leetingo/surge-rules/main/rules/apns.list,"Apple APN",extended-matching,no-resolve
```

## 模块

| 文件 | 用途 |
|---|---|
| `modules/weibo.sgmodule` | 微博去广告：开屏广告、信息流广告、关注流里的推荐微博、详情页广告卡片、评论区广告、发现页轮播窗、消息页的广告和推荐关注、“我”页面的任务卡片、钱包、活动入口和为你推荐、推荐直播条、签到弹窗、悬浮窗。只有规则、响应改写和本地映射，不含脚本 |

安装地址：

```
https://raw.githubusercontent.com/leetingo/surge-rules/main/modules/weibo.sgmodule
```

微博模块按接口返回里的标记过滤：广告微博看 `mblogtypename` 为“广告”、`is_ad` 或 `ad_state` 为 1、`readtimetype` 为 `adMblog`；广告卡片看 `is_ad_card`；关注流里的推荐微博看作者未关注且带推荐标题。需要已安装并信任 Surge 的 MITM 证书。

## 维护

改完文件后提交并推送到 `main`。Surge 默认每 24 小时重新下载一次规则集，也可以在外部资源里手动更新；模块在模块列表里手动更新。
