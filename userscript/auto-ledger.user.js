// ==UserScript==
// @name         网中网会计综合实习平台 · 账簿自动登记
// @namespace    auto-ledger
// @version      3.3.1
// @description  抓取平台记账凭证（教师答案 / 学生答案），按一级科目归集后逐笔登记进 T 型账。面板 + 凭证抓取并发 + T型账操作严格串行 + 写前冲突普查 + 读回校验科目归属 + 删后自愈重删 + 本地答案缓存 + 三重锁校验。
// @author       auto-ledger
// @match        http://10.11.4.69:8090/netinnet_zhsx_v63/*
// @match        https://webvpn.shufe-zj.edu.cn/*/netinnet_zhsx_v63/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @connect      10.11.4.69
// @connect      webvpn.shufe-zj.edu.cn
// @run-at       document-idle
// ==/UserScript==

/*
 * ============================ 使用说明 ============================
 *
 * 1. 安装 Tampermonkey 后新建脚本，粘贴本文件全部内容，保存。
 * 2. 按正常流程登录平台，进入实训企业（点企业名进入）。
 *    内网直接访问，或经学校 WebVPN 访问，两条路径都支持（见 @match）。
 * 3. 页面右上角会出现一个绿色悬浮面板。
 *    注意：平台的内容页是 frameset（顶层文档没有可渲染的 body），所以面板落在内容框架里
 *    —— 即 T 型账主体区域的右上角，而不是浏览器窗口的右上角。看不到时先确认已点开 T 型账。
 * 4. 点面板上的四个按钮。顺序即建议操作顺序：
 *
 *   ① 清空 T 型账
 *      扫平台的全部总账科目（实测 155 个），凡已有行的都清空。不可恢复。
 *      点下去先弹一次确认框，确认后才开始扫。这一步不需要联网抓凭证。
 *
 *   ② 获取教师答案并写入 T 型账
 *      取平台内置的标准答案凭证（SXID=0，与账号无关），归集后写进 T 型账。
 *
 *   ③ 获取学生答案并写入 T 型账
 *      取学生自己录入的那份凭证，归集后写进 T 型账。
 *
 *   ④ 删除本地存储答案
 *      只删本脚本存在浏览器里的缓存（教师答案 + 全部学生答案），不碰平台。
 *
 * 数据源：教师答案凭证列表（SXID=0，与账号无关），以及学生自己录的凭证。
 *
 * 关于缓存：②③ 抓过一次之后，凭证就永久留在本地，之后再点直接用本地数据、不再联网抓取
 *    （一轮 103 张凭证要几分钟）。命中缓存时日志不会特别提示。要重新抓取必须先点 ④。
 *
 * 关于写入：写入之前会先普查平台全部总账科目，报出「冲突科目」（平台有行、但与本轮计划
 *    不匹配）。冲突科目不再自动跳过 —— 面板会停下来问：清掉它们再写，还是跳过它们。
 *    平台已有行且与计划逐行一致的科目，静默跳过（幂等）。
 *    拿不到平台状态的科目一律不写（「未知」不等于「平台是空的」）。
 *
 * ⚠ 年月默认值是 2020 年 1 月（实训任务绝大多数就是 2020 年 1 月）。
 *    只有实训任务确实是 2020 年 1 月时才能不动；否则必须在面板上手动改年、月，
 *    写错年份会查到空数据或写错期间。
 *
 * ⚠ 本版没有「只读预览」这一档：点写入按钮就直接改平台数据，平台无事务、无回滚。
 *    写入前日志会列出科目数与行数，随时可以点「停止」。要撤回只能先点 ① 清空。
 *
 * 提速与并发：只读 GET 最多 4 路并发，写入与删除按科目最多 3 路并发；
 *    同一科目内部严格串行（原因见 poolMap 注释）。点「停止」是在途请求收完、不再发新的。
 *
 * 配置项在下方 CONFIG，改完保存即可。
 * =================================================================
 */

