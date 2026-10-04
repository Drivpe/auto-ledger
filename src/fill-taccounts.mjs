// 把归集结果逐科目回填进平台 T 型账。
//
// === 平台机制（实测确认，勿凭直觉改） ===
//
// T 型账表单 v_dto6 的行字段有两种形态：
//   - 待填写的空白行：pzh_bz_i / debit_i / lend_i    （带 _i 后缀，永远只有一行）
//   - 已保存的行：    pzh_bz / debit / lend + TEMPid  （无后缀，每行一组，另有 CHECK_CONFIRM 勾选框）
//
// 「新增」按钮不是在前端插行，而是 v_dto6.start='insert' 提交表单：
//   把当前 _i 行的内容存进库 → 刷新 → 生成新的空 _i 行。
//
// 因此正确的写序列是：填 _i 行 → 点新增（保存并生成新空行）→ 重复。
// 全部加完后勾选 CHECK_CONFIRM → 「修改提交」（start='update_loop'）。
//
// === 安全设计（v2 重写） ===
//
// 1) **三锁硬闸门**。README 承诺「三锁全过才允许写平台」，但 v1 的 CLI 版全文无锁校验，
//    而它恰是唯一跑过全量 45 科目的那版 —— 两版安全语义不一致，这里补上真正闸门：
//    写平台前用 src/locks.mjs 重算三锁，并核对 out/taccounts.json 确实由 out/vouchers.json 归集而来。
//    闸门不过一律不登录、不写平台，退出码非 0（见 src/aggregate.mjs 同步修正）。
// 2) **幂等判据取服务端权威值，而不是「行数 > 0 即跳过」**。v1 用「已有行数 > 0」跳过，
//    实证把写入中断的残缺数据永久固化（out/fill-log-commit.txt：11:26 写到第 17 行失败留残缺，
//    11:38 重跑被判「平台已有 20 行，跳过」）。现改为：行数 === 拟写行数 **且** 服务端合计（或逐行求和）
//    与本地归集一致 —— 才算「已登记完成」可跳过；行数不符或金额不符一律判为残缺，拒绝跳过、
//    拒绝叠加写入，退出码非 0 要求人工清理（平台侧：全选 → 删除提交）。
// 3) **写回后对账用干净查询页，不用提交响应页**。v1 提交后只等 2.5s 就在残留页读「本期发生额」合计格；
//    提交响应页的表格模板与查询页不同，纯单边科目（借为 0 只有贷方）的合计格会被读进借方位，
//    造成假阴性 —— 这正是 5101/1101 被反复重写的主因（out/verify.json 已证伪「数据不一致」：
//    1702/2201/2801/6111 平台与本地完全一致）。现改为：提交后**重新查询**该科目再读回，
//    并以「逐行金额求和」作为独立第二判据，两者任一与本地一致即判一致，冲突时以逐行求和为准并告警。
//
// 用法：
//   node src/fill-taccounts.mjs [--only=1001] [--limit=3] [--sxid=...] [--entity=110]
//   node src/fill-taccounts.mjs --commit        # 真写平台（还要求 config.local.json 的 run.dryRun=false）
//
// 本文件不含任何 SXID / 姓名等敏感实值，一律走 src/platform.mjs 的配置读入口。

import { mkdirSync, writeFileSync, readFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ROOT, loadConfig, openSession, login,
  resolveContext, entryUrl, tAccountUrl, tAccountQuery, voucherListUrl, frameByNameOrNull,
} from './platform.mjs';
import { gateFromFiles, renderGate, judgeByLedger, judgeReadback } from './gate.mjs';

const cfg = loadConfig();
const OUT = resolve(ROOT, 'out');
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const has = (n) => args.includes(`--${n}`);

const WANT_COMMIT = has('commit');
// 双条件：命令行要 --commit，且配置里也把 dryRun 关掉。少任何一个都按演练跑 ——
// v1 的 `!COMMIT && (cfg.run?.dryRun !== false)` 在「配置关了 dryRun 但忘了传 --commit」时
// 会静默变成真提交，这里收紧。
const DRY = !(WANT_COMMIT && cfg.run?.dryRun === false);
const ONLY = flag('only');
const LIMIT = flag('limit') ? Number(flag('limit')) : null;
const THROTTLE = cfg.run?.throttleMs ?? 200;
// 上下文（SXID 等）在闸门之后才解析 —— 闸门是纯计算，不需要且不应依赖会话参数。
// 这样 `--gate-only` 能在完全不连平台、不提供 SXID 的前提下复现闸门判定。

