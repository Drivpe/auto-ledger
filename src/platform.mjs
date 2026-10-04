// 平台会话、登录、常量与 URL 构造的共用封装。
// 油猴版与 Playwright 版共用同一份业务逻辑时，本文件的纯逻辑部分保持与浏览器无关。
//
// 只读原则：本模块不含任何写平台数据的操作。
//
// 敏感实值治理（v2）：此前 SXID（会话 ID）与 URL 编码姓名被内联在 src/ 的四个脚本里。
// 现全部下沉 —— SXID 走配置（或 --sxid= / V2T_SXID），姓名走配置；源码内不再出现任何实值。

import { chromium } from '/home/Drivpe/.npm-global/lib/node_modules/playwright/index.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 平台已知的固定常量（action 名，非凭据）。集中在此，便于平台升级时只改一处。 */
export const PLATFORM = {
  loginAction: 'do?action=login',
  entryAction: 'do?action=login&start=begin',
  /** 登录后的落地页：选择实习实体 */
  entityChoiceAction: 'do?action=login&start=stu_choice_entityID',
  /** 以学生身份进入实训企业主框架 */
  studentFrame: 'do?action=e_entity&start=entity_main_student_frame',
  /** T 型账 */
  tAccount: 'ts_txz',
  /** 学生凭证查询（列表与详情同 action） */
  studentList: 'zhsx_common',
  studentDetail: 'zhsx_common',
  /** 官方答案凭证：列表同为 zhsx_common，详情走 zhsx_common_jzpz */
  answerList: 'zhsx_common',
  answerDetail: 'zhsx_common_jzpz',
  /** 期初余额（科目余额查询） */
  openingBalance: 'kjkmcx',
};

/**
 * 答案侧的 SXID 恒为 0，与账号、会话都无关（实测，见 v2-alignment.md 一.2）。
 * 这是「换一个人、换一个任务还能用」的技术支点：答案取数只依赖 entityID。
 */
export const ANSWER_SXID = '0';

export function loadConfig() {
  const p = resolve(ROOT, 'config/config.local.json');
  if (!existsSync(p)) {
    console.error(`读不到配置：${p}`);
    console.error('请复制 config/config.example.json 为 config/config.local.json 并填写账号密码。');
    process.exit(2);
  }
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`配置解析失败：${p} —— ${e.message}`);
    process.exit(2);
  }
}

export function absUrl(baseUrl, action) {
  return new URL(action, baseUrl).href;
}

/**
 * 解析实训上下文（SXID / entityID / 年月 / 入口显示名）。
 *
 * SXID 是会话级标识，属敏感实值，源码内不再内联：优先命令行 `--sxid=`，
 * 其次环境变量 `V2T_SXID`，最后 `config.local.json` 的 `platform.sxid`。
 * entityID / 年月非敏感，仍给出与平台现状一致的默认值（v2 决策 7：年月默认值保留不改）。
 *
 * @param opts.required 缺 SXID 时是否直接退出。演练/离线本不需要连平台，此时传 false。
 */
export function resolveContext(cfg, args = process.argv.slice(2), opts = {}) {
  const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
  const p = cfg.platform ?? {};

  const raw = flag('sxid') ?? process.env.V2T_SXID ?? p.sxid ?? null;
  // 配置示例里的占位符 <...> 视为未配置，避免把占位符当真实 SXID 用出去。
  const sxid = raw && !/^<.*>$/.test(String(raw).trim()) ? String(raw).trim() : null;
  const required = opts.required !== false;

  if (!sxid && required) {
    console.error('缺少 SXID（会话级标识，已从源码中下沉）。三选一：');
    console.error('  1) 命令行传：node src/xxx.mjs --sxid=<你的SXID>');
    console.error('  2) 环境变量：V2T_SXID=<你的SXID> node src/xxx.mjs');
    console.error('  3) 配置文件：config/config.local.json 增加 "platform": { "sxid": "<你的SXID>" }');
    console.error('取法：登录平台进入实训企业后，地址栏 URL 里的 SXID 参数。');
    process.exit(2);
  }

  return {
    sxid,
    entityID: String(flag('entity') ?? p.entityID ?? '110'),
    year: String(flag('year') ?? p.year ?? '2020'),
    month: String(flag('month') ?? p.month ?? '1'),
    /** e_entity 入口的显示名（URL 编码）。属个人信息，源码内不留实值；未配置则不带该参数。 */
    entryName: p.entryName && !/^<.*>$/.test(String(p.entryName).trim()) ? String(p.entryName).trim() : null,
    /** 学生凭证查询的 SXID；答案侧恒为 '0' */
    answerSxid: ANSWER_SXID,
  };
}

