## 1. 创建共享配置模块

- [x] 1.1 新建 `src/shared/provider-config.ts`，定义 `PRESET_PROVIDERS` 和 `PresetProvider` 类型
- [x] 1.2 更新 `AIAssistant.tsx`，删除本地 `PRESET_PROVIDERS`，替换为 import 共享版本，验证功能正常
- [x] 1.3 更新 `AIConfigPage.tsx`，删除本地 `PRESET_PROVIDERS`，替换为 import 共享版本，验证功能正常

## 2. 修复 AIConfigPage 模型名（已随共享配置导入自动修复）

- [x] 2.1 DeepSeek 模型名改为 `deepseek-v4-flash`（共享配置中已修正）
- [x] 2.2 MiniMax 模型名改为 `Minimax-M3`（共享配置中已修正）

## 3. 重构 IPC 监听器模式

- [x] 3.1 修改 `electron/preload.js` 中所有 `on*` 方法，改为返回 cleanup 函数
- [x] 3.2 更新 `src/vite-env.d.ts` 中 `ElectronAPI` 接口，将所有 `on*` 方法返回类型从 `void` 改为 `() => void`
- [x] 3.3 更新 `SimpleMode.tsx`：移除 `removeAllListeners` cleanup，改用 cleanup 函数数组
- [x] 3.4 更新 `LargeFiles.tsx`：移除 `listenerRegistered` ref 守卫，在 `useEffect` 中注册并返回 cleanup
- [x] 3.5 更新 `CleanItems.tsx`：移除 `listenerRegistered` ref 守卫，在 `useEffect` 中注册并返回 cleanup
- [x] 3.6 检查其他页面 — SpaceOverview/AIAssistant/AIConfigPage/SettingsPage 均无 IPC 监听器，无需处理

## 4. 修复 CleanItems 扫描去重

- [x] 4.1 修改 `CleanItems.tsx:66` 的 `onScanProgress` 回调，添加 Set 去重

## 5. 修正大文件 AI 批量分析 tooltip

- [x] 5.1 将 `LargeFiles.tsx` 中 AI 批量分析按钮的 `title` 属性改为与实际行为一致

## 6. 删除无效代码

- [x] 6.1 删除 `electron/scanner.js:281` 中 `largeFiles.totalSize = largeFiles.reduce(...)` 行
- [x] 6.2 移除 `LargeFiles.tsx` 中 `getEffectiveSafety` 的 `useCallback` 包装，改为普通 `const` 函数

## 7. 改进 store.js 错误可观测性

- [x] 7.1 在 `electron/store.js` 的 `_save` 方法 catch 块中添加 `console.error('[Store] 写入配置文件失败:', err.message)`
