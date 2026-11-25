/*!
 * SuratPro Editor v4.0 — WYSIWYG bergaya MS Word untuk aplikasi surat-menyurat
 * File  : @app/web/js/suratpro/suratpro.js   (pasangan: @app/web/css/suratpro.css)
 * Fitur : tab stop sungguhan (kiri/tengah/kanan + leader), ruler per-paragraf ala Word
 *         (inden baris pertama, gantung, kiri, kanan, margin, tab stop), list bertingkat,
 *         spasi baris setara Word, halaman terpisah + page break, undo/redo sendiri,
 *         paste dari Word (list, tab, tab-stops, class MsoNormal), tabel, gambar,
 *         cetak dengan @page, unduh .doc, zoom, format painter, tanda paragraf (¶).
 * Semua tombol type="button" (aman di dalam form Yii2). Mendukung banyak instance.
 */
(function (global) {
'use strict';

/* ================================================================
 * KONSTANTA & UTILITAS
 * ================================================================ */
var CM = 96 / 2.54;            // px per cm (96 dpi, sama dengan Word 100%)
var PT = 96 / 72;              // px per pt
var DEF_TAB = 1.27 * CM;       // tab stop default Word (0,5")
var SNAP = 0.25 * CM;          // lompatan ruler Word (mode cm)
var GAP = 24;                  // jarak antar lembar di layar (px)
var ZW = '\u200B';

var PAPERS = {
  A4:     { w: 21,    h: 29.7,  label: 'A4 (21 × 29,7 cm)' },
  F4:     { w: 21.5,  h: 33,    label: 'F4 / Folio (21,5 × 33 cm)' },
  Letter: { w: 21.59, h: 27.94, label: 'Letter (21,59 × 27,94 cm)' },
  Legal:  { w: 21.59, h: 35.56, label: 'Legal (21,59 × 35,56 cm)' },
  A5:     { w: 14.8,  h: 21,    label: 'A5 (14,8 × 21 cm)' }
};
var FONTS = ['Times New Roman', 'Arial', 'Calibri', 'Cambria', 'Bookman Old Style', 'Book Antiqua',
  'Century Gothic', 'Garamond', 'Georgia', 'Tahoma', 'Verdana', 'Segoe UI', 'Courier New'];
var SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
var LINE_SP = [1, 1.15, 1.5, 2, 2.5, 3];
/* Tinggi baris "Single" Word = metrik font (ascent+descent+lineGap) ÷ ukuran font.
 * Dengan faktor ini spasi 1,0 / 1,5 / 2,0 di editor sama tingginya dengan di Word. */
var LHF = { 'times new roman': 1.15, 'arial': 1.149, 'calibri': 1.22, 'cambria': 1.172,
  'georgia': 1.136, 'tahoma': 1.207, 'verdana': 1.215, 'segoe ui': 1.33, 'century gothic': 1.225,
  'garamond': 1.12, 'book antiqua': 1.17, 'bookman old style': 1.17, 'courier new': 1.133 };

var COLORS = ['#000000','#434343','#666666','#999999','#b7b7b7','#cccccc','#d9d9d9','#ffffff',
  '#980000','#ff0000','#ff9900','#ffff00','#00ff00','#00ffff','#4a86e8','#0000ff','#9900ff','#ff00ff',
  '#e6b8af','#f4cccc','#fce5cd','#fff2cc','#d9ead3','#d0e0e3','#c9daf8','#cfe2f3','#d9d2e9','#ead1dc',
  '#dd7e6b','#ea9999','#f9cb9c','#ffe599','#b6d7a8','#a2c4c9','#a4c2f4','#9fc5e8','#b4a7d6','#d5a6bd',
  '#cc4125','#e06666','#f6b26b','#ffd966','#93c47d','#76a5af','#6d9eeb','#6fa8dc','#8e7cc3','#c27ba0',
  '#a61c00','#cc0000','#e69138','#f1c232','#6aa84f','#45818e','#3c78d8','#3d85c6','#674ea7','#a64d79'];
var CELL_COLORS = ['transparent','#ffffff','#f2f2f2','#d9d9d9','#bfbfbf','#fce5cd','#fff2cc','#d9ead3',
  '#cfe2f3','#d9d2e9','#ead1dc','#f4cccc','#ffd966','#93c47d','#6fa8dc','#8e7cc3','#e06666','#f6b26b'];

var NUM_STYLES = [
  { v: 'decimal', t: '1. 2. 3.' }, { v: 'lower-alpha', t: 'a. b. c.' }, { v: 'upper-alpha', t: 'A. B. C.' },
  { v: 'lower-roman', t: 'i. ii. iii.' }, { v: 'upper-roman', t: 'I. II. III.' }
];
var BUL_STYLES = [
  { v: 'disc', t: '●' }, { v: 'circle', t: '○' }, { v: 'square', t: '■' },
  { v: '"\u2013\u2002"', t: '–' }, { v: '"\u27A2\u2002"', t: '➢' }, { v: '"\u2713\u2002"', t: '✓' }
];

function qs(r, s) { return r.querySelector(s); }
function qsa(r, s) { return Array.prototype.slice.call(r.querySelectorAll(s)); }
function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function num(v) { v = parseFloat(v); return isNaN(v) ? 0 : v; }
function rnd(v, d) { var p = Math.pow(10, d == null ? 2 : d); return Math.round(v * p) / p; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function toCm(px) { var v = rnd(px / CM, 2); return v === 0 ? '0cm' : v + 'cm'; }
function fmtNum(v, d) { return String(rnd(v, d == null ? 2 : d)).replace('.', ','); }
function fmtCm(px) { return fmtNum(px / CM) + ' cm'; }
function parseNum(s) { return parseFloat(String(s).replace(',', '.')); }
function parseLen(s) {
  s = String(s || '').trim().toLowerCase();
  var m = s.match(/^(-?[\d.]+)\s*(cm|mm|in|pt|px|pc)?$/); if (!m) return NaN;
  var v = parseFloat(m[1]);
  switch (m[2]) { case 'cm': return v * CM; case 'mm': return v * CM / 10; case 'in': return v * 96;
    case 'pt': return v * PT; case 'pc': return v * 16; default: return v; }
}
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function firstFamily(f) { return String(f || '').split(',')[0].replace(/["']/g, '').trim(); }
function lhFactor(f) { return LHF[firstFamily(f).toLowerCase()] || 1.15; }
function isBlockTag(t) { return /^(P|H[1-6]|LI|BLOCKQUOTE|PRE|DIV|TD|TH)$/.test(t); }
function isFlowBlock(t) { return /^(P|H[1-6]|UL|OL|TABLE|DIV|BLOCKQUOTE|PRE|HR)$/.test(t); }
function isList(n) { return n && n.nodeType === 1 && (n.tagName === 'OL' || n.tagName === 'UL'); }
function isTab(n) { return n && n.nodeType === 1 && n.classList && n.classList.contains('sp-tab'); }
function tabEl() { var t = document.createElement('span'); t.className = 'sp-tab'; t.setAttribute('contenteditable', 'false'); t.textContent = '\t'; return t; }
var TAB_HTML = '<span class="sp-tab" contenteditable="false">\t</span>';
/* font dominan paragraf (teks pertama) — dipakai untuk faktor spasi baris Word */
function blockFont(b) {
  var w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT), t;
  while ((t = w.nextNode())) if (t.nodeValue.replace(/[\u200B\s]/g, '').length) return getComputedStyle(t.parentNode).fontFamily;
  return getComputedStyle(b).fontFamily;
}
function rafThrottle(fn) { var id = 0, a; return function () { a = arguments; if (!id) id = requestAnimationFrame(function () { id = 0; fn.apply(null, a); }); }; }
function unpush(el) {
  if (el.classList && el.classList.contains('sp-tpush')) { el.remove(); return; }
  el.style.marginTop = el.getAttribute('data-sp-mt') || '';
  el.removeAttribute('data-sp-push'); el.removeAttribute('data-sp-mt');
  if (!el.getAttribute('style')) el.removeAttribute('style');
}
function isEmptyBlock(b) {
  if (qs(b, 'img,.sp-tab,table,hr,.sp-pagebreak')) return false;
  return !b.textContent.replace(/[\u200B\s\u00a0]/g, '').length;
}
function pathOf(root, node) {
  var p = [];
  while (node && node !== root) { var i = 0, s = node; while ((s = s.previousSibling)) i++; p.unshift(i); node = node.parentNode; }
  return node === root ? p : null;
}
function nodeAt(root, p) {
  var n = root;
  for (var i = 0; i < p.length; i++) { if (!n.childNodes[p[i]]) return n; n = n.childNodes[p[i]]; }
  return n;
}
function listTypeFor(tag, level) {
  var o = ['decimal', 'lower-alpha', 'lower-roman'], u = ['disc', 'circle', 'square'];
  return (tag === 'OL' ? o : u)[(level - 1) % 3];
}
function parseTabs(b) {
  var a = b && b.getAttribute && b.getAttribute('data-tabs'); if (!a) return [];
  return a.split(',').map(function (x) {
    var p = x.split(':'); return { t: p[0] || 'l', x: parseNum(p[1]) * CM, lead: p[2] || '' };
  }).filter(function (s) { return !isNaN(s.x); }).sort(function (a, b) { return a.x - b.x; });
}
function tabsAttr(arr) {
  return arr.slice().sort(function (a, b) { return a.x - b.x; })
    .map(function (s) { return s.t + ':' + rnd(s.x / CM, 3) + (s.lead ? ':' + s.lead : ''); }).join(',');
}
function setTabs(b, arr) { if (arr && arr.length) b.setAttribute('data-tabs', tabsAttr(arr)); else b.removeAttribute('data-tabs'); }

/* ================================================================
 * IKON (SVG garis 24×24)
 * ================================================================ */
function svg(d, vb) { return '<svg viewBox="' + (vb || '0 0 24 24') + '" aria-hidden="true">' + d + '</svg>'; }
var I = {
  bold: svg('<path d="M7 5h6a3.5 3.5 0 010 7H7z"/><path d="M7 12h7a3.5 3.5 0 010 7H7z"/>'),
  italic: svg('<line x1="19" y1="5" x2="10" y2="5"/><line x1="14" y1="19" x2="5" y2="19"/><line x1="15" y1="5" x2="9" y2="19"/>'),
  uline: svg('<path d="M7 4v6a5 5 0 0010 0V4"/><line x1="5" y1="20" x2="19" y2="20"/>'),
  strike: svg('<line x1="4" y1="12" x2="20" y2="12"/><path d="M16.5 6.5C15.6 5.4 14 5 12.3 5 9.6 5 8 6.3 8 8.2c0 1.2.6 2.1 1.8 2.8"/><path d="M8 17.3c1 1.2 2.6 1.7 4.4 1.7 2.8 0 4.6-1.4 4.6-3.4 0-.8-.3-1.5-.8-2.1"/>'),
  sub: svg('<path d="M4 6l8 10M12 6l-8 10"/><path d="M15.5 14.5a2 2 0 013.5 1.3c0 1.5-3.5 2.6-3.5 4.2h3.8"/>'),
  sup: svg('<path d="M4 8l8 10M12 8l-8 10"/><path d="M15.5 4.5A2 2 0 0119 5.8c0 1.5-3.5 2.6-3.5 4.2h3.8"/>'),
  grow: svg('<path d="M3 19l5-14 5 14M4.8 14h6.4"/><path d="M16 9l3-3 3 3M19 6v8"/>'),
  shrink: svg('<path d="M3 19l5-14 5 14M4.8 14h6.4"/><path d="M16 11l3 3 3-3M19 14V6"/>'),
  aL: svg('<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="10" x2="14" y2="10"/><line x1="4" y1="14" x2="20" y2="14"/><line x1="4" y1="18" x2="14" y2="18"/>'),
  aC: svg('<line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="10" x2="17" y2="10"/><line x1="4" y1="14" x2="20" y2="14"/><line x1="7" y1="18" x2="17" y2="18"/>'),
  aR: svg('<line x1="4" y1="6" x2="20" y2="6"/><line x1="10" y1="10" x2="20" y2="10"/><line x1="4" y1="14" x2="20" y2="14"/><line x1="10" y1="18" x2="20" y2="18"/>'),
  aJ: svg('<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="10" x2="20" y2="10"/><line x1="4" y1="14" x2="20" y2="14"/><line x1="4" y1="18" x2="20" y2="18"/>'),
  ol: svg('<line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><path d="M4 4.5h1.5V9M4 9h3" stroke-width="1.4"/><path d="M4 14.3a1.2 1.2 0 012.3.5c0 1-2.3 1.6-2.3 3.2h2.6" stroke-width="1.4"/>'),
  ul: svg('<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.4" fill="currentColor" stroke="none"/>'),
  out: svg('<line x1="21" y1="6" x2="11" y2="6"/><line x1="21" y1="12" x2="11" y2="12"/><line x1="21" y1="18" x2="11" y2="18"/><polyline points="7,9 4,12 7,15"/>'),
  ind: svg('<line x1="21" y1="6" x2="11" y2="6"/><line x1="21" y1="12" x2="11" y2="12"/><line x1="21" y1="18" x2="11" y2="18"/><polyline points="4,9 7,12 4,15"/>'),
  ls: svg('<line x1="11" y1="6" x2="21" y2="6"/><line x1="11" y1="12" x2="21" y2="12"/><line x1="11" y1="18" x2="21" y2="18"/><polyline points="3,7 5.5,4.5 8,7"/><polyline points="3,17 5.5,19.5 8,17"/><line x1="5.5" y1="5" x2="5.5" y2="19"/>'),
  para: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="10" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="17" y2="16"/><polyline points="7,10.5 8.5,12 7,13.5"/>'),
  tabs: svg('<path d="M3 5v14M3 12h14"/><polyline points="13,8 17,12 13,16"/><path d="M21 5v14"/>'),
  marks: svg('<path d="M13 4v16M17 4v16M19 4H10.5a4.5 4.5 0 000 9H13"/>'),
  clr: svg('<path d="M5 6V4h14v2M12 4l-3 16M7 20h5"/><line x1="15" y1="14" x2="21" y2="20"/><line x1="21" y1="14" x2="15" y2="20"/>'),
  painter: svg('<rect x="4" y="3" width="14" height="6" rx="1.2"/><path d="M18 6h2v5h-8v3"/><rect x="10.5" y="14" width="3" height="7" rx="1"/>'),
  co: svg('<path d="M6 17L11.2 4h1.6L18 17M8 12.5h8"/>'),
  hl: svg('<path d="M15 4l5 5-8 8H7v-5z"/><path d="M7 17l-3 3"/>'),
  tbl: svg('<rect x="3" y="4" width="18" height="16" rx="1.5"/><line x1="3" y1="9.5" x2="21" y2="9.5"/><line x1="3" y1="14.8" x2="21" y2="14.8"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/>'),
  img: svg('<rect x="3" y="4" width="18" height="16" rx="1.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5-9 9"/>'),
  link: svg('<path d="M10 13a4.5 4.5 0 006.8.5l2.7-2.7a4.5 4.5 0 00-6.4-6.4l-1.5 1.5"/><path d="M14 11a4.5 4.5 0 00-6.8-.5l-2.7 2.7a4.5 4.5 0 006.4 6.4l1.5-1.5"/>'),
  hr: svg('<line x1="3" y1="12" x2="21" y2="12" stroke-width="2.2"/>'),
  pgbr: svg('<path d="M6 3v5h12V3M6 21v-5h12v5"/><line x1="3" y1="12" x2="6" y2="12"/><line x1="9" y1="12" x2="11" y2="12"/><line x1="13" y1="12" x2="15" y2="12"/><line x1="18" y1="12" x2="21" y2="12"/>'),
  un: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>'),
  re: svg('<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>'),
  print: svg('<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><rect x="7" y="14" width="10" height="7"/>'),
  page: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><rect x="8.5" y="10" width="7" height="8" stroke-dasharray="2 1.5"/>'),
  doc: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M12 10v7M9 14l3 3 3-3"/>'),
  fs: svg('<polyline points="15,3 21,3 21,9"/><polyline points="9,21 3,21 3,15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>'),
  caret: svg('<polyline points="7,10 12,15 17,10"/>'),
  trash: svg('<polyline points="4,7 20,7"/><path d="M18 7l-1 13H7L6 7M9 7V4h6v3"/>'),
  open: svg('<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  x: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  cap: svg('<rect x="4" y="4" width="16" height="11" rx="1.5"/><line x1="7" y1="19" x2="17" y2="19"/>')
};
/* bentuk penanda ruler (persis gaya Word) */
var RM = {
  first: '<svg viewBox="0 0 11 9"><path d="M.5.5h10v4l-5 4-5-4z"/></svg>',
  hang: '<svg viewBox="0 0 11 9"><path d="M.5 8.5v-4l5-4 5 4v4z"/></svg>',
  box: '<svg viewBox="0 0 11 6"><rect x=".5" y=".5" width="10" height="5"/></svg>',
  tl: '<svg viewBox="0 0 9 9"><path d="M1.5 0v7.5H9" /></svg>',
  tc: '<svg viewBox="0 0 9 9"><path d="M4.5 0v7.5M0 7.5h9"/></svg>',
  tr: '<svg viewBox="0 0 9 9"><path d="M7.5 0v7.5H0"/></svg>'
};

/* ================================================================
 * CSS KONTEN — satu sumber untuk editor (.sp-editor), cetak & halaman lihat (.sp-doc)
 * ================================================================ */
function contentCSS(S) {
  var s = S.split(',').map(function (x) { return x.trim(); });
  function sel(sub) { return s.map(function (x) { return sub.split(',').map(function (y) { return x + ' ' + y.trim(); }).join(','); }).join(','); }
  return [
    s.join(',') + '{display:flex;flex-direction:column;align-items:stretch}',
    s.map(function (x) { return x + '>*'; }).join(',') + '{min-width:0;flex-shrink:0}',
    s.join(',') + '{font-kerning:none;font-variant-ligatures:none;color:#000;word-wrap:break-word;overflow-wrap:break-word;text-rendering:optimizeLegibility}',
    sel('p,div,li,h1,h2,h3,h4,h5,h6,blockquote,pre') + '{margin:0}',
    sel('h1') + '{font-size:16pt;font-weight:bold;margin-top:12pt}',
    sel('h2') + '{font-size:13pt;font-weight:bold;margin-top:2pt}',
    sel('h3') + '{font-size:12pt;font-weight:bold;margin-top:2pt}',
    sel('ol,ul') + '{margin:0;padding-left:1.27cm}',
    sel('ol ol,ul ul,ol ul,ul ol') + '{padding-left:1.27cm}',
    sel('li') + '{margin:0;padding-left:0}',
    sel('table') + '{border-collapse:collapse;border-spacing:0}',
    sel('td,th') + '{vertical-align:top}',
    sel('td>p,th>p') + '{margin:0}',
    sel('img') + '{max-width:100%;height:auto}',
    sel('hr') + '{border:none;border-top:1px solid #000;margin:6pt 0}',
    sel('a') + '{color:#0563c1;text-decoration:underline}',
    sel('.sp-tab') + '{display:inline-block;white-space:pre;tab-size:1;text-indent:0;vertical-align:baseline;min-width:1px}',
    sel('.sp-tab[data-lead=dot]') + '{background:radial-gradient(circle,currentColor 0 .7px,transparent 1px) 0 82%/4px 3px repeat-x}',
    sel('.sp-tab[data-lead=dash]') + '{background:linear-gradient(90deg,currentColor 0 3px,transparent 3px) 0 82%/6px 1px repeat-x}',
    sel('.sp-tab[data-lead=line]') + '{background:linear-gradient(currentColor,currentColor) 0 84%/100% 1px no-repeat}',
    sel('.sp-img-wrap') + '{display:block;margin:4pt 0}',
    sel('.sp-img-wrap img') + '{display:inline-block;vertical-align:top}',
    sel('.sp-img-caption') + '{font-size:10pt;font-style:italic;text-align:center;margin-top:3pt}',
    sel('.sp-pagebreak') + '{break-after:page;page-break-after:always;height:0;overflow:hidden}'
  ].join('\n');
}
function injectCSS() {
  if (document.getElementById('sp-content-css')) return;
  var st = document.createElement('style'); st.id = 'sp-content-css';
  st.textContent = contentCSS('.sp-editor');
  (document.head || document.documentElement).appendChild(st);
}

/* ================================================================
 * EDITOR
 * ================================================================ */
function Editor(o) {
  var s = this; o = o || {};
  var ct = typeof o.container === 'string' ? document.querySelector(o.container) : o.container;
  if (!ct) throw new Error('SuratPro: container tidak ditemukan');
  injectCSS();
  s.o = o; s.ct = ct;
  var m = { t: 2.54 * CM, r: 2.54 * CM, b: 2.54 * CM, l: 2.54 * CM };
  if (o.margins && typeof o.margins === 'object') {
    ['top', 'right', 'bottom', 'left'].forEach(function (k) { if (o.margins[k] != null) m[k.charAt(0)] = o.margins[k] * CM; });
  } else if (typeof o.margins === 'number') { m = { t: o.margins * CM, r: o.margins * CM, b: o.margins * CM, l: o.margins * CM }; }
  else if (typeof o.margin === 'number') { m = { t: o.margin, r: o.margin, b: o.margin, l: o.margin }; } // v3: px
  s.doc = { paper: PAPERS[o.pageSize] ? o.pageSize : 'A4', orient: o.orientation === 'landscape' ? 'landscape' : 'portrait',
    m: m, font: o.fontFamily || 'Times New Roman', size: o.fontSize || 12, ls: o.lineSpacing || 1 };
  s.zoom = 1; s.tabType = 'l'; s.undoS = []; s.redoS = []; s._last = { k: '', t: 0 };
  s.lastUl = 'disc'; s.lastOl = 'decimal'; s.pages = 1; s._listeners = [];

  ct.innerHTML = s.tpl();
  s.wrap = qs(ct, '.sp-wrap');
  s.tb = qs(s.wrap, '.sp-toolbar');
  s.scroll = qs(s.wrap, '.sp-scroll');
  s.stage = qs(s.wrap, '.sp-stage');
  s.page = qs(s.wrap, '.sp-page');
  s.sheets = qs(s.wrap, '.sp-sheets');
  s.ed = qs(s.wrap, '.sp-editor');
  s.ov = qs(s.wrap, '.sp-overlay');
  s.guide = qs(s.wrap, '.sp-guide');
  s.rulerBar = qs(s.wrap, '.sp-rulerbar');
  s.ruler = qs(s.wrap, '.sp-ruler');
  s.menu = qs(s.wrap, '.sp-menu');
  s.tip = qs(s.wrap, '.sp-tip');
  s.wrap.style.height = o.height || '760px';
  if (o.spellcheck) s.ed.setAttribute('spellcheck', 'true');
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}

  s.buildRulerMarks();
  s.applyPage(true);
  s.setContent(o.initialContent || '', true);
  s.bind();
  if (o.hiddenField) s.bindField(o.hiddenField);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { s.tabGen = (s.tabGen || 0) + 1; s.relayout(); });
  Editor.instances.push(s);
  Editor.active = s;
}
var P = Editor.prototype;

P.tpl = function () {
  function B(cmd, title, icon, state) {
    return '<button type="button" class="sp-btn" data-cmd="' + cmd + '" title="' + title + '"' + (state ? ' data-state="' + state + '"' : '') + '>' + icon + '</button>';
  }
  function SPLIT(cmd, menu, title, icon) {
    return '<div class="sp-split"><button type="button" class="sp-btn" data-cmd="' + cmd + '" title="' + title + '">' + icon + '</button>' +
      '<button type="button" class="sp-btn sp-caret" data-menu="' + menu + '" title="Pilihan ' + title + '">' + I.caret + '</button></div>';
  }
  function G(inner) { return '<div class="sp-tg">' + inner + '</div>'; }
  var fonts = FONTS.map(function (f) { return '<option value="' + f + '" style="font-family:\'' + f + '\'">' + f + '</option>'; }).join('');
  return '<div class="sp-wrap">' +
    '<div class="sp-toolbar">' +
      '<div class="sp-tb-row">' +
        G(B('undo', 'Urungkan (Ctrl+Z)', I.un) + B('redo', 'Ulangi (Ctrl+Y)', I.re)) +
        G('<select class="sp-sel sp-style" title="Gaya paragraf"><option value="p">Normal</option><option value="h1">Judul 1</option><option value="h2">Judul 2</option><option value="h3">Judul 3</option></select>' +
          '<select class="sp-sel sp-font" title="Jenis huruf">' + fonts + '</select>' +
          '<div class="sp-combo" title="Ukuran huruf (pt)"><input class="sp-size" type="text" inputmode="decimal" value="12" aria-label="Ukuran huruf"><button type="button" class="sp-btn sp-caret" data-menu="size">' + I.caret + '</button></div>' +
          B('grow', 'Perbesar huruf (Ctrl+])', I.grow) + B('shrink', 'Perkecil huruf (Ctrl+[)', I.shrink)) +
        G(B('bold', 'Tebal (Ctrl+B)', I.bold, 'bold') + B('italic', 'Miring (Ctrl+I)', I.italic, 'italic') +
          B('underline', 'Garis bawah (Ctrl+U)', I.uline, 'underline') + B('strikeThrough', 'Coret', I.strike, 'strikeThrough') +
          B('subscript', 'Subskrip (Ctrl+=)', I.sub, 'subscript') + B('superscript', 'Superskrip (Ctrl+Shift++)', I.sup, 'superscript')) +
        G('<div class="sp-split"><button type="button" class="sp-btn" data-cmd="color" title="Warna huruf">' + I.co + '<span class="sp-cind sp-cind-c" style="background:#c00000"></span></button><button type="button" class="sp-btn sp-caret" data-menu="color">' + I.caret + '</button></div>' +
          '<div class="sp-split"><button type="button" class="sp-btn" data-cmd="hilite" title="Stabilo">' + I.hl + '<span class="sp-cind sp-cind-h" style="background:#ffff00"></span></button><button type="button" class="sp-btn sp-caret" data-menu="hilite">' + I.caret + '</button></div>') +
        G(B('painter', 'Format Painter — salin format lalu sorot teks tujuan', I.painter) + B('clear', 'Hapus format huruf', I.clr)) +
      '</div>' +
      '<div class="sp-tb-row">' +
        G(B('alignLeft', 'Rata kiri (Ctrl+L)', I.aL, 'a-left') + B('alignCenter', 'Tengah (Ctrl+E)', I.aC, 'a-center') +
          B('alignRight', 'Rata kanan (Ctrl+R)', I.aR, 'a-right') + B('alignJustify', 'Rata kiri-kanan (Ctrl+J)', I.aJ, 'a-justify')) +
        G(SPLIT('ul', 'ul', 'Bullet', I.ul) + SPLIT('ol', 'ol', 'Penomoran', I.ol)) +
        G(B('outdent', 'Kurangi inden (Ctrl+Shift+M)', I.out) + B('indent', 'Tambah inden (Ctrl+M)', I.ind)) +
        G('<button type="button" class="sp-btn sp-btn-wide" data-menu="ls" title="Spasi baris & paragraf">' + I.ls + I.caret + '</button>' +
          B('paraDlg', 'Pengaturan paragraf (inden & spasi)', I.para) + B('tabsDlg', 'Pengaturan tab stop', I.tabs) +
          B('marks', 'Tampilkan tanda paragraf & tab (Ctrl+Shift+8)', '<span class="sp-pil">¶</span>', 'marks')) +
        G('<button type="button" class="sp-btn sp-btn-wide" data-menu="table" title="Sisipkan tabel">' + I.tbl + I.caret + '</button>' +
          B('image', 'Sisipkan gambar', I.img) + B('link', 'Sisipkan link (Ctrl+K)', I.link) +
          B('hr', 'Garis horizontal', I.hr) + B('pagebreak', 'Pemisah halaman (Ctrl+Enter)', I.pgbr)) +
        G(B('pageSetup', 'Pengaturan halaman (kertas & margin)', I.page) + B('print', 'Cetak (Ctrl+P)', I.print) +
          B('exportDoc', 'Unduh sebagai .doc (buka di MS Word)', I.doc) + B('fullscreen', 'Layar penuh', I.fs)) +
      '</div>' +
    '</div>' +
    '<div class="sp-rulerbar"><button type="button" class="sp-tabsel" title="Jenis tab: Kiri — klik untuk ganti, lalu klik di ruler untuk memasang tab stop">' + RM.tl + '</button>' +
      '<div class="sp-rclip"><div class="sp-ruler"><div class="sp-rticks"></div><div class="sp-rmarks"></div></div></div></div>' +
    '<div class="sp-scroll"><div class="sp-stage"><div class="sp-page">' +
      '<div class="sp-sheets"></div>' +
      '<div class="sp-editor" contenteditable="true" spellcheck="false" role="textbox" aria-multiline="true"></div>' +
      '<div class="sp-overlay"><div class="sp-guide"></div><div class="sp-imgbox">' +
        ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(function (p) { return '<div class="sp-ih sp-ih-' + p + '" data-h="' + p + '"></div>'; }).join('') +
      '</div></div>' +
    '</div></div></div>' +
    '<div class="sp-status"><span class="sp-st-page">Halaman 1 dari 1</span><span class="sp-st-words">0 kata</span><span class="sp-st-info"></span><span class="sp-grow"></span>' +
      '<button type="button" class="sp-zbtn" data-cmd="zoomOut" title="Perkecil tampilan">−</button><input type="range" class="sp-zoom" min="50" max="200" step="10" value="100" aria-label="Zoom"><button type="button" class="sp-zbtn" data-cmd="zoomIn" title="Perbesar tampilan">+</button><span class="sp-zval">100%</span></div>' +
    '<div class="sp-menu" role="menu"></div>' +
    '<div class="sp-tip"></div>' +
    '<div class="sp-imgtb">' +
      '<button type="button" data-img="left" title="Rata kiri">' + I.aL + '</button><button type="button" data-img="center" title="Tengah">' + I.aC + '</button><button type="button" data-img="right" title="Rata kanan">' + I.aR + '</button><i class="sp-sep"></i>' +
      '<button type="button" data-img="25">25%</button><button type="button" data-img="50">50%</button><button type="button" data-img="75">75%</button><button type="button" data-img="100">100%</button><i class="sp-sep"></i>' +
      '<button type="button" data-img="caption" title="Keterangan gambar">' + I.cap + '</button><button type="button" data-img="delete" title="Hapus gambar" class="sp-danger">' + I.trash + '</button></div>' +
    '<div class="sp-linkpop"><a class="sp-lp-url" href="#" target="_blank" rel="noopener"></a><button type="button" data-lp="open" title="Buka">' + I.open + '</button><button type="button" data-lp="edit" title="Ubah">' + I.edit + '</button><button type="button" data-lp="remove" title="Hapus link" class="sp-danger">' + I.x + '</button></div>' +
    '<div class="sp-modal"><div class="sp-dlg" role="dialog" aria-modal="true"><h3></h3><div class="sp-dlg-body"></div><div class="sp-dlg-btns"><button type="button" class="sp-dbtn-s" data-dlg="cancel">Batal</button><button type="button" class="sp-dbtn-p" data-dlg="ok">OK</button></div></div></div>' +
  '</div>';
};

/* ---------- geometri halaman ---------- */
P.paperSize = function () {
  var p = PAPERS[this.doc.paper] || PAPERS.A4, w = p.w * CM, h = p.h * CM;
  return this.doc.orient === 'landscape' ? { w: h, h: w } : { w: w, h: h };
};
P.applyPage = function (noLayout) {
  var sz = this.paperSize(), m = this.doc.m, ed = this.ed, d = this.doc;
  this.pageW = sz.w; this.pageH = sz.h;
  ed.style.width = sz.w + 'px';
  ed.style.padding = m.t + 'px ' + m.r + 'px ' + m.b + 'px ' + m.l + 'px';
  ed.style.minHeight = sz.h + 'px';
  ed.style.fontFamily = /\s/.test(d.font) ? "'" + d.font + "'" : d.font;
  ed.style.fontSize = d.size + 'pt';
  ed.style.lineHeight = rnd(d.ls * lhFactor(d.font), 3);
  this.page.style.width = sz.w + 'px';
  this.drawRuler();
  if (!noLayout) this.changed();
};

/* ---------- konten ---------- */
P.setContent = function (html, init) {
  html = html == null ? '' : String(html);
  var tmp = document.createElement('div'); tmp.innerHTML = html;
  var d = tmp.firstElementChild;
  if (d && tmp.children.length === 1 && d.classList.contains('sp-doc')) {
    this.readDocAttrs(d); html = d.innerHTML;
  } else if (html.indexOf('sp-page-content') > -1) {
    var inner = qs(tmp, '.sp-page-content'); if (inner) html = inner.innerHTML;
  }
  this.ed.innerHTML = html;
  this.normalize();
  this.undoS = []; this.redoS = [];
  this.applyPage(true);
  this.relayoutNow();
  if (!init) this.sync();
};
P.readDocAttrs = function (d) {
  var a = d.getAttribute('data-sp-paper'); if (a && PAPERS[a]) this.doc.paper = a;
  a = d.getAttribute('data-sp-orient'); if (a) this.doc.orient = a === 'landscape' ? 'landscape' : 'portrait';
  a = d.getAttribute('data-sp-margins');
  if (a) { var v = a.split(/\s+/).map(parseNum); if (v.length === 4 && v.every(function (x) { return !isNaN(x); })) this.doc.m = { t: v[0] * CM, r: v[1] * CM, b: v[2] * CM, l: v[3] * CM }; }
  a = d.getAttribute('data-sp-ls'); if (a && !isNaN(parseNum(a))) this.doc.ls = parseNum(a);
  if (d.style.fontFamily) this.doc.font = firstFamily(d.style.fontFamily);
  if (d.style.fontSize) { var fs = parseLen(d.style.fontSize); if (fs) this.doc.size = rnd(fs / PT, 1); }
};
P.normalize = function () {
  var ed = this.ed;
  qsa(ed, '.sp-col-handle,.sp-img-handle,[data-sp-bm]').forEach(function (n) { n.remove(); });
  qsa(ed, '[data-sp-push]').forEach(unpush);
  qsa(ed, '.sp-tab,.sp-img-wrap,.sp-pagebreak').forEach(function (n) { n.setAttribute('contenteditable', 'false'); });
  qsa(ed, '.sp-img-caption').forEach(function (n) { n.setAttribute('contenteditable', 'true'); });
  qsa(ed, 'img.sp-img-selected').forEach(function (n) { n.classList.remove('sp-img-selected'); });
  this.wrapRuns(ed);
  qsa(ed, 'td,th').forEach(function (c) { if (!c.firstChild) c.innerHTML = '<br>'; });
  if (!ed.firstElementChild) ed.innerHTML = '<p><br></p>';
  this.ensureTrailing();
  this.convertFonts(null, true);
};
/* bungkus teks/inline yang "yatim" di level atas menjadi <p> */
P.wrapRuns = function (container) {
  var run = null;
  Array.prototype.slice.call(container.childNodes).forEach(function (n) {
    var inline = n.nodeType === 3 || (n.nodeType === 1 && !isFlowBlock(n.tagName));
    if (n.nodeType === 8) { n.remove(); return; }
    if (n.nodeType === 3 && !/[^\s]/.test(n.nodeValue) && !run) { n.remove(); return; }
    if (inline) { if (!run) { run = document.createElement('p'); container.insertBefore(run, n); } run.appendChild(n); }
    else run = null;
  });
};
P.ensureTrailing = function () {
  var ed = this.ed;
  qsa(ed, ':scope > table, :scope > .sp-img-wrap').forEach(function (t) {
    var nx = t.nextElementSibling;
    if (!nx || nx.tagName === 'TABLE') { var p = mk('p', null, '<br>'); t.parentNode.insertBefore(p, t.nextSibling); }
  });
  var last = ed.lastElementChild;
  if (!last || /^(TABLE|HR|UL|OL)$/.test(last.tagName) || last.classList.contains('sp-img-wrap') || last.classList.contains('sp-pagebreak')) ed.appendChild(mk('p', null, '<br>'));
};

P.cleanClone = function (keepZW) {
  var c = this.ed.cloneNode(true);
  qsa(c, '[data-sp-push]').forEach(unpush);
  qsa(c, '[data-sp-bm],.sp-col-handle,.sp-img-handle').forEach(function (n) { n.remove(); });
  qsa(c, '[contenteditable]').forEach(function (n) { n.removeAttribute('contenteditable'); });
  qsa(c, '.sp-img-selected').forEach(function (n) { n.classList.remove('sp-img-selected'); });
  qsa(c, '.sp-img-caption').forEach(function (n) { if (!n.textContent.trim()) n.remove(); });
  qsa(c, '[class=""]').forEach(function (n) { n.removeAttribute('class'); });
  if (!keepZW) {
    var w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT), t, dead = [];
    while ((t = w.nextNode())) { if (t.nodeValue.indexOf(ZW) > -1) { t.nodeValue = t.nodeValue.replace(/\u200B/g, ''); if (!t.nodeValue) dead.push(t); } }
    dead.forEach(function (n) { n.remove(); });
  }
  return c;
};
P.docAttrs = function () {
  var d = this.doc, m = d.m;
  return 'class="sp-doc" data-sp-paper="' + d.paper + '" data-sp-orient="' + d.orient + '" data-sp-margins="' +
    [m.t, m.r, m.b, m.l].map(function (v) { return rnd(v / CM, 2); }).join(' ') + '" data-sp-ls="' + d.ls + '" style="font-family:' +
    esc(/\s/.test(d.font) ? "'" + d.font + "'" : d.font) + ';font-size:' + d.size + 'pt;line-height:' + rnd(d.ls * lhFactor(d.font), 3) +
    ';max-width:' + rnd((this.pageW - m.l - m.r) / CM, 2) + 'cm"';
};
/* HTML bersih untuk disimpan. Default dibungkus <div class="sp-doc"> berisi setelan kertas,
 * margin & font, sehingga surat tampil identik di halaman lihat/cetak. getCleanHTML(false) = tanpa bungkus. */
P.getCleanHTML = function (wrap) {
  var html = this.cleanClone().innerHTML;
  if (wrap === false || (wrap == null && this.o.wrapOutput === false)) return html;
  return '<div ' + this.docAttrs() + '>' + html + '</div>';
};
P.getContent = function () { return this.getCleanHTML(); };
P.getText = function () { return this.ed.innerText.replace(/\u200B/g, ''); };
P.focus = function () { this.ed.focus(); };

P.bindField = function (sel) {
  var f = typeof sel === 'string' ? document.querySelector(sel) : sel, s = this; if (!f) return;
  s.field = f; s.sync();
  var form = f.form || f.closest('form');
  if (form) { var h = function () { s.sync(true); }; form.addEventListener('submit', h, true); s._listeners.push([form, 'submit', h, true]); }
};
P.sync = function (now) {
  var s = this;
  clearTimeout(s._syncT);
  var run = function () {
    var html = s.getCleanHTML();
    if (s.field) { s.field.value = html; }
    if (typeof s.o.onChange === 'function') s.o.onChange(html, s);
  };
  if (now === true) run(); else s._syncT = setTimeout(run, 250);
};

/* ================================================================
 * UNDO / REDO (snapshot HTML + posisi kursor + setelan halaman)
 * Semua perubahan — mengetik, ruler, tab, list, tabel — bisa di-undo.
 * ================================================================ */
P.snap = function () {
  var c = this.ed.cloneNode(true);
  qsa(c, '[data-sp-push]').forEach(unpush);
  qsa(c, '[data-sp-bm]').forEach(function (n) { n.remove(); });
  var r = this.range(), sel = null;
  if (r) sel = { sp: pathOf(this.ed, r.startContainer), so: r.startOffset, ep: pathOf(this.ed, r.endContainer), eo: r.endOffset };
  return { html: c.innerHTML, sel: sel, doc: JSON.stringify(this.doc) };
};
P.rec = function (kind) {
  kind = kind || 'cmd';
  var now = Date.now(), L = this._last;
  if ((kind === 'type' || kind === 'del') && L.k === kind && now - L.t < 1500) { L.t = now; return; }
  var st = this.snap(), top = this.undoS[this.undoS.length - 1];
  if (!top || top.html !== st.html || top.doc !== st.doc) { this.undoS.push(st); if (this.undoS.length > 200) this.undoS.shift(); }
  this.redoS.length = 0; this._last = { k: kind, t: now };
};
P.restoreSnap = function (st) {
  var d = JSON.parse(st.doc), pageChanged = JSON.stringify(this.doc) !== st.doc;
  this.doc = d; this.doc.m = d.m;
  this.ed.innerHTML = st.html;
  if (pageChanged) this.applyPage(true);
  if (st.sel && st.sel.sp) {
    try {
      var r = document.createRange(), a = nodeAt(this.ed, st.sel.sp), b = nodeAt(this.ed, st.sel.ep || st.sel.sp);
      r.setStart(a, Math.min(st.sel.so, a.nodeType === 3 ? a.length : a.childNodes.length));
      r.setEnd(b, Math.min(st.sel.eo, b.nodeType === 3 ? b.length : b.childNodes.length));
      this.ed.focus({ preventScroll: true });
      var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    } catch (e) {}
  }
  this.deselectImg();
  this.changed(true);
};
P.undo = function () {
  if (!this.undoS.length) return;
  this.redoS.push(this.snap()); this.restoreSnap(this.undoS.pop()); this._last = { k: '', t: 0 };
};
P.redo = function () {
  if (!this.redoS.length) return;
  this.undoS.push(this.snap()); this.restoreSnap(this.redoS.pop()); this._last = { k: '', t: 0 };
};

/* ================================================================
 * SELEKSI
 * ================================================================ */
P.range = function () {
  var sel = window.getSelection();
  if (sel && sel.rangeCount) { var r = sel.getRangeAt(0); if (this.ed.contains(r.commonAncestorContainer)) return r; }
  return null;
};
P.saveSel = function () { var r = this.range(); if (r) this._saved = r.cloneRange(); };
P.restoreSel = function () {
  var r = this.range();
  if (r && document.activeElement === this.ed) return r;
  this.ed.focus({ preventScroll: true });
  var sel = window.getSelection();
  if (this._saved && this.ed.contains(this._saved.startContainer)) { sel.removeAllRanges(); sel.addRange(this._saved); }
  else if (!this.range()) { var b = this.ed.firstElementChild || this.ed; var nr = document.createRange(); nr.setStart(b, 0); nr.collapse(true); sel.removeAllRanges(); sel.addRange(nr); }
  return this.range();
};
P.setCaret = function (node, off, end) {
  var r = document.createRange();
  if (end) { r.selectNodeContents(node); r.collapse(false); } else { r.setStart(node, off || 0); r.collapse(true); }
  var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); this._saved = r.cloneRange();
};
/* caret di awal isi block (untuk Tab/Backspace ala Word) */
P.atBlockStart = function (b, r) {
  r = r || this.range(); if (!r || !r.collapsed || !b) return false;
  var t = document.createRange(); t.setStart(b, 0);
  try { t.setEnd(r.startContainer, r.startOffset); } catch (e) { return false; }
  if (t.toString().replace(/\u200B/g, '').length) return false;
  var f = t.cloneContents(); return !qs(f, '.sp-tab,img');
};
P.blockOf = function (n) {
  var ed = this.ed;
  while (n && n !== ed) {
    if (n.nodeType === 1 && isBlockTag(n.tagName) && !n.classList.contains('sp-img-wrap')) return n;
    n = n.parentNode;
  }
  return null;
};
function boundaryNode(c, o) { return c.nodeType === 1 ? (c.childNodes[o] || c.childNodes[o - 1] || c) : c; }
/* Semua paragraf yang tersentuh seleksi (seperti Word: format paragraf berlaku per paragraf) */
P.blocks = function (noFix) {
  var r = this.range() || this.restoreSel(); if (!r) return [];
  var s = this, res = [], seen = [];
  function add(n) { var b = s.blockOf(n); if (b && seen.indexOf(b) < 0) { seen.push(b); res.push(b); } }
  add(boundaryNode(r.startContainer, r.startOffset));
  if (!r.collapsed) {
    var root = r.commonAncestorContainer; if (root.nodeType === 3) root = root.parentNode;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: function (n) {
      return (n.nodeType === 3 || n.tagName === 'BR' || n.tagName === 'IMG') && r.intersectsNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; } });
    var n; while ((n = w.nextNode())) add(n);
    var eb = s.blockOf(boundaryNode(r.endContainer, r.endOffset));
    if (eb && res.length > 1 && res[res.length - 1] === eb) {
      var t = document.createRange(); t.setStart(eb, 0); try { t.setEnd(r.endContainer, r.endOffset); if (!t.toString().length) res.pop(); } catch (e) {}
    }
  }
  if (!res.length) {
    var first = this.ed.firstElementChild;
    if (!first || !isBlockTag(first.tagName)) { first = mk('p', null, '<br>'); this.ed.insertBefore(first, this.ed.firstChild); }
    res.push(first);
  }
  if (!noFix && res.some(function (b) { return /^T[DH]$/.test(b.tagName); })) {
    var bm = this.bookmark();
    res.forEach(function (b) { if (/^T[DH]$/.test(b.tagName)) s.wrapRuns(b); });
    this.restoreBookmark(bm);
    return this.blocks(true);
  }
  return res.filter(function (b) { return !/^T[DH]$/.test(b.tagName) || noFix; });
};
P.anchorBlock = function () {
  var r = this.range() || this._saved;
  if (r && this.ed.contains(r.startContainer)) { var b = this.blockOf(boundaryNode(r.startContainer, r.startOffset)); if (b) return b; }
  return this.ed.firstElementChild;
};
/* bookmark: penanda span sementara agar seleksi selamat saat node dipindah */
P.bookmark = function () {
  var r = this.range(); if (!r) return null;
  var e = mk('span'); e.setAttribute('data-sp-bm', 'e');
  var r2 = r.cloneRange(); r2.collapse(false); r2.insertNode(e);
  var st = null;
  if (!r.collapsed) { st = mk('span'); st.setAttribute('data-sp-bm', 's'); var r1 = r.cloneRange(); r1.collapse(true); r1.insertNode(st); }
  return { s: st, e: e };
};
P.restoreBookmark = function (bm) {
  if (!bm) return;
  var r = document.createRange(), sel = window.getSelection();
  try {
    if (bm.s && bm.s.parentNode) r.setStartAfter(bm.s); else if (bm.e.parentNode) r.setStartBefore(bm.e);
    if (bm.e.parentNode) r.setEndBefore(bm.e);
    sel.removeAllRanges(); sel.addRange(r);
  } catch (e) {}
  [bm.s, bm.e].forEach(function (n) {
    if (n && n.parentNode) { var p = n.parentNode; p.removeChild(n); }
  });
  var rr = this.range(); if (rr) this._saved = rr.cloneRange();
};

