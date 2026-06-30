## Context

当前工具仅支持扫描 C 盘，因为：
- `scanner.js` 中 `SCAN_TARGETS` 的路径全部基于 `os.tmpdir()`、`os.homedir()`、`process.env.windir` 推导——这些在 Windows 上通常都指向 C 盘
- `startLargeFileScan` 硬编码 `rootDirs = ['C:\\']`
- `rule-engine.js` 的 `SYSTEM_EXCLUSIONS` 正则硬编码了 `C:\` 前缀
- 前端没有让用户选择盘符的入口

本次改动需要影响 3 个层面：IPC 层（新增盘符检测通道 + 修改现有扫描通道签名）、主进程（扫描引擎/规则引擎/IPC 处理器）、渲染进程（盘符选择 UI + 扫描调用方）。

## Goals / Non-Goals

**Goals:**
- 扫描前弹出盘符选择弹窗，列出当前系统所有可用盘符
- 垃圾文件扫描（startScan）支持指定盘符列表
- 大文件扫描（startLargeFileScan）支持指定盘符列表
- 规则引擎的排除路径匹配不再硬编码 C:
- 扫描目标路径从以 C 盘为根改为以所选盘符为根自适应推导

**Non-Goals:**
- 不涉及文件清理环节的改动（清理按路径操作，路径已正确即可）
- 不修改 AI 相关功能
- 不涉及网络驱动器、可移动驱动器的高级过滤（仅排除不可用盘符）

## Decisions

### 1. 盘符检测：Node.js `fs.readdir` 枚举驱动器根目录
Windows 可用盘符可通过读取 `A:\` 到 `Z:\` 并检查 `fs.access` 来检测。
**替代方案**：使用 `child_process.exec('wmic logicaldisk get name')`。但 `wmic` 已弃用且跨平台差。
**选择**：纯 `fs.readdir` + `fs.access` 检测，简单可控。

### 2. 扫描签名：drives 参数以数组形式传入
`startScan(drives)` 和 `startLargeFileScan(drives)` 接受 `string[]`。
- `drives` 格式：`['C:\\', 'D:\\', 'E:\\']`（带反斜杠的 Windows 标准盘符格式）
- 当 `drives` 为空或未传时，默认回退为 `['C:\\']` 保持向后兼容

### 3. SCAN_TARGETS 路径适配：用盘符前缀拼接
当前路径都是绝对路径（如 `C:\Users\xxx\AppData\...`），直接将路径中的盘符替换为用户选择盘符：
- 垃圾文件扫描：`os.tmpdir()` → 替换为所选盘符的对应路径
- 大文件扫描：直接以所选盘符作为根目录遍历

### 4. 规则引擎排除规则：改为通用路径前缀匹配
将 `C:\Windows` 等正则改为 `[A-Z]:\\Windows`，不依赖特定盘符。

### 5. 盘符选择弹窗：Ant Design Modal + Checkbox 组
使用现有 Ant Design（已在项目依赖中）的 `Modal` + `Checkbox.Group` 组件实现，无需新增第三方依赖。

### 6. 弹窗触发时机：在 idle 阶段点击"开始扫描"后立即弹出
扫描流程改为：idle → 用户点击扫描 → 盘符弹窗 → 用户确认 → scanning → scan-done
大文件扫描同理。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 非 C 盘目录结构不同，某些缓存路径可能不存在 | `fs.access` 已用于检查路径是否存在，不存在的路径静默跳过 |
| D/E 盘可能是光驱或可移动介质，扫描会卡慢 | detectDrives 时对光驱等特殊驱动器挂载点做过滤（检查 `fs.stat` 是否为固定磁盘） |
| 同时扫描多个盘符耗时大幅增加 | 扫描流程本身就是异步递归的，可以并行扫描多个盘的 SCAN_TARGETS |
| 非 C 盘上的 `AppData` 等路径可能不存在 | 路径自适应规则（见多盘扫描器 spec）保证按每个盘的根目录相对推导 |
