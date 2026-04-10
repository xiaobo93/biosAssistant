---
name: web
description: 网页访问技能（HTTP-only）：提供 DuckDuckGo 搜索与网页内容抓取（不含无头浏览器渲染）。
version: 0.1.0
---

# Web 技能

本技能提供两个工具：

- `webSearch`：基于 DuckDuckGo 的 HTML 结果页进行搜索，返回 `title/url/snippet` 列表。
- `webFetch`：抓取指定 URL 的页面内容，返回标题与纯文本（会做超时与体积限制）。

## 注意与限制

- 这是 **HTTP-only** 方案，不会执行页面 JavaScript，也不会自动点击或登录；对 SPA/强反爬页面效果有限。
- DuckDuckGo 可能会返回 403/验证码页或页面结构变化；`webSearch` 解析会做容错，但无法保证稳定。
- 为安全起见，`webFetch` 默认拒绝 `localhost` 与常见私网/链路本地 IP（不做 DNS 解析到 IP 的进一步校验）。

