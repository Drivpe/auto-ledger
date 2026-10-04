// 从凭证分录归集出各科目的借贷发生额，并执行三重锁校验。
// 纯计算，不接触浏览器、不写平台。
//
// 用法：node src/aggregate.mjs [--peer=out/vouchers-student.json]
// 产出：out/taccounts.json —— 拟写入 T 型账的内容（按一级科目）
//       out/report.md      —— 三重锁校验报告
// 退出码：0 = 三锁全过（可进入回填）；1 = 存在未通过项；2 = 环境/输入错误。
//
// 三锁实现已抽到 src/locks.mjs，与 fill-taccounts.mjs 共用同一份代码 ——
// 此前 CLI 侧 fill 无门禁、aggregate 失败仍返回 0，两版安全语义不一致。

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './platform.mjs';
import { aggregate, toFen, toYuan, tripleLock } from './locks.mjs';

const OUT = resolve(ROOT, 'out');
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];

const PEER_PATH = resolve(OUT, flag('peer') ?? 'vouchers-student.json');
const MAIN_PATH = resolve(OUT, 'vouchers.json');

if (!existsSync(MAIN_PATH)) {
  console.error(`找不到主数据源：${MAIN_PATH}`);
  console.error('请先运行 node src/fetch-vouchers.mjs（v2 后默认抓平台答案入口）。');
  process.exit(2);
}

const vouchers = JSON.parse(readFileSync(MAIN_PATH, 'utf8'));
// 对侧凭证（学生已录）仅用于锁三比对；取不到则锁三**未执行**（不再有任何「退化」形态：
// 借贷总平衡是锁二的逻辑子集，把它当锁三等于没做锁三。见 src/locks.mjs 顶部说明）。
const peerVouchers = existsSync(PEER_PATH) ? JSON.parse(readFileSync(PEER_PATH, 'utf8')) : null;

const taccounts = aggregate(vouchers);

writeFileSync(resolve(OUT, 'taccounts.json'), JSON.stringify(taccounts, null, 2));

// --- 执行三重锁 ---
const lock = tripleLock(vouchers, taccounts, { peerVouchers });

const l3Line = (() => {
  const s = lock.l3;
  if (s.status === 'pass') {
    return `✅ **通过** —— 与对侧凭证逐张比对一致（${s.compared} 张，按借方合计指纹配对 + 按行归一化）。`;
  }
  if (s.status === 'diff') {
    return `⚠ **比对发现 ${s.diffCount} 处差异，按 v2 决策 5「提示后继续」不阻断**。差异明细见下。`;
  }
  if (s.status === 'unavailable') {
    return `⚠ **未执行** —— ${s.reason}。\n`
      + '按 v2 决策继续（保可复用性：换人/换任务时对侧数据多半不存在）；'
      + '建议先跑 `node src/fetch-vouchers.mjs --side=student` 以启用比对。\n'
      + '**锁三未执行 ≠ 锁三通过**：本次归集未获得「与答案逐张比对」这一层保证。';
  }
  if (s.status === 'fail') {
    return `❌ **失败** —— ${s.reason}。`;
  }
  return `— 无法判定：${s.reason}`;
})();

