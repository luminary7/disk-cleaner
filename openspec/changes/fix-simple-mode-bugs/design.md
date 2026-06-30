## Context

极简模式（SimpleMode.tsx）使用六阶段状态机（idle → scanning → scan-done → cleaning → clean-done → error）管理扫描和清理流程。当前存在三个 Bug，均与扫描阶段（scanning）的渲染行为相关。

Bug 1 和 Bug 2 共享同一根本原因：flex 布局链中缺少 `min-height: 0`，导致中间容器被撑高至子元素总高度，`overflow-y: auto` 无法触发，且 `justify-content: center` 将内容推至视口之外。Bug 3 则是 IPC 监听器未清理导致的累积副作用。

## Goals / Non-Goals

**Goals:**
- 修复右侧文件列表滚动（`overflow-y: auto` 在文件超量时正常生效）
- 修复扫描中左侧状态面板持续可见
- 消除 React duplicate key 报错
- 最小化改动范围，不引入新功能

**Non-Goals:**
- 不重构 SimpleMode 组件架构
- 不改变扫描/清理的业务逻辑
- 不改动扫动画效果或交互流程
- 不改动 IPC 通道命名

## Decisions

### 决策 1：添加 `minHeight: 0` 而非 `overflow: hidden`

**选项 A**：在 content div 添加 `minHeight: 0`（选中的方案）
**选项 B**：在 content div 添加 `overflow: hidden`
**选项 C**：在 scanning 阶段的外层 div 设置固定高度

选择 A 的原因：
- `min-height: 0` 是 Flexbox 规范中解决此类问题的标准方案，语义准确——它只是允许容器收缩到低于内容最小高度，不改变裁剪行为
- `overflow: hidden` 虽然也能触发同一效果（因为 overflow 非 visible 会隐含 `min-height: 0`），但会额外裁剪掉子元素的阴影、溢出动画等视觉效果，引入不必要的约束
- 固定高度方案违背响应式设计原则，在不同窗口尺寸下需要维护

**影响**：SimpleMode.tsx 第 461 行的 content div 样式增加 `minHeight: 0`，同时在第 511 行的 scanning phase div 也增加 `minHeight: 0`（防御性编程，确保 flex 链每层都可收缩）

### 决策 2：移除 scanning 阶段左面板的 `justifyContent: 'center'`

尽管 `min-height: 0` 的修复可以使面板高度恢复正常（等于视口可用高度），但 `justify-content: center` 仍然会在垂直方向上居中内容。在可用高度不确定时（如窗口 resize），居中可能导致顶部信息部分裁剪。改为 `flex-start` 让内容从顶部排列更可靠。

**影响**：SimpleMode.tsx 第 520 行的 scanning 左面板 style 中移除 `justifyContent: 'center'`

### 决策 3：在 preload.js 中增加 IPCRenderer 移除方法

渲染进程的 `useEffect` 无法直接调用 `ipcRenderer.removeAllListeners`，因为 preload.js 的 contextBridge 只暴露了 `on*` 方法。需要在 preload.js 中为每个监听通道暴露对应的 `remove*` 或 `off*` 方法。

**选项 A**：暴露 `removeAllListeners(channel)` 通用方法（选中的方案）
**选项 B**：在每个 `on*` 方法中返回取消函数
**选项 C**：每个通道单独暴露 `off*` 方法

选择 A 的原因：
- 通用方法最简洁，维护成本最低
- 与 `ipcRenderer.removeAllListeners` 语义一致
- 调用方（SimpleMode.tsx）只需在 cleanup 中调用一次，不必记住每个通道
- 选项 B 要求修改 preload 的返回类型为函数而非 void，破坏现有接口类型签名

**影响**：preload.js 新增一行 `removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)`

### 决策 4：useEffect cleanup 策略

在 SimpleMode.tsx 的 `useEffect` 返回的 cleanup 函数中调用 `window.electronAPI.removeAllListeners('scan:progress')` 等。

由于 scan:progress、scan:complete、clean:progress、clean:complete、scan:error 这 5 个通道在该组件中注册，cleanup 时应全部移除。

注意：不要在 cleanup 中使用 `removeAllListeners()` 无参数形式，这会清除组件外其他 IPC 监听器。必须显式指定通道名。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|---------|
| `removeAllListeners(channel)` 可能移除其他组件注册的同通道监听器 | 目前 SimpleMode 是唯一使用 scan:* 和 clean:* 通道的组件；高级模式使用独立的通道命名空间（`ai:chat` 等） |
| React StrictMode 下 double-render 导致二次 cleanup | cleanup 函数幂等，重复调用无害 |
| `min-height: 0` 在某些旧版 Electron/Chromium 中可能不被支持 | 当前 Electron 版本基于 Chromium 124+，Flexbox `min-height: 0` 自 Chrome 48 起稳定支持 |
