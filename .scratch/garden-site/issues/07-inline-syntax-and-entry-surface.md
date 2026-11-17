# 07: 行内语法与条目展示面

**What to build:** Obsidian 的行内语法与条目自述都到位：`==高亮==`、`^[行内脚注]`、`![图|300](x.png)` 的尺寸标记、callout 的四色语义与 `[!note]-` 折叠形态、任务列表/表格/代码块/标题层级全部原样生效；每页顶部有 Obsidian 风格属性面板，但只显示 description，不把内部字段摊给读者。

**Blocked by:** 04（嵌入页里的 callout 与任务列表要用到嵌入能力）.

**Status:** resolved

- [x] `==高亮==` 渲染成高亮，`^[行内脚注]` 折叠为行内脚注
- [x] `![图|300](x.png)` 的尺寸标记生效（宽度受限而非原图尺寸）
- [x] callout 的四种语义色正确，`[!note]-` 默认折叠且可展开
- [x] 任务列表（含勾选/未勾选）、表格、代码块、多级标题原样生效
- [x] 属性面板只显示 description；其余内部字段（publish/draft/unlisted 等）不出现在页面上
- [x] 嵌入页里的 callout 与任务列表仍然可用（与 04 的嵌入能力合起来验）
- [x] 断言都落在产物里"有没有这段内容/这个状态"，不锁 HTML 结构与插件内部函数

## Comments

**结论：本票不需要改产品代码**——现有插件配置（`remark-obsidian` 的 highlight/callout、`obsidian-flavored-markdown` 的尺寸标记与 checkbox、`note-properties` 的 `includeAll: false` + `includedProperties: [description]`）已经把七项全部兑现。因此本票落地成一组**特征化测试**，锁住现有行为，防止后续调配置时静默回退。

**测试**：`test/inline-syntax-and-entry-surface.test.ts`（8 例，跑真构建后只读产物）。

**断言口径**（对应 spec.md「不断言 HTML 结构、不断言插件内部函数名」）：一律用 HTML 自身的语义作判据——`<mark>` = 高亮、`<sup>` + 页内锚点 = 脚注编号、`<img width>` = 限宽、`<blockquote>` = 引述块、`<details>` 里的单行 `<table>` = 可折叠键值面板、`<h2>–<h4>` = 标题层级、`<input type="checkbox" checked>` = 勾选态。只有 HTML 没有对应元素的两处（callout 的语义类型/折叠状态、样式里的语义色）退一步只认**特性词**（`callout`、`collaps` 以及类型词 note/tip/warning/danger），不写死 class 名、属性名、CSS 变量名，也不对打包后的脚本断言具体函数名（`classList.toggle` 之类）。

**产物证据**（`buildSite` 从 fixture 花园库构建）：

- `==高亮==` → `<mark>`；标记本身零残留。
- `^[行内脚注]` → 句子里只留 `<sup>` 里的编号链接，注文不在句子里；链接指向的锚点在句子**之后**、锚点处确有注文，且该处有链接回指句子里的编号（来回可跳）。
- `![示意图|300](attachments/图.png)` → `<img width="300">`；同一张图不写尺寸标记时**不带** width/height（负对照，避免断言恒真）。
- callout：四种类型的正文各自落在引述块里，且引述块的开标签点名了对应类型；样式里四种类型的主色互不相同（note 用不点名类型的兜底色）。产物里不残留 `[!note]`。
- `[!note]-`：折叠 callout 的开标签带折叠状态词、正文仍在 DOM；不带 `-` 的 callout 没有折叠状态词；页面脚本里出现同一个状态词（读者点得开）。
- 任务列表：2 个 checkbox，一勾一未勾，原始 `- [ ]`/`- [x]` 不残留；表格、`<pre>` 代码块、h2/h3/h4 三层标题（文字与先后顺序）都在。
- 属性面板：页面里存在一个含 description 的 `<details>` 面板，面板里恰好**一行**、且该行两格是 `description` 与描述原文（面板没渲染或多出字段都会红）；`publish`/`unlisted`/`draft`/自定义内部字段的键与值在整页 HTML 里零命中。
- 嵌入页（`![[语法]]`）：四种 callout、折叠态、2 个 checkbox 都在产物 HTML 内，说明是服务端预渲染，不靠客户端补。

**反证（确认断言非空转）**：把 `quartz/` + `quartz.config.yaml` 复制到临时目录，关掉 `highlight`/`callouts` → `语法.html` 里 `==这段要高亮==` 原样保留、`<mark>` 数量 0、引述块开标签不再点名类型；把 `note-properties.includeAll` 改成 `true` → 属性面板出现多行且 `publish`/`unlisted`/`draft`/内部字段漏到页面上。对应断言都会变红。

**已知残留（不影响验收，未处理）**：

- 属性面板的标题文案是英文 "Properties"（zh-CN 未本地化该字符串）；本票只要求"只显示 description"。
- 嵌入页里的行内脚注 id 与主文重复（`user-content-fn-inline-footnote-N`），跳转目标仍指向页尾同一处；属 Quartz 既有行为，未落断言。
