# Notes — 数字花园（digital garden）

本仓只关心"条目如何变成站点"。两站分工（博客 vs 花园）的完整词汇在 [博客仓 CONTEXT.md](https://github.com/VasantLong/blog/blob/main/CONTEXT.md)，这里只保留本仓要用的部分。

## 站点

**数字花园 (Digital Garden)**:
按概念组织的笔记站，没有时间流；本仓产出把它部署在 `notes.vasantlong.de5.net`。英文 digital garden 是这个形态的通行叫法（Quartz 自身就以此定位）。
_Avoid_: 博客, 花园站

## 内容单位

**笔记 (Note)**:
花园库里的一个 Markdown 文件，默认对读者不存在。
_Avoid_: 文章, 条目

**条目 (Entry)**:
已晋升并定稿的笔记，对读者存在。讲一个可独立提问的概念或判据，不叙事。
_Avoid_: 卡片, note, 小文章

**花园库 (Garden Vault)**:
本仓的 `content/` 目录，数字花园唯一的内容源；其中一切默认对读者存在。
_Avoid_: public 目录, 发布库

**晋升 (Promotion)**:
把笔记从工作库（Obsidian 里的私人 vault）复制进 `content/` 并补齐前置字段的动作。
_Avoid_: 发布, 上线, 迁移

## 发布态

**已发布 (Published)**:
`publish: true` 且未标草稿。可被搜索、索引、图谱发现。
_Avoid_: 上线, 公开

**未列出 (Unlisted)**:
`unlisted: true`：HTML 按直链可达，但从搜索、索引、图谱、RSS 全部消失。是"发给特定人看"的通道，不是隐私保护。
_Avoid_: 半公开, 隐藏, 私有, 仅自己可见

**草稿 (Draft)**:
`draft: true`：被构建过滤，连构建输入都不算。
_Avoid_: 未发布

**不存在 (Absent)**:
默认态：没标 `publish: true`，所以从未是站点的一部分，不是"被隐藏"。
_Avoid_: 隐藏, 未发布, 私有

## 闸门

**条目契约 (Entry Contract)**:
一条笔记要成为条目必须满足的前置字段集合：`publish: true`（布尔真）、`title`、`description`（≤80 字）、`date`。
_Avoid_: 校验规则, lint 规则

**指纹/校验器 (Validator)**:
构建前检查条目契约的纯函数：输入前置字段与 slug，输出违规列表。
_Avoid_: 检查脚本, lint 工具

## 界面

**界面语言层 (UI Language Layer)**:
同一份 URL 上，只把站点 chrome（侧栏、搜索、页脚）换语言的客户端层；选择记在 `localStorage.uiLang`，默认中文。笔记正文与标题不参与。
_Avoid_: 双语站点, 多语言版本, i18n 路由

**站脚 (Site Footer)**:
页脚的标准两行：版权行 + 站点链接，第二行双语许可声明。由 `quartz/components/SiteFooter.tsx` 在 frame 里渲染，不用 `@quartz-community/footer` 插件。
_Avoid_: footer 插件, 版权栏
