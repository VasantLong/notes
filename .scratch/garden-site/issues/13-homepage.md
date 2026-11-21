# 13: 站点首页

**What to build:** 打开域名根路径看到的第一页不是 404：`content/index.md` 作为花园的门口页，说明这里收什么、不收什么，并给出几条入口（最新条目、按目录浏览、搜索提示）；它本身也受条目契约约束，`publish: true` 等四字段缺一不可。

**Blocked by:** 03（首页同样是条目，先有闸门才不会被漏字段的首页混过去）. `DEGRADATIONS.md` 与票 11 都在引用本票：域名挂上后，根路径 404 就是访客看到的第一屏。

**Status:** ready-for-agent

- [ ] `public/index.html` 存在且是首页（今天构建产物里只有条目页与 `404.html`，没有 `index.html`）
- [ ] 首页满足条目契约：`publish: true` / `title` / `description`（≤80 字）/ `date`，`npm run check:entries` 通过
- [ ] 首页由真实页面提供，而不是 `aliases: [index]` 这类跳转页——别名守卫会丢弃 `index`（见票 06），拿别名当初衷会被静默吃掉
- [ ] 首页里的站内链接照常百分号编码、不指向未发布条目（与票 04/05/09 的口径一致）
- [ ] 测试钉住“根路径有页面”：构建 fixture 后断言 `public/index.html` 存在、`<title>` 取自首页 frontmatter，且首页不出现在自己的反链里
- [ ] 域名生效后验收：`curl -s -o /dev/null -w '%{http_code}\n' https://notes.vasantlong.de5.net/` 得 200（今天 000，DNS 未配，见票 11）

## Comments

- 现状证据（2026-11-21）：`npx quartz build` 的产物里没有 `index.html`；`ls public/*.html` 只有 `这座花园是什么.html` 与 `404.html`。票 01 当时写“根路径 `/` 目前 404，因为花园库还没有首页，首页归 09”，但票 09 收尾时没有接手这条，于是它悬空至今。
- 首页内容属于作者决策（写什么、列哪几条入口），实现与断言属于本票；内容与测试分开提交，避免“为了测试通过而写一页占位首页”。
