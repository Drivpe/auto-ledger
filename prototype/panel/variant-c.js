// PROTOTYPE — 变体 C：悬浮球 · 层级下钻。一次性代码，不是生产实现。
/* 结构：收起态 = 安静悬浮球(FAB) → 展开 = 居中 MD3 Dialog → 第一层环节网格 → 第二层环节详情
 * 日志 = Dialog 内底部可上滑隔板。无持久导航栏。
 * 单位说明（实测 fixtures.js 后确认）：
 *   FX.taccounts.d / .l  已是「元」（1002.l = 2327065.47，含两位小数）
 *   FX.sample[*].d/.l/.bal 是「分」，显示时 /100
 */
(function () {
  'use strict';

  window.VP = window.VP || {};

  /* ============================ 图标（内联 SVG，24×24，线宽 1.7） ============================ */
  var ICONS = {
    mark:  '<path d="M6.5 3.5h7.5l4.5 4.5v12.5H6.5z"/><path d="M13.5 3.5V8H18"/><path d="M9.4 13.6l2.2 2.2 4-4.4"/>',
    grid:  '<path d="M4 4h6.5v16H4z"/><path d="M13.5 4H20v16h-6.5z"/>',
    list:  '<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4.2 6h.01M4.2 12h.01M4.2 18h.01"/>',
    clock: '<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/><path d="M12 7.5V12l3 2"/>',
    sigma: '<path d="M17.5 5.5H7l5.5 6.5L7 18.5h10.5"/>',
    book:  '<path d="M6.5 3H19v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3z"/><path d="M8.5 3v18"/>',
    chart: '<path d="M3.5 19.5h17"/><path d="M6.5 19.5V12M11 19.5V5.5M15.5 19.5v-4.5M20 19.5v-8"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    back:  '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    play:  '<path d="M8.5 5.6v12.8L18.8 12z"/>',
    stop:  '<path d="M7.5 7.5h9v9h-9z"/>',
    sun:   '<path d="M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>',
    moon:  '<path d="M20.5 14.2A8.8 8.8 0 0 1 9.8 3.5a8.8 8.8 0 1 0 10.7 10.7z"/>',
    auto:  '<path d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>',
    up:    '<path d="M6 14.5L12 8.5l6 6"/>',
    down:  '<path d="M6 9.5l6 6 6-6"/>',
    right: '<path d="M9.5 6l6 6-6 6"/>',
    search:'<path d="M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z"/><path d="M15.4 15.4L20 20"/>',
    shield:'<path d="M12 3.2l7.2 2.9v5.6c0 4.4-2.9 7.3-7.2 8.8-4.3-1.5-7.2-4.4-7.2-8.8V6.1z"/><path d="M9.2 12l2.1 2.1 3.9-4.2"/>',
    warn:  '<path d="M12 3.6l8.8 15.6H3.2z"/><path d="M12 9.6v4.1M12 16.7h.01"/>',
    snap:  '<path d="M7 4h10v3H7z"/><path d="M5 7h14v12.5H5z"/><path d="M10 11.5h4"/>',
    check: '<path d="M5 12.8l4.6 4.6L19 6.8"/>',
    layers:'<path d="M12 3.5l8.5 4.3-8.5 4.3-8.5-4.3z"/><path d="M3.5 12.6L12 16.9l8.5-4.3"/><path d="M3.5 16.6L12 20.9l8.5-4.3"/>',
    info:  '<path d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z"/><path d="M12 11v5.5M12 7.8h.01"/>',
    err:   '<path d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z"/><path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6"/>',
    trash: '<path d="M4 6.5h16"/><path d="M9.5 6.5V4h5v2.5"/><path d="M6.5 6.5l1 13.2h9l1-13.2"/>',
    retry: '<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 3.6V8H16"/>',
    pause: '<path d="M9 6.5v11M15 6.5v11"/>',
    skip:  '<path d="M6 18l8.5-6L6 6z"/><path d="M18 6v12"/>',
    ban:   '<path d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z"/><path d="M6.1 6.1l11.8 11.8"/>',
    quest: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.6v.4"/><path d="M12 16.6h.01"/>',
    check2:'<path d="M4.5 12.5l5 5 10-10.5"/>'
  };

  function ic(name, extra) {
    return '<svg class="vp-ic c-ic' + (extra ? ' ' + extra : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  /* ============================ 样式 ============================ */
  var CSS = [
    /* --- 收起态：安静的悬浮球 --- */
    '.c-fab{position:fixed;right:18px;bottom:18px;z-index:3;width:46px;height:46px;padding:0;border:1px solid var(--md-outline-variant);',
    'border-radius:var(--md-sh-full);background:var(--md-surface-container-high);color:var(--md-on-surface-variant);',
    'display:grid;place-items:center;cursor:pointer;box-shadow:var(--md-shadow-2);opacity:.62;',
    'transition:opacity var(--md-dur-med) var(--md-ease-standard),background var(--md-dur-med) var(--md-ease-standard),',
    'color var(--md-dur-med) var(--md-ease-standard),box-shadow var(--md-dur-med) var(--md-ease-standard),transform var(--md-dur-med) var(--md-ease-emphasized);}',
    '.c-fab:hover,.c-fab:focus-visible{opacity:1;background:var(--md-primary-container);color:var(--md-on-primary-container);',
    'box-shadow:var(--md-shadow-3);transform:translateY(-1px);}',
    '.c-fab[data-open="1"]{opacity:0;pointer-events:none;transform:scale(.7);}',
    '.c-fab .c-ic{width:22px;height:22px;}',
    /* 窄视口：宿主原型切换栏占据底部中央，悬浮球上移让开 */
    '@media (max-width:760px){.c-fab{right:14px;bottom:66px;}}',
    '.c-fab-busy{position:absolute;inset:-4px;border-radius:var(--md-sh-full);border:2px solid transparent;',
    'border-top-color:var(--md-primary);animation:c-spin 900ms linear infinite;display:none;}',
    '.c-fab[data-busy="1"] .c-fab-busy{display:block;}',
    '@keyframes c-spin{to{transform:rotate(360deg);}}',

    /* --- 悬浮球长按菜单 --- */
    '.c-menu{position:fixed;right:18px;bottom:74px;z-index:6;min-width:196px;padding:6px;border-radius:var(--md-sh-md);',
    'background:var(--md-surface-container-high);box-shadow:var(--md-shadow-3);transform-origin:bottom right;',
    'opacity:0;pointer-events:none;transform:translateY(6px) scale(.94);',
    'transition:opacity var(--md-dur-short) var(--md-ease-standard),transform var(--md-dur-med) var(--md-ease-emphasized);}',
    '.c-menu[data-open="1"]{opacity:1;pointer-events:auto;transform:none;}',
    '.c-menu-hd{padding:8px 12px 6px;font-size:var(--md-label-sm);letter-spacing:.6px;color:var(--md-on-surface-variant);}',
    '.c-mi{display:flex;align-items:center;gap:var(--md-s3);width:100%;height:40px;padding:0 12px;border:0;background:transparent;',
    'color:var(--md-on-surface);font:inherit;font-size:var(--md-body-md);border-radius:var(--md-sh-sm);cursor:pointer;text-align:left;}',
    '.c-mi:hover{background:var(--md-surface-container-highest);}',
    '.c-mi[data-sel="1"]{background:var(--md-secondary-container);color:var(--md-on-secondary-container);font-weight:var(--md-w-med);}',
    '.c-mi .c-grow{flex:1;}',

    /* --- 遮罩 + 对话框 --- */
    '.c-scrim{position:fixed;inset:0;z-index:2;background:var(--md-scrim);opacity:0;pointer-events:none;',
    'transition:opacity var(--md-dur-long) var(--md-ease-standard);}',
    '.c-scrim[data-open="1"]{opacity:var(--md-scrim-opacity);pointer-events:auto;}',

    '.c-dlg{position:fixed;left:50%;top:50%;z-index:4;width:min(640px,calc(100vw - 28px));height:min(72vh,700px);',
    'display:flex;flex-direction:column;overflow:hidden;background:var(--md-surface-container-high);color:var(--md-on-surface);',
    'border-radius:var(--md-sh-xl);box-shadow:var(--md-shadow-5);opacity:0;pointer-events:none;transform:translate(-50%,-50%) scale(.92);',
    'transition:opacity var(--md-dur-med) var(--md-ease-standard),transform var(--md-dur-long) var(--md-ease-emphasized);}',
    '.c-dlg[data-open="1"]{opacity:1;pointer-events:auto;transform:translate(-50%,-50%) scale(1);}',

    '.c-hd{flex:0 0 auto;display:flex;align-items:center;gap:var(--md-s3);padding:var(--md-s4) var(--md-s5) var(--md-s2);}',
    '.c-hd-l{min-width:0;flex:1;}',
    '.c-hd-t{font-size:var(--md-title-lg);line-height:var(--md-title-lg-lh);font-weight:var(--md-w-med);letter-spacing:.1px;}',
    '.c-hd-s{margin-top:2px;font-size:var(--md-body-sm);line-height:var(--md-body-sm-lh);color:var(--md-on-surface-variant);}',
    '.c-hd-r{display:flex;align-items:center;gap:var(--md-s1);flex:0 0 auto;}',

    '.c-ib{width:36px;height:36px;padding:0;border:0;border-radius:var(--md-sh-full);background:transparent;color:var(--md-on-surface-variant);',
    'display:grid;place-items:center;cursor:pointer;transition:background var(--md-dur-short) var(--md-ease-standard),color var(--md-dur-short) var(--md-ease-standard);}',
    '.c-ib:hover{background:var(--md-surface-container-highest);color:var(--md-on-surface);}',
    '.c-ib[data-sel="1"]{background:var(--md-secondary-container);color:var(--md-on-secondary-container);}',
    '.c-ib--sm{width:28px;height:28px;}',

    /* --- 实名 / 数据源卡 --- */
    '.c-src{flex:0 0 auto;margin:var(--md-s1) var(--md-s5) var(--md-s3);padding:var(--md-s3) var(--md-s4);',
    'background:var(--md-surface-container);border-radius:var(--md-sh-lg);display:flex;flex-direction:column;gap:var(--md-s2);}',
    '.c-src-r{display:flex;align-items:center;gap:var(--md-s3);flex-wrap:wrap;}',
    '.c-src-t{font-size:var(--md-body-md);color:var(--md-on-surface);}',
    '.c-src-t b{font-weight:var(--md-w-bold);}',
    '.c-src-n{font-size:var(--md-body-sm);line-height:var(--md-body-sm-lh);color:var(--md-on-surface-variant);}',
    '.c-grow{flex:1 1 auto;}',

    '.c-chip{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:var(--md-sh-full);',
    'font-size:var(--md-label-md);font-weight:var(--md-w-med);letter-spacing:.2px;white-space:nowrap;}',
    '.c-chip .c-ic{width:14px;height:14px;}',
    '.c-chip--ter{background:var(--md-tertiary-container);color:var(--md-on-tertiary-container);}',
    '.c-chip--warn{background:var(--md-warn-container);color:var(--md-on-warn-container);}',
    '.c-chip--pri{background:var(--md-primary-container);color:var(--md-on-primary-container);}',
    '.c-chip--sec{background:var(--md-secondary-container);color:var(--md-on-secondary-container);}',
    '.c-chip--out{border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);padding:0 9px;}',
    '.c-chip--err{background:var(--md-error-container);color:var(--md-on-error-container);}',

    /* --- 数据源两态开关（放数据源卡右下角） --- */
    '.c-src-r--sw{justify-content:flex-end;gap:var(--md-s2);}',
    '.c-src-lb{font-size:var(--md-label-sm);color:var(--md-on-surface-variant);}',
    '.c-sw{position:relative;flex:0 0 auto;width:38px;height:22px;padding:0;border:0;cursor:pointer;',
    'border-radius:var(--md-sh-full);background:var(--md-surface-container-highest);',
    'box-shadow:inset 0 0 0 2px var(--md-outline);',
    'transition:background var(--md-dur-short) var(--md-ease-standard),box-shadow var(--md-dur-short) var(--md-ease-standard);}',
    '.c-sw i{position:absolute;top:50%;left:4px;width:14px;height:14px;margin-top:-7px;border-radius:var(--md-sh-full);',
    'background:var(--md-outline);transition:left var(--md-dur-med) var(--md-ease-emphasized),background var(--md-dur-short) var(--md-ease-standard);}',
    '.c-sw[data-on="1"]{background:var(--md-warn-container);box-shadow:inset 0 0 0 2px var(--md-warn);}',
    '.c-sw[data-on="1"] i{left:20px;background:var(--md-warn);}',

    /* --- 层级容器 --- */
    '.c-lvl{position:relative;flex:1 1 auto;min-height:0;overflow:hidden;}',
    '.c-view{position:absolute;inset:0;display:flex;flex-direction:column;min-height:0;',
    'transition:opacity var(--md-dur-med) var(--md-ease-standard),transform var(--md-dur-long) var(--md-ease-emphasized);}',
    '.c-view[data-st="on"]{opacity:1;transform:none;}',
    '.c-view[data-st="off-left"]{opacity:0;transform:translateX(-18px);pointer-events:none;}',
    '.c-view[data-st="off-right"]{opacity:0;transform:translateX(18px);pointer-events:none;}',
    '.c-lvl-inner{flex:1 1 auto;min-height:0;overflow-y:auto;padding:var(--md-s1) var(--md-s5) 68px;}',
    '#cDlg[data-sheet="1"] .c-lvl-inner,#cDlg[data-sheet="1"] .c-dbody{padding-bottom:312px;}',

    /* --- 第一层：环节网格 --- */
    '.c-sec{display:flex;align-items:baseline;gap:var(--md-s3);margin:var(--md-s2) 0 var(--md-s3);}',
    '.c-sec-h{font-size:var(--md-title-sm);font-weight:var(--md-w-med);letter-spacing:.6px;text-transform:uppercase;color:var(--md-on-surface-variant);}',
    '.c-sec-x{font-size:var(--md-label-md);color:var(--md-on-surface-variant);opacity:.75;}',
    '.c-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--md-s3);}',
    '@media (max-width:520px){.c-grid{grid-template-columns:minmax(0,1fr);}}',
    '.c-card{display:flex;align-items:center;gap:var(--md-s3);width:100%;min-width:0;min-height:72px;padding:var(--md-s3) var(--md-s4);',
    'border:0;border-radius:var(--md-sh-lg);background:var(--md-surface-container-lowest);color:var(--md-on-surface);',
    'text-align:left;font:inherit;cursor:pointer;box-shadow:var(--md-shadow-1);',
    'animation:c-rise var(--md-dur-long) var(--md-ease-decel) both;',
    'transition:background var(--md-dur-short) var(--md-ease-standard),box-shadow var(--md-dur-short) var(--md-ease-standard),transform var(--md-dur-short) var(--md-ease-standard);}',
    '@keyframes c-rise{from{opacity:0;transform:translateY(10px) scale(.985);}to{opacity:1;transform:none;}}',
    '.c-card:hover{background:var(--md-surface-container-low);box-shadow:var(--md-shadow-2);transform:translateY(-1px);}',
    '.c-card:active{transform:translateY(0) scale(.995);}',
    '.c-card-ic{width:40px;height:40px;flex:0 0 auto;border-radius:var(--md-sh-md);display:grid;place-items:center;}',
    '.c-card-ic .c-ic{width:21px;height:21px;}',
    '.c-tone-ter{background:var(--md-tertiary-container);color:var(--md-on-tertiary-container);}',
    '.c-tone-pri{background:var(--md-primary-container);color:var(--md-on-primary-container);}',
    '.c-tone-off{background:var(--md-surface-container-highest);color:var(--md-on-surface-variant);}',
    '.c-card-tx{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;}',
    '.c-card-nm{font-size:var(--md-title-md);line-height:var(--md-title-md-lh);font-weight:var(--md-w-med);}',
    '.c-card-ds{font-size:var(--md-body-sm);line-height:var(--md-body-sm-lh);color:var(--md-on-surface-variant);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.c-badge{height:22px;padding:0 9px;border-radius:var(--md-sh-full);font-size:var(--md-label-sm);font-weight:var(--md-w-med);',
    'display:inline-flex;align-items:center;letter-spacing:.3px;flex:0 0 auto;}',
    '.c-badge--on{background:var(--md-primary-container);color:var(--md-on-primary-container);}',
    '.c-badge--off{background:var(--md-surface-container-highest);color:var(--md-on-surface-variant);}',
    '.c-card--off{background:var(--md-surface-container);box-shadow:none;}',
    '.c-card--off .c-card-nm{color:var(--md-on-surface-variant);}',
    '.c-card--off:hover{background:var(--md-surface-container-high);box-shadow:var(--md-shadow-1);}',
    '.c-card--off .c-card-ic{opacity:.7;}',

    /* --- 第二层：详情头 --- */
    '.c-dhead{flex:0 0 auto;display:flex;flex-direction:column;gap:var(--md-s4);padding:var(--md-s1) var(--md-s5) var(--md-s4);}',
    '.c-crumb{display:flex;align-items:center;gap:var(--md-s2);}',
    '.c-crumb-x{font-size:var(--md-body-sm);color:var(--md-on-surface-variant);white-space:nowrap;}',
    '.c-crumb-s{color:var(--md-outline);}',
    '.c-crumb-c{font-size:var(--md-title-sm);font-weight:var(--md-w-med);}',
    '.c-ctl{display:flex;align-items:flex-end;gap:var(--md-s3);flex-wrap:wrap;}',
    '.c-fld{display:flex;flex-direction:column;gap:3px;}',
    '.c-fld>span{font-size:var(--md-label-sm);color:var(--md-on-surface-variant);letter-spacing:.3px;}',
    '.c-fld input{width:76px;height:36px;padding:0 10px;border:0;border-bottom:1px solid var(--md-outline);',
    'border-radius:var(--md-sh-xs) var(--md-sh-xs) 0 0;background:var(--md-surface-container-highest);color:var(--md-on-surface);',
    'font-family:var(--md-mono);font-size:var(--md-body-md);font-variant-numeric:tabular-nums;}',
    '.c-fld input:focus{outline:none;border-bottom:2px solid var(--md-primary);}',

    '.c-btn{display:inline-flex;align-items:center;gap:var(--md-s2);height:42px;padding:0 var(--md-s5);border:0;border-radius:var(--md-sh-full);',
    'font:inherit;font-size:var(--md-label-lg);font-weight:var(--md-w-med);letter-spacing:.2px;cursor:pointer;white-space:nowrap;',
    'transition:background var(--md-dur-short) var(--md-ease-standard),color var(--md-dur-short) var(--md-ease-standard),box-shadow var(--md-dur-short) var(--md-ease-standard);}',
    '.c-btn--pri{background:var(--md-primary);color:var(--md-on-primary);box-shadow:var(--md-shadow-1);}',
    '.c-btn--pri:hover{box-shadow:var(--md-shadow-2);}',
    '.c-btn--stop{background:transparent;color:var(--md-error);box-shadow:inset 0 0 0 1px var(--md-outline-variant);}',
    '.c-btn--stop:hover:not([disabled]){background:var(--md-error-container);color:var(--md-on-error-container);}',
    '.c-btn[disabled]{opacity:.38;cursor:not-allowed;box-shadow:none;}',
    '.c-btn .c-ic{width:18px;height:18px;}',
    /* 清空是独立的重置入口：danger 描边，与「按教师答案登账」并列但语义分明 */
    '.c-btn--clear{background:transparent;color:var(--md-error);box-shadow:inset 0 0 0 1px var(--md-error);}',
    '.c-btn--clear:hover{background:var(--md-error-container);color:var(--md-on-error-container);}',
    /* 异常演示入口：贴右，弱化，不参与主次按钮队列 */
    '.c-btn--ghost{background:transparent;color:var(--md-on-surface-variant);box-shadow:inset 0 0 0 1px var(--md-outline-variant);',
    'height:38px;font-size:var(--md-label-md);padding:0 var(--md-s4);}',
    '.c-btn--ghost:hover{background:var(--md-surface-container-highest);color:var(--md-on-surface);}',

    '.c-prog{height:4px;border-radius:var(--md-sh-full);background:var(--md-surface-container-highest);overflow:hidden;}',
    '.c-prog>i{display:block;height:100%;width:0;border-radius:inherit;background:var(--md-primary);transition:width var(--md-dur-med) var(--md-ease-standard);}',
    '.c-prog[data-stop="1"]>i{background:var(--md-warn);}',
    '.c-stat{font-size:var(--md-body-sm);line-height:var(--md-body-sm-lh);color:var(--md-on-surface-variant);',
    'font-family:var(--md-mono);font-variant-numeric:tabular-nums;}',

    /* --- 异常态（第二层详情顶部常驻，四档语义色分级）--- */
    '.c-an{display:flex;flex-direction:column;gap:var(--md-s3);margin-bottom:var(--md-s3);padding:var(--md-s4);',
    'border-radius:var(--md-sh-lg);animation:c-rise var(--md-dur-long) var(--md-ease-decel) both;}',
    '.c-an--err{background:var(--md-error-container);color:var(--md-on-error-container);}',
    '.c-an--warn{background:var(--md-warn-container);color:var(--md-on-warn-container);}',
    '.c-an--unk{background:var(--md-surface-container-highest);color:var(--md-on-surface);}',
    '.c-an-top{display:flex;align-items:center;gap:var(--md-s3);}',
    '.c-an-ic{width:40px;height:40px;flex:0 0 auto;border-radius:var(--md-sh-full);display:grid;place-items:center;}',
    '.c-an--err .c-an-ic{background:var(--md-error);color:var(--md-on-error);}',
    '.c-an--warn .c-an-ic{background:var(--md-warn);color:var(--md-surface);}',
    '.c-an--unk .c-an-ic{background:var(--md-outline-variant);color:var(--md-on-surface-variant);}',
    '.c-an-tx{min-width:0;flex:1;display:flex;flex-direction:column;}',
    '.c-an-t,.c-an-s{display:block;}',
    '.c-an-t{font-size:var(--md-title-md);line-height:var(--md-title-md-lh);font-weight:var(--md-w-med);}',
    '.c-an-s{font-size:var(--md-body-sm);line-height:var(--md-body-sm-lh);opacity:.85;}',
    '.c-an-nums{display:flex;gap:var(--md-s6);}',
    '.c-an-n{display:flex;flex-direction:column;}',
    '.c-an-n i{font-style:normal;font-size:var(--md-label-sm);opacity:.75;}',
    '.c-an-n b{font-family:var(--md-mono);font-size:var(--md-title-lg);line-height:var(--md-title-lg-lh);',
    'font-variant-numeric:tabular-nums;font-weight:var(--md-w-med);}',
    '.c-an-act{display:flex;flex-wrap:wrap;gap:var(--md-s2);align-items:center;}',
    '.c-an-tip{font-size:var(--md-label-md);opacity:.85;flex:1 1 auto;min-width:0;}',
    '.c-an-list{display:flex;flex-direction:column;border-radius:var(--md-sh-md);overflow:hidden;background:rgba(255,255,255,.42);}',
    '.c-an--unk .c-an-list{background:var(--md-surface-container-low);}',
    '.c-an-li{display:flex;align-items:center;gap:var(--md-s3);padding:7px var(--md-s3);font-size:var(--md-body-sm);}',
    '.c-an-li+.c-an-li{border-top:1px solid rgba(0,0,0,.09);}',
    '.c-an-li b{font-family:var(--md-mono);font-size:var(--md-label-md);flex:0 0 auto;}',
    '.c-an-li span:nth-child(2){flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.c-an-li i{font-style:normal;font-family:var(--md-mono);font-size:var(--md-label-sm);opacity:.8;flex:0 0 auto;}',
    '.c-mini{height:34px;padding:0 var(--md-s4);border:0;border-radius:var(--md-sh-full);cursor:pointer;',
    'background:var(--md-surface-container-lowest);color:var(--md-on-surface);font:inherit;font-size:var(--md-label-md);',
    'font-weight:var(--md-w-med);display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;',
    'box-shadow:inset 0 0 0 1px var(--md-outline-variant);}',
    '.c-mini:hover{background:var(--md-surface-container);}',
    '.c-mini .c-ic{width:15px;height:15px;}',

    /* --- 冲突裁决：写前普查发现冲突就停在这里问 --- */
    '.c-cf{display:flex;flex-direction:column;gap:var(--md-s3);margin-bottom:var(--md-s3);padding:var(--md-s4);',
    'border-radius:var(--md-sh-lg);background:var(--md-warn-container);color:var(--md-on-warn-container);',
    'animation:c-rise var(--md-dur-long) var(--md-ease-decel) both;}',
    '.c-cf-h{display:flex;align-items:center;gap:var(--md-s3);font-size:var(--md-title-md);line-height:var(--md-title-md-lh);',
    'font-weight:var(--md-w-med);}',
    '.c-cf-h .c-ic{width:22px;height:22px;}',
    '.c-cf-h span.c-cf-n{margin-left:auto;font-family:var(--md-mono);font-size:var(--md-label-md);}',
    '.c-cf-list{display:flex;flex-direction:column;border-radius:var(--md-sh-md);overflow:hidden;background:rgba(255,255,255,.42);}',
    '.c-cf-li{display:flex;align-items:center;gap:var(--md-s3);padding:7px var(--md-s3);font-size:var(--md-body-sm);}',
    '.c-cf-li+.c-cf-li{border-top:1px solid rgba(0,0,0,.09);}',
    '.c-cf-li b{font-family:var(--md-mono);font-size:var(--md-label-md);flex:0 0 auto;}',
    '.c-cf-li span:nth-child(2){flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.c-cf-li i{font-style:normal;font-family:var(--md-mono);font-size:var(--md-label-sm);flex:0 0 auto;}',
    '.c-cf-act{display:flex;flex-wrap:wrap;gap:var(--md-s2);align-items:center;}',
    '.c-cf-tip{font-size:var(--md-label-md);opacity:.85;flex:1 1 auto;min-width:0;}',
    '.c-btn--onwarn{background:var(--md-surface-container-lowest);color:var(--md-on-warn-container);box-shadow:none;}',
    '.c-btn--onwarn:hover{filter:brightness(.97);}',
    '.c-btn--danger{background:var(--md-error);color:var(--md-on-error);}',
    '.c-btn--danger:hover{filter:brightness(1.06);}',

    '.c-filter{display:flex;align-items:center;gap:var(--md-s2);height:38px;padding:0 var(--md-s3);border-radius:var(--md-sh-full);',
    'background:var(--md-surface-container-highest);}',
    '.c-filter .c-ic{color:var(--md-on-surface-variant);}',
    '.c-filter input{flex:1;min-width:0;border:0;background:transparent;color:var(--md-on-surface);font:inherit;font-size:var(--md-body-md);}',
    '.c-filter input:focus{outline:none;}',
    '.c-filter-n{font-family:var(--md-mono);font-size:var(--md-mono-sm);color:var(--md-on-surface-variant);font-variant-numeric:tabular-nums;}',

    '.c-dbody{flex:1 1 auto;min-height:0;overflow-y:auto;padding:0 var(--md-s5) 68px;}',

    /* --- 表格 --- */
    '.c-tw{width:100%;border-collapse:collapse;font-size:var(--md-body-sm);line-height:var(--md-body-sm-lh);}',
    '.c-tw th{position:sticky;top:0;z-index:1;background:var(--md-surface-container);color:var(--md-on-surface-variant);',
    'font-size:var(--md-label-sm);font-weight:var(--md-w-med);letter-spacing:.5px;text-align:left;padding:8px 10px;white-space:nowrap;}',
    '.c-tw td{padding:7px 10px;border-top:1px solid var(--md-outline-variant);vertical-align:baseline;}',
    '.c-tw tbody tr:hover td{background:var(--md-surface-container-low);}',
    '.c-tw .c-r{text-align:right;}',
    '.c-num{font-family:var(--md-mono);font-variant-numeric:tabular-nums;white-space:nowrap;}',
    '.c-code{font-family:var(--md-mono);font-size:var(--md-mono-sm);color:var(--md-on-surface-variant);}',
    '.c-dim{color:var(--md-on-surface-variant);}',
    '.c-tw .c-tr--open td{background:var(--md-surface-container);font-weight:var(--md-w-med);}',
    '.c-tw .c-tr--mt td{background:var(--md-primary-container);color:var(--md-on-primary-container);font-weight:var(--md-w-med);}',
    '.c-tw .c-tr--yt td{background:var(--md-secondary-container);color:var(--md-on-secondary-container);font-weight:var(--md-w-med);}',
    '.c-tw .c-tr--rule td{border-top:0;padding:2px 0;height:8px;}',
    '.c-tw .c-tr--bad td{background:var(--md-error-container);color:var(--md-on-error-container);}',
    '.c-tw .c-tr--unk td{background:var(--md-surface-container-highest);color:var(--md-on-surface-variant);}',
    '.c-bad{color:var(--md-error);font-weight:var(--md-w-med);}',
    '.c-rule{display:block;border-top:1px dashed var(--md-outline-variant);}',
    '.c-rule--dbl{border-top:3px double var(--md-outline-variant);}',

    /* --- 账簿树 --- */
    '.c-grp{margin-bottom:var(--md-s2);}',
    '.c-grp-h{display:flex;align-items:center;gap:var(--md-s2);padding:6px 2px 4px;font-size:var(--md-label-sm);',
    'letter-spacing:.5px;color:var(--md-on-surface-variant);text-transform:uppercase;}',
    '.c-page{display:flex;align-items:center;gap:var(--md-s3);width:100%;min-height:42px;padding:0 var(--md-s3);',
    'border:0;border-radius:var(--md-sh-sm);background:transparent;color:var(--md-on-surface);font:inherit;text-align:left;cursor:pointer;',
    'transition:background var(--md-dur-short) var(--md-ease-standard);}',
    '.c-page:hover{background:var(--md-surface-container);}',
    '.c-page[data-open="1"]{background:var(--md-surface-container);}',
    '.c-page[data-bad="1"]{background:var(--md-error-container);color:var(--md-on-error-container);}',
    '.c-page-c{font-family:var(--md-mono);font-size:var(--md-body-sm);font-variant-numeric:tabular-nums;color:var(--md-on-surface-variant);width:58px;flex:0 0 auto;}',
    '.c-page-n{flex:1;min-width:0;font-size:var(--md-body-md);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.c-page-r{font-family:var(--md-mono);font-size:var(--md-mono-sm);color:var(--md-on-surface-variant);font-variant-numeric:tabular-nums;}',
    '.c-page-b{display:none;margin:0 0 var(--md-s3) 0;padding:var(--md-s2) 0 0;background:var(--md-surface-container-lowest);',
    'border-radius:var(--md-sh-md);overflow:hidden;}',
    '.c-page-b[data-open="1"]{display:block;}',
    '.c-page-b .c-tw th{position:static;}',
    '.c-empty{padding:var(--md-s4);font-size:var(--md-body-sm);color:var(--md-on-surface-variant);text-align:center;}',

    /* --- 日志隔板 --- */
    '.c-sheet{position:absolute;left:0;right:0;bottom:0;z-index:5;height:48px;display:flex;flex-direction:column;overflow:hidden;',
    'background:var(--md-surface-container-highest);border-top:1px solid var(--md-outline-variant);',
    'border-radius:var(--md-sh-lg) var(--md-sh-lg) 0 0;box-shadow:0 -1px 6px rgba(0,0,0,.10);',
    'transition:height var(--md-dur-long) var(--md-ease-emphasized);}',
    '.c-sheet[data-open="1"]{height:min(44%,300px);}',
    '.c-sheet-hd{flex:0 0 auto;height:47px;display:flex;align-items:center;gap:var(--md-s2);padding:0 var(--md-s3) 0 var(--md-s4);',
    'cursor:pointer;user-select:none;}',
    '.c-grab{width:30px;height:4px;border-radius:var(--md-sh-full);background:var(--md-outline-variant);}',
    '.c-sheet-d{width:7px;height:7px;border-radius:50%;background:var(--md-outline);flex:0 0 auto;}',
    '.c-sheet-s{flex:1;min-width:0;font-size:var(--md-body-sm);line-height:var(--md-body-sm-lh);color:var(--md-on-surface-variant);',
    'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.c-sheet-d[data-k="ok"]{background:var(--md-primary);}',
    '.c-sheet-d[data-k="warn"]{background:var(--md-warn);}',
    '.c-sheet-d[data-k="err"]{background:var(--md-error);}',
    '.c-sheet-c{font-family:var(--md-mono);font-size:var(--md-mono-sm);color:var(--md-on-surface-variant);font-variant-numeric:tabular-nums;}',
    '.c-log{flex:1 1 auto;min-height:0;overflow-y:auto;padding:0 var(--md-s4) var(--md-s3);}',
    '.c-ln{display:flex;align-items:flex-start;gap:var(--md-s2);padding:3px 0;font-size:var(--md-body-sm);line-height:var(--md-body-sm-lh);}',
    '.c-ln-t{flex:0 0 auto;font-family:var(--md-mono);font-size:var(--md-mono-sm);color:var(--md-on-surface-variant);opacity:.7;padding-top:2px;}',
    '.c-ln-d{flex:0 0 auto;width:6px;height:6px;margin-top:6px;border-radius:50%;background:var(--md-outline);}',
    '.c-ln-m{flex:1;min-width:0;color:var(--md-on-surface-variant);word-break:break-word;}',
    '.c-ln--ok .c-ln-d{background:var(--md-primary);}',
    '.c-ln--ok .c-ln-m{color:var(--md-primary);}',
    '.c-ln--warn .c-ln-d{background:var(--md-warn);}',
    '.c-ln--warn .c-ln-m{color:var(--md-warn);}',
    '.c-ln--err .c-ln-d{background:var(--md-error);}',
    '.c-ln--err .c-ln-m{color:var(--md-error);}',

    /* --- 提示条 --- */
    '.c-toast{position:fixed;left:50%;bottom:92px;z-index:7;max-width:80vw;padding:10px 16px;border-radius:var(--md-sh-sm);',
    'background:var(--md-inverse-surface);color:var(--md-inverse-on-surface);box-shadow:var(--md-shadow-3);',
    'font-size:var(--md-body-md);opacity:0;pointer-events:none;transform:translateX(-50%) translateY(8px);',
    'transition:opacity var(--md-dur-med) var(--md-ease-standard),transform var(--md-dur-med) var(--md-ease-emphasized);}',
    '.c-toast[data-on="1"]{opacity:1;transform:translateX(-50%) translateY(0);}',

    /* --- 「清除」二次确认：Dialog 之上的确认层（MD3 dialog）--- */
    /* 遮罩用背景色而非 opacity：opacity 会连同对话框本体一起变透明 */
    '.c-cfm{position:fixed;inset:0;z-index:8;display:grid;place-items:center;background:transparent;',
    'pointer-events:none;transition:background var(--md-dur-med) var(--md-ease-standard);}',
    '.c-cfm[data-open="1"]{background:rgba(0,0,0,var(--md-scrim-opacity));pointer-events:auto;}',
    '.c-cfm-box{width:min(400px,calc(100vw - 40px));max-height:calc(100vh - 60px);overflow:auto;',
    'background:var(--md-surface-container-high);color:var(--md-on-surface);border-radius:var(--md-sh-xl);',
    'box-shadow:var(--md-shadow-5);opacity:0;transform:scale(.94);',
    'transition:opacity var(--md-dur-med) var(--md-ease-standard),transform var(--md-dur-long) var(--md-ease-emphasized);}',
    '.c-cfm[data-open="1"] .c-cfm-box{opacity:1;transform:none;}',
    '.c-cfm-c{padding:var(--md-s5) var(--md-s5) var(--md-s4);}',
    '.c-cfm-h{display:flex;align-items:center;gap:var(--md-s3);margin-bottom:var(--md-s3);}',
    '.c-cfm-h .c-ic{width:26px;height:26px;flex:0 0 auto;color:var(--md-error);}',
    '.c-cfm-h b{font-size:var(--md-title-lg);line-height:var(--md-title-lg-lh);font-weight:var(--md-w-med);}',
    '.c-cfm-c p{margin:0;font-size:var(--md-body-md);line-height:1.65;color:var(--md-on-surface-variant);}',
    '.c-cfm-act{display:flex;justify-content:flex-end;gap:var(--md-s2);padding:0 var(--md-s4) var(--md-s4);}',

    '.vp-root svg.vp-ic.c-ic{fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;}'
  ].join('');

  /* ============================ 环节定义 ============================ */
  var SECTIONS = [
    { id: 'taccount', name: 'T型账',      unit: '科目', ready: true,  icon: 'grid',   tone: 'c-tone-ter' },
    { id: 'detail',   name: '明细账',     unit: '账页', ready: true,  icon: 'list',   tone: 'c-tone-pri' },
    { id: 'journal',  name: '日记账',     unit: '账页', ready: false, icon: 'clock',  tone: 'c-tone-off' },
    { id: 'summary',  name: '科目汇总表', unit: '科目', ready: false, icon: 'sigma',  tone: 'c-tone-off' },
    { id: 'ledger',   name: '总账',       unit: '科目', ready: false, icon: 'book',   tone: 'c-tone-off' },
    { id: 'report',   name: '会计报表',   unit: '报表', ready: false, icon: 'chart',  tone: 'c-tone-off' }
  ];

  var THEMES = [
    { id: 'light',  label: '浅色',     icon: 'sun'  },
    { id: 'dark',   label: '深色',     icon: 'moon' },
    { id: 'system', label: '跟随系统', icon: 'auto' }
  ];

  /* ============================ 工具 ============================ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  /* 金额一律取整到「元」：原型里不出现 .xx 小数位 */
  function money(v) {
    var n = Math.round(Number(v) || 0);
    return n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
  }
  function yuan(v) { return money(v); }        // taccounts 已是「元」
  function fen(v) { return money((Number(v) || 0) / 100); }   // sample 行是「分」
  function clock() {
    var d = new Date(), p = function (x) { return String(x).padStart(2, '0'); };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /* ============================ 注册 ============================ */
  VP.register('C', '悬浮球 · 层级下钻', {
    mount: function (host, ctx) {
      var FX = ctx.fx, api = ctx.api;

      var SNAP_ID = '2026-10-13';

      var st = {
        open: false, section: null, theme: (document.documentElement.dataset.theme || 'system'),
        sheetOpen: false, running: false, done: 0, total: 0, progress: 0,
        // 数据源状态。false = primary（教师答案实时可用，正常路径）；true = fallback（接口未开放，回退仓库快照）
        fallback: false,
        year: FX.year, month: String(parseInt(FX.month, 10)), filter: '', log: [],
        // 异常态：null | 'stopped' | 'partial' | 'unknown'；
        // 以及「清除」二次确认与写前冲突裁决（两者都停在原地等用户决定）
        anomaly: null, retried: {}, cfm: false, conflict: false, conflictDone: false
      };

      /* ---------- 骨架 ---------- */
      host.innerHTML = ''
        + '<style>' + CSS + '</style>'
        + '<button class="c-fab" id="cFab" type="button" aria-label="教师答案助手（长按切换主题）">'
        +   '<span class="c-fab-busy"></span>' + ic('mark')
        + '</button>'
        + '<div class="c-menu" id="cMenu" role="menu">'
        +   '<div class="c-menu-hd">主题</div>' + themeItems() + '</div>'
        + '<div class="c-scrim" id="cScrim" data-open="0"></div>'
        + '<div class="c-dlg" id="cDlg" role="dialog" aria-modal="true" aria-hidden="true" data-open="0">'
        +   '<header class="c-hd">'
        +     '<div class="c-hd-l">'
        +       '<div class="c-hd-t">教师答案助手</div>'
        +       '<div class="c-hd-s" id="cHdSub">' + esc(FX.entity) + ' · ' + esc(st.year) + '-' + st.month + '</div>'
        +     '</div>'
        +     '<div class="c-hd-r" id="cHdR"></div>'
        +   '</header>'
        +   '<div id="cSrc">' + sourceCard() + '</div>'
        +   '<div class="c-lvl">'
        +     '<section class="c-view" id="cView1" data-st="on"><div class="c-lvl-inner vp-scroll">'
        +       '<div class="c-sec"><span class="c-sec-h">选择环节</span><span class="c-sec-x">已接入 2 / 6</span></div>'
        +       '<div class="c-grid" id="cGrid">' + gridCards() + '</div>'
        +     '</div></section>'
        +     '<section class="c-view" id="cView2" data-st="off-right">'
        +       '<div class="c-dhead" id="cDHead"></div>'
        +       '<div class="c-dbody vp-scroll" id="cDBody"></div>'
        +     '</section>'
        +   '</div>'
        +   '<div class="c-sheet" id="cSheet" data-open="0">'
        +     '<div class="c-sheet-hd" id="cSheetHd">'
        +       '<span class="c-grab"></span>'
        +       '<span class="c-sheet-d" id="cSheetDot" data-k="info"></span>'
        +       '<span class="c-sheet-s" id="cSheetSum">待处理 ' + FX.detailAccountCount + ' 账页</span>'
        +       '<span class="c-sheet-c" id="cSheetCnt">0</span>'
        +       '<span class="c-ib c-ib--sm" id="cSheetBtn" aria-hidden="true">' + ic('up') + '</span>'
        +     '</div>'
        +     '<div class="c-log vp-scroll" id="cLog"></div>'
        +   '</div>'
        + '</div>'
        + '<div class="c-cfm" id="cCfm" data-open="0">'
        +   '<div class="c-cfm-box" role="dialog" aria-modal="true" aria-labelledby="cCfmT">'
        +     '<div class="c-cfm-c">'
        +       '<div class="c-cfm-h">' + ic('trash') + '<b id="cCfmT">清除平台 T型账？</b></div>'
        +       '<p>扫描平台全部总账科目，把已登记行清掉。<br>平台无事务、无回滚，<b>不可撤销</b>。</p>'
        +     '</div>'
        +     '<div class="c-cfm-act">'
        +       '<button class="c-btn c-btn--ghost" type="button" data-act="cfm-no">取消</button>'
        +       '<button class="c-btn c-btn--danger" type="button" data-act="clear-do">' + ic('trash') + '清除全部</button>'
        +     '</div>'
        +   '</div>'
        + '</div>'
        + '<div class="c-toast" id="cToast"></div>';

      var $ = function (s) { return host.querySelector(s); };
      var $$ = function (s) { return Array.prototype.slice.call(host.querySelectorAll(s)); };

      /* ---------- 主题 ---------- */
      function themeItems() {
        return THEMES.map(function (t) {
          return '<button class="c-mi" type="button" data-theme-set="' + t.id + '" data-sel="' + (t.id === (document.documentElement.dataset.theme || 'system') ? '1' : '0') + '">'
            + ic(t.icon) + '<span class="c-grow">' + t.label + '</span>'
            + (t.id === (document.documentElement.dataset.theme || 'system') ? ic('check') : '')
            + '</button>';
        }).join('');
      }
      function setTheme(id) {
        st.theme = id;
        if (id === 'system') { delete document.documentElement.dataset.theme; }
        else { document.documentElement.dataset.theme = id; }
        $('#cMenu').innerHTML = '<div class="c-menu-hd">主题</div>' + themeItems();
        renderHeadRight();
      }
      function renderHeadRight() {
        var cur = THEMES.filter(function (t) { return t.id === st.theme; })[0] || THEMES[2];
        $('#cHdR').innerHTML = ''
          + '<button class="c-ib" type="button" data-act="theme" title="主题：' + cur.label + '（点击循环切换）">' + ic(cur.icon) + '</button>'
          + '<button class="c-ib" type="button" data-act="close" aria-label="收起面板">' + ic('close') + '</button>';
      }
      renderHeadRight();

      /* 头部副标题跟随数据源状态：两态文案不同，避免只改卡片而头部仍说「教师答案」 */
      function setHeadSub() {
        var sub = $('#cHdSub');
        if (!sub) return;
        sub.textContent = FX.entity + ' · ' + st.year + '-' + st.month
          + (st.fallback ? ' · 快照兜底' : ' · 实时');
      }

      /* ---------- 数据源卡（两态可切换） ----------
         primary  = 教师答案实时可用（tertiary 语义色，正常路径）
         fallback = 教师答案接口未开放，回退仓库内置快照（warn 警示语义） */
      function sourceCard() {
        var fb = st.fallback;
        return ''
          + '<div class="c-src">'
          +   '<div class="c-src-r">'
          +     '<span class="c-chip ' + (fb ? 'c-chip--warn' : 'c-chip--ter') + '">'
          +       ic(fb ? 'warn' : 'shield') + (fb ? '兜底快照 · ' + SNAP_ID : '教师答案 · 实时') + '</span>'
          +     '<span class="c-src-t">' + esc(st.year) + '-' + st.month + '</span>'
          +     '<span class="c-grow"></span>'
          +     '<span class="c-chip c-chip--out">' + esc(FX.entity) + '</span>'
          +   '</div>'
          +   '<div class="c-src-r c-src-r--sw">'
          +     '<span class="c-src-lb">模拟：教师答案未开放</span>'
          +     '<button class="c-sw" type="button" data-act="src" role="switch" data-on="' + (fb ? '1' : '0') + '" '
          +       'aria-checked="' + (fb ? 'true' : 'false') + '" '
          +       'title="' + (fb ? '切换为：教师答案实时可用' : '切换为：模拟教师答案未开放 · 回退仓库快照') + '">'
          +       '<i></i><span class="vp-sr">模拟教师答案未开放</span></button>'
          +   '</div>'
          + '</div>';
      }
      function flipSource() {
        st.fallback = !st.fallback;
        var box = $('#cSrc');
        if (box) box.innerHTML = sourceCard();
        // 环节网格的待接入文案也带数据源口径，必须一起重绘，否则网格仍说「实时可用」
        var grid = $('#cGrid');
        if (grid) { grid.innerHTML = gridCards(); restagger(); }
        setHeadSub();
        addLog(st.fallback
          ? '接口未开放 · 回退快照 ' + SNAP_ID
          : '接口连通 · 教师答案 · 实时',
          st.fallback ? 'warn' : 'ok');
      }

      /* ---------- 第一层网格 ---------- */
      function gridCards() {
        return SECTIONS.map(function (s, i) {
          var desc = s.id === 'taccount' ? (FX.taccountCount + ' 科目 · 借贷发生额')
            : s.id === 'detail' ? (FX.bookKeys.length + ' 账簿 · ' + FX.detailAccountCount + ' 账页')
            : (st.fallback ? '快照已就绪 · 待接入' : '实时可用 · 待接入');
          return ''
            + '<button class="c-card' + (s.ready ? '' : ' c-card--off') + '" type="button" data-sec="' + s.id + '" '
            + 'style="animation-delay:' + (i * 42) + 'ms" title="' + s.name + (s.ready ? '' : ' · 待接入') + '">'
            +   '<span class="c-card-ic ' + s.tone + '">' + ic(s.icon) + '</span>'
            +   '<span class="c-card-tx"><span class="c-card-nm">' + s.name + '</span><span class="c-card-ds">' + desc + '</span></span>'
            +   '<span class="c-badge ' + (s.ready ? 'c-badge--on' : 'c-badge--off') + '">' + (s.ready ? '已接入' : '待接入') + '</span>'
            +   (s.ready ? ic('right') : '')
            + '</button>';
        }).join('');
      }
      function restagger() {
        $$('#cGrid .c-card').forEach(function (el, i) {
          el.style.animation = 'none';
          void el.offsetWidth;
          el.style.animation = '';
          el.style.animationDelay = (i * 42) + 'ms';
        });
      }

      /* ---------- 层级切换 ---------- */
      function goGrid() {
        st.section = null;
        $('#cView1').dataset.st = 'on';
        $('#cView2').dataset.st = 'off-right';
        restagger();
      }
      function goDetail(id) {
        st.section = id;
        $('#cView1').dataset.st = 'off-left';
        renderDetail(id);
        requestAnimationFrame(function () { $('#cView2').dataset.st = 'on'; });
      }

      /* ---------- 第二层：详情头 ---------- */
      function crumb(sec, chipText) {
        return ''
          + '<div class="c-crumb">'
          +   '<button class="c-ib c-ib--sm" type="button" data-act="back" aria-label="返回环节列表">' + ic('back') + '</button>'
          +   '<span class="c-crumb-x">全部环节</span><span class="c-crumb-s">/</span>'
          +   '<span class="c-crumb-c">' + sec.name + '</span>'
          +   '<span class="c-grow"></span>'
          +   '<span class="c-chip c-chip--out">' + chipText + '</span>'
          + '</div>';
      }
      function controlBar() {
        return ''
          + '<div class="c-ctl">'
          +   '<label class="c-fld"><span>年份</span><input id="cYear" value="' + esc(st.year) + '" inputmode="numeric"></label>'
          +   '<label class="c-fld"><span>月份</span><input id="cMonth" value="' + esc(st.month) + '" inputmode="numeric"></label>'
          +   '<span class="c-grow"></span>'
          +   '<button class="c-btn c-btn--pri" type="button" data-act="run">' + ic('play') + '按教师答案登账</button>'
          +   '<button class="c-btn c-btn--stop" type="button" data-act="stop" disabled>' + ic('stop') + '停止</button>'
          +   '<button class="c-btn c-btn--clear" type="button" data-act="clear-open" title="清空平台已登记行 · 不可撤销">' + ic('trash') + '清除</button>'
          +   '<button class="c-btn c-btn--ghost" type="button" data-act="demo" title="循环演示四种异常态">' + ic('warn') + '演示</button>'
          + '</div>'
          + '<div class="c-prog" id="cProg"><i></i></div>'
          + '<div class="c-stat" id="cStat"></div>';
      }

      /* ---------- 异常态（四档：停止 / 部分失败 + 可重试 / 状态未知）----------
         状态未知走中性色：「查不到平台状态」和「平台是空的」是两回事，不能一律红。 */
      var BAD_ITEMS = [
        { code: '100202', name: '农业银行人民币户', why: '写超时' },
        { code: '2202', name: '应付账款', why: '读回校验不匹配' },
        { code: '660102', name: '管理费用 · 办公费', why: '行号未匹配' }
      ];
      function anHTML() {
        var a = st.anomaly;
        if (!a) return '';
        if (a === 'stopped') {
          return '<div class="c-an c-an--warn">'
            + '<div class="c-an-top"><span class="c-an-ic">' + ic('pause') + '</span>'
            + '<span class="c-an-tx"><span class="c-an-t">已停止</span>'
            + '<span class="c-an-s">已完成保留 · 未开始原值未动</span></span></div>'
            + '<div class="c-an-nums"><span class="c-an-n"><i>已完成</i><b>18</b></span>'
            + '<span class="c-an-n"><i>未开始</i><b>27</b></span></div>'
            + '<div class="c-an-act"><span class="c-an-tip">想撤回只能走「清除」</span>'
            + '<button class="c-mini" type="button" data-act="an-run">' + ic('play') + '继续登账</button></div></div>';
        }
        if (a === 'unknown') {
          var codes = ['1001', '1002', '1122', '2202', '6602', '6603'];
          return '<div class="c-an c-an--unk">'
            + '<div class="c-an-top"><span class="c-an-ic">' + ic('quest') + '</span>'
            + '<span class="c-an-tx"><span class="c-an-t">状态未知</span>'
            + '<span class="c-an-s">查询失败 · 不等于平台为空 · 本轮不写</span></span></div>'
            + '<div class="c-an-nums"><span class="c-an-n"><i>未知</i><b>6</b></span></div>'
            + '<div class="c-an-list">' + codes.map(function (c) {
                return '<div class="c-an-li"><b>' + c + '</b><span>' + esc(tName(c)) + '</span><i>状态未知</i></div>';
              }).join('') + '</div>'
            + '<div class="c-an-act"><span class="c-an-tip">这些科目本轮一个字都不写</span>'
            + '<button class="c-mini" type="button" data-act="an-query">' + ic('retry') + '重新查询</button></div></div>';
        }
        var bad = BAD_ITEMS.filter(function (b) { return !st.retried[b.code]; });
        var okN = 170 + (BAD_ITEMS.length - bad.length);
        return '<div class="c-an c-an--err">'
          + '<div class="c-an-top"><span class="c-an-ic">' + ic('warn') + '</span>'
          + '<span class="c-an-tx"><span class="c-an-t">' + (bad.length ? '部分失败' : '失败已全部重试成功') + '</span>'
          + '<span class="c-an-s">失败项保持原值 · 可单独重试</span></span></div>'
          + '<div class="c-an-nums"><span class="c-an-n"><i>成功</i><b>' + okN + '</b></span>'
          + '<span class="c-an-n"><i>失败</i><b>' + bad.length + '</b></span>'
          + '<span class="c-an-n"><i>跳过</i><b>2</b></span></div>'
          + (bad.length ? '<div class="c-an-list">' + bad.map(function (b) {
              return '<div class="c-an-li"><b>' + b.code + '</b><span>' + esc(b.name) + '</span><i>' + esc(b.why) + '</i>'
                + '<button class="c-mini" type="button" data-act="an-retry" data-code="' + b.code + '">'
                + ic('retry') + '重试</button></div>';
            }).join('') + '</div>' : '')
          + (bad.length ? '<div class="c-an-act"><span class="c-an-tip">只重试失败项，不重复已成功的</span>'
            + '<button class="c-mini" type="button" data-act="an-retry" data-code="*">' + ic('retry') + '重试全部失败</button></div>' : '')
          + '</div>';
      }

      /* ---------- 冲突裁决：写前普查发现冲突就停在这里问 ---------- */
      var CONFLICTS = [
        { code: '1002', name: '银行存款', plat: 53, plan: 48 },
        { code: '2202', name: '应付账款', plat: 12, plan: 9 },
        { code: '6602', name: '管理费用', plat: 21, plan: 18 }
      ];
      function conflictHTML() {
        if (!st.conflict) return '';
        return '<div class="c-cf">'
          + '<div class="c-cf-h">' + ic('warn') + '<b>发现 3 个冲突科目</b>'
          + '<span class="c-cf-n">平台有行 ≠ 计划</span></div>'
          + '<div class="c-cf-list">' + CONFLICTS.map(function (c) {
              return '<div class="c-cf-li"><b>' + c.code + '</b><span>' + esc(c.name) + '</span>'
                + '<i>平台 ' + c.plat + ' / 计划 ' + c.plan + '</i></div>';
            }).join('')
          + '<div class="c-cf-li"><b>另有</b><span>2 个计划外科目已有数据</span><i>本轮不动</i></div>'
          + '<div class="c-cf-li"><b>另有</b><span>1 个科目状态未知</span><i>本轮不写</i></div>'
          + '</div>'
          + '<div class="c-cf-act"><span class="c-cf-tip">清掉它们再写，还是跳过它们？</span>'
          + '<button class="c-mini" type="button" data-act="cf-stop">' + ic('ban') + '停止</button>'
          + '<button class="c-mini" type="button" data-act="cf-skip">' + ic('skip') + '跳过它们</button>'
          + '<button class="c-btn c-btn--danger" type="button" data-act="cf-clear">' + ic('trash') + '清掉再写</button>'
          + '</div></div>';
      }

      /* ---------- 详情：T型账 ---------- */
      function tName(code) {
        var t = FX.taccounts.filter(function (x) { return x.code === code; })[0];
        return t ? t.name : '';
      }
      function renderTaccount() {
        var rows = FX.taccounts, dt = 0, lt = 0, nt = 0;
        rows.forEach(function (a) { dt += a.d; lt += a.l; nt += a.n; });
        /* 状态列只在异常态出现：正常时不摆 45 行「—」，省掉一列噪声 */
        var showSt = !!st.anomaly;
        var body = rows.map(function (a) {
          var bad = st.anomaly === 'retry' && BAD_ITEMS.some(function (b) { return b.code === a.code && !st.retried[b.code]; });
          var unk = st.anomaly === 'unknown' && ['2202', '6602'].indexOf(a.code) >= 0;
          var cls = bad ? ' class="c-tr--bad"' : unk ? ' class="c-tr--unk"' : '';
          return '<tr data-f="' + esc((a.code + ' ' + a.name).toLowerCase()) + '"' + cls + '>'
            + '<td><span class="c-code">' + esc(a.code) + '</span></td>'
            + '<td>' + esc(a.name) + '</td>'
            + '<td class="c-r c-num">' + (a.d ? yuan(a.d) : '<span class="c-dim">—</span>') + '</td>'
            + '<td class="c-r c-num">' + (a.l ? yuan(a.l) : '<span class="c-dim">—</span>') + '</td>'
            + '<td class="c-r c-num">' + a.n + '</td>'
            + (showSt ? '<td class="c-r c-num">' + (bad ? '<span class="c-bad">失败</span>'
              : unk ? '<span class="c-dim">未知</span>' : '') + '</td>' : '') + '</tr>';
        }).join('');
        $('#cDBody').innerHTML = ''
          + '<div class="c-tw-wrap">'
          + '<table class="c-tw"><thead><tr>'
          + '<th style="width:76px">科目码</th><th>科目名称</th>'
          + '<th class="c-r" style="width:112px">借方</th>'
          + '<th class="c-r" style="width:112px">贷方</th>'
          + '<th class="c-r" style="width:52px">笔数</th>'
          + (showSt ? '<th class="c-r" style="width:60px">状态</th>' : '')
          + '</tr></thead><tbody id="cTbBody">' + body + '</tbody></table></div>';
        return {
          total: FX.taccountCount, unit: '科目',
          stat: '借 ' + yuan(dt) + ' · 贷 ' + yuan(lt) + ' · ' + nt + ' 笔'
        };
      }

      /* ---------- 详情：明细账 ---------- */
      function pageTable(rows) {
        var trs = rows.map(function (r) {
          if (r.k === 'monthLine' || r.k === 'yearLine') {
            return '<tr class="c-tr--rule"><td colspan="9"><span class="c-rule'
              + (r.k === 'yearLine' ? ' c-rule--dbl' : '') + '"></span></td></tr>';
          }
          var cls = r.k === 'opening' ? 'c-tr--open' : r.k === 'monthTotal' ? 'c-tr--mt' : r.k === 'yearTotal' ? 'c-tr--yt' : '';
          return '<tr' + (cls ? ' class="' + cls + '"' : '') + '>'
            + '<td class="c-num c-dim">' + esc(r.mm) + '</td>'
            + '<td class="c-num c-dim">' + esc(r.dd) + '</td>'
            + '<td class="c-dim">' + esc(r.t) + '</td>'
            + '<td class="c-num c-dim">' + esc(r.no || '') + '</td>'
            + '<td>' + esc(r.sum) + '</td>'
            + '<td class="c-r c-num">' + (r.d ? fen(r.d) : '') + '</td>'
            + '<td class="c-r c-num">' + (r.l ? fen(r.l) : '') + '</td>'
            + '<td class="c-dim">' + esc(r.dir || '') + '</td>'
            + '<td class="c-r c-num">' + (r.bal ? fen(r.bal) : '') + '</td></tr>';
        }).join('');
        return '<table class="c-tw"><thead><tr>'
          + '<th style="width:34px">月</th><th style="width:34px">日</th><th style="width:44px">种类</th><th style="width:44px">号</th>'
          + '<th>摘要</th><th class="c-r" style="width:104px">借方</th><th class="c-r" style="width:104px">贷方</th>'
          + '<th style="width:36px">方向</th><th class="c-r" style="width:112px">余额</th>'
          + '</tr></thead><tbody>' + trs + '</tbody></table>';
      }
      function renderDetailBooks() {
        var groups = FX.bookKeys.map(function (k) {
          var books = FX.books[k] || [];
          var t = FX.taccounts.filter(function (x) { return x.code === k; })[0];
          var gname = t ? (k + ' ' + t.name) : k;
          var pages = books.reduce(function (s, b) { return s + b.rows; }, 0);
          var items = books.map(function (b) {
            var has = !!FX.sample[b.code];
            var bad = st.anomaly === 'retry' && BAD_ITEMS.some(function (x) { return x.code === b.code && !st.retried[x.code]; });
            return '<button class="c-page" type="button" data-act="page" data-code="' + esc(b.code) + '" data-open="0"'
              + (bad ? ' data-bad="1"' : '') + '>'
              + '<span class="c-page-c">' + esc(b.code) + '</span>'
              + '<span class="c-page-n">' + esc(b.name) + '</span>'
              + '<span class="c-page-r">' + b.rows + ' 行</span>'
              + (bad ? '<span class="c-chip c-chip--err" style="height:20px;font-size:10px">失败</span>'
                : has ? ic('down') : '<span class="c-chip c-chip--out" style="height:20px;font-size:10px">无行数据</span>')
              + '</button>'
              + '<div class="c-page-b" data-for="' + esc(b.code) + '"></div>';
          }).join('');
          return '<div class="c-grp"><div class="c-grp-h">'
            + '<span>' + esc(gname) + '</span><span class="c-grow"></span>'
            + '<span>' + books.length + ' 本 · ' + pages + ' 行</span></div>' + items + '</div>';
        }).join('');
        $('#cDBody').innerHTML = ''
          + '<div class="c-sec"><span class="c-sec-h">账簿清单</span>'
          + '<span class="c-sec-x">' + FX.bookKeys.length + ' 本 · ' + FX.detailAccountCount + ' 账页 · ' + FX.detailEntryTotal + ' 行</span></div>'
          + groups;
        return {
          total: FX.detailAccountCount, unit: '账页',
          stat: '待登 ' + FX.detailAccountCount + ' 账页 / ' + FX.detailEntryTotal + ' 行'
        };
      }

      function renderDetail(id) {
        var sec = SECTIONS.filter(function (s) { return s.id === id; })[0];
        st.filter = ''; st.progress = 0; st.done = 0;
        st.anomaly = null; st.retried = {}; st.conflict = false; st.conflictDone = false;
        var info;
        $('#cDHead').innerHTML = crumb(sec, id === 'taccount' ? FX.taccountCount + ' 科目' : FX.bookKeys.length + ' 账簿')
          + anHTML() + conflictHTML()
          + controlBar()
          + (id === 'taccount'
            ? '<div class="c-filter">' + ic('search')
              + '<input id="cFilter" placeholder="科目码 / 名称" aria-label="筛选科目"><span class="c-filter-n" id="cFilterN"></span></div>'
            : '');
        info = id === 'taccount' ? renderTaccount() : renderDetailBooks();
        st.total = info.total;
        if (!st.anomaly) {
          $('#cStat').textContent = info.stat;
          setSheetSummary('待处理 ' + info.total + ' 个' + info.unit, 'info');
        }
        if (id === 'taccount') updateFilterCount();
      }

      /* 异常态只重绘详情头（异常卡与统计行都在头部），不重建表格，保留筛选与展开状态 */
      function renderAn() {
        var sec = SECTIONS.filter(function (s) { return s.id === st.section; })[0];
        if (!sec) return;
        var old = $('#cDHead');
        var box = document.createElement('div');
        box.innerHTML = crumb(sec, sec.id === 'taccount' ? FX.taccountCount + ' 科目' : FX.bookKeys.length + ' 账簿')
          + anHTML() + conflictHTML()
          + controlBar()
          + (sec.id === 'taccount'
            ? '<div class="c-filter">' + ic('search')
              + '<input id="cFilter" placeholder="科目码 / 名称" aria-label="筛选科目"><span class="c-filter-n" id="cFilterN"></span></div>'
            : '');
        old.innerHTML = box.innerHTML;
        var f = $('#cFilter');
        if (f) f.value = st.filter;
        updateFilterCount();
        if (st.running) setRunning(true);
        // 异常态占据统计行：把口径从「待处理」换成真实的失败/未知说明
        if (st.anomaly === 'stopped') $('#cStat').textContent = '已完成 18 · 未开始 27 · 合计 ' + st.total;
        else if (st.anomaly === 'unknown') $('#cStat').textContent = '状态未知 6 · 本轮不写 · 合计 ' + st.total;
        else if (st.anomaly) $('#cStat').textContent = '成功 170+ · 失败 3 · 跳过 2 · 合计 ' + st.total;
      }

      function updateFilterCount() {
        var n = 0;
        $$('#cTbBody tr').forEach(function (tr) {
          var hit = !st.filter || tr.dataset.f.indexOf(st.filter) > -1;
          tr.style.display = hit ? '' : 'none';
          if (hit) n++;
        });
        var el = $('#cFilterN');
        if (el) el.textContent = n + ' / ' + FX.taccountCount;
      }

      /* ---------- 日志 ---------- */
      function setSheetSummary(text, kind) {
        $('#cSheetSum').textContent = text;
        $('#cSheetDot').dataset.k = kind || 'info';
      }
      /* pushLine 只负责上屏。宿主 api.log() 会把消息回灌给 mounted.log，
         若不把「上屏」与「转发宿主」拆开，addLog 会自己递归自己。 */
      function pushLine(msg, kind) {
        if (['info', 'ok', 'warn', 'err'].indexOf(kind) < 0) kind = 'info';
        var list = $('#cLog');
        if (!list) return null;
        var near = list.scrollTop + list.clientHeight >= list.scrollHeight - 24;
        var el = document.createElement('div');
        el.className = 'c-ln c-ln--' + kind;
        el.innerHTML = '<span class="c-ln-t">' + clock() + '</span><span class="c-ln-d"></span><span class="c-ln-m">' + esc(msg) + '</span>';
        list.appendChild(el);
        while (list.childNodes.length > 400) list.removeChild(list.firstChild);
        if (near) list.scrollTop = list.scrollHeight;
        return el;
      }
      var inRelay = false;
      function addLog(msg, kind) {
        kind = kind || 'info';
        st.log.push({ t: clock(), m: msg, k: kind });
        if (st.log.length > 400) st.log.shift();
        var el = pushLine(msg, kind);
        countLog();
        if (!inRelay) {                       // 转发宿主；宿主回灌时 inRelay 为真，直接丢弃
          inRelay = true;
          try { api.log(msg, kind); } finally { inRelay = false; }
        }
        return el;
      }
      /* mounted.log 契约入口：宿主页「试日志」按钮与 api.log 外部调用都汇到这里 */
      function relayLog(msg, kind) {
        if (inRelay) return;
        addLog(msg, kind);
      }
      function countLog() {
        $('#cSheetCnt').textContent = String(st.log.length) + ' 条';
      }
      function setSheet(open) {
        st.sheetOpen = open;
        $('#cSheet').dataset.open = open ? '1' : '0';
        $('#cDlg').dataset.sheet = open ? '1' : '0';
        $('#cSheetBtn').innerHTML = ic(open ? 'down' : 'up');
        if (open) { var l = $('#cLog'); l.scrollTop = l.scrollHeight; }
      }

      /* ---------- 执行 ---------- */
      var timer = null;
      function setRunning(on) {
        st.running = on;
        api.setState({ busy: on });
        $('#cFab').dataset.busy = on ? '1' : '0';
        var b = $('[data-act="run"]'), s = $('[data-act="stop"]');
        if (b) b.disabled = on;
        if (s) s.disabled = !on;
      }
      function setProgress(done, total, stopped) {
        st.done = done; st.total = total;
        st.progress = total ? done / total : 0;
        var p = $('#cProg');
        if (!p) return;
        p.dataset.stop = stopped ? '1' : '0';
        p.querySelector('i').style.width = (st.progress * 100).toFixed(1) + '%';
      }

      function startRun(resume) {
        if (st.running) return;
        var sec = st.section;
        var y = $('#cYear'), m = $('#cMonth');
        st.year = (y && /^\d{4}$/.test(y.value.trim())) ? y.value.trim() : st.year;
        st.month = (m && /^\d{1,2}$/.test(m.value.trim())) ? String(Math.min(12, Math.max(1, parseInt(m.value.trim(), 10)))) : st.month;
        if (y) y.value = st.year;
        if (m) m.value = st.month;
        setHeadSub();

        st.anomaly = null; st.retried = {};
        // resume=true 表示这是「清掉冲突科目后接着写」，不能再触发一次冲突裁决
        st.conflict = false;
        st.conflictDone = !!resume;
        setRunning(true);
        setProgress(0, sec === 'taccount' ? FX.taccountCount : FX.detailAccountCount, false);
        addLog('开始登账 · ' + (sec === 'taccount' ? 'T型账' : '明细账') + ' · ' + st.year + '-' + st.month, 'info');
        if (st.fallback) addLog('接口未开放 · 快照 ' + SNAP_ID, 'warn');
        setSheetSummary('登账中 · 0%', 'info');

        var i = 0;
        var list = sec === 'taccount'
          ? FX.taccounts.map(function (a) { return { c: a.code, n: a.name, line: '借 ' + (a.d ? yuan(a.d) : '0') + ' / 贷 ' + (a.l ? yuan(a.l) : '0') + ' · ' + a.n + ' 笔' }; })
          : FX.bookKeys.reduce(function (acc, k) {
              (FX.books[k] || []).forEach(function (b) { acc.push({ c: b.code, n: b.name, line: b.rows + ' 行' + (b.rows === 0 ? ' · 无发生额' : '') }); });
              return acc;
            }, []);

        // 写前普查发现冲突：停下来问，不静默跳过（把冲突项与计划外项一次摊开）
        var stopAt = Math.min(4, list.length);

        timer = setInterval(function () {
          if (i >= list.length) {
            clearInterval(timer); timer = null;
            setRunning(false);
            setProgress(list.length, list.length, false);
            setSheetSummary('完成 · ' + list.length + '/' + list.length, 'ok');
            addLog('登账完成 · ' + list.length + ' 项', 'ok');
            return;
          }
          if (i === stopAt && !st.conflictDone) {
            clearInterval(timer); timer = null;
            st.conflict = true;
            setRunning(false);
            renderAn();
            setSheetSummary('发现冲突 · 待裁决', 'warn');
            addLog('写前普查发现冲突 · 待裁决', 'warn');
            return;
          }
          var it = list[i]; i++;
          var kind = it.line.indexOf('无发生额') > -1 ? 'warn' : 'ok';
          var el = addLog(it.c + ' ' + it.n + ' · ' + it.line, kind);
          if (el && !st.sheetOpen && i % 7 === 0) setSheetSummary('登账中 · ' + it.c, kind);
          setProgress(i, list.length, false);
          countLog();
        }, sec === 'taccount' ? 60 : 40);
      }

      function stopRun() {
        if (!st.running || !timer) return;
        clearInterval(timer); timer = null;
        setRunning(false);
        setProgress(st.done, st.total, true);
        // 停止后：已完成的保留、未开始的明确标出
        st.anomaly = 'stopped';
        renderAn();
        setSheetSummary('已停止 · ' + st.done + '/' + st.total, 'warn');
        addLog('已停止 · 已完成 ' + st.done + ' 保留，未开始 ' + (st.total - st.done) + ' 原值未动', 'warn');
      }

      /* 清除：独立的重置入口，与「按教师答案登账」互不相干，且必须二次确认 */
      function clearAll() {
        st.cfm = false;
        st.anomaly = null;
        st.conflict = false;
        $('#cCfm').dataset.open = '0';
        setProgress(0, st.total, false);
        setSheetSummary('已清空 · 平台为 0 行', 'ok');
        addLog('清空 T型账 · 已清 42 科目', 'ok');
        addLog('原本已是 0 行 3 个 · 未清干净 0 个', 'warn');
      }

      /* 冲突裁决结果 */
      function conflictChoice(v) {
        st.conflict = false;
        if (v === 'stop') {
          st.anomaly = 'stopped';
          renderAn();
          setSheetSummary('已停止 · 一个字没写', 'warn');
          addLog('已停止 · 一个字没写', 'info');
          return;
        }
        if (v === 'skip') {
          st.anomaly = 'partial';
          if (st.section === 'taccount') renderTaccount();
          renderAn();
          setSheetSummary('跳过 3 个冲突科目 · 其余照写', 'warn');
          addLog('跳过 3 个冲突科目 · 其余照写', 'warn');
          return;
        }
        addLog('已清掉 3 个冲突科目 · 继续写入', 'warn');
        renderAn();
        startRun(true);
      }

      function cycleAnomaly() {
        var seq = [null, 'stopped', 'partial', 'retry', 'unknown'];
        var i = seq.indexOf(st.anomaly);
        st.anomaly = seq[(i + 1) % seq.length];
        st.retried = {};
        st.conflict = false;
        if (st.section === 'taccount') renderTaccount();
        renderAn();
        addLog(st.anomaly
          ? '演示：' + ({ stopped: '停止', partial: '部分失败', retry: '失败可重试', unknown: '状态未知' })[st.anomaly] + ' 态'
          : '演示：已复位', 'info');
      }

      /* ---------- 提示条 ---------- */
      var toastT = null;
      function toast(msg) {
        var t = $('#cToast');
        t.textContent = msg;
        t.dataset.on = '1';
        clearTimeout(toastT);
        toastT = setTimeout(function () { t.dataset.on = '0'; }, 2600);
      }

      /* ---------- 开合 ---------- */
      function setOpen(v) {
        st.open = v;
        $('#cFab').dataset.open = v ? '1' : '0';
        $('#cScrim').dataset.open = v ? '1' : '0';
        var d = $('#cDlg');
        d.dataset.open = v ? '1' : '0';
        d.setAttribute('aria-hidden', v ? 'false' : 'true');
        if (!v) {
          closeMenu();
          if (st.cfm) { st.cfm = false; $('#cCfm').dataset.open = '0'; }
          if (st.running) stopRun();
        }
      }
      function closeMenu() { $('#cMenu').dataset.open = '0'; }

      /* ---------- 悬浮球：长按 / 右键 ---------- */
      var lpTimer = null, lpFired = false, lpX = 0, lpY = 0;
      function openMenu() { $('#cMenu').dataset.open = '1'; }
      var fab = $('#cFab');
      fab.addEventListener('pointerdown', function (e) {
        lpFired = false; lpX = e.clientX; lpY = e.clientY;
        clearTimeout(lpTimer);
        lpTimer = setTimeout(function () { lpFired = true; openMenu(); }, 450);
      });
      fab.addEventListener('pointermove', function (e) {
        if (Math.abs(e.clientX - lpX) + Math.abs(e.clientY - lpY) > 8) { clearTimeout(lpTimer); }
      });
      fab.addEventListener('pointerup', function () { clearTimeout(lpTimer); });
      fab.addEventListener('pointercancel', function () { clearTimeout(lpTimer); });
      fab.addEventListener('contextmenu', function (e) { e.preventDefault(); clearTimeout(lpTimer); openMenu(); });
      fab.addEventListener('click', function (e) {
        if (lpFired) { lpFired = false; e.preventDefault(); return; }
        if ($('#cMenu').dataset.open === '1') { closeMenu(); return; }
        setOpen(true);
      });

      /* ---------- 事件 ---------- */
      host.addEventListener('click', function (e) {
        var mi = e.target.closest ? e.target.closest('[data-theme-set]') : null;
        if (mi) { setTheme(mi.dataset.themeSet); closeMenu(); return; }

        /* 确认层打开时只响应层内两个动作 —— 其余点击一律吞掉 */
        if (st.cfm) {
          var inCfm = e.target.closest ? e.target.closest('[data-act]') : null;
          var ca = inCfm ? inCfm.dataset.act : null;
          if (ca === 'clear-do') { clearAll(); return; }
          if (ca === 'cfm-no' || !inCfm) { st.cfm = false; $('#cCfm').dataset.open = '0'; addLog('已取消 · 未碰平台', 'info'); return; }
          return;
        }

        var card = e.target.closest ? e.target.closest('.c-card') : null;
        if (card) {
          var s = SECTIONS.filter(function (x) { return x.id === card.dataset.sec; })[0];
          if (!s) return;
          if (!s.ready) { toast('「' + s.name + '」待接入 · 本原型只通 T型账 / 明细账'); return; }
          goDetail(s.id);
          return;
        }

        var page = e.target.closest ? e.target.closest('[data-act="page"]') : null;
        if (page) {
          var open = page.dataset.open === '1';
          page.dataset.open = open ? '0' : '1';
          var arrow = page.querySelector('svg');
          if (arrow) arrow.outerHTML = ic(open ? 'down' : 'up');
          var box = host.querySelector('.c-page-b[data-for="' + page.dataset.code + '"]');
          box.dataset.open = open ? '0' : '1';
          if (!open && !box.dataset.filled) {
            box.dataset.filled = '1';
            var rows = FX.sample[page.dataset.code];
            box.innerHTML = rows ? pageTable(rows)
              : '<div class="c-empty">该账页未内置行数据</div>';
          }
          return;
        }

        var act = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!act) return;
        var a = act.dataset.act;
        if (a === 'back') { goGrid(); }
        else if (a === 'src') { flipSource(); }
        else if (a === 'run') { startRun(); }
        else if (a === 'stop') { stopRun(); }
        else if (a === 'close') { setOpen(false); }
        /* 清除：独立入口，先二次确认 */
        else if (a === 'clear-open') { st.cfm = true; $('#cCfm').dataset.open = '1'; }
        /* 冲突裁决 */
        else if (a === 'cf-clear') { conflictChoice('clear'); }
        else if (a === 'cf-skip') { conflictChoice('skip'); }
        else if (a === 'cf-stop') { conflictChoice('stop'); }
        /* 异常演示与异常态内动作 */
        else if (a === 'demo') { cycleAnomaly(); }
        else if (a === 'an-run') { st.anomaly = null; renderAn(); startRun(); }
        else if (a === 'an-query') { addLog('重新查询 · 6 科目仍未知', 'warn'); }
        else if (a === 'an-retry') {
          var c = act.dataset.code;
          if (c === '*') {
            BAD_ITEMS.forEach(function (b) { st.retried[b.code] = true; });
            addLog('重试 3 项 · 全部成功', 'ok');
          } else {
            st.retried[c] = true;
            addLog('重试 ' + c + ' · 成功', 'ok');
          }
          if (st.section === 'taccount') renderTaccount();
          renderAn();
        }
        else if (a === 'theme') {
          var order = ['light', 'dark', 'system'];
          setTheme(order[(order.indexOf(st.theme) + 1) % 3]);
        }
      });

      host.addEventListener('input', function (e) {
        if (e.target.id === 'cFilter') { st.filter = e.target.value.trim().toLowerCase(); updateFilterCount(); }
      });

      $('#cScrim').addEventListener('click', function () { setOpen(false); });

      /* 日志隔板：拖拽判定，位移不足则视为点击切换 */
      (function () {
        var sh = $('#cSheetHd'), y0 = 0, dragging = false;
        sh.addEventListener('pointerdown', function (e) { dragging = true; y0 = e.clientY; });
        sh.addEventListener('pointerup', function (e) {
          if (!dragging) return; dragging = false;
          var d = y0 - e.clientY;
          if (d > 24) setSheet(true);
          else if (d < -24) setSheet(false);
          else setSheet(!st.sheetOpen);
        });
        sh.addEventListener('pointercancel', function () { dragging = false; });
      })();

      document.addEventListener('keydown', onKey);
      function onKey(e) {
        if (e.key !== 'Escape') return;
        if (st.cfm) { st.cfm = false; $('#cCfm').dataset.open = '0'; return; }
        if ($('#cMenu').dataset.open === '1') { closeMenu(); return; }
        if (st.open) setOpen(false);
      }

      /* ---------- 初始化日志 ---------- */
      setSheet(false);
      addLog('就绪 · 悬浮球模式', 'info');
      addLog('教师答案 · 实时 · ' + st.year + '-' + st.month, 'ok');

      return {
        /* 宿主页切换栏的「收起态」按钮与本变体的悬浮球走同一条路径 */
        toggle: function () { setOpen(!st.open); },
        /* 宿主页「试日志」按钮经 api.log 回灌到这里 */
        log: relayLog,
        unmount: function () {
          if (timer) { clearInterval(timer); timer = null; }
          clearTimeout(toastT); clearTimeout(lpTimer);
          document.removeEventListener('keydown', onKey);
          host.innerHTML = '';
        }
      };
    }
  });
})();
