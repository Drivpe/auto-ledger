// 写平台前的安全闸门（纯计算，不接触浏览器、不启动会话、不写任何平台数据）。
//
// 为什么单独成模块：这是「README 承诺三锁全过才写平台」与「CLI 版曾完全没有门禁」之间的那道墙。
// 抽出来后可被单测直接调用 —— 不需要连平台就能证明「锁不过时真的会被拦」，
// 这比事后读代码更可信（此前弱的那版恰是唯一跑过全量 45 科目的那版）。
//
// 闸门判据（与油猴版语义统一；任一不满足即拒绝写平台）：
//   1) 待写的 taccounts.json 必须确实由 vouchers.json 归集而来（逐科目金额 + 分录笔数）
//   2) **硬闸门 = 锁一 && 锁二**（与油猴版 `if (!(lock.l1ok && lock.l2ok)) return;` 一致）
//   3) 锁三 fail（本侧数据不可用）→ 阻断
//   4) 锁三 diff（比对做了且有差异）→ 不阻断（v2 决策 5「提示后继续」）；--strict-lock3 可收紧
//   5) 锁三 unavailable（对侧无数据，比对没做）→ **不阻断**，但显著告警 +
//      summary 落 action:'lock3-unavailable'。理由：换人/换任务时对侧数据多半不存在，
//      若阻断则 v2 的「可复用性」核心目标被堵死。注意 unavailable/diff 下 l3ok 恒为 false，
//      「不阻断」不等于「判过」，输出文案必须明确写「锁三未执行」。
//   6) 目标科目集合不得为空
//
// 本模块不含任何借贷总平衡形态的锁三判据 —— 那种式子（aD === aC）是锁二的逻辑子集，
// 保留它等于没做锁三。见 src/locks.mjs 顶部说明。

import { existsSync } from 'node:fs';
import { aggregate, tripleLock, toFen } from './locks.mjs';

/** 逐科目核对：待写的 tacc 是否确实由给定 vouchers 归集而来。返回不符项的说明列表。 */
export function compareWithSource(tacc, vouchers) {
  const recomputed = aggregate(vouchers);
  const drift = [];
  const A = new Map(tacc.map((a) => [a.code, a]));
  const B = new Map(recomputed.map((a) => [a.code, a]));

  for (const code of new Set([...A.keys(), ...B.keys()])) {
    const a = A.get(code);
    const b = B.get(code);
    if (!a || !b) {
      drift.push(`${code}: ${a ? '仅存在于待写文件' : '仅存在于重算结果'}`);
      continue;
    }
    if (toFen(a.debitTotal) !== toFen(b.debitTotal) || toFen(a.lendTotal) !== toFen(b.lendTotal)) {
      drift.push(`${code}: 金额不符 待写 ${a.debitTotal}/${a.lendTotal} vs 重算 ${b.debitTotal}/${b.lendTotal}`);
    }
    if ((a.entries?.length ?? 0) !== (b.entries?.length ?? 0)) {
      drift.push(`${code}: 分录笔数不符 待写 ${a.entries?.length} vs 重算 ${b.entries?.length}`);
    }
  }
  return { drift, recomputed };
}

/**
 * 闸门主函数。全部输入由调用方给出（此处不读 fs，不做路径假设），因此可离线单测。
 *
 * @param tacc           待写入的归集结果（out/taccounts.json 的内容）
 * @param vouchers       主数据源凭证（与其对应的 out/vouchers.json）
 * @param peerVouchers   对侧凭证，用于锁三比对；可为 null
 * @param targets        实际要写的科目（已按 --only / --limit 过滤）
 * @param opts.strictLock3  true 时锁三有差异也阻断（默认 false，遵循 v2 决策「提示后继续」）
 */
