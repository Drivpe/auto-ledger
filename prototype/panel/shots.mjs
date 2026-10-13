// 原型截图生成器 —— 可复跑，产出 shots/ 下的全部截图。
//
// 为什么要有它：这些截图此前由多个一次性脚本拼出来，名字与内容都不一致，改一处 UI 就得
// 手工补齐，而且平台模拟栏里混进了真实会话标识。本脚本把「截哪些图」固化成代码。
//
// 用法：node prototype/panel/shots.mjs [变体...]      例：node prototype/panel/shots.mjs A C
// 产出：prototype/panel/shots/<变体>-<场景>.png
//
// 约定：每个变体的截图都隐藏宿主页底部的变体切换栏（它是原型的骨架，不是被评估的设计）。

import { chromium } from '/home/Drivpe/.npm-global/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(HERE, 'shots');
mkdirSync(SHOTS, { recursive: true });

const URL_BASE = 'file://' + resolve(HERE, 'index.html');
const SECTIONS = ['taccount', 'detail', 'journal', 'summary', 'ledger', 'report'];
const ALL = ['A', 'B', 'C'];
const want = process.argv.slice(2).filter((a) => ALL.includes(a));
const variants = want.length ? want : ALL;

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const made = [];

/** 每个变体的操作原语。三者结构不同，所以各自实现，但对外是同一组动作。 */
const DRIVERS = {
  A: {
    async open(p) { await p.waitForTimeout(900); },
    async section(p, id) { await p.evaluate((i) => { const n = document.querySelectorAll('.va-navitem')[i]; if (n) n.click(); }, SECTIONS.indexOf(id)); await p.waitForTimeout(450); },
    async page(p, code) { await p.evaluate((c) => { const b = [...document.querySelectorAll('.va-bhead')].find((x) => x.textContent.includes(c)); if (b) b.click(); }, code); await p.waitForTimeout(400); await p.evaluate((c) => { const r = [...document.querySelectorAll('.va-prow')].find((x) => x.textContent.includes(c)); if (r) r.click(); }, code); await p.waitForTimeout(700); },
    async demo(p, n = 1) { for (let i = 0; i < n; i++) { await p.evaluate(() => { const b = [...document.querySelectorAll('[data-act="demo"]')][0]; if (b) b.click(); }); await p.waitForTimeout(350); } },
    async clearDialog(p) { await p.evaluate(() => { const b = document.querySelector('[data-act="clear-open"]'); if (b) b.click(); }); await p.waitForTimeout(650); },
    async dismissDialog(p) { await p.evaluate(() => { const b = document.querySelector('[data-act="dlg-cancel"]'); if (b) b.click(); }); await p.waitForTimeout(300); },
    async runConflict(p) { await p.evaluate(() => { const b = document.querySelector('[data-act="run"]'); if (b) b.click(); }); await p.waitForTimeout(3400); },
    async flipSource(p) { await p.evaluate(() => { const el = document.querySelector('[data-sw], .va-sw, .c-sw'); if (el) el.click(); }); await p.waitForTimeout(550); },
  },
  B: {
    async open(p) { await p.waitForTimeout(900); },
    async section(p, id) { await p.evaluate((label) => { const t = [...document.querySelectorAll('.vb-tab')].find((x) => x.textContent.includes(label)); if (t) t.click(); }, SECTION_LABEL[id]); await p.waitForTimeout(500); },
    async page(p, code) { await p.evaluate((c) => { const h = [...document.querySelectorAll('.vb-cardhd')].find((x) => x.textContent.includes(c)); if (h) h.click(); }, code); await p.waitForTimeout(450); await p.evaluate(() => { const t = [...document.querySelectorAll('.vb-text')].find((x) => x.textContent.includes('展开')); if (t) t.click(); }); await p.waitForTimeout(600); },
    async demo(p, n = 1) { for (let i = 0; i < n; i++) { await p.evaluate(() => { const b = [...document.querySelectorAll('[data-act="demo"]')][0]; if (b) b.click(); }); await p.waitForTimeout(350); } },
    async clearDialog(p) { await p.evaluate(() => { const b = document.querySelector('[data-act="clear-open"]'); if (b) b.click(); }); await p.waitForTimeout(650); },
    async dismissDialog(p) { await p.evaluate(() => { const b = document.querySelector('[data-act="dlg-cancel"]'); if (b) b.click(); }); await p.waitForTimeout(300); },
    async runConflict(p) { await p.evaluate(() => { const b = document.querySelector('[data-act="run"]'); if (b) b.click(); }); await p.waitForTimeout(4200); },
    async flipSource(p) { await p.evaluate(() => { const el = document.querySelector('[data-sw], .va-sw, .c-sw'); if (el) el.click(); }); await p.waitForTimeout(550); },
  },
  C: {
    async open(p) { await p.waitForTimeout(900); await p.evaluate(() => document.querySelector('.c-fab').click()); await p.waitForTimeout(850); },
    async section(p, id) { await p.evaluate((s) => { const d = document.querySelector(`[data-sec="${s}"]`); if (d) d.click(); }, id); await p.waitForTimeout(800); },
    async page(p, code) { await p.evaluate((c) => { const g = [...document.querySelectorAll('.c-page')].find((x) => x.dataset.code === c); if (g) g.click(); }, code); await p.waitForTimeout(750); },
    async demo(p, n = 1) { for (let i = 0; i < n; i++) { await p.evaluate(() => { const b = document.querySelector('[data-act="demo"]'); if (b) b.click(); }); await p.waitForTimeout(350); } },
    async clearDialog(p) { await p.evaluate(() => { const b = document.querySelector('[data-act="clear-open"]'); if (b) b.click(); }); await p.waitForTimeout(650); },
    async dismissDialog(p) { await p.evaluate(() => { const b = document.querySelector('[data-act="cfm-no"]'); if (b) b.click(); }); await p.waitForTimeout(300); },
    async runConflict(p) { await p.evaluate(() => { const b = document.querySelector('[data-act="run"]'); if (b) b.click(); }); await p.waitForTimeout(2400); },
    async flipSource(p) { await p.evaluate(() => { const el = document.querySelector('[data-sw], .va-sw, .c-sw'); if (el) el.click(); }); await p.waitForTimeout(550); },
  },
};

