// 全量抓取记账凭证分录。
// 只读：只做查询与详情浏览，绝不提交任何写操作。
//
// v2 数据源变更：主数据源改为**平台答案入口**（老师侧，SXID 恒为 0，与账号无关），
// 理由是脱离「学生必须先把凭证录对」这一前提（见 docs/adr/0001-answer-as-data-source.md）。
// 学生侧仍可抓，但只作锁三的比对对象，产出另存 out/vouchers-student.json。
//
// 用法：node src/fetch-vouchers.mjs [--side=answer|student] [--sxid=...] [--entity=110]
// 产出：答案 → out/vouchers.json（+ out/vouchers-probe.json）
//       学生 → out/vouchers-student.json（+ out/vouchers-probe-student.json）
//
// 注：本文件不含任何 SXID / 姓名等敏感实值，一律走 src/platform.mjs 的配置读入口。

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ROOT, loadConfig, openSession, login,
  resolveContext, entryUrl, tAccountUrl, voucherListUrl,
  frameByNameOrNull, PLATFORM,
} from './platform.mjs';
import { parseVoucherLinks, parsePaging, innerDetailUrl } from './parse-links.mjs';

const cfg = loadConfig();
const OUT = resolve(ROOT, 'out');
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const SIDE = flag('side') === 'student' ? 'student' : 'answer';
const ctx = resolveContext(cfg, args);

const DETAIL_ACTION = SIDE === 'answer' ? PLATFORM.answerDetail : PLATFORM.studentDetail;
const VOUCHERS_FILE = SIDE === 'answer' ? 'vouchers.json' : 'vouchers-student.json';
const PROBE_FILE = SIDE === 'answer' ? 'vouchers-probe.json' : 'vouchers-probe-student.json';

/**
 * 分录的标准形状。金额一律换算为「元」（浮点，两位小数），
 * 平台原始值是以「分」为单位的整数字符串。
 *
 * ⚠ README「平台机制备忘」排除项：本函数整体在浏览器上下文求值，
 * 换算逻辑必须**内联复制**，不可引用 Node 侧变量（跨上下文引用会直接抛 not defined）。
 * 这是已定案、不要改的设计。
 */
const PARSE_VOUCHER = () => {
  // 必须在浏览器上下文内自带换算，不能引用外部函数
  const fen2yuan = (fen) => {
    const s = String(fen ?? '').replace(/[\s\u00a0]/g, '');
    if (!s || !/^-?\d+$/.test(s)) return 0;
    return Number(s) / 100;
  };

  // 「文档级 querySelector」同样是排除项：平台把 <form name="v_dto3"> 放在表格里，
  // HTML 解析器会把它提升/剥离，form 自身是空壳（childElementCount === 0），
  // 输入框落在 form 之外 —— 必须文档级查询，不能用 form.querySelector。
  const form = document.forms.v_dto3;
  if (!form) return null;

  const val = (n) => form.elements[n]?.value ?? '';
  const lines = [];
  for (let i = 1; i <= 20; i++) {
    const acc1 = (val(`r${i}_accountid_1`) || '').trim();
    if (!acc1) continue; // 空行表示分录结束
    lines.push({
      row: i,
      accountCode: acc1,                                   // 一级科目，4 位
      accountDetail: (val(`r${i}_accountid_last`) || '').trim(), // 明细科目
      debitRaw: (val(`r${i}_debit`) || '').trim(),
      lendRaw: (val(`r${i}_lend`) || '').trim(),
    });
  }

  // 摘要与科目名称在表格文本里，按 data_tb 的行顺序取
  const tb = document.getElementById('data_tb');
  const names = [];
  if (tb) {
    for (const tr of [...tb.rows].slice(2)) {
      const tds = [...tr.cells];
      if (!tds.length) continue;
      const summary = (tds[0]?.innerText || '').replace(/\s+/g, ' ').trim();
      const accText = (tds[1]?.innerText || '').replace(/\s+/g, ' ').trim();
      const detailCell = (tds[2]?.innerText || '').replace(/\s+/g, ' ').trim();
      if (accText === '合 计' || accText === '合计') continue;
      // 只保留真正有科目的行，避免空行错位
      if (!accText && !detailCell) continue;
      names.push({ summary, accountName: accText, detailName: detailCell });
    }
  }

  lines.forEach((l, idx) => {
    l.summary = names[idx]?.summary || '';
    l.accountName = names[idx]?.accountName || '';
    l.detailName = names[idx]?.detailName || '';
  });

  // 凭证头
  const headText = (document.body.innerText || '').replace(/\s+/g, ' ');
  const dateMatch = headText.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  const noMatch = headText.match(/记字第\s*(\d+)\s*号/);
  const pageMatch = headText.match(/(\d+)\s*\/\s*(\d+)\s*摘\s*要/) || headText.match(/【凭证(\d+)\/(\d+)】/);

  return {
    accountRecordId: val('accountrecordid') || null,
    ny: val('ny') || null,
    date: dateMatch ? `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, '0')}-${String(dateMatch[3]).padStart(2, '0')}` : null,
    voucherNo: noMatch ? Number(noMatch[1]) : null,
    pageNo: pageMatch ? Number(pageMatch[1]) : 1,
    pageCount: pageMatch ? Number(pageMatch[2]) : 1,
    totalDebit: fen2yuan(String(val('total_debit')).replace(/[￥¥,\s\u00a0]/g, '')),
    totalLend: fen2yuan(String(val('total_lend')).replace(/[￥¥,\s\u00a0]/g, '')),
    billCount: (val('bill_count') || '').trim(),
    preparer: (val('person_jz') || '').trim(),
    lines: lines.map((l) => ({
      row: l.row,
      summary: l.summary,
      accountCode: l.accountCode,
      accountName: l.accountName,
      accountDetail: l.accountDetail,
      detailName: l.detailName,
      debit: fen2yuan(l.debitRaw),
      lend: fen2yuan(l.lendRaw),
    })),
  };
};

