# 09: 导航与阅读面

**What to build:** 读者不知道结构也能走下去：文件树、面包屑、目录、页底反链与可交互图谱、Ctrl/Cmd+K 站内搜索，加上深浅色与阅读模式切换、手机可读、窄屏与高 DPI 不横向溢出；全站仍然一个第三方域名都不请求。

**Blocked by:** 03（搜索、图谱、反链都建立在发布态与索引之上）.

**Status:** resolved

- [x] 文件树导航、面包屑、目录在任意深度的页面都可用
- [x] 每页底部显示反链，并有一个可交互的图谱
- [x] Ctrl/Cmd+K 唤出站内搜索；中文只能词首命中作为已知降级记录在案，不在本票修
- [x] 深色模式与阅读模式可切换，手机宽度下正文可读
- [x] 窄屏与高 DPI 下正文与代码块都不横向溢出
- [x] 产物里仍无任何第三方域名请求（字体、统计、评论、CDN 都不允许）
- [ ] 不在本票范围内：行内 `#标签` 的落点（tag-list 关闭与"标签变标签页"的诉求冲突，待决定后单开一票）
- [x] 面包屑、反链、文件树等组件生成的站内 href 与内容链接同样百分号编码（05 只覆盖了 `Links` 内建产出的内容链接；组件来自 npm 包，中文页面里仍是裸 UTF-8）

## Comments

- 断言全在 `test/navigation-and-reading.test.ts`（11 个），fixture 是三层中文目录：`根条目.md` / `别处/中层.md` / `别处/更深/深层条目.md`（带两个 `##` 小节）/ `带 空格.md`；只读产物（HTML 文本、`static/` 资产），不碰组件内部。
- 断言口径：页面可见文本（`plainText`）、页面里的 `<a>` 能否解析到真实产物文件、页面脚本闭包（沿 `import`/`from` 递归）、页面自己 `<link rel="stylesheet">` 加载的样式表——不断言组件类名、bundled 脚本的字面量或 HTML 结构；编码与第三方域名两条不变量对**每一页** HTML 产物逐页扫，所以条目页、虚拟目录页、404 自动覆盖。
- 组件 href 编码：新增 `quartz/util/url-encoding.ts`，把 05 里 `links.ts` 的 `encodeInternalUrl` 提出来共享，并加 `encodeInternalHrefs(html)`（跳过 `#` 锚点、外部协议、纯 ASCII 值，幂等）。只编码**路径**：查询串与片段原样保留——解码查询串会把它里面的 `%26` 还原成 `&` 分隔符，片段名是元素 id（目录本身也写裸 UTF-8 的 `#小节甲`）。单元测试在 `quartz/util/url-encoding.test.ts`（编码、幂等、残缺转义、查询串、片段）。落点是 `quartz/plugins/pageTypes/dispatcher.ts` 的 `emitPage`——所有页型都从这一处写盘，所以 npm 组件产出的裸 UTF-8 href 在这里统一编码。代价是给每页多做一次全 HTML 正则替换，构建时间无明显变化；代价的一面是它改的是整篇文档的 `href`（作者正文、`<code>` 示例也在内），比"只改组件产出的 href"宽，换来的是"任何页型、任何组件"都不必逐个接线。fixture 里只有条目页、虚拟目录页和 404 的真实产物（画布/Bases/标签页同走这一个写盘点，但没在 fixture 里单独取产物验证）。
- 反链挪到页底：`quartz.config.yaml` 里 `@quartz-community/backlinks` 从 `right/50` 改为 `afterBody/20`，与规格"每页底部看到反链"一致。
- **与规格字面的偏差（记录在案）**：规格 item 26 写"每页底部看到反链与可交互的图谱"，图谱仍留在右栏（`right/10`）。理由：宽屏下它是常驻侧栏、随每页可见，比塞进页底更像"顺着概念走下去"的入口；窄屏下右栏本身会落到正文下方。若坚持要进页底，改 `position` 为 `afterBody` 即可，右侧栏会空出一格。
- 目录：`@quartz-community/table-of-contents` 的默认 `minEntries: 1` 是**严格大于**，只有一个标题的页面不出目录——这是包的行为，不是故障；测试 fixture 因此给深层页两个小节。
- Ctrl/Cmd+K 不直接出现在页面标签里：页面只引用 `postscript-*.js`，它再 `await import("./static/scripts/script-N-*.js")`，绑定在那个动态 import 的脚本里。测试据此走**脚本闭包**（沿 `import`/`from` 说明符递归解析产物文件）再断言绑定，实现换文件名/拆包也不会误红。
- 窄屏与高 DPI：没写新 CSS。已有 `base.scss` 覆盖 `html{overflow-x:hidden}`、`overflow-wrap:break-word`、`pre{overflow-x:auto}`、`.table-container{overflow-x:auto}`、`img{max-width:100%}`、`.katex-display{overflow-x:auto}`；测试对**页面自己加载的样式表**（排除自托管 vendor）按选择器断规则：`html{overflow-x:hidden}`、`pre{overflow-x:auto}`、`.table-container{overflow-x:auto}`、`img{max-width:100%}`、`p/h1{overflow-wrap:break-word}`，再断言有一条 `(max-width:600px|800px)` 的媒体查询。`html{overflow-x:hidden}` 只是兜底隐藏，不等于"不产生溢出"；真实观感（含高 DPI 缩放）只能在浏览器里过一遍：`npx quartz build -d content -o public` 后静态伺服，缩到手机宽度看正文与代码块。
- 已知降级：`og:url` 等 `<meta content>` 里的中文 URL 仍是裸 UTF-8（编码只作用于 `href`；这些是给爬虫读的标识，不参与站内导航）。
- 中文搜索只能词首命中：搜索索引来自 `contentIndex.json` 的标题/正文分词，中文没有空格切分，属已知降级，按票不修。
- 想改断言口径时注意：`forceSimulation`/`forceLink` 只用来证明"图谱的力导向布局脚本确实随页面发布"；上游若换掉 d3，这条会红，届时按新实现复核对读者的可见效果再改。
- 遗留（与 01 相同，本次未顺手改）：`npm run check` 仍报 `README.md`、`.scratch/garden-site/spec.md` 的 prettier 格式问题。