/** 构造「以学生身份进入实训企业」的入口 URL。 */
export function entryUrl(cfg, ctx) {
  const q = new URLSearchParams({
    action: 'e_entity',
    start: 'entity_main_student_frame',
    SXID: ctx.sxid ?? '0',
    EntityID: ctx.entityID,
  });
  if (ctx.entryName) q.set('C_NAME', ctx.entryName);
  return `do?${q.toString()}`;
}

/** 构造 T 型账入口 URL。 */
export function tAccountUrl(cfg, ctx) {
  return `do?action=${PLATFORM.tAccount}&start=1&entityID=${ctx.entityID}&SXID=${ctx.sxid}`;
}

/** 构造 T 型账「查询某科目」的 URL。 */
export function tAccountQuery(ctx, code) {
  return `do?action=${PLATFORM.tAccount}&start=query&accountID=${code}`
    + `&yyyy=${ctx.year}&mm=${ctx.month}&sxid=${ctx.sxid}&entityid=${ctx.entityID}`;
}

/**
 * 构造凭证查询的 URL。
 *
 * 实测差异：学生列表页属性用单引号，老师/答案列表页用 `&quot;` 转义 —— 解析层必须做 HTML 实体解码。
 * 答案侧 SXID 恒为 0（与账号无关），详情 action 走 zhsx_common_jzpz。
 *
 * @param side 'answer' | 'student'
 */
export function voucherListUrl(ctx, side = 'answer', page = 1) {
  const sxid = side === 'answer' ? ANSWER_SXID : ctx.sxid;
  const q = new URLSearchParams({
    action: side === 'answer' ? PLATFORM.answerList : PLATFORM.studentList,
    start: 'jzpz_list',
    SXID: sxid,
    entityID: ctx.entityID,
    QueryOnly: '1',
    readyOnly: '1',
  });
  if (page > 1) q.set('page', String(page));
  return `do?${q.toString()}`;
}

/** 期初余额（科目余额表）URL。 */
export function openingBalanceUrl(ctx) {
  return `do?action=${PLATFORM.openingBalance}&start=kjkmcx`
    + `&entityID=${ctx.entityID}&SXID=${ctx.sxid}`;
}

/**
 * 打开浏览器与上下文。返回 { browser, context, page, dialogs }。
 * dialogs 收集平台以 JS alert 形式给出的反馈（平台不用 HTTP 错误码报错）。
 */
export async function openSession(cfg) {
  const browser = await chromium.launch({
    headless: !cfg.run?.headful,
    slowMo: cfg.run?.slowMoMs ?? 0,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const page = await context.newPage();

  const dialogs = [];
  if (cfg.run?.captureDialogs !== false) {
    page.on('dialog', async (d) => {
      dialogs.push({ type: d.type(), message: d.message() });
      try {
        await d.dismiss();
      } catch {
        /* 对话框可能已自行关闭 */
      }
    });
  }
  return { browser, context, page, dialogs };
}

/**
 * 执行登录。成功返回落地页信息，失败抛出带平台原文提示的错误。
 * 判据：平台登录失败只弹 alert，不返回错误码；因此以「是否弹窗」+「是否离开登录表单」共同判定。
 */
export async function login(page, cfg, dialogs = []) {
  await page.goto(cfg.baseUrl, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(800);

  if (!(await page.$('form[name="loginForm"]'))) {
    throw new Error('未找到 loginForm，登录页结构可能已变化');
  }

  await page.fill('input[name="userid"]', cfg.login.userid);
  await page.fill('input[name="Password"]', cfg.login.password);
  await page.check(`input[name="role"][value="${cfg.login.role || 'student'}"]`);

  const before = dialogs.length;
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => null),
    page.evaluate(() => document.forms.loginForm.submit()),
  ]);
  await page.waitForTimeout(2500);

  if (dialogs.length > before) {
    throw new Error(`登录失败，平台提示：${dialogs.at(-1).message}`);
  }
  return { url: page.url(), title: await page.title() };
}

/** 定位平台的主内容 frame（名为 main）。平台的导航与表格都在其中。 */
export async function mainFrame(page, timeoutMs = 15000) {
  return frameByName(page, 'main', timeoutMs);
}

/** 按 frame 名轮询等待。平台 frameset 会在导航后重建 frame，名字是唯一稳定锚点。 */
export async function frameByName(page, name, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const f = page.frames().find((x) => x.name() === name);
    if (f) return f;
    await page.waitForTimeout(300);
  }
  throw new Error(`未找到名为 ${name} 的 frame`);
}

/** 非阻塞版：取不到返回 null。 */
export function frameByNameOrNull(page, name) {
  return page.frames().find((x) => x.name() === name) ?? null;
}