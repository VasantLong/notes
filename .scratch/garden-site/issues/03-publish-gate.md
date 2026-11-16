# 03: 发布闸门与发布态

**What to build:** 双保险真的生效：没标 `publish: true` 的笔记在站点上"不存在"（不是隐藏——产物里连它的标题字符串都 grep 不到），`draft: true` 一定被过滤，`private/`、`templates/`、`inbox/` 永不进构建，未被引用的附件不上线，`unlisted` 页直链可达但从搜索/索引/图谱/RSS 全部消失；而字段遗漏在推送前就失败，本地与 CI 两处都跑。

**Blocked by:** 01（要有可构建的花园库）, 02（要有校验器）.

**Status:** ready-for-agent

- [ ] 用 fixture 花园库（同时含已发布条目、无 publish 的笔记、`draft: true` 且 `publish: true` 的笔记、`private/` 下的文件、未被引用的附件、`%%私有注释%%`、unlisted 页）真跑一次构建，测试只读产物断言
- [ ] 已发布条目有 HTML，页面里有它的标题
- [ ] 无 publish 的笔记没有 HTML，且其标题在全部产物中零命中
- [ ] `draft: true` 即使同时 `publish: true` 也不进构建
- [ ] `%%私有注释%%` 的内部文字在产物中零命中
- [ ] `private/`、`templates/`、`inbox/` 里的内容即使存在也不进产物
- [ ] 未被任何已发布页引用的附件不出现在产物里
- [ ] unlisted 页有 HTML 且直链可打开，但不出现在 contentIndex、sitemap、RSS 三类索引产物中
- [ ] 产物有 sitemap.xml 且没有 RSS 索引（RSS 保持关闭）
- [ ] 字段校验接在构建路径上：缺字段时构建前就失败、坏条目进不了产物；同一检查在 CI 里也跑
- [ ] 四个发布态（已发布/未列出/草稿/不存在）在产物层面互不重叠，"未列出"不会被当成隐私保护