export function gateCheck({ tacc, vouchers, peerVouchers = null, targets = null, strictLock3 = false }) {
  if (!Array.isArray(tacc) || !tacc.length) {
    return { ok: false, reasons: ['待写归集结果为空'], lock: null, drift: [] };
  }
  const { drift, recomputed } = compareWithSource(tacc, vouchers);
  const lock = tripleLock(vouchers, recomputed, { peerVouchers, strictLock3 });
  const t = targets ?? tacc.filter((a) => a.entryCount > 0);

  const reasons = [];
  if (drift.length) reasons.push(`待写 taccounts.json 与 vouchers.json 归集结果有 ${drift.length} 处不符`);
  if (!lock.l1ok) reasons.push(`锁一未过（${lock.l1Bad.length} 处逐张凭证不平）`);
  if (!lock.l2ok) reasons.push('锁二未过（归集双向不闭合）');
  // 锁三 fail = 本侧数据不可用，归集/抓取环节真出错 → 阻断
  if (lock.l3.status === 'fail') reasons.push(`锁三未过（fail）：${lock.l3.reason ?? '本侧数据不可用'}`);
  if (strictLock3 && lock.l3.status !== 'pass') {
    reasons.push(`锁三 ${lock.l3.status} 且 strictLock3=true（${lock.l3.diffCount ?? 0} 处差异）`);
  }
  if (!t.length) reasons.push('目标科目集合为空');

  // 非阻断的告警项（不参与 ok，但调用方必须打印）——「不阻断」绝不等于「静默判过」
  const warnings = [];
  if (lock.l3.status === 'unavailable') {
    warnings.push(`锁三未执行（无对侧数据）：${lock.l3.reason}。`
      + '按 v2 决策继续写平台（可复用性优先）；建议先跑 node src/fetch-vouchers.mjs --side=student 以启用比对。');
  }
  if (lock.l3.status === 'diff') {
    warnings.push(`锁三比对发现 ${lock.l3.diffCount} 处差异，按 v2 决策 5「提示后继续」，不阻断。`);
  }

  return {
    ok: reasons.length === 0,
    reasons,
    warnings,
    /** 硬闸门是否通过（锁一 && 锁二；与油猴版一致） */
    hardGateOk: lock.hardGateOk,
    /** 锁三是否执行了比对（区别于是否通过） */
    lock3Ran: lock.l3Ran,
    lock,
    drift,
    recomputed,
    targets: t,
  };
}

/** 把闸门结果渲染成日志行（供 CLI 与报告共用同一份措辞）。 */
export function renderGate(g, { log = console.log } = {}) {
  log('══ 写前安全闸门（三锁 + 数据源一致性） ══');
  if (!g.lock) {
    for (const r of g.reasons) log(`  ❌ ${r}`);
    return;
  }
  const L = g.lock;
  log(`  锁一 逐张凭证平衡：${L.l1ok ? '通过' : `失败 ${L.l1Bad.length} 处`}`);
  log(`  锁二 归集双向闭合：${L.l2ok ? '通过' : '失败'}`);
  log(`     凭证累加 借 ${L.l2.voucherDebit} / 贷 ${L.l2.voucherLend}`);
  log(`     科目归集 借 ${L.l2.accountDebit} / 贷 ${L.l2.accountLend}`);

  const l3 = L.l3;
  // 以下三段文案是刻意固定、可 grep 的（便于复核与将来排障）：
  //   pass        → 「三锁全过」
  //   unavailable → 「锁一/锁二通过，锁三未执行（无对侧数据），按 v2 决策继续」
  //   diff        → 「锁三比对发现 N 处差异，按决策继续」
  if (l3.status === 'pass') {
    log(`  锁三 答案 vs 学生对侧凭证比对：通过（${l3.compared} 张，指纹配对 + 按行归一化）`);
  } else if (l3.status === 'unavailable') {
    log(`  锁三 答案 vs 学生对侧凭证比对：⚠ 未执行 —— ${l3.reason}`);
  } else if (l3.status === 'diff') {
    log(`  锁三 答案 vs 学生对侧凭证比对：有差异 ${l3.diffCount} 处`);
    for (const d of (l3.diff || []).slice(0, 5)) log(`     · ${d.fingerprint} ${d.note}（本侧 ${d.left} / 对侧 ${d.right}）`);
  } else if (l3.status === 'fail') {
    log(`  锁三 ❌ fail：${l3.reason} —— 本侧数据不可用，归集/抓取环节出错`);
  } else {
    log(`  锁三 无法判定：${l3.reason}`);
  }

  log(`  数据源一致性：${g.drift.length ? `❌ ${g.drift.length} 处不符` : '✅ 待写结果与主数据源归集结果逐科目一致'}`);
  for (const d of g.drift.slice(0, 10)) log(`     · ${d}`);

  // ── 结论文案（三句话必须可被 grep）──
  if (!g.ok) {
    log('  闸门判定：❌ 拒绝写平台');
    for (const r of g.reasons) log(`     ✗ ${r}`);
    return;
  }
  log('  闸门判定：✅ 允许进入回填（硬闸门 = 锁一 && 锁二）');
  if (l3.status === 'pass') {
    log(`  ✅ 三锁全过 —— 借贷合计 借 ${L.totalDebit} / 贷 ${L.totalLend}`);
  } else if (l3.status === 'unavailable') {
    log('  ⚠ 锁一/锁二通过，锁三未执行（无对侧数据），按 v2 决策继续；'
      + '建议先跑 node src/fetch-vouchers.mjs --side=student 以启用比对');
    log('    注意：锁三未执行 ≠ 锁三通过（l3ok=false），本次写平台未获得「与答案逐张比对」这一层保证。');
  } else if (l3.status === 'diff') {
    log(`  ⚠ 锁三比对发现 ${l3.diffCount} 处差异，按决策继续（不阻断）`);
  }
  for (const w of g.warnings ?? []) log(`  ⚠ ${w}`);
}

