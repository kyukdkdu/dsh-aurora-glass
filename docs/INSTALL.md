# 安装指南 · Installation Guide

本文件提供 **dsh-aurora-glass**（Aurora Glass / 极光玻璃）的详细安装、卸载、升级与故障排查指引。
This file covers detailed install / uninstall / upgrade steps and troubleshooting for **dsh-aurora-glass**.

---

## 前提条件

- 一个可正常启动的 DeepSeek Harness（DSH）。
- 使用「方式二（pnpm）」时，需已安装 Node.js 与 pnpm。

## 方式一：DSH 应用内「插件管理器」安装（推荐）

> 不同 DSH 版本的入口文字可能略有差异，以下以常见路径描述。

1. 打开 DeepSeek Harness，进入 **设置（Settings）→ 插件（Plugins / Plugin Manager）**。
2. 在插件管理器中选择**安装本地目录**，指向本仓库根目录（即包含 `package.json` 的文件夹）；或选择**安装发布包**，安装打包产物 `dsh-aurora-glass`。
   - 本地目录安装采用「链接」方式：源码改动直接反映到已安装插件（改动后刷新页面即可）。
3. 在插件 / bundle 列表中找到 **dsh-aurora-glass**（Aurora Glass / 极光玻璃），确认状态为**已安装**。
4. **启用**该 bundle。首次安装激活支持热生效（HMR），**通常无需重启应用**。
5. 回到主界面，确认右下角出现 ✦ 悬浮按钮、界面呈现玻璃 + 极光效果；若没变化，**刷新页面**（Ctrl/Cmd + R）。

## 方式二：pnpm 安装 + cordis.patch.yml

1. 在你的 DSH 配置项目中安装包：

   ```sh
   pnpm add dsh-aurora-glass
   ```

2. 在 `cordis.patch.yml` 中追加以下条目（保持缩进，`id` 与 `name` 均为 `dsh-aurora-glass`）：

   ```yaml
   - insert:
       - id: dsh-aurora-glass
         name: dsh-aurora-glass
   ```

3. 保存文件后**重启或重载** DeepSeek Harness，使补丁生效。
4. 若 DSH 的插件管理器中能看到该 bundle，也可直接在管理器中启用，启用后即可热生效、无需重启。
5. 验证方法同方式一第 5 步。

> 💡 补丁条目不需要（也没有）任何 `config`：本插件没有命令行配置项，所有可调参数都在面板里。

## 升级

- **插件管理器**：在管理器中更新 / 重装新版 bundle，然后启用。
- **pnpm**：`pnpm add dsh-aurora-glass@latest`（或指定版本号），`cordis.patch.yml` 中的条目保持不变。
- 版本升级（替换已安装的包）后，界面若未更新：**刷新页面**（必要时重启应用）以加载新的 JavaScript 模块代次。

## 卸载

1. **停用并移除**：
   - 由插件管理器安装：在管理器中禁用并移除 `dsh-aurora-glass` bundle。
   - 由 pnpm 安装：删除 `cordis.patch.yml` 中对应的 `- insert:` 块，再执行 `pnpm remove dsh-aurora-glass`。
2. **（可选）清理本地设置**：打开浏览器开发者工具控制台执行
   `localStorage.removeItem('dsh-aurora-glass:settings:v1')`，然后刷新页面。
3. 刷新 / 重启后确认界面已恢复原版观感（✦ 按钮消失、窗口恢复默认外观）。

## 故障排查

| 症状 | 可能原因 | 处理 |
| --- | --- | --- |
| **启动报错**：`web boot: 1 entry did not activate — dsh-aurora-glass: pending (waiting for service: styles)`（v1.1.2 / v1.1.3）| 旧版客户端把不存在的 `styles` 服务写进了 `inject` 依赖声明，加载器永远等待 → 整个 Web 启动失败，宿主并会停用全部第三方插件 | 这是 v1.1.2 / v1.1.3 的已知缺陷：**升级到 v1.1.4**（重装 → 启用 → 刷新页面），然后到插件管理页重新启用此前被自动停用的插件 |
| 安装后无任何效果 | 客户端资源尚未重载；bundle 未启用 | 刷新页面；到插件管理器确认已启用 |
| 主题看起来没变化 | ✦ 按钮被其它悬浮插件**遮挡**（别的 overlay 插件叠在上面）；玻璃主题总开关被关闭；玻璃强度被调到 0%（≈ 原版观感） | 检查右下角 ✦ 是否可见/可点；关闭或调整与其它悬浮插件的层级；检查总开关与玻璃强度滑块 |
| 极光背景不显示 | 「极光背景」「玻璃主题」开关被关闭 | 打开面板确认两个开关均为开 |
| 极光不动 | 系统开启了「减弱动态效果」 | 属正常行为（插件遵循 `prefers-reduced-motion`）；关闭系统该选项后恢复动画 |
| 设置没有保存 | 浏览器隐私模式 / localStorage 被禁用 | 改用普通模式重试；确认站点 localStorage 可用 |
| 亮暗切换后背景颜色不对 | 背景层按旧方案栅格化 | 刷新页面，背景会按当前方案重新渲染 |
| 与其它主题插件冲突 | 多个主题插件同时覆盖同一批 `--dsw-alias-*` token | 同一时间只启用一个主题插件 |

## 权限与数据说明

- 插件只覆盖主题 token、注入样式与面板组件；**不访问业务逻辑，不读写任何对话数据**。
- 唯一写入的本地数据是外观设置（`localStorage` 键 `dsh-aurora-glass:settings:v1`），卸载清理见上文。