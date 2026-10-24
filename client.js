/**
 * dsh-aurora-glass — client half (Web UI).
 *
 * v1.2.0 — rebuilt on the contract that actually exists in DSH 0.2.1-rc.2:
 *
 *   • Client modules are lazy CJS: this file only REGISTERS a factory. Every
 *     side effect lives inside the factory and runs at materialization.
 *   • `inject` on the returned exports names CLIENT SERVICES. Naming a service
 *     that does not exist keeps the entry `pending` forever, and the web boot
 *     aborts ("web boot: 1 entry did not activate"). The only service this
 *     plugin truly needs is `slots`; everything else is optional and resolved
 *     defensively.
 *   • `ctx.slots.register({ name, id, order }, Component)` is the real slot
 *     API — `shell.overlay` is a list slot declared by ui-layout.
 *   • Theming is done with plain CSS on <html>/<body>: the shell declares its
 *     alias tokens on `body`, so a `body { --token: x !important }` layer wins
 *     over the platform sheet, and `body[data-ds-dark-theme]` (the host's own
 *     dark attribute) carries the dark values.
 *
 * Hard rule for this file: nothing may throw out of `apply`. A thrown error
 * marks the fiber `failed` and the whole application refuses to start, which
 * is exactly the failure this rewrite exists to prevent.
 */

