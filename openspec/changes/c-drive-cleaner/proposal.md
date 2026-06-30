## Why

Windows C 盘空间不足是普通用户最常见的电脑问题之一，但现有方案要么需要专业知识（手动清理）、要么不够安全（误删系统文件）、要么界面复杂让用户不敢操作。需要一个足够安全、界面友好、带智能引导的清理工具，让不懂电脑的用户也能放心清理。

## What Changes

- 全新的 Electron 桌面应用，图形化界面
- 极简模式：一键扫描 → 一键清理，适合完全不想动脑的用户
- 高级模式：逐项清理、大文件分析、AI 建议面板
- 内置规则引擎，离线即可判断清理安全等级
- 可选 AI 增强（接入 DeepSeek / MiniMax / 自定义 API）
- 所有清理默认移至回收站，可恢复
- 硬编码系统排除列表，杜绝误删系统文件

## Capabilities

### New Capabilities
- `quick-scan-clean`: 极简扫描与一键清理 — 单个按钮完成从扫描到清理的全流程，实时进度反馈
- `itemized-cleanup`: 逐项分类清理 — 按类别（系统缓存、软件缓存等）展示占用，每项标注安全等级，用户可勾选
- `large-file-analyzer`: 大文件分析 — 扫描 50MB+ 文件，列表排序，类型筛选，安全删除
- `ai-assistant`: AI 助手 — 内置规则引擎 + 可选 AI API（DeepSeek/MiniMax/自定义），分析清理建议、自然语言问答
- `safety-system`: 安全防护系统 — 排除列表、回收站优先、系统还原点、操作日志、二次确认

### Modified Capabilities
<!-- No existing specs to modify — this is a new project -->

## Impact

- 新建项目，不涉及现有代码修改
- 依赖：Node.js、Electron、React、Ant Design
- 仅支持 Windows 平台
