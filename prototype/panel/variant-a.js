// PROTOTYPE — 变体 A：左侧导航 · 工作台式。一次性代码，不是生产实现。
(function () {
  'use strict';
  window.VP = window.VP || {};

  /* ---------------------------------------------------------------- 图标 */
  var ICON = {
    taccount: '<path d="M10 10.02h5V21h-5zM17 21h3c1.1 0 2-.9 2-2v-9h-5v11zm3-18H5c-1.1 0-2 .9-2 2v3h19V5c0-1.1-.9-2-2-2zM3 19c0 1.1.9 2 2 2h3V10H3v9z"/>',
    detail: '<path d="M19 5v14H5V5h14m1.1-2H3.9c-.5 0-.9.4-.9.9v16.2c0 .4.4.9.9.9h16.2c.4 0 .9-.5.9-.9V3.9c0-.5-.5-.9-.9-.9zM11 7h6v2h-6V7zm0 4h6v2h-6v-2zm0 4h6v2h-6zM7 7h2v2H7zm0 4h2v2H7zm0 4h2v2H7z"/>',
    journal: '<path d="M17 10H7v2h10v-2zm2-7h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zm-5-5H7v2h7v-2z"/>',
    summary: '<path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>',
    ledger: '<path d="M4 10h3v7H4zM10.5 10h3v7h-3zM2 19h20v3H2zM17 10h3v7h-3zM12 1L2 6v2h20V6z"/>',
    report: '<path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/>',
    verified: '<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>',
    warn: '<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>',
    ok: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>',
    info: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>',
    err: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>',
    left: '<path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>',
    right: '<path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>',
    up: '<path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/>',
    down: '<path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    stop: '<path d="M6 6h12v12H6z"/>',
    search: '<path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>',
    sort: '<path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/>',
    light: '<path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/>',
    dark: '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>',
    auto: '<path d="M10.85 12.65h2.3L12 9l-1.15 3.65zM20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM14.3 16l-.7-2h-3.2l-.7 2H7.8L11 7h2l3.2 9h-1.9z"/>',
    bookmark: '<path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>',
    close: '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>',
    left2: '<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>',
    clear: '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>',
    retry: '<path d="M17.65 6.35A7.96 7.96 0 0 0 12 4c-4.42 0-7.99 3.58-8 8s3.58 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>',
    help: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.36-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>',
    skip: '<path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>'
  };
  function ic(k, cls) {
    return '<svg class="vp-ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICON[k] || '') + '</svg>';
  }

  /* ------------------------------------------------------------ 环节定义 */
  var SECTIONS = [
    { id: 'taccount', label: 'T型账', icon: 'taccount', ready: true },
    { id: 'detail', label: '明细账', icon: 'detail', ready: true },
    { id: 'journal', label: '日记账', icon: 'journal', ready: false },
    { id: 'summary', label: '科目汇总表', icon: 'summary', ready: false },
    { id: 'ledger', label: '总账', icon: 'ledger', ready: false },
    { id: 'report', label: '会计报表', icon: 'report', ready: false }
  ];
  // 兜底态引用的快照标识；正常态下不出现
  var SNAP_ID = '2026-10-13';

  var STEPS = [
    ['info', '开始登账 · {Y}年{M}月', 0],
    ['ok', '写入 T型账 · 45 科目', 1],
    ['ok', '核对借贷合计 · 平', 0],
    ['warn', '明细账 100202 · 无变化', 1],
    ['err', '100202 写入失败 · 可重试', 1],
    ['ok', '写入明细账 · 172/173 页', 0],
    ['ok', '登账完成 · 617 条', 0]
  ];

  /* 冲突裁决演示清单：平台已有行、但与本轮计划不匹配的科目 */
  var CONFLICTS = [
    { code: '1002', name: '银行存款', plat: 53, plan: 48 },
    { code: '2202', name: '应付账款', plat: 12, plan: 9 },
    { code: '6602', name: '管理费用', plat: 21, plan: 18 }
  ];

  /* -------------------------------------------------------------- 工具 */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  /* 金额一律取整到「元」显示：原型里不出现 .xx 小数位 */
  function group(v) {
    var n = Number(v) || 0;
    var s = String(Math.round(Math.abs(n)));
    return (n < 0 ? '-' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  /* FX.sample 的行金额单位是分 → 先 /100 再取整 */
  function yuan(c) {
    if (c === 0 || c == null) return '';
    return group(c / 100);
  }
  /* FX.taccounts 的 d/l 单位已经是元（1001: 15232 元 == 账页月汇 1523200 分）*/
  function moneyY(v) {
    if (v === 0 || v == null) return '';
    return group(v);
  }

  /* --------------------------------------------------------------- CSS */
  var CSS = `
.va-shell{
  position:relative; font-family:var(--md-font); color:var(--md-on-surface);
  width:500px; height:min(660px, calc(100vh - 40px));
}
.va-shell, .va-shell *{ box-sizing:border-box; letter-spacing:.012em; }
/* 收缩后 win 与整幅 frame 会盖住下层页面，必须逐层放行点击 */
.va-shell{ pointer-events:none; }
/* 元素级重置：用 :where() 把特异性压到 (0,0,1)，否则它会盖掉下面所有单类按钮规则
   （background / padding / color 全被抹平，rail、filled、themebtn 会变成透明无内边距）*/
:where(.va-shell) button{ font:inherit; letter-spacing:inherit; color:inherit; background:none;
  border:0; margin:0; padding:0; cursor:pointer; text-align:left; }
.va-shell p, .va-shell h1, .va-shell h2, .va-shell ul, .va-shell li{ margin:0; padding:0; }
.va-shell ul, .va-shell li{ list-style:none; }
.va-shell table{ border-collapse:collapse; width:100%; }
.va-shell input{ font:inherit; color:inherit; }

/* ---------- 收缩框：frame 固定尺寸，win 整体淡出，rail 原地接管 ---------- */
.va-frame{ position:absolute; top:0; right:0; width:100%;
  height:100%; pointer-events:none; }
.va-frame > *{ pointer-events:auto; }
.va-win{
  position:absolute; inset:0; display:flex; overflow:hidden;
  border-radius:var(--md-sh-xl); background:var(--md-surface-container-low);
  box-shadow:var(--md-shadow-4);
  transition:opacity var(--md-dur-med) var(--md-ease-standard),
             transform var(--md-dur-med) var(--md-ease-standard);
}
.va-shell[data-collapsed="false"] .va-win{ transition-delay:110ms; pointer-events:auto; }
.va-shell[data-collapsed="true"] .va-win{ opacity:0; transform:scale(.97) translateX(28px);
  pointer-events:none; }
/* ---------- 收起后的竖向导轨 ---------- */
.va-rail{
  position:absolute; top:0; right:0; width:40px; height:220px;
  display:flex; flex-direction:column; align-items:center; gap:14px;
  padding:18px 0; border-radius:var(--md-sh-xl);
  background:var(--md-surface-container-high);
  opacity:0; pointer-events:none;
  transition:opacity var(--md-dur-short) var(--md-ease-standard),
             box-shadow var(--md-dur-short) var(--md-ease-standard),
             filter var(--md-dur-short) var(--md-ease-standard);
}
.va-shell[data-collapsed="true"] .va-rail{
  opacity:.42; pointer-events:auto; transition-delay:140ms; filter:saturate(.7);
}
.va-shell[data-collapsed="true"] .va-rail:hover{
  opacity:.97; filter:none; box-shadow:var(--md-shadow-2);
}
.va-rail-dot{ width:9px; height:9px; border-radius:var(--md-sh-full); background:var(--md-primary); }
.va-rail.is-busy .va-rail-dot{ animation:va-pulse 1.4s var(--md-ease-standard) infinite; }
.va-rail-ticks{ display:flex; flex-direction:column; gap:5px; align-items:center; }
.va-rail-ticks i{ display:block; width:11px; height:2px; border-radius:2px;
  background:var(--md-on-surface-variant); }
.va-rail-ticks i:nth-child(1){ opacity:.55 }
.va-rail-ticks i:nth-child(2){ opacity:.35 }
.va-rail-ticks i:nth-child(3){ opacity:.2 }
.va-rail .vp-ic{ color:var(--md-on-surface-variant); margin-top:auto; }

/* ---------- 左侧导航（Navigation Rail · 仅图标）----------
   原 104px 太宽、明显挤占内容区。压到 60px 并去掉文字标签，
   可访问性由 title + aria-label 承担；账页（二级详情）态再紧到 56px。 */
.va-nav{
  flex:0 0 60px; width:60px; display:flex; flex-direction:column; align-items:center;
  padding:var(--md-s4) 6px; gap:var(--md-s2);
  background:var(--md-surface-container); overflow:hidden;
  transition:flex-basis var(--md-dur-med) var(--md-ease-standard),
             width var(--md-dur-med) var(--md-ease-standard),
             padding var(--md-dur-med) var(--md-ease-standard);
}
.va-navlist{ transition:width var(--md-dur-med) var(--md-ease-standard); }
.va-shell[data-page="true"] .va-nav{ flex-basis:56px; width:56px;
  padding-left:4px; padding-right:4px; }
.va-shell[data-page="true"] .va-mark{ display:none; }
.va-shell[data-page="true"] .va-body{ padding:var(--md-s4) var(--md-s3) var(--md-s3); }
.va-mark{
  width:32px; height:32px; border-radius:var(--md-sh-md); flex:0 0 auto;
  display:grid; place-items:center; margin-bottom:var(--md-s2);
  background:var(--md-primary); color:var(--md-on-primary);
  box-shadow:var(--md-shadow-1);
}
.va-navlist{ display:flex; flex-direction:column; gap:var(--md-s1); width:100%; }
.va-navitem{
  position:relative; width:100%; height:48px; border-radius:var(--md-sh-lg);
  display:grid; place-items:center;
  color:var(--md-on-surface-variant);
  animation:va-in var(--md-dur-med) var(--md-ease-decel) both;
  animation-delay:calc(var(--i, 0) * 30ms);
  transition:background var(--md-dur-short) var(--md-ease-standard),
             color var(--md-dur-short) var(--md-ease-standard);
}
.va-navitem .vp-ic{ width:22px; height:22px; }
.va-navitem:hover{ background:var(--md-surface-container-high); }
.va-navitem.is-active{
  background:var(--md-secondary-container); color:var(--md-on-secondary-container);
  box-shadow:var(--md-shadow-1);
}
.va-navitem.is-off{ opacity:.42; }
.va-navitem.is-off:hover{ background:var(--md-surface-container-high); }
.va-navdot{
  position:absolute; top:10px; right:10px; width:6px; height:6px;
  border-radius:var(--md-sh-full); background:var(--md-warn);
}

/* ---------- 主列 ---------- */
.va-main{ flex:1 1 auto; min-width:0; display:flex; flex-direction:column;
  background:var(--md-surface); }
.va-appbar{
  flex:0 0 auto; height:64px; display:flex; align-items:center; gap:var(--md-s2);
  padding:0 var(--md-s2) 0 var(--md-s4); background:var(--md-surface-container-low);
}
.va-titles{ min-width:0; flex:1 1 auto; }
.va-titles h1{
  font-size:var(--md-title-md); line-height:var(--md-title-md-lh);
  font-weight:var(--md-w-med); letter-spacing:.01em;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.va-titles p{
  font-size:var(--md-label-sm); line-height:16px; color:var(--md-on-surface-variant);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.va-icbtn{
  width:36px; height:36px; border-radius:var(--md-sh-full); flex:0 0 auto;
  display:grid; place-items:center; color:var(--md-on-surface-variant);
  transition:background var(--md-dur-short) var(--md-ease-standard);
}
.va-icbtn:hover{ background:var(--md-surface-container-highest); }

/* ---------- 内容 ---------- */
.va-body{
  flex:1 1 auto; min-height:0; overflow-y:auto; overflow-x:hidden;
  padding:var(--md-s3); display:flex; flex-direction:column; gap:var(--md-s3);
  background:var(--md-surface);
}
.va-card{
  background:var(--md-surface-container-lowest); border-radius:var(--md-sh-lg);
  box-shadow:var(--md-shadow-1); padding:var(--md-s3);
  animation:va-in var(--md-dur-long) var(--md-ease-decel) both;
  animation-delay:calc(var(--i, 0) * 34ms);
}
.va-card-head{ display:flex; align-items:center; gap:var(--md-s3); margin-bottom:var(--md-s4); }
.va-card-head h2{ font-size:var(--md-title-md); line-height:var(--md-title-md-lh);
  font-weight:var(--md-w-med); flex:1 1 auto; min-width:0; }
.va-card{
  background:var(--md-surface-container-lowest); border-radius:var(--md-sh-lg);
  box-shadow:var(--md-shadow-1); padding:var(--md-s4);
  animation:va-in var(--md-dur-long) var(--md-ease-decel) both;
  animation-delay:calc(var(--i, 0) * 34ms);
}
.va-meta{ font-size:var(--md-label-md); color:var(--md-on-surface-variant);
  font-family:var(--md-mono); font-variant-numeric:tabular-nums; }

/* 数据源 / 兜底 */
.va-src-top{ display:flex; gap:var(--md-s3); align-items:center; }
.va-src-ic{
  width:34px; height:34px; border-radius:var(--md-sh-full); flex:0 0 auto;
  display:grid; place-items:center;
  background:var(--md-tertiary-container); color:var(--md-on-tertiary-container);
}
.va-src-txt{ min-width:0; flex:1 1 auto; }
.va-src-txt b{ display:block; font-size:var(--md-title-sm); line-height:var(--md-title-sm-lh);
  font-weight:var(--md-w-med); }
.va-meta-inline{ display:block; font-style:normal; font-size:var(--md-body-sm);
  line-height:1.5; color:var(--md-on-surface-variant);
  font-family:var(--md-mono); font-variant-numeric:tabular-nums; }
.va-chips{ display:flex; flex-wrap:wrap; gap:var(--md-s2); margin-top:var(--md-s3); }
.va-chip{
  display:inline-flex; align-items:center; gap:5px; max-width:100%;
  min-height:28px; padding:4px 11px; border-radius:var(--md-sh-sm);
  font-size:var(--md-label-sm); line-height:1.35; letter-spacing:.01em;
}
.va-chip .vp-ic{ width:14px; height:14px; }
.va-chip-tertiary{ background:var(--md-tertiary-container); color:var(--md-on-tertiary-container); }
.va-chip-warn{ background:var(--md-warn-container); color:var(--md-on-warn-container);
  transition:filter var(--md-dur-short) var(--md-ease-standard); }
.va-chip-warn:hover{ filter:brightness(.96); }
.va-chip-plain{ background:var(--md-surface-container-high); color:var(--md-on-surface-variant); }

/* 数据源两态：正常态用 tertiary，兜底态用 warn */
.va-src-ic.is-warn{ background:var(--md-warn-container); color:var(--md-on-warn-container); }
.va-swbox{
  display:flex; align-items:center; gap:var(--md-s3); margin-top:var(--md-s3);
  padding-top:var(--md-s3); border-top:1px solid var(--md-outline-variant);
}
.va-sw-l{ flex:1 1 auto; min-width:0; font-size:var(--md-label-sm); line-height:1.45;
  color:var(--md-on-surface-variant); }
.va-sw{
  position:relative; flex:0 0 auto; width:44px; height:26px; border-radius:var(--md-sh-full);
  background:var(--md-surface-container-highest); box-shadow:inset 0 0 0 2px var(--md-outline);
  transition:background var(--md-dur-short) var(--md-ease-standard),
             box-shadow var(--md-dur-short) var(--md-ease-standard);
}
.va-sw i{
  position:absolute; top:50%; left:5px; width:16px; height:16px; margin-top:-8px;
  border-radius:var(--md-sh-full); background:var(--md-outline);
  transition:left var(--md-dur-med) var(--md-ease-emphasized),
             background var(--md-dur-short) var(--md-ease-standard);
}
.va-sw.is-on{ background:var(--md-warn-container); box-shadow:inset 0 0 0 2px var(--md-warn); }
.va-sw.is-on i{ left:23px; background:var(--md-warn); }

/* 工具条 */
.va-tools{ display:flex; gap:var(--md-s2); align-items:center; margin-bottom:var(--md-s3); }
.va-search{
  flex:1 1 auto; min-width:0; display:flex; align-items:center; gap:6px;
  height:34px; padding:0 10px; border-radius:var(--md-sh-full);
  background:var(--md-surface-container-high); color:var(--md-on-surface-variant);
}
.va-search .vp-ic{ width:15px; height:15px; }
.va-search input{
  flex:1 1 auto; min-width:0; border:0; background:transparent; outline:none;
  font-size:var(--md-body-sm); color:var(--md-on-surface);
}
.va-seg{
  display:flex; flex:0 0 auto; border:1px solid var(--md-outline-variant);
  border-radius:var(--md-sh-full); overflow:hidden;
}
.va-seg button{
  padding:0 9px; height:32px; font-size:var(--md-label-sm);
  color:var(--md-on-surface-variant); display:grid; place-items:center;
  transition:background var(--md-dur-short) var(--md-ease-standard);
}
.va-seg button:hover{ background:var(--md-surface-container-high); }
.va-seg button.is-on{ background:var(--md-secondary-container);
  color:var(--md-on-secondary-container); font-weight:var(--md-w-med); }

/* T型账列表 */
.va-tlist{ display:flex; flex-direction:column; gap:2px; }
.va-trow{
  display:grid; gap:5px; padding:10px var(--md-s3); border-radius:var(--md-sh-md);
  transition:background var(--md-dur-short) var(--md-ease-standard);
}
.va-trow:hover{ background:var(--md-surface-container); }
.va-t-l1{ display:flex; align-items:baseline; gap:9px; min-width:0; }
.va-tcode{ font-family:var(--md-mono); font-size:var(--md-label-md);
  color:var(--md-on-surface-variant); flex:0 0 auto; }
.va-tname{ font-size:var(--md-body-md); font-weight:var(--md-w-med); color:var(--md-on-surface);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.va-tn{ font-style:normal; font-size:var(--md-label-sm); color:var(--md-on-surface-variant);
  margin-left:auto; flex:0 0 auto; font-family:var(--md-mono); }
.va-t-l2{ display:flex; gap:var(--md-s3); }
.va-amt{ display:flex; align-items:baseline; gap:6px; flex:1 1 0; min-width:0; }
.va-amt i{ font-style:normal; font-size:var(--md-label-sm); color:var(--md-on-surface-variant); flex:0 0 auto; }
.va-amt b{ margin-left:auto; font-weight:var(--md-w-med); font-size:var(--md-title-sm);
  font-family:var(--md-mono); font-variant-numeric:tabular-nums; white-space:nowrap; }
.va-amt.d b{ color:var(--md-primary); }
.va-amt.l b{ color:var(--md-tertiary); }
.va-t-bar{ display:flex; height:2px; border-radius:2px; overflow:hidden;
  background:var(--md-surface-variant); margin-top:2px; }
.va-t-bar i{ background:var(--md-primary); }
.va-t-bar u{ background:var(--md-tertiary); }

/* 明细账 */
.va-brow{ border-radius:var(--md-sh-md); overflow:hidden; }
.va-bhead{
  width:100%; display:flex; align-items:center; gap:var(--md-s2);
  padding:10px var(--md-s2); border-radius:var(--md-sh-md);
  transition:background var(--md-dur-short) var(--md-ease-standard);
}
.va-bhead:hover{ background:var(--md-surface-container); }
.va-bhead .vp-ic{ width:16px; height:16px; color:var(--md-on-surface-variant);
  transition:transform var(--md-dur-med) var(--md-ease-standard); }
.va-bhead .vp-ic.va-chev{ transform:rotate(-90deg); }
.va-bhead.is-open .vp-ic.va-chev{ transform:rotate(0deg); }
.va-bcode{ font-family:var(--md-mono); font-size:var(--md-label-md);
  color:var(--md-on-surface-variant); }
.va-bname{ font-size:var(--md-body-md); font-weight:var(--md-w-med);
  flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.va-bcnt{ font-size:var(--md-label-sm); font-family:var(--md-mono); color:var(--md-on-surface-variant);
  flex:0 0 auto; white-space:nowrap; }
.va-bpages{ display:flex; flex-direction:column; padding:2px 0 var(--md-s2) 22px; }
.va-prow{
  width:100%; display:flex; align-items:center; gap:var(--md-s2);
  padding:8px var(--md-s3); border-radius:var(--md-sh-sm);
  transition:background var(--md-dur-short) var(--md-ease-standard);
}
.va-prow:hover{ background:var(--md-surface-container-high); }
.va-prow .va-bcode{ color:var(--md-on-surface-variant); }
.va-pname{ flex:1 1 auto; min-width:0; font-size:var(--md-body-md);
  color:var(--md-on-surface); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.va-prows{ font-size:var(--md-label-sm); font-family:var(--md-mono); color:var(--md-on-surface-variant);
  flex:0 0 auto; white-space:nowrap; }
.va-up{ color:var(--md-primary); }

/* 账页表格：三栏式账页。金额取整到元显示，摘要列因此有更宽的余量 */
.va-tbl-wrap{ overflow:auto; max-height:300px; border-radius:var(--md-sh-md);
  background:var(--md-surface-container-lowest); }
table.va-tbl{ table-layout:fixed; width:100%; font-size:var(--md-mono-sm); }
table.va-tbl col.c1{ width:42px; } table.va-tbl col.c2{ width:36px; }
table.va-tbl col.c3{ width:auto; }  table.va-tbl col.c4{ width:64px; }
table.va-tbl col.c5{ width:64px; }  table.va-tbl col.c6{ width:74px; }
table.va-tbl th{
  position:sticky; top:0; z-index:2; text-align:right; font-weight:var(--md-w-med);
  color:var(--md-on-surface-variant); font-size:var(--md-label-sm); letter-spacing:.02em;
  padding:8px 6px; background:var(--md-surface-container-high);
  font-family:var(--md-font); white-space:nowrap;
}
table.va-tbl th:first-child{ text-align:left; }
table.va-tbl td{
  padding:8px 6px; text-align:right; white-space:nowrap; overflow:hidden;
  font-variant-numeric:tabular-nums; color:var(--md-on-surface);
  border-top:1px solid var(--md-outline-variant);
}
table.va-tbl td:first-child{ text-align:left; }
table.va-tbl td.va-sum{ text-align:left; font-family:var(--md-font);
  overflow:hidden; text-overflow:ellipsis; }
tr.k-opening td{ color:var(--md-on-surface-variant); }
tr.k-monthTotal td, tr.k-yearTotal td{
  background:var(--md-surface-container); font-weight:var(--md-w-med);
}
tr.k-monthLine td, tr.k-yearLine td{ color:var(--md-on-surface-variant); }
.va-dir{ font-size:9px; color:var(--md-on-surface-variant); margin-left:2px; }

/* 待接入空态 */
.va-empty{ display:flex; flex-direction:column; align-items:center; text-align:center;
  gap:var(--md-s3); padding:var(--md-s8) var(--md-s5); }
.va-empty .vp-ic{ width:40px; height:40px; color:var(--md-on-surface-variant); opacity:.5; }
.va-empty b{ font-size:var(--md-title-md); line-height:var(--md-title-md-lh); font-weight:var(--md-w-med); }
.va-empty span{ font-size:var(--md-body-sm); line-height:1.7; color:var(--md-on-surface-variant); }

/* ---------- 异常态卡片（停止 / 部分失败 / 状态未知 / 可重试）---------- */
.va-an{
  display:flex; flex-direction:column; gap:var(--md-s3);
  border-radius:var(--md-sh-lg); padding:var(--md-s4);
  animation:va-in var(--md-dur-long) var(--md-ease-decel) both;
  animation-delay:calc(var(--i, 0) * 34ms);
}
.va-an.t-err{ background:var(--md-error-container); color:var(--md-on-error-container); }
.va-an.t-warn{ background:var(--md-warn-container); color:var(--md-on-warn-container); }
.va-an.t-unknown{ background:var(--md-surface-container-highest); color:var(--md-on-surface); }
.va-an-top{ display:flex; align-items:center; gap:var(--md-s3); }
.va-an-ic{ width:38px; height:38px; border-radius:var(--md-sh-full); flex:0 0 auto;
  display:grid; place-items:center; }
.va-an.t-err .va-an-ic{ background:var(--md-error); color:var(--md-on-error); }
.va-an.t-warn .va-an-ic{ background:var(--md-warn); color:var(--md-surface); }
.va-an.t-unknown .va-an-ic{ background:var(--md-outline-variant); color:var(--md-on-surface-variant); }
.va-an-tt{ min-width:0; flex:1 1 auto; }
.va-an-tt b{ display:block; font-size:var(--md-title-md); line-height:var(--md-title-md-lh); font-weight:var(--md-w-med); }
.va-an-tt em{ font-style:normal; display:block; font-size:var(--md-body-sm);
  line-height:1.6; opacity:.85; }
.va-an-nums{ display:flex; gap:var(--md-s5); }
.va-an-n{ display:flex; flex-direction:column; gap:1px; }
.va-an-n i{ font-style:normal; font-size:var(--md-label-sm); opacity:.75; }
.va-an-n b{ font-size:var(--md-title-lg); line-height:var(--md-title-lg-lh);
  font-family:var(--md-mono); font-variant-numeric:tabular-nums; font-weight:var(--md-w-med); }
.va-an-list{ display:flex; flex-direction:column;
  border-radius:var(--md-sh-md); background:rgba(255,255,255,.42); overflow:hidden; }
.va-an.t-unknown .va-an-list{ background:var(--md-surface-container-low); }
.va-an-li{ display:flex; align-items:center; gap:var(--md-s2);
  padding:7px var(--md-s3); font-size:var(--md-body-sm); }
.va-an-li + .va-an-li{ border-top:1px solid rgba(0,0,0,.09); }
.va-an-li .va-bcode{ font-size:var(--md-label-md); opacity:.85; }
.va-an-li span:nth-child(2){ flex:1 1 auto; min-width:0; overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap; }
.va-an-li i{ font-style:normal; font-family:var(--md-mono); font-size:var(--md-label-sm);
  font-variant-numeric:tabular-nums; opacity:.8; flex:0 0 auto; }
.va-an-li.is-bad{ color:var(--md-error); font-weight:var(--md-w-med); }
.va-an-li.is-bad .va-bcode{ color:inherit; }
.va-an-act{ display:flex; flex-wrap:wrap; gap:var(--md-s2); align-items:center; }
.va-an-tip{ font-size:var(--md-label-sm); opacity:.8; flex:1 1 auto; min-width:0; }
.va-btn-sm{
  height:36px; border-radius:var(--md-sh-full); display:inline-flex; align-items:center; gap:6px;
  padding:0 var(--md-s4); font-size:var(--md-label-md); font-weight:var(--md-w-med);
  background:var(--md-surface-container-lowest); color:var(--md-on-surface);
  box-shadow:inset 0 0 0 1px var(--md-outline-variant);
  transition:background var(--md-dur-short) var(--md-ease-standard);
}
.va-btn-sm:hover{ background:var(--md-surface-container); }
.va-btn-sm.is-danger{ background:var(--md-error); color:var(--md-on-error); box-shadow:none; }
.va-btn-sm.is-danger:hover{ filter:brightness(1.06); }
.va-btn-sm .vp-ic{ width:16px; height:16px; }

/* ---------- 执行控制 ---------- */
.va-run{
  flex:0 0 auto; display:flex; flex-direction:column; gap:var(--md-s2);
  padding:var(--md-s3) var(--md-s3) var(--md-s2);
  background:var(--md-surface-container-low);
  border-top:1px solid var(--md-outline-variant);
}
.va-run-row{ display:flex; align-items:center; gap:var(--md-s2); }
.va-field{
  width:54px; flex:0 0 auto; height:36px; border-radius:var(--md-sh-sm);
  border:1px solid var(--md-outline); background:transparent; text-align:center;
  font-family:var(--md-mono); font-size:var(--md-body-sm); color:var(--md-on-surface);
  outline:none; transition:border-color var(--md-dur-short) var(--md-ease-standard),
    box-shadow var(--md-dur-short) var(--md-ease-standard);
}
.va-field.va-m{ width:42px; }
.va-field:focus{ border-color:var(--md-primary);
  box-shadow:inset 0 0 0 1px var(--md-primary); }
.va-unit{ font-size:var(--md-label-sm); color:var(--md-on-surface-variant); margin-left:-3px; }
.va-btn-filled{
  flex:1 1 auto; min-width:0; height:44px; border-radius:var(--md-sh-full);
  display:flex; align-items:center; justify-content:center; gap:8px;
  padding:0 var(--md-s5); background:var(--md-primary); color:var(--md-on-primary);
  font-size:var(--md-title-sm); font-weight:var(--md-w-med); white-space:nowrap;
  box-shadow:var(--md-shadow-1);
  transition:box-shadow var(--md-dur-short) var(--md-ease-standard),
             filter var(--md-dur-short) var(--md-ease-standard);
}
.va-btn-filled:hover:not(:disabled){ box-shadow:var(--md-shadow-2); filter:brightness(1.05); }
.va-btn-filled:disabled{ opacity:.78; cursor:default;
  background:var(--md-surface-container-highest); color:var(--md-on-surface-variant);
  box-shadow:none; }
.va-btn-ghost{
  flex:0 0 auto; height:44px; border-radius:var(--md-sh-full);
  display:inline-flex; align-items:center; gap:6px; padding:0 var(--md-s4);
  color:var(--md-error); font-size:var(--md-label-lg); font-weight:var(--md-w-med);
  box-shadow:inset 0 0 0 1px var(--md-error);
  transition:background var(--md-dur-short) var(--md-ease-standard);
}
.va-btn-ghost span{ color:var(--md-error); }
.va-btn-ghost:hover{ background:var(--md-error-container); }
.va-btn-ghost .vp-ic{ width:17px; height:17px; }
.va-btn-stop{
  width:44px; height:44px; flex:0 0 auto; margin-left:auto;
  border-radius:var(--md-sh-full);
  display:grid; place-items:center; color:var(--md-error);
  transition:background var(--md-dur-short) var(--md-ease-standard);
}
.va-btn-stop:hover:not(:disabled){ background:var(--md-error-container); }
.va-btn-stop:disabled{ cursor:default; color:var(--md-on-surface-variant);
  opacity:.38; }
.va-spin{ animation:va-rot 1s linear infinite; }

/* ---------- MD3 对话框（清除确认 / 冲突裁决共用）---------- */
.va-scrim{
  position:absolute; inset:0; z-index:40; border-radius:var(--md-sh-xl);
  background:var(--md-scrim); opacity:0; pointer-events:none;
  transition:opacity var(--md-dur-med) var(--md-ease-standard);
}
.va-scrim.is-on{ opacity:var(--md-scrim-opacity); pointer-events:auto; }
.va-dlg{
  position:absolute; left:50%; top:50%; z-index:41;
  width:min(360px, calc(100% - 32px)); max-height:calc(100% - 32px);
  transform:translate(-50%,-46%) scale(.94); opacity:0; pointer-events:none;
  display:flex; flex-direction:column;
  background:var(--md-surface-container-high); color:var(--md-on-surface);
  border-radius:var(--md-sh-xl); box-shadow:var(--md-shadow-5);
  transition:opacity var(--md-dur-med) var(--md-ease-standard),
             transform var(--md-dur-long) var(--md-ease-emphasized);
}
.va-dlg.is-on{ opacity:1; pointer-events:auto; transform:translate(-50%,-50%) scale(1); }
.va-dlg--wide{ width:min(420px, calc(100% - 32px)); }
.va-dlg-c{ padding:var(--md-s5) var(--md-s5) var(--md-s4); overflow-y:auto; }
.va-dlg-row{ display:flex; align-items:center; gap:var(--md-s3); margin-bottom:var(--md-s3); }
.va-dlg-ic{
  width:38px; height:38px; border-radius:var(--md-sh-full); flex:0 0 auto;
  display:grid; place-items:center;
  background:var(--md-error); color:var(--md-on-error);
}
.va-dlg-ic.t-warn{ background:var(--md-warn-container); color:var(--md-on-warn-container); }
.va-dlg h2{ font-size:var(--md-title-lg); line-height:var(--md-title-lg-lh);
  font-weight:var(--md-w-med); margin:0; }
.va-dlg p{ margin:0; font-size:var(--md-body-md); line-height:1.65;
  color:var(--md-on-surface-variant); }
.va-dlg ul{ margin:var(--md-s3) 0 0; display:flex; flex-direction:column; gap:2px; }
.va-dlg li{ display:flex; align-items:center; gap:var(--md-s2);
  font-size:var(--md-body-sm); line-height:1.9;
  font-family:var(--md-mono); font-variant-numeric:tabular-nums; }
.va-dlg li i{ font-style:normal; font-family:var(--md-font); flex:1 1 auto; min-width:0;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.va-dlg-act{ display:flex; justify-content:flex-end; gap:var(--md-s2);
  padding:0 var(--md-s4) var(--md-s4); flex-wrap:wrap; }
.va-dlg-act button{
  height:40px; border-radius:var(--md-sh-full); padding:0 var(--md-s5);
  font-size:var(--md-label-lg); font-weight:var(--md-w-med); white-space:nowrap;
  display:inline-flex; align-items:center; gap:6px;
  transition:background var(--md-dur-short) var(--md-ease-standard);
}
.va-dlg-talk{ color:var(--md-primary); }
.va-dlg-talk:hover{ background:var(--md-surface-container-highest); }
.va-dlg-danger{ background:var(--md-error); color:var(--md-on-error); }
.va-dlg-danger:hover{ filter:brightness(1.06); }
.va-dlg-ok{ background:var(--md-primary); color:var(--md-on-primary); }
.va-dlg-ok:hover{ filter:brightness(1.06); }
.va-dlg .vp-ic{ width:17px; height:17px; }

/* ---------- 底部日志抽屉 ---------- */
.va-drawer{
  flex:0 0 auto; height:44px; overflow:hidden;
  background:var(--md-surface-container-high);
  transition:height var(--md-dur-med) var(--md-ease-standard);
}
.va-drawer.is-open{ height:236px; }
.va-handle{
  width:100%; height:44px; display:flex; align-items:center; gap:var(--md-s2);
  padding:0 var(--md-s3);
}
.va-hdot{ width:9px; height:9px; border-radius:var(--md-sh-full); flex:0 0 auto;
  background:var(--md-on-surface-variant); }
.va-hdot.ok{ background:var(--md-primary); }
.va-hdot.warn{ background:var(--md-warn); }
.va-hdot.err{ background:var(--md-error); }
.va-htitle{ font-size:var(--md-label-md); font-weight:var(--md-w-med); flex:0 0 auto; }
.va-hmsg{ flex:1 1 auto; min-width:0; font-size:var(--md-label-md);
  color:var(--md-on-surface-variant); white-space:nowrap; overflow:hidden;
  text-overflow:ellipsis; }
.va-hpct{ font-family:var(--md-mono); font-size:var(--md-label-sm);
  color:var(--md-on-surface-variant); flex:0 0 auto; }
.va-handle .vp-ic{ color:var(--md-on-surface-variant); flex:0 0 auto;
  transition:transform var(--md-dur-med) var(--md-ease-standard); }
.va-progress{ height:3px; background:var(--md-surface-variant); overflow:hidden; }
.va-progress i{ display:block; height:100%; background:var(--md-primary);
  transition:width var(--md-dur-med) var(--md-ease-standard); }
.va-logbox{ height:190px; overflow-y:auto; padding:var(--md-s2) var(--md-s3) var(--md-s3); }
.va-log{
  display:flex; gap:8px; align-items:flex-start; padding:3px 0;
  font-family:var(--md-mono); font-size:var(--md-label-md); line-height:1.6;
  color:var(--md-on-surface-variant); animation:va-in var(--md-dur-med) var(--md-ease-decel) both;
}
.va-log i{ font-style:normal; flex:0 0 auto; opacity:.6; font-size:var(--md-label-sm); padding-top:3px; }
.va-log svg{ width:14px; height:14px; flex:0 0 auto; margin-top:2px; }
.va-log span{ min-width:0; word-break:break-word; }
.va-log.k-info svg{ color:var(--md-on-surface-variant); }
.va-log.k-ok svg{ color:var(--md-primary); }
.va-log.k-ok{ color:var(--md-on-surface); }
.va-log.k-warn svg{ color:var(--md-warn); }
.va-log.k-warn span{ color:var(--md-warn); }
.va-log.k-unknown svg{ color:var(--md-outline); }
.va-log.k-unknown span{ color:var(--md-on-surface-variant); }
.va-log.k-err svg{ color:var(--md-error); }
.va-log.k-err span{ color:var(--md-error); }
.va-log.lv1{ padding-left:14px; }

@keyframes va-in{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:none; } }
@keyframes va-rot{ to{ transform:rotate(360deg); } }
@keyframes va-pulse{ 0%,100%{ opacity:1; transform:scale(1); }
  50%{ opacity:.45; transform:scale(.78); } }
`;

  /* --------------------------------------------------------- 注册 */
  window.VP.register('A', '左侧导航 · 工作台式', {
    mount: function (host, ctx) {
      var fx = (ctx && ctx.fx) || {};
      var api = (ctx && ctx.api) || { log: function () {}, setState: function () {} };
      var tacc = fx.taccounts || [];
      var books = fx.books || {};
      var bookKeys = fx.bookKeys || [];
      var sample = fx.sample || {};
      var tmap = {};
      tacc.forEach(function (t) { tmap[t.code] = t.name; });

      var S = {
        collapsed: false, section: 'taccount', q: '', sort: 'code',
        open: {}, page: null, theme: 'system',
        // 数据源状态。false = primary（教师答案实时可用，正常路径）；true = fallback（接口未开放，回退仓库快照）
        // 默认落在 primary：兜底态是异常路径，默认显示它会让人误以为系统坏了。
        fallback: false,
        y: fx.year || '2020', m: fx.month || '1',
        busy: false, progress: 0, logs: [], drawer: false,
        // 异常态：null | 'stopped' | 'partial' | 'unknown' | 'retry'，
        // 以及「清除/重置」与冲突裁决（写前普查）的界面状态
        anomaly: null, dlg: null, cleared: false, retried: {}
      };
      var timers = [];
      var refs = {};
      var resumeRun = null;   // 冲突裁决挂起后，用来接着跑剩余步骤

      /* ---------------- 日志 ---------------- */
      function pushLog(kind, msg, lv) {
        S.logs.push({ k: kind, m: msg, lv: lv || 0 });
        if (S.logs.length > 140) S.logs.shift();
        api.log(msg, kind);
      }
      function clearTimers() { timers.forEach(clearTimeout); timers = []; }

      /* ---------------- 骨架 ---------------- */
      var style = document.createElement('style');
      style.textContent = CSS;
      host.appendChild(style);

      var shell = document.createElement('div');
      shell.className = 'va-shell';
      shell.setAttribute('data-collapsed', 'false');
      shell.innerHTML = `
<div class="va-frame">
  <button class="va-rail" data-act="expand" title="展开登账助手" aria-label="展开登账助手">
    <span class="va-rail-dot"></span>
    <span class="va-rail-ticks"><i></i><i></i><i></i></span>
    ${ic('left2')}
  </button>
  <div class="va-win">
    <aside class="va-nav" aria-label="环节">
      <span class="va-mark" title="登账助手">${ic('bookmark')}</span>
      <div class="va-navlist" data-ref="nav"></div>
    </aside>
    <main class="va-main">
      <header class="va-appbar" data-ref="appbar"></header>
      <div class="va-body vp-scroll" data-ref="body"></div>
      <div class="va-run" data-ref="run"></div>
      <section class="va-drawer" data-ref="drawer"></section>
    </main>
    <div class="va-scrim" data-ref="scrim" data-act="dlg-cancel"></div>
    <div class="va-dlg" data-ref="dlg" role="dialog" aria-modal="true"></div>
  </div>
</div>`;
      host.appendChild(shell);
      shell.querySelectorAll('[data-ref]').forEach(function (n) { refs[n.dataset.ref] = n; });

      /* ---------------- 导航（仅图标：title + aria-label 承担可访问性）---------------- */
      function navHTML() {
        return SECTIONS.map(function (s, i) {
          var label = s.label + (s.ready ? '' : ' · 待接入');
          return `<button class="va-navitem${s.ready ? '' : ' is-off'}" data-act="goto" data-sec="${s.id}"
  style="--i:${i}" title="${label}" aria-label="${label}"${s.id === S.section ? ' aria-current="true"' : ''}>
  ${ic(s.icon)}${s.ready ? '' : '<span class="va-navdot"></span>'}
</button>`;
        }).join('');
      }
      function renderNav() {
        refs.nav.innerHTML = navHTML();
      }
      renderNav();

      /* ---------------- App Bar ---------------- */
      var THEME_SEQ = [
        { id: 'system', label: '自动', icon: 'auto' },
        { id: 'light', label: '浅色', icon: 'light' },
        { id: 'dark', label: '深色', icon: 'dark' }
      ];
      function titleOf() {
        if (S.page && S.section === 'detail') {
          var pg = S.page;
          var rws = sample[pg];
          return ['明细账 ' + pg + ' · ' + (pgName(pg) || '账页'),
            rws ? rws.length + ' 行' : (S.fallback ? '快照缺该页' : '未取到行')];
        }
        var sec = SECTIONS.filter(function (s) { return s.id === S.section; })[0] || SECTIONS[0];
        var sub = {
          taccount: tacc.length + ' 科目 · ' + S.y + '-' + S.m,
          detail: bookKeys.length + ' 账簿 · ' + (fx.detailAccountCount || 173) + ' 账页',
          journal: '待接入',
          summary: '待接入',
          ledger: '待接入',
          report: '待接入'
        }[S.section];
        return [sec.label, sub];
      }
      function renderAppBar() {
        var t = titleOf();
        var cur = THEME_SEQ.filter(function (x) { return x.id === S.theme; })[0] || THEME_SEQ[0];
        refs.appbar.innerHTML = `
${S.page ? `<button class="va-icbtn" data-act="page-back" title="返回账簿列表" aria-label="返回账簿列表">${ic('left')}</button>` : ''}
<div class="va-titles">
  <h1>${esc(t[0])}</h1>
  <p>${esc(t[1])}</p>
</div>
<button class="va-icbtn" data-act="theme" title="主题：${cur.label}（点击切换）" aria-label="主题：${cur.label}">${ic(cur.icon)}</button>
<button class="va-icbtn" data-act="collapse" title="收起面板" aria-label="收起面板">${ic('right')}</button>`;
      }

      /* ---------------- 数据源卡 ---------------- */
      /* 数据源两态的唯一文案真源：切态时本卡、账页提示、执行日志全部从这里取词。 */
      function srcText() {
        var ent = fx.entity || '';
        var ym = S.y + '年' + S.m + '月';
        return S.fallback
          ? {
            title: '仓库内置快照',
            meta: SNAP_ID,
            head: '接口未开放 · 按快照口径',
            chip1: '兜底快照 · ' + SNAP_ID,
            chip2: '非实时'
          }
          : {
            title: '教师答案 · 实时',
            meta: ym,
            head: '接口连通 · 实时读取',
            chip1: '教师答案 · ' + ym,
            chip2: '实时 · 无缓存'
          };
      }
      function srcCard() {
        var T = srcText();
        return `
<section class="va-card" style="--i:0">
  <div class="va-src-top">
    <span class="va-src-ic${S.fallback ? ' is-warn' : ''}">${ic(S.fallback ? 'warn' : 'verified')}</span>
    <div class="va-src-txt">
      <b>${esc(T.title)}</b>
      <em class="va-meta-inline">${esc(fx.entity || '')} · ${esc(T.meta)}</em>
    </div>
    <span class="va-chip ${S.fallback ? 'va-chip-warn' : 'va-chip-tertiary'}">${esc(T.head)}</span>
  </div>
  <div class="va-chips">
    <span class="va-chip va-chip-plain">${esc(T.chip1)}</span>
    <span class="va-chip va-chip-plain">${esc(T.chip2)}</span>
  </div>
  <div class="va-swbox">
    <span class="va-sw-l">模拟：教师答案未开放</span>
    <button class="va-sw${S.fallback ? ' is-on' : ''}" data-act="flip" role="switch"
      aria-checked="${S.fallback ? 'true' : 'false'}"
      title="${S.fallback ? '切换为：教师答案实时可用' : '切换为：教师答案未开放 · 仓库快照兜底'}">
      <i></i><span class="vp-sr">模拟教师答案未开放</span>
    </button>
  </div>
</section>`;
      }

      /* ---------------- 异常态（常驻可见，可用运行控制里的演示入口触发）----------------
         四档：停止 / 部分失败（成功N 失败M 跳过K）/ 状态未知 / 失败可重试。
         状态未知单独用中性色：查询失败 ≠ 平台是空的，不能一律当红。 */
      function anHTML(i) {
        var a = S.anomaly;
        if (!a) return '';
        var W = { err: 't-err', warn: 't-warn', unknown: 't-unknown' };
        if (a === 'stopped') {
          return `<section class="va-an t-warn" style="--i:${i}">
  <div class="va-an-top">
    <span class="va-an-ic">${ic('stop')}</span>
    <span class="va-an-tt"><b>已停止</b><em>已完成保留 · 未开始未动</em></span>
  </div>
  <div class="va-an-nums">
    <span class="va-an-n"><i>已完成</i><b>18</b></span>
    <span class="va-an-n"><i>未开始</i><b>27</b></span>
  </div>
  <div class="va-an-act">
    <span class="va-an-tip">想撤回只能走「清除」</span>
    <button class="va-btn-sm" data-act="an-run">${ic('play')}继续登账</button>
  </div>
</section>`;
        }
        if (a === 'partial') {
          var all = [
            ['100202', '农业银行人民币户', '写超时'],
            ['2202', '应付账款', '读回校验不匹配'],
            ['660102', '管理费用 · 办公费', '行号未匹配']
          ];
          var bad = all.filter(function (b) { return !S.retried[b[0]]; });
          var doneN = 3 - bad.length;
          return `<section class="va-an t-err" style="--i:${i}">
  <div class="va-an-top">
    <span class="va-an-ic">${ic('warn')}</span>
    <span class="va-an-tt"><b>部分失败</b><em>可只重试失败项</em></span>
  </div>
  <div class="va-an-nums">
    <span class="va-an-n"><i>成功</i><b>${170 + doneN}</b></span>
    <span class="va-an-n"><i>失败</i><b>${bad.length}</b></span>
    <span class="va-an-n"><i>跳过</i><b>2</b></span>
  </div>
  <div class="va-an-list">${bad.map(function (b) {
    return `<div class="va-an-li">
    <b class="va-bcode">${b[0]}</b><span>${b[1]}</span><i>${b[2]}</i>
    <button class="va-btn-sm" data-act="an-retry" data-code="${b[0]}">${ic('retry')}重试</button>
  </div>`;
  }).join('') || '<div class="va-an-li"><span>失败项已全部重试成功</span></div>'}</div>
  ${bad.length ? `<div class="va-an-act">
    <span class="va-an-tip">失败项仍保持原值</span>
    <button class="va-btn-sm" data-act="an-retry" data-code="*">${ic('retry')}重试全部失败</button>
  </div>` : ''}
</section>`;
        }
        if (a === 'unknown') {
          return `<section class="va-an t-unknown" style="--i:${i}">
  <div class="va-an-top">
    <span class="va-an-ic">${ic('help')}</span>
    <span class="va-an-tt"><b>状态未知</b><em>查询失败 · 不等于平台为空</em></span>
  </div>
  <div class="va-an-nums">
    <span class="va-an-n"><i>状态未知</i><b>6</b></span>
  </div>
  <div class="va-an-list">${['1001', '1002', '1122', '2202', '6602', '6603'].map(function (c) {
    return `<div class="va-an-li"><b class="va-bcode">${c}</b><span>${esc(tmap[c] || '')}</span><i>状态未知</i></div>`;
  }).join('')}</div>
  <div class="va-an-act">
    <span class="va-an-tip">本轮不写这些科目</span>
    <button class="va-btn-sm" data-act="an-query">${ic('retry')}重新查询</button>
  </div>
</section>`;
        }
        var need = String((S.page && S.page.length === 6) ? S.page : '100202');
        return `<section class="va-an ${W.err}" style="--i:${i}">
  <div class="va-an-top">
    <span class="va-an-ic">${ic('err')}</span>
    <span class="va-an-tt"><b>写入失败</b><em>可重试</em></span>
  </div>
  <div class="va-an-list"><div class="va-an-li">
    <b class="va-bcode">${esc(need)}</b><span>${esc(pgName(need) || '该页')}</span><i>写超时</i>
  </div></div>
  <div class="va-an-act">
    <span class="va-an-tip">该页保持原值</span>
    <button class="va-btn-sm" data-act="an-retry" data-code="${esc(need)}">${ic('retry')}重试</button>
  </div>
</section>`;
      }

      /* ---------------- T型账 ---------------- */
      function tRows() {
        var q = S.q.trim().toLowerCase();
        var list = tacc.filter(function (t) {
          return !q || t.code.indexOf(q) >= 0 || String(t.name).toLowerCase().indexOf(q) >= 0;
        });
        list = list.slice().sort(function (a, b) {
          if (S.sort === 'd') return b.d - a.d;
          if (S.sort === 'l') return b.l - a.l;
          if (S.sort === 'n') return b.n - a.n;
          return a.code < b.code ? -1 : 1;
        });
        if (!list.length) return `<p class="va-empty"><span>没有匹配的科目</span></p>`;
        return '<div class="va-tlist">' + list.map(function (t) {
          var tot = t.d + t.l, dp = tot > 0 ? (t.d / tot * 100) : 50;
          return `<button class="va-trow" data-act="tk" data-code="${t.code}">
  <span class="va-t-l1"><b class="va-tcode">${t.code}</b><span class="va-tname">${esc(t.name)}</span><i class="va-tn">${t.n} 笔</i></span>
  <span class="va-t-l2">
    <span class="va-amt d"><i>借</i><b>${moneyY(t.d) || '—'}</b></span>
    <span class="va-amt l"><i>贷</i><b>${moneyY(t.l) || '—'}</b></span>
  </span>
  <span class="va-t-bar"><i style="width:${dp.toFixed(1)}%"></i><u style="width:${(100 - dp).toFixed(1)}%"></u></span>
</button>`;
        }).join('') + '</div>';
      }
      function viewTaccount() {
        var td = tacc.reduce(function (a, t) { return a + t.d; }, 0);
        var tl = tacc.reduce(function (a, t) { return a + t.l; }, 0);
        return `
${anHTML(1)}
<section class="va-card" style="--i:2">
  <div class="va-card-head">
    <h2>科目余额</h2>
    <span class="va-meta">${tacc.length} 个</span>
  </div>
  <div class="va-tools">
    <span class="va-search">${ic('search')}<input data-act="q" type="text" placeholder="科目码 / 名称" value="${esc(S.q)}" aria-label="筛选科目"></span>
    <span class="va-seg">
      <button data-act="sort" data-v="code" class="${S.sort === 'code' ? 'is-on' : ''}" title="按科目码">码</button>
      <button data-act="sort" data-v="d" class="${S.sort === 'd' ? 'is-on' : ''}" title="按借方合计降序">借</button>
      <button data-act="sort" data-v="l" class="${S.sort === 'l' ? 'is-on' : ''}" title="按贷方合计降序">贷</button>
      <button data-act="sort" data-v="n" class="${S.sort === 'n' ? 'is-on' : ''}" title="按笔数降序">笔</button>
    </span>
  </div>
  <div class="va-t-l2" style="padding:0 var(--md-s3) 8px;border-bottom:1px solid var(--md-outline-variant)">
    <span class="va-amt d"><i>借方合计</i><b>${moneyY(td) || '—'}</b></span>
    <span class="va-amt l"><i>贷方合计</i><b>${moneyY(tl) || '—'}</b></span>
  </div>
  ${tRows()}
</section>`;
      }

      /* ---------------- 明细账 ---------------- */
      function pgName(code) {
        return tmap[code] || (books[code] && books[code][0] && books[code][0].name) || '';
      }
      function viewDetail() {
        var pages = bookKeys.reduce(function (a, k) { return a + (books[k] || []).length; }, 0);
        var rows = bookKeys.reduce(function (a, k) {
          return a + (books[k] || []).reduce(function (b, p) { return b + p.rows; }, 0);
        }, 0);
        return `
${anHTML(1)}
<section class="va-card" style="--i:2">
  <div class="va-card-head">
    <h2>账簿 · 账页</h2>
    <span class="va-meta">${bookKeys.length} 本 / ${pages} 页 / ${rows} 行</span>
  </div>
  ${bookKeys.map(function (k) {
    var open = !!S.open[k];
    var ps = books[k] || [];
    return `<div class="va-brow">
  <button class="va-bhead${open ? ' is-open' : ''}" data-act="togg" data-key="${k}">
    ${ic('down', 'va-chev')}
    <span class="va-bcode">${k}</span>
    <span class="va-bname">${esc(pgName(k))}</span>
    <span class="va-bcnt">${ps.length} 页</span>
  </button>
  ${open ? `<div class="va-bpages">${ps.map(function (p) {
      return `<button class="va-prow" data-act="page" data-code="${p.code}">
    <span class="va-bcode">${p.code}</span>
    <span class="va-pname">${esc(p.name)}</span>
    <span class="va-prows">${p.rows ? p.rows + ' 行' : '空'}</span>
  </button>`;
    }).join('')}</div>` : ''}
</div>`;
  }).join('')}
</section>`;
      }
      function viewPage() {
        var rows = sample[S.page];
        var nm = pgName(S.page);
        if (!rows) {
          return `<section class="va-card" style="--i:1">
  <div class="va-empty">
    ${ic('help')}
    <b>${S.fallback ? '快照未含 ' + esc(S.page) : '未取到 ' + esc(S.page) + ' 的行'}</b>
    <span>${S.fallback
      ? '该快照只含 1001 / 100201 两页。'
      : '该页本次为空 · 可重试或切兜底快照'}</span>
    <span class="va-chip va-chip-plain">${ic(S.fallback ? 'warn' : 'verified')}${S.fallback ? '兜底快照 · ' + SNAP_ID : '实时读取'}</span>
  </div>
</section>`;
        }
        var body = rows.map(function (r) {
          var isLine = r.k === 'monthLine' || r.k === 'yearLine';
          return `<tr class="k-${r.k}">
  <td>${isLine ? '' : r.mm + '-' + r.dd}</td>
  <td>${isLine ? '' : (r.t === '记' ? '记' + r.no : r.t)}</td>
  <td class="va-sum">${esc(r.sum)}</td>
  <td>${yuan(r.d)}</td>
  <td>${yuan(r.l)}</td>
  <td>${isLine ? '' : yuan(r.bal)}${r.dir ? `<span class="va-dir">${r.dir}</span>` : ''}</td>
</tr>`;
        }).join('');
        return `
${anHTML(1)}
<section class="va-card" style="--i:2">
  <div class="va-card-head">
    <h2>${esc(S.page)} ${esc(nm)}</h2>
    <span class="va-meta">${rows.length} 行</span>
  </div>
  <div class="va-tbl-wrap vp-scroll">
    <table class="va-tbl">
      <colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5"><col class="c6"></colgroup>
      <thead><tr><th>月-日</th><th>凭证</th><th>摘要</th><th>借方</th><th>贷方</th><th>余额</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>
</section>`;
      }

      /* ---------------- 待接入 ---------------- */
      function viewPending(sec) {
        return `
<section class="va-card" style="--i:1">
  <div class="va-empty">
    ${ic(sec.icon)}
    <b>${sec.label} · 待接入</b>
    <span>仅 T型账 / 明细账 已通</span>
    <span class="va-chip va-chip-warn">${ic('warn')}不影响已接入环节</span>
  </div>
</section>`;
      }

      /* ---------------- body ---------------- */
      function renderBody() {
        var sec = SECTIONS.filter(function (s) { return s.id === S.section; })[0] || SECTIONS[0];
        var inner;
        if (S.section === 'taccount') inner = viewTaccount();
        else if (S.section === 'detail') inner = S.page ? viewPage() : viewDetail();
        else inner = viewPending(sec);
        refs.body.innerHTML = srcCard() + inner;
        refs.body.scrollTop = 0;
        var qi = refs.body.querySelector('[data-act="q"]');
        if (qi && S.q) { qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); }
      }

      /* ---------------- 执行控制 ---------------- */
      function renderRun() {
        refs.run.innerHTML = `
<div class="va-run-row">
  <input class="va-field" data-act="y" value="${esc(S.y)}" inputmode="numeric" title="年份" aria-label="年份">
  <span class="va-unit">年</span>
  <input class="va-field va-m" data-act="m" value="${esc(S.m)}" inputmode="numeric" title="月份" aria-label="月份">
  <span class="va-unit">月</span>
  <button class="va-btn-ghost" data-act="clear-open" title="清空平台已登记的 T型账行">
    ${ic('clear')}<span>清除</span>
  </button>
  <button class="va-btn-stop" data-act="stop" ${S.busy ? '' : 'disabled'} title="停止" aria-label="停止">${ic('stop')}</button>
</div>
<button class="va-btn-filled" data-act="run" ${S.busy ? 'disabled' : ''}>
  ${S.busy
    ? `<svg class="vp-ic va-spin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="40 17" stroke-linecap="round"/></svg><span>登账中</span>`
    : `${ic('play')}<span>按教师答案登账</span>`}
</button>
<div class="va-run-row">
  <span class="va-sw-l">异常演示</span>
  <span class="va-seg">
    <button data-act="demo" data-v="stopped" class="${S.anomaly === 'stopped' ? 'is-on' : ''}" title="演示：运行中中断">停止</button>
    <button data-act="demo" data-v="partial" class="${S.anomaly === 'partial' ? 'is-on' : ''}" title="演示：部分失败">部分失败</button>
    <button data-act="demo" data-v="unknown" class="${S.anomaly === 'unknown' ? 'is-on' : ''}" title="演示：状态未知">未知</button>
    <button data-act="demo" data-v="retry" class="${S.anomaly === 'retry' ? 'is-on' : ''}" title="演示：单页失败可重试">重试</button>
    <button data-act="demo" data-v="" class="${S.anomaly ? '' : 'is-on'}" title="清除异常演示">复位</button>
  </span>
</div>`;
      }

      /* ---------------- MD3 对话框：清除二次确认 + 冲突裁决 ---------------- */
      function renderDlg() {
        var d = S.dlg;
        var scrim = refs.scrim, box = refs.dlg;
        if (!d) {
          scrim.classList.remove('is-on');
          box.classList.remove('is-on');
          box.innerHTML = '';
          return;
        }
        scrim.classList.add('is-on');
        box.classList.add('is-on');
        if (d === 'clear') {
          box.className = 'va-dlg is-on';
          box.innerHTML = `
<div class="va-dlg-c">
  <div class="va-dlg-row">
    <span class="va-dlg-ic">${ic('clear')}</span>
    <h2>清除平台 T型账？</h2>
  </div>
  <p>扫描平台全部总账科目，把已登记行清掉。<br>平台无事务、无回滚，<b>不可撤销</b>。</p>
</div>
<div class="va-dlg-act">
  <button class="va-dlg-talk" data-act="dlg-cancel">取消</button>
  <button class="va-dlg-danger" data-act="clear-do">${ic('clear')}清除全部</button>
</div>`;
          return;
        }
        /* 冲突裁决：写前普查发现「平台有行但不匹配 / 状态未知 / 计划外科目」 */
        box.className = 'va-dlg va-dlg--wide is-on';
        box.innerHTML = `
<div class="va-dlg-c">
  <div class="va-dlg-row">
    <span class="va-dlg-ic t-warn">${ic('warn')}</span>
    <h2>发现 3 个冲突科目</h2>
  </div>
  <p>平台已有行，与本轮计划不匹配。可清掉它们再写，或跳过它们。</p>
  <ul>${CONFLICTS.map(function (c) {
    return `<li><b>${c.code}</b><i>${esc(c.name)}</i><span>${c.plat} 行 / 计划 ${c.plan} 行</span></li>`;
  }).join('')}</ul>
  <ul>
    <li><b>另有</b><i>2 个计划外科目已有数据（共 36 行）</i><span>本轮不动</span></li>
    <li><b>另有</b><i>1 个科目状态未知</i><span>本轮不写</span></li>
  </ul>
</div>
<div class="va-dlg-act">
  <button class="va-dlg-talk" data-act="dlg-cancel">停止</button>
  <button class="va-dlg-talk" data-act="conflict-skip">${ic('skip')}跳过它们</button>
  <button class="va-dlg-danger" data-act="conflict-clear">${ic('clear')}清掉再写</button>
</div>`;
      }

      /* ---------------- 日志抽屉 ---------------- */
      function renderDrawer() {
        var last = S.logs[S.logs.length - 1] || { k: 'info', m: '待运行' };
        var open = S.drawer;
        refs.drawer.className = 'va-drawer' + (open ? ' is-open' : '');
        refs.drawer.innerHTML = `
<button class="va-handle" data-act="drawer" title="${open ? '收起日志' : '展开日志'}">
  <span class="va-hdot ${last.k}"></span>
  <span class="va-htitle">日志</span>
  <span class="va-hmsg">${esc(last.m)}</span>
  <span class="va-hpct">${S.progress}%</span>
  ${ic(open ? 'down' : 'up', 'va-chev')}
</button>
<div class="va-progress"><i style="width:${S.progress}%"></i></div>
<div class="va-logbox vp-scroll" data-ref="logbox">
  ${S.logs.map(function (l, i) {
    var ico = { info: 'info', ok: 'ok', warn: 'warn', err: 'err', unknown: 'help' }[l.k] || 'info';
    return `<div class="va-log k-${l.k}${l.lv ? ' lv' + l.lv : ''}">
      <i>${String(i + 1).padStart(2, '0')}</i>${ic(ico)}<span>${esc(l.m)}</span></div>`;
  }).join('')}
</div>`;
        var box = refs.drawer.querySelector('[data-ref="logbox"]');
        if (box) box.scrollTop = box.scrollHeight;
      }

      function render() {
        shell.setAttribute('data-collapsed', S.collapsed ? 'true' : 'false');
        shell.setAttribute('data-page', S.page ? 'true' : 'false');
        shell.querySelector('.va-rail').classList.toggle('is-busy', S.busy);
        renderAppBar();
        renderBody();
        renderRun();
        renderDrawer();
        renderDlg();
        refs.nav.querySelectorAll('.va-navitem').forEach(function (b) {
          var on = b.dataset.sec === S.section;
          b.classList.toggle('is-active', on);
          if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
        });
      }

      /* ---------------- 演示运行序列 ---------------- */
      function applyTheme() {
        document.documentElement.setAttribute('data-theme', S.theme);
      }
      function runSequence() {
        if (S.busy) return;
        S.busy = true; S.progress = 0; S.drawer = true; S.logs = [];
        S.anomaly = null; S.retried = {}; S.conflict = false; resumeRun = null;
        api.setState({ busy: true });
        var i = 0;
        function step() {
          var k = STEPS[i][0];
          var m = STEPS[i][1].replace('{Y}', S.y).replace('{M}', S.m);
          pushLog(k, m, STEPS[i][2]);
          if (STEPS[i][1].indexOf('100202 写入失败') >= 0) S.anomaly = 'retry';
          i++;
          S.progress = Math.round(i / STEPS.length * 100);
          render();
          if (i < STEPS.length) {
            timers.push(setTimeout(function () {
              // 走到「冲突裁决」这一步就真的停下来等用户裁决，不静默跳过
              if (i === 4 && !S.conflict) {
                S.conflict = true;
                pushLog('warn', '写前普查发现冲突 · 待裁决', 1);
                S.dlg = 'conflict';
                resumeRun = step;
                render();
              } else step();
            }, 420));
          } else { clearTimers(); S.busy = false; api.setState({ busy: false }); render(); }
        }
        render();
        timers.push(setTimeout(step, 260));
      }
      function stopSequence() {
        clearTimers();
        pushLog('warn', '已停止 · 已完成保留，未开始原值未动', 0);
        S.anomaly = 'stopped';
        S.busy = false; api.setState({ busy: false });
        render();
      }
      /* 清除：独立的重置入口，与「按教师答案登账」互不相干，且必须二次确认 */
      function clearAll() {
        S.dlg = null;
        S.cleared = true;
        S.anomaly = null;
        S.logs = [];
        pushLog('ok', '清空 T型账 · 已清 42 科目', 0);
        pushLog('warn', '原本已是 0 行 3 个 · 未清干净 0 个', 1);
        render();
      }
      /* 冲突裁决结果 */
      function conflictChoice(v) {
        S.dlg = null;
        if (v === 'clear') {
          pushLog('warn', '已清掉 3 个冲突科目 · 继续写入', 1);
          var go = resumeRun;
          resumeRun = null;
          if (go) { render(); timers.push(setTimeout(go, 60)); return; }
        } else if (v === 'skip') {
          pushLog('warn', '跳过 3 个冲突科目 · 其余照写', 1);
          S.anomaly = 'partial';
        } else {
          pushLog('info', '已停止 · 一个字没写', 1);
          S.anomaly = 'stopped';
        }
        clearTimers();
        S.busy = false; api.setState({ busy: false });
        S.progress = v === 'stop' ? S.progress : 100;
        render();
      }

      /* ---------------- 事件 ---------------- */
      function onClick(e) {
        var el = e.target.closest('[data-act]');
        if (!el) return;
        var act = el.dataset.act;
        /* 对话框打开时只响应框内动作，避免误触后面的登账入口 */
        if (S.dlg && !el.closest('.va-dlg') && act !== 'dlg-cancel') return;
        if (act === 'collapse') { S.collapsed = true; render(); return; }
        if (act === 'expand') { S.collapsed = false; render(); return; }
        if (act === 'theme') {
          var idx = THEME_SEQ.map(function (x) { return x.id; }).indexOf(S.theme);
          S.theme = THEME_SEQ[(idx + 1) % THEME_SEQ.length].id;
          applyTheme();
          render();
          return;
        }
        if (act === 'drawer') { S.drawer = !S.drawer; render(); return; }
        if (act === 'flip') {
          S.fallback = !S.fallback;
          pushLog(S.fallback ? 'warn' : 'ok', S.fallback
            ? '接口未开放 · 回退仓库快照 ' + SNAP_ID
            : '接口连通 · 实时读取');
          render();
          return;
        }
        if (act === 'goto') {
          var sec = SECTIONS.filter(function (s) { return s.id === el.dataset.sec; })[0];
          S.section = sec.id; S.page = null;
          if (!sec.ready) pushLog('warn', sec.label + ' · 待接入', 1);
          render();
          return;
        }
        if (act === 'sort') { S.sort = el.dataset.v; render(); return; }
        if (act === 'togg') { S.open[el.dataset.key] = !S.open[el.dataset.key]; render(); return; }
        if (act === 'page') { S.page = el.dataset.code; S.drawer = false; render(); return; }
        if (act === 'page-back') { S.page = null; render(); return; }
        if (act === 'tk') {
          var code = el.dataset.code;
          var row = tacc.filter(function (t) { return t.code === code; })[0];
          if (row) pushLog('info', code + ' ' + row.name
            + ' · 借 ' + (moneyY(row.d) || '0') + ' / 贷 ' + (moneyY(row.l) || '0')
            + ' · ' + row.n + ' 笔', 1);
          return;
        }
        /* 清除：独立重置入口，先二次确认 */
        if (act === 'clear-open') { S.dlg = 'clear'; render(); return; }
        if (act === 'clear-do') { clearAll(); return; }
        if (act === 'dlg-cancel') {
          var wasConflict = S.dlg === 'conflict';
          S.dlg = null;
          if (wasConflict) { conflictChoice('stop'); return; }
          S.logs.push({ k: 'info', m: '已取消 · 未碰平台', lv: 0 });
          render();
          return;
        }
        if (act === 'conflict-clear') { conflictChoice('clear'); return; }
        if (act === 'conflict-skip') { conflictChoice('skip'); return; }
        /* 异常演示与异常态里的动作 */
        if (act === 'demo') {
          S.anomaly = el.dataset.v || null;
          S.retried = {};
          pushLog('info', el.dataset.v ? '演示：' + el.textContent.trim() + ' 态' : '已清除异常态', 0);
          render();
          return;
        }
        if (act === 'an-run') { S.anomaly = null; runSequence(); return; }
        if (act === 'an-query') {
          pushLog('unknown', '重新查询 · 6 科目仍未知', 1);
          return;
        }
        if (act === 'an-retry') {
          var c = el.dataset.code;
          if (c === '*') {
            ['100202', '2202', '660102'].forEach(function (x) { S.retried[x] = true; });
            pushLog('ok', '重试 3 项 · 全部成功', 1);
          } else {
            S.retried[c] = true;
            pushLog('ok', '重试 ' + c + ' · 成功', 1);
          }
          render();
          return;
        }
        if (act === 'run') { runSequence(); return; }
        if (act === 'stop') { stopSequence(); return; }
      }
      function onInput(e) {
        var el = e.target.closest('[data-act]');
        if (!el) return;
        if (el.dataset.act === 'q') { S.q = el.value; renderBody(); return; }
        if (el.dataset.act === 'y') { S.y = el.value.replace(/[^0-9]/g, '').slice(0, 4); return; }
        if (el.dataset.act === 'm') { S.m = el.value.replace(/[^0-9]/g, '').slice(0, 2); return; }
      }
      shell.addEventListener('click', onClick);
      shell.addEventListener('input', onInput);
      refs.run.addEventListener('change', function () { renderAppBar(); });

      /* ---------------- 初始 ---------------- */
      applyTheme();
      pushLog('info', '面板就绪 · ' + (fx.taccountCount || tacc.length) + ' 科目', 0);
      pushLog(S.fallback ? 'warn' : 'ok',
        S.fallback ? '接口未开放 · 快照 ' + SNAP_ID : '教师答案 · 实时', 0);
      render();

      return {
        // 宿主页的「收起态」按钮走这里（可选契约）
        toggle: function () { S.collapsed = !S.collapsed; render(); },
        unmount: function () {
          clearTimers();
          shell.removeEventListener('click', onClick);
          shell.removeEventListener('input', onInput);
          document.documentElement.removeAttribute('data-theme');
          shell.remove();
          style.remove();
        }
      };
    }
  });
})();
