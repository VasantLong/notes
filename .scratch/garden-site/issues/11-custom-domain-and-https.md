# 11: 自定义域名与 HTTPS

**What to build:** notes.vasantlong.de5.net 一次配好且浏览器无证书告警：产物里带正确的 CNAME，DNS 指向托管方，证书通过后再开强制 HTTPS（三步不能合成一步，否则 404）；无结尾斜杠的 URL 从任何来源（包括博客文章里的绝对链接）都能打开。

**Blocked by:** 10（要先有 Pages 部署才能挂域名）.

**Status:** resolved（2026-11-21：DNS、证书、强制 HTTPS 三件全部实测通过）

- [x] 产物里的 CNAME 内容等于 notes.vasantlong.de5.net（`public/CNAME`，由 `@quartz-community/cname` 按 `baseUrl` 生成）
- [x] 按 runbook 三步执行：先写 CNAME → 轮询证书状态到 approved → 再开强制 HTTPS；每步标注执行位置与验证方式（三步全部走完，证据见 Comments）
- [x] 每步的外部证据齐备（dig / curl / openssl / 托管方 API 状态），不看中间日志（`dig` 出 `VasantLong.github.io.` + 4 个 185.199.x.153；证书 `CN=notes.vasantlong.de5.net`，Let's Encrypt，2027-02-19 到期；条目页 200、未知路径 404、http 条目页 301）
- [x] https 正常、http 自动跳转，浏览器无证书告警（条目页 https 200，http 同一路径 301 到 https）
- [x] 不带结尾斜杠的 URL 从任意来源可打开（含从博客文章点过来的绝对链接）（裸 UTF-8 与百分号编码两种写法都 200）
- [x] 失败处置与回滚写在票内：证书长期 pending、CNAME 冲突、强制 HTTPS 提前开启各有一条（见 Comments 的「失败处置」）

## Comments

- **当前状态（2026-11-21）**：Pages 已开通（`build_type: workflow`），自定义域名已由 API 设好——`GET /repos/VasantLong/notes/pages` 返回 `cname: notes.vasantlong.de5.net`、`https_enforced: false`，且**没有 `https_certificate` 字段**：GitHub 还没尝试签发证书，因为 DNS 解析不到。
- **DNS 拓扑（实测）**：`dig +short NS de5.net` → `a.ns.dnshe.org` / `b.ns.dnshe.org`（父域在 DNSHE，不属于我们）；`dig +short NS vasantlong.de5.net` → `ian.ns.cloudflare.com` / `tina.ns.cloudflare.com`——`vasantlong.de5.net` 已委派给 Cloudflare，所以 `notes` 这条记录只能加在 **Cloudflare zone `vasantlong.de5.net`** 里，DNSHE 面板改不到。
- **阻塞点**：本机没有 Cloudflare API token（`~/.secrets` 只有 `DASHSCOPE_API_KEY`），也没装 `flarectl` / `cloudflared`。这条记录要么在 Cloudflare 面板手点，要么注入 `CF_API_TOKEN`（需 `Zone.DNS:Edit` + `Zone:Read`）后用 API 加。
- **待执行（第 1 步，执行位置：Cloudflare 面板 / 或注入 token 的 API）**：zone `vasantlong.de5.net` → DNS → Records → 加 `CNAME`，Name `notes`，Target `VasantLong.github.io`，**Proxy = DNS only（灰云）**。两种典型写错：Name 填成 `notes.vasantlong.de5.net`（结果变成 `notes.vasantlong.de5.net.vasantlong.de5.net`）、Target 写成自己的域名造成自指。
- **第 1 步验证**：`dig +short notes.vasantlong.de5.net` 应出 `VasantLong.github.io.`（或 4 个 `185.199.x.153`）。
- **第 3 步（证书 + 强制 HTTPS）**：DNS 生效后轮询 `gh api repos/VasantLong/notes/pages` 到 `https_certificate.state == approved`（通常 1–3 分钟），再 `PUT /repos/VasantLong/notes/pages` body `{"https_enforced":true}`。**不可与 `PUT cname` 合并**：证书没签出来时会 404 `The certificate does not exist yet`。
- **验收（外部证据，逐条跑）**：

  ```bash
  HOST=notes.vasantlong.de5.net
  dig +short $HOST                                              # VasantLong.github.io.
  curl -sI https://$HOST | head -1                              # HTTP/2 200
  curl -s -o /dev/null -w '%{http_code}\n' http://$HOST/        # 301
  openssl s_client -connect $HOST:443 -servername $HOST </dev/null 2>/dev/null | openssl x509 -noout -subject -dates  # CN=$HOST
  curl -s -o /dev/null -w '%{http_code}\n' https://$HOST/no-such-page/  # 404
  ```

  证书在 Pages 各边缘 IP 上逐个生效，刚签发时个别请求可能仍拿到 `*.github.io` 证书，几分钟后一致。