/* ================================================================
 * FORMAT HURUF
 * ================================================================ */
P.exec = function (c, v) {
  this.restoreSel(); this.rec();
  try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
  document.execCommand(c, false, v == null ? null : v);
  this.convertFonts();
  this.changed();
};
/* kata di posisi kursor (Word: ubah font saat kursor di tengah kata = seluruh kata) */
P.wordRange = function (r) {
  var n = r.startContainer, o = r.startOffset;
  if (n.nodeType !== 3) return null;
  var t = n.nodeValue, re = /[\p{L}\p{N}_'-]/u;
  if (!(o > 0 && o < t.length && re.test(t.charAt(o - 1)) && re.test(t.charAt(o)))) return null;
  var a = o, b = o; while (a > 0 && re.test(t.charAt(a - 1))) a--; while (b < t.length && re.test(t.charAt(b))) b++;
  var w = document.createRange(); w.setStart(n, a); w.setEnd(n, b); return w;
};
P.inlineApply = function (fn) {
  var r = this.restoreSel(); if (!r) return;
  this.rec();
  var bm = null, wr = r.collapsed ? this.wordRange(r) : null, sel = window.getSelection();
  if (wr) { bm = this.bookmark(); sel.removeAllRanges(); sel.addRange(wr); }
  fn(!!(r.collapsed && !wr));
  if (bm) this.restoreBookmark(bm);
  this.changed();
};
P.setFontSize = function (pt) {
  pt = parseNum(pt); if (!(pt >= 1 && pt <= 1638)) return;
  pt = rnd(pt, 1); var s = this;
  this.inlineApply(function (pendingOnly) {
    s._pendPt = pt;
    try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
    document.execCommand('fontSize', false, '7');
    if (!pendingOnly) s.convertFonts(pt);
  });
  var inp = qs(this.wrap, '.sp-size'); if (inp) inp.value = fmtNum(pt, 1);
};
P.setFontName = function (f) {
  var s = this;
  this.inlineApply(function (pendingOnly) {
    try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
    document.execCommand('fontName', false, f);
    if (!pendingOnly) s.convertFonts();
  });
};
P.setColor = function (c, hilite) {
  var s = this; this._lastColor = this._lastColor || {};
  this._lastColor[hilite ? 'h' : 'c'] = c;
  var ind = qs(this.wrap, hilite ? '.sp-cind-h' : '.sp-cind-c'); if (ind) ind.style.background = c === 'transparent' ? '#fff' : c;
  this.inlineApply(function () {
    try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
    document.execCommand(hilite ? 'hiliteColor' : 'foreColor', false, c);
    try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
    s.convertFonts();
  });
};
P.curFontPt = function () {
  var r = this.range() || this._saved; if (!r) return this.doc.size;
  var n = boundaryNode(r.startContainer, r.startOffset); if (n.nodeType === 3) n = n.parentNode;
  return rnd(parseFloat(getComputedStyle(n).fontSize) / PT * 2, 0) / 2;
};
P.growFont = function (dir) {
  var cur = this.curFontPt(), next;
  if (dir > 0) { next = SIZES.filter(function (v) { return v > cur; })[0] || cur + 10; }
  else { var l = SIZES.filter(function (v) { return v < cur; }); next = l.length ? l[l.length - 1] : Math.max(1, cur - 1); }
  this.setFontSize(next);
};
/* <font> hasil execCommand → <span style> bersih dengan satuan pt (seperti Word) */
P.convertFonts = function (pt, noBm) {
  var fonts = qsa(this.ed, 'font'); if (!fonts.length) return;
  var bm = noBm ? null : this.bookmark(), s = this;
  var legacy = { 1: 8, 2: 10, 3: 12, 4: 13.5, 5: 18, 6: 24, 7: 36 };
  fonts.forEach(function (f) {
    var sp = mk('span'), size = f.getAttribute('size'), face = f.getAttribute('face'), color = f.getAttribute('color');
    if (f.getAttribute('style')) sp.setAttribute('style', f.getAttribute('style'));
    if (size) {
      var v = size === '7' ? (pt || s._pendPt || legacy[7]) : legacy[size];
      if (v) { sp.style.fontSize = v + 'pt'; qsa(f, '[style]').forEach(function (x) { x.style.fontSize = ''; }); }
    }
    if (face) { sp.style.fontFamily = /\s/.test(face) && face.indexOf(',') < 0 ? "'" + face + "'" : face; qsa(f, '[style]').forEach(function (x) { x.style.fontFamily = ''; }); }
    if (color) sp.style.color = color;
    while (f.firstChild) sp.appendChild(f.firstChild);
    f.parentNode.replaceChild(sp, f);
  });
  qsa(this.ed, 'span[style=""]').forEach(function (x) { x.removeAttribute('style'); });
  qsa(this.ed, 'span:not([class]):not([style]):not([data-sp-bm])').forEach(function (x) {
    var p = x.parentNode; while (x.firstChild) p.insertBefore(x.firstChild, x); p.removeChild(x);
  });
  if (bm) this.restoreBookmark(bm);
};
P.clearFormat = function () {
  var s = this;
  this.inlineApply(function () {
    document.execCommand('removeFormat');
    document.execCommand('unlink');
    var r = s.range(); if (!r) return;
    qsa(s.ed, 'span[style]').forEach(function (sp) {
      if (r.intersectsNode(sp)) { ['font-size', 'font-family', 'color', 'background-color', 'font-weight', 'font-style', 'text-decoration', 'vertical-align'].forEach(function (p) { sp.style.removeProperty(p); }); if (!sp.getAttribute('style')) sp.removeAttribute('style'); }
    });
    s.convertFonts();
  });
};

/* ---------- Format Painter ---------- */
P.painterPick = function () {
  var r = this.restoreSel(); if (!r) return;
  var n = boundaryNode(r.startContainer, r.startOffset); if (n.nodeType === 3) n = n.parentNode;
  var cs = getComputedStyle(n), b = this.blockOf(n), bs = b ? b.style : {};
  this._painter = {
    ch: { font: firstFamily(cs.fontFamily), pt: rnd(parseFloat(cs.fontSize) / PT * 2, 0) / 2, color: cs.color,
      bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), underline: document.queryCommandState('underline') },
    pa: b ? { ml: bs.marginLeft, mr: bs.marginRight, ti: bs.textIndent, ta: bs.textAlign, lh: bs.lineHeight, mb: bs.marginBottom,
      mt: b.hasAttribute('data-sp-push') ? b.getAttribute('data-sp-mt') : bs.marginTop, ls: b.getAttribute('data-ls'), tabs: b.getAttribute('data-tabs') } : null
  };
  this.wrap.classList.add('sp-painting');
  qs(this.tb, '[data-cmd=painter]').classList.add('on');
};
P.painterApply = function () {
  var p = this._painter; this._painter = null;
  this.wrap.classList.remove('sp-painting'); qs(this.tb, '[data-cmd=painter]').classList.remove('on');
  if (!p) return;
  var r = this.range(); if (!r) return;
  this.rec();
  var s = this;
  if (p.pa) this.blocks().forEach(function (b) {
    b.style.marginLeft = p.pa.ml || ''; b.style.marginRight = p.pa.mr || ''; b.style.textIndent = p.pa.ti || '';
    b.style.textAlign = p.pa.ta || ''; b.style.lineHeight = p.pa.lh || ''; b.style.marginBottom = p.pa.mb || '';
    s.setMT(b, p.pa.mt || '');
    if (p.pa.ls) b.setAttribute('data-ls', p.pa.ls); else b.removeAttribute('data-ls');
    if (p.pa.tabs) b.setAttribute('data-tabs', p.pa.tabs); else b.removeAttribute('data-tabs');
    if (!b.getAttribute('style')) b.removeAttribute('style');
  });
  if (!r.collapsed) {
    var c = p.ch;
    document.execCommand('removeFormat');
    try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
    this._pendPt = c.pt;
    document.execCommand('fontName', false, c.font);
    document.execCommand('fontSize', false, '7');
    this.convertFonts(c.pt);
    try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
    if (c.color && c.color !== 'rgb(0, 0, 0)') document.execCommand('foreColor', false, c.color);
    try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
    ['bold', 'italic', 'underline'].forEach(function (k) { if (document.queryCommandState(k) !== c[k]) document.execCommand(k); });
    this.convertFonts();
  }
  this.changed();
};

