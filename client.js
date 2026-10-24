/**
 * dsh-aurora-glass — client half (Web UI).
 *
 * v1.3.0
 *
 *   • Zero required services (`inject: []`): the whole UI is plain DOM mounted
 *     on `document.body`, so no fiber can sit in `pending` and no React /
 *     slots / theme service is needed.
 *   • The control sits in its own fixed layer with z-index 2147483647, so no
 *     other plugin's overlay can cover it. It lives just above the sidebar
 *     avatar.
 *   • The aurora is three blurred blobs drifting on independent timings, plus
 *     a slow hue rotation, so the background colour actually flows.
 *   • Sliders drive CSS custom properties (`--ag-g`, `--ag-blur`, …) instead of
 *     rebuilding the stylesheet: dragging stays smooth, and the token layer
 *     computes its alpha with `calc()` inside `rgb()`.
 *   • The composer card gets a real frosted-glass treatment, targeted through
 *     the stable parts of the hashed class names (`[class*="composerHero"]`,
 *     `[class$="_card"]`).
 *
 * Nothing in this file may throw out of `apply`: a failed client entry aborts
 * the whole web boot.
 */

window.__ModuleLoader__.load({
  id: 'dsh-aurora-glass',
  factory() {
    'use strict';

    const PKG = 'dsh-aurora-glass';
    const VERSION = '1.3.0';
    const STORAGE_KEY = 'dsh-aurora-glass:settings:v2';
    const STYLE_ID = 'dsh-aurora-glass-theme';
    const UI_STYLE_ID = 'dsh-aurora-glass-ui';
    const ROOT_ID = 'dsh-ag-root';
    const BG_ID = 'dsh-ag-bg';

    /* ------------------------------------------------------------------ *
     * palettes & presets
     * ------------------------------------------------------------------ */

    const PALETTES = [
      {
        id: 'aurora',
        label: 'Aurora',
        brand: { light: '#4763ff', dark: '#8fb0ff' },
        glow: ['rgba(96,126,255,.95)', 'rgba(168,85,247,.82)', 'rgba(236,72,153,.68)'],
      },
      {
        id: 'ocean',
        label: 'Ocean',
        brand: { light: '#0b7bf1', dark: '#7cc4ff' },
        glow: ['rgba(34,211,238,.9)', 'rgba(59,130,246,.84)', 'rgba(16,185,129,.62)'],
      },
      {
        id: 'ember',
        label: 'Ember',
        brand: { light: '#ea580c', dark: '#ffb27d' },
        glow: ['rgba(251,146,60,.9)', 'rgba(244,63,94,.78)', 'rgba(217,70,239,.62)'],
      },
      {
        id: 'jade',
        label: 'Jade',
        brand: { light: '#059669', dark: '#6ee7b7' },
        glow: ['rgba(52,211,153,.86)', 'rgba(45,212,191,.76)', 'rgba(56,189,248,.6)'],
      },
      {
        id: 'mono',
        label: 'Mono',
        brand: { light: '#4b5563', dark: '#cbd5e1' },
        glow: ['rgba(148,163,184,.72)', 'rgba(203,213,225,.58)', 'rgba(99,102,241,.46)'],
      },
    ];

    const PRESETS = [
      { id: 'default', key: 'preset.default', set: { glass: 0.85, blur: 32, saturation: 1.18, motion: 'soft', aurora: true, grain: true } },
      { id: 'mist', key: 'preset.mist', set: { glass: 0.9, blur: 46, saturation: 0.8, motion: 'off', aurora: true, grain: true } },
      { id: 'depth', key: 'preset.depth', set: { glass: 0.52, blur: 18, saturation: 1.35, motion: 'full', aurora: true, grain: true } },
      { id: 'pure', key: 'preset.pure', set: { glass: 0, blur: 0, saturation: 1, motion: 'off', aurora: false, grain: false } },
    ];

    const DEFAULT_SETTINGS = {
      enabled: true,
      preset: 'default',
      palette: 'aurora',
      glass: 0.85,
      blur: 32,
      saturation: 1.18,
      motion: 'soft',
      grain: true,
      aurora: true,
    };

    /* ------------------------------------------------------------------ *
     * i18n
     * ------------------------------------------------------------------ */

    const DICTS = {
      zh: {
        'panel.toggle': '极光玻璃设置',
        'panel.title': '极光玻璃',
        'sec.preset': '预设',
        'sec.palette': '色板',
        'sec.surface': '表面',
        'sec.look': '氛围',
        'preset.default': '默认',
        'preset.mist': '轻雾',
        'preset.depth': '深空',
        'preset.pure': '原版观感',
        'ctl.glass': '玻璃强度',
        'ctl.blur': '光晕',
        'ctl.saturation': '色彩',
        'seg.motion.off': '关闭',
        'seg.motion.soft': '柔和',
        'seg.motion.full': '丰富',
        'ctl.motion': '动效',
        'sw.aurora': '极光背景',
        'sw.grain': '噪点质感',
        'sw.enabled': '玻璃主题',
        reset: '恢复默认设置',
        close: '关闭',
      },
      en: {
        'panel.toggle': 'Aurora Glass settings',
        'panel.title': 'Aurora Glass',
        'sec.preset': 'Presets',
        'sec.palette': 'Palette',
        'sec.surface': 'Surface',
        'sec.look': 'Atmosphere',
        'preset.default': 'Default',
        'preset.mist': 'Mist',
        'preset.depth': 'Deep',
        'preset.pure': 'Original',
        'ctl.glass': 'Glass',
        'ctl.blur': 'Glow',
        'ctl.saturation': 'Color',
        'seg.motion.off': 'Off',
        'seg.motion.soft': 'Soft',
        'seg.motion.full': 'Rich',
        'ctl.motion': 'Motion',
        'sw.aurora': 'Aurora glow',
        'sw.grain': 'Film grain',
        'sw.enabled': 'Glass theme',
        reset: 'Reset to defaults',
        close: 'Close',
      },
    };

    const isZh = (() => {
      try {
        const nav = typeof navigator !== 'undefined' ? navigator : null;
        const lang = String((nav && (nav.language || nav.userLanguage)) || 'en');
        return lang.toLowerCase().indexOf('zh') === 0;
      } catch {
        return false;
      }
    })();
    const t = (key) => {
      const dict = DICTS[isZh ? 'zh' : 'en'];
      return dict[key] || DICTS.en[key] || key;
    };

    /* ------------------------------------------------------------------ *
     * settings
     * ------------------------------------------------------------------ */

    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
    const paletteOf = (id) => PALETTES.filter((p) => p.id === id)[0] || PALETTES[0];

    function loadSettings() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
        if (parsed.motion === true) parsed.motion = 'full';
        if (parsed.motion === false) parsed.motion = 'off';
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    }

    let state = loadSettings();

    function save() {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* storage unavailable — settings stay in memory */
      }
    }

    /* ------------------------------------------------------------------ *
     * theme stylesheet
     *
     * Alpha is computed in CSS: `--ag-g` (0..1) is the glass slider, so a drag
     * only writes one custom property instead of re-parsing a sheet.
     * ------------------------------------------------------------------ */

    const NOISE =
      'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27160%27 height=%27160%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.85%27 numOctaves=%272%27 stitchTiles=%27stitch%27/%3E%3CfeColorMatrix type=%27saturate%27 values=%270%27/%3E%3C/filter%3E%3Crect width=%27160%27 height=%27160%27 filter=%27url(%23n)%27 opacity=%270.6%27/%3E%3C/svg%3E")';

    function buildSheet(pal) {
      const c1 = pal.glow[0];
      const c2 = pal.glow[1];
      const c3 = pal.glow[2];
      return `/* ${PKG} v${VERSION} — palette:${pal.id} */
:root{
  --ag-g:.78; --ag-blur:30; --ag-sat:1.15; --ag-grain:1;
  --ag-d1:34s; --ag-d2:44s; --ag-d3:54s;
}
html.ag-m0 #${BG_ID} i{ animation:none !important; }
html.ag-m2{ --ag-d1:18s; --ag-d2:24s; --ag-d3:30s; }

/* ---- canvas -------------------------------------------------------- */
html{
  background-color:#eef2f9 !important;
  background-image:none !important;
}
html:has(body[data-ds-dark-theme]){ background-color:#05070d !important; }
body{
  background:transparent !important;
  background-color:transparent !important;
}

/* ---- aurora -------------------------------------------------------- */
#${BG_ID}{
  position:fixed; inset:0; z-index:-1; pointer-events:none; overflow:hidden;
  animation:ag-hue 72s linear infinite alternate;
}
#${BG_ID} i{
  position:absolute; display:block; border-radius:50%;
  filter:blur(calc(var(--ag-blur) * 1px)) saturate(var(--ag-sat));
  opacity:calc(.6 + .35 * var(--ag-g));
  will-change:transform; transform:translate3d(0,0,0);
}
#${BG_ID} i:nth-of-type(1){
  width:80vmax; height:80vmax; left:-24vmax; top:-30vmax;
  background:radial-gradient(circle at 50% 50%, ${c1} 0%, transparent 72%);
  animation:ag-f1 var(--ag-d1) ease-in-out infinite alternate;
}
#${BG_ID} i:nth-of-type(2){
  width:70vmax; height:70vmax; right:-26vmax; top:-16vmax;
  background:radial-gradient(circle at 50% 50%, ${c2} 0%, transparent 74%);
  animation:ag-f2 var(--ag-d2) ease-in-out infinite alternate;
}
#${BG_ID} i:nth-of-type(3){
  width:86vmax; height:86vmax; left:14vmax; bottom:-46vmax;
  background:radial-gradient(circle at 50% 50%, ${c3} 0%, transparent 76%);
  animation:ag-f3 var(--ag-d3) ease-in-out infinite alternate;
}
#${BG_ID} .ag-scrim{
  position:absolute; inset:0; display:block; pointer-events:none;
  background:rgb(238 242 249 / calc(.08 + .10 * var(--ag-g)));
}
body[data-ds-dark-theme] #${BG_ID} .ag-scrim{
  background:rgb(5 7 13 / calc(.26 + .14 * var(--ag-g)));
}
#${BG_ID} .ag-grain{
  position:absolute; inset:0; display:block; pointer-events:none;
  background-image:${NOISE}; background-size:160px 160px;
  opacity:calc(.45 * var(--ag-grain)); mix-blend-mode:soft-light;
}
@keyframes ag-hue{ from{ filter:hue-rotate(-14deg) } to{ filter:hue-rotate(16deg) } }
@keyframes ag-f1{
  from{ transform:translate3d(0,0,0) scale(1) }
  to{ transform:translate3d(11vmax,9vmax,0) scale(1.28) }
}
@keyframes ag-f2{
  from{ transform:translate3d(0,0,0) scale(1.12) }
  to{ transform:translate3d(-13vmax,7vmax,0) scale(.88) }
}
@keyframes ag-f3{
  from{ transform:translate3d(0,0,0) scale(.94) }
  to{ transform:translate3d(9vmax,-11vmax,0) scale(1.22) }
}

/* ---- alias tokens, light ------------------------------------------- */
body{
  --dsw-alias-bg-base: rgb(247 249 254 / calc(.93 - .30 * var(--ag-g))) !important;
  --dsw-alias-bg-layer-1: rgb(255 255 255 / calc(.66 + .24 * var(--ag-g))) !important;
  --dsw-alias-bg-layer-2: rgb(255 255 255 / calc(.78 + .18 * var(--ag-g))) !important;
  --dsw-alias-bg-layer-3: rgb(255 255 255 / calc(.88 + .10 * var(--ag-g))) !important;
  --dsw-alias-bg-overlay: rgb(252 253 255 / calc(.97 - .06 * var(--ag-g))) !important;
  --dsw-alias-bg-module-platform: rgb(255 255 255 / calc(.62 + .28 * var(--ag-g))) !important;
  --dsw-alias-bg-multi-select: rgb(255 255 255 / calc(.66 + .24 * var(--ag-g))) !important;
  --dsw-alias-border-l1: rgb(15 23 42 / .12) !important;
  --dsw-alias-border-l2: rgb(15 23 42 / .09) !important;
  --dsw-alias-border-l3: rgb(15 23 42 / .14) !important;
  --dsw-alias-border-l4: rgb(15 23 42 / .18) !important;
  --dsw-specific-sidebar-fill: rgb(255 255 255 / calc(.34 + .26 * var(--ag-g))) !important;
  --dsw-alias-brand-primary: ${pal.brand.light} !important;
}

/* ---- alias tokens, dark -------------------------------------------- */
body[data-ds-dark-theme]{
  --dsw-alias-bg-base: rgb(11 13 22 / calc(.80 - .36 * var(--ag-g))) !important;
  --dsw-alias-bg-layer-1: rgb(255 255 255 / calc(.08 + .06 * var(--ag-g))) !important;
  --dsw-alias-bg-layer-2: rgb(255 255 255 / calc(.11 + .07 * var(--ag-g))) !important;
  --dsw-alias-bg-layer-3: rgb(255 255 255 / calc(.14 + .08 * var(--ag-g))) !important;
  --dsw-alias-bg-overlay: rgb(12 14 24 / calc(.97 - .12 * var(--ag-g))) !important;
  --dsw-alias-bg-module-platform: rgb(255 255 255 / calc(.07 + .05 * var(--ag-g))) !important;
  --dsw-alias-bg-multi-select: rgb(255 255 255 / calc(.10 + .05 * var(--ag-g))) !important;
  --dsw-alias-border-l1: rgb(255 255 255 / calc(.12 + .06 * var(--ag-g))) !important;
  --dsw-alias-border-l2: rgb(255 255 255 / calc(.09 + .04 * var(--ag-g))) !important;
  --dsw-alias-border-l3: rgb(255 255 255 / calc(.15 + .06 * var(--ag-g))) !important;
  --dsw-alias-border-l4: rgb(255 255 255 / calc(.19 + .07 * var(--ag-g))) !important;
  --dsw-specific-sidebar-fill: rgb(255 255 255 / calc(.03 + .03 * var(--ag-g))) !important;
  --dsw-alias-brand-primary: ${pal.brand.dark} !important;
}

/* ---- composer: frosted glass card ----------------------------------- */
[class*="composerSeat"]{
  background:linear-gradient(180deg, rgb(8 10 18 / 0) 0px, rgb(8 10 18 / calc(.22 + .30 * var(--ag-g))) 48px) !important;
}
body:not([data-ds-dark-theme]) [class*="composerSeat"]{
  background:linear-gradient(180deg, rgb(238 242 249 / 0) 0px, rgb(238 242 249 / calc(.30 + .34 * var(--ag-g))) 48px) !important;
}
[class*="composerHero"] [class$="_card"],
[class*="composerSeat"] [class$="_card"]{
  background:rgb(255 255 255 / calc(.05 + .07 * var(--ag-g))) !important;
  backdrop-filter:blur(20px) saturate(1.6) !important;
  -webkit-backdrop-filter:blur(20px) saturate(1.6) !important;
  border:1px solid rgb(255 255 255 / calc(.10 + .08 * var(--ag-g))) !important;
  box-shadow:0 18px 48px rgb(0 0 0 / .34), inset 0 1px 0 rgb(255 255 255 / .10) !important;
  transition:box-shadow .25s ease, border-color .25s ease;
}
[class*="composerHero"] [class$="_card"]:focus-within,
[class*="composerSeat"] [class$="_card"]:focus-within{
  border-color:rgb(255 255 255 / .26) !important;
  box-shadow:0 20px 56px rgb(0 0 0 / .42), inset 0 1px 0 rgb(255 255 255 / .16), 0 0 0 3px rgb(143 176 255 / .14) !important;
}
body:not([data-ds-dark-theme]) [class*="composerHero"] [class$="_card"],
body:not([data-ds-dark-theme]) [class*="composerSeat"] [class$="_card"]{
  background:rgb(255 255 255 / calc(.52 + .30 * var(--ag-g))) !important;
  border-color:rgb(15 23 42 / .10) !important;
  box-shadow:0 16px 42px rgb(23 33 64 / .12), inset 0 1px 0 rgb(255 255 255 / .7) !important;
}
`;
    }

    /* ------------------------------------------------------------------ *
     * DOM helpers
     * ------------------------------------------------------------------ */

    function el(tag, attrs, kids) {
      const node = document.createElement(tag);
      if (attrs) {
        Object.keys(attrs).forEach((key) => {
          const value = attrs[key];
          if (value === undefined || value === null) return;
          if (key === 'class') node.className = value;
          else if (key === 'text') node.textContent = value;
          else if (key === 'style') node.setAttribute('style', value);
          else if (key.slice(0, 2) === 'on' && typeof value === 'function') {
            node.addEventListener(key.slice(2).toLowerCase(), value);
          } else node.setAttribute(key, value);
        });
      }
      if (kids) {
        [].concat(kids).forEach((kid) => {
          if (kid === null || kid === undefined || kid === false) return;
          node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
        });
      }
      return node;
    }

    function sparkle(size) {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', String(size));
      svg.setAttribute('height', String(size));
      svg.setAttribute('aria-hidden', 'true');
      svg.style.display = 'block';
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', 'M12 2c.6 4.8 2.4 7.6 8 8-5.6.4-7.4 3.2-8 8-.6-4.8-2.4-7.6-8-8 5.6-.4 7.4-3.2 8-8Z');
      path.setAttribute('fill', 'currentColor');
      svg.appendChild(path);
      return svg;
    }

    /* ------------------------------------------------------------------ *
     * control UI stylesheet
     * ------------------------------------------------------------------ */

    const UI_CSS = `
#${ROOT_ID}{
  position:fixed; left:10px; bottom:184px; z-index:2147483647;
  display:flex; flex-direction:column; align-items:flex-start;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
  font-size:13px; line-height:1.45; color:#e8ecf8; text-align:left;
  -webkit-font-smoothing:antialiased;
}
#${ROOT_ID} *{ box-sizing:border-box; }
#dsh-ag-btn{
  width:34px; height:34px; padding:0; margin:0; border-radius:50%;
  display:grid; place-items:center; cursor:pointer;
  border:1px solid rgba(255,255,255,.22);
  background:rgba(255,255,255,.10);
  backdrop-filter:blur(10px) saturate(1.4); -webkit-backdrop-filter:blur(10px) saturate(1.4);
  color:#dfe6ff; opacity:.5;
  box-shadow:0 6px 18px rgba(0,0,0,.34);
  transition:opacity .25s ease, transform .32s cubic-bezier(.34,1.56,.64,1), box-shadow .3s ease;
}
#dsh-ag-btn:hover{ opacity:1; transform:scale(1.08) rotate(24deg); box-shadow:0 8px 22px rgba(0,0,0,.42), 0 0 0 5px rgba(143,176,255,.14); }
#dsh-ag-btn:active{ transform:scale(.94); }
#dsh-ag-btn.ag-pulse{ animation:ag-halo 4s ease-in-out infinite; }
@keyframes ag-halo{
  0%,100%{ box-shadow:0 6px 18px rgba(0,0,0,.34), 0 0 0 0 rgba(143,176,255,0) }
  50%{ box-shadow:0 6px 18px rgba(0,0,0,.34), 0 0 0 7px rgba(143,176,255,.13) }
}
#dsh-ag-panel{
  position:absolute; left:0; bottom:44px; width:296px;
  max-height:min(620px, calc(100vh - 232px)); overflow-y:auto; overflow-x:hidden;
  padding:14px 14px 12px; border-radius:18px;
  border:1px solid rgba(255,255,255,.16);
  background:rgba(13,15,24,.96);
  backdrop-filter:blur(26px) saturate(1.5); -webkit-backdrop-filter:blur(26px) saturate(1.5);
  box-shadow:0 24px 64px rgba(2,6,20,.6), 0 2px 12px rgba(2,6,20,.35);
  display:none; text-align:left;
}
#${ROOT_ID}[data-open="1"] #dsh-ag-panel{ display:block; animation:ag-pop .26s cubic-bezier(.34,1.56,.64,1); }
@keyframes ag-pop{ from{ opacity:0; transform:scale(.93) translateY(10px) } to{ opacity:1; transform:none } }
#dsh-ag-panel::-webkit-scrollbar{ width:8px; }
#dsh-ag-panel::-webkit-scrollbar-thumb{ background:rgba(148,163,184,.35); border-radius:99px; }
.ag-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:2px; }
.ag-title{ display:flex; align-items:center; gap:7px; font-size:14px; font-weight:700; letter-spacing:.2px; color:#f2f5fd; }
.ag-badge{ font-size:10px; padding:2px 7px; border-radius:99px; background:rgba(255,255,255,.12); color:#aab3cc; font-weight:500; }
.ag-x{
  width:26px; height:26px; border-radius:8px; border:none; padding:0;
  background:rgba(255,255,255,.09); color:#aab3cc; cursor:pointer;
  font-size:12px; line-height:1; transition:background .15s, color .15s;
}
.ag-x:hover{ background:rgba(255,255,255,.2); color:#f2f5fd; }
.ag-sec{ margin-top:13px; }
.ag-label{ font-size:10.5px; color:#8d97b2; letter-spacing:.8px; margin-bottom:7px; text-transform:uppercase; }
.ag-chips{ display:flex; flex-wrap:wrap; gap:6px; }
.ag-chip{
  font:inherit; font-size:12px; font-weight:500; padding:5px 12px; border-radius:99px;
  border:1px solid rgba(255,255,255,.16); background:rgba(255,255,255,.05);
  color:#c6cfe4; cursor:pointer; transition:all .18s;
}
.ag-chip:hover{ color:#f2f5fd; border-color:rgba(255,255,255,.32); }
.ag-chip.on{ color:#fff; background:var(--dsw-alias-brand-primary,#4763ff); border-color:transparent; }
.ag-swatches{ display:flex; gap:10px; align-items:center; }
.ag-swatch{
  width:24px; height:24px; padding:0; border-radius:50%;
  border:2px solid rgba(255,255,255,.34); cursor:pointer;
  transition:transform .18s, box-shadow .18s;
}
.ag-swatch:hover{ transform:scale(1.09); }
.ag-swatch.on{ transform:scale(1.14); box-shadow:0 0 0 2.5px rgba(242,245,253,.92); }
.ag-ctl{ display:flex; align-items:center; gap:10px; margin-top:11px; }
.ag-ctl-label{ width:62px; flex:none; font-size:12px; color:#dbe2f2; }
.ag-range{ flex:1; min-width:0; height:4px; accent-color:var(--dsw-alias-brand-primary,#4763ff); cursor:pointer; }
.ag-val{ width:38px; flex:none; text-align:right; font-size:11px; color:#aab3cc; font-variant-numeric:tabular-nums; }
.ag-row{ display:flex; align-items:center; justify-content:space-between; margin-top:11px; font-size:12.5px; color:#e8ecf8; }
.ag-switch{
  position:relative; width:36px; height:21px; flex:none; padding:0; border:none;
  border-radius:99px; background:rgba(255,255,255,.18); cursor:pointer; transition:background .2s;
}
.ag-switch::after{
  content:""; position:absolute; top:2.5px; left:2.5px; width:16px; height:16px;
  border-radius:50%; background:#fff; transition:transform .22s cubic-bezier(.34,1.56,.64,1);
}
.ag-switch.on{ background:var(--dsw-alias-brand-primary,#4763ff); }
.ag-switch.on::after{ transform:translateX(15px); }
.ag-seg{ display:flex; gap:2px; padding:3px; background:rgba(255,255,255,.08); border-radius:10px; }
.ag-seg-btn{
  flex:1; border:none; background:transparent; color:#aab3cc; font:inherit; font-size:12px;
  padding:5px 0; border-radius:8px; cursor:pointer; transition:all .18s;
}
.ag-seg-btn:hover{ color:#f2f5fd; }
.ag-seg-btn.on{ background:rgba(255,255,255,.17); color:#f2f5fd; }
.ag-reset{
  margin-top:14px; width:100%; font:inherit; font-size:12px; padding:7.5px 0;
  border-radius:10px; border:1px solid rgba(255,255,255,.16);
  background:rgba(255,255,255,.04); color:#c6cfe4; cursor:pointer; transition:all .15s;
}
.ag-reset:hover{ color:#f2f5fd; background:rgba(255,255,255,.1); }
.ag-foot{ margin-top:10px; font-size:10.5px; color:#6f7891; text-align:center; letter-spacing:.3px; }
`;

    /* ------------------------------------------------------------------ *
     * mount / paint
     * ------------------------------------------------------------------ */

    let root = null;
    let bg = null;
    let refs = {};

    function ensureStyle(id, css) {
      let node = document.getElementById(id);
      if (!node) {
        node = document.createElement('style');
        node.id = id;
        node.setAttribute('data-dsh-aurora-glass', '1');
        document.head.appendChild(node);
      }
      if (node.textContent !== css) node.textContent = css;
      return node;
    }

    function applyVars() {
      const html = document.documentElement;
      const on = !!state.enabled;
      html.style.setProperty('--ag-g', String(on ? clamp(state.glass, 0, 1) : 0));
      html.style.setProperty('--ag-blur', String(clamp(state.blur, 0, 60)));
      html.style.setProperty('--ag-sat', String(clamp(state.saturation, 0, 2)));
      html.style.setProperty('--ag-grain', state.grain ? '1' : '0');
      html.classList.toggle('ag-m0', !on || !state.aurora || state.motion === 'off');
      html.classList.toggle('ag-m2', on && state.aurora && state.motion === 'full');
      if (bg) bg.style.display = on && state.aurora ? '' : 'none';
    }

    function applyPalette() {
      ensureStyle(STYLE_ID, buildSheet(paletteOf(state.palette)));
      applyVars();
    }

    function set(patch) {
      state = { ...state, ...patch };
      save();
      if (patch.palette !== undefined) applyPalette();
      else applyVars();
      syncUI();
    }

    function setOpen(open) {
      if (root) root.setAttribute('data-open', open ? '1' : '0');
    }

    /* ---------------------------- panel ---------------------------- */

    function buildPanel() {
      const head = el('div', { class: 'ag-head' }, [
        el('div', { class: 'ag-title' }, [
          sparkle(18),
          el('span', { text: t('panel.title') }),
          el('span', { class: 'ag-badge', text: 'v' + VERSION }),
        ]),
        el('button', { class: 'ag-x', type: 'button', 'aria-label': t('close'), onClick: () => setOpen(false) }, '\u2715'),
      ]);

      const presetChips = PRESETS.map((p) =>
        el('button', {
          class: 'ag-chip',
          type: 'button',
          'data-preset': p.id,
          onClick: () => set({ preset: p.id, ...p.set }),
        }, t(p.key)),
      );

      const swatches = PALETTES.map((p) =>
        el('button', {
          class: 'ag-swatch',
          type: 'button',
          title: p.label,
          'aria-label': p.label,
          'data-palette': p.id,
          style: 'background:linear-gradient(135deg,' + p.glow.join(',') + ')',
          onClick: () => set({ palette: p.id }),
        }),
      );

      const slider = (key, label, min, max, step, fmt) => {
        const input = el('input', {
          class: 'ag-range',
          type: 'range',
          min: String(min),
          max: String(max),
          step: String(step),
          'data-slider': key,
          onInput: (e) => {
            const v = Number(e.target.value);
            state = { ...state, [key]: v };
            save();
            applyVars();
            const out = refs['val-' + key];
            if (out) out.textContent = fmt(v);
          },
        });
        const val = el('span', { class: 'ag-val', text: fmt(state[key]) });
        refs['val-' + key] = val;
        refs['slider-' + key] = input;
        return el('label', { class: 'ag-ctl' }, [
          el('span', { class: 'ag-ctl-label', text: label }),
          input,
          val,
        ]);
      };

      const segButtons = ['off', 'soft', 'full'].map((lv) =>
        el('button', {
          class: 'ag-seg-btn',
          type: 'button',
          'data-motion': lv,
          onClick: () => set({ motion: lv }),
        }, t('seg.motion.' + lv)),
      );

      const sw = (key, label) => {
        const btn = el('button', {
          class: 'ag-switch',
          type: 'button',
          role: 'switch',
          'data-switch': key,
          onClick: () => set({ [key]: !state[key] }),
        });
        refs['sw-' + key] = btn;
        return el('div', { class: 'ag-row' }, [el('span', { text: label }), btn]);
      };

      const panel = el('div', { id: 'dsh-ag-panel', role: 'dialog', 'aria-label': t('panel.title') }, [
        head,
        el('div', { class: 'ag-sec' }, [
          el('div', { class: 'ag-label', text: t('sec.preset') }),
          el('div', { class: 'ag-chips' }, presetChips),
        ]),
        el('div', { class: 'ag-sec' }, [
          el('div', { class: 'ag-label', text: t('sec.palette') }),
          el('div', { class: 'ag-swatches' }, swatches),
        ]),
        el('div', { class: 'ag-sec' }, [
          el('div', { class: 'ag-label', text: t('sec.surface') }),
          slider('glass', t('ctl.glass'), 0, 1, 0.05, (v) => Math.round(v * 100) + '%'),
          slider('blur', t('ctl.blur'), 0, 60, 2, (v) => Math.round(v) + 'px'),
          slider('saturation', t('ctl.saturation'), 0, 2, 0.05, (v) => Math.round(v * 100) + '%'),
        ]),
        el('div', { class: 'ag-sec' }, [
          el('div', { class: 'ag-label', text: t('sec.look') }),
          el('div', { class: 'ag-row', style: 'margin-top:0' }, [
            el('span', { text: t('ctl.motion') }),
            el('div', { class: 'ag-seg', style: 'width:152px' }, segButtons),
          ]),
          sw('aurora', t('sw.aurora')),
          sw('grain', t('sw.grain')),
          sw('enabled', t('sw.enabled')),
        ]),
        el('button', { class: 'ag-reset', type: 'button', onClick: () => set({ ...DEFAULT_SETTINGS }) }, t('reset')),
        el('div', { class: 'ag-foot', text: 'Aurora Glass · ' + VERSION }),
      ]);

      refs.presetChips = presetChips;
      refs.swatches = swatches;
      refs.segButtons = segButtons;
      return panel;
    }

    function syncUI() {
      if (!root) return;
      (refs.presetChips || []).forEach((node) => {
        node.classList.toggle('on', node.getAttribute('data-preset') === state.preset);
      });
      (refs.swatches || []).forEach((node) => {
        node.classList.toggle('on', node.getAttribute('data-palette') === state.palette);
      });
      (refs.segButtons || []).forEach((node) => {
        node.classList.toggle('on', node.getAttribute('data-motion') === state.motion);
      });
      ['aurora', 'grain', 'enabled'].forEach((key) => {
        const node = refs['sw-' + key];
        if (!node) return;
        node.classList.toggle('on', !!state[key]);
        node.setAttribute('aria-checked', String(!!state[key]));
      });
      ['glass', 'blur', 'saturation'].forEach((key) => {
        const node = refs['slider-' + key];
        if (node && document.activeElement !== node) node.value = String(state[key]);
      });
      const btn = document.getElementById('dsh-ag-btn');
      if (btn) btn.classList.toggle('ag-pulse', !!state.enabled && state.motion !== 'off');
    }

    function mount() {
      const stale = document.getElementById(ROOT_ID);
      if (stale) stale.remove();
      const staleBg = document.getElementById(BG_ID);
      if (staleBg) staleBg.remove();

      bg = el('div', { id: BG_ID, 'aria-hidden': 'true' }, [
        el('i'),
        el('i'),
        el('i'),
        el('span', { class: 'ag-scrim' }),
        el('span', { class: 'ag-grain' }),
      ]);
      document.body.appendChild(bg);

      const btn = el('button', {
        id: 'dsh-ag-btn',
        type: 'button',
        title: t('panel.toggle'),
        'aria-label': t('panel.toggle'),
        onClick: (e) => {
          e.stopPropagation();
          setOpen(root.getAttribute('data-open') !== '1');
        },
      }, sparkle(17));

      root = el('div', { id: ROOT_ID, 'data-open': '0' }, [buildPanel(), btn]);
      document.body.appendChild(root);

      applyPalette();
      syncUI();
    }

    function unmount() {
      [ROOT_ID, BG_ID, STYLE_ID, UI_STYLE_ID].forEach((id) => {
        const node = document.getElementById(id);
        if (node && node.parentNode) node.parentNode.removeChild(node);
      });
      root = null;
      bg = null;
      refs = {};
    }

    /* ------------------------------------------------------------------ *
     * plugin
     * ------------------------------------------------------------------ */

    return {
      name: PKG,
      // No client service is required: the control is plain DOM on <body>.
      inject: [],
      apply(ctx) {
        try {
          if (typeof document === 'undefined' || !document.body) return;
          unmount();
          ensureStyle(UI_STYLE_ID, UI_CSS);
          mount();

          const onDocDown = (e) => {
            if (!root || root.getAttribute('data-open') !== '1') return;
            if (root.contains(e.target)) return;
            setOpen(false);
          };
          const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
          };
          document.addEventListener('pointerdown', onDocDown, true);
          document.addEventListener('keydown', onKey);

          const teardown = () => {
            try {
              document.removeEventListener('pointerdown', onDocDown, true);
              document.removeEventListener('keydown', onKey);
            } catch {
              /* already gone */
            }
            unmount();
          };

          try {
            if (ctx && typeof ctx.effect === 'function') ctx.effect(() => teardown);
            else window.addEventListener('beforeunload', teardown);
          } catch {
            /* disposal is best-effort */
          }
        } catch (err) {
          try {
            console.warn('[dsh-aurora-glass] apply failed (ignored):', err);
          } catch {
            /* no console */
          }
        }
      },
    };
  },
});
