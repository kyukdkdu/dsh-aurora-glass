/**
 * dsh-aurora-glass — client half (Web UI).
 *
 * v1.5.0
 *
 * Performance model:
 *   • No full-screen filter on the aurora container. Each blob carries its own
 *     `filter: blur() saturate() hue-rotate()`; the blob content never changes,
 *     only its `transform` animates, so Chromium bakes the filter once and the
 *     drift runs entirely on the compositor.
 *   • Custom-property writes are coalesced into one requestAnimationFrame and
 *     only changed values are written. `--ag-g` (token alpha) is live;
 *     `--ag-blur` / `--ag-sat` commit on release, because re-filtering three
 *     viewport-sized layers per frame is what makes dragging stutter.
 *
 * Correctness details that used to break things:
 *   • `color-scheme` is declared per theme. Without it Chromium paints native
 *     <select> popups white while the option text stays dark-theme white, so
 *     the model-provider dropdown rendered as an empty white board.
 *   • Dialog surfaces get an opaque `--dsw-alias-bg-base` of their own, so the
 *     settings page does not inherit the shell's translucency.
 *
 * Nothing in this file may throw out of `apply`: a failed client entry aborts
 * the whole web boot.
 */

window.__ModuleLoader__.load({
  id: 'dsh-aurora-glass',
  factory() {
    'use strict';

    const PKG = 'dsh-aurora-glass';
    const VERSION = '1.6.0';
    const STORAGE_KEY = 'dsh-aurora-glass:settings:v2';
    const STYLE_ID = 'dsh-aurora-glass-theme';
    const UI_STYLE_ID = 'dsh-aurora-glass-ui';
    const ROOT_ID = 'dsh-ag-root';
    const BG_ID = 'dsh-ag-bg';
    const SILK_ID = 'dsh-ag-silk';

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
      { id: 'default', key: 'preset.default', set: { glass: 0.82, blur: 34, saturation: 1.15, motion: 'soft', aurora: true, grain: true, tint: true, bgmode: 'aurora' } },
      { id: 'mist', key: 'preset.mist', set: { glass: 0.92, blur: 52, saturation: 0.85, motion: 'off', aurora: true, grain: true, tint: true, bgmode: 'aurora' } },
      { id: 'depth', key: 'preset.depth', set: { glass: 0.55, blur: 22, saturation: 1.3, motion: 'full', aurora: true, grain: true, tint: true, bgmode: 'silk' } },
      { id: 'pure', key: 'preset.pure', set: { glass: 0, blur: 0, saturation: 1, motion: 'off', aurora: false, grain: false, tint: false, bgmode: 'aurora' } },
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
      tint: true,
      bgmode: 'aurora',
      posX: null,
      posY: null,
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
        'bg.label': '背景',
        'bg.aurora': '极光',
        'bg.silk': '丝绸',
        'bg.ink': '墨流',
        'bg.prism': '棱镜',
        'bg.facets': '折面',
        'bg.matrix': '数字雨',
        'bg.stroke': '笔迹',
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
        'sw.tint': '随场景变色',
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
        'bg.label': 'Backdrop',
        'bg.aurora': 'Aurora',
        'bg.silk': 'Silk',
        'bg.ink': 'Ink',
        'bg.prism': 'Prism',
        'bg.facets': 'Facets',
        'bg.matrix': 'Matrix',
        'bg.stroke': 'Stroke',
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
        'sw.tint': 'Scene tint',
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

    /* hover copy — one short sentence per control */
    const TIPS = {
      zh: {
        preset: '一键套一组参数。想快速换个感觉时用它，细调再去下面的滑杆。',
        palette: '极光的配色。深色和浅色各取一组，悬停色块可以直接预览。',
        'bg.aurora': '四团光晕在四角缓慢漂移、旋转，最轻，纯 CSS。',
        'bg.silk': '七条缎带横向流动，边缘磨砂、带一道高光，像被风吹起的绸子。',
        'bg.ink': '墨团缓慢下沉、扩散、互相晕开，深色下最沉。',
        'bg.prism': '七层玻璃搁板，彩虹光晕跟着鼠标走，高光沿板面滑过。',
        'bg.facets': '九块哑光折面，鼠标一动整组跟着倾斜，每块的视差不一样。',
        'bg.matrix': '二十二列字符往下落，鼠标靠近会把那一列推开。',
        'bg.stroke': '一根手绘的粉笔线在飘，鼠标靠近会被拉过去，点一下打个结。',
        glass: '表面有多透。100% 几乎全靠背景撑，0% 等于回到原生外观。',
        blur: '极光边缘的柔化程度，越大越朦胧。松手才生效，所以拖动不会卡。',
        saturation: '极光的鲜艳程度。往右更艳，往左偏灰。',
        motion: '背景流动的速度。关闭后完全静止，也最省电。',
        aurora: '关掉就只剩玻璃表面，没有彩色光晕。',
        grain: '叠一层很淡的颗粒，看起来更像胶片而不是纯色块。',
        tint: '跟着当前会话和时段微调色相，每个会话都有点不一样。',
        enabled: '总开关。关掉等于临时回到原生外观，设置都还在。',
        reset: '把上面所有参数恢复成默认值。',
      },
      en: {
        preset: 'Applies a whole set of values at once. Use it to change the mood quickly.',
        palette: 'The aurora colours. Dark and light each pick their own; hover a swatch to preview.',
        'bg.aurora': 'Four soft glows drifting and rotating at the corners — the lightest, pure CSS.',
        'bg.silk': 'Seven satin bands flowing sideways, soft edges with a highlight, like silk in a breeze.',
        'bg.ink': 'Ink clouds sinking, spreading and bleeding into each other. Heaviest in dark mode.',
        'bg.prism': 'Seven glass shelves; the rainbow flare follows the pointer and a specular slides along each shelf.',
        'bg.facets': 'Nine matte folded planes that tilt with the pointer, each at its own parallax depth.',
        'bg.matrix': 'Twenty-two columns of falling glyphs; the pointer pushes the nearest column aside.',
        'bg.stroke': 'One hand-drawn chalk line drifting; the pointer pulls it over, a click ties a loop.',
        glass: 'How transparent the surfaces are. 100% leans on the background, 0% is the stock look.',
        blur: 'Softness of the aurora edge. Applied on release, so dragging stays smooth.',
        saturation: 'Colour intensity. Right is richer, left is greyer.',
        motion: 'Speed of the drift. Off freezes it and saves the most power.',
        aurora: 'Turn it off and only the glass surfaces remain.',
        grain: 'A faint film grain on top, so the gradient reads as film rather than flat colour.',
        tint: 'Nudges the hue with the current session and time of day.',
        enabled: 'Master switch. Off returns to the stock look; your values are kept.',
        reset: 'Restore every value above to its default.',
      },
    };
    const tip = (key) => (TIPS[isZh ? 'zh' : 'en'][key] || '');

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
     * ------------------------------------------------------------------ */

    const NOISE =
      'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27160%27 height=%27160%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.85%27 numOctaves=%272%27 stitchTiles=%27stitch%27/%3E%3CfeColorMatrix type=%27saturate%27 values=%270%27/%3E%3C/filter%3E%3Crect width=%27160%27 height=%27160%27 filter=%27url(%23n)%27 opacity=%270.6%27/%3E%3C/svg%3E")';

    function buildSheet(pal) {
      const c1 = pal.rgb[0];
      const c2 = pal.rgb[1];
      const c3 = pal.rgb[2];
      const dim = (c, k) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;
      // Colours live in custom properties so light mode can use deeper inks on
      // its white canvas instead of the pale pastels alpha blending gives.
      const mix = (v, pct) => `color-mix(in srgb, var(${v}) ${pct}%, transparent)`;
      const soft = (a, b) =>
        `radial-gradient(circle at 44% 46%, ${mix(a, 96)} 0%, ${mix(a, 60)} 26%, ${mix(b, 26)} 50%, ${mix(b, 0)} 70%)`;

      return `/* ${PKG} v${VERSION} — palette:${pal.id} */
:root{
  --ag-g:.82; --ag-blur:34; --ag-sat:1.15; --ag-grain:1; --ag-hue:0deg;
  --ag-d1:11s; --ag-d2:14s; --ag-d3:18s;
  --ag-c1:${solidOf(c1)}; --ag-c2:${solidOf(c2)}; --ag-c3:${solidOf(c3)};
}
/* Light mode gets the same strength as dark: the ink is deepened so it reads
   on a white canvas instead of washing out to pastel. */
body:not([data-ds-dark-theme]){
  --ag-c1:${dim(c1, 0.7)}; --ag-c2:${dim(c2, 0.7)}; --ag-c3:${dim(c3, 0.7)};
}
html.ag-m0 #${BG_ID} i{ animation:none !important; }
html.ag-m2{ --ag-d1:6s; --ag-d2:8s; --ag-d3:10s; }

/* ---- canvas + native controls -------------------------------------- */
html{
  background-color:#eef2f9 !important;
  background-image:none !important;
  color-scheme:light;
}
html:has(body[data-ds-dark-theme]){
  background-color:#05070d !important;
  color-scheme:dark;
}
/* The native <select> popup is drawn by the browser, not by the page: it reads
   color-scheme from the CONTROL. Declaring it on html alone is not enough when
   the host resets form controls, so every control carries it too — otherwise
   the popup is white while the option text stays dark-theme white. */
select,input,textarea,button,option,optgroup,progress,meter{
  color-scheme:light !important;
}
html:has(body[data-ds-dark-theme]) select,
html:has(body[data-ds-dark-theme]) input,
html:has(body[data-ds-dark-theme]) textarea,
html:has(body[data-ds-dark-theme]) button,
html:has(body[data-ds-dark-theme]) option,
html:has(body[data-ds-dark-theme]) optgroup,
html:has(body[data-ds-dark-theme]) progress,
html:has(body[data-ds-dark-theme]) meter{
  color-scheme:dark !important;
}
option{
  background-color:#f7f9fe;
  color:#101828;
}
html:has(body[data-ds-dark-theme]) option{
  background-color:#14161f;
  color:#e8ecf8;
}
body{
  background:transparent !important;
  background-color:transparent !important;
}

/* ---- aurora -------------------------------------------------------- */
#${BG_ID}{
  position:fixed; inset:0; z-index:-1; pointer-events:none; overflow:hidden;
  contain:paint; will-change:transform;
  animation:ag-breathe 22s ease-in-out infinite alternate;
}
@keyframes ag-breathe{ from{ opacity:.94 } to{ opacity:1 } }
#${BG_ID} i{
  position:absolute; display:block; border-radius:50%;
  filter:blur(calc(var(--ag-blur) * .75px)) saturate(var(--ag-sat)) hue-rotate(var(--ag-hue));
  opacity:calc(.58 + .36 * var(--ag-g));
  will-change:transform; backface-visibility:hidden;
  transition:filter .45s ease;
}
#${BG_ID} i:nth-of-type(1){
  width:62vmax; height:62vmax; left:-18%; top:-22%;
  background:${soft("--ag-c1", "--ag-c2")};
  animation:ag-f1 var(--ag-d1) ease-in-out infinite;
}
#${BG_ID} i:nth-of-type(2){
  width:56vmax; height:56vmax; right:-16%; top:-18%;
  background:${soft("--ag-c2", "--ag-c3")};
  animation:ag-f2 var(--ag-d2) ease-in-out infinite;
  animation-delay:-4s;
}
#${BG_ID} i:nth-of-type(3){
  width:66vmax; height:66vmax; left:-6%; bottom:-26%;
  background:${soft("--ag-c3", "--ag-c1")};
  animation:ag-f3 var(--ag-d3) ease-in-out infinite;
  animation-delay:-9s;
}
/* the sidebar column gets its own slow glow so the workspace list is never flat */
#${BG_ID} i:nth-of-type(4){
  width:46vmax; height:86vmax; left:-22%; top:0;
  background:${soft("--ag-c2", "--ag-c1")};
  opacity:calc(.18 + .2 * var(--ag-g));
  animation:ag-f4 calc(var(--ag-d3) * 1.25) ease-in-out infinite;
  animation-delay:-7s;
}
/* No vignette and no cursor-follow glow: both read as a dark rim that appears
   out of nowhere when the pointer nears an edge, which felt detached. */
/* Centre-weighted scrim: the content area stays calm so surfaces read as glass,
   while the corners keep their colour. Kept light — the shell is translucent on
   purpose and the sidebar has to look like the same sheet of glass. */
#${BG_ID} .ag-scrim{
  position:absolute; inset:0; display:block; pointer-events:none;
  background:
    radial-gradient(64% 58% at 52% 44%, rgb(248 250 255 / calc(.2 + .12 * var(--ag-g))), rgb(248 250 255 / 0) 80%),
    rgb(248 250 255 / calc(.05 + .05 * var(--ag-g)));
  transition:opacity .6s ease;
}
body:not([data-ds-dark-theme]) #${BG_ID} i{ opacity:calc(.9 + .1 * var(--ag-g)) }
body[data-ds-dark-theme] #${BG_ID} .ag-scrim{
  background:
    radial-gradient(64% 58% at 52% 44%, rgb(4 6 12 / calc(.34 + .12 * var(--ag-g))), rgb(4 6 12 / 0) 82%),
    rgb(4 6 12 / calc(.2 + .08 * var(--ag-g)));
}
html.ag-typing #${BG_ID} .ag-scrim{ opacity:.55 }
#${BG_ID} .ag-grain{
  position:absolute; inset:0; display:block; pointer-events:none;
  background-image:${NOISE}; background-size:160px 160px;
  opacity:calc(.42 * var(--ag-grain)); mix-blend-mode:soft-light;
}

/* ---- silk backdrop -------------------------------------------------- */
#${SILK_ID}{
  position:absolute; inset:0; display:none; width:100%; height:100%;
  object-fit:cover; pointer-events:none;
  filter:saturate(var(--ag-sat)) hue-rotate(var(--ag-hue));
}
html.ag-silk #${BG_ID} i{ display:none }
html.ag-silk #${SILK_ID}{ display:block }
html.ag-silk.ag-m0 #${SILK_ID}{ opacity:.9 }

/* closed loops with rotation — the off-centre core orbits, so motion reads
   even when the blob itself barely moves */
@keyframes ag-f1{
  0%{ transform:translate3d(0,0,0) scale(1) rotate(0deg) }
  33%{ transform:translate3d(13vmax,7vmax,0) scale(1.14) rotate(120deg) }
  66%{ transform:translate3d(2vmax,15vmax,0) scale(.93) rotate(240deg) }
  100%{ transform:translate3d(0,0,0) scale(1) rotate(360deg) }
}
@keyframes ag-f2{
  0%{ transform:translate3d(0,0,0) scale(1.06) rotate(0deg) }
  30%{ transform:translate3d(-11vmax,9vmax,0) scale(.9) rotate(-110deg) }
  65%{ transform:translate3d(-16vmax,-3vmax,0) scale(1.16) rotate(-230deg) }
  100%{ transform:translate3d(0,0,0) scale(1.06) rotate(-360deg) }
}
@keyframes ag-f3{
  0%{ transform:translate3d(0,0,0) scale(.96) rotate(0deg) }
  35%{ transform:translate3d(9vmax,-10vmax,0) scale(1.14) rotate(130deg) }
  70%{ transform:translate3d(-7vmax,-5vmax,0) scale(1) rotate(250deg) }
  100%{ transform:translate3d(0,0,0) scale(.96) rotate(360deg) }
}
@keyframes ag-f4{
  0%{ transform:translate3d(0,0,0) scale(1) rotate(0deg) }
  50%{ transform:translate3d(5vmax,10vmax,0) scale(1.1) rotate(180deg) }
  100%{ transform:translate3d(0,0,0) scale(1) rotate(360deg) }
}

/* ---- alias tokens, light ------------------------------------------- */
/* bg-base is nearly nothing on purpose: the frame, the tab hosts and the
   sidebar all paint it, and stacking it twice is exactly what made the panes
   look like separate slabs. One continuous sheet instead. */
body{
  --dsw-alias-bg-base: rgb(247 249 254 / calc(.02 + .05 * var(--ag-g))) !important;
  --dsw-alias-bg-layer-1: rgb(255 255 255 / calc(.6 + .24 * var(--ag-g))) !important;
  --dsw-alias-bg-layer-2: rgb(255 255 255 / calc(.72 + .18 * var(--ag-g))) !important;
  --dsw-alias-bg-layer-3: rgb(255 255 255 / calc(.84 + .12 * var(--ag-g))) !important;
  --dsw-alias-bg-overlay: rgb(250 251 254 / calc(.99 - .02 * var(--ag-g))) !important;
  --dsw-alias-bg-module-platform: rgb(255 255 255 / calc(.58 + .28 * var(--ag-g))) !important;
  --dsw-alias-bg-multi-select: rgb(255 255 255 / calc(.62 + .24 * var(--ag-g))) !important;
  --dsw-alias-bg-mask-1: rgb(15 23 42 / .3) !important;
  --dsw-alias-bg-mask-2: rgb(15 23 42 / .18) !important;
  --dsw-alias-border-l1: rgb(15 23 42 / .15) !important;
  --dsw-alias-border-l2: rgb(15 23 42 / .12) !important;
  --dsw-alias-border-l3: rgb(15 23 42 / .17) !important;
  --dsw-alias-border-l4: rgb(15 23 42 / .21) !important;
  --dsw-specific-sidebar-fill: transparent !important;
  --dsw-alias-brand-primary: ${pal.brand.light} !important;
}

/* ---- alias tokens, dark -------------------------------------------- */
body[data-ds-dark-theme]{
  --dsw-alias-bg-base: rgb(11 13 22 / calc(.02 + .05 * var(--ag-g))) !important;
  --dsw-alias-bg-layer-1: rgb(255 255 255 / calc(.09 + .06 * var(--ag-g))) !important;
  --dsw-alias-bg-layer-2: rgb(255 255 255 / calc(.12 + .07 * var(--ag-g))) !important;
  --dsw-alias-bg-layer-3: rgb(255 255 255 / calc(.15 + .08 * var(--ag-g))) !important;
  --dsw-alias-bg-overlay: rgb(12 14 22 / calc(.995 - .01 * var(--ag-g))) !important;
  --dsw-alias-bg-module-platform: rgb(255 255 255 / calc(.08 + .05 * var(--ag-g))) !important;
  --dsw-alias-bg-multi-select: rgb(255 255 255 / calc(.11 + .05 * var(--ag-g))) !important;
  --dsw-alias-bg-mask-1: rgb(2 4 10 / .64) !important;
  --dsw-alias-bg-mask-2: rgb(2 4 10 / .42) !important;
  --dsw-alias-border-l1: rgb(255 255 255 / calc(.13 + .06 * var(--ag-g))) !important;
  --dsw-alias-border-l2: rgb(255 255 255 / calc(.1 + .04 * var(--ag-g))) !important;
  --dsw-alias-border-l3: rgb(255 255 255 / calc(.16 + .06 * var(--ag-g))) !important;
  --dsw-alias-border-l4: rgb(255 255 255 / calc(.2 + .07 * var(--ag-g))) !important;
  --dsw-specific-sidebar-fill: transparent !important;
  --dsw-alias-brand-primary: ${pal.brand.dark} !important;
}

/* ---- dialogs: opaque, so settings never floats on the aurora -------- */
[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],
[class*="dialog"],[class*="Dialog"],[class*="modal"],[class*="Modal"],
[class*="popover"],[class*="Popover"],[class*="sheet"],[class*="Sheet"]{
  --dsw-alias-bg-base: rgb(11 13 22 / .99) !important;
  --dsw-alias-bg-overlay: rgb(12 14 22 / .995) !important;
}
body:not([data-ds-dark-theme]) [role="dialog"],
body:not([data-ds-dark-theme]) [role="alertdialog"],
body:not([data-ds-dark-theme]) [role="menu"],
body:not([data-ds-dark-theme]) [role="listbox"],
body:not([data-ds-dark-theme]) [class*="dialog"],
body:not([data-ds-dark-theme]) [class*="Dialog"],
body:not([data-ds-dark-theme]) [class*="modal"],
body:not([data-ds-dark-theme]) [class*="Modal"],
body:not([data-ds-dark-theme]) [class*="popover"],
body:not([data-ds-dark-theme]) [class*="Popover"],
body:not([data-ds-dark-theme]) [class*="sheet"],
body:not([data-ds-dark-theme]) [class*="Sheet"]{
  --dsw-alias-bg-base: rgb(250 251 254 / .97) !important;
  --dsw-alias-bg-overlay: rgb(250 251 254 / .98) !important;
}

/* ---- composer: frosted glass card ----------------------------------- */
[class*="composerSeat"]{
  background:linear-gradient(180deg, rgb(8 10 18 / 0) 0px, rgb(8 10 18 / calc(.22 + .28 * var(--ag-g))) 48px) !important;
}
body:not([data-ds-dark-theme]) [class*="composerSeat"]{
  background:linear-gradient(180deg, rgb(238 242 249 / 0) 0px, rgb(238 242 249 / calc(.3 + .32 * var(--ag-g))) 48px) !important;
}
[class*="composerHero"] [class$="_card"],
[class*="composerSeat"] [class$="_card"]{
  background:rgb(255 255 255 / calc(.05 + .07 * var(--ag-g))) !important;
  backdrop-filter:blur(14px) saturate(1.5) !important;
  -webkit-backdrop-filter:blur(14px) saturate(1.5) !important;
  border:1px solid rgb(255 255 255 / calc(.1 + .08 * var(--ag-g))) !important;
  box-shadow:0 18px 48px rgb(0 0 0 / .34), inset 0 1px 0 rgb(255 255 255 / .1) !important;
  transition:box-shadow .25s ease, border-color .25s ease, background-color .25s ease;
}
[class*="composerHero"] [class$="_card"]:focus-within,
[class*="composerSeat"] [class$="_card"]:focus-within{
  border-color:rgb(255 255 255 / .26) !important;
  box-shadow:0 20px 56px rgb(0 0 0 / .42), inset 0 1px 0 rgb(255 255 255 / .16), 0 0 0 3px rgb(143 176 255 / .14) !important;
}
body:not([data-ds-dark-theme]) [class*="composerHero"] [class$="_card"],
body:not([data-ds-dark-theme]) [class*="composerSeat"] [class$="_card"]{
  background:rgb(255 255 255 / calc(.56 + .28 * var(--ag-g))) !important;
  border-color:rgb(15 23 42 / .1) !important;
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
  position:fixed; left:0; top:0; z-index:2147483647;
  display:flex; flex-direction:column; align-items:flex-end;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
  font-size:13px; line-height:1.45; color:#eef1f8; text-align:left;
  -webkit-font-smoothing:antialiased;
  touch-action:none;
}
#${ROOT_ID} *{ box-sizing:border-box; }
#${ROOT_ID}.ag-dragging #dsh-ag-btn{ cursor:grabbing; transform:scale(1.06); transition:transform .12s ease; }

#dsh-ag-btn{
  width:36px; height:36px; padding:0; margin:0; border-radius:50%;
  display:grid; place-items:center; cursor:grab;
  border:1px solid rgba(255,255,255,.26);
  background:linear-gradient(150deg,rgba(255,255,255,.22),rgba(255,255,255,.07));
  backdrop-filter:blur(10px) saturate(1.4); -webkit-backdrop-filter:blur(10px) saturate(1.4);
  color:#e6ecff; opacity:.62;
  box-shadow:0 6px 18px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.22);
  transition:opacity .25s ease, transform .38s cubic-bezier(.34,1.56,.64,1), box-shadow .3s ease;
  touch-action:none;
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
  position:absolute; right:0; top:48px; width:306px;
  max-height:min(620px, calc(100vh - 168px)); overflow-y:auto; overflow-x:hidden;
  padding:15px 15px 13px; border-radius:18px;
  border:1px solid rgba(255,255,255,.15);
  background:linear-gradient(180deg, rgba(17,19,30,.995), rgba(11,13,21,.995));
  box-shadow:0 26px 70px rgba(2,6,20,.68), 0 2px 10px rgba(2,6,20,.42), inset 0 1px 0 rgba(255,255,255,.07);
  display:none; text-align:left; isolation:isolate;
}
/* flip toward whichever side has room, so a dragged control never opens off-screen */
#${ROOT_ID}.ag-up #dsh-ag-panel{ top:auto; bottom:48px; }
#${ROOT_ID}.ag-flip #dsh-ag-panel{ right:auto; left:0; }
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
.ag-chip-sm{ padding:5px 10px; font-size:11.5px; }

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
.ag-ctl-label{ width:64px; flex:none; font-size:12px; color:#dfe5f2; cursor:help; }
.ag-range{
  -webkit-appearance:none; appearance:none; flex:1; min-width:0; height:4px; margin:0;
  border-radius:99px; background:rgba(255,255,255,.16); cursor:pointer; outline:none;
}
.ag-range::-webkit-slider-thumb{
  -webkit-appearance:none; appearance:none; width:14px; height:14px; border-radius:50%;
  background:var(--dsw-alias-brand-primary,#4763ff);
  border:2px solid rgba(255,255,255,.92);
  box-shadow:0 2px 8px rgba(0,0,0,.42);
  transition:transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s ease;
}
.ag-range:hover::-webkit-slider-thumb{
  transform:scale(1.18);
  box-shadow:0 0 0 6px rgba(143,176,255,.16), 0 2px 8px rgba(0,0,0,.42);
}
.ag-range:active::-webkit-slider-thumb{ transform:scale(1.04); }
.ag-range:focus-visible::-webkit-slider-thumb{ box-shadow:0 0 0 5px rgba(143,176,255,.3); }
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

/* hover copy — one floating element, positioned from the hovered control */
#dsh-ag-tip{
  position:fixed; z-index:2147483647; width:216px; padding:8px 10px;
  border-radius:10px; border:1px solid rgba(255,255,255,.14);
  background:rgba(8,10,17,.985); color:#dde3f0;
  font-size:11.5px; line-height:1.55; letter-spacing:.1px;
  box-shadow:0 12px 30px rgba(0,0,0,.5);
  pointer-events:none; opacity:0; transform:translateY(3px);
  transition:opacity .16s ease, transform .16s ease;
}
#dsh-ag-tip.on{ opacity:1; transform:none; }
`;

    /* ------------------------------------------------------------------ *
     * mount / paint
     * ------------------------------------------------------------------ */

    let root = null;
    let bg = null;
    let silk = null;
    let silkCtx = null;
    let silkRaf = 0;
    let silkT = 0;
    let silkLast = 0;
    let silkSpeed = 1;
    let silkBurst = 0;
    let silkRipples = [];
    const silkPointer = { x: -999, y: -999, active: false };
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

    /* ---- scene tint: session title hash + time of day ---------------- */

    let sessionHue = 0;
    let huePending = 0;

    function hueFromTitle(title) {
      let h = 0;
      for (let i = 0; i < title.length; i += 1) h = (h * 31 + title.charCodeAt(i)) % 9973;
      return (h % 9) - 4;
    }

    function updateHue() {
      if (huePending) return;
      huePending = requestAnimationFrame(() => {
        huePending = 0;
        try {
          let hue = 0;
          if (state.tint) {
            const hour = new Date().getHours();
            const timeHue = Math.sin(((hour - 6) / 24) * Math.PI * 2) * 6;
            hue = sessionHue + timeHue;
          }
          document.documentElement.style.setProperty('--ag-hue', hue.toFixed(1) + 'deg');
        } catch {
          /* no document */
        }
      });
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
      html.classList.toggle('ag-silk', on && state.aurora && state.bgmode !== 'aurora');
      if (bg) bg.style.display = on && state.aurora ? '' : 'none';
      syncSilk();
      updateHue();
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

    // Hovering a swatch repaints the palette once so you can feel it before
    // committing; leaving the swatch restores the stored one.
    function previewPalette(id) {
      try {
        ensureStyle(STYLE_ID, buildSheet(paletteOf(id || state.palette)));
      } catch {
        /* preview is cosmetic */
      }
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
      if (!open) hideTip();
    }

    /* ---------------------------- hover copy ---------------------------- */

    let tipEl = null;

    function placeTip(target) {
      if (!tipEl || !target) return;
      const text = target.getAttribute('data-tip');
      if (!text) return;
      tipEl.textContent = text;
      const r = target.getBoundingClientRect();
      const w = 216;
      let left = r.left - w - 12;
      if (left < 8) left = Math.min(r.right + 12, (window.innerWidth || 800) - w - 8);
      let top = r.top + r.height / 2 - 22;
      const maxTop = (window.innerHeight || 600) - 92;
      if (top > maxTop) top = maxTop;
      if (top < 8) top = 8;
      tipEl.style.left = Math.round(left) + 'px';
      tipEl.style.top = Math.round(top) + 'px';
      tipEl.classList.add('on');
    }

    function hideTip() {
      if (tipEl) tipEl.classList.remove('on');
    }

    function onRootOver(e) {
      try {
        const target = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
        if (!target) return;
        if (e.relatedTarget && target.contains && target.contains(e.relatedTarget)) return;
        placeTip(target);
      } catch {
        /* ignore */
      }
    }

    function onRootOut(e) {
      try {
        const target = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
        if (!target) return;
        if (e.relatedTarget && target.contains && target.contains(e.relatedTarget)) return;
        hideTip();
      } catch {
        /* ignore */
      }
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
          'data-tip': tip('preset'),
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
          'data-tip': tip('palette'),
          style: 'background:linear-gradient(135deg,' + solidOf(p.rgb[0]) + ',' + solidOf(p.rgb[1]) + ' 55%,' + solidOf(p.rgb[2]) + ')',
          onPointerenter: () => previewPalette(p.id),
          onPointerleave: () => previewPalette(null),
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
          'data-tip': tip(key),
          onInput: (e) => {
            const v = Number(e.target.value);
            state = { ...state, [key]: v };
            const out = refs['val-' + key];
            if (out) out.textContent = fmt(v);
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
          el('span', { class: 'ag-ctl-label', text: label, 'data-tip': tip(key) }),
          input,
          val,
        ]);
      };

      const segButtons = ['off', 'soft', 'full'].map((lv) =>
        el('button', {
          class: 'ag-seg-btn',
          type: 'button',
          'data-motion': lv,
          'data-tip': tip('motion'),
          onClick: () => set({ motion: lv }),
        }, t('seg.motion.' + lv)),
      );

      const bgChips = ['aurora', 'silk', 'ink', 'prism', 'facets', 'matrix', 'stroke'].map((mode) =>
        el('button', {
          class: 'ag-chip ag-chip-sm',
          type: 'button',
          'data-bgmode': mode,
          'data-tip': tip('bg.' + mode),
          onClick: () => set({ bgmode: mode }),
        }, t('bg.' + mode)),
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
        return el('div', { class: 'ag-row', 'data-tip': tip(key) }, [el('span', { text: label }), btn]);
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
          el('div', { class: 'ag-label', text: t('bg.label') }),
          el('div', { class: 'ag-chips' }, bgChips),
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
          sw('tint', t('sw.tint')),
          sw('enabled', t('sw.enabled')),
        ]),
        el('button', {
          class: 'ag-reset',
          type: 'button',
          'data-tip': tip('reset'),
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
      refs.bgChips = bgChips;
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
      (refs.bgChips || []).forEach((node) => {
        node.classList.toggle('on', node.getAttribute('data-bgmode') === state.bgmode);
      });
      ['aurora', 'grain', 'tint', 'enabled'].forEach((key) => {
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

    /* ---------------------------- pointer ---------------------------- */

    let parallaxQueued = 0;
    let pointerX = 0;
    let pointerY = 0;
    let glowX = 0;
    let glowY = 0;
    let glowVisible = false;

    function onPointerMove(e) {
      if (!state.enabled || !state.aurora) return;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      pointerX = e.clientX / w - 0.5;
      pointerY = e.clientY / h - 0.5;

      // the canvas backdrop reacts to the cursor: the sheet is pushed away
      if (silk && state.bgmode !== 'aurora') {
        const rect = silk.getBoundingClientRect ? silk.getBoundingClientRect() : null;
        if (rect && rect.width > 0 && rect.height > 0) {
          silkPointer.x = ((e.clientX - rect.left) / rect.width) * (silk.width || 384);
          silkPointer.y = ((e.clientY - rect.top) / rect.height) * (silk.height || 216);
          silkPointer.active = true;
        }
      }

      if (parallaxQueued) return;
      parallaxQueued = requestAnimationFrame(() => {
        parallaxQueued = 0;
        if (bg) {
          bg.style.transform =
            'translate3d(' + (-pointerX * 16).toFixed(2) + 'px,' + (-pointerY * 16).toFixed(2) + 'px,0)';
        }
      });
    }

    function addRipple(clientX, clientY) {
      if (!silk || state.bgmode === 'aurora') return;
      const rect = silk.getBoundingClientRect ? silk.getBoundingClientRect() : null;
      if (!rect || !rect.width) return;
      silkRipples.push({
        x: ((clientX - rect.left) / rect.width) * (silk.width || 384),
        y: ((clientY - rect.top) / rect.height) * (silk.height || 216),
        t0: (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()),
      });
      if (silkRipples.length > 3) silkRipples.shift();
    }

    function onFocusIn(e) {
      try {
        const el = e && e.target;
        const tag = el && el.tagName;
        const editing = !!el && (el.isContentEditable === true || tag === 'TEXTAREA' || tag === 'INPUT');
        document.documentElement.classList.toggle('ag-typing', editing);
      } catch {
        /* ignore */
      }
    }

    function onFocusOut() {
      try {
        document.documentElement.classList.remove('ag-typing');
      } catch {
        /* ignore */
      }
    }

    /* ---------------------------- position / drag ---------------------------- */

    const BTN = 36;
    let dragState = null;
    let suppressClick = false;

    function applyPosition() {
      if (!root) return;
      const w = window.innerWidth || 1280;
      const h = window.innerHeight || 800;
      let x;
      let y;
      if (state.posX === null || state.posX === undefined || state.posY === null || state.posY === undefined) {
        x = w - 16 - BTN;
        y = h - 80 - BTN;
      } else {
        x = clamp(state.posX, 8, w - BTN - 8);
        y = clamp(state.posY, 8, h - BTN - 8);
      }
      root.style.left = Math.round(x) + 'px';
      root.style.top = Math.round(y) + 'px';
      root.style.right = 'auto';
      root.style.bottom = 'auto';
      // open the panel toward the roomier side
      root.classList.toggle('ag-up', y > h * 0.55);
      root.classList.toggle('ag-flip', x < 330);
    }

    function onBtnDown(e) {
      if (!root || (e && e.button !== undefined && e.button !== 0)) return;
      const rect = root.getBoundingClientRect ? root.getBoundingClientRect() : null;
      dragState = {
        sx: e.clientX,
        sy: e.clientY,
        ox: rect ? rect.left : parseFloat(root.style.left) || 0,
        oy: rect ? rect.top : parseFloat(root.style.top) || 0,
        moved: false,
      };
      try {
        if (e.currentTarget && e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture is optional */
      }
      document.addEventListener('pointermove', onDragMove, true);
      document.addEventListener('pointerup', onDragEnd, true);
      document.addEventListener('pointercancel', onDragEnd, true);
      if (e.preventDefault) e.preventDefault();
    }

    function onDragMove(e) {
      if (!dragState) return;
      const dx = e.clientX - dragState.sx;
      const dy = e.clientY - dragState.sy;
      if (!dragState.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      dragState.moved = true;
      if (root) root.classList.add('ag-dragging');
      const w = window.innerWidth || 1280;
      const h = window.innerHeight || 800;
      const x = clamp(dragState.ox + dx, 8, w - BTN - 8);
      const y = clamp(dragState.oy + dy, 8, h - BTN - 8);
      if (root) {
        root.style.left = Math.round(x) + 'px';
        root.style.top = Math.round(y) + 'px';
      }
    }

    function onDragEnd() {
      document.removeEventListener('pointermove', onDragMove, true);
      document.removeEventListener('pointerup', onDragEnd, true);
      document.removeEventListener('pointercancel', onDragEnd, true);
      if (!dragState) return;
      const moved = dragState.moved;
      dragState = null;
      if (root) root.classList.remove('ag-dragging');
      suppressClick = moved;
      if (moved) {
        state = { ...state, posX: parseFloat(root.style.left) || 0, posY: parseFloat(root.style.top) || 0 };
        save();
        applyPosition();
      }
    }

    /* ------------------------- canvas backdrops ------------------------- *
     * Every reference video gets its own geometry and its own interaction:
     *   silk   — horizontal satin bands; the pointer pushes the sheet away
     *   ink    — plumes sinking and blooming; the pointer shoves the clouds
     *   prism  — glass shelves; the pointer IS the light source
     *   facets — folded matte planes; the pointer tilts the assembly
     *   matrix — falling glyph columns; the pointer parts the nearest column
     *   stroke — one chalk line; the pointer pulls it, a click ties a loop
     * ------------------------------------------------------------------- */

    function sceneDraw(now) {
      silkRaf = requestAnimationFrame(sceneDraw);
      if (!silkCtx || !silk) return;
      let hidden = false;
      try {
        hidden = document.hidden === true;
      } catch {
        hidden = false;
      }
      if (hidden) return;
      if (now - silkLast < 33) return;
      const dt = silkLast ? Math.min(80, now - silkLast) : 16;
      silkLast = now;

      let typing = false;
      try {
        typing = document.documentElement.classList.contains('ag-typing');
      } catch {
        typing = false;
      }
      const target = 1 + (typing ? 0.75 : 0) + silkBurst * 2.2;
      silkSpeed += (target - silkSpeed) * 0.06;
      silkBurst *= 0.985;
      if (silkBurst < 0.01) silkBurst = 0;
      silkT += dt * 0.00035 * silkSpeed;

      const W = silk.width || 384;
      const H = silk.height || 216;
      const ctx = silkCtx;
      let dark = false;
      try {
        dark = document.body.getAttribute('data-ds-dark-theme') !== null;
      } catch {
        dark = false;
      }

      if (silkRipples.length) silkRipples = silkRipples.filter((r) => now - r.t0 < 2200);

      const mode = state.bgmode;
      if (mode === 'ink') drawPlumes(ctx, W, H, dark);
      else if (mode === 'prism') drawPrism(ctx, W, H, dark);
      else if (mode === 'facets') drawFacets(ctx, W, H, dark);
      else if (mode === 'matrix') drawMatrix(ctx, W, H, dark);
      else if (mode === 'stroke') drawStroke(ctx, W, H, dark);
      else drawWaves(ctx, W, H, dark);

      drawRippleRings(ctx, dark, now);
      ctx.filter = 'none';
    }

    function drawRippleRings(ctx, dark, now) {
      for (let k = 0; k < silkRipples.length; k += 1) {
        const r = silkRipples[k];
        const age = (now - r.t0) / 1000;
        const rad = age * 240;
        const fade = Math.max(0, 1 - age / 2.2);
        if (fade <= 0) continue;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, rad, rad * 0.45, 0, 0, Math.PI * 2);
        ctx.strokeStyle = dark ? 'rgba(255,255,255,' + 0.28 * fade + ')' : 'rgba(255,255,255,' + 0.7 * fade + ')';
        ctx.lineWidth = 2.4 * fade + 0.4;
        ctx.stroke();
      }
    }

    /* ---- ink: plumes made of soft blobs ------------------------------- */

    const PLUMES = (() => {
      const list = [];
      let seed = 20261025;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      for (let i = 0; i < 16; i += 1) {
        list.push({
          x: rnd(),
          y: rnd(),
          r: 0.1 + rnd() * 0.22,
          vx: (rnd() - 0.5) * 0.05,
          vy: (rnd() - 0.5) * 0.05,
          ph: rnd() * 6.28,
          tone: i % 3,
          wob: 0.4 + rnd() * 0.8,
        });
      }
      return list;
    })();

    function drawPlumes(ctx, W, H, dark) {
      ctx.fillStyle = dark ? '#04060c' : '#eef2f9';
      ctx.fillRect(0, 0, W, H);
      ctx.filter = 'blur(3.2px)';

      const cols = paletteOf(state.palette).rgb;
      const t = silkT * 26;
      const px = silkPointer.active ? silkPointer.x : -9999;
      const py = silkPointer.active ? silkPointer.y : -9999;

      for (let i = 0; i < PLUMES.length; i += 1) {
        const p = PLUMES[i];
        // slow swirl + a downward drift: ink sinks
        let x = (p.x + Math.sin(t * 0.11 * p.wob + p.ph) * 0.16 + p.vx * t * 0.4) % 1.2;
        let y = (p.y + Math.cos(t * 0.09 * p.wob + p.ph * 1.7) * 0.14 + p.vy * t * 0.35) % 1.2;
        if (x < 0) x += 1.2;
        if (y < 0) y += 1.2;

        let cx = x * W;
        let cy = y * H;
        const rad = p.r * (0.7 + 0.3 * Math.sin(t * 0.13 + p.ph)) * H * 0.72;
        const c = cols[p.tone];

        // pointer pushes the cloud aside
        if (px > -999) {
          const dx = cx - px;
          const dy = cy - py;
          const d2 = dx * dx + dy * dy;
          if (d2 < 9000) {
            const push = (1 - d2 / 9000) * 26;
            const d = Math.sqrt(d2) || 1;
            cx += (dx / d) * push;
            cy += (dy / d) * push;
          }
        }

        // a plume is three lobes strung along its drift direction, so it reads
        // as ink with tendrils rather than one round blob
        const ang = p.ph + t * 0.05 * p.wob;
        const dirX = Math.cos(ang) * -0.5;
        const dirY = Math.sin(ang);
        for (let k = 0; k < 3; k += 1) {
          const spread = rad * (0.15 + k * 0.55);
          const bx = cx + dirX * spread;
          const by = cy + dirY * spread;
          const br = rad * (1 - k * 0.26);
          if (br <= 0.5) continue;
          const alpha = (dark ? 0.62 : 0.52) * (1 - k * 0.24);
          const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
          g.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')');
          g.addColorStop(0.5, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha * 0.42 + ')');
          g.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    /* ---- prism: stacked glass shelves with rainbow flare -------------- */

    function drawPrism(ctx, W, H, dark) {
      ctx.fillStyle = dark ? '#080a11' : '#eef1f7';
      ctx.fillRect(0, 0, W, H);

      // the light source follows the pointer; everything else reacts to it
      const lx = silkPointer.active ? silkPointer.x / W : 0.72;
      const ly = silkPointer.active ? silkPointer.y / H : 0.18;
      const cols = paletteOf(state.palette).rgb;
      const t = silkT * 9;

      // rainbow flare behind the shelves
      ctx.filter = 'blur(14px)';
      for (let i = 0; i < 3; i += 1) {
        const c = cols[i];
        const fx = W * (0.18 + lx * 0.64 + Math.sin(t * 0.4 + i) * 0.06);
        const fy = H * (0.05 + ly * 0.5 + Math.cos(t * 0.33 + i * 2) * 0.06);
        const r = W * (0.24 + i * 0.05);
        const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
        g.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (dark ? 0.34 : 0.26) + ')');
        g.addColorStop(0.55, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (dark ? 0.12 : 0.1) + ')');
        g.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // rainbow fringe: what makes a prism read as a prism
      ctx.filter = 'blur(9px)';
      const hue = [[255, 96, 96], [255, 176, 88], [120, 230, 140], [96, 176, 255], [190, 120, 255]];
      for (let i = 0; i < hue.length; i += 1) {
        const h = hue[i];
        const y = H * (0.1 + i * 0.045) + Math.sin(t * 0.5 + i * 0.7) * 4;
        const g = ctx.createLinearGradient(W * 0.05, y, W * 0.95, y + 26);
        g.addColorStop(0, 'rgba(' + h[0] + ',' + h[1] + ',' + h[2] + ',0)');
        g.addColorStop(0.45, 'rgba(' + h[0] + ',' + h[1] + ',' + h[2] + ',' + (dark ? 0.16 : 0.22) + ')');
        g.addColorStop(1, 'rgba(' + h[0] + ',' + h[1] + ',' + h[2] + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, y, W, 26);
      }

      // glass shelves: a body, a bright top edge, a soft shadow underneath
      ctx.filter = 'blur(0.6px)';
      const shelves = 7;
      for (let i = 0; i < shelves; i += 1) {
        const y = H * (0.12 + i * 0.12) + Math.sin(t * 0.5 + i * 0.8) * 2.2;
        const h = H * 0.075;
        const inset = W * (0.02 + ((i * 37) % 11) / 120);
        const skew = (lx - 0.5) * 10;

        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.95)');
        g.addColorStop(0.35, dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.55)');
        g.addColorStop(1, dark ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.12)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(inset + skew, y);
        ctx.lineTo(W - inset + skew, y + 1.5);
        ctx.lineTo(W - inset + skew, y + h);
        ctx.lineTo(inset + skew, y + h);
        ctx.closePath();
        ctx.fill();

        // top edge catches the light
        ctx.beginPath();
        ctx.moveTo(inset + skew, y);
        ctx.lineTo(W - inset + skew, y + 1.5);
        ctx.strokeStyle = dark ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.98)';
        ctx.lineWidth = 1.1;
        ctx.stroke();

        // a specular streak sliding along the shelf
        const sx = ((t * 26 + i * 90) % (W + 160)) - 80;
        const sg = ctx.createLinearGradient(sx - 70, 0, sx + 70, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5, dark ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.95)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(sx - 70, y + 1, 140, 1.6);
      }

      // vertical glass dividers
      ctx.filter = 'blur(0.5px)';
      for (let i = 0; i < 3; i += 1) {
        const x = W * (0.22 + i * 0.28) + (lx - 0.5) * 14;
        const g = ctx.createLinearGradient(x - 1.5, 0, x + 1.5, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, dark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.9)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 1.5, 0, 3, H);
      }
    }

    /* ---- facets: folded matte planes ---------------------------------- */

    const FACETS = (() => {
      const list = [];
      let seed = 77003;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      // a fan of angular planes radiating from an off-centre point
      const cx = 0.62;
      const cy = 0.34;
      const n = 9;
      for (let i = 0; i < n; i += 1) {
        const a0 = (i / n) * Math.PI * 2 + rnd() * 0.12;
        const a1 = ((i + 1) / n) * Math.PI * 2 - rnd() * 0.1;
        const r = 1.35;
        list.push({
          p: [
            [cx, cy],
            [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r],
            [cx + Math.cos((a0 + a1) / 2) * r * 1.08, cy + Math.sin((a0 + a1) / 2) * r * 1.08],
            [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r],
          ],
          tone: i % 3,
          shade: 0.35 + rnd() * 0.5,
          depth: 0.4 + rnd() * 0.9,
          ph: rnd() * 6.28,
        });
      }
      return list;
    })();

    function drawFacets(ctx, W, H, dark) {
      ctx.fillStyle = dark ? '#0a0b10' : '#e9ecf2';
      ctx.fillRect(0, 0, W, H);

      const cols = paletteOf(state.palette).rgb;
      const t = silkT * 12;
      const px = silkPointer.active ? silkPointer.x / W - 0.5 : 0;
      const py = silkPointer.active ? silkPointer.y / H - 0.5 : 0;

      for (let i = 0; i < FACETS.length; i += 1) {
        const f = FACETS[i];
        const c = cols[f.tone];
        // each plane parallaxes by its own depth, so the whole assembly tilts
        const ox = px * 22 * f.depth + Math.sin(t * 0.3 + f.ph) * 2;
        const oy = py * 16 * f.depth + Math.cos(t * 0.26 + f.ph) * 2;

        ctx.beginPath();
        for (let k = 0; k < f.p.length; k += 1) {
          const x = f.p[k][0] * W + ox;
          const y = f.p[k][1] * H + oy;
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        // matte shading: lit from the pointer direction
        const g = ctx.createLinearGradient(ox, oy, ox + W * 0.8, oy + H * 0.8);
        const lit = 0.5 + (px + py) * 0.5;
        g.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (dark ? 0.34 + f.shade * 0.3 : 0.3 + f.shade * 0.34) + ')');
        g.addColorStop(0.6, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (dark ? 0.1 : 0.12) + ')');
        g.addColorStop(1, dark ? 'rgba(4,5,9,0.55)' : 'rgba(255,255,255,0.45)');
        ctx.fillStyle = g;
        ctx.fill();

        // crisp fold edge
        ctx.strokeStyle = dark
          ? 'rgba(255,255,255,' + (0.05 + lit * 0.1) + ')'
          : 'rgba(255,255,255,' + (0.5 + lit * 0.35) + ')';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    /* ---- matrix: falling glyph columns -------------------------------- */

    const GLYPHS = '01ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ0123456789';
    const COLUMNS = (() => {
      const list = [];
      let seed = 4211;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      for (let i = 0; i < 22; i += 1) {
        list.push({ x: (i + 0.5) / 22, y: rnd(), speed: 0.4 + rnd() * 0.9, len: 6 + Math.floor(rnd() * 7) });
      }
      return list;
    })();

    function drawMatrix(ctx, W, H, dark) {
      ctx.fillStyle = dark ? '#05070a' : '#f2f5fa';
      ctx.fillRect(0, 0, W, H);
      ctx.filter = 'blur(0.4px)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';

      const c = paletteOf(state.palette).rgb[0];
      const t = silkT;
      const px = silkPointer.active ? silkPointer.x / W : -9;

      for (let i = 0; i < COLUMNS.length; i += 1) {
        const col = COLUMNS[i];
        let x = col.x * W;
        // the pointer pushes the nearest column aside
        const d = Math.abs(col.x - px);
        if (d < 0.06) x += (col.x > px ? 1 : -1) * (1 - d / 0.06) * 8;

        const head = ((col.y + t * col.speed * 0.35) % 1.25) * H;
        for (let k = 0; k < col.len; k += 1) {
          const y = head - k * 10;
          if (y < -10 || y > H + 10) continue;
          const fade = 1 - k / col.len;
          if (k === 0) ctx.fillStyle = dark ? 'rgba(255,255,255,0.92)' : 'rgba(20,28,48,0.9)';
          else ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (dark ? 0.72 * fade : 0.6 * fade) + ')';
          const g = GLYPHS[(i * 7 + k * 3 + Math.floor(t * 2 + i)) % GLYPHS.length];
          ctx.fillText(g, x, y);
        }
      }
    }

    /* ---- stroke: one hand-drawn line that follows the pointer ---------- */

    function drawStroke(ctx, W, H, dark) {
      ctx.fillStyle = dark ? '#05060a' : '#f4f6fa';
      ctx.fillRect(0, 0, W, H);
      ctx.filter = 'blur(0.5px)';

      const c = paletteOf(state.palette).rgb[0];
      const t = silkT;
      const px = silkPointer.active ? silkPointer.x : W * 0.5;
      const py = silkPointer.active ? silkPointer.y : H * 0.5;

      const pts = [];
      for (let x = -10; x <= W + 10; x += 5) {
        let y = H * 0.5 +
          Math.sin(x * 0.011 + t * 1.1) * H * 0.16 +
          Math.sin(x * 0.027 - t * 0.8) * H * 0.07;
        // the line is pulled toward the cursor
        const dx = x - px;
        const dy = y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < 12000) y -= (1 - d2 / 12000) * (py - y) * 0.55;
        // clicks leave a loop that unwinds
        for (let k = 0; k < silkRipples.length; k += 1) {
          const r = silkRipples[k];
          const age = (now0() - r.t0) / 1000;
          const band = Math.exp(-Math.pow((x - r.x - Math.sin(age * 3) * 20) / 42, 2));
          if (band > 0.01) y += band * Math.sin(age * 5) * 30 * Math.max(0, 1 - age / 2.2);
        }
        pts.push([x, y]);
      }

      // soft glow under the stroke
      ctx.beginPath();
      for (let k = 0; k < pts.length; k += 1) {
        if (k === 0) ctx.moveTo(pts[k][0], pts[k][1]);
        else ctx.lineTo(pts[k][0], pts[k][1]);
      }
      ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (dark ? 0.18 : 0.16) + ')';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.stroke();

      // the chalk line itself
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.95)' : 'rgba(24,32,52,0.92)';
      ctx.lineWidth = 3.2;
      ctx.stroke();

      // a second, thinner pass with a tiny offset reads as hand-drawn
      ctx.beginPath();
      for (let k = 0; k < pts.length; k += 1) {
        const wob = Math.sin(k * 0.9 + t * 6) * 1.2;
        if (k === 0) ctx.moveTo(pts[k][0], pts[k][1] + wob);
        else ctx.lineTo(pts[k][0], pts[k][1] + wob);
      }
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.42)' : 'rgba(24,32,52,0.34)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    /* ---- silk: horizontal satin bands --------------------------------- */

    function drawWaves(ctx, W, H, dark) {
      ctx.fillStyle = dark ? '#070a12' : '#eef2f9';
      ctx.fillRect(0, 0, W, H);

      ctx.filter = 'blur(1.6px)';
      const cols = paletteOf(state.palette).rgb;
      const px = silkPointer.x;
      const py = silkPointer.y;

      for (let i = 0; i < 7; i += 1) {
        const a = cols[i % 3];
        const b = cols[(i + 1) % 3];
        const amp = 8 + i * 3.4;
        const baseY = H * (0.06 + i * 0.13);
        const thick = H * (0.15 + 0.02 * i);
        const ph = i * 1.7;
        const sp = 1 + i * 0.12;

        const wave = (x, off) => {
          let y = baseY + off +
            Math.sin(x * 0.012 + silkT * sp + ph) * amp +
            Math.sin(x * 0.03 - silkT * 1.7 + ph * 1.4) * amp * 0.42;
          if (silkPointer.active) {
            const dx = x - px;
            y += Math.exp(-(dx * dx) / 2400) * (py - y) * 0.16;
          }
          for (let k = 0; k < silkRipples.length; k += 1) {
            const r = silkRipples[k];
            const age = (now0() - r.t0) / 1000;
            const front = age * 240;
            const d = Math.abs(x - r.x);
            const band = Math.exp(-Math.pow((d - front) / 80, 2));
            if (band > 0.01) y += band * 22 * Math.max(0, 1 - age / 2.2) * (i % 2 ? 1 : -1);
          }
          return y;
        };

        ctx.beginPath();
        for (let x = 0; x <= W; x += 6) {
          const y = wave(x, 0);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let x = W; x >= 0; x -= 6) ctx.lineTo(x, wave(x, thick));
        ctx.closePath();
        const g = ctx.createLinearGradient(0, baseY - amp, 0, baseY + thick + amp);
        const A = (al) => 'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',' + al + ')';
        const B = (al) => 'rgba(' + b[0] + ',' + b[1] + ',' + b[2] + ',' + al + ')';
        g.addColorStop(0, A(dark ? 0.08 : 0.06));
        g.addColorStop(0.16, A(dark ? 0.62 : 0.52));
        g.addColorStop(0.3, dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.72)');
        g.addColorStop(0.52, B(dark ? 0.46 : 0.38));
        g.addColorStop(0.82, B(dark ? 0.14 : 0.1));
        g.addColorStop(1, A(0.04));
        ctx.fillStyle = g;
        ctx.fill();

        ctx.beginPath();
        for (let x = 0; x <= W; x += 6) {
          const y = wave(x, 0);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }

    function now0() {
      return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    }


    function syncSilk() {
      const canvasMode = state.bgmode !== 'aurora';
      const on = !!state.enabled && !!state.aurora && canvasMode && silkCtx;
      if (on) {
        if (!silkRaf && typeof requestAnimationFrame === 'function') {
          silkLast = 0;
          silkRaf = requestAnimationFrame(sceneDraw);
        }
      } else if (silkRaf) {
        try {
          cancelAnimationFrame(silkRaf);
        } catch {
          /* ignore */
        }
        silkRaf = 0;
      }
    }

    /* ---------------------------- mount ---------------------------- */

    function mount() {
      const stale = document.getElementById(ROOT_ID);
      if (stale) stale.remove();
      const staleBg = document.getElementById(BG_ID);
      if (staleBg) staleBg.remove();

      silk = el('canvas', { id: SILK_ID, 'aria-hidden': 'true', width: '384', height: '216' });
      try {
        silkCtx = typeof silk.getContext === 'function' ? silk.getContext('2d') : null;
      } catch {
        silkCtx = null;
      }

      bg = el('div', { id: BG_ID, 'aria-hidden': 'true' }, [
        silk,
        el('i'),
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
          if (suppressClick) {
            suppressClick = false;
            return;
          }
          setOpen(root.getAttribute('data-open') !== '1');
        },
        onPointerdown: onBtnDown,
      }, sparkle(17));

      root = el('div', { id: ROOT_ID, 'data-open': '0' }, [buildPanel(), btn]);
      document.body.appendChild(root);
      try {
        root.addEventListener('pointerover', onRootOver);
        root.addEventListener('pointerout', onRootOut);
      } catch {
        /* hover copy is optional */
      }

      tipEl = el('div', { id: 'dsh-ag-tip', 'aria-hidden': 'true' });
      document.body.appendChild(tipEl);

      written = {};
      sessionHue = hueFromTitle(String(document.title || ''));
      applyPosition();
      applyPalette();
      syncUI();
    }

    function unmount() {
      [ROOT_ID, BG_ID, 'dsh-ag-tip', STYLE_ID, UI_STYLE_ID].forEach((id) => {
        const node = document.getElementById(id);
        if (node && node.parentNode) node.parentNode.removeChild(node);
      });
      if (silkRaf) {
        try {
          cancelAnimationFrame(silkRaf);
        } catch {
          /* ignore */
        }
        silkRaf = 0;
      }
      root = null;
      bg = null;
      silk = null;
      silkCtx = null;
      silkRipples = [];
      silkBurst = 0;
      silkSpeed = 1;
      silkPointer.active = false;
      tipEl = null;
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
            if (!root) return;
            if (root.contains(e.target)) {
              if (root.getAttribute('data-open') !== '1') return;
              return;
            }
            setOpen(false);
            addRipple(e.clientX, e.clientY);
          };
          const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
          };
          document.addEventListener('pointerdown', onDocDown, true);
          document.addEventListener('keydown', onKey);
          document.addEventListener('pointermove', onPointerMove, { passive: true });
          document.addEventListener('focusin', onFocusIn, true);
          document.addEventListener('focusout', onFocusOut, true);
          const onResize = () => applyPosition();
          window.addEventListener('resize', onResize);

          // per-session tint: the shell writes the session title into <title>
          let titleObserver = null;
          try {
            const titleNode = document.querySelector('title');
            if (titleNode && typeof MutationObserver === 'function') {
              titleObserver = new MutationObserver(() => {
                const next = hueFromTitle(String(document.title || ''));
                if (next !== sessionHue) {
                  sessionHue = next;
                  // a session switch makes the whole sheet surge once
                  silkBurst = 1;
                }
                updateHue();
              });
              titleObserver.observe(titleNode, { childList: true, characterData: true, subtree: true });
            }
          } catch {
            /* title observation is optional */
          }

          const teardown = () => {
            try {
              document.removeEventListener('pointerdown', onDocDown, true);
              document.removeEventListener('keydown', onKey);
              document.removeEventListener('pointermove', onPointerMove);
              document.removeEventListener('focusin', onFocusIn, true);
              document.removeEventListener('focusout', onFocusOut, true);
              document.removeEventListener('pointermove', onDragMove, true);
              document.removeEventListener('pointerup', onDragEnd, true);
              document.removeEventListener('pointercancel', onDragEnd, true);
              window.removeEventListener('resize', onResize);
              document.documentElement.classList.remove('ag-typing');
              document.documentElement.classList.remove('ag-silk');
              if (titleObserver) titleObserver.disconnect();
              if (rafPending) cancelAnimationFrame(rafPending);
              if (parallaxQueued) cancelAnimationFrame(parallaxQueued);
              if (huePending) cancelAnimationFrame(huePending);
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
