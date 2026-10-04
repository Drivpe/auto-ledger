# 3. 写路径 HTTP 化：不导航脚本自身所在的框架

日期：2026-10-03
状态：已接受

## 背景

平台「新增」按钮不是前端插行，而是把表单 `v_dto6` 整页提交（`start=insert`）；全部行就位后再 `start=update_loop` 整体提交。因此回填一个科目至少要导航一次框架。

为修「面板在 frameset 顶层文档下不可见」，面板宿主被下移进 `MainWin` 内容框架（`frameByNameOrSelf()` 自返分支）。这带来一个此前未预见的后果：

**脚本运行 realm 恰好就是要被导航的那个框架。** 真写路径第一步 `fillAccount()` → `loadIntoFrame(mw, …)` 执行 `fr.location.href = url`，导航的正是脚本自己所在的 `MainWin`。

真机实证（2026-10-03，抓包 run `dee4327dc3093`，211 条请求全部 GET、POST = 0）：

| 观测 | 值 |
|---|---|
| 脚本发起的请求 | 仅 1 条，以 `userscript.html:582`（`fr.location.href = url`）为 initiator |
| 其目标 | `do?action=ts_txz&start=query&accountID=1001&…`，frame `6200AF7A…` = `MainWin` |
| 导航结果 | **成功**：其后 0.7s 内 19 条 Script/Stylesheet 重载 ⇒ 新文档已解析 |
| 其后业务动作 | **无**（剩余 27 条全是新文档的资源加载），整轮 POST = 0 |
| 面板状态 | 回到初值「就绪」（console 再次打出 `面板已注入 v2 (框架 MainWin)`） |

⇒ **精确机制不是「脚本永久死亡」，而是「执行中的实例被销毁 + 新实例重新注入且状态归零」**：整页提交必然重载框架，每次重载都杀掉正在跑的 `main()` 循环，而重新注入的新实例并不知道有运行在进行，于是停在「就绪」等用户点「开始」。**这正是失败之所以静默的原因** —— 用户看到的是一个恢复正常的面板，不像报错。

**规模**：45 科目共 417 行，DOM 写法每行一次整页提交 ⇒ 一轮全量约 **417 次框架重载 / 417 次实例销毁**。HTTP 化后为 **0 次**。

反证：Playwright CLI（`src/fill-taccounts.mjs`）不自杀 —— 它在浏览器**外部**驱动，`mw.goto()` 之后用 `getMw()` 重新取 frame 句柄。所以问题不在「导航」本身，而在「谁持有控制流」。

## 决策

写路径 **HTTP 化**：用 `GM_xmlhttpRequest` 直接构造整页 POST（`start=insert` 逐行、`start=update_loop` 整体提交），**不再导航任何活 DOM**。读路径同理（已如此实现于 `httpGet()`）。

面板保留，但降级为**纯显示与控制**（参数确认 + 日志回显）。

**不采用**的两条备选：

- **MV3 扩展**：已用一手来源核查清楚（`.scratch/voucher2t-taccount/research/03-mv3-capability-matrix.md`，25 个可复核 URL）。结论：MV3 的确有实质优势，但优势**不来自注入机制** —— content script 与用户脚本一样随所属文档销毁（Chromium `script_injection_manager.cc` 的 `DidCreateNewDocument()`：「A new document is going to be shown, so invalidate the old document state.」）。差别在于扩展有一个**不属于文档树**的 service worker，能监听 `webNavigation` 并在新文档提交后用 `frameIds` 定向重注入 ⇒ 跨文档状态机可放在页面外。**但那正是本 ADR 用 HTTP 化达成的同一件事，成本低得多**：`GM_xmlhttpRequest` 一次导航都不产生（对比 DOM 写的 417 次重载），无需 manifest、无需重新分发、同学无需开 Developer mode。MV3 换来的是可编排性与网络/调试层权限（`chrome.debugger`，代价是「$1 started debugging this browser」常驻界面栏），本项目均非刚需。
- **以 Playwright CLI 为主交付**：会要求同学装 Node 并在 config 填账号密码，与「给同学用」的定位冲突；CLI 继续作为开发期取证与批量手段保留。

## 理由

- **`GM_xmlhttpRequest` 在扩展上下文发出，不受页面导航影响** —— 这是解开心结的关键机制。取数通道已用它跑通（`httpGet()`）。
- 网关层已实证支持 HTTP 化：整页 POST 的字段名（`pzh_bz_i`/`debit_i`/`lend_i`/`sxh`/`CHECK_CONFIRM`/`TEMPid`）**逐字不被改写**，写前与写后的三元组完全相等（`verify/webvpn-write-path-report.md` §三-ter）。
- 改动面小：不引入 manifest、不变分发方式、不动读路径。

## 实现落地（2026-10-03，round5）

