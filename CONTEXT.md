# Notes — 花园站

本仓只关心"条目如何变成站点"。两站分工（博客 vs 花园）的完整词汇在 [博客仓 CONTEXT.md](https://github.com/VasantLong/blog/blob/main/CONTEXT.md)，这里只保留本仓要用的部分。

## 内容单位

**笔记 (Note)**:
花园库里的一个 Markdown 文件，默认对读者不存在。
_Avoid_: 文章, 条目

**条目 (Entry)**:
已晋升并定稿的笔记，对读者存在。讲一个可独立提问的概念或判据，不叙事。
_Avoid_: 卡片, note, 小文章

**花园库 (Garden Vault)**:
本仓的 `content/` 目录，花园站唯一的内容源；其中一切默认对读者存在。
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
