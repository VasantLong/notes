# 03: 发布闸门与发布态

**What to build:** 双保险真的生效：没标 `publish: true` 的笔记在站点上"不存在"（不是隐藏——产物里连它的标题字符串都 grep 不到），`draft: true` 一定被过滤，`private/`、`templates/`、`inbox/` 永不进构建，未被引用的附件不上线，`unlisted` 页直链可达但从搜索/索引/图谱/RSS 全部消失；而字段遗漏在推送前就失败，本地与 CI 两处都跑。

**Blocked by:** 01（要有可构建的花园库）, 02（要有校验器）.

**Status:** resolved

- [x] 用 fixture 花园库（同时含已发布条目、无 publish 的笔记、`draft: true` 且 `publish: true` 的笔记、`private/` 下的文件、未被引用的附件、`%%私有注释%%`、unlisted 页）真跑一次构建，测试只读产物断言
- [x] 已发布条目有 HTML，页面里有它的标题
- [x] 无 publish 的笔记没有 HTML，且其标题在全部产物中零命中
- [x] `draft: true` 即使同时 `publish: true` 也不进构建
- [x] `%%私有注释%%` 的内部文字在产物中零命中
- [x] `private/`、`templates/`、`inbox/` 里的内容即使存在也不进产物
- [x] 未被任何已发布页引用的附件不出现在产物里
- [x] unlisted 页有 HTML 且直链可打开，但不出现在 contentIndex、sitemap、RSS 三类索引产物中
- [x] 产物有 sitemap.xml 且没有 RSS 索引（RSS 保持关闭）
- [ ] 字段校验接在构建路径上：缺字段时构建前就失败、坏条目进不了产物；同一检查在 CI 里也跑
- [x] 四个发布态（已发布/未列出/草稿/不存在）在产物层面互不重叠，"未列出"不会被当成隐私保护

## Comments

- 落地提交 `09b2166`。字段校验接在 `quartz/build.ts` **两条**路径上：全量构建（`parseMarkdown` 之前）与 `--serve` 的增量重建；违规逐条打印 `✗ 文件 — 字段: 原因` 后抛错中止，坏条目进不了产物。
- 上一行"CI 里也跑"仍在 `-[ ]`：CI 作业本身归 10（ci-and-pages-deploy）。当前闸门长在构建路径上，因此**任何**跑构建的 CI 都会执行它；10 落地时再加显式 `npm run check:entries` 一步。
- 实测增量路径：`--serve` 期间往 `content/` 加一条缺 title/date 的笔记 → 日志 `✗ 坏条目测试.md — title: …` / `✗ … — date: …` / `Rebuild failed: 条目契约校验失败：2 处违规…`，删掉该文件后下一次重建恢复正常。
- fixture 构建断言 10 例在 `test/publish-gate.test.ts`，含正对照（contentIndex 确实收录了已发布条目、sitemap 确实收录了它的百分号编码地址），避免"索引空了所以不含 unlisted"的假通过；sitemap 里的 slug 是百分号编码，正反两条断言都按编码后的形状比对。
