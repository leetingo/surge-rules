# surge-rules

自用的 Surge 规则集。每个文件一行一条规则，不带策略名，由配置里的 `RULE-SET` 引用。

| 文件 | 用途 | 引用地址 |
|---|---|---|
| `netflix.list` | 只含 Netflix 自有域名，不含共享云后缀和共享云地址段 | `https://raw.githubusercontent.com/leetingo/surge-rules/main/netflix.list` |
| `apns.list` | 只含 Apple 推送服务的域名和地址段 | `https://raw.githubusercontent.com/leetingo/surge-rules/main/apns.list` |

## 用法

```
RULE-SET,https://raw.githubusercontent.com/leetingo/surge-rules/main/netflix.list,Netflix,extended-matching,no-resolve
RULE-SET,https://raw.githubusercontent.com/leetingo/surge-rules/main/apns.list,"Apple APN",extended-matching,no-resolve
```

## 维护

改完文件后提交并推送到 `main`。Surge 默认每 24 小时重新下载一次，也可以在外部资源里手动更新。