/* ================================================================
 * FORMAT PARAGRAF (berlaku per paragraf seperti Word)
 * Model Word: L = inden kiri (baris ke-2 dst), TI = baris pertama relatif L, R = inden kanan.
 * Semua posisi relatif terhadap margin kiri (atau tepi isi sel tabel).
 * ================================================================ */
P.pageRect = function () { return this.page.getBoundingClientRect(); };
P.refBox = function (b) {
  var z = this.zoom, pr = this.pageRect(), c = (b && b.closest('td,th')) || this.ed;
  if (!this.ed.contains(c)) c = this.ed;
  var r = c.getBoundingClientRect(), cs = getComputedStyle(c);
  var l = (r.left - pr.left) / z + num(cs.paddingLeft) + num(cs.borderLeftWidth);
  var rt = (r.right - pr.left) / z - num(cs.paddingRight) - num(cs.borderRightWidth);
  return { left: l, right: rt, cell: c !== this.ed ? c : null };
};
P.para = function (b) {
  var z = this.zoom, pr = this.pageRect(), cs = getComputedStyle(b), r = b.getBoundingClientRect(), ref = this.refBox(b);
  var cl = (r.left - pr.left) / z + num(cs.paddingLeft) + num(cs.borderLeftWidth);
  var cr = (r.right - pr.left) / z - num(cs.paddingRight) - num(cs.borderRightWidth);
  return { b: b, ref: ref, L: cl - ref.left, R: ref.right - cr, TI: num(cs.textIndent),
    ml: num(cs.marginLeft), mr: num(cs.marginRight), tabs: parseTabs(b) };
};
/* set inden absolut; m = hasil para(b) sebelum perubahan (tanpa baca layout lagi → drag mulus) */
P.setIndent = function (b, m, v) {
  if (v.L != null) { var ml = m.ml + (v.L - m.L); b.style.marginLeft = Math.abs(ml) < 0.3 ? '' : toCm(ml); }
  if (v.R != null) { var mr = m.mr + (v.R - m.R); b.style.marginRight = Math.abs(mr) < 0.3 ? '' : toCm(mr); }
  if (v.TI != null) b.style.textIndent = Math.abs(v.TI) < 0.3 ? '' : toCm(v.TI);
  if (!b.getAttribute('style')) b.removeAttribute('style');
};
P.setMT = function (b, v) {
  if (b.hasAttribute('data-sp-push')) b.setAttribute('data-sp-mt', v); else b.style.marginTop = v;
  if (!b.getAttribute('style')) b.removeAttribute('style');
};
P.getMT = function (b) { return b.hasAttribute('data-sp-push') ? (b.getAttribute('data-sp-mt') || '') : b.style.marginTop; };

P.paraCmd = function (fn) {
  this.restoreSel(); this.rec();
  var bl = this.blocks(); var s = this;
  bl.forEach(function (b) { fn.call(s, b); });
  this.changed();
  return bl;
};
P.align = function (a) {
  if (this.selImg) { this.imgCmd(a === 'justify' ? 'left' : a); return; }
  this.paraCmd(function (b) {
    b.style.textAlign = a === 'left' ? '' : a;
    if (a === 'left' && !/left|start/.test(getComputedStyle(b).textAlign)) b.style.textAlign = 'left';
    if (!b.getAttribute('style')) b.removeAttribute('style');
  });
};
P.lineSpacing = function (ls, exactPt) {
  this.paraCmd(function (b) {
    if (exactPt) { b.setAttribute('data-ls', 'x' + exactPt); b.style.lineHeight = exactPt + 'pt'; return; }
    b.setAttribute('data-ls', String(ls));
    b.style.lineHeight = rnd(ls * lhFactor(blockFont(b)), 3);
  });
};
P.blockLS = function (b) {
  var a = b && b.getAttribute('data-ls');
  if (a) return a.charAt(0) === 'x' ? { exact: parseNum(a.slice(1)) } : { ls: parseNum(a) };
  if (b) {
    var cs = getComputedStyle(b), lh = parseFloat(cs.lineHeight), fs = parseFloat(cs.fontSize);
    if (lh && fs) { var v = rnd(lh / fs / lhFactor(cs.fontFamily), 2); var near = LINE_SP.filter(function (x) { return Math.abs(x - v) < 0.04; })[0]; return { ls: near || v }; }
  }
  return { ls: this.doc.ls };
};
P.toggleSpace = function (which) {
  var first = this.anchorBlock(), has = first && num(which === 'before' ? this.getMT(first) : first.style.marginBottom) > 0;
  var s = this;
  this.paraCmd(function (b) {
    if (which === 'before') s.setMT(b, has ? '' : '12pt'); else { b.style.marginBottom = has ? '' : '12pt'; if (!b.getAttribute('style')) b.removeAttribute('style'); }
  });
};
/* Tambah/kurangi inden kiri ke kelipatan tab default berikutnya (perilaku tombol Indent Word) */
P.indent = function (dir) {
  var r = this.restoreSel(); if (!r) return;
  var bl = this.blocks(), lis = bl.filter(function (b) { return b.tagName === 'LI'; });
  if (lis.length === bl.length && lis.length) {
    this.rec(); var bm = this.bookmark();
    if (dir > 0) this.demote(lis); else this.promote(lis);
    this.restoreBookmark(bm); this.changed(); return;
  }
  this.rec(); var s = this;
  bl.forEach(function (b) {
    var m = s.para(b), L;
    if (dir > 0) L = (Math.floor((m.L + 0.5) / DEF_TAB) + 1) * DEF_TAB;
    else L = Math.max(0, (Math.ceil((m.L - 0.5) / DEF_TAB) - 1) * DEF_TAB);
    if (dir < 0 && m.L <= 0.5 && m.TI > 0.5) { s.setIndent(b, m, { TI: 0 }); return; }
    s.setIndent(b, m, { L: L });
  });
  this.changed();
};
P.setBlockTag = function (tag) {
  var s = this;
  this.restoreSel(); this.rec();
  var bm = this.bookmark();
  this.blocks().forEach(function (b) {
    if (!/^(P|H[1-6]|DIV)$/.test(b.tagName) || b.tagName === tag.toUpperCase()) return;
    if (b.classList.contains('sp-img-caption')) return;
    var n = document.createElement(tag);
    Array.prototype.slice.call(b.attributes).forEach(function (a) { n.setAttribute(a.name, a.value); });
    while (b.firstChild) n.appendChild(b.firstChild);
    b.parentNode.replaceChild(n, b);
  });
  this.restoreBookmark(bm);
  this.changed();
};

/* ---------- Dialog Paragraf (tiru dialog Paragraph MS Word) ---------- */
P.paraDialog = function () {
  var r = this.restoreSel(); if (!r) return;
  var b = this.anchorBlock(); if (!b) return;
  var m = this.para(b), cs = getComputedStyle(b), ls = this.blockLS(b);
  var ta = b.style.textAlign || cs.textAlign; ta = /center/.test(ta) ? 'center' : /right|end/.test(ta) ? 'right' : /justify/.test(ta) ? 'justify' : 'left';
  var special = m.TI > 0.3 ? 'first' : m.TI < -0.3 ? 'hang' : 'none';
  var lsMode = ls.exact ? 'exact' : ls.ls === 1 ? '1' : ls.ls === 1.5 ? '1.5' : ls.ls === 2 ? '2' : 'multi';
  var before = rnd(num(this.getMT(b) ? parseLen(this.getMT(b)) : 0) / PT, 1), after = rnd(num(cs.marginBottom) / PT, 1);
  var s = this;
  var body =
    '<div class="sp-fs"><div class="sp-fl">Umum</div><div class="sp-row"><label>Perataan<select name="ta">' +
      [['left', 'Rata kiri'], ['center', 'Tengah'], ['right', 'Rata kanan'], ['justify', 'Rata kiri-kanan']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === ta ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
    '</select></label></div></div>' +
    '<div class="sp-fs"><div class="sp-fl">Indentasi</div><div class="sp-row">' +
      '<label>Kiri (cm)<input name="L" value="' + fmtNum(m.L / CM) + '"></label>' +
      '<label>Kanan (cm)<input name="R" value="' + fmtNum(m.R / CM) + '"></label></div><div class="sp-row">' +
      '<label>Khusus<select name="sp"><option value="none">(tidak ada)</option><option value="first"' + (special === 'first' ? ' selected' : '') + '>Baris pertama</option><option value="hang"' + (special === 'hang' ? ' selected' : '') + '>Gantung</option></select></label>' +
      '<label>Sebesar (cm)<input name="by" value="' + (special === 'none' ? '' : fmtNum(Math.abs(m.TI) / CM)) + '"></label></div></div>' +
    '<div class="sp-fs"><div class="sp-fl">Spasi</div><div class="sp-row">' +
      '<label>Sebelum (pt)<input name="bf" value="' + fmtNum(before, 1) + '"></label>' +
      '<label>Sesudah (pt)<input name="af" value="' + fmtNum(after, 1) + '"></label></div><div class="sp-row">' +
      '<label>Spasi baris<select name="lm"><option value="1">Tunggal</option><option value="1.5">1,5 baris</option><option value="2">Ganda</option><option value="multi">Kelipatan</option><option value="exact">Tepat (pt)</option></select></label>' +
      '<label>Nilai<input name="lv" value="' + (lsMode === 'exact' ? fmtNum(ls.exact, 1) : lsMode === 'multi' ? fmtNum(ls.ls) : '') + '"></label></div></div>';
  this.dialog('Paragraf', body, function (f) {
    var L = parseNum(f.L.value) * CM, R = parseNum(f.R.value) * CM, by = parseNum(f.by.value) * CM || 0, spc = f.sp.value;
    var bf = parseNum(f.bf.value) || 0, af = parseNum(f.af.value) || 0, lm = f.lm.value, lv = parseNum(f.lv.value);
    s.restoreSel(); s.rec();
    s.blocks().forEach(function (bb) {
      var mm = s.para(bb), v = {};
      if (!isNaN(R)) v.R = R;
      if (!isNaN(L)) {
        v.L = L; v.TI = spc === 'hang' ? -by : spc === 'first' ? by : 0;
      }
      s.setIndent(bb, mm, v);
      bb.style.textAlign = f.ta.value === 'left' ? '' : f.ta.value;
      s.setMT(bb, bf ? bf + 'pt' : ''); bb.style.marginBottom = af ? af + 'pt' : '';
      if (lm === 'exact' && lv > 0) { bb.setAttribute('data-ls', 'x' + lv); bb.style.lineHeight = lv + 'pt'; }
      else { var x = lm === 'multi' ? (lv > 0 ? lv : 1) : parseNum(lm); bb.setAttribute('data-ls', String(x)); bb.style.lineHeight = rnd(x * lhFactor(blockFont(bb)), 3); }
      if (!bb.getAttribute('style')) bb.removeAttribute('style');
    });
    s.changed();
  }, function (f) {
    f.lm.value = lsMode;
    f.lm.onchange = function () { if (f.lm.value === 'exact' && !f.lv.value) f.lv.value = fmtNum(s.doc.size * 1.2, 1); if (f.lm.value === 'multi' && !f.lv.value) f.lv.value = '1,15'; };
    f.sp.onchange = function () { if (f.sp.value !== 'none' && !parseNum(f.by.value)) f.by.value = '1,27'; if (f.sp.value === 'none') f.by.value = ''; };
  });
};

/* ---------- Dialog Tab (tiru dialog Tabs MS Word) ---------- */
P.tabsDialog = function (preselect) {
  var r = this.restoreSel(); if (!r) return;
  var b = this.anchorBlock(); if (!b) return;
  var stops = parseTabs(b).map(function (x) { return { t: x.t, x: x.x, lead: x.lead }; }), s = this, sel = preselect == null ? (stops.length ? 0 : -1) : preselect;
  var body = '<div class="sp-row"><label>Posisi tab stop (cm)<input name="pos" placeholder="mis. 3,5"></label></div>' +
    '<div class="sp-tabs-list" tabindex="-1"></div>' +
    '<div class="sp-row"><label>Perataan<select name="al"><option value="l">Kiri</option><option value="c">Tengah</option><option value="r">Kanan</option></select></label>' +
    '<label>Leader<select name="ld"><option value="">(tidak ada)</option><option value="dot">. . . . . .</option><option value="dash">- - - - -</option><option value="line">_______</option></select></label></div>' +
    '<div class="sp-row sp-row-btn"><button type="button" class="sp-dbtn-s" data-t="set">Pasang</button><button type="button" class="sp-dbtn-s" data-t="del">Hapus</button><button type="button" class="sp-dbtn-s" data-t="all">Hapus semua</button></div>' +
    '<p class="sp-hint">Tab stop default setiap 1,27 cm. Posisi diukur dari margin kiri, sama seperti MS Word.</p>';
  this.dialog('Tab', body, function () {
    s.restoreSel(); s.rec();
    s.blocks().forEach(function (bb) { setTabs(bb, stops); });
    s.changed();
  }, function (f, box) {
    var list = qs(box, '.sp-tabs-list');
    function render() {
      var names = { l: 'Kiri', c: 'Tengah', r: 'Kanan' };
      list.innerHTML = stops.length ? stops.map(function (x, i) { return '<div class="sp-tabs-it' + (i === sel ? ' on' : '') + '" data-i="' + i + '">' + fmtCm(x.x) + ' — ' + names[x.t] + (x.lead ? ' (leader)' : '') + '</div>'; }).join('') : '<div class="sp-tabs-empty">Belum ada tab stop khusus</div>';
      if (sel >= 0 && stops[sel]) { f.pos.value = fmtNum(stops[sel].x / CM); f.al.value = stops[sel].t; f.ld.value = stops[sel].lead || ''; }
    }
    list.onclick = function (e) { var it = e.target.closest('.sp-tabs-it'); if (it) { sel = +it.dataset.i; render(); } };
    box.querySelector('.sp-row-btn').onclick = function (e) {
      var t = e.target.dataset.t; if (!t) return;
      if (t === 'set') {
        var x = parseNum(f.pos.value) * CM; if (!(x >= 0)) { f.pos.focus(); return; }
        var ex = stops.filter(function (q) { return Math.abs(q.x - x) < 1; })[0];
        if (ex) { ex.t = f.al.value; ex.lead = f.ld.value; } else stops.push({ t: f.al.value, x: x, lead: f.ld.value });
        stops.sort(function (a, c) { return a.x - c.x; });
        sel = stops.indexOf(ex || stops.filter(function (q) { return Math.abs(q.x - x) < 1; })[0]);
      } else if (t === 'del' && sel >= 0) { stops.splice(sel, 1); sel = Math.min(sel, stops.length - 1); }
      else if (t === 'all') { stops = []; sel = -1; f.pos.value = ''; }
      render();
    };
    f.pos.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); qs(box, '[data-t=set]').click(); } };
    render();
  });
};

/* ================================================================
 * MESIN TAB STOP — setiap karakter tab adalah <span class="sp-tab"> yang lebarnya
 * dihitung ulang supaya teks sesudahnya jatuh tepat di tab stop berikutnya
 * (kiri / tengah / kanan, + leader titik). Persis cara Word meratakan
 * "Nomor<Tab>: ...", "Lampiran<Tab>: ...", dst.
 * ================================================================ */
P.insertTab = function () {
  var r = this.range(); if (!r) return;
  this.rec('type');
  if (!r.collapsed) r.deleteContents();
  var t = tabEl();
  r.insertNode(t);
  // kursor setelah span non-editable: sediakan text node (ZW) bila tab di ujung baris
  var nx = t.nextSibling;
  if (!nx || (nx.nodeType === 1 && (nx.tagName === 'BR' || isTab(nx))) || (nx.nodeType === 3 && !nx.nodeValue.length)) {
    var z = document.createTextNode(ZW); t.parentNode.insertBefore(z, t.nextSibling); this.setCaret(z, 1);
  } else if (nx.nodeType === 3) this.setCaret(nx, 0);
  else { var rr = document.createRange(); rr.setStartAfter(t); rr.collapse(true); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(rr); }
  this.changed();
};
P.tabInfo = function (b) {
  var m = this.para(b);
  return { ref: m.ref.left, L: m.L, TI: m.TI, max: m.ref.right - m.ref.left - m.R, stops: m.tabs };
};
function nextStop(info, x) {
  var best = null;
  info.stops.forEach(function (s) { if (s.x > x + 0.5 && (!best || s.x < best.x)) best = s; });
  // inden gantung berperan sebagai tab stop implisit (perilaku Word untuk nomor/huruf manual)
  if (info.TI < -0.3 && info.L > x + 0.5 && (!best || info.L < best.x)) best = { t: 'l', x: info.L, lead: '' };
  if (best) return best;
  var last = info.stops.length ? info.stops[info.stops.length - 1].x : 0;
  var d = (Math.floor((Math.max(x, last) + 0.5) / DEF_TAB) + 1) * DEF_TAB;
  return { t: 'l', x: d, lead: '' };
}
P.segWidth = function (t, b, tabs, i) {
  var r = document.createRange(); r.setStartAfter(t);
  var nx = tabs[i + 1];
  if (nx && b.contains(nx)) r.setEndBefore(nx);
  else {
    var stop = null;
    for (var c = b.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && /^(OL|UL|TABLE|DIV|P)$/.test(c.tagName) && t.compareDocumentPosition(c) & 4) { stop = c; break; }
    if (stop) r.setEndBefore(stop); else r.setEnd(b, b.childNodes.length);
  }
  var rc = r.getBoundingClientRect(); return rc.width / this.zoom;
};
P.layoutTabs = function (scope) {
  var all = qsa(scope || this.ed, '.sp-tab'); if (!all.length) return;
  var z = this.zoom, pr = this.pageRect(), s = this, groups = [], map = [];
  all.forEach(function (t) {
    var b = s.blockOf(t); if (!b) return;
    var i = map.indexOf(b); if (i < 0) { map.push(b); groups.push([t]); } else groups[i].push(t);
  });
  var dk = z + '|' + (s.tabGen || 0) + '|' + JSON.stringify(s.doc);
  groups.forEach(function (tabs, gi) {
    var b = map[gi], key = null;
    // lewati paragraf yang tidak berubah (mengetik di dokumen panjang tetap ringan)
    if (!b.closest('td,th')) {
      var par = b.parentNode;
      key = dk + '|' + (b.getAttribute('style') || '') + '|' + (b.getAttribute('data-tabs') || '') + '|' + (par && par !== s.ed ? (par.getAttribute('style') || '') + s.listLevel(b) : '') + '|' +
        b.innerHTML.replace(/ (style="width:[^"]*"|data-lead="[^"]*")/g, '');
      if (b._spTabKey === key) return;
    }
    var info = s.tabInfo(b);
    tabs.forEach(function (t, i) {
      t.style.width = '0px';
      var x = (t.getBoundingClientRect().left - pr.left) / z - info.ref;
      var st = nextStop(info, x), w;
      if (st.t === 'l') w = st.x - x;
      else {
        var seg = s.segWidth(t, b, tabs, i);
        w = st.t === 'r' ? st.x - x - seg : st.x - x - seg / 2;
        if (w < 1) { var d = nextStop({ stops: [], TI: 0, L: 0 }, x); w = Math.max(1, st.x > x ? 1 : d.x - x); }
      }
      t.style.width = rnd(Math.max(1, w), 2) + 'px';
      if (st.lead) t.setAttribute('data-lead', st.lead); else t.removeAttribute('data-lead');
    });
    b._spTabKey = key;
  });
};

/* ================================================================
 * BULLET & PENOMORAN (bertingkat: Tab = turun level, Shift+Tab = naik level)
 * ================================================================ */
