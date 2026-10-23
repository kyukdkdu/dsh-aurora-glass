/**
 * dsh-aurora-glass — client module (Web UI half).
 *
 * A global glassmorphism + aurora theme for DeepSeek Harness.
 *
 * Strategy:
 *  - Token-level theming through a DIRECT CSS variable layer on `body`:
 *    this shell defines its --dsw-alias-* surface / border / brand tokens
 *    on `body` and `body[data-ds-dark-theme]` in static platform sheets,
 *    and the theme service's override layers are never composed back into
 *    live CSS. So this plugin writes BOTH schemes straight onto body with
 *    !important (the dark block rides the host's own data-ds-dark-theme
 *    attribute), re-pointing the tokens at translucent "glass" values so
 *    the WHOLE shell restyles at once with zero structural assumptions and
 *    zero third-party dependencies. Dark-mode opacities keep enough body
 *    to stay readable over the aurora layer; light-mode surfaces stay far
 *    more opaque for text contrast.
 *  - A pure-CSS aurora background + optional film-grain layer (html/body
 *    pseudo-elements) is what "shows through" the frosted layers.
 *  - One floating control button + panel in `shell.overlay`. A module-wide
 *    mount counter guarantees exactly one button even if the host mounts
 *    the overlay more than once.
 *  - Settings persist to localStorage; heavy re-theming is throttled so
 *    slider dragging stays smooth.
 */
