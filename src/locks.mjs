// 统一的三重锁实现（纯计算，不接触浏览器、不写平台）。
//
// 为什么单独成文件：CLI 版此前把三锁写在 aggregate.mjs 里，而 fill-taccounts.mjs
// 完全没有门禁 —— 两版安全语义不一致，且弱的那版是唯一跑过全量 45 科目的那版。
// 抽出共享模块后，aggregate 与 fill 校验的是**同一份实现**，语义不可能再漂移。
//
// 三锁定义（见 .scratch/voucher2t-taccount/issues/07-validation-triple-lock.md 与 v2 决策）：
//   锁一 · 逐张凭证借贷平衡（独立复算 + 与平台自报合计对照）
//   锁二 · 归集双向闭合（凭证逐笔累加 vs 科目归集后累加，四项全等）
//   锁三 · **答案 vs 学生凭证比对**
//
// 关于锁三（v2 最重要的定位修正）：
//   原锁三是 `l3ok = aD === aC`（全部科目借方合计 = 贷方合计）。它是锁二的**逻辑子集**：
//   `l2ok = vD===vC && aD===aC && vD===aD && vC===aC` 蕴含 `aD===aC`，即 l2ok ⇒ l3ok。
//   零增量信息 —— 保留它等于没做锁三。故本文件**不含任何借贷总平衡形态的锁三式子**。
//   新锁三只做一件事：把两侧凭证折算成「借方合计指纹 -> 归一化行签名多重集」后比对。
//
//   锁三的三档语义（与油猴版一致，见 userscript/auto-ledger.user.js 硬闸门 `l1ok && l2ok`）：
//     pass        —— 比对**执行成功**且两侧一致
//     diff        —— 比对执行成功，但有实质差异        → 不阻断（v2 决策 5「提示后继续」）
//     unavailable —— 拿不到对侧数据，比对**未执行**     → 不阻断，但必须显著告警
//     fail        —— 本侧数据本身不可用（如无任何凭证） → 阻断（归集/抓取环节出错）
//
//   「不阻断」不等于「判过」：unavailable / diff 时 l3ok 仍为 false，只是不单独阻挡写平台。
//   硬闸门始终是 `l1ok && l2ok`（外加锁三 fail）。这样「换一个人、换一个任务」时学生侧
//   数据不存在也能照常使用（可复用性），但日志里绝不会静默伪装成「锁三通过」。

/** 金额以「分」整数结算，避免浮点误差。 */
export const toFen = (yuan) => Math.round(Number(yuan) * 100);
export const toYuan = (fen) => Number((fen / 100).toFixed(2));

/**
 * 归集：按一级科目（4 位）汇总借贷发生额。
 * 平台口径 —— T 型账与科目汇总表走一级科目；明细科目仅用于明细账/期初表。
 * 每笔分录保留来源凭证号，供 T 型账「凭证号/备注」列回填。
 */
export function aggregate(vouchers) {
  const acc = new Map(); // code -> { code, name, entries: [], debitFen, lendFen }

  for (const v of vouchers) {
    for (const l of v.lines || []) {
      const code = l.accountCode;
      if (!code) continue;
      const debitFen = toFen(l.debit);
      const lendFen = toFen(l.lend);
      if (debitFen === 0 && lendFen === 0) continue;

      if (!acc.has(code)) {
        acc.set(code, { code, name: l.accountName || '', entries: [], debitFen: 0, lendFen: 0 });
      }
      const a = acc.get(code);
      if (!a.name && l.accountName) a.name = l.accountName;
      a.debitFen += debitFen;
      a.lendFen += lendFen;

      // T 型账「凭证号/备注」列：登记来源凭证
      a.entries.push({
        voucherLabel: v.label,
        voucherNo: v.voucherNo,
        date: v.date,
        summary: l.summary || '',
        detail: l.accountDetail || '',
        detailName: l.detailName || '',
        debit: toYuan(debitFen),
        lend: toYuan(lendFen),
      });
    }
  }

  return [...acc.values()]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((a) => ({
      code: a.code,
      name: a.name,
      debitTotal: toYuan(a.debitFen),
      lendTotal: toYuan(a.lendFen),
      entryCount: a.entries.length,
      entries: a.entries,
    }));
}

