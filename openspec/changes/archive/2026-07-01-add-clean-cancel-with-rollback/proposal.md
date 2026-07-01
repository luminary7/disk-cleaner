## Why

当前清理（`clean:execute`）启动后无法中途停止。当用户误操作选择了大量文件开始清理，或清理过程中发现异常时，没有紧急中止的手段。已移至回收站的文件也无法批量还原，用户只能逐个从回收站手动恢复。

## What Changes

- 在 IPC 层新增 `clean:cancel` 通道，允许渲染进程通知主进程停止清理
- 在 `clean:execute` 的并发池中加入取消信号，每个 worker 在处理下一项前检查该信号
- 新增 `clean:restore` IPC 通道，接收已成功清理的文件列表，通过 PowerShell 从回收站还原到原路径
- 前端清理阶段增加「终止清理」按钮，点击后：停止剩余文件清理 → 自动回滚已移至回收站的文件 → 显示回滚结果
- 清理结束后新增「回滚」入口，允许用户在 clean-done 后手动触发回滚

## Capabilities

### New Capabilities
- `clean-cancel-with-rollback`: 清理过程中止与回滚能力。包含主进程的取消/回滚 IPC、并发池中断机制、PowerShell 回收站还原，以及前端的取消按钮与回滚进度/结果展示。

### Modified Capabilities
- （无现有 spec 被修改）

## Impact

- **electron/main.js**: 新增 `clean:cancel` 和 `clean:restore` IPC handler
- **electron/file-operator.js**: 新增 `cancelClean()` 和 `restoreFromTrash(items)` 方法
- **electron/preload.js**: 暴露 `cancelClean()` 和 `restoreItems(items)` API
- **src/vite-env.d.ts**: 在 `ElectronAPI` 接口中新增对应方法签名
- **src/pages/SimpleMode.tsx**: 清理阶段增加取消按钮、回滚进度/结果展示
- **src/pages/CleanItems.tsx**: 清理阶段增加取消按钮、回滚进度/结果展示
