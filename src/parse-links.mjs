// 凭证列表页的链接解析器（纯字符串函数，无 DOM 依赖）。
//
// 为什么单独成模块：
//   1) 学生版列表页属性用单引号（openTag('记1', 'do?...')），老师/答案版用 `&quot;` 转义
//      （openTag(&quot;记1&quot;, &quot;do?action=zhsx_common_jzpz&amp;...&quot;)）。**必须先做 HTML 实体解码**，
//      否则正则匹配数为 0 —— 实测答案列表页首版解析就是这个结果。
//   2) 写成纯函数后，可用 .scratch/voucher2t-taccount/evidence/teacher-list.html 离线复验，
//      不必连平台。取页面 HTML 用 frame.content()，Node 侧解析，全链路只有这一份实现。

/** 单轮 HTML 实体解码（&amp; 放最后，避免把 &amp;quot; 提前拆成无意义的 "&quot"）。 */
const decodeOnce = (s) => s
  .replace(/&quot;/g, '"')
  .replace(/&#34;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&');

/**
 * HTML 实体解码。
 *
 * 迭代到稳定：单轮解码无法处理 `&amp;quot;` 这类**双重编码**（一轮后得到字面量 `&quot;`）。
 * 实测平台是单层 &quot;（见 evidence/teacher-list.html），但网关/中间层可能再包一层 ——
 * 迭代解码只是多跑一两轮，代价可忽略，却能避免「换了部署环境就匹配数为 0」。
 * 限次 4 轮，防止畸形输入造成的无谓扫描。
 */
export function decodeEntities(s) {
  let cur = String(s ?? '');
  for (let i = 0; i < 4; i++) {
    const next = decodeOnce(cur);
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

/**
 * 从列表页 HTML 里抽出全部凭证详情入口。
 *
 * @param html 列表页原始 HTML（未解码亦可，内部会先解码）
 * @param opts.detailAction 详情 action 白名单，用于区分学生页与答案页；
 *        答案走 zhsx_common_jzpz，学生走 zhsx_common。传 null 表示不限。
 * @returns [{ label, url, accountRecordId }]
 */
export function parseVoucherLinks(html, opts = {}) {
  const action = opts.detailAction ?? null;
  const h = decodeEntities(html);
  const out = [];

  // 1) openTag("label", "url", "id") / openTag('label', 'url', 'id')
  const openTagRe = /openTag\(\s*(['"])([\s\S]*?)\1\s*,\s*(['"])([\s\S]*?)\3/g;
  for (const m of h.matchAll(openTagRe)) {
    const url = m[4].replace(/&amp;/g, '&');
    if (!url.includes('jzpz_list_for_chargup_query_1rec')) continue;
    if (action && !url.includes(`action=${action}`)) continue;
    out.push({ label: m[2], url });
  }

  // 2) 普通 href="do?...jzpz_list_for_chargup_query_1rec..."（不含 openTag 的形态）
  if (!out.length) {
    const hrefRe = /href\s*=\s*['"]((?:do\?)[^'"]*jzpz_list_for_chargup_query_1rec[^'"]*)['"]/g;
    for (const m of h.matchAll(hrefRe)) {
      const url = m[1].replace(/&amp;/g, '&');
      if (action && !url.includes(`action=${action}`)) continue;
      out.push({ label: '', url });
    }
  }

  // 3) 去重（按 accountrecordid；平台可能在同一页重复渲染入口）
  const seen = new Set();
  const uniq = [];
  for (const l of out) {
    const id = l.url.match(/accountrecordid=([A-Fa-f0-9]+)/)?.[1] ?? null;
    const key = id ?? l.url;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push({ ...l, accountRecordId: id });
  }
  return uniq;
}

/**
 * 列表页的分页信息。
 * 形态实测为「第1页/共7页」；也兼容「共 7 页」而无当前页的写法。
 */
export function parsePaging(html) {
  const t = decodeEntities(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  const both = t.match(/第\s*(\d+)\s*页\s*\/\s*共\s*(\d+)\s*页/);
  if (both) return { current: Number(both[1]), total: Number(both[2]) };
  const totalOnly = t.match(/共\s*(\d+)\s*页/);
  if (totalOnly) return { current: 1, total: Number(totalOnly[1]) };
  return { current: 1, total: 1 };
}

/**
 * 从凭证详情页 HTML 里取「实际内容」框架的 URL。
 *
 * 外层 frameset 只有壳（约 2KB），凭证体在子框架 URL 里：
 *   入口：...&start=jzpz_list_for_chargup_query_1rec_skip&startAction=jzpz_list_for_chargup_query_1rec&...
 *   实际内容：...&start=jzpz_list_for_chargup_query_1rec&...（去掉 _skip 和 startAction）
 * 此处按同一规则改写，供 Playwright 直接 goto 子框架 URL 用。
 */
export function innerDetailUrl(url) {
  return String(url)
    .replace(/start=jzpz_list_for_chargup_query_1rec_skip/, 'start=jzpz_list_for_chargup_query_1rec')
    .replace(/&?startAction=jzpz_list_for_chargup_query_1rec/, '');
}