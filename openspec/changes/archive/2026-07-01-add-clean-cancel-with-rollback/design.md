## Context

当前 `clean:execute` 使用固定并发池（200 条并发）逐项调用 `shell.trashItem` 移至回收站，一旦启动无法中断。没有机制记录已成功清理的文件列表，也没有 API 能从回收站还原文件。用户需要手动从回收站找回文件。

## Goals / Non-Goals

**Goals:**
- 清理过程中可触发取消，停止后续文件的清理
- 取消后自动将已移至回收站的文件还原回原始路径
- 提供前端 UI：取消按钮 + 回滚进度 + 结果展示
- 同时适配极简模式（SimpleMode）和逐项清理（CleanItems）

**Non-Goals:**
- 不改造扫描阶段的取消（已有 `scan:cancel`）
- 不引入第三方依赖
- 不改变现有文件删除的回收站策略（仍走 `shell.trashItem`）

## Decisions

### 1. 取消信号：模块级 `cancelled` 标志 + `completedItems` 数组
在 `main.js` 中维护两个模块级变量：

```
let cleanCancelled = false;
let cleanCompletedItems = [];  // { item: ScanItem, success: boolean }
```

`clean:execute` 的每个 worker 在处理下一项前检查 `cleanCancelled`。若为 true 则跳过剩余项。
`clean:cancel` 设置 `cleanCancelled = true`，workers 排空后 handler 返回 `completedItems`。

**为什么不使用 AbortController：** AbortController 适合 Promise 链，但当前 worker 池是 while-true + 共享索引模式，检查布尔标志更直接且零依赖。

### 2. 回滚实现：PowerShell Shell.Application COM

```powershell
$shell = New-Object -ComObject Shell.Application
$recycleBin = $shell.NameSpace(0xa)  # 0xa = Recycle Bin
foreach ($targetPath in $targetPaths) {
  foreach ($item in $recycleBin.Items()) {
    $orig = $recycleBin.GetDetailsOf($item, 1)  # "原始位置"
    if ($orig -eq $targetPath) {
      $item.InvokeVerb("restore")
    }
  }
}
```

**为什么不直接 `fs.rename`：** `shell.trashItem` 将文件移至 `$Recycle.Bin` 并以随机哈希重命名，原始路径仅保存在 `$I` 元数据文件中，无法通过文件系统直接还原。

**为什么不使用第三方库：** 保持零依赖，PowerShell COM 是 Windows 内置能力。

### 3. 前端状态扩展

SimpleMode：
- cleaning 阶段增加「终止清理」按钮
- 取消后进入新的 `restoring` 子阶段（回滚中）
- 回滚完成或失败后展示结果卡片

CleanItems：
- `cleaning=true` 时禁用清理按钮，增加「终止清理」按钮
- 回滚完成后 `cleaning=false` 并显示回滚结果消息

### 4. IPC 通道设计

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `clean:cancel` | renderer → main | 无 | `{ cancelled: true }` |
| `clean:restore` | renderer → main | `ScanItem[]` | `{ restored: number, failed: number, errors: string[] }` |

IPC 事件（main → renderer）：
| 事件 | 载荷 | 说明 |
|------|------|------|
| `clean:cancelled` | `{ completedItems: ScanItem[] }` | 取消已完成，携带已清理列表 |
| `clean:restore-progress` | `{ current, total, itemName }` | 回滚逐条进度 |

## Risks / Trade-offs

- **[兼容性] PowerShell COM 列索引**：`GetDetailsOf(item, 1)` 在 Win10/Win11 中返回"原始位置"，未测试更旧系统。→ **缓解**：若 PowerShell 脚本失败，回退到打开回收站让用户手动恢复。
- **[竞态] 取消后文件可能已被用户手动操作**：取消后回滚时，某些文件可能已被用户从回收站删除或还原。→ **缓解**：回滚每个文件独立 try-catch，失败不阻塞后续。
- **[性能] 大批量回滚**：若已清理数千项，循环遍历回收站所有项匹配路径较慢。→ **缓解**：对 200 并发池而言单次清理项有限（每次 `clean:execute` 最多 ~200 项同时处理），回滚规模可控。