(function () {
  'use strict';

  // ======================= 配置 =======================
  const CONFIG = {
    // 实训任务的年月。默认值写死为 2020 年 1 月（实训任务绝大多数就是这个期间）。
    // 非 2020/1 的任务必须在面板里改，否则会查询/写入错误的期间。
    year: '2020',
    month: '1',

    // 每写一行后的间隔（毫秒）。
    // 取 120 的依据：这是 round5 真机试写实跑过的档位（真机抓包 251 条请求全 200、无 429/5xx，
    // 没有任何限速实测证据）。压到 0 没有真机数据支撑，所以不取 0。
    throttleMs: 120,

    // 凭证抓取的并发路数（列表翻页、凭证详情）。这些请求走的是 `action=zhsx_common_jzpz`
    // 等**别的** action，不触碰 T 型账表单，故可以并行。
    readConcurrency: 4,

    // ★ T 型账操作的并发路数。**必须为 1**（round10 定案，不要为了提速调大）。
    //
    // 依据分三层，强度不同，别混着当同一件事：
    //
    // ①【真机差分，最硬】旧版（commit 5b10a4b）全程串行，用户实测「没问题」；
    //    改成科目级并发（b38f5e8）后出现「3 个科目 N → 1 行残留」「6411 科目未切换」。
    //    ⇒ 故障与并发相关，这条是用户的一手观测。
    // ②【离线 A/B，可复现】把旧脚本与新脚本分别喂进同一个离线 harness（服务端侧注入故障，
    //    不改脚本本身）：旧脚本复现出「N → 1 行」；新脚本下**全部机制被证伪**
    //    （新增的 TEMPid 非空断言 + 串行把每一种故障形态都挡掉了）。
    //    ⇒ 修复有效，这条可自行复跑验证。
    // ③【被证伪的说法，别再写进注释】曾经把根因写成「服务端会话持『当前科目』，并发时
    //    某次 delete_loop 删了别的科目的行集」。离线 harness 的差分实验把这个模型
    //    **证伪了**：它能复现「科目未切换」，但严格复现「N → 1」的命中率是 0/10
    //    （若真按别的科目的行集删，残留数会随科目规模变化，而真机恒为 1）。
    //    已坐实的机制是**并发下读侧响应行集残缺**（某行 TEMPid 丢失 ⇒ buildBody 带空
    //    CHECK_CONFIRM ⇒ 服务端匹配不到那行 ⇒ 它删不掉），该机制在并发=1 下复现率降为 0。
    //
    // 结论：凡走 `action=ts_txz` 的操作一律串行（写前普查、清空扫描、冲突清理、逐行写入）。
    // 另外 `clearAccount` 里还有一道**独立的**提交前断言（每行 TEMPid 必须非空）——
    // 因为 TEMPid 缺失这类形态在串行下**也会**出现，光靠串行挡不住，两处都要留。
    tAccountConcurrency: 1,
  };
  // ===================================================

  /**
   * 本地答案缓存的存储键（GM_setValue / GM_getValue）。
   *
   * 为什么缓存的粒度是「原始凭证」而不是「归集结果」：
   *   归集规则日后改动时无需重新联网抓取（一轮 103 张凭证要几分钟）。
   * 教师答案统一一份；学生答案按学生隔离（见 studentCacheKey）。
   */
  const CACHE = {
    teacher: 'v2t_answer_teacher_v1',
    teacherMeta: 'v2t_answer_teacher_meta_v1',
    studentPrefix: 'v2t_answer_student_v1:',
  };

  /** 读取本地缓存；GM 存储不可用时静默返回 null（退化为每次都联网抓）。 */
  function cacheGet(key) {
    try {
      if (typeof GM_getValue !== 'function') return null;
      const raw = GM_getValue(key, null);
      if (raw == null) return null;
      // 兼容两种实现：已存对象直接返回，或存的是 JSON 字符串
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch { return null; }
  }

  /** 写入本地缓存。返回是否成功（失败不阻断主流程）。 */
  function cacheSet(key, value) {
    try {
      if (typeof GM_setValue !== 'function') return false;
      GM_setValue(key, JSON.stringify(value));
      return true;
    } catch { return false; }
  }

  /** 删除单个键。 */
  function cacheDel(key) {
    try {
      if (typeof GM_setValue === 'function') GM_setValue(key, null);
    } catch { /* 忽略 */ }
  }

  /**
   * 「删除本地存储答案」：教师答案 + 全部学生答案。
   *
   * 学生答案的键带学号后缀，无法枚举 ⇒ 另存一份学生键索引，删除时按索引逐个清。
   * 索引本身也一并清掉。
   */
  function cacheClearAll() {
    cacheDel(CACHE.teacher);
    cacheDel(CACHE.teacherMeta);
    const idx = cacheGet(CACHE.studentPrefix + '_index');
    const keys = new Set(Array.isArray(idx) ? idx : []);
    keys.add(CACHE.studentPrefix + '_index');
    for (const k of keys) cacheDel(k);
    return keys.size;
  }

  const log = (...a) => console.log('[凭证登T账]', ...a);

  /**
   * 平台的应用根路径。
   *
   * 坑：当前页 URL 可能是 `.../netinnet_zhsx_v63/do?action=ts_txz`，
   * 此时 `location.pathname` 是 `/netinnet_zhsx_v63/do`，
   * 直接再拼 `do?action=...` 会得到 `/netinnet_zhsx_v63/dodo` → Tomcat 404。
   * 所以必须取到最后一个斜杠为止的目录部分。
   * 注意：返回值是应用根（以 / 结尾），不含 `do`；拼页面 URL 时要自己加 `do?action=...`。
   */
  function appBase() {
    const p = location.pathname;
    const i = p.lastIndexOf('/');
    return location.origin + (i >= 0 ? p.slice(0, i + 1) : '/');
  }


  // ---------- 平台常量 ----------
  const P = {
    // 学生凭证查询（列表与详情同 action）
    studentList: 'zhsx_common',
    studentDetail: 'zhsx_common',
    // 官方答案凭证：列表同为 zhsx_common，详情走 zhsx_common_jzpz
    answerList: 'zhsx_common',
    answerDetail: 'zhsx_common_jzpz',
    tAccount: 'ts_txz',
  };

  /**
   * 答案凭证列表的查询入口。
   *
   * 实测：老师/答案侧的 SXID 恒为 0，与账号、会话都无关 ——
   * 这是「换一个人、换一个任务还能用」的技术支点。
   * 因此答案取数只依赖 entityID，不依赖 SXID。
   */
  const ANSWER_SXID = '0';

  /**
   * 学生答案缓存的隔离键。
   *
   * 为什么不用账号名而是学号：平台 URL 与隐藏字段里都没有学号/账号字段
   * （隐藏字段只有 `sxid`/`entityid`），唯一带学号的地方是顶层文档标题。
   * 实测标题形态（`probe/out-menu.json`）：
   *   `学生(<姓名>)(<学号>)企业(<企业名>)(110)SXID(<30hex>)`
   *
   * ⚠ 层级陷阱：只有顶层框架的标题带学号，内容框架（MainWin）自身的标题只是企业名。
   *   脚本运行的 realm 恰好是内容框架，所以必须显式去 `window.top` 取，取错层拿不到。
   *   跨域时 `window.top.document` 会抛异常 —— 那时退化为取本框架标题。
   *
   * 取不到学号时回退 `SXID`（此时同一学生换批次会另起一份学生缓存，已在 ADR-0004 记明代价）。
   */
  function getStudentKey(ctx) {
    const titleFrom = (win) => {
      try { return win.document?.title || ''; } catch { return ''; }
    };
    // 顶层优先，其次本框架，最后再翻一层子框架
    const titles = [];
    try { titles.push(titleFrom(window.top)); } catch { /* 忽略 */ }
    titles.push(titleFrom(window));
    for (let i = 0; i < window.frames.length; i++) {
      try { titles.push(titleFrom(window.frames[i])); } catch { /* 忽略 */ }
    }

    for (const t of titles) {
      if (!t) continue;
      // 形态：学生(姓名)(学号) —— 学号是紧跟在「学生(...)」之后那个括号里的数字段
      const m = t.match(/学生\s*\([^)]*\)\s*\(\s*([0-9A-Za-z_-]{4,})\s*\)/);
      if (m) return { key: m[1], source: '学号' };
    }
    // 兜底：top 框架链接参数（真机抓包见 probe/dump-top.html:94 / :306）
    for (const t of titles) {
      const m = t.match(/(?:userID|studentid)=([0-9A-Za-z_-]{4,})/i);
      if (m) return { key: m[1], source: 'top 链接参数' };
    }
    if (ctx?.sxid) return { key: ctx.sxid, source: 'SXID' };
    return { key: 'unknown', source: '未取到（退化为单一学生缓存）' };
  }

  /**
   * 取当前实训的公共参数（SXID / entityID）。
   *
   * entityID 是硬需求（答案入口也要它）；SXID 只有「抓学生凭证做锁三比对」时才需要，
   * 取不到不算失败 —— 答案取数不受影响。
   *
   * 不能只看顶层 URL —— 顶层可能停在 do?action=ts_txz... 而参数在子框架里。
   * 依次尝试：各框架 URL → 隐藏字段 → HTML 文本。
   */
  function getContext() {
    const grabEntity = (s) => {
      if (!s) return null;
      return s.match(/[?&](?:entityID|entityid|EntityID)=(\d+)/i)?.[1] || null;
    };
    const grabSxid = (s) => {
      if (!s) return null;
      const m = s.match(/[?&](?:SXID|sxid)=([A-F0-9]{16,})/i);
      return m ? m[1] : null;
    };

    // 1) 所有框架的 URL（含自身与多层子框架）
    const urls = [location.href];
    const walk = (win, depth = 0) => {
      if (depth > 3) return;
      for (let i = 0; i < win.frames.length; i++) {
        let f;
        try { f = win.frames[i]; } catch { continue; }
        try { if (f.location?.href) urls.push(f.location.href); } catch { /* 跨域 */ }
        try { walk(f, depth + 1); } catch { /* 忽略 */ }
      }
    };
    try { walk(window); } catch { /* 忽略 */ }

    let entityID = null;
    let sxid = null;
    for (const u of urls) {
      if (!entityID) entityID = grabEntity(u);
      if (!sxid) sxid = grabSxid(u);
      if (entityID && sxid) break;
    }

    // 2) 子框架 DOM 里的隐藏字段
    if (!sxid) sxid = findInFrames('sxid') || findInFrames('SXID');
    if (!entityID) entityID = findInFrames('entityid') || findInFrames('entityID') || findInFrames('entityId');

    // 3) 从 HTML 文本里抠
    if (!sxid || !entityID) {
      const all = document.documentElement.innerHTML || '';
      if (!sxid) sxid = all.match(/SXID=([A-F0-9]{16,})/i)?.[1] || null;
      if (!entityID) entityID = all.match(/entityID=(\d+)/i)?.[1] || null;
    }

    if (!entityID) return null;
    return { sxid, entityID }; // sxid 可能为 null：只影响锁三比对
  }

  /** 在所有子框架里递归翻找隐藏字段的值。 */
  function findInFrames(name) {
    const seen = new Set();
    const walk = (win, depth = 0) => {
      if (depth > 3) return null;
      for (let i = 0; i < win.frames.length; i++) {
        let f;
        try { f = win.frames[i]; } catch { continue; }
        let doc;
        try { doc = f.document; } catch { continue; }
        if (!doc || seen.has(doc)) continue;
        seen.add(doc);
        const el = doc.querySelector(`input[name="${name}"]`);
        if (el && el.value) return el.value;
        const deep = walk(f, depth + 1);
        if (deep) return deep;
      }
      return null;
    };
    return walk(window);
  }

  /** 找到承载内容的 main 框架。 */
  function mainFrame() {
    // 本框架自己就是面板宿主时返回自身。
    // 为什么必须这样（真机实测，见 verify/webvpn-write-path-report.md §五-bis）：
    //   平台内容页（实训主框架页、T型账外壳页 ts_txz&start=1）都是 frameset，顶层文档没有
    //   可渲染 body ⇒ 面板只能挂在 name=main / MainWin 的内容框架里。此时若仍只向下找
    //   `name="main"` 的子框架，就会复现实测日志「❌ 找不到 main 框架，请确认已进入实训企业。」
    //   —— 面板可见却一点就死。本函数在主流程里只做存在性检查（:933 附近），
    //   真正的取数走 GM_xmlhttpRequest、回填走 frameByName('MainWin')，与它无关。
    if (isPanelHostFrame()) return window;
    for (let i = 0; i < window.frames.length; i++) {
      try {
        if (window.frames[i].name === 'main' && window.frames[i].document) return window.frames[i];
      } catch { /* 忽略 */ }
    }
    return null;
  }

  /**
   * ⚠ 遗留函数（已退出写路径）：`frameByNameOrSelf` / `frameByName` / `getTAccountFrame`。
   *
   * 它们是 DOM 写路径的产物。写路径 HTTP 化（ADR-0003）后，回填不再需要任何框架句柄：
   * `parseTState` / `queryTState` / `buildBody` / `submitForm` / `fillAccount` / `clearAccount`
   * 全程只走 GM_xhr，函数体内不出现 `frameByNameOrSelf`、`loadIntoFrame`、`location.href`。
   *
   * 保留原因有二（都不是在写路径上使用）：
   *   1. `verify/replay-frame-host.mjs` 是面板宿主定位的回归套件，断言的本就是这三个函数
   *      在四种宿主场景下的返回值。删掉函数会让该套件整体失去被检对象。
   *   2. 面板宿主判定（`isPanelHostFrame` / `hasRenderableBody`）仍是在用的逻辑。
   *
   * 因此本组函数的定位是「宿主逻辑的只读判定 + 回归锚点」，不是回填链的一部分。
   * 验收台有一条负例断言（B-verify/http-write.mjs）对写路径代码段做 grep，
   * 命中 `frameByNameOrSelf`/`loadIntoFrame`/`location.href`/`mw.goto` 即 FAIL。
   */
  function frameByNameOrSelf(name) {
    try {
      if (window.name === name && hasRenderableBody(document)) return window;
    } catch { /* 跨域等异常：退回只向下找 */ }
    return frameByName(name);
  }

  /** 在同源子框架里按名字找（只向下）。遗留：见上方说明。 */
  function frameByName(name) {
    for (let i = 0; i < window.frames.length; i++) {
      try {
        if (window.frames[i].name === name && window.frames[i].document) return window.frames[i];
      } catch { /* 忽略 */ }
      try {
        const sub = window.frames[i].frames;
        for (let j = 0; j < sub.length; j++) {
          if (sub[j].name === name && sub[j].document) return sub[j];
        }
      } catch { /* 忽略 */ }
    }
    return null;
  }

  /** 遗留：回填目标框架。HTTP 化后写路径不再调用它；仅供宿主定位回归套件断言。 */
  function getTAccountFrame() {
    return frameByNameOrSelf('MainWin');
  }

  /**
   *
   * 真实依据（真机实测，verify/webvpn-write-path-report.md §五-bis 有 HTML 原文）：
   * frameset 文档里 `document.body` 取到的就是 `<frameset>` 元素本身
   * （`document.body` 的规范定义是 body 或 frameset 二者之一），它只给 `<frame>` 子节点布局。
   * 所以往它里面 appendChild 的面板「有 DOM、无盒模型」—— 实测点击返回
   * `element not visible (no content quads, box model, ...)`，页面上永远看不到。
   * 另有 `<noframes>` 里那个兜底 body（Chrome 下同样不渲染），一并判掉。
   */
  function hasRenderableBody(doc) {
    try {
      const b = doc && doc.body;
      if (!b) return false;
      if (b.tagName === 'FRAMESET') return false;                                           // body 即 frameset
      if (doc.documentElement && doc.documentElement.tagName === 'FRAMESET') return false;  // 双保险
      if (b.parentElement && b.parentElement.tagName === 'NOFRAMES') return false;          // noframes 兜底
      return true;
    } catch { /* 跨域等异常一律当不可用 */ return false; }
  }

  /** 允许承载面板的框架名：平台里真正装内容的两个框架（MainWin 是 T 型账主体）。 */
  const HOST_FRAME_RE = /^(main|MainWin)$/i;

  /**
   * 本框架是否是合格的面板宿主？（boot() 与 mainFrame() 共用）
   *
   * 为什么不再限定 `window.top === window.self`（旧 boot() 的写法）：
   * 平台实训主框架页与 T型账外壳页（`do?action=ts_txz&start=1`）都是 frameset，
   * 顶层永远没有可渲染 body ⇒ 旧写法把面板 100% 挂进 `<frameset>`，实测三种页面
   * 没有任何一种可用（要么不可见，要么可见但 mainFrame() 返回 null）。
   * 这就是「`GM_xmlhttpRequest` 本体从未端到端触发」的真因：按钮根本点不到。
   *
   * 放行 name=main / MainWin 之后，宿主落到内容框架（T 型账主体 = MainWin）里，面板可见可点；
   * 非 frameset 的普通页（内网直连路径、T型账录入页）仍是「顶层即宿主」，行为不变。
   *
   * ⚠ 不选「从顶层递归取第一个有可用 body 的框架」：本平台首个命中的是 `rows="97,3,0"` 里
   *    那片 97px 高的菜单条 top_frame，面板会被裁成一条，比现在更不可用。
   */
  function isPanelHostFrame() {
    let isTop = false;
    try { isTop = window.top === window.self; } catch { /* 跨域 */ }
    return (isTop || HOST_FRAME_RE.test(window.name || '')) && hasRenderableBody(document);
  }

  /** 同步等待：轮询直到条件成立或超时。 */
  function waitFor(fn, timeoutMs = 20000, interval = 200) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const tick = () => {
        let v = null;
        try { v = fn(); } catch { v = null; }
        if (v) return resolve(v);
        if (Date.now() - t0 > timeoutMs) return resolve(null);
        setTimeout(tick, interval);
      };
      tick();
    });
  }

  /**
   * 限流并发池：最多 limit 个 worker 同时在途，共享一个递增游标取任务，
   * 结果数组按【输入顺序】返回。
   *
   * 为什么必须按输入顺序返回，而不是按完成顺序：抓答案侧凭证时，凭证字号是按列表序号
   * 生成的（fetchVoucherBodies 的 `记${i+1}`）。若结果按完成先后排列，序号会与实际凭证错位，
   * 凭证号就会写错 —— 而错号写进平台之后没有回滚。
   *
   * 为什么并发粒度只能到「科目 / 凭证」，不能到「行」：
   *   `insert` 的请求体自带「当前已存全部行的 pzh_bz/debit/lend/TEMPid」，而 TEMPid 由
   *   服务端逐次生成。下一行必须看到上一行的落库结果（载体就是 fillAccount 里的局部 `state`），
   *   所以同一科目内部必须严格串行；而科目之间没有共享的可变写入态 —— `state` 是局部变量，
   *   请求体每次显式携带 sxid/accountID/yyyy/mm/entityid，但**这不足以推出「科目级可以并行」**：
   *   并发下读侧响应行集残缺（round10 真机差分 + 离线 harness 复现），故 T 型账路径一律串行
   *   （见 CONFIG.tAccountConcurrency）。
   *
   * 停止语义（「在途请求收完，不再发新的」）：每个任务【开始前】查一次 shouldStop()，
   * 已发出的请求允许跑完。为什么不用 abort：GM_xmlhttpRequest 中止后无法区分
   * 「被取消」与「请求失败」，会把 insert 的重试逻辑带偏。
   *
   * ⚠ 由这条语义推出一个必读的后果：lane 在循环顶部就 `return`，所以【worker 内部的
   *   `shouldStop()` 分支永远不会被走到】。worker 首行那句 `if (shouldStop()) return null;`
   *   只在「停止发生在任务取号之后、worker 首行之前」这个极窄窗口里才有意义，实际基本不可达。
   *   因此调用方不能靠 worker 里的计数来判「是否被中断」，必须直接读 `shouldStop()`。
   *
   * ⚠ 某个 worker 抛异常时不冒泡，而是在该位置放 `{__error: e}`：抛出去等于让调用方
   *   丢掉全部已完成的结果（写入阶段真会这样 —— 已写盘的科目连同日志缓冲一起蒸发，
   *   汇总还会报 0）。调用方用 `collectPool(out)` 取结果并单独看失败项。
   *
   * @param {Array} items
   * @param {number} limit   并发路数
   * @param {(item:any, index:number)=>Promise<any>} worker  建议自行 try/catch
   * @param {()=>boolean} shouldStop
   * @returns {Promise<Array>} 与 items 等长、按输入顺序；
   *          被停止而未开始的位置是稀疏洞（`i in out === false`），未开工也可能是 null，
   *          失败位置是 `{__error}`。一律用 collectPool() 读，别用 filter(Boolean)。
   */
  async function poolMap(items, limit, worker, shouldStop) {
    const out = new Array(items.length);
    let cursor = 0;        // 共享游标：取号与自增之间不会被await打断，无需加锁
    const lane = async () => {
      for (;;) {
        if (shouldStop?.()) return;
        const i = cursor;
        cursor += 1;
        if (i >= items.length) return;
        try {
          out[i] = await worker(items[i], i);
        } catch (e) {
          // 单个任务抛错不再冒泡：抛出去就等于让调用方丢掉全部已完成的结果
          // （写入阶段真会这样 —— 已写盘的科目、连同它们的日志缓冲一起蒸发，
          // 汇总还会报 0，把「写了 7 个科目」显示成「什么都没写」）。
          // 改为在该位置上放一个带错误标记的对象，让调用方按「这一个任务失败」处理。
          out[i] = { __error: e };
        }
      }
    };
    // 路数取 min(limit, 任务数)：任务比路数少时不必空转 lane
    const lanes = Math.max(1, Math.min(limit, items.length));
    await Promise.all(Array.from({ length: lanes }, lane));
    return out;
  }

  /**
   * 取出 poolMap 结果数组里的真实结果，跳过「未开工」的位置。
   *
   * 为什么不能直接 `out.filter(Boolean)`：被停止时没轮到的位置是稀疏洞（`i in out === false`），
   * 而 `Array.prototype.filter` 会跳过稀疏洞、`Array.prototype.forEach` 也是 ——
   * 用它们过滤后会得到「洞被当成不存在」，但用 `filter(r => r === null)` 又会得到 0
   * （洞不是字面 null）。两种写法都错，只有显式 `i in out` 判据才准。
   *
   * @returns {{items: any[], failed: Array<{index:number, error:Error}>}}
   */
  function collectPool(out) {
    const items = [];
    const failed = [];
    for (let i = 0; i < out.length; i++) {
      if (!(i in out)) continue;                       // 未开工（稀疏洞）
      const v = out[i];
      if (v === null) continue;                        // 显式未开工
      // 用 `in` 而不是 `v && v.__error`：`throw 0` / `throw ''` / `throw null` 这类 falsy
      // 抛出值会绕过真值判断泄漏进 items，被当成一条正常结果用（round9 复核 N2）。
      if (typeof v === 'object' && v !== null && '__error' in v) {
        failed.push({ index: i, error: v.__error });
        continue;
      }
      items.push(v);
    }
    return { items, failed };
  }

  // ======================= 第一步：抓取凭证 =======================

  /**
   * GET 一个平台页面，返回其 HTML 文本。
   *
   * 关键：凭证详情是 frameset，直接取外层只能拿到壳（约 2KB）。
   * 真正的凭证体在子框架 URL（start=jzpz_list_for_chargup_query_1rec，无 _skip 后缀）里，
   * 其内容约 36KB 且含完整表单。因此必须取子框架 URL，不能取外层。
   *
   * 优先用 GM_xmlhttpRequest（带 cookie，不受同源与框架隔离限制）；
   * 不可用时回退到页面内 fetch。
   */
  function httpGet(url) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === 'function') {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          onload: (r) => (r.status >= 200 && r.status < 400 ? resolve(r.responseText) : reject(new Error('HTTP ' + r.status))),
          onerror: () => reject(new Error('网络错误')),
          ontimeout: () => reject(new Error('超时')),
        });
      } else {
        fetch(url, { credentials: 'include' })
          .then((r) => (r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status))))
          .then(resolve)
          .catch(reject);
      }
    });
  }

  /**
   * POST 一个平台页面（整页表单提交），返回响应 HTML 文本。
   *
   * 为什么必须走 GM_xmlhttpRequest 而不是操作 DOM（真机实测根因，见 docs/adr/0003）：
   *   平台的「新增」「修改提交」「删除提交」都是整页提交，服务端会重渲染该框架。
   *   而面板宿主已被下移到 `MainWin` 内容框架（修面板不可见所必需）——脚本运行 realm
   *   恰好就是要被重渲染的那个框架。于是每写一行都销毁一次执行中的实例：
   *   round4 实测（run dee4327dc3093）导航成功、其后 0.7s 内 19 条资源重载、
   *   面板日志回到初值「就绪」，整轮 POST = 0 —— 表现为「跑通了但一行没写」。
   *   45 科目 417 行 ⇒ DOM 写法一轮约 417 次实例销毁；HTTP 化后 0 次。
   */
  function httpPost(url, body) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== 'function') {
        return reject(new Error('GM_xmlhttpRequest 不可用，HTTP 化写路径无法执行'));
      }
      GM_xmlhttpRequest({
        method: 'POST',
        url,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: body,
        onload: (r) => (r.status >= 200 && r.status < 400 ? resolve(r.responseText) : reject(new Error('HTTP ' + r.status))),
        onerror: () => reject(new Error('网络错误')),
        ontimeout: () => reject(new Error('超时')),
      });
    });
  }

  /** 从 HTML 文本里解析一张凭证的表单字段。 */
  function parseVoucherHtml(html) {
    const fen2yuan = (fen) => {
      const s = String(fen ?? '').replace(/[\s\u00a0]/g, '');
      if (!s || !/^-?\d+$/.test(s)) return 0;
      return Number(s) / 100;
    };
    // 用 DOMParser 得到可查询的文档，比正则可靠
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // 坑：平台的 HTML 里 <form name="v_dto3"> 解析后是空的 ——
    // 表格内部的 <form> 会被 HTML 解析器提升/剥离，输入框落到 form 之外。
    // 因此必须用文档级查询，不能 form.querySelector。
    // 实测：form.childElementCount === 0，而 doc.querySelector('[name="r1_accountid_1"]') 有值。
    const valOf = (n) => {
      const el = doc.querySelector(`[name="${n}"]`);
      return el ? el.value : '';
    };

    const lines = [];
    for (let i = 1; i <= 20; i++) {
      const acc1 = (valOf(`r${i}_accountid_1`) || '').trim();
      if (!acc1) continue;
      lines.push({
        row: i,
        accountCode: acc1,
        accountDetail: (valOf(`r${i}_accountid_last`) || '').trim(),
        debit: fen2yuan(valOf(`r${i}_debit`)),
        lend: fen2yuan(valOf(`r${i}_lend`)),
      });
    }

    // 摘要与科目名：从 data_tb 表格取
    const tb = doc.getElementById('data_tb');
    const names = [];
    if (tb) {
      const trs = [...tb.querySelectorAll('tr')].slice(2);
      for (const tr of trs) {
        const tds = [...tr.querySelectorAll('td')];
        if (!tds.length) continue;
        const summary = (tds[0]?.textContent || '').replace(/\s+/g, ' ').trim();
        const accText = (tds[1]?.textContent || '').replace(/\s+/g, ' ').trim();
        const detail = (tds[2]?.textContent || '').replace(/\s+/g, ' ').trim();
        if (accText === '合 计' || accText === '合计') continue;
        if (!accText && !detail) continue;
        names.push({ summary, accountName: accText, detailName: detail });
      }
    }
    lines.forEach((l, i) => {
      l.summary = names[i]?.summary || '';
      l.accountName = names[i]?.accountName || '';
      l.detailName = names[i]?.detailName || '';
    });

    const txt = (doc.body?.textContent || '').replace(/\s+/g, ' ');
    const dm = txt.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    const nm = txt.match(/记字第\s*(\d+)\s*号/);
    const pm = txt.match(/【凭证(\d+)\/(\d+)】/);

    return {
      date: dm ? `${dm[1]}-${String(dm[2]).padStart(2, '0')}-${String(dm[3]).padStart(2, '0')}` : null,
      voucherNo: nm ? Number(nm[1]) : null,
      pageNo: pm ? Number(pm[1]) : 1,
      pageCount: pm ? Number(pm[2]) : 1,
      totalDebit: fen2yuan(String(valOf('total_debit')).replace(/[￥¥,\s\u00a0]/g, '')),
      totalLend: fen2yuan(String(valOf('total_lend')).replace(/[￥¥,\s\u00a0]/g, '')),
      accountRecordId: valOf('accountrecordid') || null,
      lines,
    };
  }

  /**
   * HTML 实体解码。
   *
   * 必须做这一步的原因（实测）：答案（老师版）列表页把 openTag 的参数用 `&quot;` 转义，
   * 而学生版用真单引号。原样跑正则匹配数为 0。
   * 解码 `&quot;` → `"` 之后，同一个正则即可命中 —— 所以只解码、不改正则模式。
   */
  function decodeEntities(s) {
    return String(s || '')
      .replace(/&quot;/g, '"')
      .replace(/&#0*34;/g, '"')
      .replace(/&#x0*22;/gi, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#0*39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&'); // 必须最后做，否则会把 &amp;quot; 二次解码
  }

  /** 从凭证列表页的 HTML 里抽出所有凭证详情入口。答案版与学生版共用。 */
  function parseVoucherLinks(html) {
    const out = [];
    // 学生版实际输出用单引号包 href，且 URL 后还跟着第三个参数：
    //   <a href='Javascript:openTag("记1", "do?...", "A3BE...");'>
    // 答案（老师）版同一处用 &quot; 转义，先解码再去匹配。
    // 故：解码实体 → 再跑正则。
    //
    // WebVPN 网关还会把 href 再包一层（真机实测，见
    // verify/webvpn-write-path-report.md §五-ter 有原始字节）：
    //   href="Javascript:this.top.vpn_inject_scripts_window(this);vpn_eval((function () {
    //     openTag("记4", "do?...", "<recordid>"); }).toString().slice(14, -2))"
    // 旧写法要求 `href=['"]Javascript:openTag\(` 紧邻，于是 WebVPN 下恒 0 命中
    // （面板只打「列表第 1 页：0 张」→「❌ 没抓到答案凭证。」，而同一 URL 的页面侧是 200 /
    // 「共103行/每页15行」）。故改为只锚定 openTag( 及其两个字符串实参，不再要求 href 前缀：
    // 四种形态（内网单引号 / 答案侧 &quot; / 网关包裹 / 网关包裹 + &quot;）都能命中。
    // `jzpz_list_for_chargup_query_1rec` 是本平台独有的锚点，保留它以免误吃别的链接。
    const text = decodeEntities(html);
    const re = /openTag\("([^"]+)",\s*"(do\?[^"]*jzpz_list_for_chargup_query_1rec[^"]*)"/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      out.push({ label: m[1], url: m[2] });
    }
    return out;
  }

  /**
   * 从凭证列表页的 HTML 里抽出每张凭证的审核状态。
   *
   * 实测依据（`.scratch/voucher2t-taccount/evidence/teacher-list.html` 与
   * `out/vouchers-probe.json`）：列表行是固定 9 个单元格，顺序为
   *   `年 | 月 | 日 | 凭证号 | 摘要 | 备注 | 审核状态 | 登账情况 | 查阅凭证`
   * 审核状态列取值实测只有「已审核」与「未审核」两种。
   *
   * ⚠ 必须只从列表页取。凭证详情页里的「审核: <姓名>SH」是签章栏
   *   （`person_audit` 字段旁），与审核状态无关 —— 拿它当审核状态会全判成已审核。
   *
   * 返回 `Map<凭证号, 状态字符串>`。解析不到就返回空 Map（调用方只提示、不阻断）。
   *
   * @param {string} html 列表页 HTML
   */
  function parseAuditStatus(html) {
    const map = new Map();
    let doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); } catch { return map; }
    for (const tr of doc.querySelectorAll('tr')) {
      const cells = [...tr.cells].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim());
      if (cells.length < 7) continue;
      const label = cells[3];
      if (!/^记\d+$/.test(label)) continue;
      map.set(label, cells[6] || '');
    }
    return map;
  }

  /** 把审核状态 Map 汇总成一行日志：返回 `{unaudited: string[], total: number}`。 */
  function auditSummary(auditMap, vouchers) {
    const unaudited = [];
    let seen = 0;
    for (const v of vouchers) {
      // 列表页标签（学生侧可能带错位号）与重编号后的 label 都要试
      const st = auditMap.get(v.listLabel) ?? auditMap.get(v.label);
      if (st == null) continue;
      seen += 1;
      if (st && st !== '已审核') unaudited.push(st === '未审核' ? v.label : `${v.label}(${st})`);
    }
    return { unaudited, total: seen };
  }

  /** 把详情入口 URL 转成「子框架 URL」：去掉 _skip、补上 startAction。 */
  function toInnerUrl(entryUrl) {
    // 入口形如 ...&start=jzpz_list_for_chargup_query_1rec_skip&startAction=jzpz_list_for_chargup_query_1rec&...
    // 子框架形如 ...&start=jzpz_list_for_chargup_query_1rec&...（无 _skip，无 startAction）
    return entryUrl
      .replace('start=jzpz_list_for_chargup_query_1rec_skip', 'start=jzpz_list_for_chargup_query_1rec')
      .replace(/&startAction=[^&]*/, '');
  }

  /** 翻到凭证详情的第 n 页（同一子框架 URL 内换页）。 */
  function toInnerUrlPage(entryUrl, n) {
    const u = toInnerUrl(entryUrl);
    if (n <= 1) return u;
    // 平台的 current_page 参数；若不存在则追加
    return /[?&]current_page=/.test(u)
      ? u.replace(/([?&]current_page=)\d+/, `$1${n}`)
      : u + `&current_page=${n}`;
  }

  /**
   * 翻遍一个凭证列表页，累计所有凭证入口。
   *
   * 列表页分页是后端分页（`do?page=N&start=jzpz_list&...`），
   * 实测答案侧为「第1页/共7页，共103行/每页15行」→ 单页 15 条，翻 7 页得 103 条。
   * 所以这里按 `第N页/共M页` 判终止，不靠「本页空即结束」。
   *
   * @param {string} listAction  列表 action（答案 zhsx_common / 学生 zhsx_common）
   * @param {string} sxid        答案恒 '0'，学生为真实 SXID
   * @param {Function} onProgress
   * @param {Map} auditSink      可选：把每页解析出的「凭证号 → 审核状态」并进去
   */
  async function fetchVoucherEntries(listAction, sxid, entityID, onProgress, auditSink) {
    const base = appBase();
    const pageUrl = (page) => `${base}do?page=${page}&start=jzpz_list&action=${listAction}`
      + `&SXID=${sxid}&QueryOnly=1&readyOnly=1&entityID=${entityID}`;

    // 取回并解析一页。解析出 0 条 = 列表到底了。
    const grab = async (page) => {
      const html = await httpGet(pageUrl(page));
      const pageEntries = parseVoucherLinks(html);
      if (auditSink) {
        // 审核状态只在列表页有（详情页的「审核:」是签章栏），顺带在翻页时收齐
        for (const [k, v] of parseAuditStatus(html)) auditSink.set(k, v);
      }
      const pm = html.replace(/&nbsp;/g, ' ').match(/第\s*(\d+)\s*页\s*\/\s*共\s*(\d+)\s*页/);
      return { page, pageEntries, totalPages: pm ? Number(pm[2]) : null, error: null };
    };
    // 单页失败不拖垮整轮：失败页按「空页」处理，由下面的顺序扫描决定是否截断。
    const grabSafe = async (page) => {
      try { return await grab(page); } catch (e) {
        return { page, pageEntries: [], totalPages: null, error: e };
      }
    };

    // 第 1 页必须先单独取：它就是「共几页」这个终止条件的来源，并行无从谈起。
    let first;
    try { first = await grab(1); } catch (e) {
      onProgress?.(`列表第 1 页取回失败：${e.message}`);
      return [];
    }

    // 其余页并行取（readConcurrency 路）。终止判据仍是列表页自己声明的
    // 「第 N 页 / 共 M 页」与「本页 0 条」—— 页面比串行时更早取回不影响判据本身，
    // 只影响日志出现的时刻，故下面统一按页号顺序回放日志与截断。
    const results = [first];
    if (first.pageEntries.length) {
      const limit = first.totalPages != null ? Math.min(60, first.totalPages) : 60;
      // 分块推进而不一次性发满：没有分页指针时上限 60 页，一次性发出去等于凭空多几十个请求，
      // 而串行版在第一个空页就停了。按 readConcurrency 一档一档走，最多多取 readConcurrency-1 页。
      for (let p = 2; p <= limit; p += CONFIG.readConcurrency) {
        const chunk = [];
        for (let q = p; q <= Math.min(limit, p + CONFIG.readConcurrency - 1); q++) chunk.push(q);
        const got = await poolMap(chunk, CONFIG.readConcurrency, grabSafe, shouldStop);
        let stopAfter = false;
        // 按索引读，不用 collectPool：这个循环要靠「洞」本身判是否被停止
        // （洞 = 该页没派发出去），而 collectPool 会把洞滤掉、正好丢掉这个信号。
        // `grabSafe` 自带 catch，所以 `{__error}` 在当前实现下不可达；仍显式处理，
        // 免得日后有人去掉那层保护就静默退化。
        for (let gi = 0; gi < got.length; gi++) {
          if (!(gi in got)) { stopAfter = true; break; }        // 未开工（被停止），收工
          const g = got[gi];
          if (g === null) { stopAfter = true; break; }
          if (g && g.__error) {
            results.push({ page: chunk[gi], pageEntries: [], totalPages: null, error: g.__error });
            stopAfter = true;
            break;
          }
          results.push(g);
          if (g.error || !g.pageEntries.length) stopAfter = true;
        }
        if (stopAfter) break;
      }
    }

    // 按页号顺序回放：日志与截断行为与串行版逐页一致；跳号（停止）即到此为止。
    const entries = [];
    let expected = 1;
    for (const g of results) {
      if (g.page !== expected) break;
      expected += 1;
      if (g.error) { onProgress?.(`列表第 ${g.page} 页取回失败：${g.error.message}`); break; }
      onProgress?.(`列表第 ${g.page} 页：${g.pageEntries.length} 张`);
      if (!g.pageEntries.length) break;
      entries.push(...g.pageEntries);
    }

    // 去重（按 accountrecordid）
    const seen = new Set();
    const uniq = [];
    for (const e of entries) {
      const id = e.url.match(/accountrecordid=([A-F0-9]+)/i)?.[1];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      uniq.push(e);
    }
    return uniq;
  }

  /**
   * 逐张抓取凭证详情（含跨页）。
   *
   * @param {string} detailAction  详情 action：答案 zhsx_common_jzpz / 学生 zhsx_common
   * @param {boolean} renumberAsAnswer
   *        true  = 凭证号按答案连续号重编为 记1..记N（答案取数用）
   *        false = 保留列表页里的真实凭证字号（学生取数用，锁三要拿它报编号错位）
   */
  async function fetchVoucherBodies(entries, detailAction, onProgress, shouldStop, renumberAsAnswer = true) {
    const base = appBase();
    let done = 0;
    // 每张凭证内部严格串行：详情跨页（current_page）是同一凭证的续页，必须按页序拼行，
    // 且 first.pageCount 决定后面还有几页 —— 下一页要先知道上一页的读数。
    // 凭证之间没有共享状态（各自只要自己那份 HTML），所以凭证级可以并行。
    // 结果按 entries 顺序返回，凭证字号 `记${i+1}` 才不会错位。
    const vouchers = await poolMap(entries, CONFIG.readConcurrency, async (item, i) => {
      // 详情 action 按来源改写（答案 zhsx_common_jzpz / 学生 zhsx_common）
      const detailUrl = item.url.replace(/action=[^&]*/, `action=${detailAction}`);
      let first;
      try {
        first = parseVoucherHtml(await httpGet(new URL(toInnerUrl(detailUrl), base).href));
      } catch (e) {
        log(`跳过 ${item.label}：${e.message}`);
        return null;
      }
      if (!first) { log(`跳过 ${item.label}：解析为空`); return null; }

      const allLines = [...first.lines];
      for (let pg = 2; pg <= first.pageCount; pg++) {
        try {
          const more = parseVoucherHtml(await httpGet(new URL(toInnerUrlPage(detailUrl, pg), base).href));
          if (!more) break;
          allLines.push(...more.lines);
        } catch { break; }
      }

      // 答案侧：label 以连续号为准（记1..记103），不用列表页文本 ——
      // 学生凭证缺号（缺 62，记63 起后移）会污染「凭证号列」，而该列必须填答案口径的字号。
      // 学生侧：保留真实 label，锁三才能报出「编号与答案序号存在错位」。
      const label = renumberAsAnswer ? `记${i + 1}` : item.label;
      done += 1;
      onProgress?.(`凭证 ${done}/${entries.length}`);
      return { label, listLabel: item.label, ...first, lines: allLines };
    }, shouldStop);

    // 用 collectPool 读：未开工位置是稀疏洞、解析失败位置是 null、lane 层异常是 {__error}，
    // 三种都不该混进凭证数组（否则会得到一个没有 lines 的假凭证，aggregate 直接崩）。
    const collected = collectPool(vouchers);
    for (const f of collected.failed) log(`凭证抓取异常：${f.error.message}`);
    return collected.items;
  }

  /**
   * 抓取「官方答案」凭证 —— v2 的主数据源。
   *
   * 入口：do?action=zhsx_common&start=jzpz_list&SXID=0&entityID=<ENTITY>&QueryOnly=1&readyOnly=1
   * SXID 恒为 0（与账号无关），详情 action 走 zhsx_common_jzpz。
   *
   * 缓存优先（ADR-0004）：命中直接返回、一个请求都不发，且不打印任何与缓存相关的日志。
   * 只有真正联网抓到非空数据时才回写缓存 —— 抓取失败或会话过期（空列表）不覆盖已有数据。
   */
  async function fetchAnswerVouchers(ctx, onProgress, shouldStop, auditSink) {
    const cached = cacheGet(CACHE.teacher);
    if (isUsableVouchers(cached)) return cached;

    const entries = await fetchVoucherEntries(P.answerList, ANSWER_SXID, ctx.entityID, onProgress, auditSink);
    log(`答案入口共 ${entries.length} 张凭证`);
    const vouchers = await fetchVoucherBodies(entries, P.answerDetail, onProgress, shouldStop, true);
    if (isUsableVouchers(vouchers)) {
      cacheSet(CACHE.teacher, vouchers);
      cacheSet(CACHE.teacherMeta, { entityID: String(ctx.entityID), savedAt: Date.now() });
    }
    return vouchers;
  }

  /**
   * 抓取「学生已录」凭证 —— 供写入与锁三比对。
   *
   * 缓存优先，并按学生隔离（见 `getStudentKey`）：键 = `CACHE.studentPrefix + 隔离键`。
   * 该键带学生后缀、无法枚举，故落盘时同时把键名追加进索引键，删除时按索引逐个清。
   * 同样只在抓到非空数据时回写，抓取失败 / 会话过期不覆盖已有数据。
   */
  async function fetchStudentVouchers(ctx, onProgress, shouldStop, auditSink) {
    const ck = CACHE.studentPrefix + getStudentKey(ctx).key;
    const cached = cacheGet(ck);
    if (isUsableVouchers(cached)) return cached;

    if (!ctx.sxid) return null;
    const entries = await fetchVoucherEntries(P.studentList, ctx.sxid, ctx.entityID, onProgress, auditSink);
    if (!entries.length) return null;
    log(`学生入口共 ${entries.length} 张凭证`);
    // 学生侧保留真实凭证字号（缺号/错位要在锁三里看得见）
    const vouchers = await fetchVoucherBodies(entries, P.studentDetail, onProgress, shouldStop, false);
    if (isUsableVouchers(vouchers)) {
      cacheSet(ck, vouchers);
      const idxKey = CACHE.studentPrefix + '_index';
      const idx = new Set(Array.isArray(cacheGet(idxKey)) ? cacheGet(idxKey) : []);
      idx.add(ck);
      cacheSet(idxKey, [...idx]);
    }
    return vouchers;
  }

  // ======================= 第二步：归集 =======================

  function aggregate(vouchers) {
    const toFen = (y) => Math.round(Number(y) * 100);
    const toYuan = (f) => Number((f / 100).toFixed(2));
    const acc = new Map();

    for (const v of vouchers) {
      for (const l of v.lines) {
        if (!l.accountCode) continue;
        const d = toFen(l.debit);
        const c = toFen(l.lend);
        if (d === 0 && c === 0) continue;
        if (!acc.has(l.accountCode)) {
          acc.set(l.accountCode, { code: l.accountCode, name: l.accountName || '', entries: [], dFen: 0, cFen: 0 });
        }
        const a = acc.get(l.accountCode);
        if (!a.name && l.accountName) a.name = l.accountName;
        a.dFen += d;
        a.cFen += c;
        a.entries.push({
          voucherLabel: v.label,
          summary: l.summary || '',
          debit: toYuan(d),
          lend: toYuan(c),
        });
      }
    }
    return [...acc.values()]
      .sort((x, y) => x.code.localeCompare(y.code))
      .map((a) => ({
        code: a.code, name: a.name,
        debitTotal: toYuan(a.dFen), lendTotal: toYuan(a.cFen),
        entryCount: a.entries.length,
        entries: a.entries,
      }));
  }

  // ======================= 第三步：三重锁 =======================

  /**
   * 一张凭证的「内容指纹」：把每行归一化成 科目码|明细码|借(分)|贷(分)，
   * 排序后拼接。排序是为了抹掉行序差异——实测答案与学生版行序不同，内容一致。
   */
  function voucherFingerprint(v) {
    return v.lines
      .map((l) => [
        l.accountCode || '',
        l.accountDetail || '',
        Math.round(Number(l.debit) * 100),
        Math.round(Number(l.lend) * 100),
      ].join('|'))
      .sort()
      .join(';');
  }

  /**
   * 多重集差异：返回 `bagVouchers` 中未能被 `refVouchers` 一一抵消的凭证 label。
   * 用多重集而非集合，因为可能有两张内容完全相同的凭证，集合会漏判数量差。
   */
  function fingerprintDiff(refVouchers, bagVouchers) {
    const bag = new Map();
    for (const v of refVouchers) {
      const k = voucherFingerprint(v);
      bag.set(k, (bag.get(k) || 0) + 1);
    }
    const unmatched = [];
    for (const v of bagVouchers) {
      const k = voucherFingerprint(v);
      const n = bag.get(k) || 0;
      if (n <= 0) unmatched.push(v.label);
      else bag.set(k, n - 1);
    }
    let refLeftover = 0;
    for (const n of bag.values()) if (n > 0) refLeftover += n;
    return { unmatched, refLeftover };
  }

  /**
   * 三重锁。
   *
   * - 锁一：逐张凭证借贷平衡（就地复算）
   * - 锁二：归集双向闭合（原始分录累加 vs 按科目归集累加，两条独立路径同一个数）
   * - 锁三：答案 vs 学生凭证比对（v2 新定义）
   *
   * 为什么要换掉原锁三：原锁三是 `aD === aC`（全部科目借合计 = 贷合计），
   * 而锁二的判据 `vD===vC && aD===aC && vD===aD && vC===aC` 已经蕴含 `aD===aC`。
   * 即 `l2ok ⇒ l3ok`，原锁三是锁二的逻辑子集，零增量信息。
   * 真正有分辨力的第三把锁必须是独立数据源：拿平台官方答案与学生自己录的凭证对撞，
   * 能抓到「本地解析层自己错了」这类三锁一/二都抓不到的问题。
   *
   * 注意：锁三不一致只提示、不阻断（v2 决策 5）——答案是参照物，不是权威判据，
   * 学生凭证本就允许与答案不同（比如客户改过业务数据），一票否决会误伤。
   */
  function tripleLock(vouchers, taccounts, studentVouchers) {
    const toFen = (y) => Math.round(Number(y) * 100);
    const issues = [];

    // 锁一：逐张凭证借贷平衡
    let l1bad = 0;
    for (const v of vouchers) {
      const d = v.lines.reduce((s, l) => s + toFen(l.debit), 0);
      const c = v.lines.reduce((s, l) => s + toFen(l.lend), 0);
      if (d !== c) { l1bad++; issues.push(`${v.label} 借贷不平：借 ${d / 100} 贷 ${c / 100}`); }
    }

    // 锁二：归集双向闭合
    const vD = vouchers.reduce((s, v) => s + v.lines.reduce((t, l) => t + toFen(l.debit), 0), 0);
    const vC = vouchers.reduce((s, v) => s + v.lines.reduce((t, l) => t + toFen(l.lend), 0), 0);
    const aD = taccounts.reduce((s, a) => s + toFen(a.debitTotal), 0);
    const aC = taccounts.reduce((s, a) => s + toFen(a.lendTotal), 0);
    const l2ok = vD === vC && aD === aC && vD === aD && vC === aC;
    if (!l2ok) issues.push(`归集不闭合：凭证 ${vD / 100}/${vC / 100}，科目 ${aD / 100}/${aC / 100}`);

    // 锁三：答案 vs 学生凭证比对（独立数据源，与锁一/二无蕴含关系）
    let l3ok = false;
    let l3note = '';
    if (!studentVouchers || !studentVouchers.length) {
      l3note = '学生凭证不可用（未取到 SXID 或抓取失败），本锁未执行';
      issues.push(`锁三未执行：${l3note}（不阻断）`);
    } else if (studentVouchers.length !== vouchers.length) {
      const d = fingerprintDiff(vouchers, studentVouchers);
      l3ok = false;
      l3note = `张数不同：答案 ${vouchers.length} 张 / 学生 ${studentVouchers.length} 张`;
      if (d.unmatched.length) l3note += `；学生独有 ${d.unmatched.slice(0, 5).join(', ')}${d.unmatched.length > 5 ? ' …' : ''}`;
      if (d.refLeftover) l3note += `；答案独有 ${d.refLeftover} 张`;
      issues.push(`锁三不一致：${l3note}`);
    } else {
      const d = fingerprintDiff(vouchers, studentVouchers);
      l3ok = d.unmatched.length === 0 && d.refLeftover === 0;
      // 编号错位是已知且良性的（实测：学生缺 62 号，记63 起整体后移，末尾多一个记104）。
      // 内容指纹已抹平行序，编号不参与指纹；这里只把「有错位」这件事说出来，不当差异判。
      const sameLabels = vouchers.map((v) => v.label).join(',') === studentVouchers.map((v) => v.label).join(',');
      if (l3ok) {
        l3note = `答案与学生逐笔一致（${vouchers.length} 张，按行序归一化后比对）`
          + (sameLabels ? '' : '；编号与答案序号存在错位，脚本以答案连续号为准');
      } else {
        l3note = `学生侧 ${d.unmatched.length} 张内容不在答案中`;
        if (d.refLeftover) l3note += `，答案侧 ${d.refLeftover} 张未被学生覆盖`;
        if (d.unmatched.length) l3note += `：${d.unmatched.slice(0, 5).join(', ')}${d.unmatched.length > 5 ? ' …' : ''}`;
        issues.push(`锁三不一致：${l3note}`);
      }
    }

    return {
      l1ok: l1bad === 0, l2ok, l3ok, l3note, issues,
      totalDebit: vD / 100, totalLend: vC / 100,
    };
  }

  // ======================= 第四步：回填（HTTP 化） =======================

  /**
   * 解析 T 型账响应 HTML → 结构化状态。
   *
   * 为什么必须从响应文本解析，而不是读 `MainWin.document`（本轮最容易漏的一处）：
   *   面板宿主 = 回填目标 = 脚本自身 realm。`insert` 提交后服务端会重渲染该框架，
   *   等价于一次自我销毁。故读状态也必须走 GM_xhr GET + DOMParser，全程不碰活 DOM。
   *
   * 必须限定在 `v_dto6` 表单内查询（真机实测，本机 probe-domparse-txz.mjs）：
   *   页面上有两个表单，`formSearch` 里也有一个 `name="start"`。
   *   文档级 `[name="start"]` 命中 2 个（`['query','query']`），表单级命中 1 个。
   *   构造 POST body 时取错那个会把 `start` 语义写坏。
   *   另一处反直觉：`v_dto6` 在 DOMParser 下存活（childElementCount=8），
   *   与凭证详情页 `v_dto3` 被 HTML 解析器剥离成空壳的情况不同 —— 故这里可以用表单级查询；
   *   仍保留文档级兜底，但兜底路径下有唯一性断言（见下）。
   *
   * 只认无 `_i` 后缀的字段作为已存行：`pzh_bz_i/debit_i/lend_i` 是页面模板自带的空行，
   * 认它会多算一行（`webvpn-write-path-report.md` §三-quater 已实测）。
   */
  function parseTState(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    let form = (doc.forms && doc.forms.v_dto6) || null;
    if (!form) {
      // 兜底：解析器把表单剥离时（凭证详情页 v_dto3 就是这种），退化为文档级 +
      // 唯一性校验，避免 `start` 撞上 formSearch。
      const starts = [...doc.querySelectorAll('[name="start"]')];
      if (starts.length !== 1) return null;   // 有歧义就不猜，宁可显式失败
      form = doc;
    }
    const inputs = [...form.querySelectorAll('input')];

    const hidden = {};
    for (const el of inputs) {
      const n = el.name;
      if (n === 'sxid' || n === 'accountID' || n === 'yyyy' || n === 'mm' || n === 'entityid') {
        if (!(n in hidden)) hidden[n] = el.value;
      }
    }

    // 按文档序把每个 input 归到行上。平台每行的字段序固定为
    //   pzh_bz → debit → lend → CHECK_CONFIRM → TEMPid
    // （真机响应原文见 evidence/txz-1001-2026-10-03.html）。
    const rows = [];
    const pending = { pzh: '', debit: '', lend: '' };
    let cur = null;
    for (const el of inputs) {
      const n = el.name;
      if (n === 'pzh_bz') {
        if (cur) rows.push(cur);
        cur = { pzh: el.value, debit: '', lend: '', tempid: '', checked: el.checked };
      } else if (n === 'debit' && cur) cur.debit = el.value;
      else if (n === 'lend' && cur) cur.lend = el.value;
      else if (n === 'TEMPid' && cur) cur.tempid = el.value;
      else if (n === 'CHECK_CONFIRM' && cur) cur.checked = true;
      else if (n === 'pzh_bz_i') pending.pzh = el.value;
      else if (n === 'debit_i') pending.debit = el.value;
      else if (n === 'lend_i') pending.lend = el.value;
    }
    if (cur) rows.push(cur);

    let total = { debit: '', lend: '' };
    for (const tr of doc.querySelectorAll('tr')) {
      const tds = [...tr.cells];
      if (tds.length && (tds[0].textContent || '').includes('本期发生额')) {
        total = { debit: (tds[1]?.textContent || '').trim(), lend: (tds[2]?.textContent || '').trim() };
        break;
      }
    }

    return { accountID: hidden.accountID || null, hidden, rows, total, pending };
  }

  /**
   * 构造整页提交的请求体。
   *
   * 三种 `start` 的形态差异（逐字依据：`webvpn-write-path-report.md` §三-ter 的请求体全文）：
   *
   * - `insert`（逐行新增）：隐藏字段 + 当前全部已存行的三元组与 `TEMPid` + 本次 `_i` 值。
   *   `CHECK_CONFIRM` 一个都不带；`update_loop`/`delete_loop` 尾部才追加空的 `_i` 三连。
   *   为什么可以不带：脚本走的是原生 `form.submit()`，绕过 `onclick` 里的 `hasOneChecked` 门禁
   *   （§三-bis 的按钮源码已实证）。
   *   ⚠ `insert` 这一个取值在 WebVPN 上从未直接发过（§四.1）—— 首次真发时抓包比对。
   *
   * - `update_loop` / `delete_loop`：与上面同构，区别是
   *   ① `start` 值不同；② 全部行的 `CHECK_CONFIRM` 都带上；③ 尾部追加空的 `_i` 三连。
   *
   * ⚠ 关于「全部行都带 `CHECK_CONFIRM`」：平台门禁（`hasOneChecked`）只要求至少一个
   *   checkbox 被勾选，但整页提交按表单字段全集处理 ⇒ 只带一个会因字段缺失产生不确定行为。
   *   故「构造全部行」是为清空/改写全部行而做的选择，不是平台硬要求，别当成不可省的字段。
   */
  function buildBody(state, startVal, opt = {}) {
    const p = new URLSearchParams();
    const h = state.hidden;
    p.append('sxid', h.sxid ?? '');
    p.append('accountID', h.accountID ?? '');
    p.append('yyyy', h.yyyy ?? '');
    p.append('mm', h.mm ?? '');
    p.append('entityid', h.entityid ?? '');
    p.append('start', startVal);

    for (const r of state.rows) {
      p.append('pzh_bz', r.pzh ?? '');
      p.append('debit', r.debit ?? '');
      p.append('lend', r.lend ?? '');
      if (startVal !== 'insert') p.append('CHECK_CONFIRM', r.tempid ?? '');
      p.append('TEMPid', r.tempid ?? '');
    }

    if (startVal === 'insert') {
      // 本次要新增的那一行，走 `_i` 三字段
      p.append('pzh_bz_i', opt.pzh ?? '');
      p.append('debit_i', opt.debit ?? '');
      p.append('lend_i', opt.lend ?? '');
    } else {
      p.append('pzh_bz_i', '');
      p.append('debit_i', '');
      p.append('lend_i', '');
    }
    return p.toString();
  }

  /**
   * 从 T 型账页 HTML 里解析出全部总账科目清单。
   *
   * 为什么需要它（「清空 T 型账」的作用域来源）：
   *   写入路径的科目清单来自「按凭证归集」的结果（实测 45 个），但清空是重置动作，
   *   必须在「凭证取不到 / 凭证本身是错的」时也能把平台清干净。故清空的作用域不能依赖归集，
   *   只能来自平台自身的科目下拉。
   *
   * 实测（`.scratch/voucher2t-taccount/evidence/txz-1001-2026-10-03.html`）：
   *   `<select name="accountID">` 共 155 个 `<option>`，全部是一级总账科目，
   *   无 `<optgroup>`、无空值占位项，形态 `value="1001"` + 文本 `1001                -库存现金`
   *   （即 `科目码` + 若干空格 + `-` + `科目名`）。
   *
   * ⚠ 该 `<select>` 在 SQL 查询表单 `formSearch` 里，不在 `v_dto6` 里，
   *   所以不能复用 parseTState 的表单级查询。页面上另有 `name="yyyy"` / `name="mm"` 两个
   *   单值 select，用 `name="accountID"` 精确锚定即可，不会撞上。
   *
   * ⚠ 实测 `probe/dump-txz-queried.html`（查询结果页）同样带完整 155 项 ⇒ 可以从
   *   任意一次 T 型账查询的响应里顺带取清单，不必额外发请求。
   *
   * @returns {{code: string, name: string}[]} 解析失败返回空数组
   */
  function parseAccountList(html) {
    let doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); } catch { return []; }
    const sel = doc.querySelector('select[name="accountID"]');
    if (!sel) return [];
    const out = [];
    const seen = new Set();
    for (const opt of sel.querySelectorAll('option')) {
      const code = (opt.value || '').trim();
      if (!/^\d{4}$/.test(code) || seen.has(code)) continue;
      // 文本形态 `1001                -库存现金` → 取 `-` 之后的部分为科目名
      const raw = (opt.textContent || '').replace(/[\s\u00a0]+/g, ' ').trim();
      const name = (raw.match(/-\s*(.+)$/)?.[1] || raw.replace(/^\d+\s*/, '')).trim();
      seen.add(code);
      out.push({ code, name });
    }
    return out;
  }

  /**
   * 取全部总账科目清单。向平台发一次 T 型账查询（只读），从响应里解析。
   *
   * @param {object} ctx  getContext() 的返回值
   */
  async function fetchAccountList(ctx, year, month) {
    const base = appBase();
    // 用 1001 作探针科目：总账科目表是平台固定的，1001 必然存在。
    // 该请求只读、无副作用；响应里带着完整 155 项下拉，正是我们需要的。
    const url = `${base}do?action=${P.tAccount}&start=query&accountID=1001`
      + `&yyyy=${year}&mm=${month}&sxid=${ctx.sxid}&entityid=${ctx.entityID}`;
    // ★ 重试（round10 新发现）：平台会偶发返回一种「降级页」——同一 URL、同一科目，
    // 有时是 155 个 option 的正常页，有时是科目下拉为空（0 个 option）、
    // 连 onchange 都是空函数的页面（真机 fixture 实测：7597 字节 vs 17257 字节）。
    // 吃到降级页时 parseAccountList 返回 []，会让整轮清空/写入直接中止（一个字都不动）。
    // 这类降级多半是瞬时的，故重试 1 次即可；仍为空则如实报错，不猜。
    let list = [];
    let lastLen = 0;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const html = await httpGet(url);
      list = parseAccountList(html);
      if (list.length) return list;
      lastLen = html.length;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 800));
    }
    // 把响应长度一起带回，供调用方区分「平台真没科目」与「拿到降级页」
    list.failedResponseLen = lastLen;
    return list;
  }

  /** GET 一个科目的 T 型账查询页并解析成状态。不导航任何 DOM。 */
  async function queryTState(ctx, code, year, month) {
    const base = appBase();
    const url = `${base}do?action=${P.tAccount}&start=query&accountID=${code}`
      + `&yyyy=${year}&mm=${month}&sxid=${ctx.sxid}&entityid=${ctx.entityID}`;
    const html = await httpGet(url);
    const st = parseTState(html);
    if (!st) return { state: null, html, url };
    return { state: st, html, url };
  }

  /** 提交一次整页 POST，返回响应 HTML 文本。 */
  async function submitForm(state, startVal, opt) {
    const base = appBase();
    const url = `${base}do?action=${P.tAccount}`;
    const body = buildBody(state, startVal, opt);
    const html = await httpPost(url, body);
    return { html, body, url };
  }

  const normAmt = (s) => {
    const t = String(s ?? '').replace(/[,\s\u00a0￥¥]/g, '');
    if (!t) return '';
    const n = Number(t);
    return Number.isFinite(n) ? n.toFixed(2) : t;
  };

  /**
   * T 型账响应完整性判定（D-15）。
   *
   * 为什么必须有它：`parseTState` 对**残缺页**与**合法空态页**返回同样的 `rows = []`，
   * 而 `clearAccount` 只能看到行数 ⇒ 把残缺当「平台 0 行，无需清空」⇒ **一行都没删**
   * 却打印得一切正常（假成功）。某科目原本只有 1 行、响应在最后一个 `pzh_bz` 之前
   * 被截断，就是这条路径。
   *
   * ★ 判据按「行集是否已解析出内容」分两区，两区的严格度不同 —— 这个分野是真机日志逼出来的：
   *
   * 【危险区：rows = 0】无法从行集本身区分「真 0 行」与「截断成 0 行」，故必须用旁证：
   *   a. 必须有 `_i` 三连模板行（真机 49/49 恒有，空态也有）。
   *   b. 必须有「本期发生额」合计行 —— 没有它就无法证明这是空账，宁可疑。
   *   c. 合计两边都必须为空（真机空态页的合计 td 就是空的）。
   *   任一不满足 ⇒ 判残缺 ⇒ 重取，而不是当成「0 行，无需清空」。
   *
   * 【安全区：rows > 0】行集本身已经解析出行了 —— 有行就能删，不存在「假成功」。
   *   此时合计只用来**发现丢行**，故单边容忍：
   *   a. 合计哪一边非空，就拿那一边与行金额和比对；不符 ⇒ 判残缺（丢行）。
   *   b. 合计两边都为空 ⇒ **容忍**，不报错。
   *   ⚠ 为什么必须容忍（真机抓包实测，形态以抓包为准）：真机 8 科目（1101/1231/1701/1702/
   *     2201/2203/2801/6401）的「本期发生额」是**单边空** —— 1231/1701/2203 只有借方有值
   *     （11700.00 / 145000.00 / 10000.00，贷方 td 为空）、2801 只有贷方（69592.00，借方为空），
   *     且非空那一边与行金额和**完全相符**。独立复算：44 份真机 query 夹具中 7 份是这种单边形态
   *     （两个方向都有）。
   *     早先版本写成「任一边为空即残缺」，把这些正常科目全拦成失败、一行没删 —— 误报。
   *
   * ⚠ 已知盲区（诚实记录，不掩盖）：若某科目**合计本来就为空**，而响应又恰好被截断成
   *   0 行，则本条判据无法与「真空账」区分。缓解：`_i` 模板行与 `</html>` 两条锚点仍在，
   *   且这类科目在真机上通常行数很少、损失可察。
   *
   * 离线复跑：`.scratch/voucher2t-taccount/verify/round10/d15/false-success-loop.mjs`
   * 真机样本误报率复算：`.../d15/verify-completeness-on-live.mjs`
   *
   * @returns {{ok: boolean, reasons: string[]}}
   */
  function tStateIntegrity(state, html) {
    const reasons = [];
    const raw = String(html ?? '');
    if (!/<\/html>\s*$/i.test(raw)) reasons.push('响应未以 </html> 结尾');
    if (!state) {
      reasons.push('未能解析出 T 型账表单');
      return { ok: false, reasons };
    }
    const td = normAmt(state.total.debit);
    const tl = normAmt(state.total.lend);

    if (state.rows.length === 0) {
      // 危险区：只能靠旁证证明「这确实是一张空账」
      if (!/name=["'](?:pzh_bz_i|debit_i|lend_i)["']/.test(raw)) reasons.push('缺少 _i 模板行');
      if (!raw.includes('本期发生额')) reasons.push('缺少「本期发生额」合计行（无法证明是空账）');
      // ★ 平台偶发返回「降级页」：同一 URL、连科目下拉都是空的（真机实测 7743 字节、
      //   0 个 <option>，正常页 157 个）。这种页**不是**该科目的真实状态 ——
      //   它的 rows=0 不能当作「平台 0 行」。没有这条判据，降级页会被读成合法空账 ⇒
      //   打印「无需清空」而一行不删，即 D-15 的另一种假成功形态（独立 review 的 S2）。
      if (!/<option\b/i.test(raw)) reasons.push('缺少总账科目下拉项（平台降级页，不是该科目的真实状态）');
      if (td !== '' || tl !== '') {
        reasons.push(`解析出 0 行，但合计非空（借 ${state.total.debit || '-'} / 贷 ${state.total.lend || '-'}）`
          + ' ⇒ 页面残缺被误认成空账');
      }
    } else if (td !== '' || tl !== '') {
      // 安全区：行集已解析出来，合计仅用于发现丢行 —— 哪边有值比哪边（单边容忍）
      const sd = state.rows.reduce((s, r) => s + (Number(normAmt(r.debit)) || 0), 0);
      const sl = state.rows.reduce((s, r) => s + (Number(normAmt(r.lend)) || 0), 0);
      if (td !== '' && Math.abs(sd - Number(td)) > 0.005) {
        reasons.push(`${state.rows.length} 行借方金额和 ${sd.toFixed(2)} 与合计 ${state.total.debit} 不符 ⇒ 响应丢行`);
      }
      if (tl !== '' && Math.abs(sl - Number(tl)) > 0.005) {
        reasons.push(`${state.rows.length} 行贷方金额和 ${sl.toFixed(2)} 与合计 ${state.total.lend} 不符 ⇒ 响应丢行`);
      }
    }
    return { ok: reasons.length === 0, reasons };
  }

  /**
   * 等 T 型账已保存行数达到 target —— 等待判据仍是「行数增长」（README 排除项之一，
   * 原实现读 DOM 行数；HTTP 化后改为反复 GET 并由响应解析出行数，判据语义不变）。
   *
   * 保留这个判据而不改成「以 POST 返回 200 为成功」的理由：平台的整页提交返回的仍是
   * 业务页而非状态码语义，200 不能证明行真的落库了。
   */
  async function waitSavedCount(ctx, code, year, month, target, timeoutMs = 25000) {
    const t0 = Date.now();
    while (Date.now() - t0 <= timeoutMs) {
      try {
        // ★ 必须走 queryTStateChecked：这里同样要确认读到的就是目标科目。
        // 并发下读侧可能落到别的科目（真机 6411 实测「科目未切换」），读到别的科目会让
        // 「行数增长」这个判据被别的科目的行数满足（round10 定案；机制是「并发下读侧响应
        // 行集残缺」，不是「服务端会话持当前科目」——后者已被离线 harness 证伪，命中 0/10）。
        const q = await queryTStateChecked(ctx, code, year, month);
        const st = q.state;
        if (st && st.rows.length === target) return st;
      } catch { /* 单次失败不算判据失败，继续轮询 */ }
      await new Promise((r) => setTimeout(r, 250));
    }
    return null;
  }

  /**
   * D3 幂等判据：只比「凭证号前缀 + 金额 + 借/贷方向」，不比摘要。
   *
   * 为什么必须宽松（这不是理论风险，是已实测的冲突）：
   *   平台 1001 存量备注形如 `记3 提取备用金`（§三-bis 原文），而 D4 后计划是纯字号 `记3`。
   *   旧判据是 `pzh` 全等（`r.pzh === plan[i].pzh`）⇒ 必然判 `stale` 并整科目跳过，
   *   表现为「跑通了但一行没写」。放宽到前缀比较后，带摘要的存量数据不再被误判。
   *
   * 方向判据：借/贷至少一边非零，非零那一边必须对得上；两边都为空则视为无金额行。
   */
  function rowMatchesPlan(row, plan) {
    const pzhPrefix = String(plan.pzh || '').trim();
    const got = String(row.pzh || '').trim();
    if (got !== pzhPrefix && !got.startsWith(pzhPrefix + ' ')) return false;
    const d = normAmt(plan.debit), c = normAmt(plan.lend);
    const rd = normAmt(row.debit), rc = normAmt(row.lend);
    return rd === d && rc === c;
  }

  /**
   * 回填一个科目。全程 HTTP，零 DOM 导航。
   *
   * 流程（沿用验收口径 §四的步骤编号；原 ② delete_loop 清空与 ③ 空态复核两档已按 ADR-0004
   * 移出本函数 —— 要清空请走面板的「清空 T 型账」入口，它整轮扫全部总账科目）：
   *   ① GET 落基线快照（同时就是幂等判据的输入）→ ④ insert 逐行写
   *   → ⑤ update_loop 整体提交 → ⑥ 重新 GET 读回对账
   * 注意 ⑥：不在 POST 残留页上读合计格。
   *
   * `cfg` 只剩 `throttleMs`（ADR-0004 已取消「只读预览」与「先清空再重写」两档）。
   * 本函数不做任何清空动作，也没有任何缓存相关逻辑。
   */
  async function fillAccount(ctx, acc, year, month, cfg, logFn, shouldStop) {
    if (shouldStop?.()) return { code: acc.code, action: 'stopped' };

    // ★ 走 queryTStateChecked：这里同样必须确认读到的就是目标科目。
    const q = await queryTStateChecked(ctx, acc.code, year, month);
    if (!q.state) {
      // 旧实现此处静默略过，且不进面板汇总统计 ⇒ 可能被误读成「全部成功」。
      // 改为显式失败并计入汇总。
      logFn(`❌ ${acc.code} ${acc.name}：GET 后拿不到本科目状态`
        + (q.mismatch ? `（读到 accountID=${q.mismatch}，未切到目标科目）` : '（无法解析出 T 型账表单）')
        + (q.incomplete ? `（响应残缺：${q.incomplete.join('；')}）` : '')
        + ' —— 显式失败，不写（旧实现此处静默跳过）', 'bad');
      return { code: acc.code, name: acc.name, action: 'error', reason: q.mismatch ? '科目未切换' : '表单解析失败' };
    }

    let state = q.state;
    logFn(`   基线：${state.rows.length} 行，合计 ${state.total.debit || '-'}/${state.total.lend || '-'}`);

    // 凭证号列只填凭证字号（形态 `记1`），不带摘要（D4）。
    const plan = acc.entries.map((e) => ({
      pzh: e.voucherLabel,
      debit: e.debit ? e.debit.toFixed(2) : '',
      lend: e.lend ? e.lend.toFixed(2) : '',
    }));

    // ---------- 幂等判据（D3，宽容口径）----------
    // 三分支：① 平台无行 → 写入；② 与计划逐行匹配 → 真幂等跳过；③ 有行但不匹配 → 不写只告警。
    // 为什么 ③ 不自动覆盖：平台无事务、无回滚。
    //
    // ⚠ 正常情况下 ③ 在本函数里已经不该发生：正式的冲突裁决在写入【之前】的写前普查里做
    //   （surveyAccounts + askConflictChoice），用户选「清掉」时冲突科目已被清成 0 行。
    //   保留这一分支是为了兜住「普查之后、本科目写入之前平台状态又变了」的窗口 ——
    //   此时宁可少写一个科目，也不能往不一致的存量数据上叠写。
    if (state.rows.length > 0) {
      const ident = state.rows.length === plan.length && state.rows.every((r, i) => rowMatchesPlan(r, plan[i]));
      if (ident) {
        logFn(`⏭ ${acc.code} ${acc.name}：平台已有 ${state.rows.length} 行且与计划逐行一致（D3 宽容口径：比凭证号前缀+金额+方向），跳过`);
        return { code: acc.code, name: acc.name, action: 'skipped', existing: state.rows.length };
      }
      logFn(`⚠ ${acc.code} ${acc.name}：平台有 ${state.rows.length} 行，但与计划（${plan.length} 行）不匹配`
        + '（普查之后平台状态又变了）。本轮跳过该科目以免写坏。', 'warn');
      return { code: acc.code, name: acc.name, action: 'stale', existing: state.rows.length, planned: plan.length };
    }

    // ---------- ④ insert 逐行写 ----------
    // 写前日志：科目号 + 科目名 + 计划行数（ADR-0004 的代价说明要求这就写）
    logFn(`   ✍ ${acc.code} ${acc.name}：平台 0 行 → 写入 ${plan.length} 行`
      + `（借 ${acc.debitTotal.toFixed(2)} / 贷 ${acc.lendTotal.toFixed(2)}）`);
    let written = 0;
    for (let i = 0; i < plan.length; i++) {
      // 逐行检查点：单科目内也可中断（判据6b）。throwIfStopped() 是 shouldStop() 的抛出封装，
      // 这里两者都留，便于静态判据识别。
      if (shouldStop()) throwIfStopped();
      const p = plan[i];
      let done = false;
      for (let attempt = 1; attempt <= 3 && !done; attempt++) {
        try {
          const r = await submitForm(state, 'insert', { pzh: p.pzh, debit: p.debit, lend: p.lend });
          const next = parseTState(r.html);
          if (next && next.rows.length === state.rows.length + 1) {
            state = next; written += 1; done = true;
          } else {
            // POST 响应没长出来 ⇒ 用「行数增长」判据再确认一次（不以 HTTP 200 判成功）
            const viaGet = await waitSavedCount(ctx, acc.code, year, month, state.rows.length + 1, 10000);
            if (viaGet) { state = viaGet; written += 1; done = true; }
            else {
              logFn(`   ⚠ 第 ${i + 1} 行第 ${attempt} 次：响应解析得 ${next ? next.rows.length : '?'} 行`
                + `（期望 ${state.rows.length + 1}），且 GET 复核未增行，重试`, 'warn');
            }
          }
        } catch (e) {
          logFn(`   ⚠ 第 ${i + 1} 行第 ${attempt} 次失败：${e.message}`, 'warn');
        }
        if (!done) await new Promise((res) => setTimeout(res, 400));
      }
      if (!done) {
        logFn(`❌ ${acc.code} 第 ${i + 1} 行写入失败，中止该科目`, 'bad');
        return { code: acc.code, name: acc.name, action: 'partial', written, planned: plan.length };
      }
      // 写一条、展一条：面板上一行对应一次真正落库，用户能看着它推进（不再整批攒到最后）。
      logFn(`   ✍ 第 ${written}/${plan.length} 行已落库：${p.pzh || '(无凭证号)'}`
        + ` 借 ${p.debit || '0.00'} 贷 ${p.lend || '0.00'} → 本科目平台 ${state.rows.length} 行`);
      if (cfg.throttleMs) await new Promise((res) => setTimeout(res, cfg.throttleMs));
    }

    // ---------- ③ update_loop 整体提交（带全部 CHECK_CONFIRM）----------
    throwIfStopped();
    await submitForm(state, 'update_loop');

    // ---------- ④ 重新 GET 读回对账 ----------
    // ★ 必须用 queryTStateChecked：读到的必须是目标科目本身。读侧一旦落到别的科目，
    // 这里就会把别的科目的行数与合计当成本科目的对账结果。
    const back = await queryTStateChecked(ctx, acc.code, year, month);
    const after = back.state;
    if (!after) {
      // 读不到 / 读错科目 ⇒ 不能报「0 行」也不能报「对账一致」，只能报结果未知。
      logFn(`❌ ${acc.code} ${acc.name}：写后复核读不到本科目`
        + (back.mismatch ? `（读到 accountID=${back.mismatch}）` : '（表单解析失败）')
        + (back.incomplete ? `（响应残缺：${back.incomplete.join('；')}）` : '')
        + ' —— 结果未知，请人工确认', 'bad');
      return { code: acc.code, name: acc.name, action: 'unread', reason: back.mismatch ? `accountID=${back.mismatch}` : '解析失败' };
    }
    const num = (s) => Number(String(s || '0').replace(/[,\s]/g, '')) || 0;
    const okRows = after.rows.length === plan.length;
    const okAmt = Math.abs(num(after.total.debit) - acc.debitTotal) < 0.01
      && Math.abs(num(after.total.lend) - acc.lendTotal) < 0.01;
    const ok = okRows && okAmt;
    logFn(`${ok ? '✅' : '❌'} ${acc.code} ${acc.name}：读回 ${after.rows.length} 行，`
      + `${after?.total.debit || '-'}/${after?.total.lend || '-'}`, ok ? 'ok' : 'bad');
    return {
      code: acc.code, name: acc.name, action: 'written',
      rows: after.rows.length,
      localDebit: acc.debitTotal, localLend: acc.lendTotal,
      platformDebit: num(after.total.debit), platformLend: num(after.total.lend),
      match: ok, rowsOk: okRows, amtOk: okAmt,
    };
  }

  /**
   * 复核 GET 一个科目，并**校验读到的确实是该科目**。
   *
   * 为什么必须有这个校验（round10 真机定案）：并发下读侧响应行集残缺，
   * 复核 GET 有可能返回**别的科目**的页面（真机 6411 实测「科目未切换」）。原实现直接拿 `re.state.rows.length` 报
   * 「N → X 行」，于是：
   *   - 读到另一个恰好 0 行的科目 ⇒ 报「✅ 清掉 N → 0 行」，目标科目其实还有行（残留隐形）；
   *   - 读到另一个恰好 1 行的科目 ⇒ 报「❌ 清掉 N → 1 行」，目标科目其实已清干净。
   * 两种都会把「清空结果」这张成绩单变成噪声。串行化（tAccountConcurrency=1）后这种
   * 错位已不该再发生，但**读路径的科目归属必须自己校验**，不能再依赖服务端行为。
   *
   * @returns {{state: object|null, mismatch: string|null, incomplete: string[]|null}}
   *   mismatch 为读到的 accountID（不符时才非 null）；
   *   incomplete 为响应完整性判据的失败原因（不可信时才非 null）。
   */
  /** 连续「读到不可信响应」的科目数；成功一次即复位。整轮开始时由调用方复位。 */
  let consecutiveUnreadable = 0;
  /** 熔断阈值：连续这么多个科目不可信，就认定是整轮性故障，不再逐科目重取。 */
  const UNREADABLE_BREAKER = 5;

  async function queryTStateChecked(ctx, code, year, month, opt = {}) {
    // 为什么带重取（D-15）：残缺响应与合法空态页都会解析成 `rows = []`，
    // 一旦把残缺当「平台 0 行」，就会打印「无需清空」而**一行都不删**（假成功）。
    // 完整性判据失败时重取，而不是当成 0 行 —— 残缺多半是瞬时的（传输层截断）。
    //
    // ★ 熔断（陪跑优化）：连续若干科目都读到不可信响应 ⇒ 这不是单科目抖动，而是
    //   平台/会话层面的整轮性故障（降级页、会话掉线）。此时逐科目重取毫无意义，
    //   只会让整轮白等：155 科目 × 2 次重取 × 300ms ≈ +94 秒（独立复算实测）。
    //   熔断后后续科目只取 1 次；**判据不变**（仍不把残缺当 0 行，仍如实报失败），
    //   只是不再重试。正常路径完全不受影响（成功一次即复位）。
    const tripped = consecutiveUnreadable >= UNREADABLE_BREAKER;
    const tries = Math.max(1, opt.tries ?? (tripped ? 1 : 3));
    let lastIncomplete = null;
    let lastMismatch = null;
    for (let k = 0; k < tries; k++) {
      const r = await queryTState(ctx, code, year, month);
      if (r.state && r.state.accountID !== code) {
        // 科目归属错位（读到别的科目）：同样不可信，重取可能自愈
        lastMismatch = r.state.accountID || '(空)';
        lastIncomplete = null;
      } else {
        const integ = tStateIntegrity(r.state, r.html);
        if (integ.ok) { consecutiveUnreadable = 0; return { state: r.state, mismatch: null, incomplete: null }; }
        lastIncomplete = integ.reasons;
        lastMismatch = null;
      }
      if (k + 1 < tries) await new Promise((res) => setTimeout(res, 300));
    }
    consecutiveUnreadable += 1;
    return { state: null, mismatch: lastMismatch, incomplete: lastIncomplete };
  }

  /** 只清空一个科目（不复写）。单科目版本，供全科目扫描（clearAllAccounts）复用。 */
  async function clearAccount(ctx, acc, year, month, logFn) {
    const q = await queryTStateChecked(ctx, acc.code, year, month);
    if (!q.state) {
      logFn(`❌ ${acc.code} 清空前置 GET 失败或科目未切换`
        + (q.mismatch ? `（读到的 accountID=${q.mismatch}）` : '（未能解析出 T 型账表单）')
        + (q.incomplete ? `；响应完整性判据未过：${q.incomplete.join('；')}（重取后仍不可信，不当作 0 行）` : ''),
      'bad');
      return { code: acc.code, action: 'error' };
    }
    const n = q.state.rows.length;
    if (n === 0) { logFn(`⏭ ${acc.code} 平台 0 行，无需清空`); return { code: acc.code, action: 'skipped' }; }

    // ---------- 提交前断言：所有行的 TEMPid 必须非空 ----------
    // 为什么必须自己断言（round10 B 线离线 harness 的结论）：
    //   `buildBody` 对每一行 append `CHECK_CONFIRM=<TEMPid>`；若某行 TEMPid 为空，
    //   服务端匹配不到该行 ⇒ 那一行**删不掉**，而日志里的 before 仍是真实的 N
    //   ⇒ 表现为「N → 1 行」。这正是真机症状，且**串行下同样会复现**（harness 实测 100%），
    //   所以 tAccountConcurrency=1 挡不住它 —— 必须在这里拦一次。
    // 代价：只在真缺 TEMPid 时多一次只读 GET；正常页面每行都有 TEMPid，零额外开销。
    let state = q.state;
    for (let k = 0; k < 2; k++) {
      const missing = state.rows.filter((r) => !r.tempid).length;
      if (!missing) break;
      logFn(`   ⚠ ${acc.code} 有 ${missing} 行缺 TEMPid（这样提交会漏删），重新取一次…`, 'warn');
      const again = await queryTStateChecked(ctx, acc.code, year, month);
      if (!again.state) { state = null; break; }
      state = again.state;
      if (state.rows.length === 0) {
        logFn(`⏭ ${acc.code} 重取后平台已是 0 行，无需清空`);
        return { code: acc.code, action: 'skipped' };
      }
    }
    if (!state) {
      logFn(`❌ ${acc.code} 缺 TEMPid 且重取失败，不提交删除（宁可少删，不可乱删）`, 'bad');
      return { code: acc.code, action: 'error' };
    }
    const stillMissing = state.rows.filter((r) => !r.tempid).length;
    if (stillMissing) {
      // 重取两次仍有行缺 TEMPid ⇒ 这是页面形态问题，不是瞬时抖动。
      // 不提交：提交也删不掉那几行，只会留下「删了但没删净」的假象。
      logFn(`❌ ${acc.code} 重取后仍有 ${stillMissing} 行缺 TEMPid，本轮不提交删除`
        + '（提交也删不掉它们，只会留下残留）', 'bad');
      return { code: acc.code, action: 'residual', before: state.rows.length, after: state.rows.length };
    }

    // ---------- delete_loop + 复核 + 自愈重删 ----------
    // 为什么要有重删（round10 真机）：平台上确实出现过「删了一半、恰好剩 1 行」，
    // 且第二次运行时那一行**删一次就掉了** ⇒ 残留可自愈，不必让用户手动跑第二遍。
    // 正常路径（一次删净）只多一次复核 GET；只有真残留时才走重删，代价可忽略。
    // before 取「实际拿去提交的那个 state」的行数 —— 上面可能重取过，
    // 用最初的 n 会让日志里的 before 与真正提交的行集不符。
    let before = state.rows.length;
    let after = -1;          // -1 = 复核没读到（不是「读到 0 行」，两者必须分开报）
    let mismatch = null;
    let incomplete = null;   // 响应完整性判据未过的原因（不可信 ≠ 读到 0 行）
    let attempts = 0;
    const MAX_ROUNDS = 3;    // 首删 + 最多 2 次重删

    for (let round = 0; round < MAX_ROUNDS; round++) {
      await submitForm(state, 'delete_loop');
      attempts += 1;
      const re = await queryTStateChecked(ctx, acc.code, year, month);
      if (!re.state) {
        mismatch = re.mismatch;
        incomplete = re.incomplete;
        after = -1;
        break;               // 复核读不到/读错科目/响应残缺：**不重删**（宁可少删，不可乱删）
      }
      after = re.state.rows.length;
      if (after === 0) break;
      // 仍有残留：把刚读到的行集当作下一轮 delete_loop 的输入（TEMPid 是最新的）。
      // ⚠ 只有确实还有下一轮时才印「再删」，否则会在最后一次印出一句做不到的承诺。
      // 同样要断言 TEMPid 非空，否则下一轮仍会漏删同一行。
      const miss = re.state.rows.filter((r) => !r.tempid).length;
      if (miss) {
        logFn(`   ⚠ ${acc.code} 残留行里有 ${miss} 行缺 TEMPid，无法继续删（跳过重删）`, 'warn');
        break;
      }
      state = re.state;
      if (round + 1 < MAX_ROUNDS) {
        logFn(`   ⚠ ${acc.code} 第 ${attempts} 次删除后仍剩 ${after} 行，重新取最新行集再删…`, 'warn');
      } else {
        logFn(`   ⚠ ${acc.code} 第 ${attempts} 次删除后仍剩 ${after} 行，已达重删上限（${MAX_ROUNDS} 次）`,
          'warn');
      }
    }

    const ok = after === 0;
    const shown = after < 0 ? '?' : after;
    logFn(`${ok ? '✅' : '❌'} ${acc.code} 清空：${before} → ${shown} 行`
      + (attempts > 1 ? `（重删 ${attempts - 1} 次后）` : '')
      + (after < 0 ? `（复核未读到：${mismatch ? `accountID=${mismatch}`
        : (incomplete ? `响应完整性判据未过 — ${incomplete.join('；')}` : '表单解析失败')}）` : ''),
    ok ? 'ok' : 'bad');
    // action 分三档，让汇总口径能闭合到 155（旧实现把「没清干净」返回成 cleared，
    // 结果它在 cleared 与 bad 两个计数里都不算，被汇总静默吞掉）。
    if (ok) return { code: acc.code, action: 'cleared', before, after: 0 };
    if (after < 0) return { code: acc.code, action: 'unread', before, reason: mismatch ? `accountID=${mismatch}` : (incomplete ? `响应残缺：${incomplete.join('；')}` : '解析失败') };
    return { code: acc.code, action: 'residual', before, after };
  }

  /**
   * 写前普查：把平台现状与「本轮计划」逐科目对账，产出四分类 + 计划外科目清单。
   *
   * 为什么必须在正式写入【之前】做（ADR-0006）：旧流程是「写到哪个科目才发现哪个科目冲突」，
   * 停在一个写了一半的状态上，而平台无事务、无回滚。普查把全部冲突提前摊开，让人一次裁决。
   *
   * 为什么 `unknown` 绝不并入 `none`：「拿不到平台状态」与「平台是空的」是两回事 ——
   * 后者会直接往存量数据上叠写。故 GET 失败一律不进写入名单。
   *
   * 为什么对全部 155 个科目都发一次只读 GET（而不是只查计划的 45 个）：
   * 计划外科目（不在 45 个内、但平台有行）只报不删，若不一并查就根本不知道它们存在 ——
   * 而这正是「别的实习批次留下的数据」最可能藏身的地方。
   *
   * @param {object} ctx
   * @param {Array}  plans   本轮计划（aggregate 的输出，含 code/name/entries）
   * @param {Function} shouldStop
   * @param {Function} onProgress  进度回调，用于原地刷新「已查 N/155」
   * @returns {Promise<{none:Array,ident:Array,conflict:Array,unknown:Array,foreign:Array,total:number}>}
   */
  async function surveyAccounts(ctx, plans, year, month, shouldStop, onProgress) {
    let accounts;
    try {
      accounts = await fetchAccountList(ctx, year, month);
    } catch (e) {
      // 连科目清单都取不到 ⇒ 全部科目状态未知，而不是「平台是空的」。返回空名单，
      // 由调用方按 unknown 口径中止写入。
      return { none: [], ident: [], conflict: [], unknown: plans.map((p) => ({ code: p.code, name: p.name })), foreign: [], total: 0 };
    }
    if (!accounts || !accounts.length) {
      return { none: [], ident: [], conflict: [], unknown: plans.map((p) => ({ code: p.code, name: p.name })), foreign: [], total: 0 };
    }

    const planByCode = new Map(plans.map((p) => [p.code, p]));
    let scanned = 0;
    // ★ T 型账的只读 GET 也必须串行：并发下读侧响应行集残缺，
    // 会把别的 lane 的科目状态带回来（真机「6411 科目未切换」即此）。
    const got = await poolMap(accounts, CONFIG.tAccountConcurrency, async (acc) => {
      if (shouldStop()) return null;
      const plan = planByCode.get(acc.code) || null;
      const planRows = plan
        ? plan.entries.map((e) => ({
          pzh: e.voucherLabel,
          debit: e.debit ? e.debit.toFixed(2) : '',
          lend: e.lend ? e.lend.toFixed(2) : '',
        }))
        : null;
      let st = null;
      try {
        // ★ 走 queryTStateChecked（等价于原来的内联 accountID 比对，统一到一个入口，
        // 避免日后有人只改一处）。科目没切过去与解析失败一样，都不能当成 0 行。
        const q = await queryTStateChecked(ctx, acc.code, year, month);
        st = q.state;
      } catch { st = null; }
      scanned += 1;
      onProgress?.(scanned, accounts.length);
      return { acc, plan, planRows, st };
    }, shouldStop);

    const out = { none: [], ident: [], conflict: [], unknown: [], foreign: [], total: accounts.length };
    // 用 collectPool 读：未开工位置是稀疏洞。worker 自带 try/catch ⇒ `{__error}` 当前
    // 不可达，但统一走 collectPool 才不会在日后去掉那层保护时静默退化。
    const gotItems = collectPool(got);
    for (const f of gotItems.failed) {
      const p = plans.find((x) => x.code === accounts[f.index]?.code) || null;
      if (p) out.unknown.push({ code: p.code, name: p.name });
    }
    for (const g of gotItems.items) {
      if (!g) continue;
      const { acc, plan, planRows, st } = g;
      if (!st) {
        // 只对计划内科目报 unknown；计划外的取不到就算了，不必用噪音淹没日志
        if (plan) out.unknown.push({ code: acc.code, name: acc.name });
        continue;
      }
      const n = st.rows.length;
      if (!plan) {
        // 计划外科目：只记不删（可能是别的实习批次留下的数据，脚本不做超出用户意图的删除）
        if (n > 0) out.foreign.push({ code: acc.code, name: acc.name, rows: n });
        continue;
      }
      if (n === 0) { out.none.push({ code: acc.code, name: acc.name, plan }); continue; }
      // 幂等判据沿用 rowMatchesPlan 的宽容口径（比凭证号前缀 + 金额 + 方向，不比摘要）
      const ident = n === planRows.length && st.rows.every((r, i) => rowMatchesPlan(r, planRows[i]));
      if (ident) out.ident.push({ code: acc.code, name: acc.name, rows: n });
      else out.conflict.push({ code: acc.code, name: acc.name, rows: n, planned: planRows.length, plan });
    }
    return out;
  }

  /**
   * 冲突裁决闸门：在日志区列清单、启用两个按钮，然后挂起等用户点。
   *
   * 返回 'clear'（清掉冲突科目再写）/ 'skip'（只写 none 的科目）/ 'stopped'。
   *
   * 为什么不用 `confirm()`：面板日志走 textContent、markdown 不渲染，清单要能在日志区
   * 逐行看；而 confirm 只给一个弹窗、没有「看到清单再决定」的余地，也无法体现「计划外科目」
   * 这类只报不动的内容。
   *
   * 为什么等待期间把其余按钮禁掉、只放这两个：此刻处于「已归集、已过锁、尚未写平台」
   * 的悬空态，此时让用户再点一个入口（比如再点一次写入）会重入整轮流程。
   */
  function askConflictChoice(panel, conflicts, foreign, unknown) {
    const logEl = panel.querySelector('#v2t-log');
    const line = (s, cls) => {
      const d = document.createElement('div');
      if (cls) d.className = cls;
      d.textContent = s;
      logEl.appendChild(d);
    };

    // 清单只列科目与行数，不列平台行的具体内容（用户明确选择「只列科目与行数」）。
    line(`⚠ 发现 ${conflicts.length} 个冲突科目（平台已有行，但与本轮计划不匹配）：`, 'warn');
    for (const c of conflicts) line(`   ${c.code} ${c.name} ｜ 平台 ${c.rows} 行 / 计划 ${c.planned} 行`, 'warn');
    if (foreign.length) {
      const totalRows = foreign.reduce((s, f) => s + f.rows, 0);
      line(`ℹ 另有 ${foreign.length} 个计划外科目平台已有数据（共 ${totalRows} 行），本轮不动它们：`, 'warn');
      for (const f of foreign) line(`   ${f.code} ${f.name} ｜ 平台 ${f.rows} 行`, 'warn');
    }
    if (unknown.length) {
      line(`⚠ ${unknown.length} 个科目状态未知（GET 失败或科目未切换），本轮跳过不写：`
        + unknown.map((u) => u.code).join(', '), 'bad');
    }
    line('请选择：清掉这些冲突科目并继续写入，还是跳过它们？', 'warn');
    logEl.scrollTop = logEl.scrollHeight;

    const btnClear = panel.querySelector('#v2t-conflict-clear');
    const btnSkip = panel.querySelector('#v2t-conflict-skip');
    panel.querySelector('#v2t-conflict-bar').style.display = 'flex';
    btnClear.disabled = false;
    btnSkip.disabled = false;

    return new Promise((resolve) => {
      let settled = false;
      let timer = null;
      const done = (v) => {
        if (settled) return;
        settled = true;
        if (timer) clearInterval(timer);
        btnClear.disabled = true;
        btnSkip.disabled = true;
        btnClear.onclick = null;
        btnSkip.onclick = null;
        panel.querySelector('#v2t-conflict-bar').style.display = 'none';
        resolve(v);
      };
      // 等待期间点「停止」= 跳过（不删任何东西），并让主流程在下一个检查点收工
      timer = setInterval(() => { if (!settled && stopRequested) done('stopped'); }, 200);
      btnClear.onclick = () => done('clear');
      btnSkip.onclick = () => done('skip');
    });
  }

  /**
   * 「清空 T 型账」：扫平台的全部总账科目，凡已有行的都清空。
   *
   * 为什么作用域是全部总账科目（实测 155 个）而不是归集出的 45 个：
   *   清空是重置动作，必须在「凭证取不到 / 凭证本身是错的」时也能把平台清干净。
   *   故科目清单只能来自平台自身的科目下拉（`fetchAccountList`），不能来自凭证归集。
   *
   * 因此本函数不依赖凭证、也不过三锁闸门（ADR-0004「清空 T 型账」一节）。
   * 唯一的防线是调用方在扫描开始之前弹的那一次 `confirm()`。
   *
   * @param {object}   ctx
   * @param {string}   year
   * @param {string}   month
   * @param {Function} logFn
   * @param {Function} shouldStop  每个科目开工前查一次；置位则不再派发新科目
   * @param {Function} [onProgress] 进度回调 `(已清数, 总数)`，供面板原地刷新一行
   * @returns {Promise<Array<{code:string, name:string, action:string, before?:number, after?:number}>>}
   *          逐科目结果数组；取不到科目清单时返回空数组（调用方据空数组报错）
   */
  async function clearAllAccounts(ctx, year, month, logFn, shouldStop, onProgress) {
    consecutiveUnreadable = 0;   // 整轮开始，复位熔断计数
    let accounts;
    try {
      accounts = await fetchAccountList(ctx, year, month);
    } catch (e) {
      logFn(`❌ 取科目清单失败（GET 异常）：${e.message}`, 'bad');
      return [];
    }
    if (!accounts || !accounts.length) {
      // 带上响应长度：平台有时会返回一种「科目下拉为空」的降级页（真机实测 7597 字节，
      // 正常页 17257 字节）。有了长度，用户一眼能区分「平台真没科目」与「吃到降级页」。
      const len = accounts && accounts.failedResponseLen;
      logFn('❌ 未能从 T 型账页解析出科目清单（`select[name="accountID"]` 缺失或为空），已中止，未碰平台。'
        + (len ? `（重试后仍为空，最后一次响应 ${len} 字节 —— 若明显偏小，多半是平台返回了降级页，隔一会儿重试）` : ''), 'bad');
      return [];
    }
    logFn(`清空范围：平台全部总账科目 ${accounts.length} 个（不依赖凭证）`);

    let scanned = 0;
    // ★ 科目之间**不可**并行（round10 真机定案，见 CONFIG.tAccountConcurrency 注释）：
    // 「请求体每次显式携带 sxid/accountID/yyyy/mm/entityid」这句话是对的，但它**不足以**
    // 推出「科目级可以并行」—— 并发下读侧响应行集残缺（round10 真机差分 + 离线 harness 复现）。
    // 每个科目内部仍是「前置 GET → delete_loop → 复核 GET」的严格串行。
    // 日志仍先缓冲、后整段回放：保证面板输出顺序稳定、缩进与分类色与串行版一致。
    const res = await poolMap(accounts, CONFIG.tAccountConcurrency, async (acc, i) => {
      scanned += 1;
      onProgress?.(scanned, accounts.length);
      const buf = [`[${i + 1}/${accounts.length}] ${acc.code} ${acc.name}…`];
      const sub = (s, cls) => buf.push({ s: '   ' + s, cls: cls || '' });
      try {
        return {
          ...(await clearAccount(ctx, acc, year, month, sub)),
          name: acc.name,
          __buf: buf,
        };
      } catch (e) {
        buf.push({ s: `❌ ${acc.code} 清空异常：${e.message}`, cls: 'bad' });
        return { code: acc.code, name: acc.name, action: 'error', __buf: buf };
      }
    }, shouldStop);

    // 整段回放：顺序与串行版逐科目一致，缩进与分类色保留。
    // 用 collectPool 读：未开工位置是稀疏洞，直接遍历会把洞当空值。
    const collected = collectPool(res);
    const done = [];
    for (const r of collected.items) {
      for (const b of r.__buf) {
        if (typeof b === 'string') logFn(b); else logFn(b.s, b.cls);
      }
      const { __buf: _drop, ...rest } = r;
      done.push(rest);
    }
    for (const f of collected.failed) {
      logFn(`❌ ${accounts[f.index]?.code} 清空异常：${f.error.message}`, 'bad');
      done.push({ code: accounts[f.index]?.code, action: 'error' });
    }
    // 中断判据以停止标志本身为准（worker 内那句 shouldStop 分支几乎不可达，见 poolMap 注释）
    const stoppedEarly = shouldStop();
    if (stoppedEarly) {
      logFn(`⏹ 已停止：${done.length} / ${accounts.length} 个科目已处理，其余未清。`, 'warn');
    }

    // 口径必须区分「本次清掉的」与「本来就是 0 行的」——把两者合并成一个数会让人
    // 以为清掉了 155 个科目（而其中 115 个原本就没有行）。外层 runClearEntry 已分开报，
    // 这里对齐同一口径。
    //
    // ⚠ round10 修：旧口径把「删了但没删净」的科目返回成 cleared，于是它在 cleared
    //   与 bad 两个计数里**都不算** —— 汇总数字自身闭合不到 155（真机日志里出现过
    //   42 + 109 + 1 = 152，缺的 3 个正是「N → 1 行」的科目），残留被静默吞掉。
    //   现在按 action 分档：cleared / skipped / residual / unread / error，五档相加
    //   必须等于已处理科目数；任何一档非零都要在日志里点名。
    const cleared = done.filter((r) => r.action === 'cleared').length;
    const wasZero = done.filter((r) => r.action === 'skipped').length;
    const residual = done.filter((r) => r.action === 'residual');
    const unread = done.filter((r) => r.action === 'unread');
    const bad = done.filter((r) => r.action === 'error').length;
    const problem = residual.length + unread.length + bad;
    if (stoppedEarly) {
      // 被中断时**不得**印「✅ 清空结束 …（共扫描 N 个）」——「开跑即停止」那一档
      // 一个科目都没派发，却报「共扫描 155 个」且用成功色，与全部清完同形（round9 复核 M4 残余）。
      logFn(`⏹ 清空被中断：本次清掉 ${cleared} 个科目，原本已是 0 行 ${wasZero} 个，失败 ${bad} 个`
        + `（已处理 ${done.length} / ${accounts.length} 个，其余未清）`, 'warn');
    } else {
      logFn(`${problem ? '⚠' : '✅'} 清空结束：本次清掉 ${cleared} 个科目，原本已是 0 行 ${wasZero} 个，`
        + `未清干净 ${residual.length} 个，复核未读到 ${unread.length} 个，失败 ${bad} 个`
        + `（共扫描 ${accounts.length} 个）`, problem ? 'warn' : 'ok');
    }
    if (residual.length) {
      logFn(`⚠ 以下科目删除后仍有残留行（下次点「清空」会再删一次）：`
        + residual.map((r) => `${r.code}(${r.after} 行)`).join(', '), 'warn');
    }
    if (unread.length) {
      logFn(`⚠ 以下科目删除后复核读不到状态（结果未知，需人工确认，不要当成已清干净）：`
        + unread.map((r) => `${r.code}${r.reason ? `(${r.reason})` : ''}`).join(', '), 'bad');
    }
    return done;
  }

  // ======================= 界面 =======================
  const CSS = `
    #v2t-panel { position:fixed; top:12px; right:12px; z-index:2147483647; width:340px;
      font:13px/1.6 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif;
      background:#0f2a1d; color:#d8f5e4; border:1px solid #2f6b4a; border-radius:10px;
      box-shadow:0 8px 32px rgba(0,0,0,.45); overflow:hidden; }
    #v2t-panel h3 { margin:0; padding:10px 12px; background:#163d29; font-size:13px;
      display:flex; justify-content:space-between; align-items:center; }
    #v2t-panel h3 span { font-weight:400; opacity:.7; font-size:11px; cursor:pointer; }
    #v2t-body { padding:10px 12px; max-height:60vh; overflow:auto; }
    #v2t-panel button { background:#2f9e6b; color:#fff; border:0; padding:7px 14px;
      border-radius:6px; cursor:pointer; font-size:12px; margin-right:6px; }
    #v2t-panel button:hover { background:#38b97c; }
    #v2t-panel button:disabled { background:#3a5a4b; cursor:not-allowed; }
    #v2t-panel button.ghost { background:transparent; border:1px solid #2f6b4a; }
    #v2t-log { margin-top:8px; font-family:ui-monospace,Consolas,monospace; font-size:11px;
      white-space:pre-wrap; max-height:34vh; overflow:auto; background:#0a1f16;
      padding:8px; border-radius:6px; }
    #v2t-panel label { display:flex; align-items:center; gap:6px; margin:6px 0; font-size:12px; }
    #v2t-panel .warn { color:#ffd479; }
    #v2t-panel .ok { color:#6ee7a8; }
    #v2t-panel .bad { color:#ff8a8a; }
  `;

  function buildUI() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const panel = document.createElement('div');
    panel.id = 'v2t-panel';
    panel.innerHTML = `
      <h3>凭证登 T 型账 <span id="v2t-min">收起</span></h3>
      <div id="v2t-body">
        <label>年份 <input id="v2t-year" style="width:60px" value="${CONFIG.year}">
          月份 <input id="v2t-month" style="width:40px" value="${CONFIG.month}"></label>
        <div style="margin:8px 0; display:flex; flex-wrap:wrap; gap:6px">
          <button id="v2t-clear-all">清空 T 型账</button>
          <button id="v2t-run-teacher">获取教师答案并写入 T 型账</button>
          <button id="v2t-run-student">获取学生答案并写入 T 型账</button>
          <button id="v2t-del-cache">删除本地存储答案</button>
          <button id="v2t-stop" class="ghost" disabled>停止</button>
        </div>
        <div id="v2t-conflict-bar" style="margin:8px 0; display:none; gap:6px">
          <button id="v2t-conflict-clear" disabled>清掉这些科目并继续</button>
          <button id="v2t-conflict-skip" class="ghost" disabled>跳过它们</button>
        </div>
        <div id="v2t-log">就绪。请先进入实训企业。操作顺序：① 清空 T 型账 → ② 获取教师答案并写入 → ③ 获取学生答案并写入（② ③ 抓过一次后会留在本地复用）；④ 删除本地存储答案只清本地缓存，不碰平台。</div>
      </div>`;
    document.body.appendChild(panel);

    let collapsed = false;
    panel.querySelector('#v2t-min').onclick = () => {
      collapsed = !collapsed;
      panel.querySelector('#v2t-body').style.display = collapsed ? 'none' : 'block';
      panel.querySelector('#v2t-min').textContent = collapsed ? '展开' : '收起';
    };
    return panel;
  }

  function uilog(panel, msg, cls = '') {
    const el = panel.querySelector('#v2t-log');
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = msg;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }

  /**
   * 长跑进度行：在日志区【原地刷新一行】，不每次新增一行。
   *
   * 为什么要复用同一个元素：普查 155 个科目、清空 155 个科目、抓 103 张凭证这三段
   * 各会刷新上百次，每次新增一行会把日志区冲走，前面真正要看的内容（冲突清单、三锁结果）
   * 会被顶出可视区。
   * 返回一个 `{ update, close }`：update 覆写该行文本，close 把它从「原地刷新」摘出来
   * （改完这一行之后，后续日志就正常往下追加）。
   */
  function uiprog(panel, msg, cls = '') {
    const el = panel.querySelector('#v2t-log');
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = msg;
    el.appendChild(line);
    let touched = false;
    return {
      update: (s) => { touched = true; line.textContent = s; el.scrollTop = el.scrollHeight; },
      // 一次都没刷新过（缓存命中、0 个科目等）说明这行只是个占位，摘掉，别在日志里留噪音
      close: () => { if (!touched && line.parentNode) line.parentNode.removeChild(line); },
    };
  }

  // ======================= 主流程 =======================

  let running = false;
  // 「停止」按钮置位后，主循环每一步都要查它 —— 只置标志、循环不查，按钮就是死的。
  let stopRequested = false;

  /** 主循环与内部长循环共用的中断判据。 */
  function shouldStop() {
    return stopRequested;
  }

  /** 被中断时抛出，统一由 main 的 catch 收口成一条日志。 */
  function throwIfStopped() {
    if (shouldStop()) {
      const e = new Error('STOPPED');
      e.__stopped = true;
      throw e;
    }
  }

  /** 四个功能按钮（顺序即建议操作顺序）。外壳在忙碌期间统一禁用它们。 */
  const ENTRY_BUTTONS = ['#v2t-clear-all', '#v2t-run-teacher', '#v2t-run-student', '#v2t-del-cache'];

  /**
   * 一批凭证是否「可用」。用于缓存命中判定与「不覆盖已有数据」的保护。
   *
   * 注意：空数组视为不可用 —— 会话过期、登录页、或者平台真的没数据时，
   * 抓取会返回 0 张。若把 0 张也当成结果写进缓存，就把上一次的有效数据覆盖掉了。
   */
  function isUsableVouchers(v) {
    return Array.isArray(v) && v.length > 0;
  }

  /**
   * 取「对侧」已有数据供锁三比对（决策 8）：写教师答案时找学生答案，写学生答案时找教师答案。
   *
   * 只从本地已有数据里取，不为比对而联网抓 —— 两边都没有就返回 null，
   * 由 `tripleLock` 标「未执行」。命中与否都不阻断主流程。
   */
  function readPeerVouchers(ctx, kind) {
    if (kind === 'teacher') {
      const peer = cacheGet(CACHE.studentPrefix + getStudentKey(ctx).key);
      return isUsableVouchers(peer) ? peer : null;
    }
    const peer = cacheGet(CACHE.teacher);
    return isUsableVouchers(peer) ? peer : null;
  }

  /**
   * 四个入口共用的外壳：面板忙碌态 + 上下文获取 + entityID 校验。
   *
   * 忙碌期间四个功能按钮全部禁用、日志清空、停止按钮解禁；无论正常结束、提前 return
   * 还是抛异常，都在 finally 里复位。「停止」只置 `stopRequested = true`（见 boot()），
   * 真正的检查点在主循环每轮开头、`fillAccount` 逐行循环内、以及 `update_loop` 之前。
   */
  async function withEntry(panel, entry) {
    if (running) return;
    running = true;
    stopRequested = false;
    for (const id of ENTRY_BUTTONS) panel.querySelector(id).disabled = true;
    panel.querySelector('#v2t-stop').disabled = false;
    // 冲突裁决按钮不随忙碌态启用（它们只在普查结束后、由 askConflictChoice 打开）——
    // 这里只保证上一轮若异常退出，它们不会残留成可点状态。
    panel.querySelector('#v2t-conflict-clear').disabled = true;
    panel.querySelector('#v2t-conflict-skip').disabled = true;
    panel.querySelector('#v2t-conflict-bar').style.display = 'none';
    panel.querySelector('#v2t-log').innerHTML = '';

    const logFn = (msg, cls = '') => uilog(panel, msg, cls);
    try {
      const ctx = getContext();
      if (!ctx) {
        logFn('❌ 找不到 entityID。请先进入实训企业页面。', 'bad');
        return;
      }
      logFn(`上下文：entityID=${ctx.entityID}`
        + (ctx.sxid ? `　SXID=${ctx.sxid.slice(0, 8)}…` : '　SXID 未取到（仅影响锁三比对）'));
      if (!mainFrame()) { logFn('❌ 找不到 main 框架，请确认已进入实训企业。', 'bad'); return; }

      const year = panel.querySelector('#v2t-year').value || CONFIG.year;
      const month = panel.querySelector('#v2t-month').value || CONFIG.month;
      await entry({ ctx, year, month, logFn, panel });
    } catch (e) {
      if (e && e.__stopped) logFn('⏹ 已停止。', 'warn');
      else { logFn(`❌ 出错：${e.message}`, 'bad'); log(e); }
    } finally {
      running = false;
      stopRequested = false;
      for (const id of ENTRY_BUTTONS) panel.querySelector(id).disabled = false;
      panel.querySelector('#v2t-stop').disabled = true;
      panel.querySelector('#v2t-conflict-clear').disabled = true;
      panel.querySelector('#v2t-conflict-skip').disabled = true;
      panel.querySelector('#v2t-conflict-bar').style.display = 'none';
    }
  }

  /**
   * ① 清空 T 型账（平台全部总账科目）。
   *
   * 行为契约（ADR-0004「清空 T 型账」）：
   *   - 点下去先弹一次 `confirm()`，弹窗内不含科目数、不预告将清空多少个科目；
   *     确认之后才开始扫描。这一次确认是唯一防线。
   *   - 不依赖凭证、不过三锁闸门：清空是重置动作，凭证取不到、或凭证本身是错的时候，
   *     也要能用它把平台清干净。整条路径不读取、不校验任何凭证与归集结果。
   */
  async function runClearEntry(ctx, year, month, logFn, panel) {
    // ⚠ 确认弹窗必须在任何扫描 / 网络请求之前，且文案里不得出现科目数量。
    const ok = confirm(`⚠ 即将清空 T 型账：${year} 年 ${month} 月，范围是平台全部总账科目的已登记行。\n\n`
      + '平台无事务、无回滚，此操作不可恢复。\n确认继续？');
    if (!ok) { logFn('已取消：未碰平台。', 'warn'); return; }

    logFn(`清空 T 型账（${year} 年 ${month} 月）…`);
    // 清空要扫 155 个科目，属长跑；进度「原地刷新一行」，不每次新增行
    const prog = panel ? uiprog(panel, '已清空 0/…') : null;
    const res = await clearAllAccounts(ctx, year, month, logFn, shouldStop,
      (n, total) => prog?.update(`已清空 ${n}/${total}`));
    prog?.close();
    if (!res.length) return;
    // 口径与 clearAllAccounts 尾部一致（见那处注释）：五档相加闭合到处理数，
    // 「未清干净」与「复核未读到」不再被并进「清掉」里。
    const cleared = res.filter((r) => r.action === 'cleared').length;
    const wasZero = res.filter((r) => r.action === 'skipped').length;
    const residual = res.filter((r) => r.action === 'residual').length;
    const unread = res.filter((r) => r.action === 'unread').length;
    const bad = res.filter((r) => r.action === 'error').length;
    const problem = residual + unread + bad;
    logFn(`${problem ? '⚠' : '✅'} 清空结果：清掉 ${cleared} 个科目，开始时已是 0 行 ${wasZero} 个，`
      + `未清干净 ${residual} 个，复核未读到 ${unread} 个，失败 ${bad} 个`
      + `（共处理 ${res.length} 个）`, problem ? 'warn' : 'ok');
  }

  /** ④ 删除本地存储答案：全删、不加二次确认、不碰平台。 */
  async function runDelCacheEntry(logFn) {
    const n = cacheClearAll();
    logFn(`✅ 删除完成：共 ${n} 项（教师答案与批次元信息 + 全部学生答案 + 学生键索引）。`, 'ok');
    logFn('   只动本机数据，未碰平台。要重新抓取，点②或③即可。');
  }

  /**
   * 取一个入口所需的凭证。
   *
   * 缓存判定与落盘都在 `fetchAnswerVouchers` / `fetchStudentVouchers` 内部完成（命中即零请求、
   * 零相关日志）。这里只补一件事：教师答案的批次相符性提示。
   *
   * 为什么批次只提示不阻断（ADR-0004）：`EntityID` 的批次相关性在仓库内没有实测，
   * 唯一取值只有 `110`。缓存只做「不符时说一声」这一层保守防护，不拿它当闸门。
   */
  async function fetchForEntry(ctx, kind, logFn, progress, auditSink) {
    if (kind === 'teacher') {
      const vouchers = await fetchAnswerVouchers(ctx, progress, shouldStop, auditSink);
      const meta = cacheGet(CACHE.teacherMeta) || {};
      if (meta.entityID && String(meta.entityID) !== String(ctx.entityID)) {
        logFn(`⚠ 教师答案的取数批次是 entityID=${meta.entityID}，与当前批次 ${ctx.entityID} 不同。`
          + '仍继续使用该数据（不阻断）；如需重抓，先点④「删除本地存储答案」。', 'warn');
      }
      return vouchers;
    }
    return fetchStudentVouchers(ctx, progress, shouldStop, auditSink);
  }

  /** ② 获取教师答案并写入 T 型账。 */
  async function runTeacherEntry(ctx, year, month, logFn, panel) {
    return runWriteEntry(ctx, year, month, logFn, 'teacher', panel);
  }

  /** ③ 获取学生答案并写入 T 型账。 */
  async function runStudentEntry(ctx, year, month, logFn, panel) {
    return runWriteEntry(ctx, year, month, logFn, 'student', panel);
  }

  /**
   * 写入入口（② 教师答案 / ③ 学生答案共用）。
   *
   * 契约要点：
   *   - 写入前不弹确认（写入前的确认开关已按 ADR-0004 删除），只在日志列出科目数与行数。
   *   - 锁一 + 锁二 = 硬闸门：不过则整轮不写并把问题报出来。
   *   - 锁三用已有的学生/教师答案顺带比对（决策 8）：写教师答案时若手头已有学生答案数据
   *     就比一次，没有就标「未执行」，不阻断；写学生答案时对称地拿已有教师答案数据比对。
   *   - 审核状态不构成闸门：抓取完成后报出未审核凭证，不阻止写入。
   */
  async function runWriteEntry(ctx, year, month, logFn, kind, panel) {
    const kindName = kind === 'teacher' ? '教师答案' : '学生答案';
    const auditSink = new Map();
    // cfg 只剩 throttleMs：三个旧开关（只读预览 / 先清空再重写 / 只清空不重写）已按 ADR-0004 删除
    const cfg = { throttleMs: CONFIG.throttleMs };

    logFn(`① 获取${kindName}凭证…`);
    throwIfStopped();
    // 抓 103 张凭证是长跑（列表翻页 + 逐张详情），进度原地刷新一行
    const fetchProg = panel ? uiprog(panel, '抓取中…') : null;
    const vouchers = await fetchForEntry(ctx, kind, logFn,
      (s) => { if (fetchProg) fetchProg.update(s); else logFn('   ' + s); }, auditSink);
    fetchProg?.close();
    if (!isUsableVouchers(vouchers)) {
      logFn(`❌ 没抓到${kindName}凭证。`, 'bad');
      return;
    }
    logFn(`   共 ${vouchers.length} 张${kindName}凭证，`
      + `${vouchers.reduce((s, v) => s + v.lines.length, 0)} 条分录`, 'ok');

    // 审核状态只在「本次确实读了列表页」时才有得可报；不构成闸门，报了也继续写。
    if (auditSink.size) {
      const au = auditSummary(auditSink, vouchers);
      if (au.unaudited.length) {
        logFn(`⚠ ${au.unaudited.length} 张凭证未审核：`
          + `${au.unaudited.slice(0, 8).join(', ')}${au.unaudited.length > 8 ? ' …' : ''}（不阻断写入）`, 'warn');
      } else if (au.total) {
        logFn(`   审核状态：${au.total} 张全部已审核`, 'ok');
      }
    }

    // 2. 归集
    throwIfStopped();
    logFn('② 按一级科目归集…');
    const allAccounts = aggregate(vouchers);
    logFn(`   ${allAccounts.length} 个科目`, 'ok');

    // 3. 三重锁
    // 注意：锁必须基于全量归集 —— 若先过滤再校验，锁二会拿全量凭证对比被裁剪后的
    // 科目结果而必然失败。（单科目调试过滤器已按 ADR-0004 删除，此处只为留住口径说明。）
    throwIfStopped();
    logFn('③ 三重锁校验…');
    // 锁三的对侧数据（决策 8）：写教师答案时若本地已有学生答案数据就比一次，反之亦然；
    // 两边都没有就交给 tripleLock 标「未执行」。只从已有数据里取，不为比对而联网抓。
    const peerVouchers = readPeerVouchers(ctx, kind);
    if (peerVouchers) logFn(`   （锁三取到对侧已有数据 ${peerVouchers.length} 张，用于逐笔比对）`);
    else logFn('   （没有对侧数据可比，锁三将标注「未执行」；不阻断）');
    const lock = tripleLock(vouchers, allAccounts, peerVouchers);
    logFn(`   锁一 逐张凭证平衡：${lock.l1ok ? '通过' : '失败'}`, lock.l1ok ? 'ok' : 'bad');
    logFn(`   锁二 归集双向闭合：${lock.l2ok ? '通过' : '失败'}`, lock.l2ok ? 'ok' : 'bad');
    logFn(`   锁三 答案 vs 学生凭证：${lock.l3ok ? '一致' : '不一致/未执行'}`, lock.l3ok ? 'ok' : 'warn');
    if (lock.l3note) logFn(`        ${lock.l3note}`, lock.l3ok ? 'ok' : 'warn');
    logFn(`   借贷合计 ${lock.totalDebit.toFixed(2)}`);
    if (lock.issues.length) {
      logFn('   ⚠ 存在问题：', 'warn');
      lock.issues.slice(0, 5).forEach((s) => logFn('     · ' + s, 'warn'));
    }
    // 锁一/锁二 是硬闸门；锁三只提示不阻断（v2 决策 5）
    if (!(lock.l1ok && lock.l2ok)) {
      logFn('❌ 锁一/锁二未过，已停止，未写平台。', 'bad');
      return;
    }
    if (!lock.l3ok) {
      logFn('⚠ 锁三提示不一致，按决策继续执行（仅提示，不阻断）。', 'warn');
    }

    // 4. 回填（HTTP 化：不导航任何 DOM）
    const taccounts = allAccounts;

    // ---------- 写前普查 + 冲突裁决（ADR-0006）----------
    // 位置很关键：归集完成、三锁通过【之后】，正式写入【之前】。此处若发现冲突，
    // 平台一行都还没动过，用户可以干净地重新决定。
    throwIfStopped();
    logFn('③b 写前普查：查平台全部总账科目的当前行数（写入前的最后一道核对）…');
    const surveyProg = panel ? uiprog(panel, '已查 0/…') : null;
    const survey = await surveyAccounts(ctx, taccounts, year, month, shouldStop,
      (n, total) => surveyProg?.update(`已查 ${n}/${total}`));
    surveyProg?.close();
    if (!survey.total) {
      // 连平台科目清单都没取到 ⇒ 所有科目状态都未知。此时写入等于盲写，一律不写。
      logFn('❌ 普查未能取到平台科目清单（GET 异常或下拉为空），全部科目状态未知，本轮不写。', 'bad');
      return;
    }
    logFn(`   平台总账科目 ${survey.total} 个：待写 ${survey.none.length}，`
      + `幂等跳过 ${survey.ident.length}，冲突 ${survey.conflict.length}，`
      + `状态未知 ${survey.unknown.length}，计划外有数据 ${survey.foreign.length}`,
      survey.conflict.length || survey.unknown.length ? 'warn' : 'ok');

    // 本轮到底要写哪些科目：默认是「平台 0 行」的那批；用户选「清掉」后再把冲突科目加回来
    // （它们此时已被清成 0 行）。
    const writeSet = new Set(survey.none.map((n) => n.code));

    if (survey.conflict.length) {
      if (!panel) {
        // 没有面板就没有人可以裁决（理论不可达：写入入口都从面板进）。保守取「跳过」。
        logFn('⚠ 无面板可交互，冲突科目一律跳过。', 'warn');
      } else {
        const choice = await askConflictChoice(panel, survey.conflict, survey.foreign, survey.unknown);
        if (choice === 'clear') {
          // 先把冲突科目**串行**清空，再统一进入写入 —— 删除是预清理，不是写路径的一个分支。
          // 这样 fillAccount 维持单一形态（平台无行 → 写），不新增「有行变无行」的入口。
          logFn(`   清理 ${survey.conflict.length} 个冲突科目（串行，T 型账操作不可并发）…`);
          const clearProg = uiprog(panel, `已清理 0/${survey.conflict.length}`);
          let cleared = 0;
          // 与写入段同口径：日志**即时**写面板（科目串行 ⇒ 顺序天然稳定），不再段末整段回放。
          const clrBuf = await poolMap(survey.conflict, CONFIG.tAccountConcurrency, async (c) => {
            if (shouldStop()) return null;
            const acc = taccounts.find((a) => a.code === c.code) || c;
            const r = await clearAccount(ctx, acc, year, month, (s, cls) => logFn('      ' + s, cls));
            cleared += 1;
            clearProg.update(`已清理 ${cleared}/${survey.conflict.length}`);
            return r;
          }, shouldStop);
          clearProg.close();
          // 用 collectPool 读 —— 与写入段同理：未开工位置是稀疏洞，且并发下 clearAccount
          // 的 HTTP 失败会以 `{__error}` 落在槽位上。旧的 `for (const g of clrBuf) { if (!g) continue;
          // for (const b of g.buf) … }` 读法在 `{__error}` 上会抛 `TypeError: g.buf is not iterable`，
          // 把**已清空科目的日志连同异常一起蒸发**，还让其后的整个写入被跳过。
          const clrGot = collectPool(clrBuf);
          // 只取失败项：日志已在 clearAccount 内即时写面板（与写入段同口径），不再整段回放。
          for (const f of clrGot.failed) {
            const c = survey.conflict[f.index];
            logFn(`❌ ${c ? c.code : '?'} 清理异常：${f.error.message}`, 'bad');
          }
          for (const c of survey.conflict) writeSet.add(c.code);
        } else {
          logFn(choice === 'stopped'
            ? '   已停止：冲突科目与其余科目本轮都不写。'
            : '   已选择跳过冲突科目，只写「平台 0 行」的科目。', 'warn');
          if (choice === 'stopped') return;
        }
      }
    }
    if (survey.foreign.length) {
      logFn(`ℹ 计划外科目 ${survey.foreign.length} 个平台已有行，本轮不动：`
        + survey.foreign.map((f) => `${f.code}(${f.rows})`).join(', '), 'warn');
    }
    if (survey.unknown.length) {
      logFn(`⚠ 状态未知 ${survey.unknown.length} 个科目本轮跳过（「未知」不等于「平台是空的」）：`
        + survey.unknown.map((u) => u.code).join(', '), 'bad');
    }

    // 按计划顺序列出写入名单。这一趟是纯本地筛选、不发请求，但它逐科目确认一次「停止」——
    // 让用户在最长的并发段开始【之前】还有一个生效点。
    const writable = [];
    for (let i = 0; i < taccounts.length; i++) {
      if (shouldStop()) {
        logFn(`⏹ 已停止：写入名单尚未开始构建（0 / ${taccounts.length} 个科目），本轮未碰平台。`, 'warn');
        return;
      }
      const acc = taccounts[i];
      if (writeSet.has(acc.code)) writable.push(acc);
    }
    throwIfStopped();

    logFn(`④ 写入 T 型账（HTTP 化：不导航任何 DOM）｜期间 ${year} 年 ${month} 月`);
    logFn(`   本轮计划：${taccounts.length} 个科目、${taccounts.reduce((s, a) => s + a.entryCount, 0)} 行`
      + `；实际写入 ${writable.length} 个科目`
      + `（贷/借合计 ${lock.totalDebit.toFixed(2)}）`);

    // 科目间**串行**；同一科目内部本就严格串行（insert 的 body 自带当前全部已存行与 TEMPid，
    // 下一行必须看到上一行的落库结果）。为什么科目间也不能并发：见 CONFIG.tAccountConcurrency
    // 的注释 —— 并发下读侧响应行集残缺，科目级并发会让读回的科目错位。
    // 日志**即时**直写面板（写一条、展一条）。科目之间串行（tAccountConcurrency=1）保证
    // 输出顺序仍等于计划顺序，因此与「先缓冲、后回放」逐字等价，只是出现时机从段末提前到当下。
    // ⚠ 若将来把 tAccountConcurrency 调成 >1，此处必须改回「先缓冲、后回放」，否则多路日志会交错。
    consecutiveUnreadable = 0;   // 写路径开始，复位熔断计数（与普查阶段各自独立判断）
    const buffered = await poolMap(writable, CONFIG.tAccountConcurrency, async (acc, idx) => {
      const name = `${acc.code} ${acc.name}`;
      logFn(`   [${idx + 1}/${writable.length}] ${name}…`);
      const sub = (s, cls) => logFn('      ' + s, cls);
      try {
        const r = await fillAccount(ctx, acc, year, month, cfg, sub, shouldStop);
        return { ...r, name: acc.name || name };
      } catch (e) {
        // 单科目异常不再冒泡：冒泡就等于把其他已写盘科目的结果与日志一起丢掉。
        // 「被停止」与「真失败」必须分成两种 action —— 都记成 error 的话，汇总会把
        // 用户主动点停止报成「❌ 失败 N 个科目」，与真的写坏数据长得一样。
        if (e && e.__stopped) {
          logFn('⏹ 停止：该科目未写完', 'warn');
          return { code: acc.code, name: acc.name, action: 'stopped' };
        }
        logFn(`❌ ${acc.code} 异常：${e.message}`, 'bad');
        return { code: acc.code, name: acc.name, action: 'error', reason: e.message };
      }
    }, shouldStop);

    // 结果仍用 collectPool 读 —— 未开工位置是稀疏洞，filter(Boolean) 会跳过它们、
    // filter(r => r === null) 又数不到它们，两种写法都会把统计做错。
    // 这里只收结果、不再回放日志：日志已在 worker 里即时打给面板（见上一段注释）。
    const collected = collectPool(buffered);
    const results = collected.items;
    for (const f of collected.failed) {
      // 走到这里说明是 poolMap 层面捕获的异常（写入侧已在 worker 内就地转成 error 结果）
      logFn(`❌ 第 ${f.index + 1} 个科目异常：${f.error.message}`, 'bad');
      results.push({ code: writable[f.index]?.code, action: 'error', reason: f.error.message });
    }
    // 是否被中断以停止标志本身为准：停止可能落在「lane 已取号、在途请求正在收尾」的窗口里，
    // 此时没有任何 worker 提前返回，靠 worker 计数会漏判（worker 内那句 shouldStop 分支
    // 因为 lane 在循环顶部就 return 而几乎不可达 —— 见 poolMap 注释）。
    const aborted = shouldStop();
    // 未开工数按「写入名单减去真正有结果的科目」算，不按 collection 长度差 ——
    // 后者会把 failed 折进来的位置重复计入（round9 复核 N2）。
    const accounted = new Set(results.map((r) => r.code));
    const notStarted = writable.filter((a) => !accounted.has(a.code)).length;

    const written = results.filter((r) => r.action === 'written');
    const matched = written.filter((r) => r.match);
    const stale = results.filter((r) => r.action === 'stale');
    const errored = results.filter((r) => r.action === 'error');
    const partial = results.filter((r) => r.action === 'partial');
    const unread = results.filter((r) => r.action === 'unread');
    const stoppedAcc = results.filter((r) => r.action === 'stopped');
    if (aborted) {
      logFn(`⏹ 已中断：写入 ${written.length} 个科目；未开工 ${notStarted} 个`
        + `（本轮写入名单 ${writable.length} 个，计划科目共 ${taccounts.length} 个）。`
        + '在途请求已收完，不再发新的。', 'warn');
    } else {
      logFn(`✅ 完成：写入 ${written.length} 个科目，对账一致 ${matched.length}`, 'ok');
    }
    if (stoppedAcc.length) {
      logFn(`⏹ ${stoppedAcc.length} 个科目在写的过程中被停止：${stoppedAcc.map((s) => s.code).join(', ')}`
        + '（已写入的行留在平台上，未写完的部分没有补）', 'warn');
    }
    // 汇总口径：旧实现只统计 written/matched/stale/bad，error 与 partial 不在口径里 ⇒
    // 「有科目被略过」在汇总里不可见。被停止（stopped）单列，不算失败。
    if (errored.length || partial.length) {
      logFn(`❌ 失败 ${errored.length + partial.length} 个科目：`
        + `${[...errored, ...partial].map((s) => s.code + (s.reason ? `(${s.reason})` : '')).join(', ')}`, 'bad');
    }
    // 「写后复核读不到本科目」单列一档：它的行**可能已经写进去了**，只是没读到，
    // 既不能算成功也不能算失败，必须让人去看一眼（round10 定案：并发下读侧响应行集残缺）。
    if (unread.length) {
      logFn(`⚠ ${unread.length} 个科目写后复核读不到（结果未知，需人工确认）：`
        + `${unread.map((s) => s.code + (s.reason ? `(${s.reason})` : '')).join(', ')}`, 'bad');
    }
    if (stale.length) {
      logFn(`⚠ ${stale.length} 个科目平台上已有数据但与计划不匹配，本轮未动：`
        + `${stale.map((s) => s.code).join(', ')}`, 'warn');
      logFn('   这些是「普查之后平台状态又变了」的科目（普查阶段本会列进冲突清单让人裁决）。'
        + '再点一次本按钮即可重新普查。', 'warn');
    }
    const bad = written.filter((r) => !r.match);
    if (bad.length) {
      logFn(`⚠ 读回不一致：${bad.map((b) => b.code).join(', ')}`, 'warn');
    }
  }

  // ======================= 启动 =======================

  function boot() {
    // 面板宿主判定见 isPanelHostFrame()：顶层（非 frameset）或 name=main / MainWin 的内容框架。
    // 不再要求 `window.top === window.self` —— 在本平台上那等于「永远挂进 <frameset>」，即永不可见。
    if (!isPanelHostFrame()) return;
    if (document.getElementById('v2t-panel')) return;
    // 全页只挂一份：登记位放在顶层窗口（同源可写）。宿主文档被平台导航走之后，
    // 登记位上的那个窗口里就查不到面板了 ⇒ 新宿主（例如点开菜单后新加载的 MainWin）可重新挂载。
    // 这正是我们要的：面板跟着内容框架走。
    try {
      const prev = window.top.__v2tHost;
      if (prev && prev !== window && prev.document && prev.document.getElementById('v2t-panel')) return;
      window.top.__v2tHost = window;
    } catch { /* 跨域：放弃去重，退化为各自挂载 */ }

    const panel = buildUI();
    panel.querySelector('#v2t-clear-all').onclick = () => withEntry(panel, (e) => runClearEntry(e.ctx, e.year, e.month, e.logFn, panel));
    panel.querySelector('#v2t-run-teacher').onclick = () => withEntry(panel, (e) => runTeacherEntry(e.ctx, e.year, e.month, e.logFn, panel));
    panel.querySelector('#v2t-run-student').onclick = () => withEntry(panel, (e) => runStudentEntry(e.ctx, e.year, e.month, e.logFn, panel));
    panel.querySelector('#v2t-del-cache').onclick = () => withEntry(panel, (e) => runDelCacheEntry(e.logFn));
    panel.querySelector('#v2t-stop').onclick = () => {
      // 置位后主循环与内部长循环都会读它，真正中断；
      // 已经提交出去的一行不会回滚（平台无事务），所以日志要说清楚边界。
      stopRequested = true;
      uilog(panel, '⏹ 已请求停止，正在中断（当前正在提交的那一行会写完，其后不再写）', 'warn');
    };
    log('面板已注入 v3', window.top === window.self ? '(顶层文档)' : `(框架 ${window.name})`);
  }

  // 没有 document 就没有「面板宿主」这回事（例如把本文件当模块装配进离线验收台时）。
  // 加这道守卫是为了让脚本本身能被无 DOM 环境装载，从而能对 poolMap 这类纯逻辑单元做离线断言。
  if (typeof document === 'undefined') return;

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 800);
  } else {
    window.addEventListener('load', () => setTimeout(boot, 800));
  }
})();
