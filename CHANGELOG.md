# Changelog

本文件记录 dsh-aurora-glass 的重要变更，采用简易维护格式（Keep a Changelog 风格）。
All notable changes to dsh-aurora-glass, in a simple maintenance format (Keep a Changelog style).

## [1.4.0] - 2026-10-24

### Fixed

- **卡顿**：v1.3 在极光容器上挂了全屏 `hue-rotate` 动画，容器里三个视口大小的图层每帧都要重新过滤一遍，这是"调滑杆不跟手 + 整个软件卡"的根因。现在容器上没有任何 filter，三团极光各自带 `blur()/saturate()`，内容不变、只有 `transform` 在动，浏览器只需烘焙一次滤镜，位移全部交给合成器。
- **滑杆抖动**：`--ag-blur` / `--ag-sat` 每次 `input` 都会让三个大图层重新过滤。改成拖动时只更新数字，松手（`change`）才提交；`--ag-g` 仍然实时，因为它只改 token 的 alpha（样式重算，不重绘大图层）。
- **写入合并**：所有 CSS 变量写入合并到一个 `requestAnimationFrame`，并且只写真正变化的那个值。
- **面板看不清字**：面板底色从 96% 提到 98.5%–99%，标签/数值对比度整体上调，分区之间加了分隔线；宿主对话框的 `--dsw-alias-bg-overlay` 也提到 98.5%，设置页不再透出背景。
- 输入框 `backdrop-filter` 从 20px 降到 14px（滚动时重新模糊的面积更小）。

### Changed

- 控件回到**右下角**（`right:16px; bottom:80px`），仍然挂在 `document.body` 上、`z-index: 2147483647`，不会被任何插件的浮层盖住。
- 极光动画改成**闭环漂移**（19s / 24s / 30s，带负延迟错峰），不再是来回摆动的 `alternate`，看起来像真的在流。丰富档 10s / 13s / 16s。

### Added

- 指针视差：鼠标移动时整层极光反向偏移最多 16px，一帧一次 `transform`，纯合成器开销。
- 面板微交互：打开时整体弹性缩放 + 分区依次上浮（20–120ms 错峰）、顶边一道高光、chip 按压回弹、色板选中双层光环、开关拖拽时滑块轻微拉伸、重置按钮文字临时变成"已恢复默认"。

## [1.3.0] - 2026-10-24

### Changed

- **控件位置**：从右下角移到**左下角头像正上方**（`left:10px; bottom:184px`），缩成 34px 小圆钮，平时半透明，鼠标移上去才完全显形。
- **最上层**：控件不再是插槽里的 React 节点，而是直接挂在 `document.body` 上的独立浮层，`z-index: 2147483647`，任何插件的 overlay 都盖不住它。
- **零依赖**：`inject: []`，不再依赖 `slots` / `theme` / `react`。整个 UI 是原生 DOM，模块体里没有任何可能抛错的东西。
- **背景真的在流动**：三团极光（`#dsh-ag-bg i`）各自以 34s / 44s / 54s 的节奏漂移 + 缩放，外加 72s 的 `hue-rotate` 色相往返，颜色会缓慢游走而不是静止。动效三档可切（关闭 / 柔和 / 丰富）。
- **滑杆改成写 CSS 变量**：`--ag-g / --ag-blur / --ag-sat`，token 层的 alpha 用 `rgb(… / calc(… * var(--ag-g)))` 计算。拖滑杆不再重建样式表，跟手。
- **对话框毛玻璃**：`[class*="composerHero"] [class$="_card"]` 加 `backdrop-filter: blur(20px)`、半透明底、内高光和聚焦光圈；输入框下方的渐隐也按主题重算。
- 新增一层 scrim（暗色 26–40% / 浅色 8–18%），压住极光亮度，保证正文对比度。

### Added

- 面板关闭方式：点按钮、点面板外、按 Esc。

## [1.2.0] - 2026-10-24

### Fixed (critical)

- **`store` 未定义导致插件激活抛错，整个应用无法启动**：v1.1.0 重写时删掉了 `const store = createStore()`，`apply()` 第一行 `rebuild(false)` 里 `store.get()` 直接抛 `ReferenceError`。客户端条目因此变成 `failed`，DSH 的 web boot 把"任一客户端条目未激活"当成致命错误，于是弹出"应用无法启动或已意外停止"。这是"装上没效果 + 一直报错"的直接原因。
- **`inject: ['styles']` 声明了不存在的服务**：客户端 `inject` 只能写真实存在的客户端服务，否则条目永远停在 `pending`（错误信息 `waiting for service: styles`）。现在只声明 `slots`，其余全部可选。
- **插槽注册 API 用错**：`ctx.slots` 没有 `inject()` 方法（那是旧版 API），正确写法是 `ctx.slots.register({ name: 'shell.overlay', id, order }, Component)`。原来那段被 try/catch 静默吞掉，所以悬浮按钮从来没出现过。