const LOG = resolve(OUT, `fill-log-${DRY ? 'dry' : 'commit'}.txt`);
const log = (s) => {
  const line = `[${new Date().toISOString()}] ${s}`;
  console.log(line);
  appendFileSync(LOG, line + '\n');
};

const TACC_PATH = resolve(OUT, flag('taccounts') ?? 'taccounts.json');
const VOUCHERS_PATH = resolve(OUT, flag('vouchers') ?? 'vouchers.json');

/**
 * 解析 --peer 的路径。
 *
 * 陷阱（C 复核指出）：以前写的是 `resolve(OUT, flag('peer') ?? 'vouchers-student.json')`，
 * 于是 `--peer=.scratch/xxx.json`（相对路径）会被拼成 `out/.scratch/xxx.json` → 找不到 →
 * **完全静默地**落入 unavailable。安全方向没错（不会误判 pass），但对用户是陷阱。
 *
 * 现在：显式给了 --peer 时按**仓库根**解析相对路径（符合直觉）；仅默认值才落在 out/ 下。
 * 且文件不存在时打印显式告警 —— 不静默。
 */
const PEER_FLAG = flag('peer');
const PEER_PATH = PEER_FLAG ? resolve(ROOT, PEER_FLAG) : resolve(OUT, 'vouchers-student.json');
if (PEER_FLAG && !existsSync(PEER_PATH)) {
  console.warn(`⚠ --peer 指向的文件不存在：${PEER_PATH}`);
  console.warn('  （相对路径按仓库根解析；例如 --peer=.scratch/.../answer-vouchers.json）');
  console.warn('  锁三将因此未能执行（unavailable）—— 这不是「通过」，请看闸门输出的告警。');
}
if (!PEER_FLAG && !existsSync(PEER_PATH)) {
  console.warn(`提示：未找到对侧凭证 ${PEER_PATH}，锁三将未执行（unavailable）。`);
  console.warn('  要启用答案比对：node src/fetch-vouchers.mjs --side=student，或用 --peer=<凭证 json 路径> 直接指定。');
}

// ======================= 安全闸门（写平台前） =======================
//
// 闸门实现抽在 src/gate.mjs（纯计算，可离线单测）。此处只负责按当前路径组装输入。
// 关键：闸门在**登录之前**执行 —— 不过就不建立会话，平台侧一个字节都不碰。

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const gate = gateFromFiles(
  {
    taccPath: TACC_PATH,
    vouchersPath: VOUCHERS_PATH,
    peerPath: PEER_PATH,
    strictLock3: has('strict-lock3'),
  },
  readJson,
);

renderGate(gate, { log });
const GATE_BLOCKED = !gate.ok;

// --gate-only：只跑闸门并按其结果退出，不连平台、不需要 SXID。
// 存在的意义是让「闸门真的挡得住」这件事可被离线复现（见 B-report.md 的验证命令）。
if (has('gate-only')) {
  log(gate.ok
    ? '✅ 闸门放行（--gate-only，未连平台）'
    : `❌ 闸门拒绝写平台：${gate.reasons.join(' / ')}`);
  process.exit(gate.ok ? 0 : 1);
}

if (GATE_BLOCKED && !DRY) {
  log('❌ 安全闸门未通过，已停止：未登录平台、未写任何数据。');
  process.exit(1);
}

const ctx = resolveContext(cfg, args);

// 待写清单照常读入（即使闸门已拒），这样演练模式下仍能看到「本来要写什么」，
// 但真写分支在上面已经 exit(1) —— 闸门不过绝不会有平台写操作。
let taccounts = [];
try {
  taccounts = readJson(TACC_PATH);
} catch (e) {
  log(`❌ 读不到待写清单 ${TACC_PATH}：${e.message}`);
  log('   请先运行 node src/aggregate.mjs 生成 out/taccounts.json。');
  process.exit(2);
}
if (!Array.isArray(taccounts)) {
  log(`❌ ${TACC_PATH} 不是数组，格式不符。`);
  process.exit(2);
}

let targets = taccounts.filter((a) => a.entryCount > 0);
if (ONLY) targets = targets.filter((a) => a.code === ONLY);
if (LIMIT) targets = targets.slice(0, LIMIT);

if (!targets.length) {
  console.error(`没有匹配的科目（--only=${ONLY ?? '*'}, --limit=${LIMIT ?? '*'})`);
  process.exit(2);
}

// ======================= 页面求值函数（整体在浏览器上下文执行） =======================

