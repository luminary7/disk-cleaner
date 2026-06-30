## 1. agens 供应商预设

- [x] 1.1 在 `electron/ai-provider.js` 的 `PRESET_PROVIDERS` 中新增 agens（endpoint: `https://apihub.agnes-ai.com/v1/`, model: `agnes-2.0-flash`）
- [x] 1.2 在 `src/pages/AIConfigPage.tsx` 的供应商选择下拉中添加 "Agnes AI（免费）" 选项
- [x] 1.3 选中 agens 时显示官网链接和 API 文档链接

## 2. 批量分析 IPC

- [x] 2.1 在 `electron/main.js` 新增 `ai:analyze-batch` 处理器：接收文件列表，3 并发调用 `aiProvider.analyzeSingleFile()`，每完成一个推送 `ai:batch-progress` 事件
- [x] 2.2 在 `electron/main.js` 新增 `ai:batch-cancel` 处理器：设模块级 `batchCancelRequested` 标志
- [x] 2.3 在 `electron/preload.js` 新增 `analyzeBatchFiles` 和 `onBatchAnalysisProgress` 桥接方法
- [x] 2.4 在 `src/vite-env.d.ts` 补充 `ElectronAPI` 中的批量分析类型声明

## 3. LargeFiles 页面批量分析 UI

- [x] 3.1 新增状态：`batchProgress`（{ current, total, currentItem } | null）
- [x] 3.2 工具栏新增「AI 批量分析」按钮，分析中显示进度 `AI 分析中 ({current}/{total})` 且可点击取消
- [x] 3.3 批量分析触发时跳过 `singleAnalysisMap` 中已有结果的文件
- [x] 3.4 分析结果写入 `singleAnalysisMap`，表格 AI 建议列自动显示
- [x] 3.5 未配置 AI 时按钮禁用并给出提示

## 4. 验证

- [ ] 4.1 验证 agens 预设可选中、URL/模型自动填充、链接可点
- [ ] 4.2 验证批量分析进度显示和结果展示
- [ ] 4.3 验证取消功能正常、已分析结果保留
- [ ] 4.4 验证未配置 AI 时按钮禁用
