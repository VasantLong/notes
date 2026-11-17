# 08: 富内容页：公式、mermaid、Canvas、Bases

**What to build:** 花园里最重的四种内容形态各自成为一个页面：`$$` 与行内 `$..$` 公式经服务端 KaTeX 渲染（不靠客户端 JS）、mermaid 代码块在浏览器里出图、`.canvas` 变成可平移缩放的画布页且节点里的 Markdown 照常渲染、`.base` 变成表格/列表/看板视图且未列出的页面不会偷偷出现。

**Blocked by:** 04（Canvas 节点与 Bases 视图复用链接/嵌入渲染面）.

**Status:** resolved

- [x] 先探针后断言：行内 `$..$` 的真实行为与 `.base`/`.canvas` 的产物形态各验一次，把结论写进票据再定断言
- [x] 块级与行内公式都由服务端渲染成数学标记，禁用 JS 后仍然可读
- [x] mermaid 代码块在浏览器里渲染成图
- [x] `.canvas` 产出可平移缩放的画布页，节点内标题/链接/列表照常渲染
- [x] `.base` 产出表格、列表、看板三种视图，数据取自花园库条目
- [x] 标了 unlisted 的页不出现在 Bases 视图里（与 03 的未列出语义一致）
- [x] 断言只覆盖"页面存在 + 关键内容出现 + 不该出现的没出现"，不锁插件内部形状

## Comments

### 探针结论（先探针后断言）

探针都在仓外的临时花园库上跑：`node_modules/.bin/tsx ./quartz/bootstrap-cli.mjs build -d <fixture> -o <out>`，单次约 1 秒；**不要把 fixture 放进仓内 `tmp/`**——它被 `.gitignore` 忽略，Quartz 的 glob 走 gitignore，会得到 0 个文件。

- **行内 `$..$` 无需任何改造。** `@quartz-community/latex`（remark-math + rehype-katex）在服务端就把行内与块级公式都渲染好了：行内产出 `span.katex > span.katex-html[aria-hidden=true]`，块级产出 `span.katex-display`，KaTeX 同时带 MathML 层，禁用 JS 仍可读。货币写法"价格 $5 和 $10"保持纯文本（micromark 要求 `$` 内含非空白边界），不会误渲染。所以本票对公式**只加断言**，不动配置。
- **`.canvas` / `.base` 是 file-backed 页，靠引用发布。** 它们的 slug 保留扩展名（`画布.canvas`、`花园.base`），`explicit-publish` 对非 `.md` 页只在"被已发布内容引用"时才放行。**因此双链必须带扩展名**（`[[画布.canvas]]`）；写 `[[画布]]` 时目标 slug 是 `画布`，引用链对不上 → 页面不发布，同时 `links` 报"point to pages that are not on the site"。这个限制记在这里，本票不实现扩展名省略解析（真要支持得改 slug/链接解析，属另一张票）；花园库里的 canvas/base 双链一律写全名。
- **画布页产物**：`data-frame="canvas"` 布局、`.canvas-container[data-enable-interaction][data-initial-zoom][data-min-zoom][data-max-zoom]`、缩放控件 `button.canvas-zoom-in`/`canvas-zoom-out`/`canvas-reset-view`/`canvas-fullscreen-toggle`；text 节点正文由 micromark 渲染（标题/列表/双链都照常，双链变成 `a.internal-link`），file 节点带内链标签。
- **Bases 页产物**：`div.bases-page` + 每个视图一个 `button[data-view-index]` 页签（表格/列表/看板），视图体 `.bases-view[data-view-type=table|list|board]`；表格列出条目字段（description 走 `.bases-text`），条目名是内链。`unlisted: true` 的页在三种视图里都不出现（`resolveBasesEntries` 在查表与取条目两处都跳过），与票 03 的未列出语义一致。
- **条目契约仍会拦探针**：已发布笔记缺 `description` 或不可解析的 `date` 时构建在产出任何页面之前中止，写 fixture 时得补齐。

### mermaid：自托管，且只换运行时来源

- 上游 `obsidian-flavored-markdown` 的图渲染脚本里写死了 `import("https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.4.0/mermaid.esm.min.mjs")`，直接开后每个页面都会去请求第三方（违反规格故事 29）。
- 做法：`scripts/vendor-third-party.sh` 增 `MERMAID_VERSION=11.4.0`，拉官方 UMD 单文件 `dist/mermaid.min.js` 到 `quartz/static/vendor/mermaid/`；手写 `quartz/static/mermaid-loader.js` 作为薄壳（用 `new URL("./vendor/mermaid/mermaid.min.js", import.meta.url)` 插一个 script 标签，加载完把 `globalThis.mermaid` 当模块默认导出），`quartz/util/self-host.ts` 把那个 cdnjs 地址映射到 `/static/mermaid-loader.js`。上游脚本一字未改，仍按 `E.default.initialize/run` 用它。
- 为什么不用上游的 ESM 包：`mermaid.esm.min.mjs` 只有 25KB，真代码在 `chunks/*.mjs`（2.6MB、几十个文件），且 `.mjs` 在 GitHub Pages 上 MIME 不可控；UMD 单文件（2.5MB）+ 薄壳更稳，也只需拷一个文件。
- 配置只动一处：`obsidian-flavored-markdown` 的 `mermaid: true`（默认渲染器）。

### 测试（`test/rich-content.test.ts`，5 例）

fixture 花园库在仓外临时目录里真构建，断言只读产物。口径按规格《Testing Decisions》走「外部行为」，三处刻意贴着产物标记的断言都落在**产物与前端渲染器之间的接缝**上，不是 Quartz 插件的内部形状：

- 公式：数 KaTeX 的 `.katex` / `.katex-display`（KaTeX 对外公布的 DOM 契约，它文档里就让人按这两个类做样式），断言公式源码**不再以纯文本残留**（服务端渲染完成的判据），并断言页面引用的 KaTeX 样式表是站内文件且真的在产物里——**这就是「禁用 JS 仍可读」的证据**：本仓 KaTeX 只输出 HTML+CSS 层（无 MathML），排版全靠样式表，与 JS 无关。
- mermaid：`code.mermaid` 是「Markdown 转图源」与「浏览器画图」两半之间唯一的握手点，浏览器里跑不起来时这是能取到的证据；再加上图源仍在。
- 画布：只断言按钮的**无障碍名**（Zoom in / Zoom out），不认类名；节点内容按行为断言——标题与列表出现在页面文本里、节点里的双链经 `resolveHref` 命中真实产物。

脚本链路按「每一跳都能在产物里解析到」断言：从页面引用的站内 mermaid 入口出发，逐跳解析文件里的相对引用（`static/mermaid-loader.js` → `vendor/mermaid/mermaid.min.js`）。所以换实现（loader 改名、改用 ESM 目录）测试仍绿，但只要链上断一跳就红——这同时补上了「载入器最后一跳没人看」的洞。

Bases 看三种视图名与条目描述，未列出页的标题与描述零命中。看板按条目契约里的 `date` 分组，不引入 fixture 私有字段（`kind` 之类不在契约里）。

守卫：`test/site-skeleton.test.ts` 的「产物里不存在任何第三方域名请求」扫全部产物（含 JS 字符串字面量），mermaid 一旦开了却没进映射表立刻红；同文件的「自托管且本地文件齐全」必检清单已含 `static/mermaid-loader.js` 与 `static/vendor/mermaid/mermaid.min.js`。
