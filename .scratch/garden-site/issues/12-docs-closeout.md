# 12: 文档收尾

**What to build:** 未来的自己能不看聊天记录就复现与维护这座站：README 从一个干净 clone 出发就能跑完依赖、构建、部署、DNS/证书、缓存 key；术语与决策在花园仓里有权威出处（词汇表 + 两条 ADR 副本并回链原始出处）；已知降级与硬规则写在显眼处。

**Blocked by:** 10, 11（部署与域名步骤要先真实走通，文档才写得准）.

**Status:** resolved

- [x] README 可从干净 clone 复现整套：依赖与代理前提、插件安装、本地预览、字段校验、CI 部署、DNS 与证书、缓存 key
- [x] 词汇表与 ADR-0001/0002 复制进花园仓，并标注指向博客仓原始出处（花园仓是副本，不是真相源）
- [x] 已知降级清单落地：中文搜索只能词首命中、站点 URL 不带结尾斜杠、托管方不做服务端重定向、改名靠别名跳转页
- [x] 硬规则显眼：花园库里的一切都假定会被读者看到、四字段必填、不用 permalink 覆盖、两站互引写绝对 URL
- [x] 把 `test/` 接进 CI：今天 workflow 只有 deploy 一个，13 个测试文件在服务端从不执行——「流水线形状由测试钉住」目前只在本机成立；接线时一并考虑给 PR 加一条只构建不部署的校验
- [x] 一次验收：按 README 从零跑一遍能构建并预览，不需要问任何人（`tmp/clean-clone-2` 从 `77d8c1a` clone → `npm ci` → 插件安装 → `check:entries` → 构建，产物含条目页与 404）

## Comments

- 2026-11-21 文档职责拆分：README 当时同时承担了门面与运维手册，跟 AGENTS.md 的职责重叠。现拆为 `README.md`（英文门面）+ `README.zh-CN.md`（中文门面）、`docs/deploy.md`（复现/校验/CI/域名/回滚/硬规则）、`docs/content.md`（写作与晋升 runbook）、`AGENTS.md`（本仓 agent 硬规则）。边界由 `test/readme-bilingual.test.ts` 钉住：两份 README 都不得出现 `deploy.yml`/`fetch-depth`/`PUT /repos/` 这类运维细节，`docs/` 两份文档必须写清四字段与校验命令。候选名"花园站"不是通行叫法，术语统一为**数字花园（digital garden）**，见 `CONTEXT.md` 的「站点」段。

- 落地件：`README.md`（干净 clone 复现、校验/测试/预览、CI 与部署、域名与证书三步、缓存 key、硬规则）、`DEGRADATIONS.md`（五类已知降级，每条带“为什么 + 什么时候重看”）、`adr/0001` 与 `adr/0002`（副本，头部回链博客仓真相源）、`CONTEXT.md` 保留为仓内词汇表。
- 测试接进 CI：`922f531` 在 build job 的字段校验之后、构建之前插入 `npm test`，并给 `pull_request` 加了只构建不部署的触发；`test/ci-and-deploy.test.ts` 补了 3 条断言钉住这件事（`npm test` 在 `npx quartz build` 之前、PR 触发存在、`deploy` job 的 `if` 仍只放行 push main）。
- 一次验收的实测路径：`tmp/clean-clone-2` 是 `git clone` 到 `77d8c1a` 的干净副本，按 README 跑完 `npm ci` → `npx quartz plugin install` → `npm run check:entries` → `npx quartz build`，`public/` 里有 `这座花园是什么.html` 与 `404.html`。
- 代理前提已按实测改口径：本机（minihub）直连 `github.com` 与 `registry.npmjs.org` 可用（2026-11-21 push 与 `curl` 均直连成功），README 从“必须开代理”改为“直连不通时再开代理”。
- 已知偏差：`DEGRADATIONS.md` 里“根路径 `/` 404”指向的票 13 本次一并补建（此前只有引用、没有票面）。
