---
Status: ready-for-agent
---

# 花园站：独立笔记站（notes.vasantlong.de5.net）

## Problem Statement

我在 Obsidian 里写了一批笔记，希望其中一部分能被公开阅读，而且**链接、嵌入、callout、公式、Canvas 这些结构在发布后还在**。现有的博客做不到这件事：它承载的是 Hugo 文章，`[[双链]]`、`![[嵌入]]`、`==高亮==`、`^[行内脚注]` 都要先手改成普通 Markdown 才能生效，改完笔记之间的网络结构（反链、图谱）也不复存在——发布一次就等于把笔记拆成互不相干的页面。博客主题是 vendored 的、还压着 12 项安全自检，为了笔记语法去改它既不划算也不安全。

同时我担心另一件事：**私密内容不能因为一次疏忽就上线**。知识库里有日记、工作记录这类永不公开的东西，我不想让"发布"变成一个需要每次小心翼翼的删减动作。

## Solution

一个独立的花园站，域名 `notes.vasantlong.de5.net`，内容源是一个**专用花园库**——里面的一切本来就是给读者看的。写作仍在 Obsidian 里进行，写完之后把笔记**晋升**进花园库并补齐前置字段，push 即上线：双链、嵌入、高亮、行内脚注、图片尺寸、Canvas、Bases、中文文件名全部原样生效，每页自带反链与图谱。**没标发布的笔记在站点上不存在**（不是隐藏），并且推送前会有一道字段检查把遗漏挡在本地。博客保持原样，两站只以绝对 URL 互相指认。

## User Stories

### 闸门与发布态

1. 作为作者，我想让没标 `publish: true` 的笔记在站点上"不存在"，这样我在花园库里写半截的段落也不必担心被读到。
2. 作为作者，我想让遗漏前置字段在**推送前**就报错，而不是构建成功后才在线上发现标题是文件名。
3. 作为作者，我想让字段检查在本地与 CI 两处都跑，这样绕过本地检查的提交也拦得住。
4. 作为作者，我想把某一篇已发布条目临时设成"未列出"（直链可达、但不进搜索/索引/图谱/RSS），这样我能发给一个朋友看而不必真的公开。
5. 作为作者，我想确认标了 `draft: true` 的笔记一定被构建过滤，即使它同时标了 `publish: true`。
6. 作为作者，我想让"已发布 / 未列出 / 草稿 / 不存在"四个状态在语义上互不重叠，这样我不会误以为"未列出"是一种隐私保护。
7. 作为作者，我想让 `private/` 与 `templates/` 目录即使有内容也永不进构建，作为第二道保险。

### 写作语法

8. 作为作者，我想让 `[[目标笔记]]` 渲染成指向正确 URL 的可点链接，这样我从 vault 里搬过来不用改写。
9. 作为作者，我想让 `[[目标笔记|自定义别名]]` 显示别名而不是文件名。
10. 作为作者，我想让 `[[目标笔记#小节]]` 直接跳到该小节。
11. 作为作者，我想让 `![[目标笔记]]` 整篇嵌入，`![[目标笔记#小节]]` 只嵌那一节，嵌入后的内部 callout 与任务列表仍然可用。
12. 作为作者，我想让 `![[图片.png]]` 直接引用 vault 附件。
13. 作为作者，我想让 `==高亮==` 与 `^[行内脚注]` 生效。
14. 作为作者，我想让指向尚未发布的笔记的链接被**视觉标出**（而不是静默变成死链或普通文本），这样我知道哪条线还没接通。
15. 作为作者，我想让 `![图|300](x.png)` 的尺寸标记生效。
16. 作为作者，我想让 callout 的四种语义色与 `[!note]-` 折叠形态都正确渲染。
17. 作为作者，我想让任务列表、表格、代码块、标题层级原样生效。
18. 作为作者，我想让 `$$` 块级与行内公式经服务端 KaTeX 渲染，且不依赖客户端 JS。
19. 作为作者，我想让 ```mermaid 图在浏览器里渲染成图。
20. 作为作者，我想让 `.canvas` 文件变成一个可平移缩放的画布页面，节点里的 Markdown 照常渲染。
21. 作为作者，我想让 `.base` 文件渲染成数据库式视图（表格/列表/看板），且未列出的页面不会偷偷出现在视图里。
22. 作为作者，我想让行内 `#标签` 变成标签页链接。
23. 作为作者，我想让中文与含空格的文件名原样从 vault 搬过来（空格转 `-`、中文保留）且链接不断。
24. 作为读者，我想让每页显示 Obsidian 风格的属性面板（至少显示描述），这样我知道这条目是讲什么的。

