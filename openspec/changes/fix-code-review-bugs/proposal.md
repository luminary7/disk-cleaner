## Why

2026年7月全项目代码审查发现了多个 Bug 和架构问题，包括：（1）AI 配置页面使用的模型名与主程序不一致，导致用户配置 AI 后实际请求的模型错误；（2）IPC 事件监听器在组件卸载时未正确清理，造成内存泄漏和组件间互相干扰；（3）大文件扫描结果缺少去重导致重复项；（4）多处重复定义的常量难以维护。这些问题影响用户体验和应用健壮性，需要集中修复。

## What Changes

- **修复 AIConfigPage 模型名**：将 DeepSeek 模型从 `deepseek-chat` 改回 `deepseek-v4-flash`，MiniMax 从 `minimax-text-01` 改回 `Minimax-M3`
- **重构 IPC 监听器模式**：将 preload 的 `on*` 方法从粗暴的 `removeAllListeners` 改为返回独立的 cleanup 函数，各组件在 `useEffect` 返回中正确清理
- **CleanItems 扫描去重**：在增量接收 `onScanProgress` 批次时用 Set 过滤已存在的文件 ID
- **大文件分析 tooltip 修正**：更新 AI 批量分析按钮的 tooltip 文案使其与实际行为一致
- **提取 PRESET_PROVIDERS 共享常量**：创建 `src/shared/provider-config.ts` 作为权威数据源，消除三重定义
- **移除 scanner.js 中数组挂属性的无用代码**：删除 `largeFiles.totalSize = ...`
- **去除无效的 useCallback 包装**：LargeFiles 中 `getEffectiveSafety` 依赖 Map 引用无法缓存
- **store.js 写失败加日志**：catch 块输出错误信息便于排查

## Capabilities

### New Capabilities
- `shared-provider-config`: 将所有 AI 提供商配置（端点、模型名）提取到单个共享源，消除前端多处重复定义

### Modified Capabilities
（无 spec 级行为变更，本次均为实现级修复）

## Impact

- **前端渲染进程**：`AIConfigPage.tsx`、`AIAssistant.tsx`、`LargeFiles.tsx`、`CleanItems.tsx` — 修正模型名、去重、清理监听器
- **主进程**：`electron/preload.js` — 修改 `on*` 方法签名（返回 cleanup 函数）、`electron/scanner.js` — 删除无用行、`electron/store.js` — 增加错误日志
- **类型定义**：`src/vite-env.d.ts` — `ElectronAPI` 接口中 `on*` 方法返回值从 `void` 改为 `() => void`
- **新增文件**：`src/shared/provider-config.ts` — AI 提供商配置常量
