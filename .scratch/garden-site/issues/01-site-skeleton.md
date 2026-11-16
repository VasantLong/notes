# 01: 站点骨架：本地构建出第一页

**What to build:** 花园站能在本地真正构建出页面。站点配置按规格里的契约一次落定（baseUrl 为 notes.vasantlong.de5.net、locale 为 zh-CN、analytics 关闭、系统字体栈并关掉 cdnCaching/googleFonts、SPA 与 popovers 开启、插件矩阵的开关与规格一致，其中 encrypted-pages 默认开、必须显式关），花园库为空目录也能构建，且`content/` 里放一条真实条目就能看到它自己的标题。插件版本被锁死，装插件这一步可复现。

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] 站点配置契约全部落定，键与值与规格的配置表逐条一致（含缓存、字体、SPA、popovers、locale、baseUrl、analytics）
- [ ] 插件矩阵按规格开与关；尤其是 encrypted-pages、og-image、comments、citations、roam、ox-hugo、recent-notes、stacked-pages、tag-list 必须显式关闭
- [ ] 花园库（`content/`）里放一条四字段齐备的条目，构建产物里有对应 HTML 且页面标题取自 frontmatter，而非文件名
- [ ] `npx quartz build --serve` 本地可预览，产物在浏览器里能打开
- [ ] 产物里不存在任何第三方域名（字体、统计、评论、CDN）
- [ ] 插件安装结果被锁定文件记录，干净目录里重装一次版本不变
