# 02: 条目契约校验器

**What to build:** 一个纯函数，输入前置字段与 slug，输出违规列表；空列表即通过。配套一个 CLI 外壳遍历花园库、逐条打印违规、有违规就以非 0 退出。它是"缺字段不该等到线上才发现"的唯一执行者，所以先于任何构建接线独立成立，并能被单测钉死。

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] 校验器是不碰磁盘、不依赖插件的纯函数；同一输入多次运行输出顺序稳定
- [x] 契约四字段：`publish` 必须是布尔真（字符串 "true" 判违规）、`title` 非空、`description` 非空且不超过 80 字、`date` 可解析
- [x] CLI 外壳遍历花园库、打印"哪个文件哪条违规"、无违规退出 0、有违规则退出非 0
- [x] 单测覆盖七个样本：缺 title、缺 description、description 超 80 字、`publish: "true"` 字符串、缺 date、合法条目、date 不可解析
- [x] 校验器不判定发布态（`draft: true` 与 `publish: true` 同时存在时的结果由构建闸门决定），避免两处真相源

## Comments

- 落地提交 `81dace6`。纯函数 `quartz/util/entry-contract.ts`（`validateEntry` 返回按字段固定顺序排列的违规、`description` 按码点计数、`date` 接受 YAML `Date`/时间戳/可解析字符串）；CLI `scripts/check-entries.ts`（`npm run check:entries`，`--dir` 可换花园库，退出码 0/1/2），走 `fs.readdir(recursive)` 并跳过 `private/`、`templates/`、`inbox/`、点目录。
- 语义决定：`publish` 键**缺失**视为"不是条目"，直接通过——未标发布的笔记由构建期 explicit-publish 插件负责（规格第 104 行的双保险分工），否则一条半成品会挡住整次推送。`publish` 存在但不是布尔真（`"true"`、`false`）才是违规。`draft` 一律不看。
- 单测 `test/entry-contract.test.ts`：14 例（11 例纯函数 + 3 例 CLI），含"顺序稳定"与"80 字边界恰好通过、81 字失败"。