P.listLevel = function (li) { var n = 0, p = li; while (p && p !== this.ed) { if (isList(p)) n++; p = p.parentNode; } return n; };
function listStyleOf(l) { return l.style.listStyleType || (l.tagName === 'OL' ? 'decimal' : 'disc'); }
function sameListStyle(a, b) { return a && b && a.tagName === b.tagName && listStyleOf(a) === listStyleOf(b); }
function copyParaStyle(from, to) {
  ['textAlign', 'lineHeight', 'marginBottom'].forEach(function (k) { if (from.style[k]) to.style[k] = from.style[k]; });
  var mt = from.hasAttribute('data-sp-push') ? from.getAttribute('data-sp-mt') : from.style.marginTop; if (mt) to.style.marginTop = mt;
  ['data-ls', 'data-tabs'].forEach(function (a) { if (from.hasAttribute(a)) to.setAttribute(a, from.getAttribute(a)); });
}
P.toggleList = function (tag, type) {
  var r = this.restoreSel(); if (!r) return;
  tag = tag.toUpperCase();
  this.rec();
  var bm = this.bookmark(), s = this;
  var bl = this.blocks().filter(function (b) { return !b.classList.contains('sp-img-caption'); });
  var allLi = bl.length && bl.every(function (b) { return b.tagName === 'LI'; });
  if (allLi) {
    var lists = []; bl.forEach(function (b) { if (lists.indexOf(b.parentNode) < 0) lists.push(b.parentNode); });
    var same = lists.every(function (l) { return l.tagName === tag && (!type || listStyleOf(l) === type); });
    if (same) bl.forEach(function (li) { s.liToP(li); });
    else lists.forEach(function (l) {
      var nl = l;
      if (l.tagName !== tag) { nl = document.createElement(tag); Array.prototype.slice.call(l.attributes).forEach(function (a) { if (a.name !== 'start' || tag === 'OL') nl.setAttribute(a.name, a.value); }); while (l.firstChild) nl.appendChild(l.firstChild); l.parentNode.replaceChild(nl, l); }
      nl.style.listStyleType = type || listTypeFor(tag, s.listLevel(nl));
    });
  } else {
    var made = [];
    bl.forEach(function (b) {
      if (b.tagName === 'LI') {
        var l = b.parentNode;
        if (l.tagName !== tag) { s.toggleListRetag(l, tag, type); }
        return;
      }
      var prev = b.previousElementSibling, list;
      if (prev && made.indexOf(prev) > -1) list = prev;
      else { list = document.createElement(tag); list.style.listStyleType = type || listTypeFor(tag, s.listLevel(b) + 1); b.parentNode.insertBefore(list, b); made.push(list); }
      var li = document.createElement('li'); copyParaStyle(b, li);
      while (b.firstChild) li.appendChild(b.firstChild);
      if (!li.firstChild) li.innerHTML = '<br>';
      list.appendChild(li); b.remove();
    });
    made.forEach(function (l) {
      var p = l.previousElementSibling, n = l.nextElementSibling;
      if (sameListStyle(p, l)) { while (l.firstChild) p.appendChild(l.firstChild); l.remove(); l = p; }
      if (sameListStyle(l, n)) { while (n.firstChild) l.appendChild(n.firstChild); n.remove(); }
    });
  }
  if (tag === 'OL' && type) this.lastOl = type; if (tag === 'UL' && type) this.lastUl = type;
  this.restoreBookmark(bm);
  this.changed();
};
P.toggleListRetag = function (l, tag, type) {
  var nl = document.createElement(tag);
  while (l.firstChild) nl.appendChild(l.firstChild);
  nl.style.listStyleType = type || listTypeFor(tag, this.listLevel(l));
  l.parentNode.replaceChild(nl, l);
};
/* li → paragraf biasa. keepPos: pertahankan posisi teks (Backspace di awal item, perilaku Word) */
P.liToP = function (li, keepPos) {
  var list = li.parentNode, m = keepPos ? this.para(li) : null;
  var p = document.createElement('p'); copyParaStyle(li, p);
  var nested = [];
  while (li.firstChild) { var c = li.firstChild; if (isList(c)) { nested.push(c); li.removeChild(c); } else p.appendChild(c); }
  if (!p.firstChild) p.innerHTML = '<br>';
  var after = []; for (var n = li.nextSibling; n; n = n.nextSibling) after.push(n);
  var tail = null;
  if (after.length) {
    tail = list.cloneNode(false);
    after.forEach(function (a) { tail.appendChild(a); });
    if (list.tagName === 'OL') { var st = num(list.getAttribute('start')) || 1; var cnt = qsa(list, ':scope > li').length - 1; tail.setAttribute('start', st + cnt); }
  }
  var ref = list.nextSibling, par = list.parentNode;
  par.insertBefore(p, ref);
  nested.forEach(function (x) { par.insertBefore(x, ref); });
  if (tail) par.insertBefore(tail, ref);
  li.remove();
  if (!list.children.length) list.remove();
  if (keepPos && m) { var m2 = this.para(p); this.setIndent(p, m2, { L: m.L, TI: 0 }); }
  return p;
};
P.demote = function (lis) {
  var s = this, done = [];
  lis.forEach(function (li) {
    var list = li.parentNode, prev = li.previousElementSibling;
    if (!prev || prev.tagName !== 'LI') {
      if (done.indexOf(list) < 0) { done.push(list); var ml = num(getComputedStyle(list).marginLeft); list.style.marginLeft = toCm(ml + DEF_TAB); }
      return;
    }
    var sub = prev.lastElementChild;
    if (!(sub && sub.tagName === list.tagName)) { sub = document.createElement(list.tagName); sub.style.listStyleType = listTypeFor(list.tagName, s.listLevel(list) + 1); prev.appendChild(sub); }
    sub.appendChild(li);
    qsa(li, ':scope > ol, :scope > ul').forEach(function (own) {
      if (own.tagName !== sub.tagName) return;
      while (own.firstElementChild) sub.appendChild(own.firstElementChild); own.remove();
    });
  });
};
P.promote = function (lis) {
  var s = this, done = [];
  lis.forEach(function (li) {
    var list = li.parentNode, pli = list.parentNode;
    if (!pli || pli.tagName !== 'LI') {
      var ml = num(list.style.marginLeft ? parseLen(list.style.marginLeft) : 0);
      if (ml > 1) { if (done.indexOf(list) < 0) { done.push(list); list.style.marginLeft = ml - DEF_TAB > 1 ? toCm(ml - DEF_TAB) : ''; } }
      else s.liToP(li);
      return;
    }
    var following = []; for (var n = li.nextElementSibling; n; n = n.nextElementSibling) following.push(n);
    if (following.length) {
      var sub = qs(li, ':scope > ' + list.tagName.toLowerCase());
      if (!sub) { sub = document.createElement(list.tagName); sub.style.listStyleType = listStyleOf(list); li.appendChild(sub); }
      following.forEach(function (f) { sub.appendChild(f); });
    }
    pli.parentNode.insertBefore(li, pli.nextSibling);
    if (!list.children.length) list.remove();
  });
};
P.listStart = function (restart) {
  var b = this.anchorBlock(), li = b && b.closest('li'), s = this; if (!li) return;
  var list = li.parentNode; if (list.tagName !== 'OL') return;
  if (restart === true) { this.rec(); this.splitListAt(li, 1); this.changed(); return; }
  var cur = (num(list.getAttribute('start')) || 1) + qsa(list, ':scope > li').indexOf(li);
  this.dialog('Atur nilai penomoran', '<div class="sp-row"><label>Mulai dari nomor<input name="v" value="' + cur + '" inputmode="numeric"></label></div>', function (f) {
    var v = parseInt(f.v.value, 10); if (!(v >= 0)) return;
    s.restoreSel(); s.rec(); s.splitListAt(li, v); s.changed();
  });
};
P.splitListAt = function (li, startVal) {
  var list = li.parentNode;
  if (li === list.firstElementChild) { if (startVal === 1) list.removeAttribute('start'); else list.setAttribute('start', startVal); return; }
  var tail = list.cloneNode(false);
  for (var n = li; n;) { var nx = n.nextSibling; tail.appendChild(n); n = nx; }
  if (startVal === 1) tail.removeAttribute('start'); else tail.setAttribute('start', startVal);
  list.parentNode.insertBefore(tail, list.nextSibling);
};

/* ================================================================
 * EVENT & KEYBOARD (perilaku tombol ala MS Word)
 * ================================================================ */
P.on = function (el, ev, fn, opt) { el.addEventListener(ev, fn, opt); this._listeners.push([el, ev, fn, opt]); };
P.bind = function () {
  var s = this, ed = s.ed, wrap = s.wrap;

  /* Gambar (mis. kop dari /api/uploads/) sering selesai dimuat SETELAH halaman
     dihitung. Tingginya saat itu masih 0, sehingga semua pemisah halaman
     bergeser dan baru benar setelah ada relayout lain (ganti zoom, ketik).
     Event load gambar tidak bubble, jadi ditangkap di fase capture: satu
     listener untuk semua gambar, termasuk yang disisipkan belakangan. */
  var imgSettled = function (e) { if (e.target && e.target.tagName === 'IMG') s.relayout(); };
  s.on(ed, 'load', imgSettled, true);
  s.on(ed, 'error', imgSettled, true);

  /* toolbar/ruler/menu tidak boleh mencuri seleksi editor */
  s.on(wrap, 'mousedown', function (e) {
    var t = e.target;
    if (t.closest('input,select,textarea,.sp-modal')) return;
    if (t.closest('.sp-toolbar,.sp-menu,.sp-rulerbar,.sp-imgtb,.sp-linkpop,.sp-status')) e.preventDefault();
  });
  s.on(wrap, 'click', function (e) {
    var t = e.target, b;
    if (t.closest('.sp-menu,.sp-modal')) return;
    if ((b = t.closest('[data-menu]'))) { s.openMenu(b.getAttribute('data-menu'), b); return; }
    if ((b = t.closest('[data-cmd]'))) { s.closeMenu(); s.cmd(b.getAttribute('data-cmd'), b); return; }
    if ((b = t.closest('[data-img]'))) { s.imgCmd(b.getAttribute('data-img')); return; }
    if ((b = t.closest('[data-lp]'))) { s.linkCmd(b.getAttribute('data-lp')); return; }
    if (t.closest('.sp-tabsel')) { s.cycleTabType(); return; }
  });
  /* select & combo ukuran */
  var st = qs(s.tb, '.sp-style'), fo = qs(s.tb, '.sp-font'), sz = qs(s.tb, '.sp-size');
  s.on(st, 'change', function () { s.setBlockTag(st.value); s.focus(); });
  s.on(fo, 'change', function () { s.setFontName(fo.value); s.focus(); });
  s.on(sz, 'keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); s.setFontSize(sz.value); s.focus(); }
    else if (e.key === 'Escape') { s.updateUI(); s.focus(); }
  });
  s.on(sz, 'change', function () { if (document.activeElement === sz) s.setFontSize(sz.value); });
  s.on(sz, 'focus', function () { sz.select(); });

  /* editor */
  s.on(ed, 'keydown', function (e) { s.onKey(e); });
  s.on(ed, 'beforeinput', function (e) {
    var t = e.inputType || '';
    if (t === 'historyUndo') { e.preventDefault(); s.undo(); return; }
    if (t === 'historyRedo') { e.preventDefault(); s.redo(); return; }
    if (s.selImg && /^(insert|delete)/.test(t)) s.deselectImg();
    if (/^insert(Text|CompositionText|ReplacementText)/.test(t)) s.rec('type');
    else if (/^delete/.test(t)) s.rec('del');
    else if (/^insert(Paragraph|LineBreak)/.test(t)) s.rec('para');
    else if (/^format/.test(t)) s.rec();
  });
  s.on(ed, 'input', function (e) {
    if (qs(ed, 'font')) s.convertFonts();
    qsa(ed, 'span[style*="px"]').forEach(function (sp) {
      var f = sp.style.fontSize; if (/px$/.test(f)) sp.style.fontSize = rnd(parseFloat(f) / PT * 2, 0) / 2 + 'pt';
    });
    var stray = !ed.firstElementChild || Array.prototype.some.call(ed.childNodes, function (n) {
      return (n.nodeType === 3 && n.nodeValue.replace(/\s/g, '').length) || (n.nodeType === 1 && !isFlowBlock(n.tagName) && !n.classList.contains('sp-img-wrap') && !n.classList.contains('sp-pagebreak'));
    });
    if (stray) {
      var bm = s.bookmark(); s.wrapRuns(ed); if (!ed.firstElementChild) ed.innerHTML = '<p><br></p>'; s.restoreBookmark(bm);
    }
    if (e.inputType === 'insertParagraph') s.afterEnter();
    s.hideLinkPop();
    s.changed();
  });
  s.on(ed, 'paste', function (e) { s.onPaste(e); });
  s.on(ed, 'drop', function (e) { s.onDrop(e); });
  s.on(ed, 'mousedown', function (e) {
    s.closeMenu();
    if (s.tblMouseDown(e)) return;
    var img = e.target.closest && e.target.closest('img');
    if (img && ed.contains(img)) { e.preventDefault(); s.selectImg(img); return; }
    if (s.selImg) s.deselectImg();
  });
  s.on(ed, 'mousemove', function (e) { s.tblMouseMove(e); });
  s.on(ed, 'mouseup', function () { if (s._painter) setTimeout(function () { s.painterApply(); }, 0); });
  s.on(ed, 'click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (a && ed.contains(a)) {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); window.open(a.href, '_blank', 'noopener'); return; }
      s.showLinkPop(a);
    } else s.hideLinkPop();
  });
  s.on(ed, 'contextmenu', function (e) {
    var c = e.target.closest && e.target.closest('td,th');
    if (c && ed.contains(c)) { e.preventDefault(); s.tableMenu(e, c); }
  });
  s.on(ed, 'focus', function () { Editor.active = s; });
  s.on(ed, 'dragstart', function (e) { if (e.target.tagName === 'IMG') e.preventDefault(); });

  var onSel = rafThrottle(function () {
    if (!s.range()) return;
    s.saveSel(); Editor.active = s;
    s.updateUI(); if (!s._drag) s.updateRuler(); s.status();
  });
  s.on(document, 'selectionchange', onSel);
  s.on(document, 'mousedown', function (e) {
    if (!wrap.contains(e.target)) { s.closeMenu(); s.hideLinkPop(); return; }
    if (!e.target.closest('.sp-menu,[data-menu]')) s.closeMenu();
    if (!e.target.closest('.sp-linkpop,a')) s.hideLinkPop();
  });
  s.on(document, 'keydown', function (e) {
    if (e.key === 'Escape') {
      if (s.menu.classList.contains('show')) { s.closeMenu(); return; }
      if (s._painter) { s._painter = null; wrap.classList.remove('sp-painting'); qs(s.tb, '[data-cmd=painter]').classList.remove('on'); return; }
      if (wrap.classList.contains('sp-full') && !qs(wrap, '.sp-modal.show')) s.toggleFull(false);
    }
  });
  var pos = rafThrottle(function () { s.positionRuler(); s.updateImgBox(); });
  s.on(s.scroll, 'scroll', pos);
  s.on(window, 'resize', pos);
  s.on(s.scroll, 'wheel', function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault(); s.setZoom(s.zoom + (e.deltaY < 0 ? 0.1 : -0.1));
  }, { passive: false });
  var zr = qs(wrap, '.sp-zoom');
  s.on(zr, 'input', function () { s.setZoom(zr.value / 100); });

  s.bindRuler();
  s.bindImg();
};

P.cmd = function (c) {
  var s = this, lc = s._lastColor || {};
  switch (c) {
    case 'undo': s.undo(); break;
    case 'redo': s.redo(); break;
    case 'bold': case 'italic': case 'underline': case 'strikeThrough': case 'subscript': case 'superscript': s.exec(c); break;
    case 'grow': s.growFont(1); break;
    case 'shrink': s.growFont(-1); break;
    case 'color': s.setColor(lc.c || '#c00000'); break;
    case 'hilite': s.setColor(lc.h || '#ffff00', true); break;
    case 'painter':
      if (s._painter) { s._painter = null; s.wrap.classList.remove('sp-painting'); qs(s.tb, '[data-cmd=painter]').classList.remove('on'); }
      else s.painterPick();
      break;
    case 'clear': s.clearFormat(); break;
    case 'alignLeft': s.align('left'); break;
    case 'alignCenter': s.align('center'); break;
    case 'alignRight': s.align('right'); break;
    case 'alignJustify': s.align('justify'); break;
    case 'ul': case 'ol':
      var ab = s.anchorBlock(), inL = ab && ab.tagName === 'LI';
      s.toggleList(c.toUpperCase(), inL ? null : (c === 'ul' ? s.lastUl : s.lastOl)); break;
    case 'outdent': s.indent(-1); break;
    case 'indent': s.indent(1); break;
    case 'paraDlg': s.paraDialog(); break;
    case 'tabsDlg': s.tabsDialog(); break;
    case 'marks': s.wrap.classList.toggle('sp-marks'); s.updateUI(); break;
    case 'image': s.pickImage(); break;
    case 'link': s.linkDialog(); break;
    case 'hr': s.insertHR(); break;
    case 'pagebreak': s.insertPageBreak(); break;
    case 'pageSetup': s.pageDialog(); break;
    case 'print': s.print(); break;
    case 'exportDoc': s.exportDoc(); break;
    case 'fullscreen': s.toggleFull(); break;
    case 'zoomIn': s.setZoom(s.zoom + 0.1); break;
    case 'zoomOut': s.setZoom(s.zoom - 0.1); break;
  }
};

P.onKey = function (e) {
  var s = this, k = e.key, code = e.code, mod = e.ctrlKey || e.metaKey, lk = (k || '').toLowerCase();
  if (e.isComposing) return;
  if (s.selImg) {
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); s.imgCmd('delete'); return; }
    if (/^Arrow|Enter/.test(k)) {
      e.preventDefault(); var w = s.selImg.closest('.sp-img-wrap') || s.selImg, n = w.nextElementSibling;
      s.deselectImg();
      if (n) s.setCaret(n, 0); return;
    }
    if (!mod) s.deselectImg();
  }
  if (k === 'Tab' && !mod && !e.altKey) { e.preventDefault(); s.handleTab(e.shiftKey); return; }
  if (mod && !e.altKey) {
    var h = null;
    if (lk === 'z' && !e.shiftKey) h = function () { s.undo(); };
    else if (lk === 'y' || (lk === 'z' && e.shiftKey)) h = function () { s.redo(); };
    else if (lk === 'b' && !e.shiftKey) h = function () { s.exec('bold'); };
    else if (lk === 'i' && !e.shiftKey) h = function () { s.exec('italic'); };
    else if (lk === 'u' && !e.shiftKey) h = function () { s.exec('underline'); };
    else if (lk === 'l' && e.shiftKey) h = function () { s.cmd('ul'); };
    else if (lk === 'l') h = function () { s.align('left'); };
    else if (lk === 'e' && !e.shiftKey) h = function () { s.align('center'); };
    else if (lk === 'r' && !e.shiftKey) h = function () { s.align('right'); };
    else if (lk === 'j' && !e.shiftKey) h = function () { s.align('justify'); };
    else if (lk === 'm') h = function () { s.indent(e.shiftKey ? -1 : 1); };
    else if (code === 'BracketRight' || (e.shiftKey && (k === '>' || code === 'Period'))) h = function () { s.growFont(1); };
    else if (code === 'BracketLeft' || (e.shiftKey && (k === '<' || code === 'Comma'))) h = function () { s.growFont(-1); };
    else if (code === 'Equal' || k === '=' || k === '+') h = function () { s.exec(e.shiftKey || k === '+' ? 'superscript' : 'subscript'); };
    else if (k === 'Enter') h = function () { s.insertPageBreak(); };
    else if (lk === 'p' && !e.shiftKey) h = function () { s.print(); };
    else if (lk === 'k') h = function () { s.linkDialog(); };
    else if (code === 'Space' || k === ' ') h = function () { s.clearFormat(); };
    else if (e.shiftKey && (code === 'Digit8' || k === '*')) h = function () { s.cmd('marks'); };
    else if (e.shiftKey && lk === 'n') h = function () { s.setBlockTag('p'); };
    if (h) { e.preventDefault(); e.stopPropagation(); h(); return; }
    return;
  }
  if (k === 'Enter') { s.handleEnter(e); return; }
  if (k === 'Backspace') { s.handleBackspace(e); return; }
  if (k === 'Delete') { s.handleDelete(e); return; }
};

/* ---------- TAB ala Word ---------- */
P.handleTab = function (shift) {
  var s = this, r = s.restoreSel(); if (!r) return;
  var n = boundaryNode(r.startContainer, r.startOffset); if (n.nodeType === 3) n = n.parentNode;
  var cell = n.closest && n.closest('td,th'), li = n.closest && n.closest('li');
  if (cell && s.ed.contains(cell) && !(li && cell.contains(li))) { s.moveCell(cell, shift ? -1 : 1); return; }
  var bl = s.blocks(), b = bl[0];
  if (!b) return;
  var allLi = bl.every(function (x) { return x.tagName === 'LI'; });
  if (allLi && (bl.length > 1 || s.atBlockStart(b, r) || shift)) { s.indent(shift ? -1 : 1); return; }
  if (bl.length > 1) { s.indent(shift ? -1 : 1); return; }
  if (shift) { if (s.atBlockStart(b, r)) s.indent(-1); return; }
  if (r.collapsed && s.atBlockStart(b, r) && !isEmptyBlock(b) && /^(P|H[1-6]|DIV)$/.test(b.tagName)) {
    var m = s.para(b);
    s.rec();
    if (m.TI < 0.5) s.setIndent(b, m, { TI: m.TI < -0.5 ? 0 : DEF_TAB });
    else s.setIndent(b, m, { L: m.L + DEF_TAB });
    s.changed(); return;
  }
  s.insertTab();
};
P.moveCell = function (cell, dir) {
  var s = this, tbl = cell.closest('table');
  var cells = qsa(tbl, 'td,th').filter(function (c) { return c.closest('table') === tbl; });
  var i = cells.indexOf(cell) + dir;
  if (i >= cells.length) {
    s.rec(); s.addRow(cell.parentNode.parentNode.lastElementChild, true);
    cells = qsa(tbl, 'td,th').filter(function (c) { return c.closest('table') === tbl; });
    s.changed();
  }
  if (i < 0) return;
  var t = cells[i], rr = document.createRange(); rr.selectNodeContents(t);
  var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(rr); s._saved = rr.cloneRange();
};

/* ---------- ENTER ---------- */
P.handleEnter = function (e) {
  var s = this, b = s.anchorBlock();
  if (e.shiftKey) return; // <br> bawaan browser (line break manual Word)
  if (b && b.tagName === 'LI' && isEmptyBlock(b) && !qs(b, 'ol,ul')) {
    e.preventDefault(); s.rec();
    var p;
    if (s.listLevel(b) > 1) { s.promote([b]); p = b; } else p = s.liToP(b);
    s.setCaret(p, 0); s.changed(); return;
  }
};
/* Word: Enter di akhir Judul → paragraf berikutnya kembali Normal */
P.afterEnter = function () {
  var s = this, b = s.anchorBlock(); if (!b) return;
  var prev = b.previousElementSibling;
  if (/^H[1-6]$/.test(b.tagName) && prev && prev.tagName === b.tagName && isEmptyBlock(b)) {
    var p = document.createElement('p'); p.innerHTML = '<br>';
    b.parentNode.replaceChild(p, b); s.setCaret(p, 0);
  }
  // paragraf baru tidak mewarisi penanda halaman
  qsa(s.ed, '[data-sp-push]').forEach(unpush);
};

/* ---------- BACKSPACE / DELETE ---------- */
function zwEmpty(n) { return n && n.nodeType === 3 && !n.nodeValue.replace(/\u200B/g, '').length; }
P.tabNear = function (r, back) {
  var c = r.startContainer, o = r.startOffset, n;
  if (c.nodeType === 3) {
    var part = back ? c.nodeValue.slice(0, o) : c.nodeValue.slice(o);
    if (part.replace(/\u200B/g, '').length) return null;
    n = c;
    while (n && !(back ? n.previousSibling : n.nextSibling) && n.parentNode && !isBlockTag(n.parentNode.tagName)) n = n.parentNode;
    n = n && (back ? n.previousSibling : n.nextSibling);
  } else n = back ? c.childNodes[o - 1] : c.childNodes[o];
  for (var g = 0; g < 20 && n; g++) {
    if (zwEmpty(n)) { n = back ? n.previousSibling : n.nextSibling; continue; }
    if (isTab(n)) return n;
    if (n.nodeType === 1 && !isBlockTag(n.tagName) && n.tagName !== 'BR' && n.tagName !== 'IMG' && (back ? n.lastChild : n.firstChild)) { n = back ? n.lastChild : n.firstChild; continue; }
    return null;
  }
  return null;
};
P.removeTab = function (t, back) {
  var s = this, par = t.parentNode, prev = t.previousSibling, next = t.nextSibling;
  while (zwEmpty(next)) { var nn = next.nextSibling; next.remove(); next = nn; }
  if (back) while (zwEmpty(prev)) { var pp = prev.previousSibling; prev.remove(); prev = pp; }
  var rr = document.createRange();
  if (prev && prev.nodeType === 3) rr.setStart(prev, prev.length);
  else if (next && next.nodeType === 3) rr.setStart(next, 0);
  else { rr.setStartBefore(t); }
  t.remove();
  if (!par.firstChild) par.appendChild(document.createElement('br'));
  rr.collapse(true);
  var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(rr); s._saved = rr.cloneRange();
};
P.handleBackspace = function (e) {
  var s = this, r = s.range(); if (!r) return;
  if (!r.collapsed) { s.rec('del'); return; }
  var b = s.blockOf(boundaryNode(r.startContainer, r.startOffset));
  var t = s.tabNear(r, true);
  if (t) { e.preventDefault(); s.rec('del'); s.removeTab(t, true); s.changed(); return; }
  if (!b || !s.atBlockStart(b, r)) { s.rec('del'); return; }
  if (b.tagName === 'LI') {
    e.preventDefault(); s.rec();
    var p = s.liToP(b, true); s.setCaret(p, 0); s.changed(); return;
  }
  if (/^(P|H[1-6]|DIV)$/.test(b.tagName) && !b.classList.contains('sp-img-caption')) {
    var m = s.para(b);
    if (m.TI > 0.5) { e.preventDefault(); s.rec(); s.setIndent(b, m, { TI: 0 }); s.changed(); return; }
    if (m.L > 0.5 && m.TI >= -0.5) {
      e.preventDefault(); s.rec();
      s.setIndent(b, m, { L: Math.max(0, (Math.ceil((m.L - 0.5) / DEF_TAB) - 1) * DEF_TAB) }); s.changed(); return;
    }
  }
  if (/^T[DH]$/.test(b.tagName) || (b.parentNode && /^T[DH]$/.test(b.parentNode.tagName) && !b.previousElementSibling)) { e.preventDefault(); return; }
  var prev = b.previousElementSibling;
  if (prev && (prev.classList.contains('sp-pagebreak') || prev.tagName === 'HR')) { e.preventDefault(); s.rec(); prev.remove(); s.changed(); return; }
  if (prev && prev.classList.contains('sp-img-wrap')) {
    e.preventDefault();
    if (isEmptyBlock(b) && b.nextElementSibling) { s.rec(); b.remove(); s.changed(); }
    var im = qs(prev, 'img'); if (im) s.selectImg(im); return;
  }
  if (prev && prev.tagName === 'TABLE') {
    e.preventDefault();
    if (isEmptyBlock(b) && b.nextElementSibling) { s.rec(); b.remove(); s.changed(); }
    var cells = qsa(prev, 'td,th'); if (cells.length) s.setCaret(cells[cells.length - 1], 0, true); return;
  }
  s.rec('del');
};
P.handleDelete = function (e) {
  var s = this, r = s.range(); if (!r) return;
  if (!r.collapsed) { s.rec('del'); return; }
  var t = s.tabNear(r, false);
  if (t) { e.preventDefault(); s.rec('del'); s.removeTab(t, false); s.changed(); return; }
  var b = s.blockOf(boundaryNode(r.startContainer, r.startOffset));
  if (b && /^(P|H[1-6]|DIV)$/.test(b.tagName)) {
    var end = document.createRange(); end.setStart(r.startContainer, r.startOffset); end.setEnd(b, b.childNodes.length);
    if (!end.toString().replace(/\u200B/g, '').length && !qs(end.cloneContents(), '.sp-tab,img')) {
      var nx = b.nextElementSibling;
      if (nx && (nx.classList.contains('sp-pagebreak') || nx.tagName === 'HR')) { e.preventDefault(); s.rec(); nx.remove(); s.changed(); return; }
      if (nx && (nx.tagName === 'TABLE' || nx.classList.contains('sp-img-wrap'))) {
        e.preventDefault();
        if (isEmptyBlock(b)) { s.rec(); var tgt = nx; b.remove(); s.changed(); if (tgt.tagName === 'TABLE') { var c0 = qs(tgt, 'td,th'); if (c0) s.setCaret(c0, 0); } else { var im = qs(tgt, 'img'); if (im) s.selectImg(im); } }
        return;
      }
    }
  }
  s.rec('del');
};

