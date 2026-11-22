# 界面双语与站脚

> 面向维护者：站点 chrome（侧栏、搜索、页脚）的中英切换，以及页脚归谁渲染。笔记正文与标题永不翻译——花园没有第二个语言的正文。

## 形态

- 同一份 URL、同一套中文内容，只在**浏览器里**替换界面文案；不生成 `/en/` 之类第二套地址，不做 `hreflang`。
- 顶栏右侧「中 / EN」切换器；选择存在 `localStorage.uiLang`，默认中文。
- `<html data-ui-lang="zh|en">` 由 head 里的同步脚本在首帧前写好，避免先闪一遍中文。
- 双语并置的文案（页脚许可声明）用 `data-ui-zh` / `data-ui-en` 两个 span，靠 CSS 显隐，无 JS 时只显示中文。

不采用 Quartz 自带多语言的原因：`cfg.locale` 只在构建期取一次词表（`quartz/i18n/index.ts`），一套构建只能出一种界面语言；两次构建再合并会分裂 `contentIndex`、探索树、图谱与 SPA 路由，代价远大于收益。

## 文件职责

| 文件                                          | 作用                                                               |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `quartz/components/UiLang.tsx`                | 切换器按钮 + 首帧引导脚本 + 把字典与引擎挂到 before/afterDOMLoaded |
| `quartz/components/scripts/ui-lang.inline.ts` | 引擎：替换文本节点与 title/aria-label/placeholder/alt，支持还原    |
| `quartz/ui-i18n/build-dict.ts`                | 从 `quartz/i18n/locales` 抽 中→英，并把插值串推导成客户端正则      |
| `quartz/ui-i18n/overlay.ts`                   | 手写补充：插件自带词表里有、核心 i18n 表里没有的串                 |
| `quartz/ui-i18n.generated.ts`                 | **生成物**，勿手改                                                 |
| `scripts/gen-ui-dict.ts`                      | 生成器；`--check` 逐字比对，漂移即非 0                             |
| `quartz/components/SiteFooter.tsx`            | 标准两行站脚（版权 + 站点链接 + 双语许可声明）                     |
| `quartz/components/frames/*.tsx`              | 挂载点：Header 的最后一个子元素（切换器）与 `grid-footer`（站脚）  |

## 生成字典

```bash
npm run gen:ui-dict   # 改完 quartz/i18n/locales 或 overlay.ts 后重跑
npm run check         # tsc + prettier + 字典漂移校验
```

- 键是**中文原文**，值是英文；生成的插值模式（如 `^(\d+)分钟阅读$` → `$1 min read`）负责运行时填充。
- 新增一条界面文案的顺序：先看它是否已在 `quartz/i18n/locales/{zh-CN,en-US}.ts`；不在（多是插件自带词表）就写进 `overlay.ts`。
- 生成器会跳过 `components.callout.*`（callout 标题属于正文语气），且遇到同键不同译文只报警告、保留既有值。

## 边界：什么不翻

正文 `.markdown-preview-view`、标题 `.article-title` 与 `h1`、代码块、面包屑的 `Home`、`Properties` 面板、日期格式化（服务端按 `zh-CN` 渲染）、别名跳转桩（`meta refresh` 页面没有 chrome）。

## 站脚

第一行左 `© YYYY Vasant Long`、右站点链接（GitHub / 博客 / 许可）；第二行小字许可声明（笔记 CC BY 4.0、代码 MIT、由 Quartz 构建）。

`@quartz-community/footer` 已从 `quartz.config.yaml` 摘掉：它的 `Created with Quartz vX © YYYY` 是硬编码，选项只能追加一行，拼不出标准两行站脚。站脚因此只在 `SiteFooter.tsx` 里渲染一处——别再挂插件，否则会重复。

## 排查

| 症状                    | 先看                                                                           |
| ----------------------- | ------------------------------------------------------------------------------ |
| 点 EN 没反应            | `localStorage.uiLang`、`<html data-ui-lang>`、prescript 里有没有 `__UI_I18N__` |
| 界面文案没换            | 引擎脚本（`static/scripts/script-*.js`）是否加载；串是否在生成的字典里         |
| 切换后页脚整块消失      | frame 里是不是把构造函数当组件用了（`const Footer = SiteFooter()`）            |
| 浏览器控制台报 ASI 错误 | beforeDOMLoaded 里的字典脚本结尾漏了分号                                       |