/** 锁一：每张凭证借贷各自平衡（平台的凭证表体自带合计，此处独立复算并对照）。 */
export function lock1(vouchers) {
  const bad = [];
  for (const v of vouchers) {
    const d = (v.lines || []).reduce((s, l) => s + toFen(l.debit), 0);
    const c = (v.lines || []).reduce((s, l) => s + toFen(l.lend), 0);
    if (d !== c) bad.push({ label: v.label, debit: toYuan(d), lend: toYuan(c), diff: toYuan(d - c) });
    // 与平台自报合计对照
    if (v.totalDebit != null && toFen(v.totalDebit) !== d) {
      bad.push({ label: v.label, note: '与平台凭证合计不符', platform: v.totalDebit, computed: toYuan(d) });
    }
  }
  return bad;
}

/** 锁二：归集结果与凭证总额双向闭合（四项全等）。 */
export function lock2(vouchers, taccounts) {
  const vDebit = vouchers.reduce((s, v) => s + (v.lines || []).reduce((t, l) => t + toFen(l.debit), 0), 0);
  const vLend = vouchers.reduce((s, v) => s + (v.lines || []).reduce((t, l) => t + toFen(l.lend), 0), 0);
  const aDebit = taccounts.reduce((s, a) => s + toFen(a.debitTotal), 0);
  const aLend = taccounts.reduce((s, a) => s + toFen(a.lendTotal), 0);
  return {
    voucherDebit: toYuan(vDebit),
    voucherLend: toYuan(vLend),
    accountDebit: toYuan(aDebit),
    accountLend: toYuan(aLend),
    balanced: vDebit === vLend && aDebit === aLend && vDebit === aDebit && vLend === aLend,
  };
}

/** 一张凭证的「借方合计指纹」——答案与学生两侧编号错位，不能按号配对，只能按金额指纹配对。 */
const fingerprintOf = (v) => toFen((v.lines || []).reduce((s, l) => s + toFen(l.debit), 0));

/**
 * 一张凭证的归一化行签名：科目码 + 明细码 + 借 + 贷，行序无关。
 * 实测背景：答案与学生 103 张逐笔一致，但行序不同、编号错位（学生缺 62 号，记63 起整体后移一格）。
 */
const rowSignature = (v) =>
  (v.lines || [])
    .filter((l) => l.accountCode)
    .map((l) => `${l.accountCode}|${l.accountDetail || ''}|${toFen(l.debit)}|${toFen(l.lend)}`)
    .sort()
    .join(';');

/** 把凭证集合折算成「指纹 -> 归一化行签名多重集」，多重集用计数 Map 表示。 */
function fingerprintIndex(vouchers) {
  const idx = new Map();
  for (const v of vouchers) {
    const key = String(fingerprintOf(v));
    const sig = rowSignature(v);
    if (!idx.has(key)) idx.set(key, new Map());
    const bucket = idx.get(key);
    bucket.set(sig, (bucket.get(sig) || 0) + 1);
  }
  return idx;
}

/**
 * 锁三（v2 定位）：答案 vs 学生凭证比对。
 *
 * 判据：把两侧都折算成「借方合计指纹 -> 归一化行签名多重集」，两个索引必须完全相等。
 * 这样既容忍编号错位与行序差异，又能捕获「某张凭证少了/多了一行」这类实质差异。
 *
 * 无对侧数据时返回 status='unavailable'（**不阻断**，但 l3ok=false + 调用方必须显著告警）；
 * 本侧数据为空时返回 status='fail'（**阻断**）。
 * 这里绝不返回 'pass'、也绝不退化成借贷总平衡，正是为了不让「锁三没做」被读成「锁三通过」。
 */
