# Task Plan: 大文件 AI 删除裁定改造

## Goal
让“大文件分析”中的删除判断最终以已配置 AI 的分析结果为准，包括允许 AI 覆盖本地规则引擎给出的 `keep` 等级；未完成 AI 评估的文件不能被误当作 AI 已确认可删。

## Current Phase
方案已生成，等待确认进入实现。

## Phases

### Phase 1: Requirements & Discovery
- [x] 明确 AI 可以覆盖本地 `keep`
- [x] 明确最终删除建议以 AI 裁定为准
- [x] 梳理现有大文件扫描、AI 分析、删除链路
- **Status:** complete

### Phase 2: Contract & Data Model
- [ ] 新增或统一 `AISafetyResult` 结构：`id`, `safety`, `reason`
- [ ] 将批量 AI 结果从按 `path` 回配改为按 `id` 回配
- [ ] 给单文件 AI 分析结果增加明确 `safety: safe | caution | keep`
- [ ] 更新 `src/vite-env.d.ts` 中的 Electron API 类型
- **Status:** pending

### Phase 3: AI Provider & IPC
- [ ] 更新 `electron/ai-provider.js` 的批量提示词，要求返回 `id`
- [ ] 校验 AI 返回的 `safety` 只允许 `safe/caution/keep`
- [ ] 更新单文件提示词，要求同时返回 `safety` 和现有详情字段
- [ ] 保持 `electron/main.js` 分批逻辑，返回新的 `{ results }` 结构
- **Status:** pending

### Phase 4: LargeFiles UI State & Decision Logic
- [ ] 扫描开始时同时清空 `singleAnalysisMap` 和 `aiSafetyMap`
- [ ] 建立统一 helper：`getEffectiveSafety(item)`
- [ ] 建立统一 helper：`hasAIJudgement(item)`
- [ ] 当 AI 已配置时，删除前要求选中文件均已有 AI 裁定
- [ ] 复选框禁用、筛选、重要文件倒计时、实际删除过滤全部使用统一 helper
- [ ] 单文件 AI 分析完成后同步写入 `aiSafetyMap`
- **Status:** pending

### Phase 5: UI Copy & User Feedback
- [ ] 将本地规则列文案调整为“规则等级”或保留“安全等级”但明确 AI 列是最终判断
- [ ] AI 列展示 `AI: 可删/谨慎/保留` 和原因 tooltip
- [ ] 对未 AI 评估文件展示“待 AI 评估”状态或在删除时弹出提示
- [ ] AI 配置状态在点击批量分析/删除前实时刷新，避免保存配置后页面状态过期
- **Status:** pending

### Phase 6: Verification
- [ ] `npm run build`
- [ ] 验证 AI 返回 `safe` 时，本地 `keep` 文件可勾选并可进入删除确认
- [ ] 验证 AI 返回 `keep` 时，本地 `safe/caution` 文件不可作为可删项处理
- [ ] 验证 AI 已配置但文件未评估时，删除动作被阻止并提示先评估
- [ ] 验证 AI 未配置时，现有本地规则兜底逻辑仍可使用
- [ ] 验证受保护路径仍被 `file-operator` 拦截
- **Status:** pending

## Key Questions
1. AI 是否允许覆盖本地 `keep`？已确认：允许。
2. 未 AI 评估的文件是否可以按本地规则删除？建议：AI 已配置时不允许，AI 未配置时才回退本地规则。
3. 受保护路径黑名单是否允许 AI 覆盖？建议：不允许。AI 覆盖的是扫描项 `safety`，不是底层删除安全边界。

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| AI 裁定优先于 `ScanItem.safety` | 用户明确要求最终结果以 AI 为准，并允许覆盖本地 `keep` |
| AI 结果按 `id` 回配 | 路径字符串可能被模型改写，`id` 是前端扫描项的稳定匹配键 |
| 单文件分析也产出 `safety` | 避免用 `suggestDelete` 和 `riskLevel` 做二次推断，减少歧义 |
| AI 已配置时未评估文件不可删除 | 防止“最终以 AI 为准”被本地规则兜底绕过 |
| 保留 `ruleEngine.isExcludedPath` 删除硬拦截 | 这是底层安全边界，不属于普通 `keep` 等级覆盖范围 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| None | 1 | 当前仅生成方案，尚未实施 |

## Notes
- 本方案只改“大文件分析”链路，不影响普通扫描和极简模式清理逻辑。
- 目标是小范围修正现有实现，不引入新状态库或大规模重构。
- 实现时应优先使用现有 Ant Design 表格、Tag、Modal 结构。
