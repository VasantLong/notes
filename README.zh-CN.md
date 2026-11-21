# notes — 数字花园

[English](README.md) · **中文**

用 [Quartz 5](https://quartz.jzhao.xyz) 搭的个人数字花园，发布在 <https://notes.vasantlong.de5.net>（GitHub Pages，Actions 构建）。

这不是博客，没有时间流。每一页都是一个**条目**：一个可以独立提问的概念。草稿留在 Obsidian 里，只有定稿的笔记才晋升进 `content/`；没标 `publish: true` 的笔记在站点上不存在，而不是被隐藏。

## 怎么读

- 左侧「探索」就是目录：目录默认展开，条目按文件夹排。
- `Cmd/Ctrl+K` 搜索；中文只能从词首命中，这是已知限制。
- 每个条目都挂标签，`/tags/` 按标签汇总。
- 右侧「关系图谱」画当前条目的两层邻居，点图谱右上角图标看全站。

## 怎么写

在 Obsidian 里写，然后「晋升」：复制进 `content/`，补上 `publish: true`、`title`、`description`（≤80 字）、`date`。完整流程——没写完的笔记怎么处理、结果怎么验——见 [docs/content.md](docs/content.md)。

## 参与

勘误与提问：<https://github.com/VasantLong/notes/issues>。
如果你是在本仓工作的 agent，先读 [AGENTS.md](AGENTS.md)。

## 文档

| 内容                                    | 位置                                                         |
| --------------------------------------- | ------------------------------------------------------------ |
| 词汇表：条目、晋升、发布态              | [CONTEXT.md](CONTEXT.md)                                     |
| 写作与晋升流程                          | [docs/content.md](docs/content.md)                           |
| 本地搭建、测试、CI、部署、域名、回滚    | [docs/deploy.md](docs/deploy.md)                             |
| 已知降级与硬约束                        | [DEGRADATIONS.md](DEGRADATIONS.md)                           |
| 站点规格：39 条故事、插件契约、测试接缝 | [.scratch/garden-site/spec.md](.scratch/garden-site/spec.md) |
| 实现票据                                | [.scratch/garden-site/issues/](.scratch/garden-site/issues)  |

## 许可

站点代码沿用 [LICENSE.txt](LICENSE.txt) 的 MIT 许可；笔记内容版权归 VasantLong。