### Changed

- 客户端半侧重写：去掉宿主 RPC 上报、隐藏页自愈刷新、`styles` 服务探测等全部调试代码，只保留"注入样式 + 挂一个悬浮按钮"。
- 宿主半侧（`index.js`）清空为一个空的 `apply()`：主题完全在浏览器侧实现，宿主侧不再注册路由、不再写文件、不再有任何可能失败的动作。
- 主题改为纯 CSS token 层：`body { --dsw-alias-* }` + `body[data-ds-dark-theme]`，深浅色切换无需重新注入；`html:has(body[data-ds-dark-theme])` 负责画布底色。
- 极光层重新调色：三团角落光晕 + 一层淡中心光，透明度、模糊、饱和都随面板滑杆实时变化。
- 面板重做：预设 / 色板 / 表面 / 氛围四段，动效三档，设置存 `localStorage`（键 `dsh-aurora-glass:settings:v2`）。
- `package.json` 版本 1.2.0；`dsh.client.inject` 为空数组。

### Added

- `tools/dsh-aurora-toggle.ps1`：只开关本插件（写 `- id: dsh-aurora-glass / disabled: true` 到 profile patch），不会再出现"点禁用，所有插件一起消失"的情况。

## [1.1.4] - 2026-10-24

### Fixed (critical)

- **修复客户端注入依赖声明导致整个 Web 界面无法启动的问题**：v1.1.2 / v1.1.3 的客户端模块把并不存在的 `styles`（以及 `locale`）服务写进了 `inject` 依赖声明。客户端加载器会一直等待从未注册的服务，本插件永远停在 `pending`，页面启动直接失败（错误屏幕："web boot: 1 entry did not activate — dsh-aurora-glass: pending (waiting for service: styles)"）。v1.1.4 只声明真实存在的服务（`slots`、`theme`），其余服务一律在运行时 `ctx.get` 取用，取不到时安全降级。
- **样式注入永不阻塞**：`styles` 服务不可用时，全部样式改由直接把 `<style>` 元素注入 `document.head` 完成（可清理），彻底消除"注入失败"的可能。
- 面板徽标、自检上报、注释中的版本号同步升级到 1.1.4。

## [1.1.3] - 2026-10-24

### Fixed

- **样式注入通道修复**：主题 CSS 的注入统一走 `ctx.get('styles')` 服务（对宿主做安全兜底），彻底修复特殊宿主导入顺序下样式表无法写入（面板、按钮、极光不可见）的问题。
- 延迟调度改为"原生定时器优先"（`globalThis.setTimeout` 兜底），页面隐藏时设置节流仍然工作。

### Added

- **同步运行时自检**：每次页面加载都会同步写入 Local Storage 自检数据（token 计算值、样式表数量、面板/按钮挂载情况），即使页面隐藏/锁屏也可通过本地存储核查真实注入状态。
- 隐藏页面一次性自愈刷新：若页面在隐藏态第一次加载到本版修复，会延迟自动刷新一次以完整装载最新资源（标记防循环，仅限首次）。

## [1.1.2] - 2026-10-24

### Fixed

- `dsh` 上下文的 `styles` 服务改为动态解析访问（同时兼容直接注入与 `ctx.get` 两种取法），避免访问器报错导致样式注入整体失败。

## [1.1.1] - 2026-10-24

### Changed

- 运行时上报通道增强失败自省：宿主落盘被工作区策略拒绝时不再影响激活。

## [1.0.8] - 2026-10-23

### Fixed

- 多实例去重逻辑改为"首个挂载者渲染"，消除多个页面标签同时打开时 ✦ 按钮消失或互相抢占的问题。
- 修复设置拖拽时可能触发宿主定时器沙箱报错的问题：延迟刷新改走 `requestAnimationFrame` 兜底，不再依赖 `setTimeout`。
- 内置运行时自检上报（`aurora.report`）：每次页面加载都会把本插件的实际注入状态（样式表、token 计算值、面板/按钮挂载情况）通过宿主通道记录到插件目录的 `aurora-report.json`，便于诊断特殊环境下"启用后不生效"的问题。

## [1.0.7] - 2026-10-23

### Changed

