// 写回后读回对账：遍历本地归集出的全部科目，逐个查询平台 T 型账，比对金额与行数。
// 只读：仅查询，绝不提交。
//
// 用法：node src/verify-taccounts.mjs [--sxid=...] [--entity=110] [--year=2020] [--month=1]
// 产出：out/verify-report.md、out/verify.json
// 退出码：0 = 全部一致；1 = 存在差异；2 = 环境/输入错误。
//
// 与 fill 侧的关系：「本期发生额」合计格在不同响应模板下可能列错位（纯单边科目尤其明显），
// 所以这里同时给两组判据 —— 合计格 + 逐行求和 —— 并打印两者，冲突时显式告警，不静默取一个。

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, loadConfig, openSession, login, resolveContext, entryUrl, tAccountUrl, tAccountQuery } from './platform.mjs';

const cfg = loadConfig();
const OUT = resolve(ROOT, 'out');
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const ctx = resolveContext(cfg, args);

/**
 * 读平台当前科目状态。
 * - rows / sum：按已保存行逐行取，不依赖表头布局（合计格错位时的独立判据）
 * - totalRows：所有「本期发生额」行的全部单元格，原样留证，便于事后判断列错位
 */
const READ_PLATFORM = () => {
  const form = document.forms.v_dto6;
  if (!form) return null;
  const num = (s) => {
    const v = String(s ?? '').replace(/[,\s\u00a0￥¥]/g, '');
    if (!v) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // 文档级查询：v_dto6 表体的输入框不能用 form.querySelector 可靠定位（README 排除项）
  const pzEls = [...form.querySelectorAll('input[name="pzh_bz"]')];
  const dbEls = [...form.querySelectorAll('input[name="debit"]')];
  const lnEls = [...form.querySelectorAll('input[name="lend"]')];
  const rows = pzEls.map((el, i) => ({
    pzh: (el.value ?? '').trim(),
    debit: (dbEls[i]?.value ?? '').trim(),
    lend: (lnEls[i]?.value ?? '').trim(),
  }));

  const totalRows = [];
  for (const tr of document.querySelectorAll('tr')) {
    const tds = [...tr.cells];
    if (!tds.length) continue;
    if (!(tds[0].innerText || '').includes('本期发生额')) continue;
    totalRows.push(tds.map((td) => (td.innerText ?? '').trim()));
  }
  const total = totalRows.length ? { debit: totalRows[0][1] ?? '', lend: totalRows[0][2] ?? '' } : { debit: '', lend: '' };

  return {
    accountID: form.elements.accountID?.value ?? null,
    rows, total, totalRows,
    sum: {
      debit: rows.reduce((s, r) => s + num(r.debit), 0),
      lend: rows.reduce((s, r) => s + num(r.lend), 0),
    },
  };
};

const num = (s) => {
  const v = String(s ?? '').replace(/[,\s\u00a0￥¥]/g, '');
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const TACC = resolve(OUT, 'taccounts.json');
if (!existsSync(TACC)) {
  console.error(`找不到 ${TACC}，请先运行 node src/aggregate.mjs`);
  process.exit(2);
}
const taccounts = JSON.parse(readFileSync(TACC, 'utf8'));
const targets = taccounts.filter((a) => a.entryCount > 0);

const { browser, page, dialogs } = await openSession(cfg);
const results = [];
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

  for (const acc of targets) {
    const q = tAccountQuery(ctx, acc.code);
    let mw = getMw();
    await mw.goto(new URL(q, cfg.baseUrl).href, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1600);
    mw = getMw();

    const p = await mw.evaluate(READ_PLATFORM);
    if (!p || p.accountID !== acc.code) {
      results.push({ code: acc.code, name: acc.name, status: 'page-mismatch', got: p?.accountID });
      console.log(`${acc.code} ${acc.name}: ⚠ 页面未切到目标科目（读到 ${p?.accountID}）`);
      exitCode = 1;
      continue;
    }

    const pDebit = num(p.total.debit);
    const pLend = num(p.total.lend);
    const totalOk = Math.abs(pDebit - acc.debitTotal) < 0.01 && Math.abs(pLend - acc.lendTotal) < 0.01;
    const sumOk = Math.abs(p.sum.debit - acc.debitTotal) < 0.01 && Math.abs(p.sum.lend - acc.lendTotal) < 0.01;
    const rowsOk = p.rows.length === acc.entryCount;
    const ok = rowsOk && (totalOk || sumOk);
    const conflict = totalOk !== sumOk;

    results.push({
      code: acc.code, name: acc.name,
      status: ok ? 'ok' : 'mismatch',
      local: { debit: acc.debitTotal, lend: acc.lendTotal, rows: acc.entryCount },
      platform: { debit: pDebit, lend: pLend, rows: p.rows.length, sumDebit: p.sum.debit, sumLend: p.sum.lend },
      checks: { totalOk, sumOk, rowsOk, conflict },
      totalRows: p.totalRows,
    });
    if (!ok) exitCode = 1;

    console.log(
      `${acc.code} ${acc.name}: ${ok ? '✅' : '❌'} `
      + `本地 ${acc.debitTotal}/${acc.lendTotal} (${acc.entryCount}行) | `
      + `平台合计格 ${pDebit}/${pLend} | 平台逐行 ${p.sum.debit}/${p.sum.lend} (${p.rows.length}行)`
      + (conflict ? '  ⚠ 两种读法结论不同，以逐行求和为准' : '')
    );
  }

  // --- 报告 ---
  const okList = results.filter((r) => r.status === 'ok');
  const bad = results.filter((r) => r.status !== 'ok');
  const conflicts = results.filter((r) => r.checks?.conflict);

  const L = [];
  L.push('# T 型账读回对账报告');
  L.push('');
  L.push(`生成时间：${new Date().toISOString()}`);
  L.push('');
  L.push('## 总览');
  L.push('');
  L.push(`- 应登记科目：${targets.length}`);
  L.push(`- 对账一致：${okList.length}`);
  L.push(`- 不一致：${bad.length}`);
  L.push(`- 两种读法冲突：${conflicts.length}`);
  L.push('');
  L.push('对账口径：平台「本期发生额」借贷两侧与本地归集金额逐科目比对，另比对登记行数。');
  L.push('合计格与逐行求和并列给出 —— 提交响应页与干净查询页的表格模板不同，纯单边科目（借为 0 只有贷方）');
  L.push('的合计格曾把贷方值读进借方位，造成假阴性。逐行求和不依赖表头布局，冲突时以它为准。');
  L.push('平台 T 型账环节不给对错反馈，本报告即自建判据。差异项须人工判定是归集错误还是平台口径差异。');
  L.push('');
  if (bad.length) {
    L.push('## 不一致明细');
    L.push('');
    L.push('| 科目 | 名称 | 本地借 | 平台借 | 本地贷 | 平台贷 | 本地行 | 平台行 | 判定 |');
    L.push('|---|---|---|---|---|---|---|---|---|');
    for (const r of bad) {
      L.push(`| ${r.code} | ${r.name} | ${r.local?.debit ?? '-'} | ${r.platform?.debit ?? '-'} | ${r.local?.lend ?? '-'} | ${r.platform?.lend ?? '-'} | ${r.local?.rows ?? '-'} | ${r.platform?.rows ?? '-'} | ${r.status} |`);
    }
    L.push('');
  }
  if (conflicts.length) {
    L.push('## 读法冲突明细（合计格 vs 逐行求和）');
    L.push('');
    L.push('| 科目 | 合计格借 | 合计格贷 | 逐行借 | 逐行贷 | 合计行原始单元格 |');
    L.push('|---|---|---|---|---|---|');
    for (const r of conflicts) {
      L.push(`| ${r.code} | ${r.platform.debit} | ${r.platform.lend} | ${r.platform.sumDebit} | ${r.platform.sumLend} | \`${JSON.stringify(r.totalRows)}\` |`);
    }
    L.push('');
  }
  L.push('## 逐科目结果');
  L.push('');
  L.push('| 科目 | 名称 | 本地借 | 本地贷 | 平台借 | 平台贷 | 平台逐行借 | 平台逐行贷 | 行数 | 结论 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    L.push(`| ${r.code} | ${r.name} | ${r.local?.debit ?? '-'} | ${r.local?.lend ?? '-'} | ${r.platform?.debit ?? '-'} | ${r.platform?.lend ?? '-'} | ${r.platform?.sumDebit ?? '-'} | ${r.platform?.sumLend ?? '-'} | ${r.platform?.rows ?? '-'} | ${r.status === 'ok' ? '✅' : '❌ ' + r.status} |`);
  }
  L.push('');
  L.push('## 结论');
  L.push('');
  L.push(bad.length === 0
    ? `**全部 ${okList.length} 个科目读回一致**，本地归集结果已如实落到平台 T 型账。`
    : `**${bad.length} 个科目存在差异**，需排查归集口径或平台合计规则。`);

  writeFileSync(resolve(OUT, 'verify-report.md'), L.join('\n'));
  writeFileSync(resolve(OUT, 'verify.json'), JSON.stringify(results, null, 2));

  console.log(`\n=== 对账 ${okList.length}/${results.length} 一致 ===`);
  if (conflicts.length) console.log(`读法冲突 ${conflicts.length} 个科目（见 out/verify-report.md）`);
  if (bad.length) console.log(`不一致：${bad.map((b) => b.code + ' ' + b.name).join(', ')}`);
  console.log('产出: out/verify-report.md, out/verify.json');
} catch (e) {
  console.error('中断:', e.message);
  exitCode = 1;
} finally {
  await browser.close();
}

process.exitCode = exitCode;