P.destroy = function () {
  this._listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
  this._listeners = [];
  var i = Editor.instances.indexOf(this); if (i > -1) Editor.instances.splice(i, 1);
  if (Editor.active === this) Editor.active = Editor.instances[0] || null;
  this.ct.innerHTML = '';
};

/* ================================================================
 * RULER ala MS Word (cm): zona margin abu-abu, angka dihitung dari margin kiri
 * ke dua arah, penanda jam pasir (baris pertama ▽, gantung △, kotak = keduanya),
 * inden kanan △, tab stop (klik = pasang, seret keluar = hapus), seret batas
 * abu-abu/putih = ubah margin. Snap 0,25 cm; tahan Alt untuk geser bebas.
 * ================================================================ */
var TAB_ICON = { l: RM.tl, c: RM.tc, r: RM.tr };
var TAB_NAME = { l: 'Kiri', c: 'Tengah', r: 'Kanan' };
P.buildRulerMarks = function () {
  var mk_ = qs(this.ruler, '.sp-rmarks');
  mk_.innerHTML =
    '<div class="sp-rmg" data-rk="ml" title="Margin kiri"></div><div class="sp-rmg" data-rk="mr" title="Margin kanan"></div>' +
    '<div class="sp-rdefs"></div><div class="sp-rtabs"></div>' +
    '<div class="sp-rm sp-rm-first" data-rk="first" title="Inden Baris Pertama">' + RM.first + '</div>' +
    '<div class="sp-rm sp-rm-hang" data-rk="hang" title="Inden Gantung">' + RM.hang + '</div>' +
    '<div class="sp-rm sp-rm-left" data-rk="left" title="Inden Kiri">' + RM.box + '</div>' +
    '<div class="sp-rm sp-rm-right" data-rk="right" title="Inden Kanan">' + RM.hang + '</div>';
  this.rk = {};
  var s = this;
  qsa(mk_, '[data-rk]').forEach(function (e) { s.rk[e.getAttribute('data-rk')] = e; });
  this.rTabs = qs(mk_, '.sp-rtabs'); this.rDefs = qs(mk_, '.sp-rdefs');
};
P.drawRuler = function () {
  var z = this.zoom, W = this.pageW, m = this.doc.m, rt = qs(this.ruler, '.sp-rticks'), h = [];
  this.ruler.style.width = W * z + 'px';
  h.push('<div class="sp-rz" style="left:0;width:' + m.l * z + 'px"></div>');
  h.push('<div class="sp-rz" style="left:' + (W - m.r) * z + 'px;width:' + m.r * z + 'px"></div>');
  var q = 0.25 * CM, k0 = -Math.floor(m.l / q + 1e-6), k1 = Math.floor((W - m.l) / q + 1e-6);
  for (var k = k0; k <= k1; k++) {
    if (k === 0) continue;
    var x = (m.l + k * q) * z, a = Math.abs(k);
    if (x < 2 || x > W * z - 2) continue;
    if (a % 4 === 0) h.push('<span class="sp-rn" style="left:' + rnd(x, 1) + 'px">' + (a / 4) + '</span>');
    else if (a % 2 === 0) h.push('<i class="sp-rt sp-rt-h" style="left:' + rnd(x, 1) + 'px"></i>');
    else if (z >= 0.7) h.push('<i class="sp-rt sp-rt-q" style="left:' + rnd(x, 1) + 'px"></i>');
  }
  rt.innerHTML = h.join('');
  this.rk.ml.style.left = m.l * z + 'px';
  this.rk.mr.style.left = (W - m.r) * z + 'px';
  this.positionRuler();
  this.updateRuler();
};
P.positionRuler = function () {
  var clip = this.ruler.parentNode, cr = clip.getBoundingClientRect(), pr = this.page.getBoundingClientRect();
  this.ruler.style.transform = 'translateX(' + rnd(pr.left - cr.left, 1) + 'px)';
};
/* posisi penanda untuk paragraf aktif */
P.updateRuler = function () {
  if (!this.rk) return;
  var b = this.anchorBlock(); if (!b || !this.ed.contains(b)) return;
  var m = this.para(b);
  this._rm = m;
  this.placeMarks(m.ref, m.L, m.TI, m.R, m.tabs);
};
P.placeMarks = function (ref, L, TI, R, tabs) {
  var z = this.zoom, rk = this.rk;
  rk.first.style.left = (ref.left + L + TI) * z + 'px';
  rk.hang.style.left = (ref.left + L) * z + 'px';
  rk.left.style.left = (ref.left + L) * z + 'px';
  rk.right.style.left = (ref.right - R) * z + 'px';
  var h = '';
  (tabs || []).forEach(function (t, i) {
    h += '<div class="sp-rtab sp-rtab-' + t.t + '" data-rk="tab" data-i="' + i + '" style="left:' + (ref.left + t.x) * z + 'px" title="Tab ' + TAB_NAME[t.t] + ' ' + fmtCm(t.x) + '">' + TAB_ICON[t.t] + '</div>';
  });
  if (this.rTabs.innerHTML !== h) this.rTabs.innerHTML = h;
  // tab stop default (tanda kecil abu-abu di bawah ruler) sesudah tab khusus terakhir
  var last = tabs && tabs.length ? tabs[tabs.length - 1].x : 0, d = '', max = ref.right - ref.left;
  for (var x = (Math.floor(last / DEF_TAB) + 1) * DEF_TAB; x < max - 2; x += DEF_TAB) d += '<i style="left:' + rnd((ref.left + x) * z, 1) + 'px"></i>';
  if (this.rDefs.innerHTML !== d) this.rDefs.innerHTML = d;
};
P.cycleTabType = function () {
  var o = ['l', 'c', 'r'], t = o[(o.indexOf(this.tabType) + 1) % 3], b = qs(this.wrap, '.sp-tabsel');
  this.tabType = t; b.innerHTML = TAB_ICON[t];
  b.title = 'Jenis tab: ' + TAB_NAME[t] + ' — klik untuk ganti, lalu klik di ruler untuk memasang tab stop';
};
P.showTip = function (text, cx, cy) {
  var t = this.tip, wr = this.wrap.getBoundingClientRect();
  t.textContent = text; t.classList.add('show');
  var x = cx - wr.left + 12, y = cy - wr.top + 16;
  t.style.left = Math.min(x, wr.width - t.offsetWidth - 6) + 'px'; t.style.top = y + 'px';
};
P.hideTip = function () { this.tip.classList.remove('show'); };
P.showGuide = function (x) { this.guide.style.left = rnd(x, 2) + 'px'; this.guide.classList.add('show'); };
P.hideGuide = function () { this.guide.classList.remove('show'); };

P.bindRuler = function () {
  var s = this, ru = s.ruler, clip = ru.parentNode;
  function px(e) { return (e.clientX - ru.getBoundingClientRect().left) / s.zoom; } // posisi di koordinat halaman
  function snapTo(v, base, e) { if (e.altKey) return v; return base + Math.round((v - base) / SNAP) * SNAP; }

  s.on(clip, 'pointerdown', function (e) {
    if (e.button !== 0) return;
    var el = e.target.closest('[data-rk]'), k = el ? el.getAttribute('data-rk') : null;
    var r = s.restoreSel(); if (!r) return;
    var bl = s.blocks(); if (!bl.length) return;
    var anchor = s.anchorBlock(), m0 = s.para(anchor);
    var d = { k: k, m0: m0, list: bl.map(function (b) { return { b: b, m: s.para(b) }; }), moved: false, x0: e.clientX, y0: e.clientY };
    var x = px(e), rel = x - m0.ref.left;
    if (!k) {
      // klik di area ruler: pasang tab stop baru (hanya di area teks)
      if (x < s.doc.m.l - 1 || x > s.pageW - s.doc.m.r + 1) return;
      k = d.k = 'tab';
      var nx = snapTo(rel, 0, e);
      if (nx <= 0) return;
      s.rec();
      d.list.forEach(function (it) {
        var t = it.m.tabs.filter(function (q) { return Math.abs(q.x - nx) > 1; });
        t.push({ t: s.tabType, x: nx, lead: '' }); setTabs(it.b, t); it.m.tabs = parseTabs(it.b);
      });
      m0.tabs = parseTabs(anchor);
      d.ti = m0.tabs.map(function (q) { return Math.abs(q.x - nx) < 1; }).indexOf(true);
      d.recDone = true; d.moved = true;
      s.relayout();
    } else if (k === 'tab') {
      d.ti = +el.getAttribute('data-i');
    }
    e.preventDefault();
    s._drag = d;
    try { clip.setPointerCapture(e.pointerId); } catch (er) {}
    clip.classList.add('sp-dragging');
    if (el) el.classList.add('sp-active');
    d.el = el;
    move(e);
  });
  function move(e) {
    var d = s._drag; if (!d) return;
    var x = px(e), m0 = d.m0, ref = m0.ref, rel, txt = '';
    if (!d.moved && Math.abs(e.clientX - d.x0) < 2 && Math.abs(e.clientY - d.y0) < 2) { return; }
    if (!d.recDone) { s.rec(); d.recDone = true; }
    d.moved = true;
    var textW = ref.right - ref.left, W = s.pageW;
    switch (d.k) {
      case 'first': case 'hang': case 'left': {
        rel = snapTo(x - ref.left, 0, e);
        rel = clamp(rel, -ref.left, textW - m0.R - 0.5 * CM);
        var F = m0.L + m0.TI, L = m0.L, TI = m0.TI;
        if (d.k === 'first') { TI = rel - m0.L; txt = 'Inden baris pertama: ' + fmtCm(rel); }
        else if (d.k === 'hang') { L = rel; TI = F - rel; txt = 'Inden gantung: ' + fmtCm(rel) + ' (baris pertama ' + fmtCm(F) + ')'; }
        else { L = rel; txt = 'Inden kiri: ' + fmtCm(rel); }
        d.list.forEach(function (it) {
          var v = d.k === 'first' ? { TI: TI } : d.k === 'hang' ? { L: L, TI: (it.m.L + it.m.TI) - L } : { L: L };
          if (d.k === 'hang' && it.b === d.m0.b) v.TI = TI;
          s.setIndent(it.b, it.m, v);
        });
        s.placeMarks(ref, L, TI, m0.R, m0.tabs);
        s.showGuide(ref.left + rel);
        break;
      }
      case 'right': {
        var rx = snapTo(x - ref.left, 0, e);
        rx = clamp(rx, Math.max(m0.L, m0.L + m0.TI) + 0.5 * CM, W - ref.left);
        var R = textW - rx;
        d.list.forEach(function (it) { s.setIndent(it.b, it.m, { R: R }); });
        s.placeMarks(ref, m0.L, m0.TI, R, m0.tabs);
        s.showGuide(ref.left + rx);
        txt = 'Inden kanan: ' + fmtCm(R);
        break;
      }
      case 'ml': case 'mr': {
        var dm = s.doc.m, v = e.altKey ? x : Math.round(x / SNAP) * SNAP;
        if (d.k === 'ml') { dm.l = clamp(v, 0, W - dm.r - 2 * CM); txt = 'Margin kiri: ' + fmtCm(dm.l); s.showGuide(dm.l); }
        else { dm.r = clamp(W - v, 0, W - dm.l - 2 * CM); txt = 'Margin kanan: ' + fmtCm(dm.r); s.showGuide(W - dm.r); }
        s.applyPage(true); s.relayout();
        break;
      }
      case 'tab': {
        var off = Math.abs(e.clientY - ru.getBoundingClientRect().top - 10) > 28;
        rel = snapTo(x - ref.left, 0, e);
        var tabs = m0.tabs.map(function (q) { return { t: q.t, x: q.x, lead: q.lead }; });
        var cur = tabs[d.ti]; if (!cur) break;
        d.remove = off || rel <= 0 || rel > textW + 1;
        if (d.el) d.el.classList.toggle('sp-gone', d.remove);
        var orig = m0.tabs[d.ti].x;
        if (d.remove) { tabs.splice(d.ti, 1); txt = 'Lepas untuk menghapus tab stop'; s.hideGuide(); }
        else { cur.x = rel; txt = 'Tab ' + TAB_NAME[cur.t] + ': ' + fmtCm(rel); s.showGuide(ref.left + rel); }
        d.list.forEach(function (it) {
          var t = it.m.tabs.map(function (q) { return { t: q.t, x: q.x, lead: q.lead }; });
          var j = t.map(function (q) { return Math.abs(q.x - orig) < 1; }).indexOf(true);
          if (j < 0) return;
          if (d.remove) t.splice(j, 1); else t[j].x = rel;
          setTabs(it.b, t);
        });
        var shown = d.remove ? tabs : tabs;
        s.placeMarks(ref, m0.L, m0.TI, m0.R, shown);
        if (!d.remove) { d.el = qs(s.rTabs, '[data-i="' + tabs.indexOf(cur) + '"]') || d.el; if (d.el) d.el.classList.add('sp-active'); }
        break;
      }
    }
    if (txt) s.showTip(txt, e.clientX, e.clientY);
    s.relayout();
  }
  s.on(clip, 'pointermove', function (e) {
    if (s._drag) { move(e); return; }
    var el = e.target.closest('[data-rk]');
    clip.style.cursor = el ? (/^(ml|mr)$/.test(el.getAttribute('data-rk')) ? 'ew-resize' : 'default') : 'default';
  });
  function end(e) {
    var d = s._drag; if (!d) return;
    s._drag = null;
    try { clip.releasePointerCapture(e.pointerId); } catch (er) {}
    clip.classList.remove('sp-dragging');
    qsa(ru, '.sp-active,.sp-gone').forEach(function (n) { n.classList.remove('sp-active', 'sp-gone'); });
    s.hideTip(); s.hideGuide();
    if (d.moved) s.changed(); else s.updateRuler();
  }
  s.on(clip, 'pointerup', end);
  s.on(clip, 'pointercancel', end);
  s.on(clip, 'dblclick', function (e) {
    var el = e.target.closest('[data-rk]'), k = el && el.getAttribute('data-rk');
    if (!k) return;
    if (k === 'tab') s.tabsDialog(+el.getAttribute('data-i'));
    else if (k === 'ml' || k === 'mr') s.pageDialog();
    else s.paraDialog();
  });
};

/* ================================================================
 * LAYOUT: tab → halaman → ruler → gambar. Dipanggil setelah setiap perubahan.
 * ================================================================ */
P.changed = function () { this.relayout(); this.sync(); };
P.relayout = function () {
  var s = this; if (s._rl) return;
  s._rl = requestAnimationFrame(function () { s._rl = 0; s.relayoutNow(); });
};
P.relayoutNow = function () {
  if (this._rl) { cancelAnimationFrame(this._rl); this._rl = 0; }
  this.layoutTabs();
  this.paginate();
  this.positionRuler();
  if (!this._drag) this.updateRuler();
  this.updateImgBox();
  this.status();
};
/* spasi baris mengikuti font dominan (Word: tinggi baris tergantung font) */
P.refreshLS = function (scope) {
  qsa(scope || this.ed, '[data-ls]').forEach(function (b) {
    var a = b.getAttribute('data-ls'); if (!a || a.charAt(0) === 'x') return;
    b.style.lineHeight = rnd(parseNum(a) * lhFactor(blockFont(b)), 3);
  });
};

/* unit aliran halaman: paragraf level atas, item list (termasuk bertingkat), baris tabel */
P.flowUnits = function () {
  var out = [];
  function brk(el) { var p = el.previousElementSibling; return !!(p && p.classList.contains('sp-pagebreak')); }
  function list(l, top) {
    for (var li = l.firstElementChild; li; li = li.nextElementSibling) {
      if (li.tagName !== 'LI') continue;
      out.push({ el: li, li: true, brk: top && li === l.firstElementChild && brk(l) });
      qsa(li, ':scope > ol, :scope > ul').forEach(function (sub) { list(sub, false); });
    }
  }
  for (var n = this.ed.firstElementChild; n; n = n.nextElementSibling) {
    var t = n.tagName;
    if (t === 'OL' || t === 'UL') list(n, true);
    else if (t === 'TABLE') {
      qsa(n, ':scope > tbody > tr, :scope > thead > tr, :scope > tfoot > tr, :scope > tr').forEach(function (tr, i) {
        out.push({ el: tr, tr: true, table: n, first: i === 0, brk: i === 0 && brk(n) });
      });
    }
    else if (!n.classList.contains('sp-pagebreak')) out.push({ el: n, brk: brk(n) });
  }
  return out;
};

P.paginate = function () {
  var s = this, ed = s.ed, z = s.zoom, H = s.pageH, m = s.doc.m, step = H + GAP, bodyH = H - m.t - m.b;
  qsa(ed, '[data-sp-push]').forEach(unpush);
  var units = s.flowUnits(), p = 0, edTop;
  function top0() { return ed.getBoundingClientRect().top; }
  edTop = top0();
  function rect(u) {
    var r = u.el.getBoundingClientRect(), top = (r.top - edTop) / z, bot = (r.bottom - edTop) / z;
    if (u.li) { var sub = qs(u.el, ':scope > ol, :scope > ul'); if (sub) bot = (sub.getBoundingClientRect().top - edTop) / z; }
    return { top: top, bot: bot };
  }
  for (var i = 0; i < units.length; i++) {
    var u = units[i], r = rect(u);
    var pageTop = p * step + m.t, limit = p * step + H - m.b;
    while (r.top >= (p + 1) * step - 0.5) { p++; pageTop = p * step + m.t; limit = p * step + H - m.b; }
    var force = u.brk && i > 0;
    var over = r.bot > limit + 0.5 && r.top > pageTop + 1 && (r.bot - r.top) <= bodyH + 0.5;
    if (force || over) {
      var target = (p + 1) * step + m.t, need = target - r.top;
      s.push(u, need);
      var r2 = rect(u), diff = target - r2.top;
      if (Math.abs(diff) > 0.5) { s.push(u, need + diff, true); }
      p++;
    } else if (r.bot > limit + 0.5) {
      // lebih tinggi dari satu halaman: dibiarkan melintas
      while (r.bot > p * step + H - m.b + 0.5) p++;
    }
  }
  var lastBot = 0, lc = ed.lastElementChild;
  if (lc) lastBot = (lc.getBoundingClientRect().bottom - edTop) / z;
  while (lastBot > p * step + H - m.b + 0.5) p++;
  var pages = p + 1, total = pages * step - GAP;
  s.pages = pages;
  ed.style.minHeight = total + 'px';
  s.page.style.height = total + 'px';
  s.stage.style.width = s.pageW * z + 'px';
  s.stage.style.height = total * z + 'px';
  var sh = '', W = s.pageW;
  for (var k = 0; k < pages; k++) {
    var y = k * step;
    sh += '<div class="sp-sheet" style="top:' + y + 'px;height:' + H + 'px;width:' + W + 'px">' +
      corner(m.l, m.t, 'tl') + corner(W - m.r, m.t, 'tr') + corner(m.l, H - m.b, 'bl') + corner(W - m.r, H - m.b, 'br') +
      (pages > 1 ? '<span class="sp-pnum">' + (k + 1) + '</span>' : '') + '</div>';
  }
  function corner(x, y, c) {
    var L = 14;
    return '<i class="sp-crop sp-crop-' + c + '" style="left:' + (c.charAt(1) === 'l' ? x - L : x) + 'px;top:' + (c.charAt(0) === 't' ? y - L : y) + 'px;width:' + L + 'px;height:' + L + 'px"></i>';
  }
  if (s._sheetsHTML !== sh) { s.sheets.innerHTML = sh; s._sheetsHTML = sh; }
};
P.push = function (u, need, replace) {
  if (u.tr && !u.first) {
    var tr = u.el, prev = tr.previousElementSibling;
    if (prev && prev.classList.contains('sp-tpush')) prev.remove();
    var cols = 0; qsa(tr, ':scope > td, :scope > th').forEach(function (c) { cols += c.colSpan || 1; });
    var ph = document.createElement('tr'); ph.className = 'sp-tpush'; ph.setAttribute('data-sp-push', '1');
    ph.innerHTML = '<td colspan="' + cols + '" contenteditable="false" style="height:' + rnd(Math.max(0, need), 2) + 'px"></td>';
    tr.parentNode.insertBefore(ph, tr);
    return;
  }
  var el = u.first ? u.table : u.el;
  if (!el.hasAttribute('data-sp-push')) {
    el._spNat = num(getComputedStyle(el).marginTop);
    el.setAttribute('data-sp-mt', el.style.marginTop || ''); el.setAttribute('data-sp-push', '1');
  }
  el.style.marginTop = rnd((el._spNat || 0) + Math.max(0, need), 2) + 'px';
};

P.status = function () {
  var s = this, r = s.range(), cur = 1, step = s.pageH + GAP;
  if (r) {
    var rc = r.getBoundingClientRect(); if (!rc.height) { var n = boundaryNode(r.startContainer, r.startOffset); if (n.nodeType === 3) n = n.parentNode; if (n.getBoundingClientRect) rc = n.getBoundingClientRect(); }
    var y = (rc.top - s.ed.getBoundingClientRect().top) / s.zoom; cur = clamp(Math.floor(y / step) + 1, 1, s.pages);
  }
  var txt = s.ed.textContent.replace(/[\u200B\t]/g, ' ').trim(), words = txt ? txt.split(/\s+/).length : 0;
  var pe = qs(s.wrap, '.sp-st-page'), we = qs(s.wrap, '.sp-st-words');
  pe.textContent = 'Halaman ' + cur + ' dari ' + s.pages;
  we.textContent = words + ' kata';
  var info = qs(s.wrap, '.sp-st-info');
  info.textContent = s.doc.paper + (s.doc.orient === 'landscape' ? ' lanskap' : '') + ' · ' + s.doc.font + ' ' + fmtNum(s.doc.size, 1) + ' pt';
};
P.setZoom = function (z) {
  z = clamp(rnd(z, 1), 0.5, 2);
  this.zoom = z;
  this.page.style.transform = z === 1 ? '' : 'scale(' + z + ')';
  var zr = qs(this.wrap, '.sp-zoom'); zr.value = Math.round(z * 100);
  qs(this.wrap, '.sp-zval').textContent = Math.round(z * 100) + '%';
  this.drawRuler();
  this.relayoutNow();
  this.positionRuler();
};

/* ================================================================
 * TABEL (gaya Word: garis 1px hitam/0,5 pt, padding sel 0,19 cm, isi rata atas)
 * ================================================================ */
var CELL_CSS = 'border:1px solid #000;padding:0 0.19cm;vertical-align:top';
var CELL_NOB = 'border:1px solid transparent;padding:0 0.19cm;vertical-align:top';
P.insertTable = function (rows, cols, noBorder) {
  rows = clamp(rows | 0, 1, 200); cols = clamp(cols | 0, 1, 30);
  var css = noBorder ? CELL_NOB : CELL_CSS, w = rnd(100 / cols, 4);
  var h = '<table class="' + (noBorder ? 'sp-nob' : '') + '" style="width:100%;border-collapse:collapse;table-layout:fixed"><colgroup>';
  for (var c = 0; c < cols; c++) h += '<col style="width:' + w + '%">';
  h += '</colgroup><tbody>';
  for (var r = 0; r < rows; r++) { h += '<tr>'; for (c = 0; c < cols; c++) h += '<td style="' + css + '"><p><br></p></td>'; h += '</tr>'; }
  h += '</tbody></table>';
  var t = mk('div', null, h).firstChild;
  if (!t.className) t.removeAttribute('class');
  this.restoreSel(); this.rec();
  this.insertBlocks([t]);
  this.setCaret(qs(t, 'td p'), 0);
  this.changed();
  return t;
};
/* sisipkan node level-blok di posisi kursor (paragraf dipecah seperti Word) */
P.insertBlocks = function (nodes) {
  var s = this, r = s.range() || s.restoreSel();
  var b = s.anchorBlock();
  if (!b || !s.ed.contains(b)) { nodes.forEach(function (n) { s.ed.appendChild(n); }); s.ensureTrailing(); return; }
  if (/^T[DH]$/.test(b.tagName)) { s.wrapRuns(b); b = s.anchorBlock(); }
  var target = b;
  while (target.parentNode !== s.ed && !/^T[DH]$/.test(target.parentNode.tagName)) target = target.parentNode;
  var parent = target.parentNode, ref;
  if (target !== b) ref = target.nextSibling; // di dalam list → sesudah list
  else if (isEmptyBlock(b) && !b.classList.contains('sp-img-caption')) { ref = b; }
  else {
    var tail = s.splitAt(b, r);
    ref = tail || b.nextSibling;
  }
  nodes.forEach(function (n) { parent.insertBefore(n, ref); });
  if (ref === b && isEmptyBlock(b) && (b.nextElementSibling || nodes.some(function (n) { return n.tagName === 'P'; }))) {
    var last = nodes[nodes.length - 1];
    if (last.tagName === 'TABLE' || last.tagName === 'HR' || last.classList.contains('sp-pagebreak') || last.classList.contains('sp-img-wrap')) { /* biarkan paragraf kosong sebagai penampung kursor */ }
    else b.remove();
  }
  s.ensureTrailing();
};
/* pecah paragraf b di range r → kembalikan paragraf ekor (atau null bila kursor di akhir) */
P.splitAt = function (b, r) {
  if (!r || !b.contains(r.startContainer)) return null;
  var t = document.createRange(); t.setStart(r.startContainer, r.startOffset); t.setEnd(b, b.childNodes.length);
  var frag = t.cloneContents();
  var d = document.createElement('div'); d.appendChild(frag);
  if (!d.textContent.replace(/[\u200B\s]/g, '').length && !qs(d, 'img,.sp-tab')) return null;
  var h = document.createRange(); h.setStart(b, 0); h.setEnd(r.startContainer, r.startOffset);
  var hd = document.createElement('div'); hd.appendChild(h.cloneContents());
  if (!hd.textContent.replace(/[\u200B\s]/g, '').length && !qs(hd, 'img,.sp-tab')) return b;
  var ex = t.extractContents(), tail = b.cloneNode(false);
  tail.removeAttribute('data-sp-push'); tail.removeAttribute('data-sp-mt');
  tail.appendChild(ex);
  if (isEmptyBlock(b)) b.innerHTML = '<br>';
  b.parentNode.insertBefore(tail, b.nextSibling);
  return tail;
};

