# 2. 同时匹配校内直连与 WebVPN 两条接入路径

日期：2026-09-29
状态：已接受（v2）

## 背景

学生到达同一平台的路径有两条：校内直连（`http://10.11.4.69:8090/netinnet_zhsx_v63/`）与校外经 WebVPN 网关反向代理。

WebVPN 会把内网目标编码进路径：`https://webvpn.shufe-zj.edu.cn/http-8090/<token>/netinnet_zhsx_v63/do?...`。其中 `<token>` 实测为 `IV(16B) + AES-128-CFB(内网 host)`，key 与 IV 均为固定常量，是**内网 host 的纯函数**，不随用户/会话/时间变化。

## 决策

`@match` 同时声明两条：

```
// @match http://10.11.4.69:8090/netinnet_zhsx_v63/*
// @match https://webvpn.shufe-zj.edu.cn/*/netinnet_zhsx_v63/*
```

脚本内部**不生成也不解析 token**，只用 `location.pathname` 相对拼接。登录完全交给用户，脚本只依赖浏览器里已建立的会话。

## 理由

- 实测（Chrome match-pattern 语义）确认两条规则**互不覆盖**，必须并存。
- path 段的 `*` 能跨越 `/`，故可吞掉 `/http-8090/<token>/` 整段，无需硬编码 token。
- 不用 `*://` 形式：host 通配会拖到无关站点；固定 host 后缀 `netinnet_zhsx_v63` 实现零误伤（实测不命中 CAS 登录页、不命中无关域名）。
- 不生成 token：WebVPN 的 key 可能被校方轮换，且「用户自己打开页面」的策略已让生成变得不必要。

## 代价

- WebVPN 网关若变更路径规则，匹配失效，需更新 `@match`。
- ~~未实测项~~ **已于 2026-09-30 真机验证**：WebVPN 下 frameset 改写**不剥离** `SXID`/`entityID` —— frame `top` 的文档请求 URL 同时携带两者（`entityID=110` 与 30 位十六进制 `SXID` 都在 query 里，200），且各 frame 与顶层文档**同源**。故上下文自动提取 `getContext()` 与 `mainFrame()`（只判 `frame.name === 'main'`，不读 `src`）**在 WebVPN 下无需改动即成立**。脚本内部「不生成也不解析 token、只用 `location.pathname` 相对拼接」的策略得到实测支持。
- 同一轮另证：网关注权**仅靠 cookie**（HttpOnly `wengine_vpn_ticket`）、**不校验 `Referer`**（无 referer + `sec-fetch-site: cross-site` 仍 200 真实内容）、URL 内**无一次性 token**（答案入口 `SXID=0` 以 CORS 模式 Fetch 返回 200 / 真实业务内容）；响应体注入的 `__vpn_app_hostname_data`、`__vpn_host_crypt = true`、`__vpn_host_crypt_key` 正面印证本文「token 是内网 host 的纯函数、key/IV 为固定常量」的论断。
- **残余（不算已验证）**：`GM_xmlhttpRequest` **本体**未在真机端到端触发 —— 仅证了网关侧前置条件已全部满足；脚本管理器（油猴）侧未证。
- 证据：`.scratch/voucher2t-taccount/verify/webvpn-verify-report.md`。
