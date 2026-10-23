# Changelog

本文件记录 dsh-aurora-glass 的重要变更，采用简易维护格式（Keep a Changelog 风格）。
All notable changes to dsh-aurora-glass, in a simple maintenance format (Keep a Changelog style).

> ⚠️ **占位说明 / Placeholder note**：当前条目内容为占位，正式发布前请补充具体日期与更多细节。
> Dates and details below are placeholders — fill them in before release.

## [Unreleased]

### Added

- （待补充 / TBD）

### Changed

- （待补充 / TBD）

### Fixed

- （待补充 / TBD）

## [1.0.1] - TBD

### Fixed

- 修复悬浮按钮 / 控制面板的 `pointer-events` 问题：控制元素不再意外遮挡或吞掉下层交互。

### Changed

- 正式发布（1.0.1）。

## [1.0.0] - TBD

### Added

- 初版：玻璃拟态 + 极光渐变全局主题。
- `theme.overrideTokens` 主题 token 覆盖（light + dark 双模式，跟随系统主题）。
- 右下角 ✦ 控制面板：4 预设 / 5 色板 / 3 滑块（玻璃强度、模糊、色彩）/ 3 开关（极光背景、微动效、玻璃主题）/ 恢复默认。
- 侧栏底部 ✦ 玻璃主题快捷开关。
- 设置持久化到 `localStorage`。
- `prefers-reduced-motion` 支持与 90ms 重绘节流。