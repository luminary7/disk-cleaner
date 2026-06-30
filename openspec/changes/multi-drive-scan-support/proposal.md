## Why

当前扫描范围完全固定为 C 盘——所有扫描目标路径基于 `os.tmpdir()`、`os.homedir()`、`process.env.windir`，大文件扫描的根目录也硬编码为 `['C:\\']`。用户无法选择其他盘符进行扫描，导致 D/E/F 等盘上的缓存、临时文件和大文件无法被工具发现和清理。

## What Changes

- 新增「选择扫描盘符」弹窗：用户在扫描前可从当前电脑所有可用盘符中勾选目标
- 扫描引擎改为多盘兼容：垃圾文件扫描 + 大文件扫描均支持指定盘符列表
- 将现有路径从固定 C 盘推导改为以选择的盘符为基准进行自适应
- 规则引擎排除列表支持多盘路径匹配（目前仅匹配 `C:\Windows` 等 C 盘前缀）
- IPC 层新增 `drives:detect` 通道获取可用盘符列表
- `startScan` / `startLargeFileScan` 接口增加 `drives` 参数

## Capabilities

### New Capabilities
- `drive-selection-dialog`: 扫描前弹出盘符选择弹窗，检测并展示当前系统所有可用盘符（排除软驱等不可用盘符），支持多选
- `multi-drive-scanner`: 核心扫描引擎扩展，支持对多个盘符分别执行垃圾文件扫描和大文件扫描，汇总结果返回前端

### Modified Capabilities
- *(无现有 spec 需要修改)*

## Impact

- **electron/scanner.js**: SCAN_TARGETS 路径改为基于所选盘符推导；startScan/startLargeFileScan 增加 drives 参数
- **electron/rule-engine.js**: SYSTEM_EXCLUSIONS 改为多盘通用匹配（不再硬编码 C:）
- **electron/main.js**: 新增 `drives:detect` IPC 通道；修改 `scan:start`/`largefile:start` 处理器传递 drives
- **electron/preload.js**: 暴露 `detectDrives` 方法；修改 `startScan`/`startLargeFileScan` 签名
- **src/vite-env.d.ts**: ElectronAPI 接口新增 `detectDrives`；更新 `startScan`/`startLargeFileScan` 签名
- **src/pages/SimpleMode.tsx**: 扫描前弹出盘符选择弹窗；handleScan 传递选中盘符
- **src/pages/LargeFiles.tsx**: 大文件扫描前弹出盘符选择弹窗
- **src/pages/SpaceOverview.tsx**: 可能需要显示盘符信息（如涉及多盘统计）
