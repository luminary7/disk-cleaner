## Context

当前大文件分析依靠离线规则引擎（rule-engine.js）判定文件安全等级，但规则无法覆盖游戏资源、无后缀文件、未知扩展名等场景，导致误判。用户已经要求规则趋向保守（未知文件一律 keep），但这也意味着大量文件无法清理。引入 AI 批量分析作为补充手段，让用户可一键对扫描出的大文件逐条请求 AI 判断是否建议删除，并给出理由。

AIProvider 已经支持 OpenAI 兼容 API（现有 DeepSeek / MiniMax / SiliconFlow 预设），复用现有客户端架构新增 agens 预设即可。

## Goals / Non-Goals

**Goals:**
- 新增 agens 免费 AI 供应商预设（端点和默认模型预设好，用户仅需填 API Key）
- 新增批量文件分析 IPC 通道，并发调用 AI，逐文件返回分析结果
- LargeFiles 页面新增「AI 批量分析」按钮，显示进度，支持取消
- 分析结果写入现有 singleAnalysisMap，复用已有的 AI 建议弹窗展示
- 复用现有 `analyzeSingleFile` 逻辑（file-detail.js 获取元信息 → AI 分析）

**Non-Goals:**
- 不修改现有规则引擎逻辑
- 不做分析结果持久化（刷新页面后丢失，下次扫描可重新分析）
- 不做 AI 分析的本地缓存（同一批次内重复调用跳过已分析的）
- 不增加新的外部依赖

## Decisions

### 1. 并发策略：固定 3 并发
API 调用是 I/O 密集型，3 个并发在免费模型限流范围内且体验可接受。如果单文件分析慢，用户可等待或取消。用固定线程池模式（Promise.all + 切片）而非动态池。

### 2. 分析粒度：逐文件调用 analyzeSingleFile
复用现有的 `file-detail.js` → `ai-provider.js` 的单文件分析链路，每个文件独立请求 AI。无需新增 prompt 设计。IPC 传输文件列表后在主进程串行/并发调用，每完成一个推送进度到渲染进程。

### 3. 取消机制：模块级标志位
参考 scanner.js 的 `cancelRequested` 模式，在 main.js 设模块级 `batchCancelRequested` 标志，worker 循环检查标志位退出。

### 4. agens 预设直接匹配现有 PRESET_PROVIDERS 结构
在 `ai-provider.js` 的 `PRESET_PROVIDERS` 中新增一项即可，无需修改配置 UI 的数据流。

## Risks / Trade-offs

- **API 限流风险：** 免费模型可能有每分钟请求数限制。→ 采用 3 并发而不是更高并发数缓解，用户可见进度反馈。
- **分析耗时：** 100 个文件 × 3~5 秒/个 ≈ 2~5 分钟。→ 进度条 + 取消按钮让用户可控。
- **API Key 未配置：** 用户未填 Key 时批量分析按钮应禁用。→ 读取当前 aiConfig 判断 `isConfigured()`。
- **分析结果不一致：** AI 可能对不同批次返回不同结论。→ 这是 AI 分析的固有特性，在 UI 说明"仅供参考"。
