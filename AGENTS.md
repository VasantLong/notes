# AGENTS.md

> 本仓的 agent 规则。全局规则（提交格式、分支命名、危险命令、记忆纪律）在 `~/.pi/agent/AGENTS.md`，这里只写本仓特有、不写就会踩坑的部分。

## 仓库形状

- `content/` 是花园库：**里面的一切都假定读者会看到**，没标 `publish: true` 的笔记在站点上不存在（不是被隐藏）。
- `quartz/` 是 vendored 的 Quartz 5，允许就地改（已有补丁：`quartz/util/unpublished-links.ts`、`quartz/util/self-host.ts`、`quartz/components/scripts/explorer-expand.inline.ts`、界面双语 `quartz/components/UiLang.tsx` + `quartz/ui-i18n/`、站脚 `quartz/components/SiteFooter.tsx` 与 `quartz/components/frames/*.tsx` 的挂载点）。
- 站点配置全在 `quartz.config.yaml`；插件来自 npm（`@quartz-community/*`），选项含义以 `node_modules/@quartz-community/*/dist/*.d.ts` 为准，README 不一定对。
- `.scratch/garden-site/` 是规格与票据（spec + 14 张票）；`docs/` 是给人看的操作手册；`test/` 全是产物级测试（每个 fixture 真跑一次 `quartz build`）。

## 命令

```bash
npm run check:entries   # 条目四字段闸门，非 0 退出 = CI 会红
npm test                # 全部产物级测试（串行，见下）
npm run check           # tsc --noEmit + prettier --check + 界字典漂移校验
npm run gen:ui-dict     # 重生成 quartz/ui-i18n.generated.ts（改了 locales 或 overlay 后）
npx tsx scripts/promote.ts --from <vault 目录> --to content/<主题> [--tag 标签]   # 批量晋升
npx quartz build        # 只构建到 public/
npx quartz build --serve  # 本地预览 :8080
```

## 硬规则

1. **条目四字段**：`publish: true`（布尔真）/ `title` / `description`（≤80 字）/ `date`。缺项 `check:entries` 非 0。
2. **晋升用 `scripts/promote.ts`**，不要手抄 frontmatter；改内容前读 `docs/content.md`，改站点/CI/域名前读 `docs/deploy.md`。降级与硬约束在 `DEGRADATIONS.md`。
3. **`tmp/` 已 gitignore**：不能当 `-d` 输入（Quartz 输入 glob 遵守 gitignore，会报 `Found 0 input files`）；临时 fixture 放 `.scratch/`。
4. **`npm test` 必须串行**（脚本已带 `--test-concurrency=1`）：并行会因共享 `quartz/.quartz-cache/transpiled-build.mjs` 偶发 `buildQuartz is not a function`。
5. **断言落在产物上**，不断言 HTML 结构细节与插件内部函数名；日志只是线索，不是证据。
6. **产物不许请求第三方域名**（KaTeX / d3 / pixi / mermaid 全在 `quartz/static/vendor/`）；新增这类资源要同步 `quartz/util/self-host.ts` 的映射与 `scripts/vendor-third-party.sh`。
7. **部署只认 push 到 main**：PR 与手工触发只建不部署；回滚 = `git revert` + push。
8. **晋升后要交代断链**：构建诊断里的 `N links … not on the site` 不算失败，但必须在提交说明或 PR 里写清楚是哪几条。
9. **空笔记不晋升**：0 字节文件只会留一条断链。
10. **探索树默认展开是本站补丁**：上游 explorer 的 `folderDefaultState` 只写 `data-collapsed` 属性、客户端不读；不要以为改配置就能生效。
11. **界面字典是生成物**：`quartz/ui-i18n.generated.ts` 由 `npm run gen:ui-dict` 从 `quartz/i18n/locales` + `quartz/ui-i18n/overlay.ts` 生成，手改会被 `npm run check` 的 `--check` 抓住。插件自带词表里有、核心表里没有的串写进 `overlay.ts`。机制与排查见 `docs/ui-and-footer.md`。
12. **页脚只有一处**：`SiteFooter.tsx` 在 frame 里渲染；`@quartz-community/footer` 已从配置摘掉，别再加回来（会重复渲染）。frame 里必须 `const Footer = SiteFooter()` 先实例化，直接把构造函数当组件写会静默不渲染。
13. **站名与标签**：`pageTitle`、页面标题、博客导航一律大写 `Notes`，标签名与域名小写 `notes`；「花园」只作比喻（digital garden 的形态说明），不作站名、菜单名或标签名——比喻出处写在首页与 `content/这座花园是什么.md`。
14. **`static/contentIndex.json` 有 10 分钟缓存**：部署后导航（探索/图谱/搜索）可能仍是旧的，先硬刷新再判断是不是构建问题。

## 提交

- 分支 `feat/…` | `fix/…` | `test/…`；一个提交一件事；提交前 prettier 收敛。
- 纯文档/内容改动也要跑 `npm run check:entries`（内容改了就跑）；代码改动跑 `npm test`。
- Markdown 表格交给 `prettier --write`，本仓没有额外的表格探针。

## 别做

- 不要把 vault 里没定稿的笔记塞进 `content/` 图省事。
- 不要在 `description` 里写"本文介绍……"这类空话；它是读者在列表里唯一看到的说明。
- 不要用 permalink 覆盖 URL；改名靠 `aliases`。
- 不要为了过测试去改断言或加 `@ts-ignore`。
- 不要把界面英文手写进组件：改 `overlay.ts` 或 `quartz/i18n/locales`，再跑 `npm run gen:ui-dict`。
