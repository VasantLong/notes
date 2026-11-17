# notes — 花园站

Quartz 5 驱动的个人知识花园，部署在 <https://notes.vasantlong.de5.net>（GitHub Pages）。

写作在 Obsidian 里进行，只把**已定稿的条目**晋升进 `content/`；未标 `publish: true` 的文件不是站点的一部分，是"不存在"而不是"被隐藏"。

## 权威文档

| 内容                                            | 位置                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| 本仓词汇表（条目/晋升/发布态）                  | [`CONTEXT.md`](./CONTEXT.md)                                                        |
| 完整规格（39 条用户故事 + 配置契约 + 测试接缝） | [`.scratch/garden-site/spec.md`](./.scratch/garden-site/spec.md)                    |
| 为什么花园独立成站、为什么知识库不能当源        | [博客仓 ADR-0001 / ADR-0002](https://github.com/VasantLong/blog/tree/main/docs/adr) |
| 两站分工的完整术语                              | [博客仓 CONTEXT.md](https://github.com/VasantLong/blog/blob/main/CONTEXT.md)        |
| 实现票据                                        | [`.scratch/garden-site/issues/`](./.scratch/garden-site/issues)                     |

## 现状

骨架已 vendor（Quartz 5.1.0，源码进仓可改）；站点配置、条目闸门、CI 与域名按 `.scratch/garden-site/issues/` 的票据推进。

本地校验条目字段：

```bash
node scripts/check-frontmatter.mjs
```

本地预览：

```bash
npm ci
npx quartz plugin install
npx quartz build --serve
```

> 本机需要代理（`http_proxy=http://127.0.0.1:7897`）才能跑 `npm ci` 与 `git push`。

## 硬规则

- `content/` 里的一切都假定会被读者看到；`private/`、`templates/`、`inbox/` 永不进构建。
- 条目必填 `publish: true` / `title` / `description`（≤80 字）/ `date`；缺项构建前失败。
- 不使用 permalink 覆盖：URL 跟随路径，改名靠 `aliases` 兜底。
- 站点 URL 不带结尾斜杠；跨站链接手写绝对 URL。
