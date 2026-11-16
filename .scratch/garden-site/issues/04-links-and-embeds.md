# 04: 链接与嵌入

**What to build:** 双链与嵌入从 Obsidian 原样搬过来就能用：`[[笔记]]`、`[[笔记|别名]]`、`[[笔记#小节]]` 各自渲染成正确的可点链接与锚点跳转，`![[笔记]]` 整篇嵌入、`![[笔记#小节]]` 只嵌那一节，`![[图片]]` 引用附件；链接按最短路径解析，所以花园库原地搬进仓不改写就有网；指向尚未发布笔记的链接被**视觉标出**，既不静默变死链也不退化成普通文本。

**Blocked by:** 03（断链标注与未发布语义共用同一套发布态判断）.

**Status:** resolved

- [x] `[[笔记]]` 渲染为指向该条目 URL 的可点链接；URL 跟随路径，不引入 permalink 覆盖
- [x] `[[笔记|别名]]` 显示别名而不是文件名
- [x] `[[笔记#小节]]` 跳到该小节，目标页里锚点存在
- [x] `![[笔记]]` 整篇嵌入；`![[笔记#小节]]` 只嵌那一节
- [x] `![[图片]]` 引用花园库附件，且该附件出现在产物里
- [x] 链接按最短路径解析：vault 原样搬入、不改写链接即可全部解析
- [x] 指向未发布/不存在笔记的链接在产物里有可区分的视觉标记（断言"有标记"，不锁具体 HTML 结构）
- [x] 嵌入页里的任务列表与表格保持可用（callout 的互动在 07 验收）

## Comments

- 三类双链与两类嵌入（整篇 / 单节）、图片嵌入、最短路径解析本就在 Quartz 5.1.0 内建链路里成立（OFM 产出 wikilink，`Links` 内建把 href 相对化并解析最短路径，`renderTranscludes` 处理嵌入）；本票真正要补的是**未发布目标的视觉标记**。
- 缺口与修法：过滤器（explicit-publish）在 HTML 阶段**之后**才跑，而 `allSlugs` 里列着未发布页，所以 `Links` 内建的 `broken` 只判"不存在"，指向未发布笔记的链接看起来是活的却会 404。新增 `quartz/util/unpublished-links.ts` 的 `markUnpublishedLinks(content)`：在 `filterContent` 之后、`emitContent` 之前遍历已发布内容的 HTML AST，对 `data-slug` 被 `filteredBy()` 命中的站内链接补 `broken` 类。它沿用过滤器自己的判决（`quartz/util/diagnostics` 的 `recordFiltered`/`filteredBy`），不另写一套"什么算发布"，因此"未发布"在站点上只有一个定义。同一遍也接在 `--serve` 的增量重建路径上。
- 测试在 `test/links-and-embeds.test.ts`（9 例，fixture 花园库真构建后只读产物）：链接用"href 从该页解析后命中产物文件"判定，不断言 href 字面形状（`prettyLinks` 去掉 `.html` 也照样通过）；小节链接另外断言目标页里存在对应 `id`；嵌入按"出现了哪一节的独有句子"判定整篇 vs 单节，并带正对照（目标页本身两节都在，避免"什么都没嵌"的假通过）；任务列表断言渲染出复选框、表格断言渲染出 `<table>` 且原始 Markdown 表格行不再出现；视觉标记只断言"指向未发布/不存在目标的链接带有正常链接没有的 class"，不锁类名。
- 探针实测入口（本机无 Obsidian）：`node_modules/.bin/tsx ./quartz/bootstrap-cli.mjs build -d <fixture> -o <out>`，单次构建约 1 秒。
