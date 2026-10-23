# Aurora Glass · 极光玻璃

> **`dsh-aurora-glass`** — 为 DeepSeek Harness（DSH）打造的全局玻璃拟态 + 极光渐变主题插件。
> A global glassmorphism + aurora theme plugin for DeepSeek Harness (DSH).

![Version](https://img.shields.io/badge/version-1.1.3-8fb0ff) ![License](https://img.shields.io/badge/license-MIT-059669) ![Platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-4763ff) ![Type](https://img.shields.io/badge/type-Cordis%20bundle-7c3aed) ![Dependencies](https://img.shields.io/badge/dependencies-0-0b7bf1)

<!-- SCREENSHOTS: 请在此处粘贴面板/界面截图 -->

> 📷 **截图建议**：① 整体界面（开启 / 关闭对比）；② 右下角 ✦ 星形按钮与控制面板特写；③ 浅色与深色模式各一张。
> 📷 **Screenshot suggestions**: overall UI before/after, the floating ✦ button with the control panel, and one light + one dark capture.

## 目录 / Contents

- [简体中文 (zh-CN)](#简体中文-zh-cn)
- [English](#english)
- [License](#license)

---

## 简体中文 (zh-CN)

### 简介

**dsh-aurora-glass**（显示名 **Aurora Glass / 极光玻璃**，v1.1.3，MIT 许可）是面向 DeepSeek Harness（DSH）的全局美化插件：为整套界面带来玻璃拟态（glassmorphism）+ 极光渐变（aurora glow）主题。视觉风格受 codex 类深色高级设计启发，实现上完全独立原创——不包含、也不依赖任何第三方主题包与资源。

一次启用、全局生效：侧栏、对话区、输入框、弹窗、菜单、设置页共享同一套半透明「玻璃」表面与柔和极光背景；浅色 / 深色模式自动跟随系统，无需任何手动切换。

### 工作原理

1. **直接 token 注入（v1.0.6 起的主路径）**：对 DSH 当前壳的主题实现做过源码级诊断后发现，壳把 `--dsw-alias-*` 别名 token 定义在 `body` / `body[data-ds-dark-theme]` 两级**静态**样式表上（普通优先级），且 Theme 服务的 override 层不会回写到实时 CSS——因此仅写 `:root` 或仅用 `theme.overrideTokens` 在真实界面中都会被 body 级规则压掉。本插件现在直接把解析后的 token 以 `!important` 写到 `body`（浅色块）与 `body[data-ds-dark-theme]`（深色块，复用宿主自带的明暗属性，系统切换零成本自动跟随），并保留 `theme.overrideTokens` 作为标准路径双保险。覆盖的 token：表面 `bg-base` / `bg-layer-1` / `bg-layer-2` / `bg-overlay`、边框 `border-l1` / `border-l2`、侧栏填充 `--dsw-specific-sidebar-fill`、品牌色 `brand-primary`。
2. **纯 CSS 极光背景层**：在 `html` 底色之上，用 `body::before` / `body::after` 两个伪元素绘制多层径向渐变光斑；`position: fixed; z-index: -1` 垫在整个应用下方，`pointer-events: none` 绝不拦截交互。模糊与饱和度经 `filter` 一次性栅格化，动画只使用 `transform`（`translate3d` / `scale`），完全由 GPU 合成，不触发布局。
3. **内建自诊断**：控制面板底部带一行 `CSS L0 ✔/✖` 诊断信息，插件会在运行时实测 `document.body` 的 token 计算样式，若发现注入被壳的更高优先级规则压制，会自动把选择器阶梯升级（`body` → `html body` → `html > body`）直到生效，并在面板中如实显示当前层级与结果。
4. **不改应用结构**：不修改、不注入任何业务组件，所有换肤只发生在 token 层与一个背景样式层，因此整站风格一致、对应用升级友好。
5. **插槽挂载**：控制面板与悬浮按钮挂载于 `shell.overlay` 插槽（带多实例守卫，任何情况下都只渲染一个 ✦ 按钮）。插件由两部分构成：主进程入口（`index.js`，空实现）与客户端模块（`client.js`，承载全部渲染逻辑）。

### 功能特性

| 功能 | 说明 |
| --- | --- |
| 🌐 全局玻璃表面 | 所有界面表面替换为毛玻璃质感，透明度可调（0–100%） |
| ✨ 动态极光背景 | 多层漂移光晕；模糊（0–40px）与色彩饱和度（0–160%）可调，可完全关闭 |
| 🎨 5 套色板 | Aurora 极光 / Ocean 海蓝 / Ember 余烬 / Jade 翡翠 / Mono 黑白 |
| 🧩 4 个预设 | 默认 / 轻雾 / 深空 / 原版观感，一键切换整套参数 |
| 🪶 三级动效 | 动效强度分段（关闭 / 柔和 / 丰富）统一控制极光漂移与按钮呼吸光晕，可随时关闭 |
| 🎞️ 噪点质感 | 细腻胶片颗粒层，为玻璃表面增添高级质感，可开关 |
| 🖲️ 玻璃主题总开关 | 一键启停整套玻璃效果，无需卸载插件 |
| 🔎 内建自诊断 | 面板底部实时显示 token 注入层级与成败（`CSS L0 ✔`），排查"启用后无效果"不再靠猜 |
| 💾 设置持久化 | 所有设置自动保存到 `localStorage`，刷新 / 重启后保持 |
| 🌗 亮暗双模 | light + dark 双套 token 值，自动跟随系统主题 |
| 🌏 中英双语面板 | 面板文字跟随 DSH 界面语言自动切换（中文 / English） |

> **范围说明**：插件只做「皮肤」。控制面板为**近不透明深色高对比设计**（v1.0.2 起修复了透明面板文字难读的问题），含 3 个滑块（玻璃强度 / 模糊 / 色彩）、1 个动效强度分段（关闭 / 柔和 / 丰富）、3 个开关（极光背景 / 噪点质感 / 玻璃主题）、5 个色板圆点、4 个预设按钮、一个「恢复默认设置」按钮与一行 CSS 诊断信息；**没有**键盘快捷键，也**没有**命令行配置或隐藏功能。

### 使用说明

安装并启用后：

1. 界面**右下角**出现一个 ✦ 星形悬浮按钮；点击展开控制面板「极光玻璃 / Aurora Glass」。
2. 面板从上到下依次为：**预设**（默认 / 轻雾 / 深空 / 原版观感）→ **色板**（5 个渐变色圆点）→ **表面滑块**（玻璃强度 / 模糊 / 色彩）→ **氛围**（动效强度分段：关闭 / 柔和 / 丰富；极光背景 / 噪点质感 / 玻璃主题开关）→ **恢复默认设置** → **CSS 诊断行**。
3. 所有改动即时生效并自动保存；刷新页面后设置依然保持。动效强度选「柔和」或「丰富」即可看到极光流动与按钮呼吸光晕（不受系统「减弱动画」设置影响）。

### 安装

#### 方式 A：DSH 应用内「插件管理器」（推荐）

1. 打开 DeepSeek Harness 的**设置**界面，进入**插件（Plugins / Plugin Manager）**。
2. 选择「安装本地目录」并指向本仓库根目录（包含 `package.json` 的目录），或选择「安装发布包」安装打包产物。
3. 在列表中确认 **dsh-aurora-glass**（Aurora Glass / 极光玻璃）已安装并**启用**。
4. bundle 激活支持热生效——首次安装启用**无需重启应用**。

#### 方式 B：pnpm 安装 + cordis.patch.yml

```sh
pnpm add dsh-aurora-glass
```

然后在你的 DSH 配置 `cordis.patch.yml` 中追加：

```yaml
- insert:
    - id: dsh-aurora-glass
      name: dsh-aurora-glass
```

保存后重启或重载 DeepSeek Harness 使补丁生效。

> 💡 版本升级后如果界面没有立刻更新，请**刷新页面**（替换已安装的包需要重新加载新的 JavaScript 模块代次）。若刷新后仍感觉"没有效果"，先看面板右下角的 ✦ 按钮是否存在、面板底部诊断行是否为 `CSS L0 ✔`。
>
> 🛠️ v1.1.0 曾出现过的「启用后完全无效果」问题已根修：旧版本在部分安装路径下会以空配置启动前台面板（视觉层被包裹在错误的条件里）。**v1.1.3 起**面板与全局玻璃层改为独立的注入通道，并内置一次性自愈逻辑（页面空闲隐藏时自动刷新一次，次日首次打开即恢复）。因此：**如果菜单里显示已启用但仍无效果，升级到 v1.1.3+ 后按一次 F5（或重启应用）即可**，无需反复重装。

### 性能表现

- **零第三方依赖**：不含任何运行时依赖，不拖慢应用启动，也不引入供应链风险。
- **轻量体积**：客户端模块约 **31KB** 源码，加载开销可忽略不计。
- **GPU 合成动画**：极光动画仅使用 `transform` / `opacity`；模糊是单次栅格化结果，动画过程中不会重复计算。
- **90ms 重绘节流**：拖动滑块等引发的全局换肤被节流合并，交互流畅不掉帧。
- **动效完全由面板控制**：极光漂移与按钮呼吸光晕只跟随面板「动效强度」（关闭时零动画开销，不随系统动画偏好变化）。
- **无全局 DOM 监听器**：不在 `window` / `document` 上挂任何事件监听，不影响其它插件与宿主应用。

### 免责声明与反馈

这是一个**社区美化插件**：只覆盖主题 token 并注入样式与面板组件，**不修改任何业务逻辑，也不读写任何对话数据**。最坏情况只是外观不符合预期，可随时点击星形开关一键关闭、恢复原版观感。

- 🐛 问题反馈 / 💡 功能建议：请在**本仓库 GitHub Issues** 提交。
- 📖 详细安装 / 卸载 / 升级与故障排查：[docs/INSTALL.md](./docs/INSTALL.md)
- 🗒️ 变更记录：[CHANGELOG.md](./CHANGELOG.md)

---

## English

### Overview

**dsh-aurora-glass** (display name **Aurora Glass / 极光玻璃**, v1.1.3, MIT licensed) is a global beautification plugin for DeepSeek Harness (DSH): it gives the entire UI a glassmorphism + aurora glow theme. The visual style is inspired by codex-style premium dark interfaces, while the implementation is fully original — no third-party theme package or asset is bundled or required.

Enable once, effective everywhere: sidebar, conversation area, composer, popovers, menus and the settings page all share the same translucent "glass" surfaces and a soft aurora backdrop. Light / dark mode follows your system automatically — no manual switching.

### How it works

1. **Direct token injection (main path since v1.0.6)**: a source-level diagnosis of this shell's theme implementation showed that the shell declares its `--dsw-alias-*` tokens on `body` / `body[data-ds-dark-theme]` as **static** stylesheets (normal importance), and the Theme service's override layer is never written back into live CSS — so a `:root`-only injection or `theme.overrideTokens` alone gets overridden at body level in the real UI. The plugin now writes the resolved tokens directly onto `body` (light block) and `body[data-ds-dark-theme]` (dark block, riding the host's own dark-mode attribute so system flips follow automatically), all with `!important`, while keeping `theme.overrideTokens` as a secondary standard path. Tokens covered: surfaces `bg-base` / `bg-layer-1` / `bg-layer-2` / `bg-overlay`, borders `border-l1` / `border-l2`, sidebar fill `--dsw-specific-sidebar-fill` and `brand-primary`.
2. **Pure-CSS aurora layer**: layered radial-gradient blobs are painted with the `body::before` / `body::after` pseudo-elements on top of an `html` base color; `position: fixed; z-index: -1` keeps them beneath the whole app and `pointer-events: none` means they never intercept input. Blur and saturation are rasterized once via `filter`; animations use only `transform` (`translate3d` / `scale`), composited entirely on the GPU with no layout work.
3. **Built-in self-diagnostics**: the panel footer shows a `CSS L0 ✔/✖` line. At runtime the plugin measures the computed token style on `document.body`; if a higher-priority shell rule suppresses the injection, it escalates the selector ladder (`body` → `html body` → `html > body`) until the values land, and reports the current tier and result honestly in the panel.
4. **Zero structural changes**: no business components are modified or injected — all theming lives in a token layer and one background stylesheet, so the look is consistent everywhere and app upgrades stay safe.
5. **Slot mounting**: the control panel and floating button live in the `shell.overlay` slot (guarded against multi-mounts — exactly one ✦ button is ever rendered). The plugin consists of a host entry (`index.js`, a no-op) and a client module (`client.js`) that owns all rendering.

### Features

| Feature | Description |
| --- | --- |
| 🌐 Global glass surfaces | Every surface becomes frosted glass; opacity adjustable (0–100%) |
| ✨ Animated aurora background | Drifting multi-color glow; blur (0–40px) and saturation (0–160%) adjustable, can be turned off |
| 🎨 5 palettes | Aurora / Ocean / Ember / Jade / Mono |
| 🧩 4 presets | Default / Mist / Deep / Original — one click swaps the whole parameter set |
| 🪶 3-level motion | Segmented Motion control (Off / Soft / Rich) drives both the aurora drift and the button halo |
| 🎞️ Film grain | A fine film-grain layer adds subtle premium texture to the glass surfaces; toggleable |
| 🖲️ Master glass toggle | One click to enable/disable the whole glass theme without uninstalling |
| 🔎 Built-in diagnostics | The panel footer live-reports the token-injection tier and result (`CSS L0 ✔`) — no more guessing why "nothing changed" |
| 💾 Persistent settings | Everything is saved to `localStorage` and survives refresh / restart |
| 🌗 Light & dark modes | Paired light + dark token values, automatically following the system theme |
| 🌏 Bilingual panel | Panel text follows the DSH UI language (zh-CN / en) |

> **Scope note**: this plugin is skin-only. The control panel is a **near-opaque dark high-contrast surface** (readability of the semi-transparent panel was fixed in v1.0.2) and contains exactly 3 sliders (Glass / Blur / Color), 1 motion segmented control (Off / Soft / Rich), 3 switches (Aurora glow / Film grain / Glass theme), 5 palette swatches, 4 preset chips, one "Reset to defaults" button and one CSS diagnostic line; there are **no** keyboard shortcuts, **no** CLI configuration and no hidden features.

### Usage

After installing and enabling:

1. A ✦ sparkle button appears at the **bottom-right** corner; click it to open the **Aurora Glass** control panel.
2. The panel contains, top to bottom: **Presets** (Default / Mist / Deep / Original) → **Palette** (5 gradient swatches) → **Surface sliders** (Glass / Blur / Color) → **Atmosphere** (Motion segmented control: Off / Soft / Rich; Aurora glow / Film grain / Glass theme switches) → **Reset to defaults** → **CSS diagnostic line**.
3. Every change applies instantly and is saved automatically; settings persist across page refreshes. Pick "Soft" or "Rich" motion to see the aurora drift and the button halo breathe — independent of the OS "reduce motion" setting.

### Installation

#### Option A: in-app Plugin Manager (recommended)

1. Open DeepSeek Harness **Settings** and go to **Plugins / Plugin Manager**.
2. Choose "install local directory" and point it at this repository root (the folder containing `package.json`), or install the published package.
3. Confirm **dsh-aurora-glass** (Aurora Glass / 极光玻璃) is installed and **enable** it.
4. Bundle activation supports hot loading — the first install needs **no app restart**.

#### Option B: pnpm + cordis.patch.yml

```sh
pnpm add dsh-aurora-glass
```

Then append to your DSH `cordis.patch.yml`:

```yaml
- insert:
    - id: dsh-aurora-glass
      name: dsh-aurora-glass
```

Restart or reload DeepSeek Harness so the patch takes effect.

> 💡 After a **version upgrade**, if the UI hasn't updated, **refresh the page** (replacing an installed package requires loading a fresh JavaScript module generation). If it still looks like "nothing changed", check that the ✦ button is present at the bottom-right and that the panel footer shows `CSS L0 ✔`.

### Performance

- **Zero third-party dependencies**: no runtime dependencies — faster startup, no supply-chain surface.
- **Lightweight**: the client module is about **31KB** of source, a negligible payload.
- **GPU-composited animation**: the aurora animates with `transform` / `opacity` only; the blur is a one-shot raster, never recomputed during animation.
- **90ms repaint throttle**: global re-theming triggered by slider drags is throttled and coalesced — interactions stay smooth.
- **Motion controlled by the panel**: the aurora drift and the button halo follow only the panel's Motion setting (zero animation cost when Off; independent of OS animation preferences).
- **No global DOM listeners**: nothing is attached to `window` / `document`, so other plugins and the host app are unaffected.

### Disclaimer & feedback

This is a **community beautification plugin**: it only overrides theme tokens and injects styles plus panel components — it does **not** modify any business logic and never reads or writes conversation data. In the worst case the look is not to your taste, and one click on the sparkle toggle restores the original appearance.

- 🐛 Bug reports / 💡 feature requests: please open an issue in this repository's **GitHub Issues**.
- 📖 Detailed install / uninstall / upgrade steps and troubleshooting: [docs/INSTALL.md](./docs/INSTALL.md)
- 🗒️ Changelog: [CHANGELOG.md](./CHANGELOG.md)

---

## License

本项目采用 [MIT License](./LICENSE)，完整条款见 [LICENSE](./LICENSE) 文件；版权归 dsh-aurora-glass contributors 所有。

This project is released under the [MIT License](./LICENSE); see the [LICENSE](./LICENSE) file for the full text. Copyright © dsh-aurora-glass contributors.