### 站点与阅读

25. 作为读者，我想看到文件树导航、面包屑与目录，这样我能在不知道结构的情况下浏览。
26. 作为读者，我想在每页底部看到反链与可交互的图谱，这样我能顺着概念走下去。
27. 作为读者，我想用站长搜索（`Ctrl/Cmd+K`），并且接受它在中文下只能词首命中（已知降级）。
28. 作为读者，我想在手机上正常阅读，并能切换深色模式与阅读模式。
29. 作为读者，我不想页面去请求任何第三方域名（字体、统计、评论都不），这样墙内也能打开、且我的阅读不被跟踪。
30. 作为读者，我想让 URL 不带结尾斜杠（`/目标笔记.html`）也能从任何地方正常打开——包括从博客文章里点过来。

### 发布与运维

31. 作为作者，我想 push 到 `main` 就自动构建并部署，不必手工跑命令。
32. 作为作者，我想让构建时的日期来自 git 历史（而不是文件系统 mtime），这样 CI 里不会出现"所有条目都是今天"。
33. 作为作者，我想让自定义域名与强制 HTTPS 一次配好，浏览器里没有证书告警。
34. 作为作者，我想让条目改名后旧 URL 仍能打开（靠 aliases 跳转页），因为 GitHub Pages 不做服务端重定向。
35. 作为作者，我想在本地 `--serve` 预览，确认语法与链接都对再 push。
36. 作为运维者（我自己），我想在出事时能用一次 revert 提交回滚站点，而不是手改产物。
37. 作为未来的我，我想让 README 能独立复现整套部署（DNS、证书、CI、缓存 key），不必回看聊天记录。
38. 作为未来的我，我想让花园仓的 `CONTEXT.md` 词汇表与 ADR 是权威的术语与决策出处，代码与文档都用同一套词。
39. 作为读者，我想让花园页面的正文与代码块在高 DPI 屏和窄屏上都不溢出。

## Implementation Decisions

### 仓与骨架

- 新建独立的公开 GitHub 仓 `VasantLong/notes`（Free 账户的 Pages 只支持公开仓）。**仓里的历史也是公开的**，因此"花园库只放已定稿条目"是纪律，不靠配置兜。
- 骨架以 Quartz 5.1.0 官方模板为基底：`quartz/` 源码进仓（可改），插件作为 npm 依赖安装并锁死（`quartz.lock.json` + `package-lock.json` 双锁），Node 24（`.node-version` 与 CI 对齐）。
- 内容源是花园库 = 仓的工作副本；工作库（`~/文档/demo`）与知识库都不参与构建。
- 单机发布：写与 push 都在 minihub（Obsidian 1.15.0 已装），不引入跨机同步。
- 分支模型：`main` 直推，单人内容仓不设 PR 流程；不启用上游模板的 `v5` 分支名。

### 站点配置（契约）

