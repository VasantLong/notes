# 05: 中文与含空格文件名的路径契约

**What to build:** 从 vault 搬过来的中文文件名与含空格文件名原样成立：空格转 `-`、中文不转写，生成的文件名/URL/链接三处一致，双链、嵌入、附件引用与搜索索引都指向同一个地方，浏览器里能直接打开。

**Blocked by:** 04（链接与嵌入的解析面先在）。

**Status:** resolved

- [x] 含空格文件名产出 `带-空格-的笔记.html`，中文不被转写或拼音化
- [x] 指向含空格/中文文件名的双链、嵌入、附件引用都能解析，URL 编码正确
- [x] 文件树与站点索引里显示的是原文件名，不是编码后的 slug
- [x] URL 编码往返一致：产物路径能直接复制到浏览器打开
- [x] 已发布条目的改名不影响本条（改名靠 06 的跳转，不靠文件系统猜测）

## Comments

- 先对真构建产物做了取证：`slugifyPath` 本就保留 CJK、只把空白转 `-`（`带 空格 的笔记.md` → `带-空格-的笔记.html`），目录、附件、`contentIndex.json` 的 `filePath`、sitemap 也都是解码后的原名，双链/嵌入/附件（含 Obsidian 的尖括号与 `%20` 形态）全部解析到同一份产物。真正缺的是**产物 HTML 里的 href/src 没有百分号编码**：属性和文件名里都是裸 UTF-8 中文，虽然浏览器会自动编码、点击可用，但 HTML 里的 URL 不是合法 URI 引用，复制原样地址也不算稳定形态。
- 修法：`Links` 内建新增 `encodeInternalUrl`，在把相对路径写回 `href`/`src`/`object[data]` 前 `encodeURI(decodeURIComponent(url))`：作者手写的链接可能已经转义（`%20`、`%E4%B8%AD`），先完整解码再交给 `encodeURI` 转义一次——不先解码就直接 `encodeURI` 会把它当字面量再转一次，把 `%` 变成 `%25`。用 `decodeURIComponent` 而非 `decodeURI`，因为后者故意不解保留字符（`%26`、`%2F`），留着它们再编码就会双重转义。解不开的畸形转义（`isExternalUrl` 已判为“无此文件”）走兜底 `encodeURI`，把那个裸 `%` 当字面量转义。`data-slug` 与反链/索引仍用解码后的 slug，二者互不影响。
- 测试在 `test/filenames-cjk-spaces.test.ts`（13 例，fixture 花园库真构建后只读产物）：产物名、双链/锚点/附件解析、href/src 与页面内锚点的百分号编码、`contentIndex.json` 的 `filePath`/`slug`/正文、sitemap 编码各一组。编码断言只判“转义过 + 解码后命中真实产物 + 无裸空白”（不重算 `encodeURI(decodeURI(...))`，那等于把被测实现抄一遍，永远通过）。既有 `test/links-and-embeds.test.ts` 的小节链接断言改成先 `decodeURI(href)` 再查 `#甲节`，因为锚点现在也是编码后的 URI 片段；共用断言（`anchors`/`resolveHref`/`imageSources`）抽到 `test/helpers/html.ts`，两个测试文件不再各抄一份。
- 为什么另起一个 fixture 而不并进 04 的链接库：这条票要断言的正是"整棵树里每个名字"（条目、子目录、附件、索引键），一处名字变了就是失败；塞进 04 的库会让"是链接没解析"与"是名字被转写"混在同一个失败里。代价是真构建两次（每个 fixture 各一遍），换来失败时报的是唯一原因。
- 已知边界（不本票修）：编码只覆盖 `Links` 内建产出的内容链接/嵌入/附件。面包屑、反链、`PageList` 的 href 由 npm 包里的组件直接 `resolveRelative` 出来，仍是裸 UTF-8 中文——浏览器能用、copy 地址也不算坏，但不是合法 URI 引用。这些面属 09 导航与阅读，已在那边记了一条待收口。
- 文件树（Explorer）是客户端从 `contentIndex.json` 渲染：条目显示 frontmatter 的 `title`，无标题时回落到 `filePath` 的文件名段；两者都不经过 slug 或百分号编码。因此本票在索引层断言 `filePath` 保留原名、`title` 是人写名字而非 slug，不引入强制“显示文件名”的选项（会覆盖条目标题）。