/* ---------- operasi baris / kolom ---------- */
function rowCells(tr) { return qsa(tr, ':scope > td, :scope > th'); }
function emptyCell(c) {
  var n = c.cloneNode(false); n.removeAttribute('rowspan'); n.removeAttribute('colspan');
  n.innerHTML = '<p><br></p>'; return n;
}
P.addRow = function (tr, after) {
  var n = document.createElement('tr');
  rowCells(tr).forEach(function (c) { var e = emptyCell(c); if (c.colSpan > 1) e.colSpan = c.colSpan; n.appendChild(e); });
  tr.parentNode.insertBefore(n, after ? tr.nextSibling : tr);
  return n;
};
function colIndex(cell) { var i = 0, c = cell; while ((c = c.previousElementSibling)) i += c.colSpan || 1; return i; }
function cellAtCol(tr, idx) { var i = 0, cs = rowCells(tr); for (var k = 0; k < cs.length; k++) { var sp = cs[k].colSpan || 1; if (idx < i + sp) return cs[k]; i += sp; } return cs[cs.length - 1]; }
function tableRows(t) { return qsa(t, ':scope > tbody > tr, :scope > thead > tr, :scope > tfoot > tr, :scope > tr').filter(function (r) { return !r.classList.contains('sp-tpush'); }); }
P.ensureCols = function (t) {
  var cg = qs(t, ':scope > colgroup'), rows = tableRows(t); if (!rows.length) return null;
  var n = 0; rowCells(rows[0]).forEach(function (c) { n += c.colSpan || 1; });
  if (cg && qsa(cg, 'col').length === n) return cg;
  if (cg) cg.remove();
  var tw = t.getBoundingClientRect().width || 1, widths = [];
  var simple = rows.filter(function (r) { return rowCells(r).every(function (c) { return (c.colSpan || 1) === 1; }) && rowCells(r).length === n; })[0];
  if (simple) rowCells(simple).forEach(function (c) { widths.push(c.getBoundingClientRect().width / tw * 100); });
  else for (var i = 0; i < n; i++) widths.push(100 / n);
  cg = document.createElement('colgroup');
  widths.forEach(function (w) { var c = document.createElement('col'); c.style.width = rnd(w, 4) + '%'; cg.appendChild(c); });
  t.insertBefore(cg, t.firstChild);
  qsa(t, 'td,th').forEach(function (c) { if (c.closest('table') === t) c.style.width = ''; });
  t.style.tableLayout = 'fixed'; if (!t.style.width) t.style.width = '100%';
  return cg;
};
P.addCol = function (cell, after) {
  var t = cell.closest('table'), idx = colIndex(cell), s = this, cg = s.ensureCols(t);
  tableRows(t).forEach(function (tr) {
    var c = cellAtCol(tr, idx), e = emptyCell(c);
    tr.insertBefore(e, after ? c.nextSibling : c);
  });
  if (cg) {
    var cols = qsa(cg, 'col'), ref = cols[Math.min(idx, cols.length - 1)], nc = document.createElement('col');
    cg.insertBefore(nc, after ? ref.nextSibling : ref);
    var all = qsa(cg, 'col'), w = rnd(100 / all.length, 4);
    all.forEach(function (c) { c.style.width = w + '%'; });
  }
};
P.delRow = function (tr) {
  var t = tr.closest('table');
  if (tableRows(t).length <= 1) { this.delTable(t); return; }
  var nx = tr.nextElementSibling || tr.previousElementSibling; tr.remove();
  if (nx) { var c = qs(nx, 'td,th'); if (c) this.setCaret(c, 0); }
};
P.delCol = function (cell) {
  var t = cell.closest('table'), idx = colIndex(cell), cg = this.ensureCols(t), rows = tableRows(t);
  var n = 0; rowCells(rows[0]).forEach(function (c) { n += c.colSpan || 1; });
  if (n <= 1) { this.delTable(t); return; }
  rows.forEach(function (tr) { var c = cellAtCol(tr, idx); if (c.colSpan > 1) c.colSpan--; else c.remove(); });
  if (cg) {
    var cols = qsa(cg, 'col'); if (cols[idx]) cols[idx].remove();
    var rest = qsa(cg, 'col'), sum = 0; rest.forEach(function (c) { sum += num(c.style.width); });
    rest.forEach(function (c) { c.style.width = rnd(num(c.style.width) / (sum || 1) * 100, 4) + '%'; });
  }
  var c0 = qs(t, 'td,th'); if (c0) this.setCaret(c0, 0);
};
P.delTable = function (t) {
  var p = mk('p', null, '<br>'); t.parentNode.replaceChild(p, t); this.setCaret(p, 0);
};
P.cellsOf = function (cell, scope) {
  var t = cell.closest('table');
  if (scope === 'row') return rowCells(cell.parentNode);
  if (scope === 'col') { var idx = colIndex(cell); return tableRows(t).map(function (tr) { return cellAtCol(tr, idx); }); }
  if (scope === 'table') return qsa(t, 'td,th').filter(function (c) { return c.closest('table') === t; });
  return [cell];
};

/* ---------- menu klik kanan tabel ---------- */
P.tableMenu = function (e, cell) {
  var s = this, t = cell.closest('table');
  s.saveSel();
  var sw = function (scope) {
    return '<div class="sp-mgrid sp-mgrid-sm">' + CELL_COLORS.map(function (c) {
      return '<button type="button" class="sp-csw' + (c === 'transparent' ? ' sp-csw-none' : '') + '" data-v="bg:' + scope + ':' + c + '" style="background:' + (c === 'transparent' ? '#fff' : c) + '" title="' + (c === 'transparent' ? 'Tanpa warna' : c) + '"></button>';
    }).join('') + '</div>';
  };
  var h =
    '<div class="sp-mi" data-v="rowAbove">Sisipkan baris di atas</div><div class="sp-mi" data-v="rowBelow">Sisipkan baris di bawah</div>' +
    '<div class="sp-mi" data-v="colLeft">Sisipkan kolom di kiri</div><div class="sp-mi" data-v="colRight">Sisipkan kolom di kanan</div><div class="sp-msep"></div>' +
    '<div class="sp-mi" data-v="delRow">Hapus baris</div><div class="sp-mi" data-v="delCol">Hapus kolom</div><div class="sp-mi sp-danger" data-v="delTable">Hapus tabel</div><div class="sp-msep"></div>' +
    '<div class="sp-mlabel">Perataan vertikal sel</div><div class="sp-mrow"><button type="button" data-v="va:top">Atas</button><button type="button" data-v="va:middle">Tengah</button><button type="button" data-v="va:bottom">Bawah</button></div>' +
    '<div class="sp-mlabel">Garis tabel</div><div class="sp-mrow"><button type="button" data-v="bd:all">Semua garis</button><button type="button" data-v="bd:none">Tanpa garis</button><button type="button" data-v="bd:outer">Luar saja</button></div>' +
    '<div class="sp-mi" data-v="equal">Lebar kolom sama rata</div><div class="sp-msep"></div>' +
    '<div class="sp-mlabel">Warna sel</div>' + sw('cell') + '<div class="sp-mlabel">Warna baris</div>' + sw('row') + '<div class="sp-mlabel">Warna kolom</div>' + sw('col');
  s.showMenu(h, { x: e.clientX, y: e.clientY }, function (v) {
    s.rec();
    var p = v.split(':');
    switch (p[0]) {
      case 'rowAbove': s.addRow(cell.parentNode, false); break;
      case 'rowBelow': s.addRow(cell.parentNode, true); break;
      case 'colLeft': s.addCol(cell, false); break;
      case 'colRight': s.addCol(cell, true); break;
      case 'delRow': s.delRow(cell.parentNode); break;
      case 'delCol': s.delCol(cell); break;
      case 'delTable': s.delTable(t); break;
      case 'va': cell.style.verticalAlign = p[1]; break;
      case 'bd':
        var cells = s.cellsOf(cell, 'table');
        cells.forEach(function (c) { c.style.border = p[1] === 'all' ? '1px solid #000' : '1px solid transparent'; });
        if (p[1] === 'outer') {
          var rows = tableRows(t);
          rows.forEach(function (tr, ri) {
            rowCells(tr).forEach(function (c) {
              if (ri === 0) c.style.borderTop = '1px solid #000';
              if (ri === rows.length - 1) c.style.borderBottom = '1px solid #000';
              if (!c.previousElementSibling) c.style.borderLeft = '1px solid #000';
              if (!c.nextElementSibling) c.style.borderRight = '1px solid #000';
            });
          });
        }
        t.classList.toggle('sp-nob', p[1] !== 'all'); if (!t.className) t.removeAttribute('class');
        break;
      case 'equal':
        var cg = s.ensureCols(t); if (cg) { var cl = qsa(cg, 'col'); cl.forEach(function (c) { c.style.width = rnd(100 / cl.length, 4) + '%'; }); }
        break;
      case 'bg':
        s.cellsOf(cell, p[1]).forEach(function (c) { c.style.backgroundColor = p[2] === 'transparent' ? '' : p[2]; if (!c.getAttribute('style')) c.removeAttribute('style'); });
        break;
    }
    s.changed();
  });
};

/* ---------- ubah lebar kolom dengan menyeret garis sel ---------- */
P.colHit = function (e) {
  var c = e.target.closest && e.target.closest('td,th'); if (!c || !this.ed.contains(c) || c.parentNode.classList.contains('sp-tpush')) return null;
  var r = c.getBoundingClientRect(), x = e.clientX;
  var right = Math.abs(x - r.right) <= 4, left = Math.abs(x - r.left) <= 4 && c.previousElementSibling;
  if (right && c.nextElementSibling) return { cell: c, idx: colIndex(c) + (c.colSpan || 1) - 1 };
  if (left) { var pc = c.previousElementSibling; return { cell: pc, idx: colIndex(pc) + (pc.colSpan || 1) - 1 }; }
  return null;
};
P.tblMouseMove = function (e) {
  if (this._colDrag) return;
  var h = this.colHit(e);
  this.ed.classList.toggle('sp-colcur', !!h);
};
P.tblMouseDown = function (e) {
  var s = this, h = e.button === 0 && s.colHit(e); if (!h) return false;
  e.preventDefault();
  var t = h.cell.closest('table'); s.rec();
  var cg = s.ensureCols(t); if (!cg) return true;
  var cols = qsa(cg, 'col'), a = cols[h.idx], b = cols[h.idx + 1]; if (!a || !b) return true;
  var tw = t.getBoundingClientRect().width / s.zoom, wa = num(a.style.width), wb = num(b.style.width), x0 = e.clientX;
  var minP = 0.5 * CM / tw * 100;
  var pr = s.pageRect(), trc = t.getBoundingClientRect();
  var baseX = (trc.left - pr.left) / s.zoom;
  s._colDrag = true;
  function mv(ev) {
    var d = (ev.clientX - x0) / s.zoom / tw * 100;
    if (!ev.altKey) { var tot = cols.slice(0, h.idx + 1).reduce(function (q, c) { return q + num(c.style.width); }, 0) - num(a.style.width) + wa + d; var edge = tot / 100 * tw; var sn = Math.round(edge / SNAP) * SNAP; d += (sn - edge) / tw * 100; }
    d = clamp(d, minP - wa, wb - minP);
    a.style.width = rnd(wa + d, 4) + '%'; b.style.width = rnd(wb - d, 4) + '%';
    var edgeX = cols.slice(0, h.idx + 1).reduce(function (q, c) { return q + num(c.style.width); }, 0) / 100 * tw;
    s.showGuide(baseX + edgeX);
    s.showTip('Lebar kolom: ' + fmtCm((wa + d) / 100 * tw) + ' | ' + fmtCm((wb - d) / 100 * tw), ev.clientX, ev.clientY);
    s.relayout();
  }
  function up() {
    document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
    s._colDrag = false; s.hideGuide(); s.hideTip(); s.changed();
  }
  document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  return true;
};

/* grid pemilih ukuran tabel (menu toolbar) */
P.tableMenuHTML = function () {
  var h = '<div class="sp-tgrid">';
  for (var r = 1; r <= 8; r++) for (var c = 1; c <= 10; c++) h += '<i data-r="' + r + '" data-c="' + c + '"></i>';
  return h + '</div><div class="sp-tglabel">Sisipkan tabel</div><div class="sp-msep"></div>' +
    '<div class="sp-mi" data-v="dlg">Sisipkan tabel…</div><div class="sp-mi" data-v="nob">Tabel tanpa garis (untuk perataan isian)</div>';
};
P.tableDialog = function (noBorder) {
  var s = this;
  this.dialog('Sisipkan tabel', '<div class="sp-row"><label>Jumlah kolom<input name="c" value="2" inputmode="numeric"></label><label>Jumlah baris<input name="r" value="2" inputmode="numeric"></label></div>' +
    '<label class="sp-chk"><input type="checkbox" name="nb"' + (noBorder ? ' checked' : '') + '> Tanpa garis (garis bantu biru hanya tampil di editor)</label>', function (f) {
    s.insertTable(parseInt(f.r.value, 10) || 2, parseInt(f.c.value, 10) || 2, f.nb.checked);
  });
};

/* ================================================================
 * GAMBAR: sisip (file / paste / drag-drop), pilih, ubah ukuran (sudut, rasio tetap),
 * perataan, lebar %, keterangan, hapus.
 * Opsi init: uploadImage(file) → Promise<url>  (bila tidak ada → disimpan sebagai data URL)
 * ================================================================ */
P.pickImage = function () {
  var s = this;
  s.saveSel();
  var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
  inp.style.display = 'none'; document.body.appendChild(inp);
  inp.onchange = function () { Array.prototype.slice.call(inp.files || []).forEach(function (f) { s.insertImageFile(f); }); inp.remove(); };
  inp.click();
  setTimeout(function () { if (inp.parentNode && !inp.files.length) inp.remove(); }, 60000);
};
P.insertImageFile = function (file) {
  var s = this; if (!file || !/^image\//.test(file.type)) return;
  var maxMB = s.o.maxImageMB || 5;
  if (file.size > maxMB * 1048576) { s.notify('Ukuran gambar melebihi ' + maxMB + ' MB'); return; }
  var done = function (url) { if (url) s.insertImage(url); };
  if (typeof s.o.uploadImage === 'function') {
    s.notify('Mengunggah gambar…');
    Promise.resolve(s.o.uploadImage(file)).then(function (u) { s.notify(''); done(u); }, function (err) { s.notify('Gagal mengunggah gambar'); if (window.console) console.error(err); });
  } else {
    var fr = new FileReader(); fr.onload = function () { done(fr.result); }; fr.readAsDataURL(file);
  }
};
P.insertImage = function (url) {
  var s = this, img = new Image();
  img.onload = function () {
    s.restoreSel(); s.rec();
    var b = s.anchorBlock(), ref = s.refBox(b), maxW = ref.right - ref.left;
    var w = Math.min(img.naturalWidth || maxW, maxW);
    var wrap = mk('div', 'sp-img-wrap'); wrap.setAttribute('contenteditable', 'false'); wrap.style.textAlign = 'center';
    var el = document.createElement('img'); el.src = url; el.alt = ''; el.style.width = toCm(w);
    wrap.appendChild(el);
    s.insertBlocks([wrap]);
    var nx = wrap.nextElementSibling; if (!nx || !/^(P|H[1-6])$/.test(nx.tagName)) { nx = mk('p', null, '<br>'); wrap.parentNode.insertBefore(nx, wrap.nextSibling); }
    s.setCaret(nx, 0);
    s.changed();
    setTimeout(function () { s.selectImg(el); }, 30);
  };
  img.onerror = function () { s.notify('Gambar tidak dapat dimuat'); };
  img.src = url;
};
P.selectImg = function (img) {
  if (this.selImg && this.selImg !== img) this.selImg.classList.remove('sp-img-selected');
  this.selImg = img; img.classList.add('sp-img-selected');
  window.getSelection().removeAllRanges();
  this.hideLinkPop(); this.closeMenu();
  this.updateImgBox();
};
P.deselectImg = function () {
  if (this.selImg) this.selImg.classList.remove('sp-img-selected');
  this.selImg = null;
  qs(this.ov, '.sp-imgbox').classList.remove('show');
  qs(this.wrap, '.sp-imgtb').classList.remove('show');
};
P.updateImgBox = function () {
  var img = this.selImg, box = qs(this.ov, '.sp-imgbox'), tb = qs(this.wrap, '.sp-imgtb');
  if (!img) return;
  if (!this.ed.contains(img)) { this.deselectImg(); return; }
  var z = this.zoom, pr = this.pageRect(), r = img.getBoundingClientRect();
  box.style.left = (r.left - pr.left) / z + 'px'; box.style.top = (r.top - pr.top) / z + 'px';
  box.style.width = r.width / z + 'px'; box.style.height = r.height / z + 'px';
  box.classList.add('show');
  var wr = this.wrap.getBoundingClientRect(), sr = this.scroll.getBoundingClientRect();
  tb.classList.add('show');
  var tw = tb.offsetWidth, th = tb.offsetHeight;
  var x = clamp(r.left + r.width / 2 - wr.left - tw / 2, 6, wr.width - tw - 6);
  var y = r.top - wr.top - th - 10;
  if (r.top - th - 10 < sr.top) y = Math.min(r.bottom - wr.top + 10, sr.bottom - wr.top - th - 6);
  tb.style.left = x + 'px'; tb.style.top = y + 'px';
  tb.style.visibility = (r.bottom < sr.top || r.top > sr.bottom) ? 'hidden' : '';
  var w = qs(tb, '.sp-imgw'); if (w) w.textContent = fmtCm(r.width / z);
};
P.imgCmd = function (c) {
  var s = this, img = s.selImg; if (!img) return;
  var wrap = img.closest('.sp-img-wrap'), host = wrap || s.blockOf(img);
  s.rec();
  if (c === 'left' || c === 'center' || c === 'right') { if (host) host.style.textAlign = c === 'left' ? 'left' : c; }
  else if (/^\d+$/.test(c)) {
    var ref = s.refBox(host || img), w = (ref.right - ref.left) * (+c) / 100;
    img.style.width = toCm(w); img.style.height = '';
  } else if (c === 'caption') {
    if (!wrap) return;
    var cap = qs(wrap, '.sp-img-caption');
    if (cap) cap.remove();
    else { cap = mk('div', 'sp-img-caption'); cap.setAttribute('contenteditable', 'true'); cap.innerHTML = '<br>'; wrap.appendChild(cap); s.deselectImg(); s.setCaret(cap, 0); cap.focus(); }
  } else if (c === 'delete') {
    var target = wrap || img, nx = target.nextElementSibling || target.previousElementSibling;
    s.deselectImg(); target.remove();
    if (!s.ed.firstElementChild) s.ed.innerHTML = '<p><br></p>';
    if (nx && s.ed.contains(nx)) s.setCaret(nx, 0);
    s.ensureTrailing();
  }
  s.changed();
};
P.bindImg = function () {
  var s = this, box = qs(s.ov, '.sp-imgbox');
  s.on(box, 'pointerdown', function (e) {
    var hd = e.target.closest('.sp-ih'); if (!hd || !s.selImg) return;
    e.preventDefault(); e.stopPropagation();
    var dir = hd.getAttribute('data-h'), img = s.selImg, r = img.getBoundingClientRect(), z = s.zoom;
    var w0 = r.width / z, h0 = r.height / z, ar = h0 / (w0 || 1), x0 = e.clientX, y0 = e.clientY;
    var ref = s.refBox(img.closest('.sp-img-wrap') || img), maxW = ref.right - ref.left;
    s.rec();
    try { hd.setPointerCapture(e.pointerId); } catch (er) {}
    function mv(ev) {
      var dx = (ev.clientX - x0) / z, dy = (ev.clientY - y0) / z, w = w0;
      if (/e/.test(dir)) w = w0 + dx; else if (/w/.test(dir)) w = w0 - dx;
      if (dir === 'n' || dir === 's') w = (h0 + (dir === 's' ? dy : -dy)) / ar;
      else if (dir.length === 2) { var wy = (h0 + (/s/.test(dir) ? dy : -dy)) / ar; w = Math.max(w, wy); }
      w = clamp(w, 16, maxW);
      img.style.width = toCm(w); img.style.height = '';
      s.updateImgBox();
      s.showTip(fmtCm(w) + ' × ' + fmtCm(w * ar), ev.clientX, ev.clientY);
    }
    function up(ev) {
      hd.removeEventListener('pointermove', mv); hd.removeEventListener('pointerup', up); hd.removeEventListener('pointercancel', up);
      try { hd.releasePointerCapture(ev.pointerId); } catch (er) {}
      s.hideTip(); s.changed();
    }
    hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
  });
};
P.notify = function (msg) {
  var el = qs(this.wrap, '.sp-st-info');
  if (!msg) { this.status(); return; }
  el.textContent = msg; var s = this; clearTimeout(this._nt); this._nt = setTimeout(function () { s.status(); }, 4000);
};

/* ================================================================
 * LINK, GARIS, PEMISAH HALAMAN
 * ================================================================ */
function normUrl(u) {
  u = String(u || '').trim(); if (!u) return '';
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(u)) return u;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return 'mailto:' + u;
  return 'https://' + u;
}
P.linkDialog = function (a) {
  var s = this, r = s.restoreSel(); if (!r) return;
  if (!a) { var n = boundaryNode(r.startContainer, r.startOffset); if (n.nodeType === 3) n = n.parentNode; a = n.closest && n.closest('a'); if (a && !s.ed.contains(a)) a = null; }
  var needText = !a && r.collapsed;
  s.saveSel();
  s.dialog(a ? 'Ubah link' : 'Sisipkan link',
    '<div class="sp-row"><label>Alamat (URL)<input name="u" placeholder="https://…" value="' + esc(a ? a.getAttribute('href') : '') + '"></label></div>' +
    (needText ? '<div class="sp-row"><label>Teks yang ditampilkan<input name="t"></label></div>' : ''), function (f) {
    var u = normUrl(f.u.value); if (!u) return false;
    s.restoreSel(); s.rec();
    if (a) a.setAttribute('href', u);
    else if (needText) {
      var el = document.createElement('a'); el.href = u; el.textContent = (f.t && f.t.value.trim()) || f.u.value.trim();
      var rr = s.range(); rr.insertNode(el); s.setCaret(el.parentNode, Array.prototype.indexOf.call(el.parentNode.childNodes, el) + 1);
    } else document.execCommand('createLink', false, u);
    s.changed();
  });
};
P.showLinkPop = function (a) {
  var p = qs(this.wrap, '.sp-linkpop'), u = qs(p, '.sp-lp-url'), wr = this.wrap.getBoundingClientRect(), r = a.getBoundingClientRect();
  this._lpA = a; u.textContent = a.getAttribute('href'); u.href = a.href;
  p.classList.add('show');
  p.style.left = clamp(r.left - wr.left, 6, wr.width - p.offsetWidth - 6) + 'px';
  p.style.top = (r.bottom - wr.top + 6) + 'px';
};
P.hideLinkPop = function () { var p = qs(this.wrap, '.sp-linkpop'); if (p) p.classList.remove('show'); this._lpA = null; };
P.linkCmd = function (c) {
  var a = this._lpA; if (!a) return;
  if (c === 'open') window.open(a.href, '_blank', 'noopener');
  else if (c === 'edit') { this.hideLinkPop(); var r = document.createRange(); r.selectNodeContents(a); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); this._saved = r.cloneRange(); this.linkDialog(a); }
  else if (c === 'remove') { this.rec(); var p = a.parentNode; while (a.firstChild) p.insertBefore(a.firstChild, a); a.remove(); this.hideLinkPop(); this.changed(); }
};
P.insertHR = function () {
  this.restoreSel(); this.rec();
  var hr = document.createElement('hr'); this.insertBlocks([hr]);
  var nx = hr.nextElementSibling; if (nx) this.setCaret(nx, 0);
  this.changed();
};
P.insertPageBreak = function () {
  this.restoreSel(); this.rec();
  var br = mk('div', 'sp-pagebreak'); br.setAttribute('contenteditable', 'false');
  this.insertBlocks([br]);
  var nx = br.nextElementSibling;
  if (!nx || !/^(P|H[1-6]|OL|UL|TABLE)$/.test(nx.tagName)) { nx = mk('p', null, '<br>'); br.parentNode.insertBefore(nx, br.nextSibling); }
  this.setCaret(nx.tagName === 'TABLE' ? qs(nx, 'td,th') : nx, 0);
  this.changed();
};

/* ================================================================
 * MENU DROPDOWN
 * ================================================================ */
