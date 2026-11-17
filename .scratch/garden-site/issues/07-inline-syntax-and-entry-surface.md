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

**产物证据**（`buildSite` 从 fixture 花园库构建）：

- `==高亮==` → `<mark class="text-highlight">`；标记本身零残留（探针里也确认加粗、表格单元格、callout 标题内都生效，测试只锁最基础的句子内形态）。
- `^[行内脚注]` → 正文里只是编号 `<sup data-footnote-ref>`，注文落在页尾 footnotes 分区并带回跳链接。
- `![示意图|300](attachments/图.png)` → `<img width="300">`；同一张图不写尺寸标记时**不带** width/height（负对照，避免断言恒真）。
- callout：四种类型各自 `data-callout`，样式里四种 `--color` 互不相同（note 用裸 `[data-callout]` 的兜底色）；`[!note]-` 带 `is-collapsible is-collapsed`、标题与正文都仍在 DOM，页面脚本含 `classList.toggle` 与 `is-collapsed`；不带 `-` 的 callout 不折叠。
- 任务列表：2 个 checkbox，一勾一未勾，原始 `- [ ]`/`- [x]` 不残留；表格、shiki 代码块、h2/h3/h4（中文 id）都在。
- 属性面板：description 的键名与值都在；`publish`/`unlisted`/`draft`/自定义内部字段的键与值在整页 HTML 里零命中。
- 嵌入页（`![[语法]]`）：四种 callout + 折叠态 + 2 个 checkbox 都在产物 HTML 内，说明是服务端预渲染，不靠客户端补。

**反证（确认断言非空转）**：把 `quartz/` + `quartz.config.yaml` 复制到临时目录，关掉 `highlight`/`callouts` → 产物里 `==这段要高亮==` 原样保留、无 `<mark>`、无 `data-callout`；把 `note-properties.includeAll` 改成 `true` → 页面出现 `publish`/`unlisted`/`draft`/内部字段。对应断言即变红。

**已知残留（不影响验收，未处理）**：

- 属性面板的标题文案是英文 "Properties"（zh-CN 未本地化该字符串）；本票只要求"只显示 description"。
- 嵌入页里的行内脚注 id 与主文重复（`user-content-fn-inline-footnote-N`），跳转目标仍指向页尾同一处；属 Quartz 既有行为。
