# 13: 站点首页

**What to build:** 打开域名根路径看到的第一页不是 404：`content/index.md` 作为花园的门口页，说明这里收什么、不收什么，并给出几条入口（从这里开始、按目录浏览、搜索提示）；它本身也受条目契约约束，`publish: true` 等四字段缺一不可。

**Blocked by:** 03（首页同样是条目，先有闸门才不会被漏字段的首页混过去）. `DEGRADATIONS.md` 与票 11 都在引用本票：域名挂上后，根路径 404 就是访客看到的第一屏。

**Status:** resolved

- [x] `public/index.html` 存在且是首页
- [x] 首页满足条目契约：`publish: true` / `title` / `description`（≤80 字）/ `date`，`npm run check:entries` 通过
- [x] 首页由真实页面提供，而不是 `aliases: [index]` 这类跳转页——别名守卫会丢弃 `index`（见票 06）
- [x] 首页里的站内链接照常百分号编码、不指向未发布条目（与票 04/05/09 的口径一致）
- [x] 测试钉住「根路径有页面」：构建 fixture 后断言 `index.html` 存在、`<title>` 取自首页 frontmatter，且首页不出现在自己的反链里
- [x] 域名生效后验收：`curl -s -o /dev/null -w '%{http_code}\n' https://notes.vasantlong.de5.net/` 得 200

## Comments

- 现状证据（2026-11-21，动手前）：`npx quartz build` 的产物里没有 `index.html`；`ls public/*.html` 只有 `这座花园是什么.html` 与 `404.html`。票 01 当时写「根路径 `/` 目前 404，因为花园库还没有首页，首页归 09」，但票 09 收尾时没有接手这条，于是它悬空至今。
- 首页内容属于作者决策（写什么、列哪几条入口），实现与断言属于本票；内容与测试分开提交：`ae02393`（测试）→ `35ffad3`（`content/index.md`），避免「为了测试通过而写一页占位首页」。
- 首页定位：**门口页，不是名片**。博客 `https://vasantlong.de5.net` 承载身份与长文，花园首页只做三件事——一句话说明收什么/不收什么、「从这里开始」给长期稳定的枢纽条目、「怎么找东西」交代文件树、`Cmd/Ctrl+K` 与反链/图谱；「关于」压到博客与 GitHub 两行。**刻意不做「最新条目」手写清单**：它会腐化，真有这个需求时用 Bases（票 08）自动生成。
- 断言在 `test/homepage.test.ts`（7 例，两层）：
  - 真实花园库层——`content/index.md` 四字段齐（同时跑一次 `check-entries.ts --dir content`，2 条条目通过）、真实构建产物根有 `index.html`、`<title>这座花园</title>` 取自 frontmatter、`404.html` 仍在。这一层是「根路径不再 404」的硬证据，fixture 替代不了。
  - fixture 层——`index.html` 存在且没顶掉 404；`<title>` 取自 frontmatter；站内链接命中真实产物且百分号编码（`[[带 空格]]` → `带-空格.html`，产物文件名把空格换连字符）；指向未发布条目的链接带上正常链接没有的 class（不锁类名）且该条目不在产物里；首页的反链只列真正引用它的页面（fixture 里 `条目甲` 链回 `[[index]]`），不含自己。
- 线上证据（部署 run `44888875563` @ `35ffad3`，success）：`https://notes.vasantlong.de5.net/` → **200**，`<title>这座花园</title>`；`http://` 根路径 → **301** 到 https；条目页仍 200；未知路径仍 404。空路径不再需要托管方重定向——它现在是一份真产物。
- 顺带核对：`--test-concurrency=1` 是必需的（`DEGRADATIONS.md` 已记）。直接 `npx tsx --test test/*.test.ts` 并行跑会偶发 `TypeError: buildQuartz is not a function`（多个构建进程同时写 `quartz/.quartz-cache/transpiled-build.mjs`）；`npm test` 因此串行，本次没有再引入第二种互斥机制。
- 待美化（作者后续决定，不在本票）：首页排版与文案；「从这里开始」目前只有一条枢纽条目，条目变多时再补。