- **失败处置**：
  - **证书长期 `new`/`pending`（>1h）**：先 `dig` 确认解析、再看 `pending_domain_unverified_at`；最常见原因是 CF 记录开着橙云（代理会让 GitHub 的 DNS 校验与 ACME 撞墙），把 Proxy 改回 DNS only 后重新 `PUT cname` 触发一次签发。
  - **CNAME 冲突**：同名已有 A/AAAA/TXT 时先删旧记录；CF 不允许同一 Name 同时存在 CNAME 与其它类型。
  - **提前开了强制 HTTPS**：全站返回证书错误或 404，回退是 `PUT /repos/VasantLong/notes/pages` body `{"https_enforced":false}`，等证书 approved 再开。
- **附带影响（现在就是线上故障）**：Pages 一挂上自定义域名，默认域名 `https://vasantlong.github.io/notes/` 就 301 到 `http://notes.vasantlong.de5.net/`（实测 301，`server: GitHub.com`），而后者 NXDOMAIN——公开仓的站点此刻**两处都打不开**，本票优先级高于其余待办。

- **收尾（2026-11-21 16:55–17:10）**：用户在 Cloudflare 面板加了 `CNAME notes → VasantLong.github.io`（Proxy 关闭），`dig +short notes.vasantlong.de5.net` 立刻出 `VasantLong.github.io.` 与 4 个 `185.199.x.153`。**证书没有自动签发**：加了 DNS 之后等了约 10 分钟、又重跑了一次部署（`gh run rerun`），`https_certificate` 字段仍然缺席，HTTPS 一直拿 `*.github.io` 的证书（`curl` 报 `no alternative certificate subject name matches`）。**解法是把自定义域名摘掉再挂回去**：`PUT /pages {"cname":null}`（此时 `https_enforced` 显示 true、无证书）→ 立刻 `PUT /pages {"cname":"notes.vasantlong.de5.net"}` → 25 秒后 `https_certificate.state == approved`、`domains:["notes.vasantlong.de5.net"]`、`expires_at 2027-02-19`。再 `PUT /pages {"https_enforced":true}`（摘挂域名会把它打回 false，必须重开）。
- **验收实测**（全部外部证据）：`dig` → `VasantLong.github.io.` + 4 个 GitHub Pages IP；`openssl s_client` → `subject=CN=notes.vasantlong.de5.net`、`issuer=Let's Encrypt YR1`、`notAfter=Feb 19 2027`；`curl https://…/这座花园是什么` 与百分号编码写法都 200；`curl http://…/这座花园是什么` → 301 到 https；`curl https://…/no-such-page/` → 404；`https_enforced: true` 已落库。
- **一个仍然存在的洞**（归票 13）：http/https 的根路径 `/` 都返回 404 —— 产物没有 `index.html`，而 GitHub 的强制 HTTPS 对不存在的路径直接 404、不先 301。首页落地后这条会自愈。
- **证书是逐边缘生效的**：刚 approved 时仍有部分边缘节点返回 `*.github.io` 证书（实测一次 `curl` 报 000），等几分钟再测即一致——验收时不要拿单次失败当故障。