/** 异常四档取图。
 *
 *  驱动方式两变体不同，这是实测出来的，不是猜的：
 *    - A：四个具名按钮，点哪个是哪个。
 *    - B/C：单个「演示」按钮循环推进，序列为 空 → 停止 → 部分失败 → 失败待重试 → 状态未知。
 *
 *  不能靠提示条文案区分「部分失败」与「失败待重试」——实测两者在提示条上完全一致
 *  （同为 err 语义色、同标题、同「重试全部失败」按钮），差别只在下方**列表项的失败标记**。
 *  所以按序列索引取图，再用提示条的语义色做一道校验，档位错了会直接报错而不是静默出图。 */
const EXPECT = {
  stop: /warn/,
  partial: /err/,
  retry: /err/,
  unknown: /unk/,
};

async function captureAnomalies(p, v) {
  const barClass = () => p.evaluate(() => {
    const el = document.querySelector('.va-an, .vb-an, .c-an');
    return el ? el.className : '';
  });
  const clickDemo = async () => { await p.evaluate(() => { const b = document.querySelector('[data-act="demo"]'); if (b) b.click(); }); await p.waitForTimeout(500); };
  const present = async (key) => {
    const c = await barClass();
    if (!EXPECT[key].test(c)) throw new Error(`${v}: 取「${key}」时提示条状态不对（${c || '无提示条'}）`);
    await shot(p, `${v}-anomaly-${key}`);
  };

  if (v === 'A') {
    // 四个具名按钮：点哪个是哪个
    for (const key of ['stop', 'partial', 'retry', 'unknown']) {
      await p.evaluate((k) => {
        const want = { stop: 'stopped', partial: 'partial', retry: 'retry', unknown: 'unknown' }[k];
        const b = [...document.querySelectorAll('[data-act="demo"]')].find((x) => x.dataset.v === want);
        if (b) b.click();
      }, key);
      await p.waitForTimeout(500);
      await present(key);
    }
    return;
  }

  // B/C：单按钮循环推进。先复位到「无提示条」，再按 停止→部分失败→失败待重试→状态未知 逐格取图。
  for (let i = 0; i < 8 && (await barClass()); i++) await clickDemo();
  for (const key of ['stop', 'partial', 'retry', 'unknown']) { await clickDemo(); await present(key); }
}

const SECTION_LABEL = { taccount: 'T型账', detail: '明细账', journal: '日记账', summary: '科目汇总表', ledger: '总账', report: '会计报表' };

