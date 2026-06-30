## Why

极简模式（SimpleMode）存在三个功能性缺陷：右侧扫描结果列表无法滚动查看更多文件、扫描过程中左侧状态面板内容消失不可见、以及 React 报 duplicate key 错误。这三个问题严重影响了极简模式的核心用户体验——用户无法在扫描过程中查看进度，也无法浏览完整的扫描结果。

## What Changes

- **修复右侧文件列表无法滚动**：在 flex 布局链的中间层容器添加 `min-height: 0`，使 `overflow-y: auto` 在列表超出容器高度时正常生效
- **修复扫描中左侧状态面板消失**：同上 `min-height: 0` 修复，消除 `justify-content: center` 在 inflated 容器中将内容推出可视区的副作用
- **修复 React duplicate key 报错**：在 `useEffect` 中添加 IPC 监听器的清理函数，防止组件卸载/重挂载时监听器重复注册导致回调重复执行，进而产生重复的 key
- **涉及文件**：`src/pages/SimpleMode.tsx`、`electron/preload.js`

## Capabilities

本次变更为纯缺陷修复，不引入新功能，无需修改 spec 级别的行为契约。

### New Capabilities

无

### Modified Capabilities

无

## Impact

- **SimpleMode.tsx**：flex 布局样式调整 + useEffect cleanup 逻辑
- **preload.js**：增加 IPC 监听器的移除方法（`removeAllListeners`），确保渲染进程可以正确清理
- 无新增依赖，无 API 签名变更
