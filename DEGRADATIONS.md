# 已知降级与硬约束

> 站点能跑，但有这些"不是 bug 的 bug"。新增一条时请同时写明**为什么**与**什么时候该重看**。

## 搜索

- **中文只能词首前缀命中**。搜索索引来自 `contentIndex.json`，Quartz 的 FlexSearch 用 `tokenize: "forward"`，中文没有空格切分，所以"花"能命中"花园"，"园"不能。改法是换 tokenizer 或自己切词，代价是索引体积与构建时间。

## URL 与链接

- **站点 URL 不带结尾斜杠**（`https://notes.vasantlong.de5.net/某条目`），博客带。跨站互引必须手写绝对 URL，且不要给花园链接补斜杠。
- **GitHub Pages 不做服务端重定向**。改名靠 `@quartz-community/alias-redirects` 生成的跳转页（`<meta http-equiv="refresh">` + `canonical` + `noindex`），旧 URL 留在产物里而不是返回 301。
- **别名守卫会丢弃部分别名**：`index`、`404`、与现有页面撞名、已被更早条目占用、越界路径（`../`）。丢弃会在构建诊断里告警（`area: aliases`），不静默吞。见票 06。
- **`<meta content>` 里的中文 URL 仍是裸 UTF-8**。百分号编码只作用于 `href`（含组件生成的站内链接）；`og:url` 这类给爬虫读的标识不参与站内导航，故不编码。

## 内容与检索面

- **`unlisted: true` 不是隐私保护**。它只是不进搜索/索引/图谱/RSS；直链可访问，爬虫也能抓。要保密就别晋升进花园库。
- **行内 `#标签` 没有落点**。`tag-list` 关着（否则标签会变成站内标签页），与"标签即标签页"的诉求冲突，待决定后单开一票。见票 09。

## 托管面

- **GitHub Pages 不下发自定义响应头**（HSTS / CSP / X-Content-Type-Options 都没有）。这是产品限制，meta 绕不过；要安全头只能换 Cloudflare Pages。
- **默认域名 `vasantlong.github.io/notes/` 不能当预览用**：`baseUrl` 钉在自定义域名，产物里的资源路径都是站点根，默认域名下资源全 404。
- **仓库连续 60 天无 workflow 活动会被自动停用**，需要 `workflow_dispatch` 唤醒。

## 构建与测试

- **测试串行**（`--test-concurrency=1`）。每个 fixture 都真跑一次 `quartz build`，构建期把 `quartz/.quartz-cache/transpiled-build.mjs` 固定写在同一路径；并行时两个进程互相覆盖那份临时包，偶发 `buildQuartz is not a function`。
- **条目日期今天不可能来自 git**：条目契约强制 `date`，`modified` 继承它，git 时间轮不到。`fetch-depth: 0` 是将来放开 `date` 必填时的保险。
