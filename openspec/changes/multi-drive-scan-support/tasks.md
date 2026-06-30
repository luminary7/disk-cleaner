## 1. 规则引擎多盘兼容

- [x] 1.1 修改 `rule-engine.js`：`SYSTEM_EXCLUSIONS` 正则中的 `C:\\` 改为 `[A-Z]:\\\\` 通用匹配
- [x] 1.2 验证所有排除正则对 D:\Windows、E:\Program Files 等路径正确匹配

## 2. 主进程—盘符检测

- [x] 2.1 在 `main.js` 中新增 `drives:detect` IPC 通道，枚举 A:\~Z:\ 并用 `fs.access` 检测可用性
- [x] 2.2 盘符检测返回格式：`{ letter: 'C', label: '系统', path: 'C:\\' }[]`

## 3. 扫描引擎—多盘支持

- [x] 3.1 修改 `scanner.js` 的 `startScan(drives?)` 函数，接受可选的 drives 参数，默认 `['C:\\']`
- [x] 3.2 实现路径自适应逻辑：将 `os.tmpdir()`、`os.homedir()`、`process.env.windir` 等路径的盘符替换为所选盘符
- [x] 3.3 修改 `startLargeFileScan(drives?)` 函数，接受可选的 drives 参数，替换硬编码的 `rootDirs`
- [x] 3.4 进度消息中增加盘符信息（如 "正在扫描 [D:] Chrome 缓存..."）

## 4. IPC 层—类型定义与桥接

- [x] 4.1 在 `vite-env.d.ts` 中添加 `DriveInfo` 类型和 `detectDrives` 方法签名
- [x] 4.2 更新 `startScan` 和 `startLargeFileScan` 类型定义，增加 drives 可选参数
- [x] 4.3 在 `preload.js` 中暴露 `detectDrives` 方法
- [x] 4.4 修改 `preload.js` 中 `startScan` 和 `startLargeFileScan` 方法以支持 drives 参数
- [x] 4.5 在 `main.js` 中修改 `scan:start` 和 `largefile:start` 处理器以接收并传递 drives 参数

## 5. 前端—盘符选择弹窗组件

- [x] 5.1 创建 `src/components/DriveSelectModal.tsx`：Ant Design Modal + Checkbox.Group，展示可用盘符
- [x] 5.2 支持选中至少一个盘符的校验，默认选中 C:
- [x] 5.3 支持取消关闭（不启动扫描）
- [x] 5.4 驱动组件接收 `onConfirm(drives: string[])` 和 `onCancel` 回调

## 6. 前端—SimpleMode 集成

- [x] 6.1 修改 `SimpleMode.tsx`：点击"开始扫描"后先弹出盘符选择弹窗
- [x] 6.2 用户确认后将选中盘符数组传入 `startScan(drives)`

## 7. 前端—LargeFiles 集成

- [x] 7.1 修改 `LargeFiles.tsx`：点击"开始扫描"后先弹出盘符选择弹窗
- [x] 7.2 用户确认后将选中盘符数组传入 `startLargeFileScan(drives)`