var HILITES = ['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#0000ff', '#ff0000', '#000080', '#008080', '#008000', '#800080', '#800000', '#808000', '#808080', '#c0c0c0', '#000000'];
P.showMenu = function (html, at, fn, name) {
  var m = this.menu, wr = this.wrap.getBoundingClientRect();
  m.innerHTML = html; m.className = 'sp-menu show' + (name ? ' sp-menu-' + name : '');
  this._menuName = name || 'ctx';
  var x, y;
  if (at.nodeType) { var r = at.getBoundingClientRect(); var host = at.closest('.sp-split,.sp-combo') || at; var hr = host.getBoundingClientRect(); x = hr.left - wr.left; y = r.bottom - wr.top + 4; }
  else { x = at.x - wr.left; y = at.y - wr.top; }
  m.style.left = '0px'; m.style.top = '0px';
  var mw = m.offsetWidth, mh = m.offsetHeight;
  x = clamp(x, 4, Math.max(4, wr.width - mw - 4));
  if (y + mh > wr.height - 4) y = Math.max(4, (at.nodeType ? at.getBoundingClientRect().top - wr.top - mh - 4 : y - mh));
  m.style.left = x + 'px'; m.style.top = y + 'px';
  var s = this;
  m.onclick = function (e) {
    var it = e.target.closest('[data-v]'); if (!it) return;
    e.preventDefault(); s.closeMenu(); fn(it.getAttribute('data-v'), it);
  };
};
P.closeMenu = function () {
  if (!this.menu.classList.contains('show')) return;
  this.menu.classList.remove('show'); this.menu.innerHTML = ''; this._menuName = null;
  qsa(this.tb, '.sp-open').forEach(function (b) { b.classList.remove('sp-open'); });
};
P.openMenu = function (name, btn) {
  var s = this;
  if (s._menuName === name) { s.closeMenu(); return; }
  s.closeMenu(); s.saveSel();
  var h = '', fn, b = s.anchorBlock(), li = b && b.closest && b.closest('li');
  function colorGrid(list, pre) {
    return '<div class="sp-mgrid">' + list.map(function (c) { return '<button type="button" class="sp-csw" data-v="' + pre + c + '" style="background:' + c + '" title="' + c + '"></button>'; }).join('') + '</div>';
  }
  switch (name) {
    case 'size':
      var cur = s.curFontPt();
      h = SIZES.map(function (v) { return '<div class="sp-mi' + (v === cur ? ' on' : '') + '" data-v="' + v + '">' + fmtNum(v, 1) + '</div>'; }).join('');
      fn = function (v) { s.setFontSize(v); };
      break;
    case 'color':
      h = '<div class="sp-mi" data-v="#000000"><span class="sp-csw sp-csw-in" style="background:#000"></span>Otomatis (hitam)</div>' +
        colorGrid(COLORS, '') + '<div class="sp-msep"></div><label class="sp-mi sp-mcustom">Warna lain… <input type="color" value="#c00000"></label>';
      fn = function (v) { s.setColor(v); };
      break;
    case 'hilite':
      h = colorGrid(HILITES, '') + '<div class="sp-msep"></div><div class="sp-mi" data-v="transparent">Tanpa warna</div>';
      fn = function (v) { s.setColor(v, true); };
      break;
    case 'ul':
      h = '<div class="sp-mlabel">Pustaka bullet</div><div class="sp-mlist">' + BUL_STYLES.map(function (x) {
        return '<button type="button" class="sp-mli" data-v="' + esc(x.v) + '"><b>' + x.t + '</b><span></span><b>' + x.t + '</b><span></span></button>';
      }).join('') + '</div><div class="sp-msep"></div><div class="sp-mi" data-v="none">Tanpa bullet</div>';
      fn = function (v) { s.pickList('UL', v); };
      break;
    case 'ol':
      h = '<div class="sp-mlabel">Pustaka penomoran</div><div class="sp-mlist">' + NUM_STYLES.map(function (x) {
        var t = x.t.split(' ');
        return '<button type="button" class="sp-mli" data-v="' + x.v + '"><b>' + t[0] + '</b><span></span><b>' + t[1] + '</b><span></span><b>' + t[2] + '</b><span></span></button>';
      }).join('') + '</div><div class="sp-msep"></div>' +
        (li && li.parentNode.tagName === 'OL' ? '<div class="sp-mi" data-v="restart">Mulai ulang dari 1</div><div class="sp-mi" data-v="set">Atur nilai penomoran…</div>' : '') +
        '<div class="sp-mi" data-v="none">Tanpa penomoran</div>';
      fn = function (v) { if (v === 'restart') s.listStart(true); else if (v === 'set') s.listStart(); else s.pickList('OL', v); };
      break;
    case 'ls':
      var ls = s.blockLS(b), mt = b && num(s.getMT(b)) > 0, mb = b && num(b.style.marginBottom) > 0;
      h = LINE_SP.map(function (v) { return '<div class="sp-mi' + (!ls.exact && Math.abs(ls.ls - v) < 0.01 ? ' on' : '') + '" data-v="' + v + '">' + fmtNum(v, 2) + '</div>'; }).join('') +
        '<div class="sp-msep"></div><div class="sp-mi" data-v="opt">Pilihan spasi baris…</div><div class="sp-msep"></div>' +
        '<div class="sp-mi" data-v="before">' + (mt ? 'Hapus' : 'Tambah') + ' spasi sebelum paragraf</div>' +
        '<div class="sp-mi" data-v="after">' + (mb ? 'Hapus' : 'Tambah') + ' spasi sesudah paragraf</div>';
      fn = function (v) { if (v === 'opt') s.paraDialog(); else if (v === 'before' || v === 'after') s.toggleSpace(v); else s.lineSpacing(parseNum(v)); };
      break;
    case 'table':
      h = s.tableMenuHTML();
      fn = function (v) { if (v === 'dlg') s.tableDialog(); else if (v === 'nob') s.tableDialog(true); else { var p = v.split('x'); s.insertTable(+p[0], +p[1]); } };
      break;
  }
  s.showMenu(h, btn, fn, name);
  btn.classList.add('sp-open');
  if (name === 'table') {
    var g = qs(s.menu, '.sp-tgrid'), lab = qs(s.menu, '.sp-tglabel');
    g.onmousemove = function (e) {
      var c = e.target.closest('i'); if (!c) return;
      var R = +c.getAttribute('data-r'), C = +c.getAttribute('data-c');
      qsa(g, 'i').forEach(function (x) { x.classList.toggle('on', +x.getAttribute('data-r') <= R && +x.getAttribute('data-c') <= C); });
      lab.textContent = C + ' × ' + R + ' Tabel';
    };
    g.onclick = function (e) {
      var c = e.target.closest('i'); if (!c) return;
      s.closeMenu(); s.insertTable(+c.getAttribute('data-r'), +c.getAttribute('data-c'));
    };
  }
  if (name === 'color') {
    var ci = qs(s.menu, 'input[type=color]');
    ci.onchange = function () { s.closeMenu(); s.setColor(ci.value); };
  }
};
/* pilih gaya list dari menu (tidak menghapus bila gayanya sama) */
P.pickList = function (tag, v) {
  var b = this.anchorBlock(), li = b && b.closest && b.closest('li');
  if (v === 'none') { if (li && li.parentNode.tagName === tag) this.toggleList(tag); return; }
  if (li && li.parentNode.tagName === tag && listStyleOf(li.parentNode) === v) return;
  this.toggleList(tag, v);
};

/* ================================================================
 * DIALOG generik — Enter = OK, Esc = Batal (tidak memicu submit form Yii2)
 * ================================================================ */
P.dialog = function (title, body, onOK, onInit) {
  var s = this, md = qs(s.wrap, '.sp-modal'), box = qs(md, '.sp-dlg');
  s.closeMenu(); s.saveSel();
  qs(box, 'h3').textContent = title;
  var bd = qs(box, '.sp-dlg-body'); bd.innerHTML = body;
  var f = {}; qsa(bd, '[name]').forEach(function (el) { f[el.getAttribute('name')] = el; });
  md.classList.add('show');
  function close() { md.classList.remove('show'); bd.innerHTML = ''; md.onkeydown = null; box.onclick = null; s.restoreSel(); }
  function ok() { if (onOK(f, box) === false) return; close(); }
  box.onclick = function (e) { var b = e.target.closest('[data-dlg]'); if (!b) return; if (b.getAttribute('data-dlg') === 'ok') ok(); else close(); };
  md.onkeydown = function (e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); e.stopPropagation(); ok(); }
  };
  md.onmousedown = function (e) { if (e.target === md) { e.preventDefault(); } };
  if (onInit) onInit(f, box);
  var first = qs(bd, 'input:not([type=checkbox]):not([type=radio]),select');
  setTimeout(function () { if (first) { first.focus(); if (first.select) first.select(); } }, 20);
};

/* ================================================================
 * STATUS TOOLBAR (tombol aktif sesuai posisi kursor)
 * ================================================================ */
P.updateUI = function () {
  var s = this, b = s.anchorBlock(); if (!b) return;
  var ta = getComputedStyle(b).textAlign;
  ta = /center/.test(ta) ? 'center' : /right|end/.test(ta) ? 'right' : /justify/.test(ta) ? 'justify' : 'left';
  qsa(s.tb, '[data-state]').forEach(function (btn) {
    var st = btn.getAttribute('data-state'), on = false;
    if (st.indexOf('a-') === 0) on = ta === st.slice(2);
    else if (st === 'marks') on = s.wrap.classList.contains('sp-marks');
    else { try { on = document.queryCommandState(st); } catch (e) {} }
    btn.classList.toggle('on', !!on);
  });
  var li = b.closest && b.closest('li');
  qs(s.tb, '[data-cmd=ul]').classList.toggle('on', !!(li && li.parentNode.tagName === 'UL'));
  qs(s.tb, '[data-cmd=ol]').classList.toggle('on', !!(li && li.parentNode.tagName === 'OL'));
  var r = s.range() || s._saved, n = r ? boundaryNode(r.startContainer, r.startOffset) : b; if (n.nodeType === 3) n = n.parentNode;
  var fam = firstFamily(getComputedStyle(n).fontFamily), fo = qs(s.tb, '.sp-font');
  if (document.activeElement !== fo) {
    var opt = qsa(fo, 'option').filter(function (o) { return o.value.toLowerCase() === fam.toLowerCase(); })[0];
    if (!opt) { opt = qs(fo, 'option.sp-x') || mk('option', 'sp-x'); opt.value = fam; opt.textContent = fam; if (!opt.parentNode) fo.insertBefore(opt, fo.firstChild); }
    fo.value = opt.value;
  }
  var sz = qs(s.tb, '.sp-size'); if (document.activeElement !== sz) sz.value = fmtNum(s.curFontPt(), 1);
  var st = qs(s.tb, '.sp-style'), tg = b.tagName.toLowerCase();
  if (document.activeElement !== st) st.value = /^h[1-3]$/.test(tg) ? tg : 'p';
};

/* ================================================================
 * PASTE — pembersih HTML dari MS Word / WPS / Google Docs / web.
 * Mempertahankan: tebal/miring/garis bawah, font & ukuran (pt), warna, perataan,
 * inden kiri/kanan/baris pertama/gantung, spasi sebelum/sesudah, spasi baris,
 * tab (mso-tab-count) + tab stop (tab-stops), nomor/bullet list Word, tabel, link.
 * ================================================================ */
var BUL_MAP = { '\u00b7': '\u2022', '\uf0b7': '\u2022', '\u00a7': '\u25aa', '\uf0a7': '\u25aa', 'o': '\u25cb', '\u00d8': '\u27a2', '\uf0d8': '\u27a2',
  '\u00fc': '\u2713', '\uf0fc': '\u2713', '\u00a8': '\u2022', '\uf076': '\u2756', 'v': '\u2756', '-': '\u2013', '\u2013': '\u2013' };
var KEEP_TAGS = /^(P|H[1-6]|UL|OL|LI|TABLE|THEAD|TBODY|TFOOT|TR|TD|TH|COLGROUP|COL|B|STRONG|I|EM|U|S|STRIKE|DEL|SUB|SUP|A|BR|IMG|SPAN|HR|BLOCKQUOTE|DIV)$/;
var DROP_TAGS = /^(SCRIPT|STYLE|META|LINK|TITLE|HEAD|XML|OBJECT|IFRAME|FRAME|FORM|INPUT|BUTTON|SELECT|TEXTAREA|SVG|CANVAS|VIDEO|AUDIO|NOSCRIPT|TEMPLATE)$/;

function parseStyleText(txt) {
  var o = {}; String(txt || '').split(';').forEach(function (d) {
    var i = d.indexOf(':'); if (i < 0) return;
    var k = d.slice(0, i).trim().toLowerCase(), v = d.slice(i + 1).trim(); if (k) o[k] = v;
  });
  return o;
}
function wordTabStops(v, leftIndent) {
  // "36.0pt center 212.6pt right dotted 425.2pt"  → [{t,x,lead}]
  var tok = String(v).trim().split(/\s+/), out = [], t = 'l', lead = '';
  tok.forEach(function (w) {
    var lw = w.toLowerCase();
    if (lw === 'left' || lw === 'list') t = 'l';
    else if (lw === 'center') t = 'c';
    else if (lw === 'right' || lw === 'decimal') t = 'r';
    else if (lw === 'bar') t = 'bar';
    else if (lw === 'dotted') lead = 'dot';
    else if (lw === 'dashed') lead = 'dash';
    else if (lw === 'heavy' || lw === 'lined' || lw === 'line') lead = 'line';
    else { var x = parseLen(w); if (!isNaN(x)) { if (t !== 'bar' && x > 0) out.push({ t: t, x: x, lead: lead }); t = 'l'; lead = ''; } }
  });
  return out;
}

