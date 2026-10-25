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

    // Eight three-colour cards, taken from the reference palette video.
    const PALETTES = [
      { id: 'inkpurple', label: '墨紫', brand: { light: '#4c2a73', dark: '#adcf37' }, rgb: [[20, 20, 20], [76, 42, 115], [173, 207, 55]] },
      { id: 'graphite', label: '石墨青', brand: { light: '#0f8f8d', dark: '#26cdcb' }, rgb: [[31, 35, 38], [27, 42, 82], [38, 205, 203]] },
      { id: 'silverred', label: '银红', brand: { light: '#c51e2a', dark: '#ff8a92' }, rgb: [[181, 184, 187], [24, 22, 23], [197, 30, 42]] },
      { id: 'forest', label: '森林金', brand: { light: '#8a6820', dark: '#b18739' }, rgb: [[10, 26, 18], [46, 107, 71], [177, 135, 57]] },
      { id: 'navy', label: '海军橙', brand: { light: '#e85327', dark: '#ff8a5c' }, rgb: [[231, 225, 211], [18, 35, 58], [232, 83, 39]] },
      { id: 'paper', label: '纸本钴', brand: { light: '#1c4a9c', dark: '#6b9ae8' }, rgb: [[239, 232, 214], [28, 74, 156], [218, 46, 43]] },
    ];

    const PRESETS = [
      { id: 'default', key: 'preset.default', set: { glass: 0.82, blur: 34, saturation: 1.15, motion: 'soft', aurora: true, grain: true, tint: true } },
      { id: 'clear', key: 'preset.clear', set: { glass: 1, blur: 46, saturation: 1.05, motion: 'soft', aurora: true, grain: false, tint: true } },
      { id: 'rich', key: 'preset.rich', set: { glass: 0.62, blur: 24, saturation: 1.3, motion: 'full', aurora: true, grain: true, tint: true } },
      { id: 'stock', key: 'preset.stock', set: { glass: 0, blur: 0, saturation: 1, motion: 'off', aurora: false, grain: false, tint: false } },
    ];

    const DEFAULT_SETTINGS = {
      enabled: true,
      preset: 'default',
      palette: 'inkpurple',
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
        'sec.surface': '质感',
        'sec.look': '动效',
        'bg.label': '背景',
        'bg.aurora': '极光',
        'bg.silk': '丝绸',
        'bg.ink': '墨流',
        'bg.petal': '花瓣',
        'bg.bands': '色带',
        'bg.concept': '概念艺术',
        'bg.dream': '梦核',
        'preset.default': '标准',
        'preset.clear': '通透',
        'preset.rich': '浓郁',
        'preset.stock': '原版',
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
        'sec.surface': 'Texture',
        'sec.look': 'Motion',
        'bg.label': 'Backdrop',
        'bg.aurora': 'Aurora',
        'bg.silk': 'Silk',
        'bg.ink': 'Ink',
        'bg.petal': 'Petal',
        'bg.bands': 'Bands',
        'bg.concept': 'Concept',
        'bg.dream': 'Dream',
        'preset.default': 'Standard',
        'preset.clear': 'Clear',
        'preset.rich': 'Rich',
        'preset.stock': 'Stock',
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
        'bg.silk': '七条缎带横向流动，边缘磨砂、带一道高光，像被风吹起的绸子。鼠标推开它，点一下荡开涟漪。',
        'bg.ink': '墨团缓慢下沉、扩散、互相晕开，鼠标经过会把墨挤开，点一下荡开涟漪。',
        'bg.petal': '三层半透明褶皱花瓣缓慢绽放，鼠标就是花心，花瓣会朝你倾一点。',
        'bg.bands': '像素化的横向色带缓慢起伏，鼠标像一枚透镜把色带顶起来。',
        'bg.concept': '三层山脊 + 雾气 + 一束天光，鼠标就是光源，光束和雾会跟着走。',
        'bg.dream': '粉紫渐变、发光球体、悬浮的空画框，光球会慢慢向你靠拢。',
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
        'bg.silk': 'Seven satin bands flowing sideways; the pointer pushes the sheet, a click ripples it.',
        'bg.ink': 'Ink clouds sinking and bleeding into each other; the pointer shoves them, a click ripples.',
        'bg.petal': 'Three layers of translucent ruffled petals opening slowly; the pointer is the flower centre and the petals lean toward it.',
        'bg.bands': 'Pixel-quantised horizontal colour bands; the pointer acts as a lens that lifts them.',
        'bg.concept': 'Concept art: three ridges, drifting fog and a shaft of light; the pointer is the light source.',
        'bg.dream': 'Dreamcore: pastel gradient, glowing orbs and empty floating frames; orbs drift toward the pointer.',
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
        `radial-gradient(circle at 44% 46%, ${mix(a, 80)} 0%, ${mix(a, 50)} 26%, ${mix(b, 20)} 52%, ${mix(b, 0)} 74%)`;

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
  contain:paint;
  animation:ag-breathe 22s ease-in-out infinite alternate;
}
@keyframes ag-breathe{ from{ opacity:.94 } to{ opacity:1 } }
#${BG_ID} i{
  position:absolute; display:block; border-radius:50%;
  filter:blur(calc(var(--ag-blur) * 1.8px)) saturate(var(--ag-sat)) hue-rotate(var(--ag-hue));
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
  image-rendering:auto;
  transform:translateZ(0);
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
  --dsw-alias-bg-mask-1: rgb(15 23 42 / .18) !important;
  --dsw-alias-bg-mask-2: rgb(15 23 42 / .12) !important;
  --dsw-alias-border-l1: rgb(15 23 42 / .15) !important;
  --dsw-alias-border-l2: rgb(15 23 42 / .12) !important;
  --dsw-alias-border-l3: rgb(15 23 42 / .17) !important;
  --dsw-alias-border-l4: rgb(15 23 42 / .21) !important;
  --dsw-specific-sidebar-fill: rgb(247 249 254 / calc(.02 + .05 * var(--ag-g))) !important;
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
  --dsw-alias-bg-mask-1: rgb(2 4 10 / .34) !important;
  --dsw-alias-bg-mask-2: rgb(2 4 10 / .22) !important;
  --dsw-alias-border-l1: rgb(255 255 255 / calc(.13 + .06 * var(--ag-g))) !important;
  --dsw-alias-border-l2: rgb(255 255 255 / calc(.1 + .04 * var(--ag-g))) !important;
  --dsw-alias-border-l3: rgb(255 255 255 / calc(.16 + .06 * var(--ag-g))) !important;
  --dsw-alias-border-l4: rgb(255 255 255 / calc(.2 + .07 * var(--ag-g))) !important;
  --dsw-specific-sidebar-fill: rgb(11 13 22 / calc(.02 + .05 * var(--ag-g))) !important;
  --dsw-alias-brand-primary: ${pal.brand.dark} !important;
}