const lines = [];
lines.push('# 三重锁校验报告');
lines.push('');
lines.push(`生成时间：${new Date().toISOString()}`);
lines.push('');
lines.push('## 数据概况');
lines.push('');
lines.push(`- 主数据源：${MAIN_PATH}`);
lines.push(`- 对侧凭证：${peerVouchers ? `${PEER_PATH}（${peerVouchers.length} 张）` : '未提供 —— 锁三未执行：未提供对侧凭证数据，无法比对'}`);
lines.push(`- 凭证张数：${vouchers.length}`);
lines.push(`- 分录总行数：${vouchers.reduce((s, v) => s + v.lines.length, 0)}`);
lines.push(`- 涉及一级科目数：${taccounts.length}`);
lines.push(`- 跨页凭证张数：${vouchers.filter((v) => (v.pages || 1) > 1).length}`);
lines.push('');
lines.push('## 锁一：逐张凭证借贷平衡');
lines.push('');
if (lock.l1ok) {
  lines.push(`✅ **通过** —— ${vouchers.length} 张凭证全部借贷相等，且与平台自报合计一致。`);
} else {
  lines.push(`❌ **失败** —— ${lock.l1Bad.length} 处异常：`);
  lines.push('');
  for (const b of lock.l1Bad) lines.push(`- ${b.label}: ${JSON.stringify(b)}`);
}
lines.push('');
lines.push('## 锁二：归集结果双向闭合');
lines.push('');
lines.push('| 口径 | 借方合计 | 贷方合计 |');
lines.push('|---|---|---|');
lines.push(`| 凭证分录逐笔累加 | ${lock.l2.voucherDebit} | ${lock.l2.voucherLend} |`);
lines.push(`| 一级科目归集后累加 | ${lock.l2.accountDebit} | ${lock.l2.accountLend} |`);
lines.push('');
lines.push(lock.l2ok ? '✅ **通过** —— 两条独立路径算出同一个数。' : '❌ **失败** —— 两条路径结果不一致。');
lines.push('');
lines.push('## 锁三：答案 vs 学生凭证比对');
lines.push('');
lines.push(l3Line);
if (lock.l3.note) {
  lines.push('');
  lines.push(`> ${lock.l3.note}`);
}
if (lock.l3.status === 'diff' && lock.l3.diff?.length) {
  lines.push('');
  lines.push('| 借方合计指纹 | 差异说明 | 本侧 | 对侧 |');
  lines.push('|---|---|---|---|');
  for (const d of lock.l3.diff.slice(0, 20)) {
    lines.push(`| ${d.fingerprint} | ${d.note} | ${d.left} | ${d.right} |`);
  }
}
lines.push('');
lines.push('## 一级科目发生额汇总');
lines.push('');
lines.push('| 科目编码 | 科目名称 | 借方发生额 | 贷方发生额 | 分录笔数 |');
lines.push('|---|---|---|---|---|');
for (const a of taccounts) {
  lines.push(`| ${a.code} | ${a.name} | ${a.debitTotal.toFixed(2)} | ${a.lendTotal.toFixed(2)} | ${a.entryCount} |`);
}
lines.push('');
lines.push('## 结论');
lines.push('');
// 结论文案：只在 pass 时说「三锁全过」；unavailable/diff 明确说「锁三未执行/有差异」，不伪装成通过。
if (lock.allPass) {
  lines.push('**三锁全过**，归集结果可信，可进入 T 型账回填环节。');
} else if (lock.blocked) {
  lines.push('**存在阻塞项（锁一/锁二未过，或锁三 fail：本侧数据不可用）**，归集结果不可信，须先排查；'
    + '`fill-taccounts.mjs` 会拒绝写入平台。');
} else if (lock.l3.status === 'unavailable') {
  lines.push('**锁一/锁二通过，锁三未执行（无对侧数据）**，按 v2 决策继续，可进入回填；'
    + '建议先跑 `node src/fetch-vouchers.mjs --side=student` 以启用答案比对。'
    + '**锁三未执行 ≠ 锁三通过**。');
} else if (lock.l3.status === 'diff') {
  lines.push(`**锁三比对发现 ${lock.l3.diffCount} 处差异，按 v2 决策 5「提示后继续」不阻断**，'
    + '锁一/锁二已过，回填继续；差异项需人工确认。`);
} else {
  lines.push('**存在未通过项**，须先排查。');
}
lines.push('');
lines.push('> 锁三自 v2 起定位为「答案 vs 学生凭证比对」，不再是借贷总平衡（后者是锁二的逻辑子集，零增量）。');
lines.push('> 三档语义：pass 通过 / diff 有差异（不阻断，--strict-lock3 可收紧）/ unavailable 未执行（不阻断但显著告警）/ fail 本侧数据不可用（阻断）。');
lines.push('> 硬闸门 = 锁一 && 锁二，与油猴版一致。');

writeFileSync(resolve(OUT, 'report.md'), lines.join('\n'));

console.log(`一级科目数: ${taccounts.length}`);
console.log(`锁一(逐张凭证平衡): ${lock.l1ok ? '通过' : '失败 ' + lock.l1Bad.length + ' 处'}`);
console.log(`锁二(归集双向闭合): ${lock.l2ok ? '通过' : '失败'}`);
console.log(`  凭证累加: 借 ${lock.l2.voucherDebit} / 贷 ${lock.l2.voucherLend}`);
console.log(`  科目归集: 借 ${lock.l2.accountDebit} / 贷 ${lock.l2.accountLend}`);
console.log(`锁三(${lock.l3.mode}): ${lock.l3.status}  l3ok=${lock.l3ok}  l3Ran=${lock.l3Ran}`);
if (lock.l3.status === 'diff') console.log(`  差异 ${lock.l3.diffCount} 处（不阻断）`);
if (lock.l3.status === 'unavailable') {
  console.log('  锁一/锁二通过，锁三未执行（无对侧数据），按 v2 决策继续；建议先跑 --side=student');
  console.log('  注意：锁三未执行 ≠ 锁三通过');
}
console.log(`借贷合计: 借 ${toYuan(toFen(lock.totalDebit))} / 贷 ${toYuan(toFen(lock.totalLend))}`);
console.log('\n产出: out/taccounts.json, out/report.md');
console.log('\n前 10 个科目:');
for (const a of taccounts.slice(0, 10)) {
  console.log(`  ${a.code} ${a.name}  借 ${a.debitTotal.toFixed(2)}  贷 ${a.lendTotal.toFixed(2)}  (${a.entryCount}笔)`);
}

// 三锁未全过时必须让下游阻断：此前恒返回 0，`&& node src/fill-taccounts.mjs --commit` 这种串联会照跑。
if (lock.blocked) {
  console.error(`\n❌ 闸门未过（硬闸门 锁一&&锁二 = ${lock.hardGateOk}；锁三 ${lock.l3.status}），退出码 1。`);
  process.exit(1);
}
if (!lock.allPass && !lock.blocked) {
  if (lock.l3.status === 'unavailable') {
  console.error('\n⚠ 锁一/锁二通过，锁三未执行（无对侧数据），按 v2 决策继续，退出码 0。');
  console.error('  建议先跑 node src/fetch-vouchers.mjs --side=student 以启用答案比对。');
  } else {
    console.error('\n⚠ 锁三比对发现差异（不阻断），退出码 0 但请在 out/report.md 里核对差异明细。');
  }
}