P.cleanHTML = function (html) {
  var s = this, doc = new DOMParser().parseFromString(html, 'text/html');
  var isWord = /urn:schemas-microsoft-com|class="?Mso|mso-/i.test(html);
  var defFont = s.doc.font.toLowerCase(), defPt = s.doc.size;
  // 1) aturan class dari <style> Word (MsoNormal dsb.) diterapkan ke elemen
  var rules = [];
  qsa(doc, 'style').forEach(function (st) {
    var css = st.textContent.replace(/<!--|-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    css = css.replace(/@(page|font-face|list)[^{]*\{[^}]*\}/gi, '');
    var re = /([^{}]+)\{([^}]*)\}/g, m;
    while ((m = re.exec(css))) {
      m[1].split(',').forEach(function (sel) {
        sel = sel.trim(); if (!/^[a-z0-9]*(\.[\w-]+)?$/i.test(sel) || !sel) return;
        if (!/^(p|li|div|h[1-6]|span|table|td|th)?(\.[\w-]+)?$/i.test(sel)) return;
        rules.push({ sel: sel, css: m[2], spec: sel.indexOf('.') > -1 ? (sel.charAt(0) === '.' ? 1 : 2) : 0 });
      });
    }
  });
  rules.sort(function (a, b) { return a.spec - b.spec; });
  if (rules.length) {
    rules.forEach(function (r) {
      var els; try { els = qsa(doc.body, r.sel); } catch (e) { return; }
      els.forEach(function (el) { el._cls = (el._cls || '') + ';' + r.css; });
    });
    qsa(doc.body, '*').forEach(function (el) { if (el._cls) el.setAttribute('style', el._cls + ';' + (el.getAttribute('style') || '')); });
  }
  var body = doc.body;
  // 2) Google Docs: <b style="font-weight:normal" id="docs-internal-guid">
  qsa(body, 'b[id^="docs-internal-guid"]').forEach(function (b) { unwrapEl(b); });
  // 3) komentar & sampah
  var w = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT), c, dead = [];
  while ((c = w.nextNode())) dead.push(c);
  dead.forEach(function (n) { n.remove(); });
  qsa(body, '*').forEach(function (el) {
    var tn = el.tagName.toUpperCase();
    if (DROP_TAGS.test(tn)) { el.remove(); return; }
    if (tn.indexOf(':') > -1) { if (/^O:P$/.test(tn)) { el.parentNode && unwrapEl(el); } else el.remove(); }
  });
  // salinan dari SuratPro sendiri: pulihkan margin yang digelembungkan pagination
  qsa(body, '[data-sp-push]').forEach(function (el) { if (el.tagName === 'TR' && el.classList.contains('sp-tpush')) el.remove(); else unpush(el); });
  qsa(body, '[data-sp-bm],.sp-col-handle,.sp-img-handle').forEach(function (n) { n.remove(); });
  // 4) penanda list Word: <span style="mso-list:Ignore">1.<span>&nbsp;&nbsp;</span></span> → "1." + tab
  qsa(body, 'span').forEach(function (sp) {
    var raw = (sp.getAttribute('style') || '').replace(/\s/g, '').toLowerCase();
    if (raw.indexOf('mso-list:ignore') > -1) {
      var inner = sp.cloneNode(true); qsa(inner, 'span').forEach(function (x) { if (/font:\s*7/.test(x.getAttribute('style') || '') || !x.textContent.replace(/[\u00a0\s]/g, '')) x.remove(); });
      var mark = inner.textContent.replace(/[\u00a0\s]+/g, ' ').trim();
      var face = (sp.getAttribute('style') || '').match(/font-family:\s*([^;]+)/i), f = face ? face[1].toLowerCase() : '';
      var outer = sp.parentNode && sp.parentNode.tagName === 'SPAN' && !sp.previousSibling ? sp.parentNode : null;
      if (!f && outer) { var fm = (outer.getAttribute('style') || '').match(/font-family:\s*([^;]+)/i); if (fm) f = fm[1].toLowerCase(); }
      if (mark.length === 1 && (/symbol|wingdings|courier/.test(f) || BUL_MAP[mark])) mark = BUL_MAP[mark] || '\u2022';
      var frag = doc.createDocumentFragment();
      frag.appendChild(doc.createTextNode(mark)); frag.appendChild(tabEl());
      sp.parentNode.replaceChild(frag, sp);
    } else if (/mso-tab-count:(\d+)/.test(raw)) {
      var n = +raw.match(/mso-tab-count:(\d+)/)[1], fr = doc.createDocumentFragment();
      for (var i = 0; i < n; i++) fr.appendChild(tabEl());
      sp.parentNode.replaceChild(fr, sp);
    } else if (/mso-spacerun:yes/.test(raw)) {
      sp.replaceWith(doc.createTextNode(sp.textContent.replace(/\s/g, '\u00a0')));
    }
  });
  // karakter tab asli (Google Docs / teks) → span tab
  var tw = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT), tn2, tabsT = [];
  while ((tn2 = tw.nextNode())) if (tn2.nodeValue.indexOf('\t') > -1 && !(tn2.parentNode.classList && tn2.parentNode.classList.contains('sp-tab'))) tabsT.push(tn2);
  tabsT.forEach(function (t) {
    var parts = t.nodeValue.split('\t'), fr = doc.createDocumentFragment();
    parts.forEach(function (p, i) { if (i) fr.appendChild(tabEl()); if (p) fr.appendChild(doc.createTextNode(p)); });
    t.parentNode.replaceChild(fr, t);
  });
  // 5) sanitasi elemen & gaya
  function clean(el) {
    Array.prototype.slice.call(el.children).forEach(clean);
    var tag = el.tagName.toUpperCase();
    if (el === body) return;
    if (el.classList.contains('sp-tab')) {
      var lead = el.getAttribute('data-lead');
      Array.prototype.slice.call(el.attributes).forEach(function (a) { el.removeAttribute(a.name); });
      el.className = 'sp-tab'; el.setAttribute('contenteditable', 'false'); if (lead) el.setAttribute('data-lead', lead);
      el.textContent = '\t'; return;
    }
    if (!KEEP_TAGS.test(tag)) {
      if (/^(SECTION|ARTICLE|MAIN|HEADER|FOOTER|NAV|ASIDE|FIGURE|FIGCAPTION|ADDRESS|CENTER|DL|DT|DD|PRE)$/.test(tag)) { renameEl(el, tag === 'CENTER' ? 'p' : 'div', tag === 'CENTER' ? 'text-align:center' : ''); return; }
      unwrapEl(el); return;
    }
    if (tag === 'IMG') {
      var src = el.getAttribute('src') || '';
      if (!/^(https?:|data:image\/|\/|blob:)/i.test(src) || /^file:/i.test(src)) { el.remove(); return; }
    }
    var st = parseStyleText(el.getAttribute('style')), out = {}, block = /^(P|H[1-6]|LI|DIV|BLOCKQUOTE)$/.test(tag);
    var fam = st['font-family'] ? firstFamily(st['font-family']) : '';
    if (st['font'] && !st['font-size']) { var fm2 = st['font'].match(/([\d.]+)(pt|px)/); if (fm2) st['font-size'] = fm2[0]; }
    // tipografi inline
    if (st['font-weight'] && /bold|[6-9]00/.test(st['font-weight'])) out['font-weight'] = 'bold';
    else if (st['font-weight'] && /normal|[1-4]00/.test(st['font-weight']) && tag !== 'B' && tag !== 'STRONG' && el.closest('b,strong,h1,h2,h3,h4,h5,h6,th')) out['font-weight'] = 'normal';
    if (st['font-style'] === 'italic') out['font-style'] = 'italic';
    var td = (st['text-decoration'] || st['text-decoration-line'] || '');
    if (/underline/.test(td)) out['text-decoration'] = 'underline';
    if (/line-through/.test(td)) out['text-decoration'] = (out['text-decoration'] ? out['text-decoration'] + ' ' : '') + 'line-through';
    if (st['vertical-align'] && /super|sub/.test(st['vertical-align'])) out['vertical-align'] = st['vertical-align'];
    if (st['color'] && !/windowtext|^black$|#000000|rgb\(0,\s*0,\s*0\)|inherit|initial/i.test(st['color'])) out['color'] = st['color'];
    var bg = st['background-color'] || st['background'] || st['mso-highlight'];
    if (bg && !/transparent|none|initial|inherit|white|#fff\b|#ffffff|rgba\(0,\s*0,\s*0,\s*0\)|url\(/i.test(bg)) out['background-color'] = bg.split(' ')[0];
    if (fam && fam.toLowerCase() !== defFont && !/^(inherit|initial|serif|sans-serif|symbol|wingdings)$/i.test(fam)) out['font-family'] = /\s/.test(fam) ? "'" + fam + "'" : fam;
    if (st['font-size']) {
      var fsz = parseLen(st['font-size']);
      if (!isNaN(fsz) && fsz > 0) { var pt = rnd(fsz / PT * 2, 0) / 2; if (Math.abs(pt - defPt) > 0.1) out['font-size'] = pt + 'pt'; }
    }
    // paragraf
    if (block || tag === 'TABLE' || tag === 'TD' || tag === 'TH') {
      if (st['text-align'] && /center|right|justify/.test(st['text-align'])) out['text-align'] = st['text-align'].replace(/start|left/, 'left');
    }
    if (block) {
      var mg = st['margin'] ? st['margin'].split(/\s+/) : [];
      var M = { t: mg[0], r: mg[1] || mg[0], b: mg[2] || mg[0], l: mg[3] || mg[1] || mg[0] };
      ['top', 'right', 'bottom', 'left'].forEach(function (k) { if (st['margin-' + k] != null) M[k.charAt(0)] = st['margin-' + k]; });
      var ml = parseLen(M.l), mr = parseLen(M.r), mt = parseLen(M.t), mb = parseLen(M.b), ti = parseLen(st['text-indent']);
      if (!isWord && (tag === 'DIV' || tag === 'LI')) { mt = mb = NaN; }
      if (/^H/.test(tag) && !isWord) { mt = mb = NaN; }
      if (ml > 0.3 || ml < -0.3) out['margin-left'] = toCm(ml);
      if (mr > 0.3) out['margin-right'] = toCm(mr);
      if (ti > 0.3 || ti < -0.3) out['text-indent'] = toCm(ti);
      if (mt > 0.3 && isWord) out['margin-top'] = rnd(mt / PT, 1) + 'pt';
      if (mb > 0.3 && isWord) out['margin-bottom'] = rnd(mb / PT, 1) + 'pt';
      if (!isWord && tag === 'P' && !(mt > 0.3) && !(mb > 0.3) && st['margin'] == null && st['margin-bottom'] == null) { /* paragraf web: tanpa spasi */ }
      // spasi baris
      var lh = st['line-height'], ls = null;
      if (lh && lh !== 'normal') {
        if (/%$/.test(lh)) ls = rnd(parseFloat(lh) / 100, 2);
        else if (/^[\d.]+$/.test(lh)) ls = rnd(parseFloat(lh) / lhFactor(fam || defFont), 2);
        else { var lp = parseLen(lh); if (lp > 0) { el.setAttribute('data-ls', 'x' + rnd(lp / PT, 1)); out['line-height'] = rnd(lp / PT, 1) + 'pt'; } }
      } else if (isWord && s.doc.ls !== 1) ls = 1;
      if (ls != null && ls > 0) { el.setAttribute('data-ls', String(ls)); out['line-height'] = rnd(ls * lhFactor(fam || defFont), 3); }
      if (st['tab-stops']) { var ts = wordTabStops(st['tab-stops']); if (ts.length) el.setAttribute('data-tabs', tabsAttr(ts)); }
      if (st['page-break-before'] === 'always' || st['break-before'] === 'page') el.setAttribute('data-sp-brk', '1');
    }
    if (tag === 'TD' || tag === 'TH') {
      ['border', 'border-top', 'border-right', 'border-bottom', 'border-left'].forEach(function (k) {
        if (st[k] != null) out[k] = /none/.test(st[k]) ? 'none' : st[k].replace(/windowtext|auto/gi, '#000').replace(/solid\s+(#000|black)\s+([\d.]+pt)/i, '$2 solid #000');
      });
      if (st['padding']) out['padding'] = st['padding'];
      ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'].forEach(function (k) { if (st[k]) out[k] = st[k]; });
      if (st['vertical-align'] && /middle|bottom/.test(st['vertical-align'])) out['vertical-align'] = st['vertical-align']; else out['vertical-align'] = 'top';
      var cbg = st['background'] || st['background-color'];
      if (cbg && !/transparent|none|white|#fff\b|#ffffff/i.test(cbg)) out['background-color'] = cbg.split(' ')[0];
      var cw = st['width'] ? parseLen(st['width']) : NaN; if (cw > 0) out['width'] = toCm(cw);
      delete out['font-weight'];
      if (st['font-weight'] && /bold|[6-9]00/.test(st['font-weight'])) out['font-weight'] = 'bold';
    }
    if (tag === 'TABLE') {
      out['border-collapse'] = 'collapse';
      var tw2 = st['width'] ? (/%$/.test(st['width']) ? st['width'] : toCm(parseLen(st['width']))) : (el.getAttribute('width') ? (/%/.test(el.getAttribute('width')) ? el.getAttribute('width') : toCm(+el.getAttribute('width'))) : '');
      if (tw2 && !/NaN/.test(tw2)) out['width'] = tw2;
      var tml = parseLen(st['margin-left']); if (tml > 0.3 || tml < -0.3) out['margin-left'] = toCm(tml);
      if (st['border'] && !/none/.test(st['border'])) out['border'] = st['border'].replace(/windowtext|auto/gi, '#000');
      if (el.getAttribute('border') && el.getAttribute('border') !== '0') {
        qsa(el, 'td,th').forEach(function (c) { if (!/border/.test(c.getAttribute('style') || '')) c.setAttribute('style', 'border:1px solid #000;' + (c.getAttribute('style') || '')); });
      }
    }
    if (tag === 'COL') { var w2 = st['width'] || el.getAttribute('width'); if (w2) out['width'] = /%$/.test(w2) ? w2 : toCm(parseLen(w2)); }
    if (tag === 'IMG') {
      var iw = parseLen(st['width'] || el.getAttribute('width')); if (iw > 0) out['width'] = toCm(iw);
    }
    if (/^(OL|UL)$/.test(tag)) {
      var lst = st['list-style-type'] || (el.getAttribute('type') ? { '1': 'decimal', a: 'lower-alpha', A: 'upper-alpha', i: 'lower-roman', I: 'upper-roman' }[el.getAttribute('type')] : '');
      if (lst) out['list-style-type'] = lst;
      var lml = parseLen(st['margin-left']); if (lml > 0.3) out['margin-left'] = toCm(lml);
    }
    // atribut
    var keep = { A: ['href'], IMG: ['src', 'alt'], TD: ['colspan', 'rowspan'], TH: ['colspan', 'rowspan'], OL: ['start'], COL: ['span'] }[tag] || [];
    Array.prototype.slice.call(el.attributes).forEach(function (a) {
      var n = a.name.toLowerCase();
      if (keep.indexOf(n) > -1 || n === 'data-ls' || n === 'data-tabs' || n === 'data-sp-brk') return;
      if (n === 'class') {
        var ok = String(a.value).split(/\s+/).filter(function (c) { return /^sp-(img-wrap|img-caption|pagebreak|nob)$/.test(c); });
        if (ok.length) el.setAttribute('class', ok.join(' ')); else el.removeAttribute('class');
        return;
      }
      el.removeAttribute(n);
    });
    if (tag === 'A') { var hr = el.getAttribute('href') || ''; if (/^\s*javascript:/i.test(hr) || !hr) { unwrapEl(el); return; } }
    var css = Object.keys(out).map(function (k) { return k + ':' + out[k]; }).join(';');
    if (css) el.setAttribute('style', css);
    if (tag === 'SPAN' && !css && !el.attributes.length) { unwrapEl(el); return; }
    if (tag === 'DIV' && !el.classList.length) {
      // div berisi inline saja → paragraf
      var hasBlock = Array.prototype.some.call(el.children, function (x) { return isFlowBlock(x.tagName) || x.tagName === 'LI'; });
      if (!hasBlock) renameEl(el, 'p');
      else unwrapEl(el);
    }
  }
  clean(body);
  // 6) struktur: paragraf kosong Word (&nbsp;) → <p><br></p>
  qsa(body, 'p,h1,h2,h3,h4,h5,h6,li,td,th').forEach(function (p) {
    if (!p.textContent.replace(/[\u00a0\s\u200B]/g, '').length && !qs(p, 'img,.sp-tab,br,table')) p.innerHTML = '<br>';
    else if (/^T[DH]$/.test(p.tagName) && !qs(p, 'p,ol,ul,table,div')) { var np = doc.createElement('p'); while (p.firstChild) np.appendChild(p.firstChild); p.appendChild(np); }
  });
  qsa(body, '[data-sp-brk]').forEach(function (el) {
    el.removeAttribute('data-sp-brk');
    var pb = doc.createElement('div'); pb.className = 'sp-pagebreak'; pb.setAttribute('contenteditable', 'false');
    if (el.previousElementSibling || el.parentNode !== body) el.parentNode.insertBefore(pb, el);
  });
  // teks nbsp berlebih Word di antara kata → spasi biasa (kecuali berurutan)
  var w3 = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT), t3;
  while ((t3 = w3.nextNode())) { if (t3.nodeValue.indexOf('\u00a0') > -1) t3.nodeValue = t3.nodeValue.replace(/([^\u00a0\s])\u00a0(?=[^\u00a0\s])/g, '$1 '); if (/^\s*[\r\n]+\s*$/.test(t3.nodeValue) && t3.parentNode && /^(TR|TBODY|TABLE|UL|OL|BODY|COLGROUP)$/.test(t3.parentNode.tagName)) t3.nodeValue = ''; }
  // teks biasa tanpa baris baru di dalam paragraf: ganti \n dari sumber HTML menjadi spasi
  var w4 = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT), t4;
  while ((t4 = w4.nextNode())) if (/[\r\n]/.test(t4.nodeValue)) t4.nodeValue = t4.nodeValue.replace(/\s*[\r\n]+\s*/g, ' ');
  var frag = document.createDocumentFragment();
  Array.prototype.slice.call(body.childNodes).forEach(function (n) { frag.appendChild(document.importNode(n, true)); });
  return frag;
};
function unwrapEl(el) { var p = el.parentNode; if (!p) return; while (el.firstChild) p.insertBefore(el.firstChild, el); p.removeChild(el); }
function renameEl(el, tag, style) {
  var n = el.ownerDocument.createElement(tag);
  Array.prototype.slice.call(el.attributes).forEach(function (a) { n.setAttribute(a.name, a.value); });
  if (style) n.setAttribute('style', style + ';' + (n.getAttribute('style') || ''));
  while (el.firstChild) n.appendChild(el.firstChild);
  el.parentNode.replaceChild(n, el);
  return n;
}
P.textToFrag = function (text) {
  var frag = document.createDocumentFragment(), lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  function fill(host, line) {
    line.split('\t').forEach(function (p, i) { if (i) host.appendChild(tabEl()); if (p) host.appendChild(document.createTextNode(p)); });
  }
  if (lines.length === 1) { fill(frag, lines[0]); return frag; }
  lines.forEach(function (l) { var p = document.createElement('p'); fill(p, l); if (!p.firstChild) p.innerHTML = '<br>'; frag.appendChild(p); });
  return frag;
};
P.onPaste = function (e) {
  var cd = e.clipboardData; if (!cd) return;
  var s = this, html = cd.getData('text/html'), text = cd.getData('text/plain');
  var files = Array.prototype.slice.call(cd.files || []).filter(function (f) { return /^image\//.test(f.type); });
  e.preventDefault();
  if (files.length && (!html || !/<img/i.test(html) || /<img[^>]+src=["']?file:/i.test(html)) && !text.trim()) { files.forEach(function (f) { s.insertImageFile(f); }); return; }
  if (!html && !text) return;
  s.rec();
  var frag;
  if (html && (!s.o.pastePlain)) frag = s.cleanHTML(html); else frag = s.textToFrag(text);
  s.insertFragment(frag);
  s.changed();
};
P.onDrop = function (e) {
  var dt = e.dataTransfer; if (!dt) return;
  var files = Array.prototype.slice.call(dt.files || []).filter(function (f) { return /^image\//.test(f.type); });
  var html = dt.getData('text/html'), text = dt.getData('text/plain');
  if (!files.length && !html && !text) return;
  e.preventDefault();
  var r = null;
  if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(e.clientX, e.clientY);
  if (r && this.ed.contains(r.startContainer)) { var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); this._saved = r.cloneRange(); }
  var s = this;
  if (files.length) { files.forEach(function (f) { s.insertImageFile(f); }); return; }
  s.rec();
  s.insertFragment(html ? s.cleanHTML(html) : s.textToFrag(text));
  s.changed();
};
/* sisipkan fragmen hasil paste ke posisi kursor dengan penggabungan paragraf ala Word */
P.insertFragment = function (frag) {
  var s = this, r = s.restoreSel(); if (!r) return;
  if (!r.collapsed) { document.execCommand('delete'); r = s.range(); }
  var tops = Array.prototype.slice.call(frag.childNodes);
  var blocksIn = tops.filter(function (n) { return n.nodeType === 1 && (isFlowBlock(n.tagName) || n.tagName === 'LI'); });
  // satu paragraf saja → sisip inline (menempel di baris kursor)
  if (blocksIn.length === 1 && /^(P|H[1-6])$/.test(blocksIn[0].tagName) && tops.every(function (n) { return n === blocksIn[0] || (n.nodeType === 3 && !n.nodeValue.trim()); })) {
    var one = blocksIn[0], f2 = document.createDocumentFragment();
    while (one.firstChild) f2.appendChild(one.firstChild);
    if (f2.childNodes.length === 1 && f2.firstChild.nodeName === 'BR') return;
    frag = f2; blocksIn = [];
  }
  if (!blocksIn.length) {
    var last = frag.lastChild;
    if (!last) return;
    r.insertNode(frag);
    var ar = document.createRange();
    if (isTab(last)) { var z = document.createTextNode(ZW); last.parentNode.insertBefore(z, last.nextSibling); ar.setStart(z, 1); }
    else if (last.nodeType === 3) ar.setStart(last, last.length); else ar.setStartAfter(last);
    ar.collapse(true); var sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(ar); s._saved = ar.cloneRange();
    s.convertFonts(null, true);
    return;
  }
  // bungkus inline yatim di fragmen menjadi paragraf
  var holder = document.createElement('div'); holder.appendChild(frag); s.wrapRuns(holder);
  var b = s.anchorBlock();
  if (b && b.tagName === 'LI') {
    // di dalam list: paragraf → item list
    var list = b.parentNode, after = b;
    var items = [];
    Array.prototype.slice.call(holder.children).forEach(function (n) {
      if (/^(P|H[1-6])$/.test(n.tagName)) { var li = document.createElement('li'); while (n.firstChild) li.appendChild(n.firstChild); items.push(li); }
      else if (isList(n)) qsa(n, ':scope > li').forEach(function (li) { items.push(li); });
      else items.push(n);
    });
    var tail = s.splitAt(b, s.range());
    var headEmpty = isEmptyBlock(b);
    items.forEach(function (it) {
      if (it.tagName === 'LI') { list.insertBefore(it, (tail && tail.parentNode === list) ? tail : after.nextSibling); after = it; }
      else { var top = list; while (top.parentNode !== s.ed && !/^T[DH]$/.test(top.parentNode.tagName)) top = top.parentNode; top.parentNode.insertBefore(it, top.nextSibling); }
    });
    if (tail && tail === b) { /* kursor di awal */ } else if (headEmpty && b !== tail) b.remove();
    s.caretEnd(after);
  } else {
    var nodes = Array.prototype.slice.call(holder.childNodes);
    var lastN = nodes[nodes.length - 1];
    s.insertBlocks(nodes);
    s.caretEnd(lastN);
  }
  s.wrapRuns(s.ed); s.ensureTrailing(); s.convertFonts(null, true);
};
P.caretEnd = function (n) {
  if (!n || !n.parentNode) return;
  if (n.nodeType === 1 && /^(TABLE|HR)$/.test(n.tagName) || (n.classList && (n.classList.contains('sp-pagebreak') || n.classList.contains('sp-img-wrap')))) {
    var nx = n.nextElementSibling; if (nx) { this.setCaret(nx, 0); return; }
  }
  var r = document.createRange();
  if (n.nodeType === 1) {
    var lastT = null, w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT), t; while ((t = w.nextNode())) lastT = t;
    if (lastT) r.setStart(lastT, lastT.length); else r.setStart(n, n.childNodes.length && n.lastChild.nodeName === 'BR' ? n.childNodes.length - 1 : n.childNodes.length);
  } else r.setStart(n, n.length);
  r.collapse(true); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); this._saved = r.cloneRange();
};

/* ================================================================
 * PENGATURAN HALAMAN (kertas, orientasi, margin, font & spasi default)
 * ================================================================ */
P.pageDialog = function () {
  var s = this, d = s.doc, m = d.m;
  var papers = Object.keys(PAPERS).map(function (k) { return '<option value="' + k + '"' + (k === d.paper ? ' selected' : '') + '>' + PAPERS[k].label + '</option>'; }).join('');
  var fonts = FONTS.map(function (f) { return '<option' + (f === d.font ? ' selected' : '') + '>' + f + '</option>'; }).join('');
  if (FONTS.indexOf(d.font) < 0) fonts = '<option selected>' + esc(d.font) + '</option>' + fonts;
  var lss = LINE_SP.map(function (v) { return '<option value="' + v + '"' + (v === d.ls ? ' selected' : '') + '>' + fmtNum(v) + '</option>'; }).join('');
  if (LINE_SP.indexOf(d.ls) < 0) lss = '<option value="' + d.ls + '" selected>' + fmtNum(d.ls) + '</option>' + lss;
  function cm(v) { return fmtNum(v / CM); }
  s.dialog('Pengaturan halaman',
    '<div class="sp-fs"><div class="sp-fl">Kertas</div><div class="sp-row"><label>Ukuran<select name="paper">' + papers + '</select></label>' +
      '<label>Orientasi<select name="orient"><option value="portrait">Tegak (portrait)</option><option value="landscape"' + (d.orient === 'landscape' ? ' selected' : '') + '>Mendatar (landscape)</option></select></label></div></div>' +
    '<div class="sp-fs"><div class="sp-fl">Margin (cm)</div><div class="sp-row"><label>Atas<input name="t" value="' + cm(m.t) + '"></label><label>Bawah<input name="b" value="' + cm(m.b) + '"></label></div>' +
      '<div class="sp-row"><label>Kiri<input name="l" value="' + cm(m.l) + '"></label><label>Kanan<input name="r" value="' + cm(m.r) + '"></label></div>' +
      '<p class="sp-hint">Surat dinas umumnya: kiri 3 cm (atau 2,5 cm), atas/kanan/bawah 2 cm.</p></div>' +
    '<div class="sp-fs"><div class="sp-fl">Default dokumen</div><div class="sp-row"><label>Huruf<select name="font">' + fonts + '</select></label>' +
      '<label>Ukuran (pt)<input name="size" value="' + fmtNum(d.size, 1) + '"></label><label>Spasi baris<select name="ls">' + lss + '</select></label></div></div>',
    function (f) {
      var v = {};
      ['t', 'r', 'b', 'l'].forEach(function (k) { var x = parseNum(f[k].value); v[k] = isNaN(x) ? m[k] : clamp(x, 0, 10) * CM; });
      s.rec();
      d.paper = f.paper.value; d.orient = f.orient.value; d.m = v;
      d.font = f.font.value; var sz = parseNum(f.size.value); if (sz >= 4 && sz <= 72) d.size = rnd(sz, 1);
      d.ls = parseNum(f.ls.value) || 1;
      s.applyPage(true); s.refreshLS(); s.changed(); s.focus();
    });
};

/* ================================================================
 * CETAK — iframe tersembunyi dengan @page (ukuran kertas + margin persis)
 * ================================================================ */
/* [Modifikasi Sistem Surat Klinik] Margin @page dibuat 0 agar browser tidak
 * punya ruang untuk header/footer bawaannya (URL halaman, judul, tanggal,
 * nomor halaman) yang ikut tercetak ke PDF. Margin surat dipindah ke dalam:
 * kiri/kanan lewat padding body, atas/bawah lewat <thead>/<tfoot> kosong di
 * tabel pembingkai (printHTML) yang diulang browser di setiap halaman. */
P.printCSS = function () {
  var d = this.doc, m = d.m, sz = this.paperSize();
  var cm = function (v) { return rnd(v / CM, 3) + 'cm'; };
  return '@page{size:' + rnd(sz.w / CM, 2) + 'cm ' + rnd(sz.h / CM, 2) + 'cm;margin:0}' +
    'html,body{margin:0;padding:0;background:#fff}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:0 ' + cm(m.r) + ' 0 ' + cm(m.l) + '}' +
    'table.sp-print-frame{width:100%;border-collapse:collapse;border:0}table.sp-print-frame>*>tr>td{padding:0;border:0;vertical-align:top}' +
    'table.sp-print-frame>thead>tr>td{height:' + cm(m.t) + '}table.sp-print-frame>tfoot>tr>td{height:' + cm(m.b) + '}' +
    contentCSS('.sp-doc') + '\n.sp-doc{max-width:none!important;margin:0!important}' +
    '.sp-doc p,.sp-doc li,.sp-doc h1,.sp-doc h2,.sp-doc h3,.sp-doc tr,.sp-doc .sp-img-wrap{break-inside:avoid;page-break-inside:avoid}' +
    '.sp-doc h1,.sp-doc h2,.sp-doc h3{break-after:avoid}.sp-doc table.sp-nob td,.sp-doc table.sp-nob th{border-color:transparent!important}';
};
P.printHTML = function (title) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title || this.o.title || 'Surat') + '</title><style>' + this.printCSS() + '</style></head><body>' +
    '<table class="sp-print-frame"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot><tbody><tr><td>' +
    this.getCleanHTML(true) + '</td></tr></tbody></table></body></html>';
};
P.print = function () {
  var s = this, fr = document.createElement('iframe');
  fr.setAttribute('aria-hidden', 'true');
  fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(fr);
  var w = fr.contentWindow, doc = w.document;
  doc.open(); doc.write(s.printHTML()); doc.close();
  var go = function () {
    var imgs = qsa(doc, 'img'), left = imgs.length;
    var fire = function () { try { w.focus(); w.print(); } catch (e) {} setTimeout(function () { fr.remove(); }, 1500); };
    var wait = function () { if (--left <= 0) fire(); };
    if (!left) { fire(); return; }
    imgs.forEach(function (im) { if (im.complete) wait(); else { im.onload = im.onerror = wait; } });
  };
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { setTimeout(go, 50); }); else setTimeout(go, 200);
};

/* ================================================================
 * UNDUH .doc (HTML ala Word — dibuka MS Word/WPS dengan tab, tab stop, spasi, margin)
 * ================================================================ */
P.wordHTML = function () {
  var s = this, d = s.doc, m = d.m, sz = s.paperSize(), c = s.cleanClone();
  qsa(c, '.sp-tab').forEach(function (t) {
    var sp = document.createElement('span'); sp.setAttribute('style', 'mso-tab-count:1'); sp.innerHTML = '&nbsp;&nbsp;&nbsp;&nbsp; ';
    t.parentNode.replaceChild(sp, t);
  });
  qsa(c, '[data-tabs]').forEach(function (b) {
    var ts = parseTabs(b).map(function (x) { return ({ l: 'left', c: 'center', r: 'right' }[x.t]) + (x.lead ? ' ' + ({ dot: 'dotted', dash: 'dashed', line: 'lined' }[x.lead]) : '') + ' ' + rnd(x.x / PT, 1) + 'pt'; }).join(' ');
    b.setAttribute('style', (b.getAttribute('style') || '') + ';tab-stops:' + ts);
    b.removeAttribute('data-tabs');
  });
  qsa(c, 'p,h1,h2,h3,h4,h5,h6,li,div:not(.sp-img-wrap):not(.sp-pagebreak)').forEach(function (b) {
    var a = b.getAttribute('data-ls');
    if (a) {
      b.style.lineHeight = '';
      if (a.charAt(0) === 'x') b.setAttribute('style', (b.getAttribute('style') || '') + ';line-height:' + a.slice(1) + 'pt;mso-line-height-rule:exactly');
      else b.setAttribute('style', (b.getAttribute('style') || '') + ';line-height:' + Math.round(parseNum(a) * 100) + '%');
      b.removeAttribute('data-ls');
    } else if (d.ls !== 1) {
      b.style.lineHeight = Math.round(d.ls * 100) + '%';
    }
  });
  qsa(c, '.sp-pagebreak').forEach(function (p) {
    var br = mk('br'); br.setAttribute('clear', 'all'); br.setAttribute('style', 'mso-special-character:line-break;page-break-before:always');
    p.parentNode.replaceChild(br, p);
  });
  qsa(c, 'td,th').forEach(function (t) {
    var st = t.getAttribute('style') || '';
    if (/transparent/.test(st)) t.setAttribute('style', st.replace(/border(-\w+)?:\s*1px solid transparent/g, 'border$1:none'));
  });
  qsa(c, '.sp-img-wrap').forEach(function (w) {
    var p = document.createElement('p'); p.setAttribute('style', 'text-align:' + (w.style.textAlign || 'center'));
    while (w.firstChild) p.appendChild(w.firstChild);
    w.parentNode.replaceChild(p, w);
  });
  qsa(c, 'img').forEach(function (im) {
    var wcm = parseLen(im.style.width); if (wcm > 0) im.setAttribute('width', Math.round(wcm));
  });
  var mm = [m.t, m.r, m.b, m.l].map(function (v) { return rnd(v / CM, 2) + 'cm'; }).join(' ');
  var font = /\s/.test(d.font) ? '"' + d.font + '"' : d.font;
  return '\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>' + esc(s.o.title || 'Surat') + '</title>' +
    '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->' +
    '<style>@page WordSection1{size:' + rnd(sz.w / CM, 2) + 'cm ' + rnd(sz.h / CM, 2) + 'cm;margin:' + mm + ';mso-page-orientation:' + d.orient + '}' +
    'div.WordSection1{page:WordSection1}p,li,h1,h2,h3{margin:0}body{font-family:' + font + ';font-size:' + d.size + 'pt}' +
    'p.MsoNormal,li.MsoNormal,div.MsoNormal{margin:0;font-family:' + font + ';font-size:' + d.size + 'pt}table{border-collapse:collapse}td,th{vertical-align:top}</style></head>' +
    '<body lang="IN"><div class="WordSection1">' + c.innerHTML.replace(/<p(?=[\s>])/g, '<p class="MsoNormal"') + '</div></body></html>';
};
P.exportDoc = function (name) {
  var blob = new Blob([this.wordHTML()], { type: 'application/msword' });
  var a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url; a.download = (name || this.o.fileName || 'surat').replace(/\.docx?$/i, '') + '.doc';
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
};

/* ================================================================
 * LAYAR PENUH
 * ================================================================ */
P.toggleFull = function (on) {
  var w = this.wrap; on = on == null ? !w.classList.contains('sp-full') : on;
  w.classList.toggle('sp-full', on);
  document.documentElement.classList.toggle('sp-noscroll', on);
  qs(this.tb, '[data-cmd=fullscreen]').classList.toggle('on', on);
  var s = this; setTimeout(function () { s.positionRuler(); s.updateImgBox(); s.focus(); }, 30);
};

/* ================================================================
 * API PUBLIK  —  window.SuratPro
 * ================================================================ */
Editor.instances = [];
Editor.active = null;
function act() { return Editor.active || Editor.instances[0] || null; }
var API = {
  version: '4.0',
  Editor: Editor,
  instances: Editor.instances,
  PAPERS: PAPERS,
  init: function (o) { return new Editor(o); },
  get: function (sel) {
    var el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    return Editor.instances.filter(function (e) { return e.ct === el; })[0] || null;
  },
  getContent: function () { var e = act(); return e ? e.getContent() : ''; },
  getCleanHTML: function (w) { var e = act(); return e ? e.getCleanHTML(w) : ''; },
  setContent: function (h) { var e = act(); if (e) e.setContent(h); },
  getText: function () { var e = act(); return e ? e.getText() : ''; },
  focus: function () { var e = act(); if (e) e.focus(); },
  contentCSS: contentCSS,
  /* halaman lihat: tampilkan .sp-doc sebagai lembar kertas (lebar, margin sesuai data-sp-*) */
  renderPaper: function (root) {
    root = typeof root === 'string' ? document.querySelector(root) : (root || document);
    if (!document.getElementById('sp-doc-css')) {
      var st = document.createElement('style'); st.id = 'sp-doc-css'; st.textContent = contentCSS('.sp-doc');
      (document.head || document.documentElement).appendChild(st);
    }
    qsa(root, '.sp-doc').forEach(function (d) {
      var p = PAPERS[d.getAttribute('data-sp-paper')] || PAPERS.A4, land = d.getAttribute('data-sp-orient') === 'landscape';
      var mg = (d.getAttribute('data-sp-margins') || '2.54 2.54 2.54 2.54').split(/\s+/).map(parseNum);
      d.style.maxWidth = 'none'; d.style.boxSizing = 'border-box';
      d.style.width = (land ? p.h : p.w) + 'cm'; d.style.minHeight = (land ? p.w : p.h) + 'cm';
      d.style.padding = mg.map(function (v) { return v + 'cm'; }).join(' ');
      d.style.background = '#fff'; d.style.boxShadow = '0 1px 4px rgba(0,0,0,.18)'; d.style.margin = '16px auto';
    });
  }
};
global.SuratPro = API;
if (typeof module === 'object' && module.exports) module.exports = API;

})(typeof window !== 'undefined' ? window : this);