const shot = async (p, name) => { await p.screenshot({ path: resolve(SHOTS, name + '.png') }); made.push(name); };
const hideSwitcher = (p) => p.evaluate(() => { const s = document.getElementById('vp-switch'); if (s) s.style.display = 'none'; });
const setTheme = async (p, t) => { await p.evaluate((x) => { document.documentElement.dataset.theme = x; }, t); await p.waitForTimeout(450); };

for (const v of variants) {
  const D = DRIVERS[v];

  // ---- 主题两态 + 收起态 ----
  {
    const p = await ctx.newPage();
    for (const th of ['light', 'dark']) {
      await p.goto(URL_BASE + '?variant=' + v, { waitUntil: 'load' });
      await D.open(p);
      await hideSwitcher(p);
      await setTheme(p, th);
      await shot(p, `${v}-${th}`);
      const ok = await p.evaluate(() => { const b = document.getElementById('vp-collapse'); if (b && b.style.display !== 'none') { b.click(); return true; } return false; });
      if (ok) { await p.waitForTimeout(650); await shot(p, `${v}-${th}-collapsed`); }
    }
    await p.close();
  }

  // ---- 六个环节分区 ----
  {
    const p = await ctx.newPage();
    await p.goto(URL_BASE + '?variant=' + v, { waitUntil: 'load' });
    await D.open(p);
    await hideSwitcher(p);
    for (const s of SECTIONS) {
      await D.section(p, s);
      await shot(p, `sec-${v}-${s}`);
    }
    await p.close();
  }

  // ---- 账页下钻（明细账 1001 / T型账） ----
  {
    const p = await ctx.newPage();
    await p.goto(URL_BASE + '?variant=' + v, { waitUntil: 'load' });
    await D.open(p);
    await hideSwitcher(p);
    await D.section(p, 'detail');
    await D.page(p, '1001');
    await shot(p, `data-${v}-detail-1001`);
    await D.section(p, 'taccount');
    await shot(p, `data-${v}-taccount`);
    await p.close();
  }

  // ---- 清除确认对话框 ----
  {
    const p = await ctx.newPage();
    await p.goto(URL_BASE + '?variant=' + v, { waitUntil: 'load' });
    await D.open(p);
    await hideSwitcher(p);
    await D.clearDialog(p);
    await shot(p, `final-${v}-clear`);
    await D.dismissDialog(p);
    await shot(p, `final-${v}-collapsed`);
    await p.close();
  }

  // ---- 数据源兜底态 ----
  {
    const p = await ctx.newPage();
    await p.goto(URL_BASE + '?variant=' + v, { waitUntil: 'load' });
    await D.open(p);
    await hideSwitcher(p);
    await shot(p, `${v}-default`);
    await D.flipSource(p);
    await shot(p, `${v}-fallback`);
    await p.close();
  }

  // ---- 异常四档 ----
  {
    const p = await ctx.newPage();
    await p.goto(URL_BASE + '?variant=' + v, { waitUntil: 'load' });
    await D.open(p);
    await hideSwitcher(p);
    await D.section(p, 'taccount');
    await captureAnomalies(p, v);
    await p.close();
  }

  // ---- 冲突裁决 ----
  {
    const p = await ctx.newPage();
    await p.goto(URL_BASE + '?variant=' + v, { waitUntil: 'load' });
    await D.open(p);
    await hideSwitcher(p);
    await D.section(p, 'taccount');
    await D.runConflict(p);
    await shot(p, `${v}-conflict`);
    await p.close();
  }
}

await browser.close();

// 自检：同一变体的不同场景截图若逐字节相同，说明那几档在视觉上没被区分开。
// 原型本身可能有此缺陷，但取图脚本不能静默出图——必须报出来。
const { readFileSync } = await import('node:fs');
const { createHash } = await import('node:crypto');
const byVariant = {};
for (const n of made) {
  const v = n[0];
  const h = createHash('md5').update(readFileSync(resolve(SHOTS, n + '.png'))).digest('hex');
  (byVariant[v] = byVariant[v] || []).push([n, h]);
}
const dupes = [];
for (const [v, list] of Object.entries(byVariant)) {
  const seen = new Map();
  for (const [n, h] of list) {
    if (seen.has(h)) dupes.push(`${n}.png 与 ${seen.get(h)}.png 逐像素相同`);
    else seen.set(h, n);
  }
}

console.log(`${made.length} 张截图 → ${SHOTS}`);
if (dupes.length) {
  console.log('\n⚠ 以下场景在视觉上未区分开（原型缺陷，非取图问题）：');
  for (const d of dupes) console.log('  - ' + d);
}