export function lock3Peer(primary, peer) {
  // 本侧数据不可用 → 'fail'（归集/抓取环节出错，属真问题，必须阻断）。
  // 这与 'unavailable'（对侧没有数据，属常态）是两回事，不可混为一谈。
  if (!Array.isArray(primary) || !primary.length) {
    return {
      status: 'fail',
      mode: 'peer',
      reason: '本侧（主数据源）无任何凭证，无法归集，锁三无从比对',
    };
  }
  if (!Array.isArray(peer) || !peer.length) {
    return {
      status: 'unavailable',
      mode: 'peer',
      reason: peer && Array.isArray(peer) && peer.length === 0
        ? '对侧凭证数组为空，比对未执行'
        : '无对侧凭证数据，锁三未执行',
    };
  }

  const a = fingerprintIndex(primary);
  const b = fingerprintIndex(peer);
  const diff = [];

  // 张数不同本身就是一处差异，必须计入 diff/diffCount ——
  // 否则调用方读 diffCount 会拿到 undefined，日志与 strictLock3 的阻断理由都会说不清。
  if (primary.length !== peer.length) {
    diff.push({
      fingerprint: null,
      note: `凭证张数不同：本侧 ${primary.length} 张，对侧 ${peer.length} 张`,
      left: primary.length,
      right: peer.length,
    });
  }

  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const ba = a.get(key);
    const bb = b.get(key);
    if (!ba || !bb) {
      diff.push({ fingerprint: toYuan(Number(key)), note: '该借方合计指纹只在单侧出现', left: ba?.size ?? 0, right: bb?.size ?? 0 });
      continue;
    }
    for (const [sig, n] of ba) {
      const m = bb.get(sig) || 0;
      if (n !== m) diff.push({ fingerprint: toYuan(Number(key)), note: '同一指纹下归一化行签名数量不同', left: n, right: m, sig });
    }
  }

  return {
    status: diff.length ? 'diff' : 'pass',
    mode: 'peer',
    compared: primary.length,
    // 行序与编号错位是已知的、无实质影响的差异，不在比对口径内 —— 比对口径是「指纹 + 归一化行多重集」。
    note: '口径：按借方合计指纹配对 + 按行归一化（科目码/明细码/借/贷，行序无关）；编号错位与行序差异不视为差异。',
    diff: diff.slice(0, 50),
    diffCount: diff.length,
  };
}

/**
 * 三锁总入口。
 *
 * 注意：本函数体内**不存在**任何 `l3 = aD === aC` 形态的借贷总平衡判据。
 * 借贷总平衡只作为锁二的一个内在含义存在（l2.balanced 已含 aD===aC），锁三是独立的一把。
 *
 * @param vouchers  主数据源凭证（v2 后默认来自平台答案入口）
 * @param taccounts 主数据源的归集结果（由 aggregate() 产出；调用方必须先归集再加锁）
 * @param opts.peerVouchers 对侧凭证（学生已录），锁三的比对对象；缺失则锁三判为未过
 * @param opts.strictLock3  true 时「有差异」也阻断；默认 false（v2 决策 5：提示后继续）
 */
export function tripleLock(vouchers, taccounts, opts = {}) {
  const l1 = lock1(vouchers);
  const l2 = lock2(vouchers, taccounts);
  const l3 = lock3Peer(vouchers, opts.peerVouchers);

  const strict = opts.strictLock3 === true;

  // ── 门禁判据（与油猴版统一：硬闸门只有锁一、锁二，外加固化的锁三 fail）──
  //   锁一 必须过（逐张凭证不平衡 = 解析或平台数据有问题）
  //   锁二 必须过（归集双向不闭合 = 归集逻辑有问题）
  //   锁三 分三档（见本文件顶部说明）：
  //     'pass'        过
  //     'diff'        不阻断（v2 决策 5「提示后继续」）；strictLock3 时收紧为阻断
  //     'unavailable' 不阻断（保可复用性：换人/换任务时对侧数据多半不存在）；
  //                   但 l3ok=false + 调用方必须显著告警 + summary 落 'lock3-unavailable'
  //     'fail'        阻断（本侧数据不可用）
  const l3Ok = l3.status === 'pass';
  const blocked = l1.length > 0 || !l2.balanced || l3.status === 'fail' || (strict && l3.status !== 'pass');

  return {
    l1ok: l1.length === 0,
    l1Bad: l1,
    l2ok: l2.balanced,
    l2,
    l3,
    /** 严格意义：只有比对真的执行成功并一致才算锁三通过。unavailable/diff 下恒为 false。 */
    l3ok: l3Ok,
    /** 锁三是否「执行了」（区别于「通过了」）。unavailable 时 false。 */
    l3Ran: l3.status === 'pass' || l3.status === 'diff',
    /** 是否允许继续写的门禁判定。 */
    blocked,
    /** 硬闸门（与油猴版 `if (!(lock.l1ok && lock.l2ok)) return` 完全一致） */
    hardGateOk: l1.length === 0 && l2.balanced,
    allPass: l1.length === 0 && l2.balanced && l3Ok,
    strict,
    totalDebit: toYuan(taccounts.reduce((s, a) => s + toFen(a.debitTotal), 0)),
    totalLend: toYuan(taccounts.reduce((s, a) => s + toFen(a.lendTotal), 0)),
  };
}