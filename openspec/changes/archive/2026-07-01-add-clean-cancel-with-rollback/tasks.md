## 1. Main Process — Cancel & Restore Logic

- [x] 1.1 Add module-level `cleanCancelled` and `cleanCompletedItems` variables in `main.js`
- [x] 1.2 Modify `clean:execute` worker pool to check `cleanCancelled` before each item, skip if true, and collect completed items
- [x] 1.3 Add `file-operator.js` — `restoreFromTrash(items)` function using PowerShell Shell.Application COM to restore files from recycle bin
- [x] 1.4 Add `clean:cancel` IPC handler — sets `cleanCancelled = true`, returns `{ cancelled: true }`
- [x] 1.5 Add `clean:restore` IPC handler — calls `restoreFromTrash(items)`, sends `clean:restore-progress` events, returns restore result
- [x] 1.6 Add `clean:cancelled` event emission after workers drain (send completedItems to renderer)
- [x] 1.7 Reset cancel state variables after clean/restore completes

## 2. Preload & Type Definitions

- [x] 2.1 Add `cancelClean()` to preload.js (`clean:cancel` IPC invoke)
- [x] 2.2 Add `restoreItems(items)` to preload.js (`clean:restore` IPC invoke)
- [x] 2.3 Add `onCleanCancelled(callback)` to preload.js (`clean:cancelled` event)
- [x] 2.4 Add `onRestoreProgress(callback)` to preload.js (`clean:restore-progress` event)
- [x] 2.5 Add `cancelClean`, `restoreItems`, `onCleanCancelled`, `onRestoreProgress` to `ElectronAPI` interface in `vite-env.d.ts`

## 3. SimpleMode — Cancel & Rollback UI

- [x] 3.1 Add cancel button in SimpleMode cleaning phase, replacing clean buttons during cleaning
- [x] 3.2 Add `restoring` phase handling: show rollback progress with file names
- [x] 3.3 Add rollback result display: restored/failed counts, "Open Recycle Bin" button on failure
- [x] 3.4 Register `onCleanCancelled` and `onRestoreProgress` listeners in SimpleMode useEffect

## 4. CleanItems — Cancel & Rollback UI

- [x] 4.1 Add cancel button visible when `cleaning` is true
- [x] 4.2 Handle cancel flow: call `cancelClean()`, await `onCleanCancelled`, then call `restoreItems()` with completed items
- [x] 4.3 Show rollback result via message (success/failure counts)
