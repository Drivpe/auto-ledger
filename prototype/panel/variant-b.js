// PROTOTYPE — 变体 B：横向标签 · 卡片流。一次性代码，不是生产实现。
(function () {
  'use strict';

  /* ============================================================
   * 0. 内联几何 SVG 图标（不用 emoji，不引外部资源）
   * ========================================================== */
  const P = {
    taccount: '<path d="M4 6.5h16"/><path d="M12 6.5v13"/>',
    rows: '<path d="M4 6h4M11 6h9M4 12h4M11 12h9M4 18h4M11 18h9"/>',
    journal: '<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M8 8.5h8M8 12.5h8M8 16.5h4.5"/>',
    summary: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 10h17M10 10v9"/>',
    ledger: '<path d="M5 4.5h13.5v15H5z"/><path d="M5 4.5A1.5 1.5 0 0 0 3.5 6v12A1.5 1.5 0 0 0 5 19.5"/><path d="M8.5 9h6M8.5 13h6"/>',
    report: '<path d="M4 19.5V11M10 19.5V4.5M16 19.5v-6"/><path d="M2.5 21.5h19"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M16.2 16.2L21 21"/>',
    chevron: '<path d="M6 9.5l6 6 6-6"/>',
    up: '<path d="M6 14.5l6-6 6 6"/>',
    dockDown: '<path d="M12 3.5v10"/><path d="M8 9.5l4 4 4-4"/><path d="M5 20.5h14"/>',
    play: '<path d="M8 5.6v12.8L19 12z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    refresh: '<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.5 3.5V8H16"/>',
    alert: '<path d="M12 3.5L21.5 20h-19z"/><path d="M12 9.5v4.5M12 17.2h.01"/>',
    db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6"/><path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.9 1.9M16.8 16.8l1.9 1.9M18.7 5.3l-1.9 1.9M7.2 16.8l-1.9 1.9"/>',
    moon: '<path d="M20.5 14.8A8.6 8.6 0 1 1 9.2 3.5a6.9 6.9 0 0 0 11.3 11.3z"/>',
    monitor: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 1 1 7 0v2.5"/>',
    spin: '<circle cx="12" cy="12" r="8" stroke-dasharray="14 40"/>',
    trash: '<path d="M4.5 6.5h15"/><path d="M9.5 6.5V4.2h5v2.3"/><path d="M6.5 6.5l1 13h9l1-13"/>',
    retry: '<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.5 3.5V8H16"/>',
    pause: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    ban: '<circle cx="12" cy="12" r="8.5"/><path d="M6.2 6.2l11.6 11.6"/>',
    question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.5"/><path d="M12 17h.01"/>',
    skip: '<path d="M5.5 18l8.5-6-8.5-6z"/><path d="M17.5 6v12"/>'
  };
  function ic(name, cls) {
    return '<svg class="vb-ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' +
      (P[name] || '') + '</svg>';
  }
  const SPIN = '<svg class="vb-ic vb-spin" viewBox="0 0 24 24" aria-hidden="true">' + P.spin + '</svg>';

  /* ============================================================
   * 1. 工具
   * ========================================================== */
  // ⚠ 夹具里两套数据的单位不同，务必分开处理（否则差 100 倍）：
  //   FX.sample[*] 的行金额 d/l/bal 是「分」→ 用 fen2yuan()
  //   FX.taccounts 的 d/l 已经是「元」→ 用 alreadyYuan()
  const money = (v) => Number(v) || 0;
  /** 金额一律取整到「元」显示：原型里不出现 .xx 小数位 */
  const fmt = (n) => Math.round(money(n)).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
  /** 「分」→ 显示串。先折算成元再取整。 */
  const fen2yuan = (fen) => fmt(money(fen) / 100);
  /** 值本身就是「元」，只做格式化。 */
  const alreadyYuan = (v) => fmt(v);
  // 历史名字，默认按「分」处理（sample 那一路用它）。taccounts 一律走 alreadyYuan。
  const yuan = fen2yuan;
  function hhmmss() {
    const d = new Date(), p = (x) => String(x).padStart(2, '0');
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  const esc = (s) => String(s == null ? '' : s)
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ============================================================
   * 2. 环节定义
   * ========================================================== */
  const TABS = [
    { id: 'tacct', label: 'T型账', icon: 'taccount', ready: true },
    { id: 'detail', label: '明细账', icon: 'rows', ready: true },
    { id: 'journal', label: '日记账', icon: 'journal', ready: false,
      title: '日记账 · 待接入', desc: '需按日逐笔序时登记' },
    { id: 'summary', label: '科目汇总表', icon: 'summary', ready: false,
      title: '科目汇总表 · 待接入', desc: '依赖 T 型账试算平衡' },
    { id: 'ledger', label: '总账', icon: 'ledger', ready: false,
      title: '总账 · 待接入', desc: '由科目汇总表过入' },
    { id: 'report', label: '会计报表', icon: 'report', ready: false,
      title: '会计报表 · 待接入', desc: '取数排在登账链路末端' }
  ];
  const SNAPSHOT_ID = '2026-10-13';

  /* ============================================================
   * 3. 样式
   * ========================================================== */
  const CSS = `
.vb-shell,.vb-strip{font-family:var(--md-font);color:var(--md-on-surface)}
/* 覆盖 tokens.css 的 .vp-root .vp-ic{fill:currentColor}：本变体用描边图标，必须 fill:none
   （用 svg.vb-ic 提高一级特异性，不依赖样式表先后顺序） */
.vb-shell svg.vb-ic,.vb-strip svg.vb-ic{width:18px;height:18px;flex:0 0 auto;display:block;fill:none;
  stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.vb-shell svg.vb-ic.vb-ic-sm{width:16px;height:16px}
.vb-spin{animation:vb-rot 900ms linear infinite;transform-origin:center}
@keyframes vb-rot{to{transform:rotate(360deg)}}

/* ---- 外壳：宽而扁的 bottom sheet ---- */
.vb-shell{position:absolute;inset:0;display:flex;flex-direction:column;min-height:0;overflow:hidden;
  border-radius:var(--md-sh-xl);background:var(--md-surface);box-shadow:var(--md-shadow-4);
  pointer-events:auto;
  transition:opacity var(--md-dur-med) var(--md-ease-standard),transform var(--md-dur-med) var(--md-ease-standard)}
.vb-shell.vb-out{opacity:0;transform:translateY(26px);pointer-events:none}

/* ---- 头部 ---- */
.vb-head{display:flex;align-items:center;gap:var(--md-s3);padding:var(--md-s4) var(--md-s4) var(--md-s3);flex:0 0 auto}
.vb-head-lead{display:flex;align-items:center;gap:var(--md-s3);min-width:0}
.vb-mark{width:34px;height:34px;border-radius:var(--md-sh-md);flex:0 0 auto;display:grid;place-items:center;
  background:var(--md-primary-container);color:var(--md-on-primary-container)}
.vb-mark .vb-ic{width:19px;height:19px}
.vb-titles{min-width:0}
.vb-title{font-size:var(--md-title-md);line-height:var(--md-title-md-lh);font-weight:var(--md-w-med)}
.vb-sub{font-size:var(--md-body-sm);line-height:var(--md-body-sm-lh);color:var(--md-on-surface-variant);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vb-head-trail{margin-left:auto;display:flex;align-items:center;gap:var(--md-s2);flex:0 0 auto}

/* ---- Chip ---- */
.vb-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 var(--md-s3);
  border-radius:var(--md-sh-full);font-size:var(--md-label-md);font-weight:var(--md-w-med);white-space:nowrap}
.vb-chip .vb-ic{width:15px;height:15px}
.vb-chip-ter{background:var(--md-tertiary-container);color:var(--md-on-tertiary-container)}
.vb-chip-warn{background:var(--md-warn-container);color:var(--md-on-warn-container)}

/* ---- 图标按钮 ---- */
.vb-ib{width:36px;height:36px;flex:0 0 auto;display:grid;place-items:center;cursor:pointer;border:0;
  border-radius:var(--md-sh-full);background:transparent;color:var(--md-on-surface-variant);
  transition:background-color var(--md-dur-short) var(--md-ease-standard),color var(--md-dur-short) var(--md-ease-standard)}
.vb-ib:hover{background:var(--md-surface-container-high);color:var(--md-on-surface)}
.vb-ib.is-on{background:var(--md-secondary-container);color:var(--md-on-secondary-container)}

/* ---- 数据源状态条（tabs 上方的一条常驻条，两态可切换）---- */
.vb-srcbar{display:flex;align-items:center;gap:var(--md-s2);margin:0 var(--md-s4) var(--md-s3);
  padding:var(--md-s2) var(--md-s2) var(--md-s2) var(--md-s3);border-radius:var(--md-sh-lg);flex:0 0 auto;
  background:var(--md-tertiary-container);color:var(--md-on-tertiary-container)}
.vb-srcbar.is-warn{background:var(--md-warn-container);color:var(--md-on-warn-container)}
.vb-srcbar .vb-ic{width:17px;height:17px;flex:0 0 auto}
.vb-srcbar-txt{font-size:var(--md-body-sm);line-height:var(--md-body-sm-lh);min-width:0}
.vb-srcbar-txt b{font-weight:var(--md-w-bold)}
.vb-srcbar-txt b.vb-mono{font-family:var(--md-mono)}
.vb-srcbar .vb-mini{margin-left:auto;flex:0 0 auto;color:inherit}
.vb-srcbar .vb-mini:hover{background:rgba(0,0,0,.08)}
/* 开关自带的屏读文本必须视觉隐藏，否则会漏成可见文字压在 tabs 上 */
.vb-srcbar .vb-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;
  overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
/* 开关（MD3 switch）：仅换颜色与滑块位置 */
.vb-sw{position:relative;flex:0 0 auto;width:40px;height:24px;padding:0;border:0;cursor:pointer;
  border-radius:var(--md-sh-full);background:var(--md-surface-container-highest);
  box-shadow:inset 0 0 0 2px var(--md-outline);
  transition:background-color var(--md-dur-short) var(--md-ease-standard),box-shadow var(--md-dur-short) var(--md-ease-standard)}
.vb-sw i{position:absolute;top:50%;left:4px;width:15px;height:15px;margin-top:-7.5px;border-radius:var(--md-sh-full);
  background:var(--md-outline);
  transition:left var(--md-dur-med) var(--md-ease-emphasized),background-color var(--md-dur-short) var(--md-ease-standard)}
.vb-sw.is-on{background:var(--md-warn-container);box-shadow:inset 0 0 0 2px var(--md-warn)}
.vb-sw.is-on i{left:21px;background:var(--md-warn)}
/* 视觉隐藏但可读屏（本变体自带，不复用 tokens.css 的 .vp-sr 命名前缀） */
.vb-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip:rect(0 0 0 0);white-space:nowrap;border:0}

/* ---- Tabs ---- */
/* 6 个环节要一屏排下：收紧水平内边距，并让「待接入」退化为纯图标提示，
   避免徽标把 tabs 撑出可视区（横向滚动是兜底，不是常态） */
.vb-tabs{position:relative;flex:0 0 auto;overflow-x:auto;overflow-y:hidden;
  border-bottom:1px solid var(--md-outline-variant);padding:0 var(--md-s3)}
.vb-tabs-inner{position:relative;display:flex;align-items:stretch;gap:2px;width:max-content;min-width:100%}
.vb-tab{position:relative;display:flex;align-items:center;gap:7px;height:50px;padding:0 var(--md-s3);
  border:0;background:transparent;cursor:pointer;white-space:nowrap;z-index:1;font-family:var(--md-font);
  font-size:var(--md-title-sm);line-height:var(--md-title-sm-lh);font-weight:var(--md-w-med);
  color:var(--md-on-surface-variant);transition:color var(--md-dur-med) var(--md-ease-standard)}
.vb-tab .vb-ic{width:18px;height:18px;opacity:.9}
.vb-tab:hover{color:var(--md-on-surface)}
.vb-tab.is-active{color:var(--md-primary)}
.vb-tab.is-soon{opacity:.62}
.vb-tab.is-soon:hover{opacity:.85}
.vb-tab-ink{position:absolute;left:0;bottom:0;height:3px;width:0;
  border-radius:var(--md-sh-full) var(--md-sh-full) 0 0;background:var(--md-primary);
  transition:transform var(--md-dur-med) var(--md-ease-standard),width var(--md-dur-med) var(--md-ease-standard)}
.vb-tab-badge{display:inline-flex;align-items:center;justify-content:center;height:18px;min-width:18px;
  padding:0 6px;border-radius:var(--md-sh-full);background:var(--md-surface-container-high);
  color:var(--md-on-surface-variant);font-family:var(--md-mono);font-size:var(--md-label-sm);
  font-variant-numeric:tabular-nums}
.vb-tab.is-active .vb-tab-badge{background:var(--md-primary-container);color:var(--md-on-primary-container)}
.vb-tab-badge.is-soon{background:transparent;box-shadow:inset 0 0 0 1px var(--md-outline-variant);
  padding:0 5px;color:var(--md-outline)}
.vb-tab-badge.is-soon .vb-ic{width:11px;height:11px;opacity:.9}

/* ---- 进度线 ---- */
.vb-prog{height:2px;flex:0 0 auto;overflow:hidden;background:transparent}
.vb-prog.is-live{background:var(--md-surface-container)}
.vb-prog i{display:block;height:100%;width:0;opacity:0;background:var(--md-primary);
  transition:width var(--md-dur-med) var(--md-ease-standard),opacity var(--md-dur-short) var(--md-ease-standard)}
.vb-prog.is-live i{opacity:1}

/* ---- 工具行 ---- */
.vb-tools{display:flex;align-items:center;gap:var(--md-s2);padding:var(--md-s3) var(--md-s4) var(--md-s2);flex:0 0 auto}
.vb-field{display:flex;align-items:center;gap:var(--md-s2);height:36px;padding:0 var(--md-s3);
  border-radius:var(--md-sh-full);background:var(--md-surface-container-low);flex:0 1 320px;min-width:150px}
.vb-field .vb-ic{width:17px;height:17px;color:var(--md-on-surface-variant)}
.vb-field input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:inherit;
  font-family:var(--md-font);font-size:var(--md-body-md)}
.vb-field input::placeholder{color:var(--md-on-surface-variant);opacity:.75}
.vb-seg{display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:var(--md-sh-full);
  background:var(--md-surface-container-low)}
.vb-seg button{height:32px;padding:0 var(--md-s3);border:0;border-radius:var(--md-sh-full);cursor:pointer;
  background:transparent;color:var(--md-on-surface-variant);font-family:var(--md-font);
  font-size:var(--md-label-md);font-weight:var(--md-w-med);white-space:nowrap;
  transition:background-color var(--md-dur-short) var(--md-ease-standard),color var(--md-dur-short) var(--md-ease-standard)}
.vb-seg button:hover:not([disabled]){color:var(--md-on-surface)}
.vb-seg button.is-on{background:var(--md-surface-container-lowest);color:var(--md-on-surface);box-shadow:var(--md-shadow-1)}
.vb-seg button[disabled],.vb-field input[disabled]{opacity:.4;cursor:not-allowed}
.vb-count{margin-left:auto;font-family:var(--md-mono);font-size:var(--md-label-md);
  font-variant-numeric:tabular-nums;color:var(--md-on-surface-variant);white-space:nowrap}

/* ---- 主体与卡片流 ---- */
.vb-body{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden}
.vb-pane{padding:var(--md-s1) var(--md-s4) var(--md-s6);animation:vb-fade var(--md-dur-med) var(--md-ease-decel) both}
@keyframes vb-fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.vb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(286px,1fr));gap:var(--md-s3);align-items:start}
.vb-card{background:var(--md-surface-container-low);border-radius:var(--md-sh-md);box-shadow:var(--md-shadow-1);
  overflow:hidden;animation:vb-rise var(--md-dur-med) var(--md-ease-decel) both;
  animation-delay:calc(var(--i,0) * 14ms);transition:box-shadow var(--md-dur-med) var(--md-ease-standard),
  background-color var(--md-dur-med) var(--md-ease-standard)}
@keyframes vb-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.vb-card:hover{box-shadow:var(--md-shadow-2)}
.vb-card.is-open{grid-column:1/-1;box-shadow:var(--md-shadow-3)}
.vb-card[data-state="running"]{background:var(--md-surface-container);box-shadow:var(--md-shadow-3)}

/* ---- 卡片头 ---- */
.vb-cardhd{display:flex;align-items:center;gap:var(--md-s3);padding:var(--md-s3) var(--md-s3) var(--md-s3) var(--md-s4);
  cursor:pointer;user-select:none}
.vb-code{font-family:var(--md-mono);font-size:var(--md-label-md);font-variant-numeric:tabular-nums;
  color:var(--md-on-surface-variant);background:var(--md-surface-container);padding:2px 7px;
  border-radius:var(--md-sh-xs);flex:0 0 auto;letter-spacing:.02em}
.vb-cname{font-size:var(--md-title-sm);line-height:var(--md-title-sm-lh);font-weight:var(--md-w-med);
  flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vb-caret{color:var(--md-on-surface-variant);transition:transform var(--md-dur-med) var(--md-ease-standard)}
.vb-card.is-open .vb-caret{transform:rotate(180deg)}

/* ---- 卡片数字 ---- */
.vb-figures{display:flex;align-items:flex-end;gap:var(--md-s5);padding:0 var(--md-s4) var(--md-s4)}
.vb-fig{min-width:0}
.vb-fig-k{font-size:var(--md-label-sm);letter-spacing:.04em;color:var(--md-on-surface-variant)}
.vb-fig-v{font-family:var(--md-mono);font-size:var(--md-title-md);line-height:1.35;
  font-weight:var(--md-w-med);font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.vb-fig.is-l .vb-fig-v{color:var(--md-on-surface-variant)}
.vb-fig.is-bad .vb-fig-k,.vb-fig.is-bad .vb-fig-v{color:var(--md-warn)}
.vb-meta{margin-left:auto;text-align:right}
.vb-meta-v{font-family:var(--md-mono);font-size:var(--md-label-md);font-variant-numeric:tabular-nums;
  color:var(--md-on-surface-variant)}

/* ---- 状态徽标 ---- */
.vb-badge{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 var(--md-s2);
  border-radius:var(--md-sh-full);font-size:var(--md-label-sm);font-weight:var(--md-w-med);flex:0 0 auto;
  white-space:nowrap}
.vb-badge .vb-ic{width:13px;height:13px}
.vb-b-pending{box-shadow:inset 0 0 0 1px var(--md-outline-variant);color:var(--md-on-surface-variant)}
.vb-b-run{background:var(--md-primary-container);color:var(--md-on-primary-container)}
.vb-b-done{background:var(--md-secondary-container);color:var(--md-on-secondary-container)}
.vb-b-idle{color:var(--md-on-surface-variant);opacity:.6}
.vb-b-bad{background:var(--md-error-container);color:var(--md-on-error-container)}
.vb-b-warn{background:var(--md-warn-container);color:var(--md-on-warn-container)}
.vb-b-unknown{background:var(--md-surface-container-highest);color:var(--md-on-surface-variant)}

/* ---- 卡片展开区 ---- */
.vb-fold{display:grid;grid-template-rows:0fr;transition:grid-template-rows var(--md-dur-med) var(--md-ease-standard)}
.vb-card.is-open .vb-fold{grid-template-rows:1fr}
.vb-fold-in{overflow:hidden;min-height:0}
.vb-sect{padding:var(--md-s1) var(--md-s4) var(--md-s4)}
.vb-sect + .vb-sect{border-top:1px solid var(--md-outline-variant);padding-top:var(--md-s2)}
.vb-sect-h{display:flex;align-items:center;gap:var(--md-s2);margin:var(--md-s2) 0;
  font-size:var(--md-label-md);font-weight:var(--md-w-bold);letter-spacing:.05em;color:var(--md-on-surface-variant)}
.vb-sect-h .vb-ic{width:15px;height:15px}
.vb-kv{display:flex;flex-wrap:wrap;gap:var(--md-s2) var(--md-s5);font-size:var(--md-body-sm);
  color:var(--md-on-surface-variant)}
.vb-kv b{color:var(--md-on-surface);font-family:var(--md-mono);font-variant-numeric:tabular-nums;font-weight:var(--md-w-med)}

/* ---- 账页清单 ---- */
.vb-page{display:flex;align-items:center;gap:var(--md-s3);padding:var(--md-s2) var(--md-s3);
  border-radius:var(--md-sh-sm);transition:background-color var(--md-dur-short) var(--md-ease-standard)}
.vb-page:hover{background:var(--md-surface-container)}
.vb-page + .vb-page{margin-top:2px}
.vb-page-code{font-family:var(--md-mono);font-size:var(--md-label-md);font-variant-numeric:tabular-nums;
  color:var(--md-on-surface-variant);flex:0 0 auto;min-width:52px}
.vb-page-name{flex:1;min-width:0;font-size:var(--md-body-sm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vb-page-rows{font-family:var(--md-mono);font-size:var(--md-label-sm);font-variant-numeric:tabular-nums;
  color:var(--md-on-surface-variant);flex:0 0 auto}

/* ---- 账页表格 ---- */
.vb-ledger{background:var(--md-surface-container-lowest);border-radius:var(--md-sh-sm);overflow:hidden;margin-top:var(--md-s2)}
.vb-led-hd,.vb-led-row{display:grid;grid-template-columns:42px 40px 26px minmax(96px,1fr) 74px 74px 26px 78px;
  align-items:center;font-variant-numeric:tabular-nums}
.vb-led-hd{position:sticky;top:0;z-index:1;background:var(--md-surface-container);
  font-size:var(--md-label-sm);letter-spacing:.04em;color:var(--md-on-surface-variant)}
.vb-led-hd span,.vb-led-row span{padding:6px var(--md-s1);text-align:right;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.vb-led-hd span:first-child,.vb-led-row span:first-child,
.vb-led-hd span:nth-child(4),.vb-led-row span:nth-child(4){text-align:left}
.vb-led-hd span:nth-child(3),.vb-led-row span:nth-child(3),
.vb-led-hd span:nth-child(7),.vb-led-row span:nth-child(7){text-align:center}
.vb-led-row{font-family:var(--md-mono);font-size:var(--md-mono-sm);
  border-top:1px solid var(--md-outline-variant)}
.vb-led-row.r-open{background:var(--md-surface-container)}
.vb-led-row.r-month{background:var(--md-surface-container);font-weight:var(--md-w-bold)}
.vb-led-row.r-year{background:var(--md-secondary-container);color:var(--md-on-secondary-container);font-weight:var(--md-w-bold)}
.vb-led-sep{border-top:1px dashed var(--md-outline-variant);margin:3px var(--md-s1);height:0}

/* ---- 内联可折叠日志 ---- */
.vb-log{margin-top:var(--md-s1)}
.vb-log-hd{display:flex;align-items:center;gap:var(--md-s2);width:100%;border:0;cursor:pointer;
  background:transparent;padding:var(--md-s2);border-radius:var(--md-sh-sm);color:var(--md-on-surface-variant);
  font-family:var(--md-font);font-size:var(--md-label-md);font-weight:var(--md-w-med);
  transition:background-color var(--md-dur-short) var(--md-ease-standard)}
.vb-log-hd:hover{background:var(--md-surface-container)}
.vb-log-hd .vb-ic{width:15px;height:15px}
.vb-log-hd .vb-count{margin-left:auto;font-size:var(--md-label-sm)}
.vb-log.is-open .vb-log-hd .vb-caret{transform:rotate(180deg)}
.vb-log-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows var(--md-dur-med) var(--md-ease-standard)}
.vb-log.is-open .vb-log-body{grid-template-rows:1fr}
.vb-log-in{overflow:hidden;min-height:0}
.vb-log-list{padding:2px var(--md-s2) var(--md-s3);display:flex;flex-direction:column;gap:3px}
.vb-log-line{display:flex;gap:var(--md-s2);font-family:var(--md-mono);font-size:var(--md-mono-sm);line-height:1.55}
.vb-log-t{color:var(--md-on-surface-variant);opacity:.7;flex:0 0 auto}
.vb-log-m{min-width:0;word-break:break-word}
.k-info .vb-log-m{color:var(--md-on-surface-variant)}
.k-ok .vb-log-m{color:var(--md-primary)}
.k-warn .vb-log-m{color:var(--md-warn)}
.k-err .vb-log-m{color:var(--md-error)}
.vb-log-empty{font-size:var(--md-body-sm);color:var(--md-on-surface-variant);opacity:.7;
  padding:var(--md-s1) var(--md-s2) var(--md-s3)}

/* ---- 空态 ---- */
.vb-empty{grid-column:1/-1;display:flex;flex-direction:column;align-items:center;text-align:center;
  gap:var(--md-s3);max-width:560px;margin:var(--md-s6) auto 0;
  padding:var(--md-s8) var(--md-s6);background:var(--md-surface-container-low);border-radius:var(--md-sh-lg);
  animation:vb-rise var(--md-dur-med) var(--md-ease-decel) both}
.vb-empty-ic{width:56px;height:56px;border-radius:var(--md-sh-full);display:grid;place-items:center;
  background:var(--md-surface-container-high);color:var(--md-on-surface-variant)}
.vb-empty-ic .vb-ic{width:26px;height:26px}
.vb-empty-t{font-size:var(--md-title-md);line-height:var(--md-title-md-lh);font-weight:var(--md-w-med)}
.vb-empty-d{font-size:var(--md-body-sm);line-height:var(--md-body-sm-lh);color:var(--md-on-surface-variant);max-width:46ch}
.vb-empty-act{display:flex;gap:var(--md-s2);margin-top:var(--md-s1)}

/* ---- 异常态卡（停止 / 部分失败 / 状态未知 / 失败可重试）----
   分级用语义色：失败=error、停止与冲突=warn、状态未知=中性 —— 未知不等于空，不能一律红 */
.vb-an{grid-column:1/-1;display:flex;align-items:center;gap:var(--md-s4);flex-wrap:wrap;
  padding:var(--md-s4) var(--md-s4);border-radius:var(--md-sh-lg);
  animation:vb-rise var(--md-dur-med) var(--md-ease-decel) both}
.vb-an.t-err{background:var(--md-error-container);color:var(--md-on-error-container)}
.vb-an.t-warn{background:var(--md-warn-container);color:var(--md-on-warn-container)}
.vb-an.t-unknown{background:var(--md-surface-container-highest);color:var(--md-on-surface)}
.vb-an-ic{width:42px;height:42px;border-radius:var(--md-sh-full);flex:0 0 auto;display:grid;place-items:center}
.vb-an.t-err .vb-an-ic{background:var(--md-error);color:var(--md-on-error)}
.vb-an.t-warn .vb-an-ic{background:var(--md-warn);color:var(--md-surface)}
.vb-an.t-unknown .vb-an-ic{background:var(--md-outline-variant);color:var(--md-on-surface-variant)}
.vb-an-tx{min-width:0;flex:1 1 220px;display:flex;flex-direction:column}
.vb-an-t,.vb-an-s{display:block}
.vb-an-t{font-size:var(--md-title-md);line-height:var(--md-title-md-lh);font-weight:var(--md-w-med)}
.vb-an-s{font-size:var(--md-body-sm);line-height:var(--md-body-sm-lh);opacity:.85}
.vb-an-nums{display:flex;gap:var(--md-s5);flex:0 0 auto}
.vb-an-n{display:flex;flex-direction:column}
.vb-an-n i{font-style:normal;font-size:var(--md-label-sm);opacity:.75}
.vb-an-n b{font-family:var(--md-mono);font-size:var(--md-title-lg);line-height:var(--md-title-lg-lh);
  font-weight:var(--md-w-med);font-variant-numeric:tabular-nums}
.vb-an-act{display:flex;gap:var(--md-s2);flex:0 0 auto;margin-left:auto}
.vb-an-list{flex:1 1 100%;display:flex;flex-direction:column;gap:2px;margin-top:var(--md-s1)}
.vb-an-li{display:flex;align-items:center;gap:var(--md-s3);padding:6px var(--md-s2);
  border-radius:var(--md-sh-sm);background:rgba(255,255,255,.4);font-size:var(--md-body-sm)}
.vb-an.t-unknown .vb-an-li{background:var(--md-surface-container-low)}
.vb-an-li b{font-family:var(--md-mono);font-size:var(--md-label-md);flex:0 0 auto}
.vb-an-li span:nth-child(2){flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vb-an-li i{font-style:normal;font-family:var(--md-mono);font-size:var(--md-label-sm);opacity:.8;flex:0 0 auto}
.vb-an-li .vb-text{color:inherit;box-shadow:inset 0 0 0 1px currentColor}

/* ---- 冲突裁决条（写前普查发现冲突时停在原地问用户）---- */
.vb-cf{grid-column:1/-1;display:flex;flex-direction:column;gap:var(--md-s3);
  padding:var(--md-s4);border-radius:var(--md-sh-lg);
  background:var(--md-warn-container);color:var(--md-on-warn-container);
  animation:vb-rise var(--md-dur-med) var(--md-ease-decel) both}
.vb-cf-h{display:flex;align-items:center;gap:var(--md-s3);font-size:var(--md-title-md);
  line-height:var(--md-title-md-lh);font-weight:var(--md-w-med)}
.vb-cf-h .vb-ic{width:22px;height:22px}
.vb-cf-h span.vb-cf-n{margin-left:auto;font-family:var(--md-mono);font-size:var(--md-label-md)}
.vb-cf-list{display:flex;flex-direction:column;border-radius:var(--md-sh-md);overflow:hidden;
  background:rgba(255,255,255,.42)}
.vb-cf-li{display:flex;align-items:center;gap:var(--md-s3);padding:7px var(--md-s3);
  font-size:var(--md-body-sm)}
.vb-cf-li + .vb-cf-li{border-top:1px solid rgba(0,0,0,.09)}
.vb-cf-li b{font-family:var(--md-mono);font-size:var(--md-label-md);flex:0 0 auto}
.vb-cf-li span:nth-child(2){flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vb-cf-li i{font-style:normal;font-family:var(--md-mono);font-size:var(--md-label-sm);flex:0 0 auto}
.vb-cf-act{display:flex;align-items:center;gap:var(--md-s2);flex-wrap:wrap}
.vb-cf-tip{font-size:var(--md-label-md);opacity:.85;flex:1 1 auto;min-width:0}

/* ---- MD3 对话框（清空二次确认）---- */
.vb-scrim{position:absolute;inset:0;z-index:30;border-radius:var(--md-sh-xl);background:var(--md-scrim);
  opacity:0;pointer-events:none;transition:opacity var(--md-dur-med) var(--md-ease-standard)}
.vb-scrim.is-on{opacity:var(--md-scrim-opacity);pointer-events:auto}
.vb-dlg{position:absolute;left:50%;top:50%;z-index:31;width:min(392px,calc(100% - 40px));
  transform:translate(-50%,-46%) scale(.94);opacity:0;pointer-events:none;display:flex;flex-direction:column;
  background:var(--md-surface-container-high);color:var(--md-on-surface);border-radius:var(--md-sh-xl);
  box-shadow:var(--md-shadow-5);
  transition:opacity var(--md-dur-med) var(--md-ease-standard),transform var(--md-dur-long) var(--md-ease-emphasized)}
.vb-dlg.is-on{opacity:1;pointer-events:auto;transform:translate(-50%,-50%) scale(1)}
.vb-dlg-c{padding:var(--md-s5) var(--md-s5) var(--md-s4)}
.vb-dlg-hd{display:flex;align-items:center;gap:var(--md-s3);margin-bottom:var(--md-s3)}
.vb-dlg-hd .vb-ic{width:26px;height:26px;flex:0 0 auto;color:var(--md-error)}
.vb-dlg-hd b{font-size:var(--md-title-lg);line-height:var(--md-title-lg-lh);font-weight:var(--md-w-med)}
.vb-dlg-c p{margin:0;font-size:var(--md-body-md);line-height:1.65;color:var(--md-on-surface-variant)}
.vb-dlg-act{display:flex;justify-content:flex-end;gap:var(--md-s2);padding:0 var(--md-s4) var(--md-s4)}
.vb-dlg-act .vb-text{height:40px;padding:0 var(--md-s5);font-size:var(--md-label-lg);color:var(--md-primary)}
.vb-dlg-act .vb-danger{height:40px;padding:0 var(--md-s5);font-size:var(--md-label-lg)}

/* ---- 按钮 ---- */
.vb-btn{display:inline-flex;align-items:center;gap:var(--md-s2);height:40px;padding:0 var(--md-s5);border:0;
  border-radius:var(--md-sh-full);cursor:pointer;font-family:var(--md-font);font-size:var(--md-label-lg);
  font-weight:var(--md-w-med);white-space:nowrap;
  transition:box-shadow var(--md-dur-short) var(--md-ease-standard),background-color var(--md-dur-short) var(--md-ease-standard),
  color var(--md-dur-short) var(--md-ease-standard),opacity var(--md-dur-short) var(--md-ease-standard)}
.vb-btn .vb-ic{width:17px;height:17px}
.vb-filled{background:var(--md-primary);color:var(--md-on-primary)}
.vb-filled:hover:not([disabled]){box-shadow:var(--md-shadow-2)}
.vb-tonal{background:var(--md-secondary-container);color:var(--md-on-secondary-container)}
.vb-tonal:hover:not([disabled]){box-shadow:var(--md-shadow-1)}
.vb-outline{box-shadow:inset 0 0 0 1px var(--md-outline);color:var(--md-on-surface);background:transparent}
.vb-danger{background:var(--md-error-container);color:var(--md-on-error-container)}
.vb-danger:hover:not([disabled]){box-shadow:var(--md-shadow-1)}
.vb-btn[disabled]{opacity:.38;cursor:not-allowed}
.vb-text{height:30px;padding:0 var(--md-s3);border:0;border-radius:var(--md-sh-full);cursor:pointer;
  background:transparent;color:var(--md-primary);font-family:var(--md-font);font-size:var(--md-label-md);
  font-weight:var(--md-w-med);flex:0 0 auto;transition:background-color var(--md-dur-short) var(--md-ease-standard)}
.vb-text:hover{background:var(--md-surface-container)}
.vb-mini{height:30px;padding:0 var(--md-s3);border:0;border-radius:var(--md-sh-full);cursor:pointer;
  background:transparent;color:inherit;font-family:var(--md-font);font-size:var(--md-label-md);
  font-weight:var(--md-w-med);display:inline-flex;align-items:center;gap:6px;
  transition:background-color var(--md-dur-short) var(--md-ease-standard)}
.vb-mini:hover{background:var(--md-surface-container-high)}
.vb-mini .vb-ic{width:15px;height:15px}

/* ---- 底部控制 ---- */
.vb-foot{flex:0 0 auto;display:flex;align-items:center;gap:var(--md-s2);padding:var(--md-s3) var(--md-s4);
  border-top:1px solid var(--md-outline-variant);background:var(--md-surface-container-low);flex-wrap:wrap}
.vb-when{display:flex;align-items:center;gap:var(--md-s2)}
.vb-selwrap{position:relative;display:inline-flex;align-items:center}
.vb-sel{appearance:none;height:36px;padding:0 30px 0 var(--md-s3);border:0;cursor:pointer;
  border-radius:var(--md-sh-sm);background:var(--md-surface-container-highest);color:var(--md-on-surface);
  font-family:var(--md-mono);font-size:var(--md-label-md);font-variant-numeric:tabular-nums}
.vb-selwrap > .vb-ic{position:absolute;right:8px;width:16px;height:16px;pointer-events:none;
  color:var(--md-on-surface-variant)}
.vb-foot-mid{margin-left:auto;display:flex;align-items:center;gap:var(--md-s3);min-width:0}
.vb-foot-stat{font-size:var(--md-label-md);color:var(--md-on-surface-variant);white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
/* 清空是独立的重置入口：danger 语义 + 与登账并列但视觉分组，绝不并进同一个按钮 */
.vb-btn.vb-clear{background:transparent;color:var(--md-error);box-shadow:inset 0 0 0 1px var(--md-error)}
.vb-btn.vb-clear:hover:not([disabled]){background:var(--md-error-container);color:var(--md-on-error-container)}
.vb-btn.vb-clear .vb-ic{width:18px;height:18px}

/* ---- 收起态：贴屏幕右下角的一条极扁平状态条（32px）----
   靠右下而非正中：宿主页底部的原型切换栏占着居中位置，两者会重叠 */
.vb-strip{position:fixed;display:flex;align-items:center;gap:var(--md-s2);height:32px;
  right:16px;left:auto;bottom:58px;width:auto;max-width:340px;
  padding:0 var(--md-s1) 0 var(--md-s3);
  border-radius:var(--md-sh-full);background:var(--md-surface-container-high);box-shadow:var(--md-shadow-2);
  opacity:0;transform:translateY(150%);pointer-events:none;cursor:pointer;overflow:hidden;
  transition:opacity var(--md-dur-med) var(--md-ease-standard),transform var(--md-dur-med) var(--md-ease-standard),
  background-color var(--md-dur-short) var(--md-ease-standard)}
.vb-strip.vb-in{opacity:.72;transform:none;pointer-events:auto}
.vb-strip.vb-in:hover{opacity:1;background:var(--md-surface-container-highest)}
.vb-strip-name{font-size:var(--md-label-md);font-weight:var(--md-w-med);white-space:nowrap}
.vb-strip-note{font-family:var(--md-mono);font-size:var(--md-label-sm);font-variant-numeric:tabular-nums;
  color:var(--md-on-surface-variant);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vb-strip-act{margin-left:auto;width:26px;height:26px;display:grid;place-items:center;border:0;flex:0 0 auto;
  border-radius:var(--md-sh-full);background:transparent;color:var(--md-on-surface-variant);cursor:pointer}
.vb-strip-act .vb-ic{width:15px;height:15px}
.vb-ring{width:15px;height:15px;flex:0 0 auto;transform:rotate(-90deg)}
.vb-ring circle{fill:none;stroke-width:3;stroke-linecap:round}
.vb-ring .tr{stroke:var(--md-outline-variant)}
.vb-ring .vl{stroke:var(--md-primary);transition:stroke-dasharray var(--md-dur-med) var(--md-ease-standard)}
`;

  /* ============================================================
   * 4. 装配
   * ========================================================== */
  function mount(host, ctx) {
    const fx = (ctx && ctx.fx) || window.FX || {};
    const api = (ctx && ctx.api) || {};
    const log = (m, k) => { try { api.log && api.log(m, k); } catch (e) { /* 原型：忽略 */ } };
    const setBusy = (b) => { try { api.setState && api.setState({ busy: !!b }); } catch (e) { /* 忽略 */ } };

    /* 宿主未给尺寸时的兜底：宽而扁、贴下半屏；unmount 原样恢复。
       bottom 取 56px 是为了让开宿主页底部居中的原型切换栏（bottom:14px），
       否则面板自己的控制条会被它压住。 */
    const hostStyle0 = host.getAttribute('style') || '';
    const r0 = host.getBoundingClientRect();
    if (r0.height < 120 || r0.width < 240) {
      host.style.left = 'max(16px, calc(50% - 34vw))';
      host.style.bottom = '56px';
      host.style.width = 'min(68vw, 1080px)';
      host.style.height = '52vh';
      host.style.top = 'auto';
      host.style.right = 'auto';
    }
    // host 是 fixed 定位的 .vp-root；内部全部 absolute。
    // pointer-events:none 落在 host 上，由 .vb-shell / .vb-strip 各自恢复 auto，
    // 这样收起后余下的透明区域不会挡住下面的平台页面。
    host.style.pointerEvents = 'none';

    const styleEl = document.createElement('style');
    styleEl.textContent = CSS;

    host.innerHTML = '';
    host.appendChild(styleEl);

    const st = {
      tab: 'tacct', collapsed: false, q: '', sort: 'code',
      theme: document.documentElement.dataset.theme || 'system',
      open: new Set(), logOpen: new Set(),
      snapUsed: false,              // 数据源状态：false = 教师答案实时（正常路径）；true = 接口未开放，回退仓库快照
      year: fx.year || '2020', month: fx.month || '1',
      running: false, done: {}, cur: null, logs: new Map(), prog: 0,
      // 异常态：null | 'stopped' | 'partial' | 'unknown' | 'retry'；
      // 以及「清空」二次确认与写前冲突裁决（两者都停在原地等用户决定）
      anomaly: null, retried: {}, dlg: null, conflict: false, conflictDone: false
    };

    // 完成集按环节隔离：T 型账登了 6 项不该影响明细账的进度
    const doneSet = () => (st.done[st.tab] || (st.done[st.tab] = new Set()));

    const shell = document.createElement('div');
    shell.className = 'vb-shell';
    const strip = document.createElement('div');
    strip.className = 'vb-strip';
    host.appendChild(shell);
    host.appendChild(strip);

    const tacctOf = (code) => (fx.taccounts || []).filter((t) => t.code === code)[0] || {};
    const pagesOf = (k) => (fx.books || {})[k] || [];
    const rowsOf = (k) => pagesOf(k).reduce((a, p) => a + (p.rows || 0), 0);

    function push(key, msg, kind) {
      if (!st.logs.has(key)) st.logs.set(key, []);
      const arr = st.logs.get(key);
      arr.push({ t: hhmmss(), k: kind || 'info', m: msg });
      if (arr.length > 40) arr.shift();
      st.logOpen.add(key);
    }

    /* ---------------- 头部 ---------------- */
    function headHTML() {
      const ti = st.theme === 'dark' ? 'moon' : st.theme === 'light' ? 'sun' : 'monitor';
      const tt = '主题：' + (st.theme === 'dark' ? '深色' : st.theme === 'light' ? '浅色' : '跟随系统') + '（点击切换）';
      return '<div class="vb-head">' +
        '<div class="vb-head-lead"><div class="vb-mark">' + ic('taccount') + '</div>' +
        '<div class="vb-titles"><div class="vb-title">教师答案登账</div>' +
        '<div class="vb-sub">' + esc(fx.entity || '') + ' · ' + esc(st.year) + '-' + esc(st.month) + '</div>' +
        '</div></div>' +
        '<div class="vb-head-trail">' +
        '<button type="button" class="vb-ib' + (st.theme !== 'system' ? ' is-on' : '') + '" data-act="theme" title="' + tt + '">' + ic(ti) + '</button>' +
        '<button type="button" class="vb-ib" data-act="collapse" title="收起到底部">' + ic('dockDown') + '</button>' +
        '</div></div>' + srcBarHTML();
    }

    /* 数据源状态条：常驻在 tabs 上方，两种形态可即时切换。
       primary  = 教师答案实时可用（tertiary 语义色，正常路径）
       fallback = 接口未开放，回退仓库内置快照（warn 警示语义） */
    function srcBarHTML() {
      const on = st.snapUsed;
      return '<div class="vb-srcbar' + (on ? ' is-warn' : '') + '">' +
        ic(on ? 'alert' : 'db') +
        '<div class="vb-srcbar-txt">' + (on
          ? '快照兜底 <b class="vb-mono">' + SNAPSHOT_ID + '</b> · 非实时'
          : '<b>教师答案 · 实时</b> · ' + st.year + '-' + st.month) +
        '</div>' +
        (on ? '<button type="button" class="vb-mini" data-act="recheck">' + ic('refresh') + '重试</button>' : '') +
        '<button type="button" class="vb-sw' + (on ? ' is-on' : '') + '" data-act="recheck" role="switch" ' +
        'aria-checked="' + (on ? 'true' : 'false') + '" data-sw ' +
        'title="' + (on ? '切换为：教师答案实时可用' : '切换为：模拟教师答案未开放 · 回退仓库快照') + '">' +
        '<i></i><span class="vb-sr">模拟教师答案未开放</span></button>' +
        '</div>';
    }

    /* ---------------- Tabs ---------------- */
    function tabsHTML() {
      const counts = { tacct: fx.taccountCount || 0, detail: (fx.bookKeys || []).length };
      return '<div class="vb-tabs vp-scroll"><div class="vb-tabs-inner">' +
        TABS.map((t) => {
          const badge = t.ready
            ? '<span class="vb-tab-badge">' + (counts[t.id] || 0) + '</span>'
            : '<span class="vb-tab-badge is-soon" title="待接入">' + ic('lock') + '</span>';
          return '<button type="button" class="vb-tab' + (t.id === st.tab ? ' is-active' : '') +
            (t.ready ? '' : ' is-soon') + '" data-act="tab" data-id="' + t.id + '" title="' +
            (t.ready ? t.label : t.label + ' · 待接入') + '">' +
            ic(t.icon) + '<span>' + t.label + '</span>' + badge + '</button>';
        }).join('') +
        '<span class="vb-tab-ink" data-ink></span></div></div>';
    }

    /* ---------------- 底部控制 ---------------- */
    function footHTML() {
      const sel = (id, cur, list, suf) => '<span class="vb-selwrap"><select class="vb-sel" data-act="sel" data-id="' + id + '">' +
        list.map((v) => '<option value="' + v + '"' + (String(cur) === v ? ' selected' : '') + '>' + v + suf + '</option>').join('') +
        '</select>' + ic('chevron') + '</span>';
      return '<div class="vb-foot">' +
        '<div class="vb-when">' + sel('year', st.year, ['2019', '2020', '2021'], ' 年') +
        sel('month', st.month, Array.from({ length: 12 }, (_, i) => String(i + 1)), ' 月') + '</div>' +
        '<button type="button" class="vb-btn vb-filled" data-act="run"' + (st.running ? ' disabled' : '') + '>' +
        ic('play') + (st.running ? '登账中' : '按教师答案登账') + '</button>' +
        '<button type="button" class="vb-btn vb-clear" data-act="clear-open" title="清空平台已登记行 · 不可撤销">' +
        ic('trash') + '清除</button>' +
        '<button type="button" class="vb-btn vb-danger" data-act="stop"' + (st.running ? '' : ' disabled') + '>' +
        ic('stop') + '停止</button>' +
        '<button type="button" class="vb-mini" data-act="demo" data-v="__next" title="循环演示异常态">' +
        ic('alert') + '异常演示</button>' +
        '<div class="vb-foot-mid"><span class="vb-foot-stat">已接入 2/6 · ' +
        (fx.taccountCount || 0) + ' 科目 · ' + (fx.bookKeys || []).length + ' 账簿' +
        '<span data-done></span></span></div></div>';
    }

    /* ---------------- 内联日志 ---------------- */
    function logInnerHTML(key) {
      const arr = st.logs.get(key) || [];
      if (!arr.length) {
        return '<div class="vb-log-empty">尚无日志。点「按教师答案登账」后逐条输出。</div>';
      }
      return '<div class="vb-log-list">' + arr.map((l) =>
        '<div class="vb-log-line k-' + l.k + '"><span class="vb-log-t">' + l.t + '</span>' +
        '<span class="vb-log-m">' + esc(l.m) + '</span></div>').join('') + '</div>';
    }
    function logBlock(key) {
      const n = (st.logs.get(key) || []).length;
      return '<div class="vb-sect"><div class="vb-log' + (st.logOpen.has(key) ? ' is-open' : '') + '">' +
        '<button type="button" class="vb-log-hd" data-act="log" data-key="' + key + '">' + ic('journal') +
        '<span>执行日志</span><span class="vb-count">' + n + '</span>' + ic('chevron', 'vb-caret') + '</button>' +
        '<div class="vb-log-body"><div class="vb-log-in">' + logInnerHTML(key) + '</div></div></div></div>';
    }

    /* ---------------- 卡片通用件 ---------------- */
    function badge(state) {
      if (state === 'done') return '<span class="vb-badge vb-b-done">' + ic('check') + '已登</span>';
      if (state === 'running') return '<span class="vb-badge vb-b-run">' + SPIN + '登账中</span>';
      if (state === 'idle') return '<span class="vb-badge vb-b-idle">无发生额</span>';
      if (state === 'bad') return '<span class="vb-badge vb-b-bad">' + ic('alert') + '失败</span>';
      if (state === 'unknown') return '<span class="vb-badge vb-b-unknown">' + ic('question') + '状态未知</span>';
      return '<span class="vb-badge vb-b-pending">待登</span>';
    }
    function emptyCard(icon, title, desc, action) {
      return '<div class="vb-empty"><div class="vb-empty-ic">' + ic(icon) + '</div>' +
        '<div class="vb-empty-t">' + esc(title) + '</div><div class="vb-empty-d">' + desc + '</div>' +
        '<div class="vb-empty-act"><button type="button" class="vb-btn vb-outline" disabled>' +
        ic('lock') + '登账（未接入）</button>' +
        (action ? '<button type="button" class="vb-btn vb-tonal" data-act="clear">' + esc(action) + '</button>' : '') +
        '</div></div>';
    }

    /* ---------------- 异常态卡（可点的演示触发，视觉与文案都是可用的真实态）----------------
       四档：停止 / 部分失败 + 失败可重试 / 状态未知。分级用语义色，未知走中性，
       因为「查不到」和「失败」不是一件事，更不等于「平台是空的」。 */
    const BAD_ITEMS = [
      { code: '100202', name: '农业银行人民币户', why: '写超时' },
      { code: '2202', name: '应付账款', why: '读回校验不匹配' },
      { code: '660102', name: '管理费用 · 办公费', why: '行号未匹配' }
    ];
    function anHTML() {
      if (!st.anomaly) return '';
      if (st.anomaly === 'stopped') {
        return '<div class="vb-an t-warn">' +
          '<span class="vb-an-ic">' + ic('pause') + '</span>' +
          '<div class="vb-an-tx"><div class="vb-an-t">已停止</div>' +
          '<div class="vb-an-s">已完成保留 · 未开始原值未动</div></div>' +
          '<div class="vb-an-nums"><span class="vb-an-n"><i>已完成</i><b>18</b></span>' +
          '<span class="vb-an-n"><i>未开始</i><b>27</b></span></div>' +
          '<div class="vb-an-act"><button type="button" class="vb-btn vb-tonal" data-act="an-run">' +
          ic('play') + '继续登账</button></div></div>';
      }
      if (st.anomaly === 'unknown') {
        const codes = ['1001', '1002', '1122', '2202', '6602', '6603'];
        return '<div class="vb-an t-unknown">' +
          '<span class="vb-an-ic">' + ic('question') + '</span>' +
          '<div class="vb-an-tx"><div class="vb-an-t">状态未知</div>' +
          '<div class="vb-an-s">查询失败 · 不等于平台为空 · 本轮不写</div></div>' +
          '<div class="vb-an-nums"><span class="vb-an-n"><i>未知</i><b>6</b></span></div>' +
          '<div class="vb-an-act"><button type="button" class="vb-btn vb-tonal" data-act="an-query">' +
          ic('retry') + '重新查询</button></div>' +
          '<div class="vb-an-list">' + codes.map((c) =>
            '<div class="vb-an-li"><b>' + c + '</b><span>' + esc(tacctOf(c).name || '') + '</span><i>状态未知</i></div>'
          ).join('') + '</div></div>';
      }
      const bad = BAD_ITEMS.filter((b) => !st.retried[b.code]);
      const okN = 170 + (BAD_ITEMS.length - bad.length);
      return '<div class="vb-an t-err">' +
        '<span class="vb-an-ic">' + ic('alert') + '</span>' +
        '<div class="vb-an-tx"><div class="vb-an-t">' + (bad.length ? '部分失败' : '失败已全部重试成功') + '</div>' +
        '<div class="vb-an-s">失败项保持原值 · 可单独重试</div></div>' +
        '<div class="vb-an-nums"><span class="vb-an-n"><i>成功</i><b>' + okN + '</b></span>' +
        '<span class="vb-an-n"><i>失败</i><b>' + bad.length + '</b></span>' +
        '<span class="vb-an-n"><i>跳过</i><b>2</b></span></div>' +
        (bad.length ? '<div class="vb-an-act"><button type="button" class="vb-btn vb-tonal" data-act="an-retry" data-code="*">' +
          ic('retry') + '重试全部失败</button></div>' : '') +
        (bad.length ? '<div class="vb-an-list">' + bad.map((b) =>
          '<div class="vb-an-li"><b>' + b.code + '</b><span>' + esc(b.name) + '</span><i>' + esc(b.why) + '</i>' +
          '<button type="button" class="vb-text" data-act="an-retry" data-code="' + b.code + '">重试</button></div>'
        ).join('') + '</div>' : '') +
        '</div>';
    }

    /* ---------------- 冲突裁决卡：写前普查发现冲突就停在这里问 ---------------- */
    const CONFLICTS = [
      { code: '1002', name: '银行存款', plat: 53, plan: 48 },
      { code: '2202', name: '应付账款', plat: 12, plan: 9 },
      { code: '6602', name: '管理费用', plat: 21, plan: 18 }
    ];
    function conflictHTML() {
      if (!st.conflict) return '';
      return '<div class="vb-cf">' +
        '<div class="vb-cf-h">' + ic('alert') + '<b>发现 3 个冲突科目</b>' +
        '<span class="vb-cf-n">平台有行 ≠ 计划</span></div>' +
        '<div class="vb-cf-list">' + CONFLICTS.map((c) =>
          '<div class="vb-cf-li"><b>' + c.code + '</b><span>' + esc(c.name) + '</span><i>平台 ' + c.plat + ' / 计划 ' + c.plan + '</i></div>'
        ).join('') +
        '<div class="vb-cf-li"><b>另有</b><span>2 个计划外科目已有数据</span><i>本轮不动</i></div>' +
        '<div class="vb-cf-li"><b>另有</b><span>1 个科目状态未知</span><i>本轮不写</i></div>' +
        '</div>' +
        '<div class="vb-cf-act">' +
        '<span class="vb-cf-tip">请选择：清掉它们再写，还是跳过它们？</span>' +
        '<button type="button" class="vb-btn vb-outline" data-act="cf-stop" style="color:inherit">' +
        ic('ban') + '停止</button>' +
        '<button type="button" class="vb-btn vb-tonal" data-act="cf-skip">' + ic('skip') + '跳过它们</button>' +
        '<button type="button" class="vb-btn vb-danger" data-act="cf-clear">' + ic('trash') + '清掉再写</button>' +
        '</div></div>';
    }

    /* ---------------- 清空二次确认（MD3 对话框）---------------- */
    function dlgHTML() {
      if (st.dlg !== 'clear') return '<div class="vb-scrim" data-ref="scrim"></div><div class="vb-dlg"></div>';
      return '<div class="vb-scrim is-on" data-act="dlg-cancel"></div>' +
        '<div class="vb-dlg is-on" role="dialog" aria-modal="true">' +
        '<div class="vb-dlg-c">' +
        '<div class="vb-dlg-hd">' + ic('trash') + '<b>清除平台 T型账？</b></div>' +
        '<p>扫描平台全部总账科目，把已登记行清掉。<br>平台无事务、无回滚，<b>不可撤销</b>。</p>' +
        '</div>' +
        '<div class="vb-dlg-act">' +
        '<button type="button" class="vb-text" data-act="dlg-cancel">取消</button>' +
        '<button type="button" class="vb-btn vb-danger" data-act="clear-do">' + ic('trash') + '清除全部</button>' +
        '</div></div>';
    }

    /* ---------------- T 型账卡片流 ---------------- */
    function tacctPane() {
      const D = doneSet();
      const head = anHTML() + conflictHTML();
      let list = (fx.taccounts || []).slice();
      if (st.q) {
        const q = st.q.trim().toLowerCase();
        list = list.filter((t) => (t.code + ' ' + t.name).toLowerCase().indexOf(q) >= 0);
      }
      if (st.sort === 'd') list.sort((a, b) => b.d - a.d);
      else if (st.sort === 'n') list.sort((a, b) => b.n - a.n);
      else list.sort((a, b) => String(a.code).localeCompare(String(b.code)));

      if (!list.length) {
        return '<div class="vb-grid">' + head + emptyCard('search', '没有匹配的科目',
          '关键词「' + esc(st.q) + '」在 ' + (fx.taccountCount || 0) + ' 个一级科目中无结果。', '清空搜索') + '</div>';
      }

      return '<div class="vb-grid">' + head + list.map((t, i) => {
        const key = 't:' + t.code;
        const open = st.open.has(key);
        let state = D.has(key) ? 'done' : (st.running && st.cur === key) ? 'running' : t.n === 0 ? 'idle' : 'pending';
        if (st.anomaly === 'retry' && BAD_ITEMS.some((b) => b.code === t.code && !st.retried[b.code])) state = 'bad';
        if (st.anomaly === 'unknown' && ['2202', '6602'].includes(t.code)) state = 'unknown';
        const pages = pagesOf(t.code);
        return '<div class="vb-card' + (open ? ' is-open' : '') + '" data-state="' + state + '" data-key="' + key +
          '" style="--i:' + Math.min(i, 14) + '">' +
          '<div class="vb-cardhd" data-act="fold" data-key="' + key + '">' +
          '<span class="vb-code">' + t.code + '</span>' +
          '<span class="vb-cname">' + esc(t.name) + '</span>' + badge(state) + ic('chevron', 'vb-caret') + '</div>' +
          '<div class="vb-figures">' +
          '<div class="vb-fig is-d"><div class="vb-fig-k">借</div><div class="vb-fig-v">' + alreadyYuan(t.d) + '</div></div>' +
          '<div class="vb-fig is-l"><div class="vb-fig-k">贷</div><div class="vb-fig-v">' + alreadyYuan(t.l) + '</div></div>' +
          '<div class="vb-meta"><div class="vb-meta-v">' + t.n + ' 笔</div>' +
          '<div class="vb-fig-k">差额 ' + alreadyYuan(t.d - t.l) + '</div></div>' +
          '</div>' +
          '<div class="vb-fold"><div class="vb-fold-in">' +
          '<div class="vb-sect"><div class="vb-kv">' +
          '<span>去向 <b>T型账 ' + t.code + '</b></span>' +
          '<span>账页 <b>' + pages.length + '</b></span>' +
          '<span>行数 <b>' + rowsOf(t.code) + '</b></span>' +
          '</div></div>' + logBlock(key) +
          '</div></div></div>';
      }).join('') + '</div>';
    }

    /* ---------------- 明细账卡片流 ---------------- */
    function detailPane() {
      const D = doneSet();
      const head = anHTML() + conflictHTML();
      let keys = (fx.bookKeys || []).slice();
      if (st.q) {
        const q = st.q.trim().toLowerCase();
        keys = keys.filter((k) => (k + ' ' + pagesOf(k).map((p) => p.code + p.name).join(' '))
          .toLowerCase().indexOf(q) >= 0);
      }
      if (st.sort === 'd') keys.sort((a, b) => rowsOf(b) - rowsOf(a));
      else if (st.sort === 'n') keys.sort((a, b) => pagesOf(b).length - pagesOf(a).length);
      else keys.sort((a, b) => String(a).localeCompare(String(b)));

      if (!keys.length) {
        return '<div class="vb-grid">' + head + emptyCard('search', '没有匹配的账簿',
          '关键词「' + esc(st.q) + '」在 ' + (fx.bookKeys || []).length + ' 本明细账簿中无结果。', '清空搜索') + '</div>';
      }

      return '<div class="vb-grid">' + head + keys.map((k, i) => {
        const pages = pagesOf(k);
        const total = rowsOf(k);
        const key = 'd:' + k;
        const open = st.open.has(key);
        let state = D.has(key) ? 'done' : (st.running && st.cur === key) ? 'running' : total === 0 ? 'idle' : 'pending';
        if (st.anomaly === 'retry' && BAD_ITEMS.some((b) => b.code.slice(0, 4) === k && !st.retried[b.code])) state = 'bad';
        const pageList = pages.map((p) => {
          const has = !!(fx.sample || {})[p.code];
          const pk = key + '#' + p.code;
          return '<div class="vb-page"><span class="vb-page-code">' + p.code + '</span>' +
            '<span class="vb-page-name">' + esc(p.name) + '</span>' +
            (has
              ? '<button type="button" class="vb-text" data-act="page" data-key="' + key + '" data-pg="' + p.code + '">' +
                (st.open.has(pk) ? '收起' : '展开') + '</button>'
              : '<span class="vb-page-rows">' + (p.rows || 0) + ' 行</span>') +
            '</div>' + (has && st.open.has(pk) ? ledgerHTML(p.code) : '');
        }).join('');

        return '<div class="vb-card' + (open ? ' is-open' : '') + '" data-state="' + state + '" data-key="' + key +
          '" style="--i:' + Math.min(i, 14) + '">' +
          '<div class="vb-cardhd" data-act="fold" data-key="' + key + '">' +
          '<span class="vb-code">' + k + '</span>' +
          '<span class="vb-cname">' + esc((pages[0] || {}).name || '') + '</span>' + badge(state) + ic('chevron', 'vb-caret') + '</div>' +
          '<div class="vb-figures">' +
          '<div class="vb-fig is-d"><div class="vb-fig-k">账页</div><div class="vb-fig-v">' + pages.length + '</div></div>' +
          '<div class="vb-fig is-l"><div class="vb-fig-k">行数</div><div class="vb-fig-v">' + total + '</div></div>' +
          '<div class="vb-meta"><div class="vb-meta-v">' + (pages.length > 1 ? '多级明细' : '单页') + '</div>' +
          '<div class="vb-fig-k">' + (D.has(key) ? '已登入' : '未登入') + '</div></div>' +
          '</div>' +
          '<div class="vb-fold"><div class="vb-fold-in">' +
          '<div class="vb-sect"><div class="vb-sect-h">' + ic('rows') + '账页清单' +
          '<span class="vb-count">' + pages.length + ' 页</span></div>' + pageList + '</div>' +
          logBlock(key) + '</div></div></div>';
      }).join('') + '</div>';
    }

    /* ---------------- 真实账页表格 ---------------- */
    function ledgerHTML(code) {
      const rows = (fx.sample || {})[code] || [];
      const body = rows.map((r) => {
        if (r.k === 'monthLine' || r.k === 'yearLine') return '<div class="vb-led-sep"></div>';
        const cls = r.k === 'opening' ? ' r-open' : r.k === 'monthTotal' ? ' r-month' : r.k === 'yearTotal' ? ' r-year' : '';
        return '<div class="vb-led-row' + cls + '">' +
          '<span>' + (r.mm || '') + '-' + (r.dd || '') + '</span>' +
          '<span>' + esc(r.t || '') + '</span><span>' + esc(r.no || '') + '</span>' +
          '<span style="font-family:var(--md-font)">' + esc(r.sum || '') + '</span>' +
          '<span>' + (r.d ? yuan(r.d) : '') + '</span><span>' + (r.l ? yuan(r.l) : '') + '</span>' +
          '<span>' + esc(r.dir || '') + '</span><span>' + (r.bal ? yuan(r.bal) : '') + '</span></div>';
      }).join('');
      return '<div class="vb-ledger"><div class="vb-led-hd"><span>月-日</span><span>种类</span><span>号</span>' +
        '<span>摘要</span><span>借方</span><span>贷方</span><span>方向</span><span>余额</span></div>' +
        body + '</div>';
    }

    /* ---------------- 渲染 ---------------- */
    function toolsHTML(tab) {
      const segs = tab.id === 'tacct'
        ? [['code', '科目码'], ['d', '借方金额'], ['n', '笔数']]
        : [['code', '科目码'], ['d', '行数'], ['n', '账页数']];
      const off = tab.ready ? '' : ' disabled';
      return '<div class="vb-tools">' +
        '<label class="vb-field">' + ic('search') + '<input type="text" data-act="q" value="' + esc(st.q) + '"' +
        off + ' placeholder="' + (tab.ready
          ? (tab.id === 'tacct' ? '科目码 / 名称' : '账簿 / 账页')
          : '该环节未接入') + '"></label>' +
        '<div class="vb-seg">' + segs.map(([v, t]) =>
          '<button type="button" data-act="sort" data-v="' + v + '" class="' + (st.sort === v ? 'is-on' : '') + '"' + off + '>' + t + '</button>').join('') + '</div>' +
        '<span class="vb-count">' + (tab.id === 'tacct'
          ? (fx.taccountCount || 0) + ' 科目'
          : tab.ready ? (fx.bookKeys || []).length + ' 账簿 · ' + (fx.detailAccountCount || 0) + ' 账页' : '未接入') + '</span></div>';
    }

    const curTab = () => TABS.filter((t) => t.id === st.tab)[0] || TABS[0];
    const paneHTML = (tab) => tab.ready ? (tab.id === 'tacct' ? tacctPane() : detailPane())
      : '<div class="vb-grid">' + emptyCard(tab.icon, tab.title, tab.desc, '') + '</div>';

    function render() {
      const tab = curTab();
      shell.innerHTML = headHTML() + tabsHTML() +
        '<div class="vb-prog' + (st.running ? ' is-live' : '') + '" data-prog><i style="width:' + (st.prog * 100) + '%"></i></div>' +
        toolsHTML(tab) +
        '<main class="vb-body vp-scroll"><div class="vb-pane" data-pane>' + paneHTML(tab) + '</div></main>' +
        footHTML() + dlgHTML();
      moveInk();
      renderStrip();
    }

    // 局部刷新：保留滚动位置，不重放入场动画（搜索与展开账页用）
    function renderPaneOnly() {
      const pane = shell.querySelector('[data-pane]');
      if (!pane) return render();
      const body = shell.querySelector('.vb-body');
      const sc = body ? body.scrollTop : 0;
      pane.innerHTML = paneHTML(curTab());
      if (body) body.scrollTop = sc;
      syncCards();
    }

    function moveInk() {
      const ink = shell.querySelector('[data-ink]');
      const on = shell.querySelector('.vb-tab.is-active');
      if (!ink || !on) return;
      ink.style.width = on.offsetWidth + 'px';
      ink.style.transform = 'translateX(' + on.offsetLeft + 'px)';
    }

    /* 运行中逐卡点亮：只改类名与徽标，不重建 DOM */
    function syncCards() {
      const D = doneSet();
      shell.querySelectorAll('.vb-card').forEach((el) => {
        const key = el.dataset.key;
        const done = D.has(key);
        const running = st.running && st.cur === key;
        let ns = done ? 'done' : running ? 'running' : el.dataset.state === 'idle' ? 'idle' : 'pending';
        if (st.anomaly === 'retry' && BAD_ITEMS.some((b) => b.code.indexOf(key.slice(2)) === 0 && !st.retried[b.code])) ns = 'bad';
        el.dataset.state = ns;
        if (running) el.classList.add('is-open');
        const b = el.querySelector('.vb-cardhd .vb-badge');
        if (b && !b.classList.contains('vb-b-idle')) b.outerHTML = badge(el.dataset.state);
        const lg = el.querySelector('.vb-log');
        if (lg) {
          const inner = lg.querySelector('.vb-log-in');
          if (inner) inner.innerHTML = logInnerHTML(key);
          const c = lg.querySelector('.vb-count');
          if (c) c.textContent = String((st.logs.get(key) || []).length);
          if (st.logOpen.has(key)) lg.classList.add('is-open');
        }
      });
      const prog = shell.querySelector('[data-prog]');
      if (prog) {
        prog.classList.toggle('is-live', st.running);
        prog.querySelector('i').style.width = (st.prog * 100) + '%';
      }
      renderStrip();
      const doneEl = shell.querySelector('[data-done]');
      if (doneEl) doneEl.textContent = D.size ? ' · 已登 ' + D.size : '';
    }

    /* ---------------- 收起条 ---------------- */
    function renderStrip() {
      const D = doneSet();
      const tab = curTab();
      const total = tab.id === 'tacct' ? (fx.taccountCount || 0) : tab.ready ? (fx.bookKeys || []).length : 0;
      const C = 2 * Math.PI * 9;
      const p = st.running ? st.prog : D.size && total ? D.size / total : 0;
      const unit = tab.id === 'tacct' ? '科目' : '账簿';
      const an = { stopped: '已停止', partial: '部分失败', retry: '失败待重试', unknown: '状态未知' }[st.anomaly];
      const note = !tab.ready ? '待接入'
        : an ? an
        : st.running ? '登账中 ' + Math.round(st.prog * 100) + '%'
        : total + ' ' + unit + (D.size ? ' · 已登 ' + D.size : ' · 待登');
      strip.innerHTML =
        '<svg class="vb-ring" viewBox="0 0 24 24" aria-hidden="true"><circle class="tr" cx="12" cy="12" r="9"></circle>' +
        '<circle class="vl" cx="12" cy="12" r="9" stroke-dasharray="' + (p * C).toFixed(1) + ' ' + C.toFixed(1) + '"></circle></svg>' +
        '<span class="vb-strip-name">' + tab.label + '</span>' +
        '<span class="vb-strip-note">' + note + '</span>' +
        '<button type="button" class="vb-strip-act" data-act="expand" title="展开面板">' + ic('up') + '</button>';
    }

    function setCollapsed(v) {
      st.collapsed = !!v;
      shell.classList.toggle('vb-out', st.collapsed);
      // 收起时才让状态条滑入（vb-in）；展开时它滑回屏外
      strip.classList.toggle('vb-in', st.collapsed);
      shell.inert = st.collapsed;
      strip.inert = !st.collapsed;
      if (st.collapsed) renderStrip();
      log(st.collapsed ? '面板已收起' : '面板已展开', 'info');
    }

    /* ---------------- 主题 ---------------- */
    function cycleTheme() {
      st.theme = st.theme === 'light' ? 'dark' : st.theme === 'dark' ? 'system' : 'light';
      if (st.theme === 'system') delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = st.theme;
      render();
      log('主题：' + (st.theme === 'dark' ? '深色' : st.theme === 'light' ? '浅色' : '跟随系统'), 'info');
    }

    /* ---------------- 执行：逐卡点亮 + 内联日志逐条输出 ---------------- */
    let token = 0, timer = 0, wake = null;
    function sleep(ms) {
      return new Promise((r) => {
        wake = r;
        timer = setTimeout(() => { timer = 0; wake = null; r(); }, ms);
      });
    }
    function abortSleep() {
      if (timer) { clearTimeout(timer); timer = 0; }
      const r = wake; wake = null;
      if (r) r();
    }

    async function run(resume) {
      if (st.running) return;
      const tab = curTab();
      if (!tab.ready) { log('「' + tab.label + '」待接入', 'warn'); return; }
      const D = doneSet();
      const my = ++token;
      st.running = true;
      st.prog = 0;
      st.anomaly = null; st.retried = {}; st.dlg = null;
      // resume=true 表示这是「清掉冲突科目后接着写」，不能再触发一次冲突裁决
      st.conflict = false;
      st.conflictDone = !!resume;
      setBusy(true);
      render();
      log('开始登账 · ' + tab.label + ' · ' + st.year + '-' + st.month, 'info');

      const items = tab.id === 'tacct'
        ? (fx.taccounts || []).map((t) => ({ key: 't:' + t.code, code: t.code, name: t.name, n: t.n }))
        : (fx.bookKeys || []).map((k) => ({ key: 'd:' + k, code: k, name: (pagesOf(k)[0] || {}).name || '', n: pagesOf(k).length }));

      // 走到写前普查的位置就停下来问：清掉冲突科目再写，还是跳过它们（不静默跳过）
      const STOP_AT = Math.min(4, items.length);

      for (let i = 0; i < items.length; i++) {
        if (my !== token) return;
        if (i === STOP_AT && !st.conflictDone) {
          st.conflict = true;
          push('__run', '写前普查发现冲突 · 待裁决', 'warn');
          st.running = false;
          setBusy(false);
          render();
          return;
        }
        const it = items[i];
        st.cur = it.key;
        push(it.key, '读取教师答案 · ' + it.code, 'info');
        syncCards();
        await sleep(85);
        if (my !== token) return;
        push(it.key, tab.id === 'tacct'
          ? '登入 T型账 · 借 ' + alreadyYuan(tacctOf(it.code).d) + ' / 贷 ' + alreadyYuan(tacctOf(it.code).l)
          : '登记明细账 · ' + it.n + ' 页 / ' + rowsOf(it.code) + ' 行', 'info');
        syncCards();
        await sleep(105);
        if (my !== token) return;
        push(it.key, '完成', 'ok');
        D.add(it.key);
        st.prog = (i + 1) / items.length;
        syncCards();
        await sleep(55);
      }

      if (my !== token) return;
      st.running = false;
      st.cur = null;
      st.prog = 1;
      setBusy(false);
      render();
      log(tab.label + ' 登账完成 · ' + items.length + ' 项', 'ok');
    }

    function stop() {
      if (!st.running) return;
      const D = doneSet();
      token++;
      abortSleep();
      st.running = false;
      st.cur = null;
      setBusy(false);
      // 停止后已完成的保留、未开始的明确标出
      st.anomaly = 'stopped';
      render();
      log('已停止 · 已完成 ' + D.size + ' 项保留，未开始项原值未动', 'warn');
    }

    /* 清空：独立的重置入口，与「按教师答案登账」互不相干 */
    function clearAll() {
      st.dlg = null;
      st.anomaly = null;
      st.conflict = false;
      st.logs.forEach((arr, k) => { if (k !== '__run') arr.length = 0; });
      render();
      log('清空 T型账 · 已清 42 科目', 'ok');
      log('原本已是 0 行 3 个 · 未清干净 0 个', 'warn');
    }

    /* 冲突裁决结果 */
    function conflictChoice(v) {
      st.conflict = false;
      if (v === 'stop') {
        st.anomaly = 'stopped';
        render();
        log('已停止 · 一个字没写', 'info');
        return;
      }
      if (v === 'skip') {
        st.anomaly = 'partial';
        render();
        log('跳过 3 个冲突科目 · 其余照写', 'warn');
        return;
      }
      log('已清掉 3 个冲突科目 · 继续写入', 'warn');
      render();
      run(true);
    }

    /* 异常演示：循环切换，让四种态都能在屏幕上看到 */
    const AN_SEQ = [null, 'stopped', 'partial', 'retry', 'unknown'];
    function cycleAnomaly() {
      const i = AN_SEQ.indexOf(st.anomaly);
      st.anomaly = AN_SEQ[(i + 1) % AN_SEQ.length];
      st.retried = {};
      renderPaneOnly();
      render();
      log(st.anomaly ? '演示：' + ({ stopped: '停止', partial: '部分失败', retry: '失败可重试', unknown: '状态未知' })[st.anomaly] + ' 态'
        : '演示：已复位', 'info');
    }

    /* ---------------- 事件 ---------------- */
    host.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (!t) { if (e.target.closest('.vb-strip')) setCollapsed(false); return; }
      const act = t.dataset.act;
      /* 对话框打开时只响应框内动作，避免误触后面的登账入口 */
      if (st.dlg && act !== 'dlg-cancel' && act !== 'clear-do') return;
      if (act === 'tab') { st.tab = t.dataset.id; st.q = ''; st.open.clear(); st.conflict = false; st.conflictDone = false; render(); return; }
      if (act === 'collapse') { setCollapsed(true); return; }
      if (act === 'expand') { setCollapsed(false); return; }
      if (act === 'theme') { cycleTheme(); return; }
      if (act === 'sort') { st.sort = t.dataset.v; renderPaneOnly(); return; }
      if (act === 'clear') { st.q = ''; st.open.clear(); renderPaneOnly(); return; }
      /* 清空：独立重置入口，先过 MD3 二次确认 */
      if (act === 'clear-open') { st.dlg = 'clear'; render(); return; }
      if (act === 'clear-do') { clearAll(); return; }
      if (act === 'dlg-cancel') {
        st.dlg = null;
        render();
        log('已取消 · 未碰平台', 'info');
        return;
      }
      /* 冲突裁决 */
      if (act === 'cf-clear') { conflictChoice('clear'); return; }
      if (act === 'cf-skip') { conflictChoice('skip'); return; }
      if (act === 'cf-stop') { conflictChoice('stop'); return; }
      /* 异常演示与异常态内动作 */
      if (act === 'demo') { cycleAnomaly(); return; }
      if (act === 'an-run') { st.anomaly = null; render(); run(); return; }
      if (act === 'an-query') { log('重新查询 · 6 科目仍未知', 'warn'); return; }
      if (act === 'an-retry') {
        const c = t.dataset.code;
        if (c === '*') {
          BAD_ITEMS.forEach((b) => { st.retried[b.code] = true; });
          log('重试 3 项 · 全部成功', 'ok');
        } else {
          st.retried[c] = true;
          log('重试 ' + c + ' · 成功', 'ok');
        }
        render();
        return;
      }
      if (act === 'recheck') {
        // 「重试」按钮：模拟重试接口，成功即回到 primary 实时态
        st.snapUsed = t.hasAttribute('data-sw') ? !st.snapUsed : false;
        render();
        log(st.snapUsed
          ? '接口未开放 · 回退快照 ' + SNAPSHOT_ID
          : '接口连通 · 数据源为教师答案 · 实时', st.snapUsed ? 'warn' : 'ok');
        return;
      }
      if (act === 'run') { run(); return; }
      if (act === 'stop') { stop(); return; }
      if (act === 'fold') {
        const k = t.dataset.key;
        if (st.open.has(k)) st.open.delete(k); else st.open.add(k);
        const card = t.closest('.vb-card');
        if (card) card.classList.toggle('is-open', st.open.has(k));
        return;
      }
      if (act === 'log') {
        const k = t.dataset.key;
        if (st.logOpen.has(k)) st.logOpen.delete(k); else st.logOpen.add(k);
        const box = t.closest('.vb-log');
        if (box) box.classList.toggle('is-open', st.logOpen.has(k));
        return;
      }
      if (act === 'page') {
        const k = t.dataset.key + '#' + t.dataset.pg;
        if (st.open.has(k)) st.open.delete(k); else st.open.add(k);
        renderPaneOnly();
      }
    });

    host.addEventListener('input', (e) => {
      if (!e.target.closest('[data-act="q"]')) return;
      st.q = e.target.value;
      const pos = e.target.selectionStart;
      renderPaneOnly();
      const again = shell.querySelector('[data-act="q"]');
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (err) { /* 原型 */ } }
    });

    host.addEventListener('change', (e) => {
      const t = e.target.closest('[data-act="sel"]');
      if (!t) return;
      if (t.dataset.id === 'year') st.year = t.value; else st.month = t.value;
      log('期间 ' + st.year + '-' + st.month, 'info');
      render();
    });

    const ro = window.ResizeObserver ? new ResizeObserver(moveInk) : null;
    if (ro) ro.observe(host);

    render();
    setCollapsed(false);
    log('就绪 · ' + (fx.entity || '') + ' · ' + st.year + '-' + st.month + ' · '
      + (st.snapUsed ? '快照兜底' : '教师答案 · 实时'), 'ok');

    return {
      // 宿主切换栏的「收起态」按钮会调用这两个（可选契约）
      toggle: () => setCollapsed(!st.collapsed),
      collapse: () => setCollapsed(true),
      isCollapsed: () => st.collapsed,
      unmount() {
        token++;
        abortSleep();
        if (ro) ro.disconnect();
        host.innerHTML = '';
        host.setAttribute('style', hostStyle0);
        setBusy(false);
      }
    };
  }

  /* ============================================================
   * 5. 注册
   * ========================================================== */
  const VP = (window.VP = window.VP || {});
  VP.register('B', '横向标签 · 卡片流', { mount: mount });
})();
