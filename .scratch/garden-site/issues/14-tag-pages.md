# 14: 标签页的落点

**What to build:** 标签不该是死文字。条目上的标签可点，点进去看到该标签下的全部条目；正文行内写的 `#标签` 落在同一张标签页上；读者也不用猜 URL——首页给出到标签索引的入口。

标签页本身**已经存在**：`@quartz-community/tag-page` 会为每个标签虚拟生成 `/tags/<标签>`，外加一张 `/tags/` 索引。本票不新建页型，只把它接进读者的行走路径，并用测试钉住。

**Blocked by:** 03（标签页只列已发布条目）. 承接 09 留下的那条「不在本票范围内：行内 `#标签` 的落点」——作者已决定：标签变站内标签页。

**Status:** resolved

- [x] 条目页显示标签，每个标签都是指向该标签页的链接（`@quartz-community/tag-list` 由 `enabled: false` 改为启用，位置沿用 `beforeBody/30`）
- [x] `/tags/` 索引列出全部标签，并能走到每张标签页
- [x] 正文行内 `#标签` 渲染为指向标签页的链接，并把该标签并入该条目的 frontmatter tags，使标签页确实收录这条
- [x] 首页「怎么找东西」给出到 `/tags/` 的入口，读者不必猜 URL
- [x] 标签 href 百分号编码（中文标签不得裸 UTF-8 出现在 `href` 里；09 的 `encodeInternalHrefs` 在 dispatcher 层兜底）
- [x] 测试钉住四条链路：条目标签 → 标签页、标签页 → 条目、行内标签 → 标签页、索引 → 标签页
- [x] 线上验收：`/tags/` 与 `/tags/花园` 可达且列出条目，条目页标签可点

## Comments

- 动手前实测（2026-11-21）：标签页**已经在生成**。`public/tags/index.html` 文本为「总共有 1 个标签。花园」，`public/tags/花园.html` 为「此标签下有 2 条笔记」，两条真实条目都列出（链接是相对的百分号编码，如 `../tags/%E8%8A%B1%E5%9B%AD`）。
- 行内 `#标签` **也已被解析**，缺的不是能力而是接线：`@quartz-community/obsidian-flavored-markdown` 的 `parseTags` 默认 `true`（`dist/index.js:42775`）。命中时产出的不是纯文本——有同名标签页就给 `<a class="tag-link" href="${base}/tags/${slug}">`，没有才退化成 `<span class="tag-link">`；同时把该标签**并进**该文件的 `frontmatter.tags`，所以标签页会收录它（同上 `dist/index.js:43030-43055`）。
- 真缺口是「没人走得到」：`tag-list` 在 `quartz.config.yaml:162` 是 `enabled: false`，条目页不显示任何标签；而全站除标签页之间互链外，**没有一个页面链到 `/tags/`**（`grep -rl 'href="/tags' public --include='*.html'` 只命中 `tags/index.html` 与 `tags/花园.html` 自己）。标签页是孤儿页面。
- 与 09 的编码口径可能撞车：OFM 生成的标签 href 是**未编码 UTF-8**（`/tags/花园`），而 tag-page 自己写的是百分号编码。09 已经在 `emitPage` 处对每页 HTML 的 `href` 统一编码，所以两种来源都会被规范到同一形态——测试按产物断言，不按插件断言。
- 落地只有两处配置级改动：`quartz.config.yaml` 的 `tag-list` 由 `false` 改为 `true`（位置沿用 `beforeBody/30`，条目页正文之前出标签胶囊），`content/index.md` 的「怎么找东西」加一行 `[按标签浏览](/tags/)`。没有新增页型、没有新组件、没有手写 CSS。
- 规格同步：spec.md 的插件矩阵把 `tag-list` 从「关」移到「开」，并补一段标签落点的判据（标签页由 tag-page 自动生成，tag-list 只负责渲染）。`test/site-skeleton.test.ts` 的插件矩阵断言随之把 `tag-list` 从 `mustBeOff` 移到 `mustBeOn`——原来它红是因为规格说关、配置说开，现在两边一致。
- 线上证据（部署 run `44890536145` @ `43d98e7`，success）：`/tags/` → 200，`/tags/%E8%8A%B1%E5%9B%AD` → 200，条目页 200 且含 `<a href="./tags/%E8%8A%B1%E5%9B%AD" class="internal tag-link">花园</a>`，首页含 `href="./tags/"`。
- 一个与预期不同的产物形态：作者在正文里写 `/tags/`（绝对路径），产物里变成相对路径 `./tags/`——PathToRoot/dispatcher 会做相对化，测试因此按「能否解析到真实产物文件」断言，不锁 href 字面形态。
- 断言放 `test/tags.test.ts`：fixture 花园库三层语义（`甲` 有 frontmatter 双标签、`乙` 只有行内 `#工具`、`丙` 无标签），另加一层真实花园库（`/tags/` 存在、真实条目页的标签可点、首页有入口）。
