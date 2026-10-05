# surge-rules

自用的 Surge 规则集、模块和脚本。

## 目标

- 去掉常用 App 的广告和干扰内容，只动确认是广告的部分，正常内容、分页和功能保持不变。
- 每条规则、每个改写都以真实抓包为依据：拦截和改写必须在含目标广告的 HAR 上回放通过才会发布，不凭猜测扩大范围。
- 尽量细粒度，能单独开关的项目都可以单独开关。

## 包含内容

| 类型 | 名称 | 说明 |
|---|---|---|
| 规则集 | `rules/netflix.list` | 只含 Netflix 自有域名，不含共享云后缀和地址段 |
| 规则集 | `rules/apns.list` | 只含 Apple 推送服务的域名和地址段 |
| 模块 | 微博：去广告 | 开屏、信息流、个人主页、发现页、详情、评论区、消息页的广告和推广，以及弹窗引导 |
| 模块 | 微博：界面 | 精简“我”页面、私信列表、首页直播条 |
| 模块 | 美团外卖：去开屏广告 | 拦下开屏广告的图片和视频素材，不碰应用接口 |
| 模块 | 京东：去开屏广告（第一步） | 取证版，只让主接口退回 HTTPS 以便抓包，暂不删任何内容 |

微博两个模块的每一项都能单独设置：在 Surge 模块参数里改，或者在微博“我”页面快捷入口的“模块设置”里改。可用参数见模块文件。

## 安装

模块需要已安装并信任 Surge 的 MITM 证书。在 Surge 的模块列表里选“从 URL 安装”，填入地址：

| 模块 | 安装地址 |
|---|---|
| 微博：去广告 | https://raw.githubusercontent.com/leetingo/surge-rules/main/modules/weibo-adblock.sgmodule |
| 微博：界面 | https://raw.githubusercontent.com/leetingo/surge-rules/main/modules/weibo-ui.sgmodule |
| 美团外卖：去开屏广告 | https://raw.githubusercontent.com/leetingo/surge-rules/main/modules/meituan-waimai.sgmodule |
| 京东：去开屏广告（第一步） | https://raw.githubusercontent.com/leetingo/surge-rules/main/modules/jd.sgmodule |

规则集在配置的 `[Rule]` 里引用，策略名换成自己的：

```
RULE-SET,https://raw.githubusercontent.com/leetingo/surge-rules/main/rules/netflix.list,Netflix,extended-matching,no-resolve
RULE-SET,https://raw.githubusercontent.com/leetingo/surge-rules/main/rules/apns.list,"Apple APN",extended-matching,no-resolve
```

模块更新后在模块列表里手动更新；规则集默认每 24 小时重新下载，也可以在外部资源里手动更新。