/* ---- dialogs: opaque, so settings never floats on the aurora -------- *
 * Kept deliberately narrow. A loose class-substring match on modal/sheet
 * used to hand an opaque plate to ordinary layout containers, which showed
 * up as a hard-edged dark block inside a pane. Only real overlays here. */
[role="dialog"],[role="alertdialog"],
[class*="popover"],[class*="Popover"]{
  --dsw-alias-bg-base: rgb(11 13 22 / .99) !important;
  --dsw-alias-bg-overlay: rgb(12 14 22 / .995) !important;
}
body:not([data-ds-dark-theme]) [role="dialog"],
body:not([data-ds-dark-theme]) [role="alertdialog"],
body:not([data-ds-dark-theme]) [class*="popover"],
body:not([data-ds-dark-theme]) [class*="Popover"]{
  --dsw-alias-bg-base: rgb(250 251 254 / .97) !important;
  --dsw-alias-bg-overlay: rgb(250 251 254 / .98) !important;
}

/* ---- composer: frosted glass card ----------------------------------- */
/* No background on the seat itself: it used to paint a dark gradient band
   that ended in a hard edge and read as a separate block at the bottom of
   the window. The card below carries the glass, the seat stays transparent. */
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

/* ---- global hover feedback ------------------------------------------ *
 * One rule for every control in the app, not just this plugin's panel, so
 * nothing feels dead under the cursor. brightness() only runs on a state
 * change, never per frame. !important because the host ships its own
 * hover rules that would otherwise win. */