| 键                             | 值                                           | 理由                                                            |
| ------------------------------ | -------------------------------------------- | --------------------------------------------------------------- |
| `baseUrl`                      | `notes.vasantlong.de5.net`                   | cname 插件据此生成 CNAME                                        |
| `locale`                       | `zh-CN`                                      | 日期/文案本地化                                                 |
| `analytics`                    | `null`                                       | 无第三方                                                        |
| `enableSPA` / `enablePopovers` | `true`                                       | 花园的核心交互                                                  |
| 字体                           | 系统字体栈，关掉 `cdnCaching`/`googleFonts`  | 消除第三方域名与 100–300KB 下载；中文本来回落到系统字体         |
| `ignorePatterns`               | `private`, `templates`, `.obsidian`, `inbox` | 第二道保险                                                      |
| `publishAssets`                | `"referenced"`                               | 只拷已发布页面引用到的附件，否则 vault 里任何非 md 文件都会上线 |
| `links.markdownLinkResolution` | `"shortest"`                                 | Obsidian 默认，vault 原地搬过来即解析                           |
| `links.disableBrokenWikilinks` | `true`                                       | 指向未发布页面的链接要被标出来                                  |
| `contentIndex.enableSiteMap`   | `true`                                       | 要被搜索引擎发现                                                |
| `contentIndex.enableRSS`       | `false`                                      | 花园不是时间流                                                  |
| `drafts.publish`               | `false`                                      | `draft: true` 一定被过滤                                        |

插件矩阵：**开** explicit-publish、bases-page、canvas-page、note-properties（`includeAll: false`，只显示 description）、alias-redirects、backlinks、graph、explorer、search、table-of-contents、latex、obsidian-flavored-markdown、github-flavored-markdown、syntax-highlighting、breadcrumbs、darkmode、reader-mode、article-title、page-title、description、content-meta、created-modified-date、favicon、cname、footer、spacer、unlisted-pages、tag-list；**关** encrypted-pages（默认开，必须显式关）、og-image、comments、citations、roam、ox-hugo、recent-notes、stacked-pages。其余保持默认。

不使用 permalink 覆盖：URL 跟随路径，改名靠 aliases 兜底，避免"路径"与"permalink"两个真相源。

标签：条目上的标签必须可点、正文行内 `#标签` 必须落在同一张标签页上，读者也不必猜 URL（首页给出 `/tags/` 入口）。标签页由 tag-page 插件按内容自动生成（`/tags/<标签>` 与 `/tags/` 索引），tag-list 只负责在条目页把标签渲染出来，因此开 tag-list 不引入新的页型或新的维护面。

### 条目契约与闸门

- 条目的最小契约：`publish: true`（必须是布尔真，不接受字符串）、`title`、`description`（≤80 字）、`date`（可解析的日期）；`tags` 可选。
- **闸门是双保险**：构建期 `explicit-publish`（未标发布 = 不存在）+ 推送期字段校验器（缺字段 = 直接失败）。Quartz 对缺字段一律静默兜底（标题回落文件名、无描述就不生成 meta），这正是校验器存在的理由。
- 校验器是纯函数形态：输入（前置字段、slug）→ 违规列表；空列表即通过。CLI 外壳负责遍历花园库、打印、退出码。
- 条目模板随仓提供（Obsidian 核心 Templates 兼容），不引入 Templater/Dataview 运行时。
- 晋升是手动动作：工作库写完 → 复制进花园库 → 补四个字段 → push。不写 `promote` 脚本（触发条件：漏字段白推一次，或条目数过 10）。

### CI 与部署

- 工作流在 `main` push 触发；`actions/checkout` 必须 `fetch-depth: 0`（日期优先级是 frontmatter → git → mtime，浅克隆会让所有条目回落 mtime）。
- 步骤顺序：`npm ci` → 装插件 → **字段校验** → `npx quartz build` → 上传 Pages artifact → deploy。校验在建之前，坏条目进不了产物。
- 缓存两处：npm 缓存与插件目录，key 取锁文件哈希。
- 自定义域名与强制 HTTPS 分三步（先写 CNAME、轮询证书 `approved`、再开 `https_enforced`），合成一次会 404。

### 文档归属

- `CONTEXT.md` 与 `docs/adr/0001`、`0002` 暂留在博客仓（设计在这里发生），花园仓建立后把术语与 ADR 复制过去并在此处标注指向。
- 花园仓 README 承载复现 runbook、已知降级清单与"花园库只放定稿"的纪律说明。

