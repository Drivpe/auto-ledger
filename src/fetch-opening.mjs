// 抓取期初余额表（科目余额表），为锁三的「期初衔接」形态留数据基础。
// 只读。
//
// 用法：node src/fetch-opening.mjs [--sxid=...] [--entity=110]
// 产出：out/opening-balances-raw.json
//
// 注：本文件不含任何 SXID / 姓名等敏感实值，一律走 src/platform.mjs 的配置读入口。

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, loadConfig, openSession, login, resolveContext, entryUrl, openingBalanceUrl } from './platform.mjs';

const cfg = loadConfig();
const OUT = resolve(ROOT, 'out');
mkdirSync(OUT, { recursive: true });

const ctx = resolveContext(cfg, process.argv.slice(2));

const { browser, page, dialogs } = await openSession(cfg);

try {
  await login(page, cfg, dialogs);
  await page.goto(new URL(entryUrl(cfg, ctx), cfg.baseUrl).href, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(4000);

  const mf = page.frames().find((f) => f.name() === 'main');
  if (!mf) throw new Error('未找到 main frame');

  await mf.goto(new URL(openingBalanceUrl(ctx), cfg.baseUrl).href, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3500);

  const dump = await mf.evaluate(() => {
    const tables = [];
    document.querySelectorAll('table').forEach((t, ti) => {
      if (t.rows.length < 2) return;
      const rows = [];
      [...t.rows].forEach((tr) => {
        rows.push([...tr.cells].map((c) =>
          (c.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 50)
        ));
      });
      tables.push({ idx: ti, id: t.id || null, cls: t.className || null, rows: t.rows.length, dump: rows });
    });
    return {
      url: location.href,
      title: document.title,
      text: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 2000),
      tables,
      forms: [...document.forms].map((f) => ({
        name: f.name, action: f.getAttribute('action'),
        fields: [...f.elements].map((e) => `${e.name || e.id}:${e.type || e.tagName}:${(e.value || '').slice(0, 30)}`),
      })),
    };
  });

  console.log('URL:', dump.url);
  console.log('文字:', dump.text.slice(0, 900));
  console.log('\n表单:');
  for (const f of dump.forms) console.log(`  ${f.name} ${f.action}\n    ${f.fields.join(' | ')}`);
  console.log('\n表格:');
  for (const t of dump.tables) {
    console.log(`  [${t.idx}] id=${t.id} cls=${t.cls} 行=${t.rows}`);
    t.dump.slice(0, 25).forEach((r, i) => {
      const line = r.join(' | ');
      if (line.replace(/[\s|]/g, '')) console.log(`     行${i}: ${line}`);
    });
  }

  writeFileSync(resolve(OUT, 'opening-balances-raw.json'), JSON.stringify(dump, null, 2));
  console.log('\n取证写入 out/opening-balances-raw.json');
} catch (e) {
  console.error('中断:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}