# 01: 站点骨架：本地构建出第一页

**What to build:** 花园站能在本地真正构建出页面。站点配置按规格里的契约一次落定（baseUrl 为 notes.vasantlong.de5.net、locale 为 zh-CN、analytics 关闭、系统字体栈并关掉 cdnCaching/googleFonts、SPA 与 popovers 开启、插件矩阵的开关与规格一致，其中 encrypted-pages 默认开、必须显式关），花园库为空目录也能构建，且`content/` 里放一条真实条目就能看到它自己的标题。插件版本被锁死，装插件这一步可复现。

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] 站点配置契约全部落定，键与值与规格的配置表逐条一致（含缓存、字体、SPA、popovers、locale、baseUrl、analytics）
- [x] 插件矩阵按规格开与关；尤其是 encrypted-pages、og-image、comments、citations、roam、ox-hugo、recent-notes、stacked-pages、tag-list 必须显式关闭
- [x] 花园库（`content/`）里放一条四字段齐备的条目，构建产物里有对应 HTML 且页面标题取自 frontmatter，而非文件名
- [x] `npx quartz build --serve` 本地可预览，产物在浏览器里能打开
- [x] 产物里不存在任何第三方域名（字体、统计、评论、CDN）
- [x] 插件安装结果被锁定文件记录，干净目录里重装一次版本不变

## Comments

- 落地提交 `ec57d20`（分支 `feat/garden-site`）。断言全在 `test/site-skeleton.test.ts`：配置表逐键、字体不是 Google、插件矩阵开关、锁文件（精确 semver + version + resolved + integrity 逐条比对）、构建产物（标题来自 frontmatter、`lang="zh"`、中文界面文案、零第三方请求、自托管文件齐全且 KaTeX 字体引用全部落在产物里）。
- CDN 是配置不掉的：`@quartz-community/latex` 与 `graph` 把 jsdelivr 地址硬编码在 dist 里，`quartz/static/giscus` 自带 github 的 `url()`。因此改为自托管：`scripts/vendor-third-party.sh` 把 katex 0.16.11 / d3 7.9.2 / pixi.js 8.23.0 的 dist 取进 `quartz/static/vendor/`（`quartz/static/**` 本来就由 Static emitter 原样搬运，不需要新 emitter、不新增 npm 依赖），`quartz/util/self-host.ts` 的映射表在插件资源与组件 `before/afterDOMLoaded` 脚本字符串上替换地址；同时删掉 `Head.tsx` 里的 cdnjs preconnect，`quartz-fonts` 显式设 `fontOrigin: local`。
- 已知降级：OFM 的 mermaid loader 会拉 cdnjs，暂时在配置里关掉 mermaid（`options.mermaid: false`），由 08（富内容）自托管后恢复。
- 预览实测：`npx quartz build --serve --port 8191` → 条目页 200、`<title>这座花园是什么</title>`。根路径 `/` 目前 404，因为花园库还没有首页，首页归 09。
- 干净目录复现：`npm ci` 在`/tmp` 复制目录里通过（82 个直接依赖版本与锁文件完全一致）；注意仓库 `.npmrc` 的 `engine-strict`/`legacy-peer-deps` 必须一起带上，否则 npm 报 lock 缺包。
- 遗留：`npm run check` 仍报 `README.md`、`.scratch/garden-site/spec.md` 的 prettier 格式问题，这两处在本次改动之前就存在，未顺手改。
