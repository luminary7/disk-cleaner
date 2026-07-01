## ADDED Requirements

### Requirement: AI 提供商配置统一管理

系统 SHALL 提供一个共享的 AI 提供商配置模块 `src/shared/provider-config.ts`，作为前端渲染进程所有 AI 配置的权威数据源。

该模块 SHALL 导出以下常量：
- `PRESET_PROVIDERS` — 预置提供商映射表，键为 `provider` 字符串，值为包含 `endpoint`（字符串）、`model`（字符串）、`label`（中文展示名）的对象。至少包含以下提供商：
  - `deepseek`：endpoint `https://api.deepseek.com`，model `deepseek-v4-flash`
  - `minimax`：endpoint `https://api.minimax.chat/v1`，model `Minimax-M3`
  - `siliconflow`：endpoint `https://api.siliconflow.cn/v1`，model `Qwen/Qwen2.5-7B-Instruct`
  - `agens`：endpoint `https://apihub.agnes-ai.com/v1/`，model `agnes-2.0-flash`
- `PresetProvider` — TypeScript 类型别名，`'deepseek' | 'minimax' | 'siliconflow' | 'agens'`

#### Scenario: 前端页面使用共享配置

- **WHEN** `AIAssistant.tsx` 或 `AIConfigPage.tsx` 需要引用提供商端点或模型名
- **THEN** 它们 SHALL 从 `src/shared/provider-config` import `PRESET_PROVIDERS`，而非在各自文件中重新定义

#### Scenario: 配置一致性保障

- **WHEN** 需要修改某个提供商的端点或模型名
- **THEN** 只需修改 `src/shared/provider-config.ts` 一处，无需同步修改 AIAssistant 和 AIConfigPage

### Requirement: 旧代码清理

`AIAssistant.tsx` 和 `AIConfigPage.tsx` 中各自的 `PRESET_PROVIDERS` 本地定义 SHALL 被删除，替换为 import 共享版本。

#### Scenario: 无遗留本地定义

- **WHEN** 构建项目
- **THEN** `AIAssistant.tsx` 和 `AIConfigPage.tsx` 中不应存在独立的 `PRESET_PROVIDERS` 定义

### Requirement: IPC 监听器 cleanup 模式

`electron/preload.js` 中所有 `onXxx` 方法 SHALL 返回一个 cleanup 函数（`() => void`），调用该函数可移除刚刚注册的特定监听器，而不影响同一通道上的其他监听器。

受影响的方法包括：
- `onScanProgress`
- `onScanComplete`
- `onScanError`
- `onCleanProgress`
- `onCleanComplete`
- `onCleanCancelled`
- `onRestoreProgress`
- `onLargeFileProgress`
- `onLargeFileComplete`
- `onBatchAnalysisProgress`

`removeAllListeners` 作为预留方法 SHALL 保留，但不建议在组件中使用。

#### Scenario: 独立清理

- **WHEN** 组件 A 注册 `onScanProgress`，组件 B 也注册 `onScanProgress`
- **AND** 组件 A 卸载并调用返回的 cleanup 函数
- **THEN** 组件 B 的回调 MUST 仍能正常接收 `scan:progress` 事件

#### Scenario: 类型定义更新

- **WHEN** `src/vite-env.d.ts` 中定义 `ElectronAPI` 接口
- **THEN** 所有 `on*` 方法的返回类型 SHALL 从 `void` 改为 `() => void`

### Requirement: 组件级 IPC 监听器正确清理

`LargeFiles.tsx` 和 `CleanItems.tsx` SHALL 在 `useEffect` 的 cleanup 函数中调用 IPC 监听器返回的 cleanup 函数，确保组件卸载时移除监听器。

`listenerRegistered` ref 守卫 SHALL 被移除，代之以每个 useEffect 独立的注册-清理生命周期。

#### Scenario: 组件卸载清理

- **WHEN** `LargeFiles` 或 `CleanItems` 组件卸载
- **THEN** 所有通过 `window.electronAPI.on*` 注册的监听器 SHALL 被移除
- **AND** 不应发生因监听器未清理导致的回调执行（`setState` on unmounted component）

#### Scenario: 重复监听防护

- **WHEN** 组件经历两次挂载（如 React StrictMode 双重调用）
- **THEN** 每次挂载注册新的监听器，卸载时移除前一次注册的监听器
- **AND** 不应出现同一个回调被注册两次的情况

### Requirement: CleanItems 扫描增量去重

`CleanItems.tsx` 中 `onScanProgress` 的回调 SHALL 在将 `data.batchItems` 追加到 `items` 状态前，通过 Set 按 `id` 字段过滤已有项目，避免同一文件因跨批次而重复出现。

#### Scenario: 增量去重

- **WHEN** 扫描进度回调收到一批文件，其中部分文件 id 已在 `items` 状态中存在
- **THEN** 仅不存在的文件 SHALL 被追加
- **AND** 列表不应出现重复项

### Requirement: 模型名修正

`AIConfigPage.tsx` 中预置提供商的模型名 SHALL 与 `ai-provider.js` 和 `AIAssistant.tsx` 保持一致：
- DeepSeek: `deepseek-v4-flash`（原错误值为 `deepseek-chat`）
- MiniMax: `Minimax-M3`（原错误值为 `minimax-text-01`）

#### Scenario: 配置一致性

- **WHEN** 用户在 AIConfigPage 中选择 DeepSeek 并保存配置
- **THEN** 存储的模型名 SHALL 为 `deepseek-v4-flash`
- **AND** 主进程 AI 请求时使用 `deepseek-v4-flash` 调用 API

### Requirement: 大文件 AI 批量分析 tooltip 修正

`LargeFiles.tsx` 中 AI 批量分析按钮的 `title` 属性 SHALL 更新为与实际行为一致。

#### Scenario: 正确的 tooltip 描述

- **WHEN** 用户鼠标悬停在 AI 批量分析按钮上
- **THEN** tooltip 文本应描述"每次分析最多 10 个最大的未评估文件"

### Requirement: 删除无效代码

`electron/scanner.js` 中 `largeFiles.totalSize = largeFiles.reduce(...)` 行 SHALL 被删除。

`src/pages/LargeFiles.tsx` 中 `getEffectiveSafety` 的 `useCallback` 包装 SHALL 被移除，改为普通箭头函数。

#### Scenario: 无运行时影响

- **WHEN** 大文件扫描完成
- **THEN** 扫描结果数组不额外挂载 `totalSize` 属性
- **AND** 调用端 `main.js` 的 totalSize 计算不受影响

#### Scenario: useCallback 移除

- **WHEN** `getEffectiveSafety` 被调用
- **THEN** 其行为与移除 `useCallback` 前完全一致

### Requirement: store.js 写失败日志

`electron/store.js` 中 `_save` 方法的 catch 块 SHALL 将错误信息输出到 `console.error`，使写配置失败可被排查。

#### Scenario: 写入失败可观测

- **WHEN** `_save` 方法写入文件时发生异常
- **THEN** 错误信息 SHALL 通过 `console.error` 输出，格式为 `[Store] 写入配置文件失败: <error message>`
