# 11: 自定义域名与 HTTPS

**What to build:** notes.vasantlong.de5.net 一次配好且浏览器无证书告警：产物里带正确的 CNAME，DNS 指向托管方，证书通过后再开强制 HTTPS（三步不能合成一步，否则 404）；无结尾斜杠的 URL 从任何来源（包括博客文章里的绝对链接）都能打开。

**Blocked by:** 10（要先有 Pages 部署才能挂域名）.

**Status:** ready-for-agent

- [ ] 产物里的 CNAME 内容等于 notes.vasantlong.de5.net
- [ ] 按 runbook 三步执行：先写 CNAME → 轮询证书状态到 approved → 再开强制 HTTPS；每步标注执行位置与验证方式
- [ ] 每步的外部证据齐备（dig / curl / openssl / 托管方 API 状态），不看中间日志
- [ ] https 正常、http 自动跳转，浏览器无证书告警
- [ ] 不带结尾斜杠的 URL 从任意来源可打开（含从博客文章点过来的绝对链接）
- [ ] 失败处置与回滚写在票内：证书长期 pending、CNAME 冲突、强制 HTTPS 提前开启各有一条