window.__ModuleLoader__.load({
  id: 'dsh-aurora-glass',
  factory(require) {
    'use strict';
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useSyncExternalStore } = React;

    const PACKAGE = 'dsh-aurora-glass';
    const STORAGE_KEY = 'dsh-aurora-glass:settings:v1';
    const OVERLAY_SLOT = 'shell.overlay';

    /* ------------------------------ palettes & presets ------------------------------ */

    const PALETTES = [
      {
        id: 'aurora', label: 'Aurora',
        brand: { light: '#4763ff', dark: '#8fb0ff' },
        glow: ['rgba(96, 126, 255, .5)', 'rgba(168, 85, 247, .4)', 'rgba(236, 72, 153, .32)'],
      },
      {
        id: 'ocean', label: 'Ocean',
        brand: { light: '#0b7bf1', dark: '#7cc4ff' },
        glow: ['rgba(34, 211, 238, .46)', 'rgba(59, 130, 246, .38)', 'rgba(16, 185, 129, .3)'],
      },
      {
        id: 'ember', label: 'Ember',
        brand: { light: '#ea580c', dark: '#ffb27d' },
        glow: ['rgba(251, 146, 60, .46)', 'rgba(244, 63, 94, .38)', 'rgba(217, 70, 239, .3)'],
      },
      {
        id: 'jade', label: 'Jade',
        brand: { light: '#059669', dark: '#6ee7b7' },
        glow: ['rgba(52, 211, 153, .46)', 'rgba(45, 212, 191, .38)', 'rgba(56, 189, 248, .28)'],
      },
      {
        id: 'mono', label: 'Mono',
        brand: { light: '#4b5563', dark: '#cbd5e1' },
        glow: ['rgba(148, 163, 184, .4)', 'rgba(203, 213, 225, .34)', 'rgba(99, 102, 241, .24)'],
      },
    ];

    const PRESETS = [
      { id: 'default', key: 'preset.default', set: { glass: .6, blur: 18, saturation: 1, motion: 'soft', aurora: true, grain: true } },
      { id: 'mist', key: 'preset.mist', set: { glass: .88, blur: 30, saturation: .65, motion: 'off', aurora: true, grain: true } },
      { id: 'depth', key: 'preset.depth', set: { glass: .32, blur: 10, saturation: 1.25, motion: 'full', aurora: true, grain: true } },
      { id: 'pure', key: 'preset.pure', set: { glass: 0, blur: 0, saturation: 0, motion: 'off', aurora: false, grain: false } },
    ];

    const DEFAULT_SETTINGS = {
      enabled: true,
      preset: 'default',
      palette: 'aurora',
      glass: .6,
      blur: 18,
      saturation: 1,
      motion: 'soft',
      grain: true,
      aurora: true,
    };

    /* ------------------------------ i18n ------------------------------ */

    const DICTS = {
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
        'ctl.blur': 'Blur',
        'ctl.saturation': 'Color',
        'ctl.motion': 'Motion',
        'seg.motion.off': 'Off',
        'seg.motion.soft': 'Soft',
        'seg.motion.full': 'Rich',
        'sw.aurora': 'Aurora glow',
        'sw.grain': 'Film grain',
        'sw.enabled': 'Glass theme',
        'panel.diagTitle': 'CSS variable layer tier & result: ✔ landed, ✖ blocked, ? not measurable',
        'reset': 'Reset to defaults',
      },
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
        'ctl.blur': '模糊',
        'ctl.saturation': '色彩',
        'ctl.motion': '动效强度',
        'seg.motion.off': '关闭',
        'seg.motion.soft': '柔和',
        'seg.motion.full': '丰富',
        'sw.aurora': '极光背景',
        'sw.grain': '噪点质感',
        'sw.enabled': '玻璃主题',
        'panel.diagTitle': 'CSS 变量层诊断：✔ 已生效，✖ 被压制，? 无法测量',
        'reset': '恢复默认设置',
      },
    };

    /* ------------------------------ settings store ------------------------------ */

    function loadSettings() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
        // migrate pre-1.0.2 boolean motion flag
        if (parsed.motion === true) parsed.motion = 'full';
        if (parsed.motion === false) parsed.motion = 'off';
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    }

    function createStore() {
      let state = loadSettings();
      const fast = new Set();
      const deep = new Set();
      let timer = null;
      let lastDeep = 0;

      const pokeDeep = () => {
        const now = Date.now();
        if (now - lastDeep >= 90) {
          lastDeep = now;
          deep.forEach((fn) => fn());
        } else if (timer === null) {
          timer = setTimeout(() => {
            timer = null;
            lastDeep = Date.now();
            deep.forEach((fn) => fn());
          }, 90 - (now - lastDeep));
        }
      };

      return {
        get: () => state,
        update(patch) {
          state = { ...state, ...patch };
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
          fast.forEach((fn) => fn());
          pokeDeep();
        },
        subscribe(fn) { fast.add(fn); return () => { fast.delete(fn); }; },
        subscribeDeep(fn) { deep.add(fn); return () => { deep.delete(fn); }; },
      };
    }

    /* ------------------------------ token math ------------------------------ */

    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const rgba = (r, g, b, a) => `rgba(${r}, ${g}, ${b}, ${clamp(a, 0, 1).toFixed(3)})`;
    const fade = (color, k) => color.replace(/rgba?\(([^)]+)\)/, (m, body) => {
      const parts = body.split(',').map((x) => x.trim());
      if (parts.length !== 4) return m;
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${(parseFloat(parts[3]) * k).toFixed(3)})`;
    });
    const paletteOf = (id) => PALETTES.find((p) => p.id === id) || PALETTES[0];

    /**
     * Compose the alias-token override layer. Values are { light, dark }
     * pairs (ThemeTokenOverrides); the theme service resolves the pair for
     * the active color scheme. Dark surfaces keep enough opacity to stay
     * readable over the aurora layer; light surfaces are nearly matte.
     */
    function buildTokens(s) {
      if (!s.enabled) return null;
      const pal = paletteOf(s.palette);
      const g = clamp(Number(s.glass) || 0, 0, 1);

      const dark = {
        '--dsw-alias-bg-base': rgba(9, 11, 19, 1 - 0.12 * g),
        '--dsw-alias-bg-layer-1': rgba(255, 255, 255, 0.05 + 0.09 * g),
        '--dsw-alias-bg-layer-2': rgba(255, 255, 255, 0.07 + 0.1 * g),
        '--dsw-alias-bg-overlay': rgba(12, 14, 23, 0.66 + 0.3 * g),
        '--dsw-alias-border-l1': rgba(255, 255, 255, 0.06 + 0.1 * g),
        '--dsw-alias-border-l2': rgba(255, 255, 255, 0.04 + 0.06 * g),
        '--dsw-specific-sidebar-fill': rgba(255, 255, 255, 0.02 + 0.05 * g),
      };
      const light = {
        '--dsw-alias-bg-base': rgba(248, 250, 254, 0.78 - 0.22 * g),
        '--dsw-alias-bg-layer-1': rgba(255, 255, 255, 0.42 + 0.18 * g),
        '--dsw-alias-bg-layer-2': rgba(255, 255, 255, 0.6 + 0.14 * g),
        '--dsw-alias-bg-overlay': rgba(251, 252, 255, 0.72 + 0.16 * g),
        '--dsw-alias-border-l1': rgba(13, 20, 42, 0.1 + 0.08 * g),
        '--dsw-alias-border-l2': rgba(13, 20, 42, 0.08 + 0.06 * g),
        '--dsw-specific-sidebar-fill': rgba(255, 255, 255, 0.36 + 0.2 * g),
      };

      const out = {
        '--dsw-alias-brand-primary': { light: pal.brand.light, dark: pal.brand.dark },
      };
      Object.keys(dark).forEach((token) => {
        out[token] = { light: light[token], dark: dark[token] };
      });
      return out;
    }

    /**
     * Direct alias-token layer. The shell declares its alias tokens on
     * `body` / `body[data-ds-dark-theme]` (static platform sheets, normal
     * importance), so a `:root` injection always loses at body level. This
     * sheet writes BOTH schemes onto body with !important — the dark block
     * rides the host's own data-ds-dark-theme attribute so system/light/dark
     * flips need no re-injection — plus a :root copy for html-level
     * consumers. `tier` escalates the selector as a belt-and-suspenders
     * against future shells that scope token rules more aggressively.
     */
    const VAR_SELECTORS = [
      ['body', 'body[data-ds-dark-theme]'],
      ['html body', 'html body[data-ds-dark-theme]'],
      ['html > body', 'html > body[data-ds-dark-theme]'],
    ];

    function buildVarCss(s, scheme, tier = 0) {
      if (!s.enabled) return null;
      const tokens = buildTokens(s);
      if (!tokens) return null;
      const [lightSel, darkSel] = VAR_SELECTORS[Math.min(tier, VAR_SELECTORS.length - 1)];
      const lines = [`/* dsh-aurora-glass: direct alias-token layer (tier ${tier}) */`];
      const emit = (sel, mode) => {
        lines.push(`${sel} {`);
        Object.keys(tokens).forEach((token) => {
          lines.push(`  ${token}: ${tokens[token][mode]} !important;`);
        });
        lines.push('}');
      };
      emit(lightSel, 'light');
      emit(darkSel, 'dark');
      emit(':root', scheme === 'light' ? 'light' : 'dark');
      return lines.join('\n');
    }

    /* ------------------------------ aurora + grain stylesheet ------------------------------ */

    const GRAIN_DATA_URI = 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3CfeColorMatrix type=%22saturate%22 values=%220%22/%3E%3C/filter%3E%3Crect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.05%22/%3E%3C/svg%3E")';

    function buildAuraCss(s, scheme) {
      const pal = paletteOf(s.palette);
      const dark = scheme === 'dark';
      const base = dark ? '#0a0d16' : '#eef1f8';
      const active = s.aurora && s.enabled;
      const blur = active ? clamp(Number(s.blur) || 0, 0, 40) : 0;
      // light mode needs a stronger layer for the glass to read
      const satEff = (active && !dark) ? Math.min(1.75, clamp(Number(s.saturation) || 0, 0, 1.6) + 0.4) : clamp(Number(s.saturation) || 0, 0, 1.6);
      const sat = satEff;
      const [c1, c2, c3] = pal.glow;
      const sz = dark ? ['42% 42%', '46% 46%', '54% 54%'] : ['48% 48%', '52% 52%', '60% 60%'];
      const grain = (s.grain && active) ? GRAIN_DATA_URI : 'none';
      let anim1 = ''; let anim2 = ''; let tailScale = '1.05';
      if (active && s.motion === 'soft') { anim1 = 'animation: ag-drift-1 26s ease-in-out infinite alternate;'; anim2 = 'animation: ag-drift-2 34s ease-in-out infinite alternate;'; }
      if (active && s.motion === 'full') { anim1 = 'animation: ag-drift-1 15s ease-in-out infinite alternate;'; anim2 = 'animation: ag-drift-2 19s ease-in-out infinite alternate;'; tailScale = '1.12'; }

      return [
        `html { background: radial-gradient(50% 55% at 18% 18%, ${fade(c1, .55)}, transparent 72%), radial-gradient(60% 50% at 82% 26%, ${fade(c2, .5)}, transparent 74%), radial-gradient(65% 60% at 50% 92%, ${fade(c3, .45)}, transparent 75%), ${base}; }`,
        `body { background: transparent; }`,
        `body::before, body::after { content: ""; position: fixed; z-index: -1; inset: -15% -10%; pointer-events: none; filter: blur(${blur}px) saturate(${sat}); will-change: transform; backface-visibility: hidden; }`,
        `body::before { background-image: ${grain}, radial-gradient(${sz[0]} at 22% 28%, ${c1}, transparent 66%), radial-gradient(${sz[1]} at 78% 20%, ${c2}, transparent 70%), radial-gradient(${sz[2]} at 62% 88%, ${c3}, transparent 72%); background-size: 120px 120px, auto, auto, auto; ${anim1} }`,
        `body::after { opacity: ${dark ? '.5' : '.68'}; background: radial-gradient(50% 50% at 82% 72%, ${c2}, transparent 66%), radial-gradient(38% 38% at 18% 78%, ${c3}, transparent 70%); ${anim2} transform: translate3d(2%, 3%, 0); }`,
        `@keyframes ag-drift-1 { from { transform: translate3d(-2%, 1%, 0) scale(1); } to { transform: translate3d(3%, -2%, 0) scale(${tailScale}); } }`,
        `@keyframes ag-drift-2 { from { transform: translate3d(2%, 3%, 0) scale(1.06); } to { transform: translate3d(-3%, -1%, 0) scale(.96); } }`,
        `@media (prefers-reduced-motion: reduce) { body::before, body::after { animation: none; } }`,
      ].join('\n');
    }

    /* ------------------------------ styles ------------------------------ */

    const BASE_CSS = `
.ag-root{position:fixed;right:22px;bottom:22px;z-index:30;display:flex;flex-direction:column;align-items:flex-end;gap:12px;font-size:13px;line-height:1.45;font-family:inherit;-webkit-font-smoothing:antialiased;pointer-events:auto}
.ag-root *,.ag-root *::before,.ag-root *::after{box-sizing:border-box}
.ag-glow{position:relative;overflow:hidden;display:grid;place-items:center;width:46px;height:46px;padding:0;border-radius:50%;border:1px solid rgba(255,255,255,.24);background:linear-gradient(150deg,rgba(255,255,255,.22),rgba(255,255,255,.06));backdrop-filter:blur(12px) saturate(1.5);-webkit-backdrop-filter:blur(12px) saturate(1.5);color:#eef2ff;cursor:pointer;box-shadow:0 10px 28px rgba(4,8,24,.4),0 0 0 0 rgba(143,176,255,0);transition:transform .4s cubic-bezier(.34,1.56,.64,1),box-shadow .3s}
.ag-glow:hover{transform:scale(1.1) rotate(36deg);box-shadow:0 14px 34px rgba(4,8,24,.5),0 0 0 6px rgba(143,176,255,.12)}
.ag-glow:active{transform:scale(.94)}
.ag-glow::after{content:"";position:absolute;inset:0;border-radius:50%;background:linear-gradient(115deg,transparent 32%,rgba(255,255,255,.3) 50%,transparent 66%);transform:translateX(-130%)}
.ag-glow:hover::after{animation:ag-shine .85s ease}
@keyframes ag-shine{from{transform:translateX(-130%)}to{transform:translateX(130%)}}
@media (prefers-reduced-motion: no-preference){.ag-glow{animation:ag-halo 3.6s ease-in-out infinite}.ag-glow:hover{animation:none}}
@keyframes ag-halo{0%,100%{box-shadow:0 10px 28px rgba(4,8,24,.4),0 0 0 0 rgba(143,176,255,0)}50%{box-shadow:0 10px 28px rgba(4,8,24,.4),0 0 0 8px rgba(143,176,255,.14)}}
.ag-panel{width:306px;padding:16px 16px 14px;border-radius:20px;border:1px solid rgba(255,255,255,.16);background:rgba(15,17,28,.97);backdrop-filter:blur(24px) saturate(1.5);-webkit-backdrop-filter:blur(24px) saturate(1.5);box-shadow:0 24px 64px rgba(2,6,20,.55),0 2px 12px rgba(2,6,20,.35);color:#e8ecf8;animation:ag-pop .3s cubic-bezier(.34,1.56,.64,1);transform-origin:100% 100%}
@keyframes ag-pop{from{opacity:0;transform:scale(.9) translateY(10px)}to{opacity:1;transform:none}}
.ag-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:2px}
.ag-title{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:700;letter-spacing:.2px;color:#f2f5fd}
.ag-badge{font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(255,255,255,.12);color:#aab3cc}
.ag-diag{margin:0 0 10px;font-size:11px;line-height:1;color:#8b93ad;font-variant-numeric:tabular-nums;user-select:text}
.ag-x{width:26px;height:26px;border-radius:8px;border:none;background:rgba(255,255,255,.09);color:#aab3cc;cursor:pointer;transition:background .15s,color .15s}
.ag-x:hover{background:rgba(255,255,255,.2);color:#f2f5fd}
.ag-sec{margin-top:12px}
.ag-sec-label{font-size:11px;color:#9aa5c0;letter-spacing:.5px;margin-bottom:6px;text-transform:uppercase}
.ag-chips{display:flex;flex-wrap:wrap;gap:6px}
.ag-chip{font-size:12px;font-weight:500;padding:5px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#c6cfe4;cursor:pointer;transition:all .18s}
.ag-chip:hover{color:#f2f5fd;border-color:rgba(255,255,255,.32)}
.ag-chip.on{color:#fff;background:var(--dsw-alias-brand-primary,#4763ff);border-color:transparent}
.ag-swatches{display:flex;gap:9px;align-items:center}
.ag-swatch{width:24px;height:24px;padding:0;border-radius:50%;border:2px solid rgba(255,255,255,.34);cursor:pointer;transition:transform .18s,box-shadow .18s}
.ag-swatch:hover{transform:scale(1.09)}
.ag-swatch.on{transform:scale(1.15);box-shadow:0 0 0 2.5px rgba(242,245,253,.9)}
.ag-ctl{display:flex;align-items:center;gap:10px;margin-top:11px}
.ag-ctl-label{width:66px;font-size:12px;flex:none;color:#dbe2f2}
.ag-range{flex:1;min-width:0;accent-color:var(--dsw-alias-brand-primary,#4763ff);cursor:pointer;height:4px}
.ag-val{width:34px;text-align:right;font-size:11px;color:#aab3cc;font-variant-numeric:tabular-nums;flex:none}
.ag-row{display:flex;align-items:center;justify-content:space-between;margin-top:11px;font-size:12.5px;color:#e8ecf8}
.ag-switch{position:relative;width:36px;height:21px;padding:0;border:none;border-radius:999px;background:rgba(255,255,255,.18);cursor:pointer;transition:background .2s}
.ag-switch::after{content:"";position:absolute;top:2.5px;left:2.5px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .22s cubic-bezier(.34,1.56,.64,1)}
.ag-switch.on{background:var(--dsw-alias-brand-primary,#4763ff)}
.ag-switch.on::after{transform:translateX(15px)}
.ag-seg{display:flex;gap:2px;padding:3px;margin-top:8px;background:rgba(255,255,255,.08);border-radius:10px}
.ag-seg-button{flex:1;border:none;background:transparent;color:#aab3cc;font-size:12px;padding:5.5px 0;border-radius:8px;cursor:pointer;transition:all .18s}
.ag-seg-button:hover{color:#f2f5fd}
.ag-seg-button.on{background:rgba(255,255,255,.17);color:#f2f5fd}
.ag-reset{margin-top:14px;width:100%;font-size:12px;padding:7.5px 0;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);color:#c6cfe4;cursor:pointer;transition:all .15s}
.ag-reset:hover{color:#f2f5fd;background:rgba(255,255,255,.1)}
.ag-grain-toggle{display:block}
*::-webkit-scrollbar{width:9px;height:9px}
*::-webkit-scrollbar-track{background:transparent}
*::-webkit-scrollbar-thumb{background:rgba(148,163,184,.35);border-radius:999px;border:2px solid transparent;background-clip:content-box}
*::-webkit-scrollbar-thumb:hover{background-color:rgba(148,163,184,.6);background-clip:content-box}
*{scrollbar-width:thin;scrollbar-color:rgba(148,163,184,.4) transparent}
::selection{background:rgba(96,126,255,.32)}
`;

    /* ------------------------------ components ------------------------------ */

    function Sparkle({ size = 22 }) {
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true,
        style: { display: 'block' },
      }, h('path', {
        d: 'M12 2c.6 4.8 2.4 7.6 8 8-5.6.4-7.4 3.2-8 8-.6-4.8-2.4-7.6-8-8 5.6-.4 7.4-3.2 8-8Z',
        fill: 'currentColor',
      }));
    }

    // The overlay slot may be mounted more than once by the host (e.g. one
    // host per region — the duplicate sparkle the user reported). Only the
    // first live mount renders the floating button.
    let floatingMounts = 0;

    function FloatingButton({ store, t, ensureVarLayer }) {
      const [show, setShow] = useState(false);
      const [open, setOpen] = useState(false);
      const [diag, setDiag] = useState({ tier: 0, ok: null });
      useEffect(() => {
        floatingMounts += 1;
        if (floatingMounts === 1) {
          setShow(true);
          if (typeof ensureVarLayer === 'function') setDiag(ensureVarLayer());
        }
        return () => { floatingMounts -= 1; };
      }, []);
      if (!show) return null;
      return h('div', { className: 'ag-root' },
        open ? h(Panel, { store, t, diag, onClose: () => setOpen(false) }) : null,
        h('button', {
          type: 'button', className: 'ag-glow',
          title: t('panel.toggle'), 'aria-label': t('panel.toggle'),
          onClick: () => setOpen((v) => {
            const next = !v;
            if (next && typeof ensureVarLayer === 'function') setDiag(ensureVarLayer());
            return next;
          }),
        }, h(Sparkle, { size: 22 })));
    }

    function Panel({ store, t, diag, onClose }) {
      const st = useSyncExternalStore(store.subscribe, store.get);
      const set = (patch) => store.update(patch);
      const pickPreset = (id) => {
        const preset = PRESETS.find((p) => p.id === id);
        if (!preset) return;
        set({ preset: preset.id, ...preset.set });
      };

      const sections = {
        preset: [t('sec.preset'), PRESETS.map((p) => h('button', {
          key: p.id, type: 'button',
          className: 'ag-chip' + (st.preset === p.id ? ' on' : ''),
          onClick: () => pickPreset(p.id),
        }, t(p.key)))],
        palette: [t('sec.palette'), PALETTES.map((p) => h('button', {
          key: p.id, type: 'button',
          className: 'ag-swatch' + (st.palette === p.id ? ' on' : ''),
          title: p.label,
          'aria-label': p.label,
          style: { background: `linear-gradient(135deg, ${p.glow.join(', ')})` },
          onClick: () => set({ palette: p.id }),
        }))],
      };

      return h('section', { className: 'ag-panel', role: 'dialog', 'aria-label': t('panel.title') },
        h('div', { className: 'ag-head' },
          h('div', { className: 'ag-title' },
            h(Sparkle, { size: 18 }), t('panel.title'),
            h('span', { className: 'ag-badge' }, 'v1.0.6')),
          h('button', { type: 'button', className: 'ag-x', 'aria-label': 'Close', onClick: onClose }, '\u2715')),
        h('div', { className: 'ag-diag', title: t('panel.diagTitle') },
          `CSS L${diag ? diag.tier : 0} ${diag && diag.ok === true ? '\u2714' : diag && diag.ok === false ? '\u2716' : '?'}`),
        h('div', { className: 'ag-sec' },
          h('div', { className: 'ag-sec-label' }, sections.preset[0]),
          h('div', { className: 'ag-chips' }, sections.preset[1])),
        h('div', { className: 'ag-sec' },
          h('div', { className: 'ag-sec-label' }, sections.palette[0]),
          h('div', { className: 'ag-swatches' }, sections.palette[1])),
        h('div', { className: 'ag-sec' },
          h('div', { className: 'ag-sec-label' }, t('sec.surface')),
          SliderCtl({ t, label: t('ctl.glass'), value: st.glass, min: 0, max: 1, step: .05, fmt: (v) => `${Math.round(v * 100)}%`, onChange: (v) => set({ glass: v }) }),
          SliderCtl({ t, label: t('ctl.blur'), value: st.blur, min: 0, max: 40, step: 1, fmt: (v) => `${Math.round(v)}px`, onChange: (v) => set({ blur: v }) }),
          SliderCtl({ t, label: t('ctl.saturation'), value: st.saturation, min: 0, max: 1.6, step: .05, fmt: (v) => `${Math.round(v * 100)}%`, onChange: (v) => set({ saturation: v }) })),
        h('div', { className: 'ag-sec' },
          h('div', { className: 'ag-sec-label' }, t('sec.look')),
          h('div', { className: 'ag-row' },
            h('span', null, t('ctl.motion')),
            h('div', { className: 'ag-seg', style: { marginTop: 0, width: 150 } },
              ['off', 'soft', 'full'].map((lv) => h('button', {
                key: lv, type: 'button',
                className: 'ag-seg-button' + (st.motion === lv ? ' on' : ''),
                onClick: () => set({ motion: lv }),
              }, t(`seg.motion.${lv}`))))),
          SwitchRow({ t, label: t('sw.aurora'), on: st.aurora, onToggle: () => set({ aurora: !st.aurora }) }),
          SwitchRow({ t, label: t('sw.grain'), on: st.grain, onToggle: () => set({ grain: !st.grain }) }),
          SwitchRow({ t, label: t('sw.enabled'), on: st.enabled, onToggle: () => set({ enabled: !st.enabled }) })),
        h('button', {
          type: 'button', className: 'ag-reset',
          onClick: () => set({ ...DEFAULT_SETTINGS }),
        }, t('reset')));
    }

    function SliderCtl({ t, label, value, min, max, step, fmt, onChange }) {
      return h('label', { className: 'ag-ctl' },
        h('span', { className: 'ag-ctl-label' }, label),
        h('input', {
          type: 'range', className: 'ag-range', min, max, step, value,
          onChange: (e) => onChange(Number(e.target.value)),
        }),
        h('span', { className: 'ag-val' }, fmt(value)));
    }

    function SwitchRow({ t, label, on, onToggle }) {
      return h('div', { className: 'ag-row' },
        h('span', null, label),
        h('button', {
          type: 'button', className: 'ag-switch' + (on ? ' on' : ''),
          role: 'switch', 'aria-checked': on, 'aria-label': label,
          onClick: onToggle,
        }));
    }

    /* ------------------------------ module ------------------------------ */

    function makeT(localeSvc) {
      const lang = () => {
        try {
          const snapshot = localeSvc ? localeSvc.getLocale() : null;
          return snapshot && snapshot.active && String(snapshot.active).toLowerCase().startsWith('zh') ? 'zh' : 'en';
        } catch {
          return 'en';
        }
      };
      if (localeSvc) {
        try {
          localeSvc.register(PACKAGE, 'en', DICTS.en);
          localeSvc.register(PACKAGE, 'zh', DICTS.zh);
        } catch { /* dictionaries already registered */ }
      }
      return (key) => (DICTS[lang()] && DICTS[lang()][key]) || DICTS.en[key] || key;
    }

    return {
      inject: ['slots', 'theme', 'locale'],
      apply(ctx) {
        const store = createStore();
        const theme = ctx.theme;
        const t = makeT(ctx.get('locale'));
        let tokenUndo = null;
        let auraUndo = null;
        let varUndo = null;
        let varTier = 0;
        let sheetUndo = null;

        try { sheetUndo = ctx.styles.insert(BASE_CSS); } catch { /* panel renders unstyled */ }

        const getScheme = () => {
          try { return theme.getTheme().active.colorScheme; } catch { return 'dark'; }
        };

        const norm = (v) => String(v || '').replace(/\s+/g, '').toLowerCase();

        const applyVarLayer = (s, scheme) => {
          if (varUndo) { varUndo(); varUndo = null; }
          if (!s.enabled) return;
          const css = buildVarCss(s, scheme, varTier);
          if (css) varUndo = ctx.styles.insert(css);
        };

        /**
         * Verify that our variable layer actually landed. The shell defines
         * the alias tokens on `body`, so we measure the COMPUTED value at
         * body (a :root read would false-positive while the body-level
         * declaration still wins for the UI). Escalate the selector ladder
         * only if a future shell manages to beat the !important body rule.
         * Returns { tier, ok } for the panel diagnostics line.
         */
        const ensureVarLayer = () => {
          try {
            const doc = (typeof document !== 'undefined' && document)
              || (typeof globalThis !== 'undefined' && globalThis.document) || null;
            if (!doc || !doc.documentElement || !doc.defaultView) return { tier: varTier, ok: null };
            const s = store.get();
            const tokens = buildTokens(s);
            if (!tokens) return { tier: varTier, ok: null };
            const scheme = getScheme();
            const want = norm(tokens['--dsw-alias-bg-base'][scheme === 'light' ? 'light' : 'dark']);
            const target = doc.body || doc.documentElement;
            for (let tier = 0; tier < VAR_SELECTORS.length; tier += 1) {
              if (varUndo) { varUndo(); varUndo = null; }
              const css = buildVarCss(s, scheme, tier);
              if (css) varUndo = ctx.styles.insert(css);
              const got = norm(doc.defaultView.getComputedStyle(target).getPropertyValue('--dsw-alias-bg-base'));
              if (got && got === want) { varTier = tier; return { tier, ok: true }; }
            }
            varTier = VAR_SELECTORS.length - 1;
            return { tier: varTier, ok: false };
          } catch (err) {
            try { console.error('[dsh-aurora-glass] var check failed:', err); } catch { /* no console */ }
            return { tier: varTier, ok: null };
          }
        };

        const rebuild = (tokensOnly) => {
          const s = store.get();
          try {
            if (tokensOnly !== true) {
              if (tokenUndo) { tokenUndo(); tokenUndo = null; }
              const tokens = buildTokens(s);
              if (tokens && theme) tokenUndo = theme.overrideTokens(PACKAGE, tokens);
            }
            const scheme = getScheme();
            applyVarLayer(s, scheme);
            if (auraUndo) { auraUndo(); auraUndo = null; }
            if (s.enabled) auraUndo = ctx.styles.insert(buildAuraCss(s, scheme));
          } catch (err) {
            try { console.error('[dsh-aurora-glass] theme apply failed:', err); } catch { /* no console */ }
          }
        };

        rebuild(false);
        const offDeep = store.subscribeDeep(() => rebuild(false));
        // Theme flips (system light/dark) re-resolve both the direct var
        // layer and the aurora sheet for the new scheme.
        const offTheme = ctx.on('theme/change', () => rebuild(true));

        ctx.slots.inject(OVERLAY_SLOT, () => ctx.slots.register({
          name: OVERLAY_SLOT, id: PACKAGE + '.panel', order: 1000, label: PACKAGE,
        }, () => h(FloatingButton, { store, t, ensureVarLayer })));

        try {
          ctx.effect(() => () => {
            offDeep();
            offTheme();
            if (tokenUndo) { tokenUndo(); tokenUndo = null; }
            if (auraUndo) { auraUndo(); auraUndo = null; }
            if (varUndo) { varUndo(); varUndo = null; }
            if (sheetUndo) { sheetUndo(); sheetUndo = null; }
          });
        } catch { /* disposal best-effort */ }
      },
    };
  },
});