写路径已按本决策实施。关键落点（`userscript/voucher2t.user.js`）：

| 环节 | 实现 | 说明 |
|---|---|---|
| POST 通道 | `httpPost(url, body)` | 原生 `GM_xmlhttpRequest`，`application/x-www-form-urlencoded` |
| 读状态 | `parseTState(html)` | `DOMParser` 解析**响应文本**；**不再读 `MainWin.document`** |
| 请求体 | `buildBody(state, startVal, opt)` | `insert` / `update_loop` / `delete_loop` 三种形态 |
| 写一个科目 | `fillAccount` / `clearAccount` | 全程 HTTP，零 DOM 导航 |
| 旧函数 | `loadIntoFrame` **已整体删除** | 自我销毁的凶器 |
| 遗留只读函数 | `frameByNameOrSelf` / `getTAccountFrame` | **已退出写路径**，保留为面板宿主定位逻辑 + 回归套件锚点 |

**两处实现期才会暴露的坑（都已实证并规避）**：

1. **`DOMParser` 下 `v_dto6` 存活，但 `[name="start"]` 有歧义**。实测（`verify/probe-domparse-txz.mjs`）：`doc.forms.v_dto6` 存在且 `childElementCount=8` —— 与凭证详情页 `v_dto3` 被 HTML 解析器剥离成空壳的情况**不同**；但页面上另有一个 `formSearch` 也含 `name="start"`，文档级查询命中 **2 个**（`['query','query']`）。故隐藏字段与行字段**必须限定在 `v_dto6` 范围内**查询，否则 `start` 语义会被写坏。
2. **演练模式必须优先于幂等跳过**。由离线仿真（`impl/B-verify/http-write-sim.mjs` S1 判据）抓到：原实现把幂等判定放在 `dryRun` 之前，导致平台已有数据时演练返回 `skipped` 而非 `dry` ⇒ 演练不再是「只读预览本次计划」。已改为 dryRun 优先短路。

## 验证状态（截至 2026-10-03）

- **离线**：新增 `impl/B-verify/http-write.mjs`（46 项：负例断言 + 真机原文解析 + 与 §三-ter 请求体**逐字比对** + 判据改动）、`impl/B-verify/http-write-sim.mjs`（15 项：交付代码真身 + 仿真平台服务器 + 完整写序列状态机）。全量 12 个套件退出码 0，**既有断言零变动**。
- **真机只读**：WebVPN 上 `GET ts_txz&start=query&accountID=1001` 落盘原文（`evidence/txz-1001-2026-10-03.html`），读数 9 行 / 借 15232.00 / 贷 7771.00 / TEMPid `174642..174650`，与 §三-bis 快照逐项一致。
- **真机写入已实测**（2026-10-03，抓包 run `de6842d225c50`，`verify/raw/round5-http-write/EVIDENCE.txt`）：`delete_loop` ×1、`insert` ×9、`update_loop` ×1，**11 个 POST 全部 200**。逐步读回对账：基线 9 行 → 清空后 0 行 → 复核空态 0 行 → `insert` 后 9 行 → `update_loop` → 重新 GET 读回 9 行，合计 **借 15232.00 / 贷 7771.00**，与 `out/taccounts.json` 的 1001 **逐行一致**。
  - **`start=insert` 在 WebVPN 上已直接实测通过**（第 1 次 insert 请求体 134 字符，响应 200 / 19218 字节；其后独立 GET 复核出现「记1 / 232.00」，新 `TEMPid=175176`）。**先前的「推论」状态就此终结**。
  - 规模对比落实：同一序列在 DOM 写法下约 11 次框架重载 / 实例销毁，HTTP 化后 **0 次**。


## 代价

- **脚本同时具备「删除」（`start=delete_loop`）与「写入」两种破坏能力**，判据一旦出错，损失面比只写更大。已在面板上以独立警示区标注，且删除入口（「只清空」）要求 `CONFIG.onlyAccount` 限定单科目 + 手输科目码二次确认；写路径内顺带的自动清空则按 D5-bis 不加额外确认，与写入共用同一道三锁闸门。
- 逐行 `start=insert` 提交后需自行解析响应维护表单状态（`TEMPid` 序列会变），比操作 DOM 更依赖对响应 HTML 的解析。
- `start=insert` 这一个取值在 WebVPN 上**已由 2026-10-03 真机实测通过**（见上「验证状态」）。此条原为推论，已撤回。
- 面板宿主与回填目标重合这一结构仍存在；若将来又把面板移回顶层或被平台改变框架结构，本决策的前提需重新核对。
- **D3 判据放宽到「前缀 + 金额 + 方向」后不再能发现「摘要写错」**。这是刻意的取舍：平台存量带摘要、D4 后计划为纯字号，全等比较必然误判。若将来要求摘要也须一致，需另设判据。