/** 便捷入口：从文件路径组装并校验。fsRead 由调用方注入（便于测试时替换）。 */
export function gateFromFiles({ taccPath, vouchersPath, peerPath, strictLock3 = false }, fsRead) {
  if (!existsSync(taccPath)) {
    return { ok: false, reasons: [`找不到待写文件 ${taccPath}（先跑 node src/aggregate.mjs）`], lock: null, drift: [], recomputed: null };
  }
  if (!existsSync(vouchersPath)) {
    return { ok: false, reasons: [`找不到主数据源 ${vouchersPath}（先跑 node src/fetch-vouchers.mjs）`], lock: null, drift: [], recomputed: null };
  }
  const tacc = fsRead(taccPath);
  const vouchers = fsRead(vouchersPath);
  const peerVouchers = peerPath && existsSync(peerPath) ? fsRead(peerPath) : null;
  return gateCheck({ tacc, vouchers, peerVouchers, strictLock3 });
}

/**
 * 写回后对账判定（纯函数，可离线单测）。
 *
 * 背景 —— 这是「fill 侧对账假阴性」的修法落点。
 * v1 在提交后只等 2.5s 就在**提交响应页**读「本期发生额」的 td[1]/td[2] 当借/贷。
 * 提交响应页的表格模板与干净查询页不同（响应页的合计行前面多一列），于是 td[1] 落在
 * 借方而不是贷方：纯单边科目（本地借 0、只有贷方）被读成「借=贷方金额、贷=空」→ 误判 ❌。
 *
 * 实证（out/fill-log-commit.txt × out/verify.json 同一科目对比）：
 *   1702 累计摊销  本地 0/5308.33 | fill 读回 5308.33/空 ❌ | verify 读回 0/5308.33 ✅
 *   2201 应付票据  本地 0/278520  | fill 读回 278520.00/空 ❌ | verify 读回 0/278520  ✅
 *   2801 预计负债  本地 0/69592   | fill 读回 69592.00/空 ❌ | verify 读回 0/69592   ✅
 *   6111 投资收益  本地 -220/-220 | fill 读回 空/空 ❌        | verify 读回 -220/-220 ✅
 *   → 同一读法在干净查询页全部读对，证明问题出在**读哪个页面**，不是解析本身。这是 5101/1101 被反复重写的主因。
 *
 * 修法：
 *   1) 提交后**重新查询**该科目，回到与写前同构的干净页面再读（见 fill 主流程第 5 步）
 *   2) 判据双轨：合计格 + **逐行求和**（逐行求和不依赖表头与合计行的列布局，合计格错位时仍准）
 *   3) 两轨冲突时以逐行求和为准，并把冲突写进 summary 与日志（不静默取一个）
 *
 * @returns { ok, rowsOk, totalOk, sumOk, conflict, verdict, reason }
 */