- 动效控制权交给面板：极光漂移动画不再受系统"减弱动画"（`prefers-reduced-motion`）自动关闭 —— 实测发现启用系统减弱动画时极光会静止，影响观感；现在由面板的「动效强度」直接决定（关闭/柔和/丰富），默认柔和。
- ✦ 按钮的呼吸光晕（halo）同样跟随「动效强度」设置，不再依赖系统动画偏好。

## [1.0.6] - 2026-10-23

### Fixed

- **根治"启用后无任何效果"**（对壳主题实现的源码级诊断）：本壳把 `--dsw-alias-*` 别名 token 定义在 `body` / `body[data-ds-dark-theme]` 静态平台样式上（普通优先级），且 Theme 服务的内置 light/dark 主题 token 为空、override 层从不回写到实时 CSS —— 所以此前写到 `:root` 的直接层在 body 级被无条件压掉，玻璃表面保持全不透明、极光完全被遮挡。
- 直接 token 层改为同时写入 `body`（浅色）与 `body[data-ds-dark-theme]`（深色）两个选择器，全部带 `!important`；深色块复用宿主自带的 `data-ds-dark-theme` 属性，系统/明暗切换无需重写。
- 诊断行改测 `document.body` 的计算样式（此前测 `documentElement` 会得到"已生效"的假阳性）；选择器阶梯改为 `body` → `html body` → `html > body`。

## [1.0.5] - 2026-10-23

### Added

- 面板内置 CSS 变量层诊断行（`CSS L0 ✔/✖/?`）：自动检测 `:root` 注入是否被壳的更高优先级规则压制，并按需把选择器升级到 `:root:root`、`:root:root:root`…… 逐级比对计算样式直到生效，用于排查"启用后仍无效果"的极端 shell。

### Changed

- `:root` 直接 token 层现在带 `!important` 并支持特异性阶梯升级；主题明暗切换与滑块调整时保持同一阶梯重写。

## [1.0.4] - 2026-10-23

### Fixed

- **启用后界面完全没有效果**（用户反馈：与 mock-shot.png 设计不一致）：部分 shell 不会把 Theme 服务的 override 层重新合成到实时 CSS 变量，导致玻璃表面保持全不透明、极光被完全遮挡。现在直接把解析后的 alias token 以 `!important` 写到 `:root`（随主题明暗切换自动重写），并给 `html` 画布加一层静态极光渐变兜底。原有 `theme.overrideTokens` 路径保留，双保险。

## [1.0.3] - 2026-10-23

### Fixed

- **浅色模式几乎看不见玻璃/极光效果**（用户反馈"整体效果与介绍不符"）：浅色表面 token 改为真正半透明（可透出极光）、浅色模式极光饱和度与第二层亮度增强；深色模式不受影响。
- ✦ 悬浮按钮增加微呼吸光晕（reduced-motion 时自动禁用），浅色模式下也更易发现。

## [1.0.2] - 2026-10-23

### Fixed

- 控制面板改为近不透明的深色表面（`rgba(15,17,28,.97)`），文字全部使用显式高对比颜色，不再受主题 token 层影响——修复"控件太透、设置文字看不清"。
- 修复多余 ✦ 悬浮按钮：overlay 多实例挂载守卫（同一时刻只保留一个星形按钮）；
- 移除侧栏底部星形快捷开关，避免与其它入口混淆。

### Added

- 🎞️ 噪点质感（film grain）开关：细腻胶片颗粒层，提升玻璃表面质感。
- 🪶 动效强度分段控制（关闭 / 柔和 / 丰富），映射不同的极光漂移速度与幅度。
- ✨ 悬浮按钮悬浮扫光动画、hover 光晕扩展。
- 全局轻交互细节：细圆角滚动条、品牌色文本选区、更柔和的分区标签。

### Changed

- 深色模式表面 token 最低不透明度上调（更易读），默认模糊 16→18px，默认极光浓度微调。
- 面板/文档化说明同步至 1.0.2 实际控件集。

## [1.0.1] - 2026-10-23

### Fixed

- 修复悬浮按钮 / 控制面板的 `pointer-events` 问题：控制元素不再意外遮挡或吞掉下层交互。

### Changed

- 正式发布（1.0.1）。

## [1.0.0] - 2026-10-23

### Added

- 初版：玻璃拟态 + 极光渐变全局主题。
- `theme.overrideTokens` 主题 token 覆盖（light + dark 双模式，跟随系统主题）。
- 右下角 ✦ 控制面板：4 预设 / 5 色板 / 3 滑块（玻璃强度、模糊、色彩）/ 3 开关（极光背景、微动效、玻璃主题）/ 恢复默认。
- 侧栏底部 ✦ 玻璃主题快捷开关。
- 设置持久化到 `localStorage`。
- `prefers-reduced-motion` 支持与 90ms 重绘节流。