# 10: CI 构建与 Pages 部署

**What to build:** push 到 main 就上线，顺序是 装依赖 → 装插件 → 字段校验 → 构建 → 上传产物 → 部署，校验失败时 workflow 失败且不部署；日期来自 git 历史而不是文件系统 mtime；npm 与插件两级缓存按锁文件哈希命中；出事故能用一次 revert 提交回滚。

**Blocked by:** 03（校验必须接在构建之前，闸门先在）.

**Status:** ready-for-agent

- [ ] push main 触发构建与部署，全流程无需手工命令
- [x] 步骤顺序固定为先校验后构建，坏条目进不了产物、也不会被部署
- [x] checkout 取全量历史（fetch-depth 0）
- [ ] 条目日期来自 git 而不是 mtime（换一台干净机器构建日期不变成"全是今天"）——今天做不到：条目契约强制 `date`，`modified` 继承它，git 时间轮不到；`fetch-depth: 0` 是将来放开 `date` 必填时的保险
- [x] npm 缓存与插件目录两级缓存，key 取锁文件哈希
- [ ] 首次部署后站点在 Pages 默认域名下可访问
- [ ] 真实走一次 revert 提交回滚，站点回到旧状态（回滚路径被验证过，不只是写在文档里）

## Comments

- 落地件：`.github/workflows/deploy.yml`、`test/ci-and-deploy.test.ts`（流水线形状的 9 条断言）、`test/deploy-dates.test.ts`（日期溯源 3 条构建断言）。
- 流水线形状由测试钉住，不是注释：`on.push.branches:[main]` → checkout `fetch-depth: 0` → setup-node 读 `.node-version` → 恢复 `~/.npm` → 恢复 `.quartz/plugins` → `npm ci` → `npx quartz plugin install` → `npm run check:entries` → `npx quartz build` → 上传 `public` → `actions/deploy-pages`。没有任何步骤 `continue-on-error`，校验步骤不许 `|| true`；`concurrency.group: pages` 排队不取消，避免半截产物覆盖线上。动作主版本现查（checkout v7 / setup-node v7 / cache v6 / upload-pages-artifact v5 / deploy-pages v5）。
- 日期溯源怎么验的：临时 git 仓里造「前置字段 `date: 2019-05-06` / 提交时间 2001-02-03 / mtime 改成现在」的条目，断言产物 `<time datetime>` 落在 2019 而不是今天，并断言 `created-modified-date` 的 priority 是 `["frontmatter","git","filesystem"]`。**评审删掉了一条**：原本还有一条 `git clone --depth 1` 的构建测试，但它对「浅克隆」这个变量零敏感度（前置字段本来就会赢，删掉 clone 断言一模一样），属"必然通过的测试"，已删并在测试文件头注明边界。
- 已知事实（比票面更窄）：条目契约强制每条已发布条目带 `date`，而 `quartz/plugins/builtins/frontmatter.ts` 在 `data.modified ||= created` 处让 modified 继承 date，于是今天页面上显示的日期恒等于前置字段，git 时间实际上轮不到。`fetch-depth: 0` 与浅克隆测试都保留，作为将来放开 `date` 必填、让 git 时间重新生效的保险。
- 缓存钥匙（评审补强）：npm 层取 `package-lock.json` + `.node-version`，插件层取 `package-lock.json` + `quartz.lock.json` + `quartz.config.yaml`——少算 `quartz.lock.json` 会在将来接 git/local 插件时把旧版本目录恢复回来（`gitLoader` 按包名直接认领）。同批补强：断言 `concurrency.cancel-in-progress === false`（取消会留半截产物）、断言 build job 没有步骤带 `if:`（另一种吞错误的形状）、`npm install` 的正则收紧到 `npm\s+(i|install)\b`。
- 已知降级：插件缓存目录 `.quartz/plugins` 今天不会被创建——`npx quartz plugin install` 打印「No Git or local plugins to install (plugins from npm are installed by npm install / npm ci)」，插件全是 `@quartz-community` 的 npm 包。这级缓存的 key 与恢复次序已按票面接好，收益留给将来引入 git/local 插件时兑现。
- 上线方式已定（2026-11-17，用户选）：**先只验构建段**。`on` 里加了 `workflow_dispatch`，build job 无条件跑，deploy job 加了 `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`——手工触发只建不部署，分支或 PR 的产物上不了线。两条边界写在 workflow 头部注释里：GitHub 只允许对**默认分支**上的 workflow 发起 dispatch，所以合进 main 之前拉不动；deploy 与 DNS 的联调推迟到票 11。
- 未验证（这两条需要 main 上有内容，本提交只到分支）：真实部署与 revert 回滚。`gh api repos/VasantLong/notes/pages` 仍是 404 —— Pages 尚未开通，需要一次性 `POST /repos/{owner}/{repo}/pages`（`build_type: workflow`）。另外产物自带 `public/CNAME = notes.vasantlong.de5.net`（`@quartz-community/cname` 据 `baseUrl` 生成），而该域名当前 DNS 为 NXDOMAIN：一旦部署，Pages 会按 CNAME 把自定义域名挂上、默认域名 301 过去，两处都打不开。所以部署验证必须与票 11 的第一步（写 DNS 记录）连着做，不能单跑。