/** 读取当前凭证详情页的分页信息（有几页、当前第几页）。 */
const READ_PAGING = () => {
  const form = document.forms.v_dto3;
  if (!form) return { current: 1, total: 1 };
  const txt = (document.body.innerText || '').replace(/\s+/g, ' ');
  const m = txt.match(/【凭证(\d+)\/(\d+)】/g);
  let total = 1;
  if (m && m.length) {
    total = Math.max(...m.map((s) => Number(s.match(/(\d+)\/(\d+)/)?.[2] || 1)));
  }
  return { current: Number(form.elements.current_page?.value || 1), total };
};

/**
 * 跳到凭证详情的第 n 页。平台是表单提交，不是 URL 跳转 ——
 * 「凭证详情翻页方式」属 README 排除项，不要改成 URL 跳转。
 */
const GOTO_PAGE = (n) => {
  const form = document.forms.v_dto3;
  if (!form) return false;
  form.start.value = 'jzpz_list_for_chargup_query_1rec';
  form.target = '';
  form.current_page.value = String(n);
  form.submit();
  return true;
};

/** 在打开的页面里找到承载凭证体的 frame：优先按已知名，其次按是否含 v_dto3 表单探测。 */
async function findVoucherFrame(page, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const named = frameByNameOrNull(page, 'node_mainWin_uid_jzpz');
    if (named) return named;
    for (const f of page.frames()) {
      try {
        if (await f.evaluate(() => !!document.forms.v_dto3)) return f;
      } catch {
        /* 跨上下文或导航中，继续找 */
      }
    }
    await page.waitForTimeout(300);
  }
  return null;
}

const { browser, page, dialogs } = await openSession(cfg);
const raw = { side: SIDE, listUrls: [], pages: [], listLinks: [] };
const vouchers = [];

