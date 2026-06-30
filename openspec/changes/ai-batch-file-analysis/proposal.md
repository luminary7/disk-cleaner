## Why

大文件扫描当前依赖离线规则引擎判断文件安全等级，规则无法覆盖所有场景（如游戏资源、无后缀文件、未知扩展名等），导致误判风险较高。引入 AI 批量分析能力，让用户可一键调用 AI 逐文件分析，给出是否建议删除及其理由，提升清理决策的准确性。推荐使用 agens 免费模型降低使用成本。

## What Changes

- AI 供应商预设新增 agens（免费模型 agnes-2.0-flash）
- 新增 `ai:analyze-batch` IPC 通道，支持并发批量文件分析
- LargeFiles 页面新增「AI 批量分析」按钮，逐文件调用 AI 并展示结果
- 表格 AI 建议列支持实时显示分析结果与详情弹窗
- 分析进度实时反馈，支持中途取消

## Capabilities

### New Capabilities

- `batch-file-analysis`: 大文件批量 AI 分析，逐文件判定是否建议删除并给出理由，支持并发控制、进度反馈和取消
- `agens-provider`: AI 配置新增 agens 免费供应商预设，含 endpoint / model / 文档链接

### Modified Capabilities

（无 — 本次不修改已有能力，仅新增）

## Impact

- `electron/ai-provider.js`: 新增 agens 预设配置
- `electron/main.js`: 新增 `ai:analyze-batch` 和 `ai:batch-cancel` IPC 处理器
- `electron/preload.js`: 新增分析桥接方法
- `src/pages/LargeFiles.tsx`: 新增批量分析 UI（按钮、进度、结果展示）
- `src/pages/AIConfigPage.tsx`: 新增 agens 供应商选项
- `src/vite-env.d.ts`: 补充类型声明
- 无新增外部依赖（agens API 兼容 OpenAI 格式，复用现有 AIProvider）