window.__ModuleLoader__.load({
  id: 'dsh-aurora-glass',
  factory(require) {
    'use strict';

    // Last-resort guard: a module that cannot even materialize would mark the
    // entry `failed`, and a failed client entry aborts the whole web boot.
    // Returning an inert plugin instead keeps the application usable.
    const INERT = { name: 'dsh-aurora-glass', inject: [], apply() {} };
    let React = null;
    try {
      React = require('react');
    } catch (err) {
      try {
        console.warn('[dsh-aurora-glass] react unavailable, plugin disabled:', err);
      } catch {
        /* no console */
      }
      return INERT;
    }

    const h = React.createElement;
    const { useState, useEffect, useSyncExternalStore } = React;

    const PKG = 'dsh-aurora-glass';
    const VERSION = '1.2.0';
    const STORAGE_KEY = 'dsh-aurora-glass:settings:v2';
    const THEME_STYLE_ID = 'dsh-aurora-glass-theme';
    const UI_STYLE_ID = 'dsh-aurora-glass-ui';

    /* ------------------------------------------------------------------ *
     * palettes & presets
     * ------------------------------------------------------------------ */

    const PALETTES = [
      {
        id: 'aurora',
        label: 'Aurora',
        brand: { light: '#4763ff', dark: '#8fb0ff' },
        glow: ['rgba(96,126,255,.92)', 'rgba(168,85,247,.8)', 'rgba(236,72,153,.66)'],
      },
      {
        id: 'ocean',
        label: 'Ocean',
        brand: { light: '#0b7bf1', dark: '#7cc4ff' },
        glow: ['rgba(34,211,238,.86)', 'rgba(59,130,246,.8)', 'rgba(16,185,129,.6)'],
      },
      {
        id: 'ember',
        label: 'Ember',
        brand: { light: '#ea580c', dark: '#ffb27d' },
        glow: ['rgba(251,146,60,.86)', 'rgba(244,63,94,.76)', 'rgba(217,70,239,.6)'],
      },
      {
        id: 'jade',
        label: 'Jade',
        brand: { light: '#059669', dark: '#6ee7b7' },
        glow: ['rgba(52,211,153,.82)', 'rgba(45,212,191,.74)', 'rgba(56,189,248,.58)'],
      },
      {
        id: 'mono',
        label: 'Mono',
        brand: { light: '#4b5563', dark: '#cbd5e1' },
        glow: ['rgba(148,163,184,.7)', 'rgba(203,213,225,.56)', 'rgba(99,102,241,.44)'],
      },
    ];

    const PRESETS = [
      { id: 'default', key: 'preset.default', set: { glass: 0.78, blur: 30, saturation: 1.15, motion: 'soft', aurora: true, grain: true } },
      { id: 'mist', key: 'preset.mist', set: { glass: 0.9, blur: 44, saturation: 0.8, motion: 'off', aurora: true, grain: true } },
      { id: 'depth', key: 'preset.depth', set: { glass: 0.5, blur: 18, saturation: 1.35, motion: 'full', aurora: true, grain: true } },
      { id: 'pure', key: 'preset.pure', set: { glass: 0, blur: 0, saturation: 1, motion: 'off', aurora: false, grain: false } },
    ];

    const DEFAULT_SETTINGS = {
      enabled: true,
      preset: 'default',
      palette: 'aurora',
      glass: 0.78,
      blur: 30,
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
        'ctl.blur': '光晕',
        'ctl.saturation': '色彩',
        'seg.motion.off': '关闭',
        'seg.motion.soft': '柔和',
        'seg.motion.full': '丰富',
        'ctl.motion': '动效',
        'sw.aurora': '极光背景',
        'sw.grain': '噪点质感',
        'sw.enabled': '玻璃主题',
        'reset': '恢复默认设置',
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
     * settings store (single instance per page)
     * ------------------------------------------------------------------ */

    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
    const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
    const rgba = (r, g, b, a) => `rgba(${r},${g},${b},${clamp(a, 0, 1).toFixed(3)})`;
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

    function createStore() {
      let state = loadSettings();
      const listeners = new Set();
      return {
        get: () => state,
        set(patch) {
          state = { ...state, ...patch };
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          } catch {
            /* storage unavailable — settings stay in memory */
          }
          listeners.forEach((fn) => {
            try {
              fn();
            } catch {
              /* a listener must never break an update */
            }
          });
        },
        subscribe(fn) {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
      };
    }

    const store = createStore();

    /* ------------------------------------------------------------------ *
     * CSS builders
     * ------------------------------------------------------------------ */

    // Alias tokens the shell declares on `body`. Re-pointing them is enough to
    // restyle every surface at once, with no knowledge of the hashed classes.
    function tokenMap(s, dark) {
      const pal = paletteOf(s.palette);
      const g = clamp(s.glass, 0, 1);
      if (dark) {
        return {
          '--dsw-alias-bg-base': rgba(11, 13, 22, 0.8 - 0.36 * g),
          '--dsw-alias-bg-layer-1': rgba(255, 255, 255, 0.08 + 0.06 * g),
          '--dsw-alias-bg-layer-2': rgba(255, 255, 255, 0.11 + 0.07 * g),
          '--dsw-alias-bg-layer-3': rgba(255, 255, 255, 0.14 + 0.08 * g),
          '--dsw-alias-bg-overlay': rgba(12, 14, 24, 0.97 - 0.12 * g),
          '--dsw-alias-bg-module-platform': rgba(255, 255, 255, 0.07 + 0.05 * g),
          '--dsw-alias-bg-multi-select': rgba(255, 255, 255, 0.1 + 0.05 * g),
          '--dsw-alias-border-l1': rgba(255, 255, 255, 0.12 + 0.06 * g),
          '--dsw-alias-border-l2': rgba(255, 255, 255, 0.09 + 0.04 * g),
          '--dsw-alias-border-l3': rgba(255, 255, 255, 0.15 + 0.06 * g),
          '--dsw-alias-border-l4': rgba(255, 255, 255, 0.19 + 0.07 * g),
          '--dsw-specific-sidebar-fill': rgba(255, 255, 255, 0.03 + 0.03 * g),
          '--dsw-alias-brand-primary': pal.brand.dark,
        };
      }
      return {
        '--dsw-alias-bg-base': rgba(247, 249, 254, 0.95 - 0.26 * g),
        '--dsw-alias-bg-layer-1': rgba(255, 255, 255, 0.7 + 0.22 * g),
        '--dsw-alias-bg-layer-2': rgba(255, 255, 255, 0.8 + 0.16 * g),
        '--dsw-alias-bg-layer-3': rgba(255, 255, 255, 0.9 + 0.08 * g),
        '--dsw-alias-bg-overlay': rgba(252, 253, 255, 0.97 - 0.06 * g),
        '--dsw-alias-bg-module-platform': rgba(255, 255, 255, 0.66 + 0.26 * g),
        '--dsw-alias-bg-multi-select': rgba(255, 255, 255, 0.7 + 0.22 * g),
        '--dsw-alias-border-l1': rgba(15, 23, 42, 0.11),
        '--dsw-alias-border-l2': rgba(15, 23, 42, 0.08),
        '--dsw-alias-border-l3': rgba(15, 23, 42, 0.13),
        '--dsw-alias-border-l4': rgba(15, 23, 42, 0.17),
        '--dsw-specific-sidebar-fill': rgba(255, 255, 255, 0.45 + 0.3 * g),
        '--dsw-alias-brand-primary': pal.brand.light,
      };
    }

    const GRAIN =
      'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27140%27 height=%27140%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%272%27 stitchTiles=%27stitch%27/%3E%3CfeColorMatrix type=%27saturate%27 values=%270%27/%3E%3C/filter%3E%3Crect width=%27140%27 height=%27140%27 filter=%27url(%23n)%27 opacity=%270.55%27/%3E%3C/svg%3E")';

    function buildCss(s) {
      const pal = paletteOf(s.palette);
      const g = clamp(s.glass, 0, 1);
      const on = !!s.enabled;
      const aura = on && !!s.aurora;
      const blur = aura ? clamp(s.blur, 0, 60) : 0;
      const sat = aura ? clamp(s.saturation, 0, 2) : 1;
      const [c1, c2, c3] = pal.glow;
      const light = tokenMap(s, false);
      const dark = tokenMap(s, true);
      const emit = (map) =>
        Object.keys(map)
          .map((k) => `  ${k}: ${map[k]} !important;`)
          .join('\n');

      const motion = aura ? s.motion : 'off';
      const drift =
        motion === 'off'
          ? ''
          : `animation: ag-drift ${motion === 'full' ? '16s' : '30s'} ease-in-out infinite alternate;`;

      const auroraLayer = aura
        ? `body::before{
  content:""; position:fixed; inset:0; z-index:-1; pointer-events:none;
  background:
    radial-gradient(42% 46% at 8% 0%, ${c1}, transparent 70%),
    radial-gradient(36% 40% at 96% 4%, ${c2}, transparent 72%),
    radial-gradient(46% 44% at 68% 104%, ${c3}, transparent 74%),
    radial-gradient(60% 55% at 42% 46%, ${c1}, transparent 86%);
  filter: blur(${blur}px) saturate(${sat});
  opacity: ${0.72 + 0.28 * g};
  transform: translate3d(0,0,0);
  ${drift}
}`
        : 'body::before{ content:none !important; }';

      const grainLayer =
        on && s.grain
          ? `body::after{
  content:""; position:fixed; inset:0; z-index:-1; pointer-events:none;
  background-image: ${GRAIN}, radial-gradient(130% 110% at 50% -10%, transparent 54%, ${rgba(24, 32, 54, 0.16)});
  background-size: 140px 140px, auto;
  opacity: ${0.55 + 0.2 * g};
}`
          : 'body::after{ content:none !important; }';

      const darkBase = paletteOf(s.palette).id === 'mono' ? '#08090f' : '#060810';
      const lightBase = '#eef2f9';

      return `/* ${PKG} v${VERSION} */
html{
  background-color: ${lightBase} !important;
  background-image: none !important;
}
html:has(body[data-ds-dark-theme]){
  background-color: ${darkBase} !important;
}
body{
  background: transparent !important;
  background-color: transparent !important;
}
${auroraLayer}
${grainLayer}
@keyframes ag-drift{
  from{ transform: translate3d(-2%, 1.5%, 0) scale(1.06); }
  to{ transform: translate3d(2.5%, -2%, 0) scale(1.16); }
}
/* light scheme */
body{
${emit(light)}
}
/* dark scheme — the host's own attribute, so no re-injection is needed */
body[data-ds-dark-theme]{
${emit(dark)}
}
body[data-ds-dark-theme]::after{
  background-image: ${GRAIN}, radial-gradient(130% 110% at 50% -10%, transparent 50%, ${rgba(0, 0, 0, 0.55)});
}
`;
    }

    const UI_CSS = `
.ag-root{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-end;gap:12px;font-size:13px;line-height:1.45;font-family:inherit;-webkit-font-smoothing:antialiased;pointer-events:auto}
.ag-root *,.ag-root *::before,.ag-root *::after{box-sizing:border-box}
.ag-glow{position:relative;overflow:hidden;display:grid;place-items:center;width:46px;height:46px;padding:0;border-radius:50%;border:1px solid rgba(255,255,255,.26);background:linear-gradient(150deg,rgba(255,255,255,.24),rgba(255,255,255,.06));backdrop-filter:blur(14px) saturate(1.6);-webkit-backdrop-filter:blur(14px) saturate(1.6);color:#eef2ff;cursor:pointer;box-shadow:0 10px 28px rgba(4,8,24,.42);transition:transform .4s cubic-bezier(.34,1.56,.64,1),box-shadow .3s}
.ag-glow:hover{transform:scale(1.08) rotate(30deg);box-shadow:0 14px 34px rgba(4,8,24,.52),0 0 0 6px rgba(143,176,255,.14)}
.ag-glow:active{transform:scale(.94)}
.ag-glow::after{content:"";position:absolute;inset:0;border-radius:50%;background:linear-gradient(115deg,transparent 32%,rgba(255,255,255,.32) 50%,transparent 66%);transform:translateX(-130%)}
.ag-glow:hover::after{animation:ag-shine .85s ease}
@keyframes ag-shine{from{transform:translateX(-130%)}to{transform:translateX(130%)}}
.ag-glow.ag-anim{animation:ag-halo 3.6s ease-in-out infinite}
.ag-glow.ag-anim:hover{animation:none}
@keyframes ag-halo{0%,100%{box-shadow:0 10px 28px rgba(4,8,24,.42),0 0 0 0 rgba(143,176,255,0)}50%{box-shadow:0 10px 28px rgba(4,8,24,.42),0 0 0 8px rgba(143,176,255,.15)}}
.ag-panel{width:312px;padding:16px 16px 14px;border-radius:20px;border:1px solid rgba(255,255,255,.16);background:rgba(14,16,27,.96);backdrop-filter:blur(26px) saturate(1.5);-webkit-backdrop-filter:blur(26px) saturate(1.5);box-shadow:0 24px 64px rgba(2,6,20,.58),0 2px 12px rgba(2,6,20,.35);color:#e8ecf8;animation:ag-pop .28s cubic-bezier(.34,1.56,.64,1);transform-origin:100% 100%}
@keyframes ag-pop{from{opacity:0;transform:scale(.92) translateY(10px)}to{opacity:1;transform:none}}
.ag-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:2px}
.ag-title{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:700;letter-spacing:.2px;color:#f2f5fd}
.ag-badge{font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(255,255,255,.12);color:#aab3cc;font-weight:500}
.ag-x{width:26px;height:26px;border-radius:8px;border:none;background:rgba(255,255,255,.09);color:#aab3cc;cursor:pointer;transition:background .15s,color .15s;font-size:12px;line-height:1}
.ag-x:hover{background:rgba(255,255,255,.2);color:#f2f5fd}
.ag-sec{margin-top:13px}
.ag-sec-label{font-size:10.5px;color:#8d97b2;letter-spacing:.8px;margin-bottom:7px;text-transform:uppercase}
.ag-chips{display:flex;flex-wrap:wrap;gap:6px}
.ag-chip{font-size:12px;font-weight:500;padding:5px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#c6cfe4;cursor:pointer;transition:all .18s}
.ag-chip:hover{color:#f2f5fd;border-color:rgba(255,255,255,.32)}
.ag-chip.on{color:#fff;background:var(--dsw-alias-brand-primary,#4763ff);border-color:transparent}
.ag-swatches{display:flex;gap:10px;align-items:center}
.ag-swatch{width:24px;height:24px;padding:0;border-radius:50%;border:2px solid rgba(255,255,255,.34);cursor:pointer;transition:transform .18s,box-shadow .18s}
.ag-swatch:hover{transform:scale(1.09)}
.ag-swatch.on{transform:scale(1.14);box-shadow:0 0 0 2.5px rgba(242,245,253,.92)}
.ag-ctl{display:flex;align-items:center;gap:10px;margin-top:11px}
.ag-ctl-label{width:62px;font-size:12px;flex:none;color:#dbe2f2}
.ag-range{flex:1;min-width:0;accent-color:var(--dsw-alias-brand-primary,#4763ff);cursor:pointer;height:4px}
.ag-val{width:38px;text-align:right;font-size:11px;color:#aab3cc;font-variant-numeric:tabular-nums;flex:none}
.ag-row{display:flex;align-items:center;justify-content:space-between;margin-top:11px;font-size:12.5px;color:#e8ecf8}
.ag-switch{position:relative;width:36px;height:21px;padding:0;border:none;border-radius:999px;background:rgba(255,255,255,.18);cursor:pointer;transition:background .2s;flex:none}
.ag-switch::after{content:"";position:absolute;top:2.5px;left:2.5px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .22s cubic-bezier(.34,1.56,.64,1)}
.ag-switch.on{background:var(--dsw-alias-brand-primary,#4763ff)}
.ag-switch.on::after{transform:translateX(15px)}
.ag-seg{display:flex;gap:2px;padding:3px;background:rgba(255,255,255,.08);border-radius:10px}
.ag-seg-button{flex:1;border:none;background:transparent;color:#aab3cc;font-size:12px;padding:5px 0;border-radius:8px;cursor:pointer;transition:all .18s}
.ag-seg-button:hover{color:#f2f5fd}
.ag-seg-button.on{background:rgba(255,255,255,.17);color:#f2f5fd}
.ag-reset{margin-top:14px;width:100%;font-size:12px;padding:7.5px 0;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);color:#c6cfe4;cursor:pointer;transition:all .15s}
.ag-reset:hover{color:#f2f5fd;background:rgba(255,255,255,.1)}
.ag-foot{margin-top:10px;font-size:10.5px;color:#6f7891;text-align:center;letter-spacing:.3px}
`;

    /* ------------------------------------------------------------------ *
     * style injection
     * ------------------------------------------------------------------ */

    function upsertStyle(id, css) {
      const doc = typeof document !== 'undefined' ? document : null;
      if (!doc || !doc.head) return null;
      let el = doc.getElementById(id);
      if (!el) {
        el = doc.createElement('style');
        el.id = id;
        el.setAttribute('data-dsh-aurora-glass', '1');
        doc.head.appendChild(el);
      }
      if (el.textContent !== css) el.textContent = css;
      return el;
    }

    function removeStyle(id) {
      const doc = typeof document !== 'undefined' ? document : null;
      if (!doc) return;
      const el = doc.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    /* ------------------------------------------------------------------ *
     * components
     * ------------------------------------------------------------------ */

    function Sparkle({ size = 22 }) {
      return h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', style: { display: 'block' } },
        h('path', {
          d: 'M12 2c.6 4.8 2.4 7.6 8 8-5.6.4-7.4 3.2-8 8-.6-4.8-2.4-7.6-8-8 5.6-.4 7.4-3.2 8-8Z',
          fill: 'currentColor',
        }),
      );
    }

    function Slider({ label, value, min, max, step, fmt, onChange }) {
      return h(
        'label',
        { className: 'ag-ctl' },
        h('span', { className: 'ag-ctl-label' }, label),
        h('input', {
          type: 'range',
          className: 'ag-range',
          min,
          max,
          step,
          value,
          onChange: (e) => onChange(Number(e.target.value)),
        }),
        h('span', { className: 'ag-val' }, fmt(value)),
      );
    }

    function SwitchRow({ label, on, onToggle }) {
      return h(
        'div',
        { className: 'ag-row' },
        h('span', null, label),
        h('button', {
          type: 'button',
          className: 'ag-switch' + (on ? ' on' : ''),
          role: 'switch',
          'aria-checked': on,
          'aria-label': label,
          onClick: onToggle,
        }),
      );
    }

    function Panel({ onClose }) {
      const s = useSyncExternalStore(store.subscribe, store.get);
      const set = (patch) => store.set(patch);
      const pickPreset = (id) => {
        const preset = PRESETS.filter((p) => p.id === id)[0];
        if (preset) set({ preset: preset.id, ...preset.set });
      };

      useEffect(() => {
        const onKey = (e) => {
          if (e.key === 'Escape') onClose();
        };
        try {
          document.addEventListener('keydown', onKey);
        } catch {
          /* no document */
        }
        return () => {
          try {
            document.removeEventListener('keydown', onKey);
          } catch {
            /* no document */
          }
        };
      }, []);

      return h(
        'section',
        { className: 'ag-panel', role: 'dialog', 'aria-label': t('panel.title') },
        h(
          'div',
          { className: 'ag-head' },
          h('div', { className: 'ag-title' }, h(Sparkle, { size: 18 }), t('panel.title'), h('span', { className: 'ag-badge' }, 'v' + VERSION)),
          h('button', { type: 'button', className: 'ag-x', 'aria-label': t('close'), onClick: onClose }, '\u2715'),
        ),
        h(
          'div',
          { className: 'ag-sec' },
          h('div', { className: 'ag-sec-label' }, t('sec.preset')),
          h(
            'div',
            { className: 'ag-chips' },
            PRESETS.map((p) =>
              h(
                'button',
                {
                  key: p.id,
                  type: 'button',
                  className: 'ag-chip' + (s.preset === p.id ? ' on' : ''),
                  onClick: () => pickPreset(p.id),
                },
                t(p.key),
              ),
            ),
          ),
        ),
        h(
          'div',
          { className: 'ag-sec' },
          h('div', { className: 'ag-sec-label' }, t('sec.palette')),
          h(
            'div',
            { className: 'ag-swatches' },
            PALETTES.map((p) =>
              h('button', {
                key: p.id,
                type: 'button',
                className: 'ag-swatch' + (s.palette === p.id ? ' on' : ''),
                title: p.label,
                'aria-label': p.label,
                style: { background: `linear-gradient(135deg, ${p.glow.join(', ')})` },
                onClick: () => set({ palette: p.id }),
              }),
            ),
          ),
        ),
        h(
          'div',
          { className: 'ag-sec' },
          h('div', { className: 'ag-sec-label' }, t('sec.surface')),
          h(Slider, {
            label: t('ctl.glass'),
            value: s.glass,
            min: 0,
            max: 1,
            step: 0.05,
            fmt: (v) => Math.round(v * 100) + '%',
            onChange: (v) => set({ glass: v }),
          }),
          h(Slider, {
            label: t('ctl.blur'),
            value: s.blur,
            min: 0,
            max: 60,
            step: 2,
            fmt: (v) => Math.round(v) + 'px',
            onChange: (v) => set({ blur: v }),
          }),
          h(Slider, {
            label: t('ctl.saturation'),
            value: s.saturation,
            min: 0,
            max: 2,
            step: 0.05,
            fmt: (v) => Math.round(v * 100) + '%',
            onChange: (v) => set({ saturation: v }),
          }),
        ),
        h(
          'div',
          { className: 'ag-sec' },
          h('div', { className: 'ag-sec-label' }, t('sec.look')),
          h(
            'div',
            { className: 'ag-row', style: { marginTop: 0 } },
            h('span', null, t('ctl.motion')),
            h(
              'div',
              { className: 'ag-seg', style: { width: 152 } },
              ['off', 'soft', 'full'].map((lv) =>
                h(
                  'button',
                  {
                    key: lv,
                    type: 'button',
                    className: 'ag-seg-button' + (s.motion === lv ? ' on' : ''),
                    onClick: () => set({ motion: lv }),
                  },
                  t('seg.motion.' + lv),
                ),
              ),
            ),
          ),
          h(SwitchRow, { label: t('sw.aurora'), on: s.aurora, onToggle: () => set({ aurora: !s.aurora }) }),
          h(SwitchRow, { label: t('sw.grain'), on: s.grain, onToggle: () => set({ grain: !s.grain }) }),
          h(SwitchRow, { label: t('sw.enabled'), on: s.enabled, onToggle: () => set({ enabled: !s.enabled }) }),
        ),
        h('button', { type: 'button', className: 'ag-reset', onClick: () => set({ ...DEFAULT_SETTINGS }) }, t('reset')),
        h('div', { className: 'ag-foot' }, 'Aurora Glass · ' + VERSION),
      );
    }

    function Launcher() {
      const [open, setOpen] = useState(false);
      const s = useSyncExternalStore(store.subscribe, store.get);
      return h(
        'div',
        { className: 'ag-root' },
        open ? h(Panel, { onClose: () => setOpen(false) }) : null,
        h(
          'button',
          {
            type: 'button',
            className: 'ag-glow' + (s.enabled && s.motion !== 'off' ? ' ag-anim' : ''),
            title: t('panel.toggle'),
            'aria-label': t('panel.toggle'),
            onClick: () => setOpen((v) => !v),
          },
          h(Sparkle, { size: 22 }),
        ),
      );
    }

    /* ------------------------------------------------------------------ *
     * plugin
     * ------------------------------------------------------------------ */

    return {
      name: PKG,
      // `slots` is the one client service this plugin genuinely needs; it is
      // provided by the shell before any plugin applies, so the entry can
      // never sit in `pending`. Everything else is optional.
      inject: ['slots'],
      apply(ctx) {
        try {
          upsertStyle(UI_STYLE_ID, UI_CSS);

          const paint = () => {
            try {
              const s = store.get();
              if (!s.enabled) {
                removeStyle(THEME_STYLE_ID);
                return;
              }
              upsertStyle(THEME_STYLE_ID, buildCss(s));
            } catch (err) {
              try {
                console.warn('[dsh-aurora-glass] paint failed:', err);
              } catch {
                /* no console */
              }
            }
          };

          paint();
          const off = store.subscribe(paint);

          // Floating settings button. `shell.overlay` is a list slot declared
          // by ui-layout; register() is the real API (there is no `inject()`
          // method on the slots service).
          let disposeSlot = null;
          try {
            const slots = (ctx && ctx.slots) || (ctx && typeof ctx.get === 'function' ? ctx.get('slots') : null);
            if (slots && typeof slots.register === 'function') {
              const handle = slots.register({ name: 'shell.overlay', id: PKG, order: 1000 }, Launcher);
              if (typeof handle === 'function') disposeSlot = handle;
              else if (handle && typeof handle.then === 'function') {
                handle.then(
                  (fn) => {
                    if (typeof fn === 'function') disposeSlot = fn;
                  },
                  () => {},
                );
              }
            }
          } catch (err) {
            try {
              console.warn('[dsh-aurora-glass] slot register failed:', err);
            } catch {
              /* no console */
            }
          }

          const teardown = () => {
            try {
              off();
            } catch {
              /* already gone */
            }
            try {
              if (disposeSlot) disposeSlot();
            } catch {
              /* already gone */
            }
            removeStyle(THEME_STYLE_ID);
            removeStyle(UI_STYLE_ID);
          };

          try {
            if (ctx && typeof ctx.effect === 'function') ctx.effect(() => teardown);
            else if (typeof window !== 'undefined') window.addEventListener('beforeunload', teardown);
          } catch {
            /* disposal is best-effort */
          }
        } catch (err) {
          // Never let a styling plugin abort the whole web boot.
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