/**
 * 等待 MainWin 达到期望的「已保存行数」。
 *
 * 关键教训（README 排除项，勿改）：点击「新增」触发的整页提交期间，**旧 DOM 依然存在**，
 * 仅判断「待填行是否存在」会立刻返回 ready，导致往即将销毁的 DOM 里填值 —— 值随导航丢失。
 * 唯一可靠的完成判据是**已保存行数真的增长了**。
 */
const waitSavedCount = async (page, target, timeoutMs = 25000) => {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const mw = page.frames().find((f) => f.name() === 'MainWin');
    if (mw) {
      try {
        last = await mw.evaluate(() => {
          // 文档级查询是 README 排除项：v_dto6 表体里的输入框不能用 form.querySelector 可靠定位
          const f = document.forms.v_dto6;
          return {
            saved: document.querySelectorAll('input[name="pzh_bz"]').length,
            ready: !!f?.querySelector('input[name="pzh_bz_i"]'),
            accountID: f?.elements.accountID?.value ?? null,
          };
        });
        if (last.saved === target && last.ready) return { ok: true, mw, ...last };
      } catch {
        // 导航中，继续等
      }
    }
    await page.waitForTimeout(200);
  }
  return { ok: false, mw: page.frames().find((f) => f.name() === 'MainWin'), ...(last || {}) };
};

/**
 * 读取当前 T 型账状态：已保存的行、待填行、本期发生额。
 *
 * 本期发生额给两组证据：
 *   - totalRows：所有含「本期发生额」的行的**全部单元格**（不同响应模板列数可能不同，全留证据）
 *   - sum：按已保存行逐行求和 —— 不依赖表头与合计行的列布局，是合计格错位时的独立第二判据
 */
const READ_STATE = () => {
  const num = (s) => {
    const v = String(s ?? '').replace(/[,\s\u00a0￥¥]/g, '');
    if (!v) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const form = document.forms.v_dto6;
  if (!form) return { saved: [], pending: null, total: null, totalRows: [], sum: { debit: 0, lend: 0 }, accountID: null };

  // 已保存行共用同名 pzh_bz/debit/lend，form.elements[name] 返回 RadioNodeList，
  // 其 .value 不是首元素的值。必须用 querySelectorAll 或按索引取。
  const pzEls = [...form.querySelectorAll('input[name="pzh_bz"]')];
  const dbEls = [...form.querySelectorAll('input[name="debit"]')];
  const lnEls = [...form.querySelectorAll('input[name="lend"]')];
  const ckEls = [...form.querySelectorAll('input[name="CHECK_CONFIRM"]')];

  const saved = pzEls.map((el, i) => ({
    idx: i,
    pzh: (el.value ?? '').trim(),
    debit: (dbEls[i]?.value ?? '').trim(),
    lend: (lnEls[i]?.value ?? '').trim(),
    checkId: ckEls[i]?.value ?? null,
    checked: ckEls[i]?.checked ?? false,
  }));

  const pending = {
    pzh: form.querySelector('input[name="pzh_bz_i"]')?.value ?? '',
    debit: form.querySelector('input[name="debit_i"]')?.value ?? '',
    lend: form.querySelector('input[name="lend_i"]')?.value ?? '',
  };

  // 本期发生额：按 td 定位，不用正则 —— 正则会因空单元格与负号而错位。
  const totalRows = [];
  for (const tr of document.querySelectorAll('tr')) {
    const tds = [...tr.cells];
    if (!tds.length) continue;
    if (!(tds[0].innerText || '').includes('本期发生额')) continue;
    totalRows.push(tds.map((td) => (td.innerText ?? '').trim()));
  }
  const total = totalRows.length
    ? { debit: totalRows[0][1] ?? '', lend: totalRows[0][2] ?? '' }
    : null;

  const sum = {
    debit: saved.reduce((s, r) => s + num(r.debit), 0),
    lend: saved.reduce((s, r) => s + num(r.lend), 0),
  };

  return {
    accountID: form.elements.accountID?.value ?? null,
    saved, pending, total, totalRows, sum,
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
  };
};

/** 填入待填行的三个字段。 */
const FILL_PENDING = (v) => {
  const form = document.forms.v_dto6;
  const put = (n, val) => {
    const el = form.elements[n];
    if (!el) return false;
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };
  return {
    pzh: put('pzh_bz_i', v.pzh),
    debit: put('debit_i', v.debit),
    lend: put('lend_i', v.lend),
  };
};

/** 点击「新增」：把待填行存进库并生成新空行。返回是否点成功。 */
const CLICK_ADD = () => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.innerText || '').includes('新增'));
  if (!btn) return false;
  btn.click();
  return true;
};