button,[role="button"],[role="menuitem"],[role="tab"],[role="option"],
[role="switch"],[role="checkbox"],[role="radio"],summary,a{
  transition:filter .16s ease !important;
}
button:hover,[role="button"]:hover,[role="menuitem"]:hover,
[role="tab"]:hover,[role="option"]:hover,[role="switch"]:hover,
[role="checkbox"]:hover,[role="radio"]:hover,summary:hover,a:hover{
  filter:brightness(1.18) saturate(1.08) !important;
}
button:active,[role="button"]:active,[role="menuitem"]:active,
[role="tab"]:active,[role="option"]:active,[role="switch"]:active,
[role="checkbox"]:active,[role="radio"]:active,summary:active,a:active{
  filter:brightness(.92) !important;
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
          else if (key === 'ref' && typeof value === 'function') value(node);
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
.ag-head-right{ display:flex; align-items:center; gap:8px; }
.ag-switch-sm{ transform:scale(.85); transform-origin:center; margin-right:-2px; }
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
        el('div', { class: 'ag-head-right' }, [
          el('button', {
            class: 'ag-switch ag-switch-sm',
            type: 'button',
            role: 'switch',
            'data-switch': 'enabled',
            'data-tip': tip('enabled'),
            ref: (node) => { refs['sw-enabled'] = node; },
            onClick: () => set({ enabled: !state.enabled }),
          }),
          el('button', { class: 'ag-x', type: 'button', 'aria-label': t('close'), onClick: () => setOpen(false) }, '\u2715'),
        ]),
      ]);

      const presetChips = PRESETS.map((p) =>
        el('button', {
          class: 'ag-seg-btn',
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

      const bgChips = ['aurora', 'silk', 'ink', 'petal', 'bands', 'concept', 'dream'].map((mode) =>
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
          el('div', { class: 'ag-seg' }, presetChips),
        ]),
        el('div', { class: 'ag-sec' }, [
          el('div', { class: 'ag-label', text: t('sec.palette') }),
          el('div', { class: 'ag-swatches' }, swatches),
          el('div', { class: 'ag-label', style: 'margin-top:11px', text: t('bg.label') }),
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
      const cx = ((clientX - rect.left) / rect.width) * (silk.width || 384);
      const cy = ((clientY - rect.top) / rect.height) * (silk.height || 216);

      // each backdrop answers a click in its own way
      if (state.bgmode === 'bloom') bloomBurst = 1;
      silkRipples.push({ x: cx, y: cy, t0: now0() });
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
     * Six art-direction modes, each with its own geometry AND its own
     * pointer gesture — never the same algorithm recoloured:
     *   silk      — satin bands; the pointer pushes the sheet
     *   ink       — sinking plumes; the pointer shoves the clouds
     *   construct — constructivist plates; the pointer offsets each piece
     *   glass     — frosted panes; the pointer repels the nearest pane
     *   organic   — branching forms; the pointer parts the canopy
     *   ascii     — character field; the pointer is a lens
     *   relief    — carved grooves under god rays; the pointer is the light
     *   minimal   — one line, one dot; the line bends, a click drops the dot
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
      if (mode === 'silk') drawWaves(ctx, W, H, dark);
      else if (mode === 'ink') drawPlumes(ctx, W, H, dark);
      else if (mode === 'petal') drawPetal(ctx, W, H, dark);
      else if (mode === 'bands') drawBands(ctx, W, H, dark);
      else if (mode === 'concept') drawConcept(ctx, W, H, dark);
      else if (mode === 'dream') drawDream(ctx, W, H, dark);

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

    /* ---- silk: horizontal satin bands --------------------------------- */

    /* ---- ink: plumes sinking and bleeding ----------------------------- */

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

    /* ---- constructivism: bold flat geometry --------------------------- */

    const BARS = (() => {
      const list = [];
      let seed = 918273;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      for (let i = 0; i < 7; i += 1) {
        list.push({
          kind: i % 3,
          x: 0.12 + rnd() * 0.76,
          y: 0.14 + rnd() * 0.7,
          s: 0.1 + rnd() * 0.26,
          rot: rnd() * Math.PI,
          tone: i % 3,
          depth: 0.3 + rnd() * 0.9,
        });
      }
      return list;
    })();

    function drawConstruct(ctx, W, H, dark) {
      ctx.fillStyle = dark ? '#0c0a09' : '#f1eee7';
      ctx.fillRect(0, 0, W, H);
      ctx.filter = 'none';

      const cols = paletteOf(state.palette).rgb;
      const t = silkT * 6;
      const px = silkPointer.active ? silkPointer.x / W - 0.5 : 0;
      const py = silkPointer.active ? silkPointer.y / H - 0.5 : 0;

      ctx.save();
      ctx.translate(W * 0.5 + px * 26, H * 0.5 + py * 18);
      ctx.rotate(Math.sin(t * 0.12) * 0.06);
      ctx.translate(-W * 0.5, -H * 0.5);

      for (let i = 0; i < BARS.length; i += 1) {
        const b = BARS[i];
        const c = cols[b.tone];
        const cx = b.x * W + px * 34 * b.depth + Math.sin(t * 0.4 + i) * 3;
        const cy = b.y * H + py * 22 * b.depth + Math.cos(t * 0.33 + i) * 3;
        const s = b.s * Math.min(W, H);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(b.rot + t * 0.05 * (i % 2 ? 1 : -1));
        // Screen-print logic: no gaussian shadow (it just reads as blur after the
        // canvas is upscaled) — a solid fill plus a crisp keyline instead.
        ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (dark ? 0.72 : 0.62) + ')';
        if (b.kind === 0) {
          ctx.beginPath();
          ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        } else if (b.kind === 1) {
          ctx.fillRect(-s * 0.9, -s * 0.11, s * 1.8, s * 0.22);
          ctx.strokeStyle = dark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.65)';
          ctx.lineWidth = 0.7;
          ctx.strokeRect(-s * 0.9, -s * 0.11, s * 1.8, s * 0.22);
        } else {
          ctx.fillRect(-s * 0.42, -s * 0.42, s * 0.84, s * 0.84);
          ctx.strokeStyle = dark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.65)';
          ctx.lineWidth = 0.7;
          ctx.strokeRect(-s * 0.42, -s * 0.42, s * 0.84, s * 0.84);
        }
        ctx.restore();
      }

      // one hard black bar anchors the composition, like a Rodchenko plate
      ctx.fillStyle = dark ? 'rgba(255,255,255,0.9)' : 'rgba(16,14,12,0.9)';
      ctx.save();
      ctx.translate(W * (0.5 + px * 0.1), H * (0.5 + py * 0.1));
      ctx.rotate(-0.6 + Math.sin(t * 0.1) * 0.05);
      ctx.fillRect(-W * 0.7, -1.6, W * 1.4, 3.2);
      ctx.restore();

      ctx.restore();
    }

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

    /* ---- concept: matte painting with drifting fog -------------------- */

    function drawConcept(ctx, W, H, dark) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, dark ? '#0d1524' : '#dfe8f2');
      sky.addColorStop(0.6, dark ? '#16233a' : '#c9d6e6');
      sky.addColorStop(1, dark ? '#070a12' : '#b9c6d8');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      const cols = paletteOf(state.palette).rgb;
      const t = silkT * 1.6;
      const lx = silkPointer.active ? silkPointer.x : W * 0.72;
      const ly = silkPointer.active ? silkPointer.y : H * 0.2;

      // light bloom
      ctx.filter = 'blur(14px)';
      const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, W * 0.36);
      glow.addColorStop(0, 'rgba(255,246,230,' + (dark ? 0.34 : 0.7) + ')');
      glow.addColorStop(1, 'rgba(255,246,230,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // ridge silhouettes, three depths
      ctx.filter = 'blur(1.2px)';
      for (let layer = 0; layer < 3; layer += 1) {
        const baseY = H * (0.62 + layer * 0.1);
        const amp = 14 - layer * 3;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 10) {
          const y = baseY + Math.sin(x * 0.008 + t * (0.4 + layer * 0.2) + layer * 2) * amp +
            Math.sin(x * 0.021 - t * 0.5 + layer) * amp * 0.4;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fillStyle = dark
          ? 'rgba(' + Math.round(8 + layer * 6) + ',' + Math.round(12 + layer * 8) + ',' + Math.round(20 + layer * 10) + ',0.9)'
          : 'rgba(' + Math.round(150 - layer * 22) + ',' + Math.round(165 - layer * 22) + ',' + Math.round(185 - layer * 20) + ',0.85)';
        ctx.fill();
      }

      // fog band drifting across
      ctx.filter = 'blur(16px)';
      const fx = ((t * 18) % (W + 200)) - 100;
      const fog = ctx.createLinearGradient(fx - 160, 0, fx + 160, 0);
      fog.addColorStop(0, 'rgba(' + cols[0][0] + ',' + cols[0][1] + ',' + cols[0][2] + ',0)');
      fog.addColorStop(0.5, 'rgba(' + cols[0][0] + ',' + cols[0][1] + ',' + cols[0][2] + ',' + (dark ? 0.16 : 0.22) + ')');
      fog.addColorStop(1, 'rgba(' + cols[0][0] + ',' + cols[0][1] + ',' + cols[0][2] + ',0)');
      ctx.fillStyle = fog;
      ctx.fillRect(fx - 160, H * 0.45, 320, H * 0.4);
    }

    /* ---- dream: dreamcore pastel orbs and floating frames ------------- */

    const ORBS = (() => {
      const list = [];
      let seed = 90210;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      for (let i = 0; i < 9; i += 1) {
        list.push({ x: rnd(), y: rnd(), r: 0.04 + rnd() * 0.09, ph: rnd() * 6.28, tone: i % 3 });
      }
      return list;
    })();

    function drawDream(ctx, W, H, dark) {
      const sky = ctx.createLinearGradient(0, 0, W, H);
      sky.addColorStop(0, dark ? '#181428' : '#fdf3f8');
      sky.addColorStop(0.5, dark ? '#221a34' : '#f0eafb');
      sky.addColorStop(1, dark ? '#0c0a16' : '#e8f2fb');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      const cols = paletteOf(state.palette).rgb;
      const t = silkT * 2;
      const px = silkPointer.active ? silkPointer.x : W * 0.5;
      const py = silkPointer.active ? silkPointer.y : H * 0.5;

      ctx.filter = 'blur(8px)';
      for (let i = 0; i < ORBS.length; i += 1) {
        const o = ORBS[i];
        let cx = (o.x + Math.sin(t * 0.4 + o.ph) * 0.06) * W;
        let cy = (o.y + Math.cos(t * 0.33 + o.ph) * 0.05) * H;
        // orbs lean toward the cursor, slowly
        cx += (px - cx) * 0.06;
        cy += (py - cy) * 0.06;
        const r = o.r * W;
        const c = cols[o.tone];
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (dark ? 0.6 : 0.5) + ')');
        g.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // floating frames, a dreamcore staple
      ctx.filter = 'blur(0.5px)';
      for (let i = 0; i < 3; i += 1) {
        const depth = 0.3 + i * 0.35;
        const w = W * (0.14 + i * 0.03);
        const h = H * (0.2 + i * 0.04);
        const cx = W * (0.22 + i * 0.28) + (px - W * 0.5) * 0.05 * depth + Math.sin(t * 0.5 + i) * 5;
        const cy = H * (0.4 + (i % 2) * 0.12) + (py - H * 0.5) * 0.04 * depth + Math.cos(t * 0.4 + i) * 4;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 6);
        else ctx.rect(cx - w / 2, cy - h / 2, w, h);
        ctx.fillStyle = dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.5)';
        ctx.fill();
        ctx.strokeStyle = dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    /* ---- petal: translucent ruffled petals, reference 10 ------------- */

    function petalPath(ctx, len, wid, ruff, phase) {
      const N = 18;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let i = 0; i <= N; i += 1) {
        const t = i / N;
        const w = Math.pow(Math.sin(Math.PI * t), 0.72) * wid * (1 + ruff * Math.sin(t * 11 + phase));
        ctx.lineTo(len * t, -w);
      }
      for (let i = N; i >= 0; i -= 1) {
        const t = i / N;
        const w = Math.pow(Math.sin(Math.PI * t), 0.72) * wid * (1 + ruff * Math.sin(t * 11 + phase + 1.7));
        ctx.lineTo(len * t, w);
      }
      ctx.closePath();
    }

    function drawPetal(ctx, W, H, dark) {
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.8);
      bg.addColorStop(0, dark ? '#1a1420' : '#f6eef4');
      bg.addColorStop(1, dark ? '#08060c' : '#e6dbe8');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const cols = paletteOf(state.palette).rgb;
      const t = silkT * 4;
      const cx = silkPointer.active ? silkPointer.x : W * 0.5;
      const cy = silkPointer.active ? silkPointer.y : H * 0.52;
      const lean = silkPointer.active ? (silkPointer.x / W - 0.5) * 0.5 : 0;

      ctx.filter = 'blur(0.6px)';
      // petals read best when the body is the lightest colour of the card and the
      // tip picks up the accent — otherwise a dark card turns the flower to mud
      const order = [0, 1, 2].sort(
        (a, b) => cols[a][0] + cols[a][1] + cols[a][2] - (cols[b][0] + cols[b][1] + cols[b][2]),
      );
      const base = cols[order[1]];
      const accent = cols[order[2]];
      const layers = [
        { n: 9, len: 0.46, wid: 0.15, tone: 0, rot: 0.0, alpha: 0.5 },
        { n: 7, len: 0.34, wid: 0.115, tone: 1, rot: 0.42, alpha: 0.55 },
        { n: 5, len: 0.23, wid: 0.085, tone: 2, rot: 0.9, alpha: 0.6 },
      ];

      for (let L = 0; L < layers.length; L += 1) {
        const lay = layers[L];
        const c = L === 2 ? accent : base;
        for (let i = 0; i < lay.n; i += 1) {
          const a = (i / lay.n) * Math.PI * 2 + lay.rot + t * (0.12 + L * 0.05);
          const breathe = 1 + 0.05 * Math.sin(t * 1.4 + i + L);
          const len = lay.len * W * breathe;
          const wid = lay.wid * W * breathe;

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(a + lean * (L + 1) * 0.2);
          petalPath(ctx, len, wid, 0.12, t + i * 0.8 + L);
          const g = ctx.createLinearGradient(0, 0, len, 0);
          const c2 = L === 0 ? accent : base;
          g.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (dark ? 0.55 : 0.5) + ')');
          g.addColorStop(0.55, 'rgba(' + c2[0] + ',' + c2[1] + ',' + c2[2] + ',' + (dark ? 0.4 : 0.36) + ')');
          g.addColorStop(1, dark ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.92)');
          ctx.fillStyle = g;
          ctx.fill();
          ctx.strokeStyle = dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)';
          ctx.lineWidth = 0.9;
          ctx.stroke();
          ctx.restore();
        }
      }

      // the throat of the flower
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.09);
      core.addColorStop(0, dark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)');
      core.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, W, H);
    }

    /* ---- bands: pixel-quantised colour stripes, reference 11 --------- */

    function drawBands(ctx, W, H, dark) {
      ctx.fillStyle = dark ? '#242b31' : '#e9edf2';
      ctx.fillRect(0, 0, W, H);
      ctx.filter = 'none';

      const cols = paletteOf(state.palette).rgb;
      const t = silkT * 2.6;
      const STEP = Math.max(8, W / 26);
      const px = silkPointer.active ? silkPointer.x : -9999;
      const py = silkPointer.active ? silkPointer.y : -9999;

      const bands = 6;
      for (let b = 0; b < bands; b += 1) {
        const c = cols[b % 3];
        const baseY = H * (0.12 + b * 0.145);
        const thick = H * (0.1 + 0.02 * Math.sin(b));
        const ph = b * 1.3;

        const top = (x) => {
          let y = baseY + Math.sin(x * 0.006 + t + ph) * H * 0.06 + Math.sin(x * 0.017 - t * 0.6 + ph) * H * 0.02;
          if (px > -9999) {
            const dx = x - px;
            const k = Math.exp(-(dx * dx) / 4200);
            y += k * (py - y) * 0.22;
          }
          // quantise to the pixel grid — this is what makes it read as pixel art
          return Math.round(y / STEP) * STEP;
        };

        ctx.beginPath();
        ctx.moveTo(0, top(0));
        for (let x = STEP; x <= W; x += STEP) ctx.lineTo(x, top(x));
        for (let x = W; x >= 0; x -= STEP) ctx.lineTo(x, top(x) + Math.round(thick / STEP) * STEP);
        ctx.closePath();
        ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (dark ? 0.62 : 0.5) + ')';
        ctx.fill();

        // a single bright row on the crest
        ctx.beginPath();
        ctx.moveTo(0, top(0));
        for (let x = STEP; x <= W; x += STEP) ctx.lineTo(x, top(x));
        ctx.strokeStyle = dark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.8)';
        ctx.lineWidth = Math.max(2, STEP * 0.22);
        ctx.stroke();
      }
    }

    function now0() {
      return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    }


    function syncSilk() {
      const canvasMode = state.bgmode !== 'aurora';
      // sharp geometry needs a finer bitmap; fluid fields are happy at 384
      const sharp = state.bgmode === 'construct' || state.bgmode === 'ascii' || state.bgmode === 'minimal' || state.bgmode === 'relief';
      const wantW = sharp ? 1024 : 384;
      if (silk && silk.width !== wantW) { silk.width = wantW; silk.height = Math.round(wantW * 0.5625); }
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
