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
| `modules/jd.sgmodule` | 京东去广告：弹窗与底部通栏、首页悬浮图标、推荐流广告商品、搜索框推荐词。只有规则和响应改写，不含脚本 |

安装地址：

```
https://raw.githubusercontent.com/leetingo/surge-rules/main/modules/jd.sgmodule
```

京东模块的原理：京东的主接口默认走 443 端口上的非 TLS 私有通道，无法解密。模块里的规则只拒绝这类连接，App 会退回普通 HTTPS，之后才能改写接口返回的内容。需要已安装并信任 Surge 的 MITM 证书。

## 维护

改完文件后提交并推送到 `main`。Surge 默认每 24 小时重新下载一次规则集，也可以在外部资源里手动更新；模块在模块列表里手动更新。