try {
  await login(page, cfg, dialogs);
  await page.goto(new URL(entryUrl(cfg, ctx), cfg.baseUrl).href, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(4000);

  const mf = page.frames().find((f) => f.name() === 'main');
  if (!mf) throw new Error('未找到名为 main 的 frame，请确认已进入实训企业');
  await mf.goto(new URL(tAccountUrl(cfg, ctx), cfg.baseUrl).href, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(4000);

  // --- 1. 在凭证列表页遍历分页，收集全部凭证入口 ---
  //
  // 列表页解析走 src/parse-links.mjs 的纯函数：答案侧属性用 &quot; 转义、学生侧用单引号，
  // 必须先做 HTML 实体解码，否则正则匹配数为 0（实测答案列表页首版即 0 命中）。
  const allLinks = [];
  let totalPages = 1;
  for (let p = 1; p <= 30; p++) {
    const listUrl = voucherListUrl(ctx, SIDE, p);
    raw.listUrls.push(listUrl);
    await mf.goto(new URL(listUrl, cfg.baseUrl).href, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1800);

    const html = await mf.content();
    const links = parseVoucherLinks(html, { detailAction: DETAIL_ACTION });
    const paging = parsePaging(html);
    totalPages = paging.total;
    raw.pages.push({ page: p, count: links.length, paging, htmlBytes: html.length });
    console.log(`第${p}页: 收集到 ${links.length} 张凭证（共 ${paging.total} 页）`);

    if (!links.length) break;
    allLinks.push(...links);

    if (p >= totalPages) { console.log('  已是最后一页'); break; }
  }

  // 去重（parseVoucherLinks 内部已按 accountrecordid 去重，此处跨页再合一次）
  const seen = new Set();
  const uniq = [];
  for (const l of allLinks) {
    const key = l.accountRecordId ?? l.url;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(l);
  }
  console.log(`\n共收集 ${allLinks.length} 条，去重后 ${uniq.length} 张凭证`);
  raw.listLinks = uniq;

  // --- 2. 逐张抓取分录 ---
  const detailPage = await page.context().newPage();
  const detailDialogs = [];
  detailPage.on('dialog', async (d) => { detailDialogs.push(d.message()); await d.dismiss(); });

  for (let i = 0; i < uniq.length; i++) {
    const item = uniq[i];
    const url = new URL(innerDetailUrl(item.url), cfg.baseUrl).href;
    try {
      await detailPage.goto(url, { waitUntil: 'load', timeout: 30000 });
      await detailPage.waitForTimeout(700);

      let jf = await findVoucherFrame(detailPage, 8000);
      if (!jf) { console.warn(`  [${i + 1}] ${item.label} 未找到凭证 frame，跳过`); continue; }

      // 凭证可能跨多页（每页 5 行分录），逐页抓全
      const first = await jf.evaluate(PARSE_VOUCHER);
      if (!first) { console.warn(`  [${i + 1}] ${item.label} 解析为空`); continue; }

      const allLines = [...first.lines];
      const totalPagesOfVoucher = first.pageCount;
      for (let p = 2; p <= totalPagesOfVoucher; p++) {
        const ok = await jf.evaluate(GOTO_PAGE, p);
        if (!ok) break;
        await detailPage.waitForTimeout(700);
        jf = await findVoucherFrame(detailPage, 8000);
        if (!jf) break;
        const pg = await jf.evaluate(PARSE_VOUCHER);
        if (!pg) break;
        allLines.push(...pg.lines);
      }

      vouchers.push({
        label: item.label,
        ...first,
        pages: totalPagesOfVoucher,
        lines: allLines,
      });

      if ((i + 1) % 10 === 0 || i === uniq.length - 1) {
        console.log(`  已抓取 ${i + 1}/${uniq.length} 张`);
      }
    } catch (e) {
      console.warn(`  [${i + 1}] ${item.label} 出错: ${e.message}`);
    }
  }
  await detailPage.close();

  // --- 3. 落盘 ---
  writeFileSync(resolve(OUT, VOUCHERS_FILE), JSON.stringify(vouchers, null, 2));
  writeFileSync(resolve(OUT, PROBE_FILE), JSON.stringify(raw, null, 2));

  // --- 4. 即时体检：借贷平衡 ---
  let unbalanced = 0;
  let totalDebit = 0;
  let totalLend = 0;
  for (const v of vouchers) {
    const d = v.lines.reduce((s, l) => s + l.debit, 0);
    const c = v.lines.reduce((s, l) => s + l.lend, 0);
    totalDebit += d;
    totalLend += c;
    if (Math.abs(d - c) > 0.005) {
      unbalanced++;
      console.log(`  ⚠ ${v.label} 借贷不平: 借 ${d} 贷 ${c}`);
    }
  }
  console.log(`\n抓取完成（${SIDE === 'answer' ? '官方答案' : '学生已录'}侧）：${vouchers.length} 张凭证`);
  console.log(`借贷合计: 借 ${totalDebit.toFixed(2)} / 贷 ${totalLend.toFixed(2)}`);
  console.log(`不平张数: ${unbalanced}`);
  console.log(`产出: out/${VOUCHERS_FILE}`);
  if (SIDE === 'answer') {
    console.log('提示：`node src/fetch-vouchers.mjs --side=student` 抓学生侧，供 aggregate 的锁三比对。');
  }
} catch (e) {
  console.error('中断:', e.message);
  writeFileSync(resolve(OUT, VOUCHERS_FILE), JSON.stringify(vouchers, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}