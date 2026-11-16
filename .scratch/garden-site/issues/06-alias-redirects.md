# 06: 条目改名后的旧 URL 跳转

**What to build:** 条目改名或挪目录后，旧 URL 仍然能打开并落到新位置——靠产物里的跳转页，因为托管方不做服务端重定向。这是"URL 跟随路径"策略的兜底，也是它敢被采用的理由。

**Blocked by:** 04（链接解析面先在，跳转要与真实 URL 一致）.

**Status:** resolved

- [x] 条目声明别名后，旧路径产出跳转页并落到当前 URL
- [x] 跳转不依赖服务端能力，纯前端即可完成
- [x] 新 URL 同样可达，不存在跳转循环或链式多跳
- [x] 多个别名可同时成立
- [x] 无用别名（指向已不存在路径）不会制造出会 404 的死跳转页

## Comments

- 跳转页本身由社区插件 `@quartz-community/alias-redirects` 1.0.3 产出（`aliases:` 读成 slug 列表，写一份带 `<meta http-equiv="refresh">`、`canonical` 与 `noindex` 的静态 HTML）——纯前端，不需要托管方配合；本票不重写它的渲染。
- 缺口与修法：插件的撞名检查只对照**内容页 slug**，于是 `aliases: [index]` 会凭空造出一个跳走的站点首页、`aliases: [404]` 会顶掉 404 页；写盘路径也不设边界，根级条目的 `../x` 能把文件写到产物目录之外；同一个别名被两页申报时后写者静默覆盖（发射器并行写盘）。新增 `quartz/util/alias-redirects.ts` 的 `sanitizeAliases(content)`：在 `markUnpublishedLinks` 之后、`emitContent` 之前就地修剪 `file.data.aliases`，丢掉站点自有路径（`index` / `404`）、与已有页面撞名、已被更早条目占用、以及越界的别名；每一条丢弃都进构建诊断（`warn({area: "aliases"})`），不静默吞。`quartz/build.ts` 的全量构建与 `--serve` 增量重建两条路径都接同一遍。
- 判撞名与解析落点都照抄插件口径（`normalizeForComparison`：`index`、空 slug、`x/index` 与 `x` 同页；`aliasTargetSlugOf` 连同它依赖的 `isRelativeURL`：以 `.` 开头**且不以 `index` 结尾、扩展名不是 `.md`/`.html`** 的别名才相对条目所在目录解析），否则会出现"守卫放行、插件丢弃"或反过来把子目录条目的合法 `../旧名` 误杀两套规则。少抄后两条判据的后果很具体：`./index` 被插件当成根级别名直接写到产物根（顶掉首页），`../index` 则在深层条目上写出产物目录。原别名记在 `WeakMap` 里逐次重建——`--serve` 只重新解析改动过的文件，就地修剪若不可回滚就会退化成"第一次构建说了算"。
- 测试：`test/alias-redirects.test.ts`（11 例，fixture 花园库真构建后只读产物；fixture 里刻意塞了 `index`、`./index`、`../index`、`404`、`../逃逸出界` 与跨条目的重复别名）断言"从跳转页解析落点后命中哪份产物"，不锁 meta refresh 的字面形状；覆盖纯前端（产物里没有 `_redirects`/`_headers` 这类服务端配置）、无链式多跳（落点页自身不是跳转页）、根级与子目录级多别名、以及"每条跳转的落点都存在"的死链不变量；`test/alias-sanitizer.test.ts`（7 例，纯单测）锁住守卫的判据、与插件的比较键一致性与幂等性（对手让出别名后别名能回来）。去掉守卫时这两个文件会红 5 条（首页被顶、404 被顶、重复别名多跳、两处越界写盘、落点存在性），不是空转断言。
- 已知残留（本票不处理）：被丢弃的别名仍留在 `allSlugs` 里，指向它的 `[[旧名]]` 不会被标成断链（该判定在 links 面，与 05 同文件）；与 PageTypeDispatcher 虚拟页（`.base`/`.canvas`）或大小写重定向页撞名时，仍只有插件自己的 `console.warn` 兜底；`--serve` 增量路径无独立测试。
