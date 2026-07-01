## Context

2026年7月全项目代码审查发现了 4 个行为级 Bug、2 个架构问题和 3 个代码异味。当前代码库中 AI 提供商配置（端点、模型）在 `electron/ai-provider.js`、`src/pages/AIAssistant.tsx`、`src/pages/AIConfigPage.tsx` 三处独立定义，已出现两处模型名不一致。IPC 事件监听通过 `removeAllListeners(channel)` 清理，该方式会移除通道上所有监听器，不适合多组件共存场景。本次集中修复所有审查发现项。

## Goals / Non-Goals

**Goals:**
- 修复所有 P0 行为级 Bug（模型名、IPC 泄漏、重复文件、文案过时）
- 解决 P1 架构问题（提取共享常量、删除无效代码）
- 改进代码稳健性（storage 写失败可观测）

**Non-Goals:**
- 不改变 IPC 通道命名规范
- 不涉及测试框架引入
- 不做 UI 重构或重设计
- 不改变 `electron/ai-provider.js` 中主进程的常量（通过 IPC 同步，无需共享）

## Decisions

### 1. IPC 监听器改用返回 cleanup 函数模式

**决策**: 将 preload 中所有 `on*` 方法从当前模式：
```js
onXxx: (callback) => { ipcRenderer.on('xxx', handler); }
// 清理需：removeAllListeners('xxx')  // 粗粒度，会删除其他组件注册的监听器
```

改为返回独立 cleanup 函数：
```js
onXxx: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('xxx', handler);
    return () => ipcRenderer.removeListener('xxx', handler);
}
```

**理由**:
- `removeAllListeners` 是全局清除，多个组件同时监听同一通道时（如 AdvancedMode 中多个标签页同时存活）会互相影响
- 返回 cleanup 函数是 React 官方推荐模式，组件可安全在 `useEffect` 中注册和清理
- 保持向后兼容：调用方可以忽略返回值，旧代码不受影响

**替代方案考虑**: 
- 事件总线模式（EventEmitter）→ 过于重，当前 IPC 模型足够
- 监听器 ID 方案 → 需要维护映射表，增加复杂度

### 2. PRESET_PROVIDERS 提取为共享常量

**决策**: 新建 `src/shared/provider-config.ts` 作为权威数据源，`AIAssistant.tsx` 和 `AIConfigPage.tsx` 从它 import。

**理由**:
- 消除前端两处定义之间的不一致（目前已有 2 处模型名差异）
- `electron/ai-provider.js` 保留自身副本（主进程，不参与前端构建），但通过统一的数据流保证主进程端和渲染端使用相同配置
- 单一数据源原则，修改时只需改一处

**不提取主进程的原因**:
- `electron/ai-provider.js` 在 Node.js 环境运行，无法直接 `import` TypeScript 文件
- 可通过 `require` 加载，但增加构建复杂度，收益不大（仅 3 个提供商配置）

### 3. CleanItems 去重策略与 LargeFiles 保持一致

**决策**: 在 `onScanProgress` 的增量回调中使用 Set 过滤已存在的 id。

```tsx
setItems(prev => {
    const existingIds = new Set(prev.map(i => i.id));
    const newItems = data.batchItems!.filter(i => !existingIds.has(i.id));
    if (newItems.length === 0) return prev;
    return [...prev, ...newItems];
});
```

**理由**: 与 LargeFiles 现有去重逻辑完全一致，扫描引擎可能在多个批次中返回同一文件，通过 id 去重是最直接可靠的方式。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| IPC on* 返回值变化，现有未处理的调用方未使用返回的 cleanup 函数 | 保持向前兼容，不返回值不影响功能；返回值类型从 `void` 改为 `() => void`，TypeScript 检查会标记未使用返回值 |
| 共享常量提取后，`electron/ai-provider.js` 仍保留副本，可能不同步 | 提取后通过 IPC 的 `ai:get-config` 已是动态读取，主进程端使用自己的常量；若提供商变更，仍需同步修改主进程，这是有意为之的设计取舍 |
| `getEffectiveSafety` 去掉 useCallback 后触发少量额外渲染 | 该函数被传给 Table 的 render 中调用（行级），无优化效果反而浪费闭包，去掉后影响可忽略 |

## Open Questions

（无 — 所有决策在本设计文档中已覆盖）
