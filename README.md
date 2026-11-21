# notes — 花园站

Quartz 5 驱动的个人知识花园，部署在 <https://notes.vasantlong.de5.net>（GitHub Pages，Actions 产物）。

写作在 Obsidian 里进行，只把**已定稿的条目**晋升进 `content/`；未标 `publish: true` 的文件不是站点的一部分，是"不存在"而不是"被隐藏"。

## 权威文档

| 内容                                                 | 位置                                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 本仓词汇表（条目/晋升/发布态）                       | [`CONTEXT.md`](./CONTEXT.md)                                                                   |
| 完整规格（39 条用户故事 + 配置契约 + 测试接缝）      | [`.scratch/garden-site/spec.md`](./.scratch/garden-site/spec.md)                               |
| 为什么花园独立成站、为什么知识库不能当源（副本）     | [`adr/`](./adr)（真相源在[博客仓 ADR](https://github.com/VasantLong/blog/tree/main/docs/adr)） |
| 已知降级与硬约束（中文搜索、URL 形态、别名、托管面） | [`DEGRADATIONS.md`](./DEGRADATIONS.md)                                                         |
| 两站分工的完整术语                                   | [博客仓 CONTEXT.md](https://github.com/VasantLong/blog/blob/main/CONTEXT.md)                   |
| 实现票据                                             | [`.scratch/garden-site/issues/`](./.scratch/garden-site/issues)                                |

Quartz 自身的用法在 vendored 源码旁的 `docs/`（那是 Quartz 的文档站内容，不是本仓说明）。

## 从干净 clone 复现

前置：Node 22+（`.node-version` 钉 24）、npm 10.9+、能连 `github.com` 与 `registry.npmjs.org`。本机（minihub）实测可直连；只有直连报网络错误时才需要代理：`export http_proxy=http://127.0.0.1:7897 https_proxy=$http_proxy`。

```bash
git clone git@github.com:VasantLong/notes.git && cd notes
npm ci                        # 严格按 package-lock.json
npx quartz plugin install     # 插件进 .quartz/plugins，版本由 quartz.lock.json 锁住
```

## 校验、测试、预览

```bash
npm run check:entries   # 条目四字段闸门（publish/title/description/date），违约即非 0 退出
npm test                # 13 个测试文件 / 118 例，串行
npm run test:quartz     # vendored Quartz 自己的单测（可选，CI 不跑）
npm run check           # tsc --noEmit + prettier --check
npx quartz build --serve   # 本地预览 http://localhost:8080
npx quartz build           # 只构建到 public/
```

- 测试为什么串行：每个 fixture 都真跑一次 `quartz build`，构建期把 `quartz/.quartz-cache/transpiled-build.mjs` 固定写在同一路径；并行时两个进程互相覆盖那份临时包，偶发 `buildQuartz is not a function`。`npm test` 因此带 `--test-concurrency=1`。
- 构建前的 `prebuild` 也会再跑一次 `plugin install`；手工预览时不用重复。

## CI 与部署

`.github/workflows/deploy.yml`：push main / PR / 手工触发都跑同一条链——装依赖 → 装插件 → 字段校验 → 测试 → 构建 → 上传产物；**只有 push 到 main 才部署**（`deploy` job 的 `if` 同时检查 `event_name == 'push'` 与 `ref == 'refs/heads/main'`）。手工触发等于"只建不部署"。

- 缓存两级，key 都取锁文件哈希：npm 缓存（`package-lock.json` + `.node-version`）、插件目录 `.quartz/plugins`（`package-lock.json` + `quartz.lock.json` + `quartz.config.yaml`）。锁文件一变就是一把新钥匙。
- `checkout` 取全量历史（`fetch-depth: 0`）：今天条目日期仍由 frontmatter 的 `date` 决定，全量历史是将来放开必填时的前提。
- 回滚 = 一次 `git revert <sha>` 加 push，流水线重建旧产物并重新部署（演练记录见票 10 的 Comments）。

## 域名与证书

站点域名 `notes.vasantlong.de5.net`；父域 `de5.net` 在 DNSHE，`vasantlong.de5.net` 委派给 Cloudflare。三步不可合并（合并会报 `The certificate does not exist yet`）：

1. **Cloudflare**（zone `vasantlong.de5.net`）：加 CNAME `notes` → `vasantlong.github.io`，**Proxy = DNS only**（灰云；橙云会让证书签发失败）。
2. **GitHub API**：`PUT /repos/VasantLong/notes/pages` body `{"cname":"notes.vasantlong.de5.net"}`（已完成；`https_enforced` 在证书 approved 之前保持 false）。
3. **GitHub API**：轮询 `GET /repos/VasantLong/notes/pages` 到 `https_certificate.state == approved`，再 `PUT {"https_enforced": true}`。

验收（外部证据，不看流水线日志）：

```bash
HOST=notes.vasantlong.de5.net
dig +short $HOST                                   # 指向 vasantlong.github.io（或 4 个 185.199.x.153）
curl -sI https://$HOST | head -1                    # HTTP/2 200
curl -s -o /dev/null -w '%{http_code}\n' http://$HOST/   # 301 → https
openssl s_client -connect $HOST:443 -servername $HOST </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -dates            # CN=$HOST，未过期
curl -s -o /dev/null -w '%{http_code}\n' https://$HOST/no-such-page/   # 404
```

证书在 Pages 的各边缘 IP 上逐个生效：刚签发时部分请求可能拿到 `*.github.io` 证书，等几分钟再试。

## 硬规则

- `content/` 里的一切都假定会被读者看到；`private/`、`templates/`、`inbox/` 永不进构建。
- 条目必填 `publish: true` / `title` / `description`（≤80 字）/ `date`；缺项构建前失败。
- 不使用 permalink 覆盖：URL 跟随路径，改名靠 `aliases` 兜底。
- 站点 URL 不带结尾斜杠；跨站链接手写绝对 URL。
