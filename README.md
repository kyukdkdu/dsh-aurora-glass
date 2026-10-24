# Aurora Glass · 极光玻璃

> **`dsh-aurora-glass`** — 为 DeepSeek Harness（DSH）打造的全局玻璃拟态 + 极光渐变主题插件。
> A global glassmorphism + aurora theme plugin for DeepSeek Harness.

![Version](https://img.shields.io/badge/version-1.2.0-8fb0ff) ![License](https://img.shields.io/badge/license-MIT-059669) ![Platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-4763ff) ![Dependencies](https://img.shields.io/badge/dependencies-0-0b7bf1)

不替换任何组件，只改 CSS token 层 —— 侧栏、对话区、输入框、代码块、弹窗会一起变；
深浅色跟随宿主自己的 `data-ds-dark-theme` 属性切换，不需要重新注入样式；
宿主侧没有任何逻辑：不写文件、不开路由、不连网络。

---

## 简体中文

### 安装

插件目录以 `link:` 方式被 profile 引用。`~/.dsh/profiles/desktop/package.json`：

```json
{
  "dependencies": {
    "dsh-aurora-glass": "link:D:/DSH-work/dsh-work-1/dsh-aurora-glass"
  },
  "dsh": {
    "profile": {
      "bundles": ["...", "dsh-aurora-glass"]
    }
  }
}
```

改完执行一次 profile 安装（或在插件管理页重装该插件），然后**完全退出并重启 DSH**（托盘里也要退）。

卸载：把 `bundles` 里的 `dsh-aurora-glass` 去掉，重启即可。

### 使用

右下角闪光按钮 → 设置面板：

| 分区 | 内容 |
| --- | --- |
| 预设 | 默认 / 轻雾 / 深空 / 原版观感 |
| 色板 | Aurora / Ocean / Ember / Jade / Mono |
| 表面 | 玻璃强度、光晕、色彩三个滑杆 |
| 氛围 | 动效（关 / 柔和 / 丰富）、极光背景、噪点、玻璃主题总开关 |

设置存在 `localStorage` 的 `dsh-aurora-glass:settings:v2`，删掉这个键即恢复默认。
"原版观感"把玻璃强度归零并关掉极光与噪点，等于临时回到原生外观。

### 工作原理（也是踩过的坑）

DSH 的客户端插件是一段**惰性 CJS**：`client.js` 只注册工厂，模块副作用在首次 import 时才执行。工厂返回的对象就是 Cordis 插件：

```js
window.__ModuleLoader__.load({
  id: 'dsh-aurora-glass',
  factory(require) {
    return {
      inject: ['slots'],            // 只能是真实存在的客户端服务
      apply(ctx) { /* 注入 <style> + ctx.slots.register(...) */ },
    };
  },
});
```

三个硬约束，违反任何一条都会让**整个应用起不来**（不是本插件不生效，而是 DSH 直接弹"应用无法启动"）：

1. `inject` 写了不存在的服务 → 条目永远 `pending`（`waiting for service: xxx`）
2. `apply()` 抛异常 → 条目 `failed`
3. 模块体本身抛异常 → `import failed`

所以这一版的写法是：

- `inject: ['slots']`，只有它；`theme` / `locale` 一概不依赖
- `apply()` 整体包在 try/catch 里，任何异常只打一条 warning
- 模块体只有 `require('react')` 一处外部依赖，取不到就返回一个空插件
- 宿主半侧 `index.js` 是空的 `apply()`，没有可失败的代码

主题本身：宿主的 alias token（`--dsw-alias-bg-base`、`--dsw-alias-bg-layer-1/2/3`、`--dsw-alias-border-l1..4`、`--dsw-specific-sidebar-fill` 等）声明在 `body` 上，所以

```css
body { --dsw-alias-bg-base: rgba(...) !important; }
body[data-ds-dark-theme] { --dsw-alias-bg-base: rgba(...) !important; }
```

就能在不碰任何组件的前提下把整套界面改成半透明表面；极光画在 `body::before`（`z-index:-1`、`pointer-events:none`），透过半透明表面显出来。按钮用 `ctx.slots.register({ name: 'shell.overlay', id, order }, Component)` 挂进宿主浮层插槽。

### 故障排查

**弹"应用无法启动或已意外停止 / web boot: 1 entry did not activate"**

看 `%APPDATA%\@deepseek-ai\dsh-desktop\logs\crash-*-web-boot.log`，里面会写明哪个条目、什么状态：

- `pending (waiting for service: xxx)` → `inject` 写了不存在的服务
- `failed` → `apply()` 抛了异常
- `import failed` → 模块体有语法错误或依赖缺失

**只关掉这一个插件**（不要用错误弹窗上的"禁用第三方插件"，那会把所有第三方插件一起关掉）：

```powershell
.\tools\dsh-aurora-toggle.ps1 -Action disable   # 只禁用本插件
.\tools\dsh-aurora-toggle.ps1 -Action status    # 查看状态
.\tools\dsh-aurora-toggle.ps1 -Action enable    # 重新打开
```

脚本只往 `~/.dsh/profiles/desktop/cordis.patch.yml` 追加 `- id: dsh-aurora-glass / disabled: true`，并先备份原文件。

**改了代码不生效**：客户端 bundle 的 revision 取自文件 `mtimeMs / ctimeMs / size`，保存后重启 DSH 一定会重新取。

### 目录

```
client.js           浏览器半侧：样式生成 + 悬浮面板（唯一有逻辑的文件）
index.js            宿主半侧：空的 apply()，只为让包能作为 loader 条目存在
cordis.patch.yml    bundle patch：往配置树里插入本插件条目
tools/              只开关本插件的 PowerShell 脚本
docs/INSTALL.md     安装细节
```

### 兼容性

- DSH `0.2.1-rc.2`（Electron 44 / Chromium 140+）实测
- 依赖 API：`window.__ModuleLoader__`、`ctx.slots.register`、`ctx.effect`
- 依赖 CSS：`:has()`、`backdrop-filter`

---

## English

A zero-dependency glassmorphism + aurora theme for DeepSeek Harness.

- Restyles the whole shell by overriding the host's alias CSS tokens on `body`
  (and `body[data-ds-dark-theme]` for the dark scheme) — no component patching.
- Paints the aurora on `body::before` (`z-index:-1`) so translucent surfaces show it through.
- Registers one floating settings button into the `shell.overlay` slot.
- `inject: ['slots']` only, `apply()` fully wrapped in try/catch, and the host half
  is an empty `apply()`: a failing client entry aborts the entire web boot, so this
  plugin is written to be incapable of throwing.

Install by adding the package to a DSH profile (`link:` + `dsh.profile.bundles`),
then restart DSH. To disable only this plugin:
`tools/dsh-aurora-toggle.ps1 -Action disable`.

## License

MIT
