## 1. Flex 布局修复（Bug 1 + Bug 2）

- [x] 1.1 在 content div（SimpleMode.tsx ~L461）添加 `minHeight: 0`，允许 flex 容器收缩到低于内容最小高度
- [x] 1.2 在 scanning phase div（~L511）添加 `minHeight: 0` 作为防御性编程
- [x] 1.3 移除 scanning 阶段左面板的 `justifyContent: 'center'`（~L520），改为 `justifyContent: 'flex-start'` 或直接移除该属性
- [ ] 1.4 验证：扫描大量文件时右侧列表可正常滚动，左侧状态面板全程可见（需手动测试）

## 2. IPC 监听器清理（Bug 3）

- [x] 2.1 在 `preload.js` 中暴露 `removeAllListeners(channel)` 方法到 `electronAPI`
- [x] 2.2 在 SimpleMode.tsx 的 `useEffect` 中添加 cleanup 函数，在组件卸载时移除 5 个 IPC 通道的监听器
- [ ] 2.3 验证：在开发模式（React StrictMode）下扫描，控制台不再输出 duplicate key 报错（需手动测试）

## 3. 回归验证

- [ ] 3.1 验证极简模式完整流程：idle → scanning → scan-done → cleaning → clean-done（需手动测试）
- [ ] 3.2 验证高级模式未受影响（SimpleMode 改动不波及 AdvancedMode）（需手动测试）
