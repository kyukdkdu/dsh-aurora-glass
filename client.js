/**
 * dsh-aurora-glass — client half (Web UI).
 *
 * v1.4.0
 *
 * Performance model (this is what the previous version got wrong):
 *   • No full-screen filter on the aurora container. Each blob carries its own
 *     `filter: blur() saturate()`; the blob content never changes, only its
 *     `transform` animates, so Chromium bakes the filter once and the drift
 *     runs entirely on the compositor.
 *   • Sliders write CSS custom properties, and the writes are coalesced into
 *     one `requestAnimationFrame`. `--ag-g` (the token alpha driver) updates
 *     live; `--ag-blur` / `--ag-sat` are committed on `change` (release),
 *     because re-filtering three viewport-sized layers per frame is exactly
 *     what made dragging stutter.
 *   • Only values that actually changed are written back.
 *
 * Interaction model:
 *   • Control lives at the bottom-right, in its own fixed layer on
 *     `document.body` with z-index 2147483647, so no plugin overlay can cover
 *     it.
 *   • Pointer parallax nudges the whole aurora by a few pixels (one transform
 *     per frame, compositor only).
 *
 * Nothing in this file may throw out of `apply`: a failed client entry aborts
 * the whole web boot.
 */

window.__ModuleLoader__.load({
  id: 'dsh-aurora-glass',
  factory() {
    'use strict';

    const PKG = 'dsh-aurora-glass';
    const VERSION = '1.4.0';
    const STORAGE_KEY = 'dsh-aurora-glass:settings:v2';
    const STYLE_ID = 'dsh-aurora-glass-theme';
    const UI_STYLE_ID = 'dsh-aurora-glass-ui';
    const ROOT_ID = 'dsh-ag-root';
    const BG_ID = 'dsh-ag-bg';

    /* ------------------------------------------------------------------ *
     * palettes & presets
     * ------------------------------------------------------------------ */

    const PALETTES = [
      { id: 'aurora', label: 'Aurora', brand: { light: '#4763ff', dark: '#8fb0ff' }, rgb: [[96, 126, 255], [168, 85, 247], [236, 72, 153]] },
      { id: 'ocean', label: 'Ocean', brand: { light: '#0b7bf1', dark: '#7cc4ff' }, rgb: [[34, 211, 238], [59, 130, 246], [16, 185, 129]] },
      { id: 'ember', label: 'Ember', brand: { light: '#ea580c', dark: '#ffb27d' }, rgb: [[251, 146, 60], [244, 63, 94], [217, 70, 239]] },
      { id: 'jade', label: 'Jade', brand: { light: '#059669', dark: '#6ee7b7' }, rgb: [[52, 211, 153], [45, 212, 191], [56, 189, 248]] },
      { id: 'mono', label: 'Mono', brand: { light: '#4b5563', dark: '#cbd5e1' }, rgb: [[148, 163, 184], [203, 213, 225], [99, 102, 241]] },
    ];

    const PRESETS = [
      { id: 'default', key: 'preset.default', set: { glass: 0.82, blur: 34, saturation: 1.15, motion: 'soft', aurora: true, grain: true } },
      { id: 'mist', key: 'preset.mist', set: { glass: 0.92, blur: 52, saturation: 0.85, motion: 'off', aurora: true, grain: true } },
      { id: 'depth', key: 'preset.depth', set: { glass: 0.55, blur: 22, saturation: 1.3, motion: 'full', aurora: true, grain: true } },
      { id: 'pure', key: 'preset.pure', set: { glass: 0, blur: 0, saturation: 1, motion: 'off', aurora: false, grain: false } },
    ];

    const DEFAULT_SETTINGS = {
      enabled: true,
      preset: 'default',
      palette: 'aurora',
      glass: 0.82,
      blur: 34,
      saturation: 1.15,
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
        'ctl.blur': '柔化',
        'ctl.saturation': '色彩',
        'seg.motion.off': '关闭',
        'seg.motion.soft': '柔和',
        'seg.motion.full': '丰富',
        'ctl.motion': '动效',
        'sw.aurora': '极光背景',
        'sw.grain': '噪点质感',
        'sw.enabled': '玻璃主题',
        reset: '恢复默认设置',
        done: '已恢复默认',
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
        'ctl.blur': 'Softness',
        'ctl.saturation': 'Color',
        'seg.motion.off': 'Off',
        'seg.motion.soft': 'Soft',
        'seg.motion.full': 'Rich',
        'ctl.motion': 'Motion',
        'sw.aurora': 'Aurora glow',
        'sw.grain': 'Film grain',
        'sw.enabled': 'Glass theme',
        reset: 'Reset to defaults',
        done: 'Defaults restored',
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
    const rgbaOf = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
    const solidOf = (rgb) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;

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
     * Alpha lives in CSS (`calc(... * var(--ag-g))`), so a drag never
     * re-parses a stylesheet — it writes one custom property.
     * ------------------------------------------------------------------ */

    const NOISE =
      'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27160%27 height=%27160%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.85%27 numOctaves=%272%27 stitchTiles=%27stitch%27/%3E%3CfeColorMatrix type=%27saturate%27 values=%270%27/%3E%3C/filter%3E%3Crect width=%27160%27 height=%27160%27 filter=%27url(%23n)%27 opacity=%270.6%27/%3E%3C/svg%3E")';

    function buildSheet(pal) {
      const c1 = pal.rgb[0];
      const c2 = pal.rgb[1];
      const c3 = pal.rgb[2];
      const soft = (c) => `radial-gradient(circle at 50% 50%, ${rgbaOf(c, 0.95)} 0%, ${rgbaOf(c, 0.5)} 38%, ${rgbaOf(c, 0)} 70%)`;
      return `/* ${PKG} v${VERSION} — palette:${pal.id} */
:root{
  --ag-g:.82; --ag-blur:34; --ag-sat:1.15; --ag-grain:1;
  --ag-d1:19s; --ag-d2:24s; --ag-d3:30s;
}
html.ag-m0 #${BG_ID} i{ animation:none !important; }
html.ag-m2{ --ag-d1:10s; --ag-d2:13s; --ag-d3:16s; }

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
  contain:paint; will-change:transform;
}
#${BG_ID} i{
  position:absolute; display:block; border-radius:50%;
  filter:blur(calc(var(--ag-blur) * .75px)) saturate(var(--ag-sat));
  opacity:calc(.5 + .38 * var(--ag-g));
  will-change:transform; backface-visibility:hidden;
}
#${BG_ID} i:nth-of-type(1){
  width:62vmax; height:62vmax; left:-16vmax; top:-20vmax;
  background:${soft(c1)};
  animation:ag-f1 var(--ag-d1) ease-in-out infinite;
}
#${BG_ID} i:nth-of-type(2){
  width:56vmax; height:56vmax; right:-18vmax; top:-12vmax;
  background:${soft(c2)};
  animation:ag-f2 var(--ag-d2) ease-in-out infinite;
  animation-delay:-6s;
}
#${BG_ID} i:nth-of-type(3){
  width:66vmax; height:66vmax; left:14vmax; bottom:-30vmax;
  background:${soft(c3)};
  animation:ag-f3 var(--ag-d3) ease-in-out infinite;
  animation-delay:-13s;
}
#${BG_ID} .ag-vignette{
  position:absolute; inset:0; display:block; pointer-events:none;
  background:radial-gradient(120% 100% at 50% 0%, transparent 46%, rgb(0 0 0 / .34) 100%);
  opacity:calc(.5 + .5 * var(--ag-g));
}
#${BG_ID} .ag-scrim{
  position:absolute; inset:0; display:block; pointer-events:none;
  background:rgb(238 242 249 / calc(.08 + .10 * var(--ag-g)));
}
body[data-ds-dark-theme] #${BG_ID} .ag-scrim{
  background:rgb(5 7 13 / calc(.24 + .12 * var(--ag-g)));
}
#${BG_ID} .ag-grain{
  position:absolute; inset:0; display:block; pointer-events:none;
  background-image:${NOISE}; background-size:160px 160px;
  opacity:calc(.42 * var(--ag-grain)); mix-blend-mode:soft-light;
}
/* closed loops — a drift, not a bounce */
@keyframes ag-f1{
  0%{ transform:translate3d(0,0,0) scale(1) }
  33%{ transform:translate3d(9vmax,5vmax,0) scale(1.1) }
  66%{ transform:translate3d(2vmax,11vmax,0) scale(.94) }
  100%{ transform:translate3d(0,0,0) scale(1) }
}
@keyframes ag-f2{
  0%{ transform:translate3d(0,0,0) scale(1.06) }
  30%{ transform:translate3d(-8vmax,7vmax,0) scale(.92) }
  65%{ transform:translate3d(-13vmax,-2vmax,0) scale(1.14) }
  100%{ transform:translate3d(0,0,0) scale(1.06) }
}
@keyframes ag-f3{
  0%{ transform:translate3d(0,0,0) scale(.96) }
  35%{ transform:translate3d(7vmax,-8vmax,0) scale(1.12) }
  70%{ transform:translate3d(-5vmax,-4vmax,0) scale(1) }
  100%{ transform:translate3d(0,0,0) scale(.96) }
}

/* ---- alias tokens, light ------------------------------------------- */
body{
  --dsw-alias-bg-base: rgb(247 249 254 / calc(.93 - .30 * var(--ag-g))) !important;
  --dsw-alias-bg-layer-1: rgb(255 255 255 / calc(.66 + .24 * var(--ag-g))) !important;
  --dsw-alias-bg-layer-2: rgb(255 255 255 / calc(.78 + .18 * var(--ag-g))) !important;
  --dsw-alias-bg-layer-3: rgb(255 255 255 / calc(.88 + .10 * var(--ag-g))) !important;
  --dsw-alias-bg-overlay: rgb(250 251 254 / calc(.99 - .03 * var(--ag-g))) !important;
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
  --dsw-alias-bg-overlay: rgb(12 14 22 / calc(.985 - .02 * var(--ag-g))) !important;
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
  background:linear-gradient(180deg, rgb(8 10 18 / 0) 0px, rgb(8 10 18 / calc(.22 + .28 * var(--ag-g))) 48px) !important;
}
body:not([data-ds-dark-theme]) [class*="composerSeat"]{
  background:linear-gradient(180deg, rgb(238 242 249 / 0) 0px, rgb(238 242 249 / calc(.30 + .32 * var(--ag-g))) 48px) !important;
}
[class*="composerHero"] [class$="_card"],
[class*="composerSeat"] [class$="_card"]{
  background:rgb(255 255 255 / calc(.05 + .07 * var(--ag-g))) !important;
  backdrop-filter:blur(14px) saturate(1.5) !important;
  -webkit-backdrop-filter:blur(14px) saturate(1.5) !important;
  border:1px solid rgb(255 255 255 / calc(.10 + .08 * var(--ag-g))) !important;
  box-shadow:0 18px 48px rgb(0 0 0 / .34), inset 0 1px 0 rgb(255 255 255 / .10) !important;
  transition:box-shadow .25s ease, border-color .25s ease, background-color .25s ease;
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
  position:fixed; right:16px; bottom:80px; z-index:2147483647;
  display:flex; flex-direction:column; align-items:flex-end;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
  font-size:13px; line-height:1.45; color:#eef1f8; text-align:left;
  -webkit-font-smoothing:antialiased;
}
#${ROOT_ID} *{ box-sizing:border-box; }

#dsh-ag-btn{
  width:36px; height:36px; padding:0; margin:0; border-radius:50%;
  display:grid; place-items:center; cursor:pointer;
  border:1px solid rgba(255,255,255,.26);
  background:linear-gradient(150deg,rgba(255,255,255,.22),rgba(255,255,255,.07));
  backdrop-filter:blur(10px) saturate(1.4); -webkit-backdrop-filter:blur(10px) saturate(1.4);
  color:#e6ecff; opacity:.62;
  box-shadow:0 6px 18px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.22);
  transition:opacity .25s ease, transform .38s cubic-bezier(.34,1.56,.64,1), box-shadow .3s ease;
}
#dsh-ag-btn:hover{ opacity:1; transform:scale(1.1) rotate(28deg); box-shadow:0 10px 26px rgba(0,0,0,.44), 0 0 0 6px rgba(143,176,255,.13), inset 0 1px 0 rgba(255,255,255,.3); }
#dsh-ag-btn:active{ transform:scale(.92); transition-duration:.1s; }
#dsh-ag-btn.ag-pulse{ animation:ag-halo 4.6s ease-in-out infinite; }
#dsh-ag-btn.ag-pulse:hover{ animation:none; }
@keyframes ag-halo{
  0%,100%{ box-shadow:0 6px 18px rgba(0,0,0,.34), 0 0 0 0 rgba(143,176,255,0), inset 0 1px 0 rgba(255,255,255,.22) }
  50%{ box-shadow:0 6px 18px rgba(0,0,0,.34), 0 0 0 8px rgba(143,176,255,.12), inset 0 1px 0 rgba(255,255,255,.22) }
}

#dsh-ag-panel{
  position:absolute; right:0; bottom:48px; width:300px;
  max-height:min(640px, calc(100vh - 148px)); overflow-y:auto; overflow-x:hidden;
  padding:14px 14px 12px; border-radius:18px;
  border:1px solid rgba(255,255,255,.15);
  background:linear-gradient(180deg, rgba(16,18,28,.99), rgba(11,13,21,.985));
  backdrop-filter:blur(20px) saturate(1.4); -webkit-backdrop-filter:blur(20px) saturate(1.4);
  box-shadow:0 26px 70px rgba(2,6,20,.66), 0 2px 10px rgba(2,6,20,.4), inset 0 1px 0 rgba(255,255,255,.07);
  display:none; text-align:left; isolation:isolate;
}
#dsh-ag-panel::before{
  content:""; position:absolute; left:16px; right:16px; top:0; height:1px;
  background:linear-gradient(90deg, transparent, rgba(255,255,255,.34), transparent);
  pointer-events:none;
}
#${ROOT_ID}[data-open="1"] #dsh-ag-panel{ display:block; animation:ag-pop .3s cubic-bezier(.16,1,.3,1); }
#${ROOT_ID}[data-open="1"] #dsh-ag-panel > *{ animation:ag-rise .34s cubic-bezier(.16,1,.3,1) both; }
#${ROOT_ID}[data-open="1"] #dsh-ag-panel > *:nth-child(2){ animation-delay:.02s }
#${ROOT_ID}[data-open="1"] #dsh-ag-panel > *:nth-child(3){ animation-delay:.04s }
#${ROOT_ID}[data-open="1"] #dsh-ag-panel > *:nth-child(4){ animation-delay:.06s }
#${ROOT_ID}[data-open="1"] #dsh-ag-panel > *:nth-child(5){ animation-delay:.08s }
#${ROOT_ID}[data-open="1"] #dsh-ag-panel > *:nth-child(6){ animation-delay:.1s }
#${ROOT_ID}[data-open="1"] #dsh-ag-panel > *:nth-child(7){ animation-delay:.12s }
@keyframes ag-pop{ from{ opacity:0; transform:translateY(10px) scale(.94) } to{ opacity:1; transform:none } }
@keyframes ag-rise{ from{ opacity:0; transform:translateY(6px) } to{ opacity:1; transform:none } }
#dsh-ag-panel::-webkit-scrollbar{ width:8px; }
#dsh-ag-panel::-webkit-scrollbar-thumb{ background:rgba(148,163,184,.32); border-radius:99px; }
#dsh-ag-panel::-webkit-scrollbar-thumb:hover{ background:rgba(148,163,184,.5); }

.ag-head{ display:flex; align-items:center; justify-content:space-between; }
.ag-title{ display:flex; align-items:center; gap:8px; font-size:14.5px; font-weight:700; letter-spacing:.2px; color:#f6f8ff; }
.ag-badge{ font-size:10px; padding:2px 7px; border-radius:99px; background:rgba(255,255,255,.13); color:#c2cadd; font-weight:600; }
.ag-x{
  width:26px; height:26px; border-radius:8px; border:none; padding:0;
  background:rgba(255,255,255,.09); color:#b7c0d4; cursor:pointer;
  font-size:12px; line-height:1; transition:background .15s, color .15s, transform .15s;
}
.ag-x:hover{ background:rgba(255,255,255,.2); color:#f6f8ff; }
.ag-x:active{ transform:scale(.9); }

.ag-sec{ margin-top:12px; padding-top:12px; border-top:1px solid rgba(255,255,255,.07); }
.ag-sec:first-of-type{ border-top:none; padding-top:10px; }
.ag-label{ font-size:10.5px; color:#a3aec6; letter-spacing:.7px; margin-bottom:8px; font-weight:600; }
.ag-chips{ display:flex; flex-wrap:wrap; gap:6px; }
.ag-chip{
  font:inherit; font-size:12px; font-weight:500; padding:5.5px 12px; border-radius:99px;
  border:1px solid rgba(255,255,255,.15); background:rgba(255,255,255,.06);
  color:#d3dbeb; cursor:pointer;
  transition:color .18s, border-color .18s, background .18s, transform .12s;
}
.ag-chip:hover{ color:#fff; border-color:rgba(255,255,255,.32); background:rgba(255,255,255,.1); }
.ag-chip:active{ transform:scale(.95); }
.ag-chip.on{
  color:#fff; border-color:transparent;
  background:linear-gradient(180deg, color-mix(in srgb, var(--dsw-alias-brand-primary,#4763ff) 92%, #fff), var(--dsw-alias-brand-primary,#4763ff));
  box-shadow:0 4px 14px rgba(71,99,255,.35), inset 0 1px 0 rgba(255,255,255,.28);
}

.ag-swatches{ display:flex; gap:10px; align-items:center; }
.ag-swatch{
  width:24px; height:24px; padding:0; border-radius:50%;
  border:2px solid rgba(255,255,255,.32); cursor:pointer;
  transition:transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s, border-color .2s;
}
.ag-swatch:hover{ transform:scale(1.1); border-color:rgba(255,255,255,.6); }
.ag-swatch:active{ transform:scale(.92); }
.ag-swatch.on{ transform:scale(1.16); border-color:rgba(255,255,255,.9); box-shadow:0 0 0 2.5px rgba(255,255,255,.28), 0 4px 14px rgba(0,0,0,.35); }

.ag-ctl{ display:flex; align-items:center; gap:10px; margin-top:10px; }
.ag-ctl-label{ width:64px; flex:none; font-size:12px; color:#dfe5f2; }
.ag-range{ flex:1; min-width:0; height:4px; accent-color:var(--dsw-alias-brand-primary,#4763ff); cursor:pointer; }
.ag-range:active{ cursor:grabbing; }
.ag-val{ width:40px; flex:none; text-align:right; font-size:11px; color:#b7c0d4; font-variant-numeric:tabular-nums; }

.ag-row{ display:flex; align-items:center; justify-content:space-between; margin-top:10px; font-size:12.5px; color:#eef1f8; }
.ag-switch{
  position:relative; width:36px; height:21px; flex:none; padding:0; border:none;
  border-radius:99px; background:rgba(255,255,255,.17); cursor:pointer;
  transition:background .22s ease;
}
.ag-switch::after{
  content:""; position:absolute; top:2.5px; left:2.5px; width:16px; height:16px;
  border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.35);
  transition:transform .26s cubic-bezier(.34,1.56,.64,1), width .18s ease;
}
.ag-switch:active::after{ width:19px; }
.ag-switch.on{ background:var(--dsw-alias-brand-primary,#4763ff); }
.ag-switch.on::after{ transform:translateX(15px); }
.ag-switch.on:active::after{ transform:translateX(12px); }

.ag-seg{ display:flex; gap:2px; padding:3px; background:rgba(255,255,255,.07); border-radius:10px; }
.ag-seg-btn{
  flex:1; border:none; background:transparent; color:#b7c0d4; font:inherit; font-size:12px;
  padding:5.5px 0; border-radius:8px; cursor:pointer; transition:all .18s;
}
.ag-seg-btn:hover{ color:#f6f8ff; }
.ag-seg-btn.on{ background:rgba(255,255,255,.18); color:#f6f8ff; box-shadow:inset 0 1px 0 rgba(255,255,255,.16); }

.ag-reset{
  margin-top:14px; width:100%; font:inherit; font-size:12px; padding:8px 0;
  border-radius:10px; border:1px solid rgba(255,255,255,.15);
  background:rgba(255,255,255,.045); color:#d3dbeb; cursor:pointer;
  transition:all .16s;
}
.ag-reset:hover{ color:#fff; background:rgba(255,255,255,.1); }
.ag-reset:active{ transform:scale(.985); }

.ag-foot{ margin-top:10px; font-size:10.5px; color:#8b95ab; text-align:center; letter-spacing:.3px; }
`;

    /* ------------------------------------------------------------------ *
     * mount / paint
     * ------------------------------------------------------------------ */

    let root = null;
    let bg = null;
    let refs = {};
    let written = {};
    let rafPending = 0;

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

    function writeVars() {
      const html = document.documentElement;
      const on = !!state.enabled;
      const next = {
        '--ag-g': String(on ? clamp(state.glass, 0, 1) : 0),
        '--ag-blur': String(clamp(state.blur, 0, 60)),
        '--ag-sat': String(clamp(state.saturation, 0, 2)),
        '--ag-grain': state.grain ? '1' : '0',
      };
      Object.keys(next).forEach((key) => {
        if (written[key] !== next[key]) {
          written[key] = next[key];
          html.style.setProperty(key, next[key]);
        }
      });
      html.classList.toggle('ag-m0', !on || !state.aurora || state.motion === 'off');
      html.classList.toggle('ag-m2', on && state.aurora && state.motion === 'full');
      if (bg) bg.style.display = on && state.aurora ? '' : 'none';
    }

    function paint() {
      if (rafPending) return;
      rafPending = requestAnimationFrame(() => {
        rafPending = 0;
        writeVars();
      });
    }

    function paintNow() {
      if (rafPending) {
        cancelAnimationFrame(rafPending);
        rafPending = 0;
      }
      writeVars();
    }

    function applyPalette() {
      ensureStyle(STYLE_ID, buildSheet(paletteOf(state.palette)));
      paintNow();
    }

    function set(patch) {
      state = { ...state, ...patch };
      save();
      if (patch.palette !== undefined) applyPalette();
      else paint();
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
          style: 'background:linear-gradient(135deg,' + solidOf(p.rgb[0]) + ',' + solidOf(p.rgb[1]) + ' 55%,' + solidOf(p.rgb[2]) + ')',
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
            const out = refs['val-' + key];
            if (out) out.textContent = fmt(v);
            // glass is a token-only change (cheap); blur/sat re-filter three
            // viewport-sized layers, so they are committed on release.
            if (key === 'glass') paint();
          },
          onChange: (e) => {
            const v = Number(e.target.value);
            state = { ...state, [key]: v };
            save();
            paintNow();
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
          slider('glass', t('ctl.glass'), 0, 1, 0.02, (v) => Math.round(v * 100) + '%'),
          slider('blur', t('ctl.blur'), 0, 60, 2, (v) => Math.round(v) + 'px'),
          slider('saturation', t('ctl.saturation'), 0, 2, 0.05, (v) => Math.round(v * 100) + '%'),
        ]),
        el('div', { class: 'ag-sec' }, [
          el('div', { class: 'ag-label', text: t('sec.look') }),
          el('div', { class: 'ag-row', style: 'margin-top:0' }, [
            el('span', { text: t('ctl.motion') }),
            el('div', { class: 'ag-seg', style: 'width:156px' }, segButtons),
          ]),
          sw('aurora', t('sw.aurora')),
          sw('grain', t('sw.grain')),
          sw('enabled', t('sw.enabled')),
        ]),
        el('button', {
          class: 'ag-reset',
          type: 'button',
          onClick: (e) => {
            set({ ...DEFAULT_SETTINGS });
            const btn = e.currentTarget;
            if (btn && btn.dataset) {
              const old = btn.textContent;
              btn.textContent = t('done');
              setTimeout(() => { btn.textContent = old; }, 1200);
            }
          },
        }, t('reset')),
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

    /* ---------------------------- parallax ---------------------------- */

    let parallaxQueued = 0;
    let pointerX = 0;
    let pointerY = 0;

    function onPointerMove(e) {
      if (!bg || !state.enabled || !state.aurora || state.motion === 'off') return;
      pointerX = e.clientX / (window.innerWidth || 1) - 0.5;
      pointerY = e.clientY / (window.innerHeight || 1) - 0.5;
      if (parallaxQueued) return;
      parallaxQueued = requestAnimationFrame(() => {
        parallaxQueued = 0;
        if (!bg) return;
        bg.style.transform =
          'translate3d(' + (-pointerX * 16).toFixed(2) + 'px,' + (-pointerY * 16).toFixed(2) + 'px,0)';
      });
    }

    /* ---------------------------- mount ---------------------------- */

    function mount() {
      const stale = document.getElementById(ROOT_ID);
      if (stale) stale.remove();
      const staleBg = document.getElementById(BG_ID);
      if (staleBg) staleBg.remove();

      bg = el('div', { id: BG_ID, 'aria-hidden': 'true' }, [
        el('i'),
        el('i'),
        el('i'),
        el('span', { class: 'ag-vignette' }),
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

      written = {};
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
      written = {};
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
          document.addEventListener('pointermove', onPointerMove, { passive: true });

          const teardown = () => {
            try {
              document.removeEventListener('pointerdown', onDocDown, true);
              document.removeEventListener('keydown', onKey);
              document.removeEventListener('pointermove', onPointerMove);
              if (rafPending) cancelAnimationFrame(rafPending);
              if (parallaxQueued) cancelAnimationFrame(parallaxQueued);
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
