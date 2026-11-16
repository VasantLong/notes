# 02: 条目契约校验器

**What to build:** 一个纯函数，输入前置字段与 slug，输出违规列表；空列表即通过。配套一个 CLI 外壳遍历花园库、逐条打印违规、有违规就以非 0 退出。它是"缺字段不该等到线上才发现"的唯一执行者，所以先于任何构建接线独立成立，并能被单测钉死。

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] 校验器是不碰磁盘、不依赖插件的纯函数；同一输入多次运行输出顺序稳定
- [ ] 契约四字段：`publish` 必须是布尔真（字符串 "true" 判违规）、`title` 非空、`description` 非空且不超过 80 字、`date` 可解析
- [ ] CLI 外壳遍历花园库、打印"哪个文件哪条违规"、无违规退出 0、有违规则退出非 0
- [ ] 单测覆盖七个样本：缺 title、缺 description、description 超 80 字、`publish: "true"` 字符串、缺 date、合法条目、date 不可解析
- [ ] 校验器不判定发布态（`draft: true` 与 `publish: true` 同时存在时的结果由构建闸门决定），避免两处真相源
