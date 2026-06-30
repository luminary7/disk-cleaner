# Findings & Decisions

## Requirements
- 大文件分析部分应由配置的 AI 判断文件是否可以删除。
- AI 可以覆盖本地规则引擎的 `keep`。
- 最终删除建议以 AI 结果为准。
- 仍应保留底层受保护路径的删除拦截。

## Research Findings
- `src/pages/LargeFiles.tsx` 已有 `aiSafetyMap`，但批量结果按 `path` 匹配，模型改写路径会导致回配失败。
- 单文件 `analyzeSingleFile` 结果只写入 `singleAnalysisMap`，不影响 AI 风险列、筛选、复选框或删除判断。
- 复选框禁用逻辑仍使用 `record.safety === 'keep'`，AI 即使判断可删也无法重新启用本地 `keep` 文件。
- `getEffectiveSafety` 已存在，但未贯穿所有删除相关入口。
- `aiReady` 只在组件挂载时读取一次，AI 配置保存后大文件页面可能不会立即感知。
- `electron/file-operator.js` 删除前会调用 `ruleEngine.isExcludedPath`，这是最后一道路径保护。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 使用 `id` 作为 AI 结果回配键 | 保证批量结果稳定匹配扫描项 |
| `SingleFileAnalysis` 增加 `safety` 字段 | 让单文件分析和批量分析共用同一裁定模型 |
| `getEffectiveSafety` 成为唯一 UI 判定入口 | 避免筛选、复选框、删除确认出现不一致 |
| AI 已配置时要求先评估再删除 | 符合“最终以 AI 为准”的产品语义 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| 当前批量 AI 返回路径匹配脆弱 | 改为返回 `id` |
| 当前单文件 AI 不影响删除逻辑 | 分析完成后同步写入 `aiSafetyMap` |
| 当前本地 `keep` 会继续禁用复选框 | 复选框改用有效安全等级 |

## Resources
- `src/pages/LargeFiles.tsx`
- `electron/ai-provider.js`
- `electron/main.js`
- `electron/preload.js`
- `src/vite-env.d.ts`
- `electron/file-operator.js`
- `electron/rule-engine.js`

## Visual/Browser Findings
- 本次没有使用浏览器或视觉检查。