## Testing Decisions

**什么算好测试**：只断言外部行为——构建产物里"有什么文件、文件里有没有某段文字"、校验器"对某个前置字段返回什么违规"。不断言 HTML 结构、不断言插件内部函数名：Quartz 5 刚把 frontmatter/links/drafts/contentIndex 改成内建，上游小版本就会改内部形状。

**接缝一（最高接缝，唯一集成测试）：构建产物**。用一个 fixture 花园库（同时含已发布条目、无 publish 笔记、`draft: true`、`private/` 目录、未被引用的附件、`%%私有注释%%`、`unlisted` 页、中文与含空格文件名）真跑一次构建，然后只读产物断言：

1. 已发布条目有对应 HTML，页面里有其标题。
2. 无 `publish` 的笔记**没有**对应 HTML，且它的标题字符串在全部产物里 grep 零命中。
3. `%%私有注释%%` 的内部文字零命中。
4. 未被引用的附件不出现在产物里（验证 `publishAssets: "referenced"`）。
5. `unlisted` 页有 HTML，但不出现在 `contentIndex.json`、`sitemap.xml`、`index.xml` 里。
6. 含空格文件名产出 `带-空格-的笔记.html`，中文文件名不被转写。
7. `CNAME` 内容等于 `notes.vasantlong.de5.net`。
8. 产物里不存在 `index.xml`（RSS 已关）但存在 `sitemap.xml`。

**接缝二：字段校验器（纯函数单测）**。样本覆盖：缺 title / 缺 description / description 超 80 字 / `publish: "true"` 字符串 / 缺 date / 合法条目 / date 不可解析。断言返回的违规项与顺序稳定。

**前例**：博客仓的 `security-check.sh`（12 项不变量，都是"某个不该出现的东西没出现"式的产物/配置断言 + 退出码）与本仓知识库的前置字段硬线检查（frontmatter + 行数/体积上限）。新测试沿用同一姿势：断言"不变量"，不断言实现。

**不做**：DNS/TLS 不写自动化测试（按"非开发类变更走 runbook"的纪律，用 `dig`/`curl`/openssl/Pagess API 状态作外部证据）；不写部署后端到端 smoke（Pages 生效有延迟，作 runbook 验收项）。

## Out of Scope

- 条目内容的撰写：只放 2–3 篇真实条目验证链路，不追求内容量。
- 知识库到花园的单向导出链路（AD-0002 已把知识库排除在源之外）。
- 中文分词 fork（把搜索从"词首前缀"升级为按字切分）。
- 跨机写作与同步（Obsidian Sync / 各自 clone + rebase）。
- 博客仓的任何改动，包括两站互引的改造。
- 主题定制、配色、自定义组件。
- 评论、统计、cookie、任何第三方运行时资源。
- Obsidian 插件链（Dataview/Templater）在站点侧的执行。
- "未列出"页的运营策略（何时用、怎么通知对方）。

## Further Notes

- **已知降级**：中文搜索在 FlexSearch `tokenize: "forward"` 下只能词首前缀命中；GitHub Pages 不做结尾斜杠重定向，故花园 URL 无斜杠而博客有，跨站链接不得补斜杠；无服务端重定向，条目改名只能靠 aliases 跳转页。
- **实现时先验证的两件事**：① 行内 `$..$` 公式在 latex 插件下的实际行为（探针只验了 `$$..$$`）；② `.base` 与 `.canvas` 在真实花园库里的产物形态与链接行为。
- **网络前提**：minihub 上 `npm ci`/`git push` 需代理（`http_proxy=127.0.0.1:7897`）；本机没有 `gh` CLI，GitHub 侧操作用 `api.github.com` 或网页。
- **上游 churn**：Quartz 5.1.0 刚重构 core，双锁文件固定版本；升级当作独立任务验证产物的八条断言。
- **回滚**：revert 提交即回滚，Pages 自动重建。
