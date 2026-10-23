/**
 * dsh-aurora-glass — client module (Web UI half).
 *
 * A global glassmorphism + aurora theme for DeepSeek Harness.
 *
 * Strategy:
 *  - Token-level theming through theme.overrideTokens(): the app's own
 *    --dsw-alias-* surface / border / brand tokens are re-pointed at
 *    translucent "glass" values, so the ENTIRE shell — sidebar, conversation,
 *    composer, popovers, settings — restyles at once with zero structural
 *    assumptions and zero third-party dependencies.
 *  - A pure-CSS aurora background layer (html/body pseudo-elements painted
 *    beneath the app surfaces, animated with GPU-composited transforms only)
 *    is what "shows through" the frosted layers. No DOM is written outside
 *    our own slot components.
 *  - One floating control button + a lightweight settings panel live in
 *    `shell.overlay`; a master toggle lives in `sidebar.footer.action`.
 *  - Settings persist to localStorage; heavy re-theming is throttled so
 *    slider dragging stays buttery.
 */
window.__ModuleLoader__.load({
  id: 'dsh-aurora-glass',
  factory(require) {
    'use strict';
    const React = require('react');
    const h = React.createElement;
    const { useState, useSyncExternalStore } = React;

    const PACKAGE = 'dsh-aurora-glass';
    const STORAGE_KEY = 'dsh-aurora-glass:settings:v1';
    const OVERLAY_SLOT = 'shell.overlay';
    const ACTION_SLOT = 'sidebar.footer.action';

    /* ------------------------------ palettes & presets ------------------------------ */

    const PALETTES = [
      {
        id: 'aurora', label: 'Aurora',
        brand: { light: '#4763ff', dark: '#8fb0ff' },
        glow: ['rgba(96, 126, 255, .55)', 'rgba(168, 85, 247, .45)', 'rgba(236, 72, 153, .36)'],
      },
      {
        id: 'ocean', label: 'Ocean',
        brand: { light: '#0b7bf1', dark: '#7cc4ff' },
        glow: ['rgba(34, 211, 238, .5)', 'rgba(59, 130, 246, .42)', 'rgba(16, 185, 129, .32)'],
      },
      {
        id: 'ember', label: 'Ember',
        brand: { light: '#ea580c', dark: '#ffb27d' },
        glow: ['rgba(251, 146, 60, .5)', 'rgba(244, 63, 94, .42)', 'rgba(217, 70, 239, .32)'],
      },
      {
        id: 'jade', label: 'Jade',
        brand: { light: '#059669', dark: '#6ee7b7' },
        glow: ['rgba(52, 211, 153, .5)', 'rgba(45, 212, 191, .42)', 'rgba(56, 189, 248, .3)'],
      },
      {
        id: 'mono', label: 'Mono',
        brand: { light: '#4b5563', dark: '#cbd5e1' },
        glow: ['rgba(148, 163, 184, .42)', 'rgba(203, 213, 225, .36)', 'rgba(99, 102, 241, .26)'],
      },
    ];

    const PRESETS = [
      { id: 'default', key: 'preset.default', set: { glass: .6, blur: 16, saturation: 1, motion: true, aurora: true } },
      { id: 'mist', key: 'preset.mist', set: { glass: .88, blur: 30, saturation: .65, motion: false, aurora: true } },
      { id: 'depth', key: 'preset.depth', set: { glass: .32, blur: 10, saturation: 1.25, motion: true, aurora: true } },
      { id: 'pure', key: 'preset.pure', set: { glass: 0, blur: 0, saturation: 0, motion: false, aurora: false } },
    ];

    const DEFAULT_SETTINGS = {
      enabled: true,
      preset: 'default',
      palette: 'aurora',
      glass: .6,
      blur: 16,
      saturation: 1,
      motion: true,
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
        'sec.theme': 'Theme',
        'preset.default': 'Default',
        'preset.mist': 'Mist',
        'preset.depth': 'Deep',
        'preset.pure': 'Original',
        'ctl.glass': 'Glass',
        'ctl.blur': 'Blur',
        'ctl.saturation': 'Color',
        'sw.aurora': 'Aurora glow',
        'sw.motion': 'Subtle motion',
        'sw.enabled': 'Glass theme',
        'theme.system': 'Auto',
        'theme.light': 'Light',
        'theme.dark': 'Dark',
        'reset': 'Reset to defaults',
        'master.on': 'Enable Aurora Glass',
        'master.off': 'Disable Aurora Glass',
      },
      zh: {
        'panel.toggle': '极光玻璃设置',
        'panel.title': '极光玻璃',
        'sec.preset': '预设',
        'sec.palette': '色板',
        'sec.surface': '表面',
        'sec.look': '氛围',
        'sec.theme': '主题',
        'preset.default': '默认',
        'preset.mist': '轻雾',
        'preset.depth': '深空',
        'preset.pure': '原版观感',
        'ctl.glass': '玻璃强度',
        'ctl.blur': '模糊',
        'ctl.saturation': '色彩',
        'sw.aurora': '极光背景',
        'sw.motion': '微动效',
        'sw.enabled': '玻璃主题',
        'theme.system': '跟随系统',
        'theme.light': '浅色',
        'theme.dark': '深色',
        'reset': '恢复默认设置',
        'master.on': '启用极光玻璃',
        'master.off': '关闭极光玻璃',
      },
    };

    /* ------------------------------ settings store ------------------------------ */

    function loadSettings() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
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
    const paletteOf = (id) => PALETTES.find((p) => p.id === id) || PALETTES[0];

    /**
     * Compose the alias-token override layer. Values are { light, dark }
     * pairs (ThemeTokenOverrides); the theme service resolves the pair for
     * the active color scheme, so system light/dark flip is automatic.
     * Returns null when the glass theme is disabled (no override layer).
     */
    function buildTokens(s) {
      if (!s.enabled) return null;
      const pal = paletteOf(s.palette);
      const g = clamp(Number(s.glass) || 0, 0, 1);

      const dark = {
        '--dsw-alias-bg-base': rgba(9, 11, 19, 1 - 0.16 * g),
        '--dsw-alias-bg-layer-1': rgba(255, 255, 255, 0.016 + 0.05 * g),
        '--dsw-alias-bg-layer-2': rgba(255, 255, 255, 0.035 + 0.085 * g),
        '--dsw-alias-bg-overlay': rgba(12, 14, 23, 0.6 + 0.32 * g),
        '--dsw-alias-border-l1': rgba(255, 255, 255, 0.05 + 0.095 * g),
        '--dsw-alias-border-l2': rgba(255, 255, 255, 0.03 + 0.06 * g),
        '--dsw-specific-sidebar-fill': rgba(255, 255, 255, 0.01 + 0.05 * g),
      };
      const light = {
        '--dsw-alias-bg-base': rgba(248, 250, 254, 1 - 0.22 * g),
        '--dsw-alias-bg-layer-1': rgba(255, 255, 255, 0.5 + 0.26 * g),
        '--dsw-alias-bg-layer-2': rgba(255, 255, 255, 0.68 + 0.2 * g),
        '--dsw-alias-bg-overlay': rgba(251, 252, 255, 0.7 + 0.26 * g),
        '--dsw-alias-border-l1': rgba(13, 20, 42, 0.05 + 0.075 * g),
        '--dsw-alias-border-l2': rgba(13, 20, 42, 0.03 + 0.05 * g),
        '--dsw-specific-sidebar-fill': rgba(255, 255, 255, 0.4 + 0.32 * g),
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
     * Aurora background stylesheet: base canvas color on <html>, and two
     * blurred radial-gradient blobs painted beneath the app surfaces
     * (z-index:-1 on body pseudo-elements, pointer-events:none). Only
     * transforms/opacity animate — the blur is a one-shot raster.
     */
    function buildAuraCss(s, scheme) {
      const pal = paletteOf(s.palette);
      const dark = scheme === 'dark';
      const base = dark ? '#0a0d16' : '#eef1f8';
      const active = s.aurora && s.enabled;
      const blur = active ? clamp(Number(s.blur) || 0, 0, 40) : 0;
      const sat = active ? clamp(Number(s.saturation) || 0, 0, 1.6) : 0;
      const [c1, c2, c3] = pal.glow;
      const motion = s.motion && active;
      const anim1 = motion ? 'animation: ag-drift-1 26s ease-in-out infinite alternate;' : '';
      const anim2 = motion ? 'animation: ag-drift-2 34s ease-in-out infinite alternate;' : '';

      return [
        `html { background: ${base}; }`,
        `body { background: transparent; }`,
        `body::before, body::after { content: ""; position: fixed; z-index: -1; inset: -15% -10%; pointer-events: none; filter: blur(${blur}px) saturate(${sat}); will-change: transform; backface-visibility: hidden; }`,
        `body::before { background: radial-gradient(42% 42% at 22% 28%, ${c1}, transparent 66%), radial-gradient(46% 46% at 78% 20%, ${c2}, transparent 70%), radial-gradient(54% 54% at 62% 88%, ${c3}, transparent 72%); ${anim1} }`,
        `body::after { opacity: .55; background: radial-gradient(50% 50% at 82% 72%, ${c2}, transparent 66%), radial-gradient(38% 38% at 18% 78%, ${c3}, transparent 68%); ${anim2} transform: translate3d(2%, 3%, 0); }`,
        `@keyframes ag-drift-1 { from { transform: translate3d(-2%, 1%, 0) scale(1); } to { transform: translate3d(3%, -2%, 0) scale(1.07); } }`,
        `@keyframes ag-drift-2 { from { transform: translate3d(2%, 3%, 0) scale(1.06); } to { transform: translate3d(-3%, -1%, 0) scale(.97); } }`,
        `@media (prefers-reduced-motion: reduce) { body::before, body::after { animation: none; } }`,
      ].join('\n');
    }

    /* ------------------------------ styles ------------------------------ */

    const BASE_CSS = `
.ag-root{position:fixed;right:22px;bottom:22px;z-index:30;display:flex;flex-direction:column;align-items:flex-end;gap:12px;font-size:13px;line-height:1.45;font-family:inherit;-webkit-font-smoothing:antialiased;pointer-events:auto}
.ag-root *,.ag-root *::before,.ag-root *::after{box-sizing:border-box}
.ag-glow{display:grid;place-items:center;width:46px;height:46px;padding:0;border-radius:50%;border:1px solid rgba(255,255,255,.22);background:linear-gradient(150deg,rgba(255,255,255,.2),rgba(255,255,255,.05));backdrop-filter:blur(10px) saturate(1.4);-webkit-backdrop-filter:blur(10px) saturate(1.4);color:var(--dsw-alias-label-primary);cursor:pointer;box-shadow:0 10px 28px rgba(4,8,24,.35);transition:transform .4s cubic-bezier(.34,1.56,.64,1),box-shadow .3s}
.ag-glow:hover{transform:scale(1.1) rotate(36deg);box-shadow:0 14px 34px rgba(4,8,24,.45)}
.ag-glow:active{transform:scale(.94)}
.ag-panel{width:302px;padding:16px 16px 14px;border-radius:20px;border:1px solid rgba(255,255,255,.13);background:rgba(16,18,30,.6);backdrop-filter:blur(28px) saturate(1.6);-webkit-backdrop-filter:blur(28px) saturate(1.6);box-shadow:0 24px 64px rgba(2,6,20,.42),0 2px 12px rgba(2,6,20,.28);color:var(--dsw-alias-label-primary);animation:ag-pop .3s cubic-bezier(.34,1.56,.64,1);transform-origin:100% 100%}
@keyframes ag-pop{from{opacity:0;transform:scale(.9) translateY(10px)}to{opacity:1;transform:none}}
.ag-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
.ag-title{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:650;letter-spacing:.2px}
.ag-badge{font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(255,255,255,.09);color:var(--dsw-alias-label-secondary)}
.ag-x{width:26px;height:26px;border-radius:8px;border:none;background:rgba(255,255,255,.07);color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background .15s,color .15s}
.ag-x:hover{background:rgba(255,255,255,.16);color:var(--dsw-alias-label-primary)}
.ag-sec{margin-top:12px}
.ag-sec-label{font-size:11px;color:var(--dsw-alias-label-secondary);letter-spacing:.4px;margin-bottom:6px}
.ag-chips{display:flex;flex-wrap:wrap;gap:6px}
.ag-chip{font-size:12px;padding:4.5px 11px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:all .18s}
.ag-chip:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.ag-chip.on{color:#fff;background:var(--dsw-alias-brand-primary);border-color:transparent}
.ag-swatches{display:flex;gap:8px;align-items:center}
.ag-swatch{width:24px;height:24px;padding:0;border-radius:50%;border:2px solid rgba(255,255,255,.28);cursor:pointer;transition:transform .18s,box-shadow .18s}
.ag-swatch:hover{transform:scale(1.09)}
.ag-swatch.on{transform:scale(1.14);box-shadow:0 0 0 2.5px var(--dsw-alias-brand-primary)}
.ag-ctl{display:flex;align-items:center;gap:10px;margin-top:10px}
.ag-ctl-label{width:64px;font-size:12px;flex:none;color:var(--dsw-alias-label-primary)}
.ag-range{flex:1;min-width:0;accent-color:var(--dsw-alias-brand-primary);cursor:pointer;height:4px}
.ag-val{width:34px;text-align:right;font-size:11px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;flex:none}
.ag-row{display:flex;align-items:center;justify-content:space-between;margin-top:10px;font-size:12px}
.ag-switch{position:relative;width:36px;height:21px;padding:0;border:none;border-radius:999px;background:rgba(255,255,255,.14);cursor:pointer;transition:background .2s}
.ag-switch::after{content:"";position:absolute;top:2.5px;left:2.5px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .22s cubic-bezier(.34,1.56,.64,1)}
.ag-switch.on{background:var(--dsw-alias-brand-primary)}
.ag-switch.on::after{transform:translateX(15px)}
.ag-seg{display:flex;gap:2px;padding:3px;margin-top:6px;background:rgba(255,255,255,.07);border-radius:10px}
.ag-seg-button{flex:1;border:none;background:transparent;color:var(--dsw-alias-label-secondary);font-size:12px;padding:5px 0;border-radius:8px;cursor:pointer;transition:all .18s}
.ag-seg-button:hover{color:var(--dsw-alias-label-primary)}
.ag-seg-button.on{background:rgba(255,255,255,.15);color:var(--dsw-alias-label-primary)}
.ag-reset{margin-top:14px;width:100%;font-size:12px;padding:7px 0;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:all .15s}
.ag-reset:hover{color:var(--dsw-alias-label-primary);background:rgba(255,255,255,.06)}
.ag-action{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:none;border-radius:10px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:color .15s,background .15s,transform .2s}
.ag-action:hover{color:var(--dsw-alias-label-primary);background:rgba(255,255,255,.08)}
.ag-action:active{transform:scale(.92)}
.ag-action.on{color:var(--dsw-alias-brand-primary)}
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

    function FloatingButton({ store, t }) {
      const [open, setOpen] = useState(false);
      return h('div', { className: 'ag-root' },
        open ? h(Panel, { store, t, onClose: () => setOpen(false) }) : null,
        h('button', {
          type: 'button', className: 'ag-glow',
          title: t('panel.toggle'), 'aria-label': t('panel.toggle'),
          onClick: () => setOpen((v) => !v),
        }, h(Sparkle, { size: 22 })));
    }

    function MasterToggle({ store, t }) {
      const st = useSyncExternalStore(store.subscribe, store.get);
      const on = st.enabled;
      return h('button', {
        type: 'button', className: 'ag-action' + (on ? ' on' : ''),
        title: on ? t('master.off') : t('master.on'),
        'aria-label': on ? t('master.off') : t('master.on'),
        'aria-pressed': on,
        onClick: () => store.update({ enabled: !on }),
      }, h(Sparkle, { size: 15 }));
    }

    function Panel({ store, t, onClose }) {
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
            h('span', { className: 'ag-badge' }, 'v1.0.1')),
          h('button', { type: 'button', className: 'ag-x', 'aria-label': 'Close', onClick: onClose }, '\u2715')),
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
          SwitchRow({ t, label: t('sw.aurora'), on: st.aurora, onToggle: () => set({ aurora: !st.aurora }) }),
          SwitchRow({ t, label: t('sw.motion'), on: st.motion, onToggle: () => set({ motion: !st.motion }) }),
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
        let sheetUndo = null;

        try { sheetUndo = ctx.styles.insert(BASE_CSS); } catch { /* panel renders unstyled */ }

        const rebuild = (tokensOnly) => {
          const s = store.get();
          try {
            if (tokensOnly !== true) {
              if (tokenUndo) { tokenUndo(); tokenUndo = null; }
              const tokens = buildTokens(s);
              if (tokens && theme) tokenUndo = theme.overrideTokens(PACKAGE, tokens);
            }
            if (auraUndo) { auraUndo(); auraUndo = null; }
            if (s.enabled) {
              let scheme = 'dark';
              try { scheme = theme.getTheme().active.colorScheme; } catch { /* default dark */ }
              auraUndo = ctx.styles.insert(buildAuraCss(s, scheme));
            }
          } catch (err) {
            try { console.error('[dsh-aurora-glass] theme apply failed:', err); } catch { /* no console */ }
          }
        };

        rebuild(false);
        const offDeep = store.subscribeDeep(() => rebuild(false));
        // Theme flips (system light/dark) only need the aurora sheet re-rastered;
        // the token layer already carries {light,dark} pairs and re-resolves itself.
        const offTheme = ctx.on('theme/change', () => rebuild(true));

        ctx.slots.inject(OVERLAY_SLOT, () => ctx.slots.register({
          name: OVERLAY_SLOT, id: PACKAGE + '.panel', order: 1000, label: PACKAGE,
        }, () => h(FloatingButton, { store, t })));

        ctx.slots.inject(ACTION_SLOT, () => ctx.slots.register({
          name: ACTION_SLOT, id: PACKAGE + '.toggle', order: 1000, label: PACKAGE,
        }, () => h(MasterToggle, { store, t })));

        try {
          ctx.effect(() => () => {
            offDeep();
            offTheme();
            if (tokenUndo) { tokenUndo(); tokenUndo = null; }
            if (auraUndo) { auraUndo(); auraUndo = null; }
            if (sheetUndo) { sheetUndo(); sheetUndo = null; }
          });
        } catch { /* disposal best-effort */ }
      },
    };
  },
});