/** 勾选全部已保存行 + 点「修改提交」。 */
const SUBMIT_UPDATE = () => {
  const boxes = [...document.getElementsByName('CHECK_CONFIRM')];
  if (!boxes.length) return { ok: false, why: '没有可提交的行' };
  boxes.forEach((b) => { b.checked = true; });
  const btn = [...document.querySelectorAll('button')].find((b) => (b.innerText || '').includes('修改提交'));
  if (!btn) return { ok: false, why: '找不到修改提交按钮' };
  btn.click();
  return { ok: true, rows: boxes.length };
};

/**
 * 读凭证列表的「登账情况」列（工单 05:84-86 指定的服务端权威状态）。
 * 形态 `/4`（分母 = 该凭证应登的分录行数，分子为空 = 尚未登账）或 `2/2`（已登）。
 *
 * 列下标已被两份独立实测证据确证（不是推断）：
 *   - probe/out-txz-query.json → voucherList.tables[1]：9 列，表头
 *     年份|月份|日期|凭证号|摘要|备注|审核状态|登账情况|操作 → 凭证号=3、登账情况=7，
 *     15/15 条取值匹配 ^(\d*)/(\d+)$（样例 /4 /3 /2）
 *   - .scratch/.../evidence/teacher-list.html：同一 9 列表头序，记1 的登账情况为 4/4
 * 因此这里**按表头文本定位列下标**（不硬编码），表头变了也能自适应或明确报错。
 * 取不到返回 null，由调用方走降级保护（不静默当作通过）。
 */
const READ_LEDGER = () => {
  const table = [...document.querySelectorAll('table')].find((t) => {
    const heads = [...t.querySelectorAll('th')].map((th) => (th.innerText || '').trim());
    return heads.includes('登账情况');
  });
  if (!table) return null;

  const heads = [...table.querySelectorAll('th')].map((th) => (th.innerText || '').trim());
  const iLabel = heads.indexOf('凭证号');
  const iLedger = heads.indexOf('登账情况');
  if (iLedger < 0) return null;

  const rows = [];
  for (const tr of [...table.rows]) {
    const tds = [...tr.cells];
    if (tds.length <= iLedger) continue;
    const label = iLabel >= 0 ? (tds[iLabel]?.innerText || '').trim() : '';
    const ledger = (tds[iLedger]?.innerText || '').trim();
    if (!/^记\d+$/.test(label)) continue;
    const m = ledger.match(/^(\d*)\s*\/\s*(\d+)$/);
    rows.push({
      label,
      raw: ledger,
      done: m ? Number(m[1] || 0) : null,
      total: m ? Number(m[2]) : null,
    });
  }
  return rows.length ? rows : null;
};

// ======================= 主流程 =======================

const { browser, page, dialogs } = await openSession(cfg);
let exitCode = 0;