export function judgeReadback({ platformTotal, platformSum, platformRows, local, expectedRows, eps = 0.01 }) {
  const num = (s) => {
    const v = String(s ?? '').replace(/[,\s\u00a0￥¥]/g, '');
    if (!v) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const pDebit = num(platformTotal?.debit);
  const pLend = num(platformTotal?.lend);
  const totalOk = Math.abs(pDebit - local.debit) < eps && Math.abs(pLend - local.lend) < eps;
  const sumOk = Math.abs(platformSum.debit - local.debit) < eps && Math.abs(platformSum.lend - local.lend) < eps;
  const rowsOk = platformRows === expectedRows;
  const conflict = totalOk !== sumOk;
  // 以逐行求和为准（列布局无关）；两轨一致时用合计格措辞
  const moneyOk = sumOk;
  const ok = rowsOk && moneyOk;

  const verdict = totalOk && sumOk ? '合计格+逐行求和一致'
    : sumOk ? '逐行求和一致（合计格不一致 —— 疑似列错位，按逐行求和判定）'
      : totalOk ? '合计格一致（逐行求和不一致 —— 需人工核对行值）'
        : '两轨均不一致';

  let reason = '';
  if (!moneyOk) reason = `金额不符：平台逐行求和 ${platformSum.debit}/${platformSum.lend}，本地 ${local.debit}/${local.lend}`;
  else if (!rowsOk) reason = `行数不符：平台 ${platformRows} 行，期望 ${expectedRows} 行`;
  else if (conflict) reason = '两轨读法结论不同，已按逐行求和判定，请人工核对合计行原始单元格';

  return {
    ok, rowsOk, totalOk, sumOk, conflict, verdict, reason,
    platform: { debit: pDebit, lend: pLend, sumDebit: platformSum.debit, sumLend: platformSum.lend, rows: platformRows },
  };
}

/**
 * 依据服务端「登账情况」列判定某科目的登记状态（纯函数，可离线单测）。
 *
 * 与科目相关的凭证 = 该科目 entries 里出现过的凭证号（记N）。平台对「登账情况」的定义是
 * 「该凭证的已登分录数 / 应登分录数」，所以集合口径要与凭证号对齐。
 *
 * @param ledgerRows READ_LEDGER 的结果；null 表示该页不可用
 * @param acc        本次要写的科目（含 entries[].voucherLabel）
 * @param taccRows   平台 T 型账当前已保存行数。
 *                   **注意：这不是「跳过」的判据**（那是 v1 的缺陷），而是**降级路径下的写入保护** ——
 *                   判据缺失且 taccRows>0 时拒绝写入。详见下方 degradedDecision 的说明。
 */
export function judgeByLedger(ledgerRows, acc, taccRows) {
  const want = [...new Set((acc.entries ?? []).map((e) => e.voucherLabel).filter(Boolean))];
  const planRows = (acc.entries ?? []).length;

  /**
   * 降级路径的统一保护（判据缺失或匹配不到凭证时走这里）。
   *
   * ⚠ 与「绝不退回『行数 > 0 即跳过』」的区别 —— 务必看清，别误读为回退旧判据：
   *   旧判据用行数决定**跳过**（乐观方向）：一行都不写，把可能残缺的数据当成已完成，
   *   于是残缺被永久固化。那是 v1 事故的直接成因。
   *   这里的保护用行数决定**拒绝写入**（保守方向）：不跳过、也不叠加，直接拦住交人工。
   *   两者方向相反。**跳过的判据必须是服务端权威值（登账情况列）；行数只能用于拒绝写入。**
   *
   * 为什么必须拦：判据缺失时，平台已有行与本地计划无法互证 ——
   *   安全跳过？没依据（可能把残缺当完成固化）。
   *   安全叠加？没依据（残留 + 计划 = 行数翻倍，比 v1 更糟）。
   * 因此 taccRows > 0 时一律 blocked，退出码 1，交人工核对/清理。
   * taccRows === 0 才是真正干净、可安全回填的状态。
   */
  const degradedDecision = (reason, extraEvidence = {}) => {
    const evidence = {
      ledger: 'unavailable',
      want,
      wantCount: want.length,
      planRows,
      taccRows,
      // 与主路径同口径，便于人工判断残留是否等于「上次写了一半」
      rowsVsPlan: taccRows === planRows ? 'equal' : (taccRows > planRows ? 'platform-more' : 'platform-less'),
      ...extraEvidence,
    };
    if (taccRows > 0) {
      return {
        decision: 'blocked',
        degraded: true,
        why: `${reason}；且平台该科目已有 ${taccRows} 行残留（本地计划 ${planRows} 行）`,
        summary: `❌ 判据缺失 + 平台有残留行 → 拒绝写入（既不敢跳过以免固化残缺，也不敢叠加以免写重）`,
        evidence,
      };
    }
    return {
      decision: 'proceed',
      degraded: true,
      why: `${reason}；平台该科目 0 行，属干净未登记状态`,
      summary: `⚠ 判据缺失，但平台 0 行 → 按未登记处理，可安全回填`,
      evidence,
    };
  };

  if (!ledgerRows) {
    return degradedDecision('凭证页签（登账情况）不可用，服务端权威判据缺失');
  }

  const rows = ledgerRows.filter((r) => want.includes(r.label));
  const unknown = rows.filter((r) => r.done === null || r.total === null);
  const doneRows = rows.filter((r) => r.total > 0 && r.done === r.total);
  const zeroRows = rows.filter((r) => r.done === 0);

  const evidence = {
    wantCount: want.length,
    matched: rows.length,
    done: doneRows.length,
    zero: zeroRows.length,
    partial: rows.length - doneRows.length - zeroRows.length,
    unknown: unknown.length,
    planRows,
    taccRows,
    /** 行数与计划是否吻合 —— 降级时供人工判断残留是否等于「上次写了一半」 */
    rowsVsPlan: taccRows === planRows ? 'equal' : (taccRows > planRows ? 'platform-more' : 'platform-less'),
    sample: rows.slice(0, 3).map((r) => `${r.label} ${r.raw}`),
  };

  if (!rows.length) {
    return degradedDecision(
      `登账情况列里没有本次涉及的任何凭证（想找 ${want.length} 张，匹配 0 张）`,
      { matched: 0 },
    );
  }

  // A 全部已登满 → 真幂等跳过
  if (doneRows.length === rows.length && taccRows > 0) {
    return {
      decision: 'complete',
      why: `本次涉及的 ${rows.length} 张凭证「登账情况」全部分子=分母，且 T 型账有 ${taccRows} 行`,
      summary: `✅ 已登记完成（${doneRows.length}/${rows.length} 张凭证登满，T 型账 ${taccRows} 行）`,
      evidence,
    };
  }

  // B 全部未登账（分子 0）且 T 型账无残留行 → 正常回填
  if (zeroRows.length === rows.length && taccRows === 0) {
    return {
      decision: 'proceed',
      why: '全部凭证分子为 0 且 T 型账无残留行',
      summary: `✅ 未登记（0/${rows.length} 张凭证已登，T 型账 0 行），可回填`,
      evidence,
    };
  }

  // C 其余 → 残缺/脏数据，拦下
  const bits = [];
  if (zeroRows.length && taccRows > 0) bits.push(`有 ${taccRows} 行 T 型账残留，但相关凭证分子仍为 0（${zeroRows.length} 张未登）`);
  if (doneRows.length && doneRows.length < rows.length) bits.push(`${doneRows.length}/${rows.length} 张已登满，其余未登 — 上次写入中断`);
  if (evidence.partial) bits.push(`${evidence.partial} 张凭证处于「部分登账」中间态`);
  if (unknown.length) bits.push(`${unknown.length} 张凭证登账情况格无法解析`);

  return {
    decision: 'blocked',
    why: `服务端状态不一致：${bits.join('；') || '登账情况与 T 型账行数不互相印证'}`,
    summary: `❌ 判定为残缺/不一致（${JSON.stringify(evidence)}）`,
    evidence,
  };
}
