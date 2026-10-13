// PROTOTYPE 验收脚本 —— 用 Playwright 打开原型，逐变体逐主题截图并收集控制台错误。
//
// 这是「父代理验收用」的脚本，不是原型本身的一部分。
// 用法：node prototype/panel/verify.mjs
// 产出：prototype/panel/shots/ 下的截图 + verify-report.json

import { chromium } from '/home/Drivpe/.npm-global/lib/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(HERE, 'shots');
mkdirSync(SHOTS, { recursive: true });

const VARIANTS = ['A', 'B', 'C'];
const THEMES = ['light', 'dark'];
const fileUrl = 'file://' + resolve(HERE, 'index.html');

const report = { at: new Date().toISOString(), variants: {}, consoleErrors: [], pageErrors: [], fail: [] };

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

for (const v of VARIANTS) {
  report.variants[v] = {};
  for (const th of THEMES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

    await page.goto(fileUrl + '?variant=' + v, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(700);

    // 设主题（宿主页 data-theme）
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, th);
    await page.waitForTimeout(450);

    const el = await page.$('#vp-root-' + v);
    const mounted = !!el;
    const box = el ? await el.boundingBox() : null;
    const text = el ? (await el.innerText()).replace(/\s+/g, ' ').slice(0, 600) : '';

    await page.screenshot({ path: resolve(SHOTS, `${v}-${th}.png`) });

    // 收起态：优先调用变体暴露的 toggle()，退化为点击可能的收起控件
    let collapsedShot = false;
    const toggled = await page.evaluate(() => {
      // 宿主把 toggle 接在 api.onToggle；直接再触发一次切换栏按钮
      const b = document.getElementById('vp-collapse');
      if (b && b.style.display !== 'none') { b.click(); return true; }
      return false;
    });
    if (toggled) {
      await page.waitForTimeout(650);
      await page.screenshot({ path: resolve(SHOTS, `${v}-${th}-collapsed.png`) });
      collapsedShot = true;
    }

    report.variants[v][th] = { mounted, box, collapsedShot, errs, textHead: text };
    if (!mounted) report.fail.push(`${v}/${th}: #vp-root-${v} 未挂载`);
    if (errs.length) report.fail.push(`${v}/${th}: ${errs.length} 条控制台错误`);
    report.consoleErrors.push(...errs.map((e) => `${v}/${th}: ${e}`));

    await ctx.close();
  }
}

// 通用检查：三个变体页面上是否残留「学生答案」字样；并核对数据源两态（实时 / 兜底快照）
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
for (const v of VARIANTS) {
  const page = await ctx.newPage();
  await page.goto(fileUrl + '?variant=' + v, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  // 变体 C 的主体在悬浮球展开的 Dialog 里
  if (v === 'C') {
    const fab = await page.$('.c-fab');
    if (fab) { await fab.click(); await page.waitForTimeout(800); }
  }

  const bodyText = await page.evaluate(() => document.body.innerText);
  const has = /学生答案/.test(bodyText);
  report.variants[v].forbiddenStudentAnswer = has;
  if (has) report.fail.push(`${v}: 出现禁止字样「学生答案」`);

  // 默认应为 primary 态「实时」（兜底态是异常路径，默认显示会误导）
  // 判据要精确：开关自身的标签（「模拟：教师答案未开放」）会合法地含「未开放」，
  // 所以不能拿「未开放/回退」当兜底标志。真正的兜底态标志是引用了仓库快照本体。
  const live = /实时/.test(bodyText);
  const snapDefault = /仓库(内置)?快照/.test(bodyText);
  report.variants[v].defaultState = { live, snapshotShown: snapDefault };
  if (!live) report.fail.push(`${v}: 默认态未显示「教师答案 · 实时」`);
  if (snapDefault) report.fail.push(`${v}: 默认态引用了仓库快照（应为实时态）`);

  // 触发兜底态：三个变体的开关类名各自贴合自身设计语言，
  // 依次尝试 [data-sw]（B）/.va-sw（A）/.c-sw（C）
  const flipped = await page.evaluate(() => {
    const el = document.querySelector('[data-sw], .va-sw, .c-sw');
    if (!el) return false;
    el.click();
    return true;
  });
  if (flipped) {
    await page.waitForTimeout(500);
    const t2 = await page.evaluate(() => document.body.innerText);
    report.variants[v].fallbackState = { reachable: true, mentionsSnapshot: /快照/.test(t2) };
    if (!/快照/.test(t2)) report.fail.push(`${v}: 兜底态开关点了但未出现快照文案`);
    await page.screenshot({ path: resolve(SHOTS, `${v}-fallback.png`) });
  } else {
    report.variants[v].fallbackState = { reachable: false };
    report.fail.push(`${v}: 未找到兜底态开关 [data-sw]`);
  }

  report.variants[v].mentions = { teacher: /教师答案/.test(bodyText) };
  await page.close();
}
await ctx.close();

await browser.close();

writeFileSync(resolve(HERE, 'verify-report.json'), JSON.stringify(report, null, 2));

console.log('=== 验收结果 ===');
for (const v of VARIANTS) {
  for (const th of THEMES) {
    const r = report.variants[v][th];
    console.log(
      `${v}/${th}  挂载=${r.mounted ? 'OK' : 'FAIL'}  尺寸=${r.box ? Math.round(r.box.width) + 'x' + Math.round(r.box.height) : '—'}` +
      `  收起态=${r.collapsedShot ? 'OK' : '—'}  错误=${r.errs.length}`
    );
  }
  const d0 = report.variants[v].defaultState || {};
  const fb = report.variants[v].fallbackState || {};
  console.log(`   学生答案字样=${report.variants[v].forbiddenStudentAnswer ? '出现(FAIL)' : '无(OK)'}` +
    `  默认实时=${d0.live ? '是' : '否(FAIL)'}` +
    `  默认显快照=${d0.snapshotShown ? '是(FAIL)' : '否(OK)'}` +
    `  兜底态可达=${fb.reachable ? (fb.mentionsSnapshot ? '是(OK)' : '是但无快照文案(FAIL)') : '否(FAIL)'}`);
}
console.log('\n失败项：' + (report.fail.length ? '\n  - ' + report.fail.join('\n  - ') : '无'));
console.log('截图：' + SHOTS);