try {
  await login(page, cfg, dialogs);
  await page.goto(new URL(entryUrl(cfg, ctx), cfg.baseUrl).href, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(4000);

  const mf = page.frames().find((f) => f.name() === 'main');
  if (!mf) throw new Error('未找到名为 main 的 frame，请确认已进入实训企业');
  await mf.goto(new URL(tAccountUrl(cfg, ctx), cfg.baseUrl).href, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(4000);

  const getMw = () => page.frames().find((f) => f.name() === 'MainWin');
  let mw = getMw();
  if (!mw) throw new Error('未找到 MainWin，请先打开平台的「T型账」页面');

  log(`\n=== T 型账回填 ${DRY ? '【演练 · 不提交】' : '【真提交】'} ===`);
  if (WANT_COMMIT && cfg.run?.dryRun !== false) {
    log('⚠ 传了 --commit 但 config.local.json 的 run.dryRun 仍为 true，本次按演练执行（双条件收紧）。');
  }
  log(`上下文：entityID=${ctx.entityID} 年月=${ctx.year}/${ctx.month}`);
  log(`目标 ${targets.length} 个科目，共 ${targets.reduce((s, a) => s + a.entryCount, 0)} 笔分录`);

  // 登账情况（服务端权威幂等判据）读取器。
  //
  // 取数路径的修正（重要）：v1 期望凭证页签出现在名为 node_mainWin_uid_jzpz 的 frame 里，
  // 但 probe/out-txz-query.json 的实测显示凭证列表是在 **main** 里 goto jzpz_list 加载的
  // （probe/txz-query-probe.mjs:108-113）。因此原路径多半取不到 → 判据恒降级。
  //
  // 现用**独立的只读页面**去取（与 fetch-vouchers 抓详情同一手法）：
  //   · 不导航 mw / mf，绝不动正在用于写入的 T 型账 frameset
  //   · 复用同一 context，登录态自然共享
  //   · 取不到就返回 null，交给降级保护（此时若平台已有行则拒绝写入，不会叠加）
  let ledgerPage = null;
  const readLedgerRows = async (acc) => {
    // 1) 先试 T 型账 frameset 里是否直接带凭证页签（若平台确实提供了这条捷径，省一次导航）
    const named = frameByNameOrNull(page, 'node_mainWin_uid_jzpz');
    if (named) {
      try {
        const r = await named.evaluate(READ_LEDGER);
        if (r) return r;
      } catch {
        /* 落入下面的独立页面路径 */
      }
    }
    // 2) 独立只读页面取凭证列表
    try {
      if (!ledgerPage || ledgerPage.isClosed()) {
        ledgerPage = await page.context().newPage();
        ledgerPage.on('dialog', async (d) => { try { await d.dismiss(); } catch { /* 已关闭 */ } });
      }
      const url = voucherListUrl(ctx, 'answer');
      await ledgerPage.goto(new URL(url, cfg.baseUrl).href, { waitUntil: 'load', timeout: 30000 });
      await ledgerPage.waitForTimeout(1200);
      // 列表页可能在 main frame 里（平台是 frameset 结构）
      const mf2 = frameByNameOrNull(ledgerPage, 'main');
      const target = mf2 ?? ledgerPage.mainFrame();
      const rows = await target.evaluate(READ_LEDGER);
      if (rows) return rows;
      const top = await ledgerPage.mainFrame().evaluate(READ_LEDGER);
      return top ?? null;
    } catch (e) {
      log(`  ⚠ 登账情况取数失败：${e.message}`);
      return null;
    }
  };

  const ledgerBaseline = await readLedgerRows(null);
  log(ledgerBaseline
    ? `登账情况基线（服务端权威判据）：读到 ${ledgerBaseline.length} 张凭证，示例 ${ledgerBaseline.slice(0, 3).map((r) => r.label + ' ' + r.raw).join(' | ')}`
    : '登账情况基线：本页未提供凭证页签（node_mainWin_uid_jzpz），判据本轮不可用 —— 将显式降级，绝不用「行数 > 0」顶替');

  /**
   * 闸门断言 —— 真写路径上不可绕过的一道墙。
   *
   * 为什么用 throw 而不是 log 警告：v1 的 CLI 版压根没有门禁，而它恰是唯一跑过全量
   * 45 科目的那版。警告会被忽略，异常不会。这里在**即将发起任何写操作之前**再断言一次，
   * 确保即使未来有人加分支（演练/跳过/单科目调试），也无法在锁未过时写平台。
   */
  const assertGateOpen = () => {
    if (GATE_BLOCKED) {
      throw new Error('安全闸门未通过，拒绝写平台：' + gate.reasons.join(' / '));
    }
    if (!gate.lock) throw new Error('安全闸门未执行，拒绝写平台');
    // 锁三未执行（unavailable）不阻断写平台 —— 与油猴版语义统一（硬闸门 = 锁一 && 锁二）。
    // 但绝不静默：此处补一条与锁三无关的显式记录，避免「闸门放行」被误读成「三锁全过」。
    if (gate.lock.l3.status !== 'pass') {
      log(`  ⚠ 闸门放行但锁三未通过（status=${gate.lock.l3.status}，l3ok=false）—— 本次写入未获得答案比对层保证`);
    }
  };

  const summary = [];

  for (const acc of targets) {
    log(`\n──── 科目 ${acc.code} ${acc.name} ｜ 借 ${acc.debitTotal} 贷 ${acc.lendTotal} ｜ ${acc.entryCount} 笔 ────`);

    const plan = acc.entries.map((e) => ({
      // D4：凭证号列只填**凭证字号**（形态 `记1`），不带摘要 —— 与油猴版统一。
      // 平台该列语义是「凭证号/备注」，但任务口径要求只落字号。
      // 副作用边界（HANDOFF §六）：这会把已存的「记11 购入股票」重写成「记11」，
      // 是对**当前已正确**的数据做实质修改，平台不可回滚 ⇒ 必须配合 D6-bis 的
      // 「先清空再重写」，且改后要重新生成 webvpn-readback-45.md 基线。
      pzh: e.voucherLabel,
      debit: e.debit ? e.debit.toFixed(2) : '',
      lend: e.lend ? e.lend.toFixed(2) : '',
    }));

    // 1) 查询该科目（干净查询页）
    const q = tAccountQuery(ctx, acc.code);
    await mw.goto(new URL(q, cfg.baseUrl).href, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);
    mw = getMw();

    // 防御：确认页面已切到目标科目，避免读到上一科目的残留
    const onTarget = await mw.evaluate((code) => {
      const f = document.forms.v_dto6;
      return f?.elements.accountID?.value === code;
    }, acc.code);
    if (!onTarget) {
      log(`  ⚠ 页面未切到 ${acc.code}，跳过以免写错科目`);
      summary.push({ code: acc.code, name: acc.name, action: 'wrong-page' });
      exitCode = 1;
      continue;
    }

    const before = await mw.evaluate(READ_STATE);
    log(`  查询后：平台 T 型账已保存 ${before.saved.length} 行（仅作证据，不作为判据），`
      + `合计格 ${before.total?.debit ?? '-'} / ${before.total?.lend ?? '-'}，逐行求和 ${before.sum.debit.toFixed(2)} / ${before.sum.lend.toFixed(2)}`);

    // 2) 幂等 / 残缺判定 —— **服务端权威判据：凭证页签的「登账情况」列**。
    //
    // v1 这里写的是「平台已有行数 > 0 即跳过」。那是把残缺数据永久固化的元凶：
    // out/fill-log-commit.txt 实证 —— 11:26 某科目写到第 17 行失败留下残缺，
    // 11:38 重跑时被判「平台已有 20 行，跳过以免重复登记」，残缺就此固化。
    // 该判据现已整体删除，不再出现于本文件。行数只作为**证据打印**与一致性交叉检查，
    // 绝不单独决定「跳过」。
    //
    // 新判据的三种结论（都基于服务端状态，不基于本地记忆）：
    //   A 全部相关凭证「分子=分母」        → 已登记完成，跳过（真幂等）
    //   B 全部相关凭证分子为 0 且无残留行   → 未登记，正常回填
    //   C 其余（部分登账 / 分子为 0 但有残留行）→ 残缺或脏数据，拒绝跳过也拒绝叠加，退出码 1
    const ledgerRows = await readLedgerRows(acc);
    const ledgerVerdict = judgeByLedger(ledgerRows, acc, before.saved.length);
    log(`  服务端登账情况判定：${ledgerVerdict.summary}`);

    if (ledgerVerdict.decision === 'complete') {
      log(`  ⏭ ${ledgerVerdict.why}，跳过（判据：服务端「登账情况」列，非本地记忆）`);
      summary.push({ code: acc.code, name: acc.name, action: 'skipped-complete', evidence: ledgerVerdict.evidence });
      continue;
    }

    if (ledgerVerdict.decision === 'blocked') {
      log(`  ❌ ${ledgerVerdict.why}`);
      log('     拒绝跳过（会把残缺永久固化），也拒绝叠加写入（会写重）。');
      log('     清空办法（平台侧，不可逆，需人工确认）：到该科目 T 型账页面 → 全选 → 「删除提交」，然后重跑。');
      summary.push({
        code: acc.code, name: acc.name, action: 'dirty-blocked',
        why: ledgerVerdict.why, evidence: ledgerVerdict.evidence,
        taccountRows: before.saved.length,
        planRows: plan.length,
        local: { debit: acc.debitTotal, lend: acc.lendTotal },
      });
      exitCode = 1;
      continue;
    }

    if (DRY) {
      log(`  [演练] 拟写入 ${plan.length} 行，前 2 行：`);
      plan.slice(0, 2).forEach((p) => log(`        ${p.pzh} | 借 ${p.debit || '-'} | 贷 ${p.lend || '-'}`));
      summary.push({ code: acc.code, name: acc.name, action: 'dry', planned: plan.length });
      continue;
    }

    // ═══ 不可绕过的安全闸门断言 ═══
    // 这是「即将发生平台写操作」的最后一道关口。放在演练分支之后、任何点击之前：
    //   · 演练模式走不到这里（上面已 continue），但它本来就不写平台
    //   · 幂等/残缺分支也走不到这里（上面已 continue），同样不写平台
    //   · 因此「能到达这里」就等价于「马上要写平台」——此处断言最强
    // 闸门不过则 throw，由外层 catch 记录并置退出码 1，browser 在 finally 里关闭。
    assertGateOpen();

    // 3) 真提交：填 _i 行 → 点新增（保存）→ 重复
    let written = 0;
    let failedAt = null;
    let expectSaved = 0; // 每成功新增一行，平台已保存行数 +1

    for (let i = 0; i < plan.length; i++) {
      const p = plan[i];
      let done = false;

      for (let attempt = 1; attempt <= 3 && !done; attempt++) {
        // 1) 确保页面稳定且行数符合预期
        const st = await waitSavedCount(page, expectSaved, 25000);
        if (!st.ok) {
          log(`  ⚠ 第 ${i + 1} 行第 ${attempt} 次：等待行数=${expectSaved} 超时（当前 ${st.saved ?? '?'}）`);
          continue;
        }
        if (st.accountID !== acc.code) {
          log(`  ⚠ 第 ${i + 1} 行：页面科目变成了 ${st.accountID}，中止该科目`);
          break;
        }
        mw = st.mw;

        // 2) 填待填行
        const filled = await mw.evaluate(FILL_PENDING, p).catch(() => null);
        if (!filled?.pzh) {
          log(`  ⚠ 第 ${i + 1} 行第 ${attempt} 次：字段定位失败`);
          await page.waitForTimeout(600);
          continue;
        }

        // 3) 点「新增」并等待行数真正 +1
        const clicked = await mw.evaluate(CLICK_ADD).catch(() => false);
        if (!clicked) {
          log(`  ⚠ 第 ${i + 1} 行第 ${attempt} 次：找不到「新增」按钮`);
          await page.waitForTimeout(600);
          continue;
        }

        const grew = await waitSavedCount(page, expectSaved + 1, 25000);
        if (!grew.ok) {
          log(`  ⚠ 第 ${i + 1} 行第 ${attempt} 次：提交后行数未增长（当前 ${grew.saved ?? '?'}）`);
          continue;
        }

        expectSaved += 1;
        written += 1;
        done = true;
        if (THROTTLE) await page.waitForTimeout(THROTTLE);
      }

      if (!done) {
        failedAt = i + 1;
        log(`  ❌ 第 ${i + 1} 行连续 3 次失败，中止该科目（已写入 ${written} 行）`);
        break;
      }

      if ((i + 1) % 10 === 0 || i === plan.length - 1) {
        log(`  ✎ 已写入 ${written}/${plan.length} 行`);
      }
      const err = dialogs.filter((d) => /不能为空|错误|无效/.test(d.message));
      if (err.length) log(`  ⚠ 平台报错：${err.at(-1).message}`);
    }

    // 中止时如实记录，不把残缺结果当成功
    if (failedAt !== null) {
      summary.push({
        code: acc.code, name: acc.name, action: 'partial',
        written, planned: plan.length, failedAt,
      });
      log(`  ⚠ 科目 ${acc.code} 写入不完整（${written}/${plan.length}），跳过提交，残留数据需人工清理`);
      exitCode = 1;
      continue;
    }

    // 提交前等页面稳定（行数已达预期）
    const settled = await waitSavedCount(page, expectSaved, 15000);
    if (settled.mw) mw = settled.mw;

    // 4) 勾选全部 + 修改提交（也是写操作 —— 同样先过闸门断言）
    assertGateOpen();
    const sub = await mw.evaluate(SUBMIT_UPDATE);
    log(`  提交：${JSON.stringify(sub)}`);
    if (!sub.ok) {
      log(`  ❌ 提交未成功（${sub.why}），该科目平台侧仍为未提交状态，需重跑`);
      exitCode = 1;
    }

    // 5) 写回后对账：**重新查询**该科目，回到与写前同构的干净页面再读
    //    不能用提交响应页 —— 那张表的模板与查询页不同，纯单边科目的合计格会错位。
    await page.waitForTimeout(1500);
    mw = getMw();
    await mw.goto(new URL(q, cfg.baseUrl).href, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);
    mw = getMw();

    const after = await mw.evaluate(READ_STATE);
    // 判定交给 src/gate.mjs 的纯函数（judgeReadback），便于离线单测；此处只负责取数与落盘。
    const rb = judgeReadback({
      platformTotal: after.total,
      platformSum: after.sum,
      platformRows: after.saved.length,
      local: { debit: acc.debitTotal, lend: acc.lendTotal },
      expectedRows: plan.length,
    });
    const ok = rb.ok;

    if (rb.conflict) {
      log(`  ⚠ ${rb.reason}`);
      summary.push({
        code: acc.code, name: acc.name, action: 'read-method-conflict',
        detail: { totalOk: rb.totalOk, sumOk: rb.sumOk, totalRows: after.totalRows },
      });
    }
    log(`  读回（重新查询的干净页）：${after.saved.length} 行，合计格 ${after.total?.debit ?? '-'} / ${after.total?.lend ?? '-'}`
      + `，逐行求和 ${after.sum.debit.toFixed(2)} / ${after.sum.lend.toFixed(2)}  `
      + (ok ? `✅ 与本地归集一致（${rb.verdict}）` : `❌ 不一致：${rb.reason}`));
    if (!ok) exitCode = 1;

    summary.push({
      code: acc.code, name: acc.name, action: 'written',
      rows: after.saved.length,
      localDebit: acc.debitTotal, localLend: acc.lendTotal,
      platformDebit: rb.platform.debit, platformLend: rb.platform.lend,
      platformSumDebit: rb.platform.sumDebit, platformSumLend: rb.platform.sumLend,
      checks: { rowsOk: rb.rowsOk, totalOk: rb.totalOk, sumOk: rb.sumOk, conflict: rb.conflict },
      verdict: rb.verdict,
      match: ok,
    });
  }

  // 登账情况复查（只读，best-effort）
  const ledgerAfter = frameByNameOrNull(page, 'node_mainWin_uid_jzpz')
    ? await frameByNameOrNull(page, 'node_mainWin_uid_jzpz').evaluate(READ_LEDGER).catch(() => null)
    : null;
  if (ledgerAfter) {
    const done = ledgerAfter.filter((r) => r.done !== null && r.total !== null && r.done === r.total);
    log(`\n登账情况复查：读到 ${ledgerAfter.length} 张，已登满 ${done.length} 张`);
  }

  // 汇总
  log(`\n=== 汇总 ===`);
  const written = summary.filter((s) => s.action === 'written');
  const matched = written.filter((s) => s.match);
  const skipped = summary.filter((s) => s.action === 'skipped-complete');
  const dirty = summary.filter((s) => s.action === 'dirty-blocked');
  const partial = summary.filter((s) => s.action === 'partial');
  log(`本侧登记完成跳过 ${skipped.length}，本次写入 ${written.length}，对账一致 ${matched.length}`);
  if (dirty.length) log(`⛔ 残缺/不一致而被拦下的科目 ${dirty.length}：${dirty.map((s) => s.code + ' ' + s.name).join(', ')}`);
  if (partial.length) log(`⚠ 写入不完整 ${partial.length}：${partial.map((s) => s.code).join(', ')}`);
  const bad = written.filter((s) => !s.match);
  if (bad.length) log(`不一致科目：${bad.map((s) => s.code + ' ' + s.name).join(', ')}`);
  log(`平台弹窗 ${dialogs.length} 条：${dialogs.map((d) => d.message).join(' | ') || '（无）'}`);

  writeFileSync(resolve(OUT, `fill-summary-${DRY ? 'dry' : 'commit'}.json`), JSON.stringify(summary, null, 2));
  log(`产出：out/fill-summary-${DRY ? 'dry' : 'commit'}.json`);
  if (dirty.length || partial.length || bad.length) exitCode = 1;
} catch (e) {
  log(`中断: ${e.message}\n${e.stack}`);
  exitCode = 1;
} finally {
  try { if (ledgerPage && !ledgerPage.isClosed()) await ledgerPage.close(); } catch { /* 已关闭 */ }
  await browser.close();
}

if (DRY) log('\n演练结束：未向平台写入任何数据。');
if (GATE_BLOCKED) {
  log('❌ 安全闸门未通过（演练模式）：下面这份计划不可用于回填，先修数据。');
  exitCode = 1;
} else if (gate.lock && gate.lock.l3.status !== 'pass') {
  // 不阻断，但必须显眼 —— 免得「闸门放行」被读成「三锁全过」
  log(`⚠ 闸门放行，但锁三 status=${gate.lock.l3.status}（l3ok=false）：`
    + (gate.lock.l3.status === 'unavailable'
      ? '锁三未执行（无对侧数据），建议先跑 --side=student'
      : `比对发现 ${gate.lock.l3.diffCount} 处差异`));
}
if (exitCode) log(`退出码 ${exitCode}：存在需人工处置的项。`);
process.exitCode = exitCode;