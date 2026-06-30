# C盘智能清理工具 — 开发文档

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [快速开始](#3-快速开始)
4. [项目结构](#4-项目结构)
5. [架构设计](#5-架构设计)
6. [主进程详解](#6-主进程详解)
7. [渲染进程详解](#7-渲染进程详解)
8. [IPC 通信层](#8-ipc-通信层)
9. [数据流](#9-数据流)
10. [类型系统](#10-类型系统)
11. [安全机制](#11-安全机制)
12. [构建与打包](#12-构建与打包)
13. [常见任务](#13-常见任务)

---

## 1. 项目概述

C盘智能清理工具（C Drive Cleaner）是一款 Windows 桌面应用，用于智能扫描和清理 C 盘上的缓存文件、临时文件和大文件。应用提供两种操作模式：

- **极简模式（SimpleMode）：** 面向普通用户，一键扫描 → 一键清理，六阶段状态机驱动（idle → scanning → scan-done → cleaning → clean-done → error）
- **高级模式（AdvancedMode）：** 面向进阶用户，侧边导航 + 多标签页，包含空间概览（ECharts 饼图）、逐项清理、大文件分析、AI 辅助决策

所有删除操作默认移至回收站（`shell.trashItem`），不做永久删除。

---

## 2. 技术栈

### 框架与运行时

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | ~42.5.1 | 桌面应用容器，主进程 + 渲染进程架构 |
| React | ~19.2.7 | UI 渲染 |
| TypeScript | ~6.0.3 | 类型安全 |
| Vite | ~8.1.0 | 构建工具（开发服务器 + 生产构建） |

### UI 与可视化

| 技术 | 版本 | 用途 |
|------|------|------|
| Ant Design | ~6.5.0 | UI 组件库 |
| @ant-design/icons | ~6.3.2 | 图标库 |
| ECharts | ~6.1.0 | 饼图/图表可视化 |
| echarts-for-react | ~3.0.6 | ECharts React 封装 |
| GSAP | ~3.15.0 | 动画（粒子背景、页面过渡） |

### 构建与分发

| 技术 | 版本 | 用途 |
|------|------|------|
| electron-builder | ~26.15.3 | 打包为 Windows 安装程序 |
| concurrently | ~10.0.3 | 并发启动 Vite + Electron 开发模式 |
| cross-env | ~10.1.0 | 跨平台环境变量设置 |
| wait-on | ~9.0.10 | 等待开发服务器就绪 |

---

## 3. 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9
- Windows 10/11（因扫描目标为 Windows 缓存目录）

### 安装与运行

```bash
# 安装依赖
npm install

# 浏览器开发模式（仅前端，无 Electron API）
npm run dev
# 访问 http://localhost:5173

# Electron 完整开发模式（前端 + Electron）
npm run electron:dev

# 生产构建
npm run build

# 打包为 Windows 安装程序
npm run electron:build
```

### 脚本说明

| 命令 | 执行内容 |
|------|----------|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | Vite 生产构建，输出到 `dist/` |
| `npm run electron:dev` | 并发启动 Vite + Electron，设置 `NODE_ENV=development` |
| `npm run electron:build` | 先 `vite build`，再 `electron-builder` 打包 |
| `npm run preview` | 预览 Vite 构建产物 |

---

## 4. 项目结构

```
C盘清理工具/
├── electron/                  # 主进程（Node.js 环境）
│   ├── main.js                # 入口：窗口管理 + IPC 注册
│   ├── preload.js             # contextBridge 暴露 API 到渲染进程
│   ├── scanner.js             # 缓存目录/大文件递归扫描引擎
│   ├── rule-engine.js         # 离线安全规则（排除列表 + 安全等级）
│   ├── file-operator.js       # 文件移至回收站 + 系统还原点
│   ├── file-detail.js         # 单文件元信息获取
│   ├── ai-provider.js         # OpenAI 兼容 API 客户端
│   ├── store.js               # JSON 文件持久化（设置/预设）
│   └── logger.js              # 操作日志写入与读取
│
├── src/                       # 渲染进程（React 环境）
│   ├── main.tsx               # React 入口
│   ├── App.tsx                 # 根组件（路由/模式切换）
│   ├── vite-env.d.ts          # 全局类型声明
│   │
│   ├── pages/
│   │   ├── SimpleMode.tsx      # 极简模式（六阶段 UI）
│   │   ├── AdvancedMode.tsx    # 高级模式（侧边导航 + 多标签）
│   │   ├── SpaceOverview.tsx   # 空间概览（ECharts 饼图 + Top 10）
│   │   ├── CleanItems.tsx      # 逐项清理（安全等级标记 + 勾选）
│   │   ├── LargeFiles.tsx      # 大文件分析（类型筛选 + AI）
│   │   ├── AIAssistant.tsx     # AI 助手（对话界面）
│   │   ├── AIConfigPage.tsx    # AI 配置（预设/自定义）
│   │   └── SettingsPage.tsx    # 应用设置
│   │
│   ├── components/
│   │   ├── ParticleBackground.tsx  # GSAP Canvas 粒子动画
│   │   ├── FloatingLines.tsx       # 浮动线条装饰背景
│   │   ├── FloatingLines.css       # 浮动线条样式
│   │   └── DriveSelectModal.tsx    # 盘符选择弹窗
│   │
│   └── store/
│       └── AppContext.tsx      # Context + useReducer 全局状态
│
├── public/
│   └── icon.png               # 应用图标源文件
│
├── src/assets/                 # 设计素材
│   ├── logo.png
│   ├── logo-candidates/        # Logo 设计备选
│   └── ui-kit/                 # UI 插画素材
│       ├── ai-analysis.png
│       ├── app-cache.png
│       ├── browser-cache.png
│       ├── caution-protect.png
│       ├── disk-drive.png
│       ├── large-file.png
│       ├── safe-clean.png
│       ├── scan-state.png
│       ├── system-cache.png
│       └── temp-cache.png
│
├── index.html                 # HTML 入口
├── vite.config.ts             # Vite 配置
├── package.json               # 依赖 + electron-builder 配置
├── tsconfig.json              # TypeScript 配置
├── CLAUDE.md                  # AI 辅助开发指南
└── DEVELOPMENT.md             # 本文件
```

---

## 5. 架构设计

应用采用经典的 Electron 三層架构：

```
┌─────────────────────────────────────────────────┐
│              渲染进程 (React)                     │
│  SimpleMode  AdvancedMode  SpaceOverview  ...    │
│        └──────────┬──────────┘                   │
│              AppContext                           │
│         (useReducer 全局状态)                     │
└──────────────────┬──────────────────────────────┘
                   │ contextBridge
                   │ window.electronAPI.xxx()
┌──────────────────┴──────────────────────────────┐
│              preload.js (桥接层)                   │
│      ipcRenderer.invoke / ipcRenderer.on         │
└──────────────────┬──────────────────────────────┘
                   │ IPC (主进程)
┌──────────────────┴──────────────────────────────┐
│              主进程 (Node.js)                     │
│  scanner    rule-engine    file-operator         │
│  ai-provider    store    logger    file-detail   │
│              main.js (调度中心)                   │
└─────────────────────────────────────────────────┘
```

### 设计原则

- **安全隔离：** 使用 `contextIsolation: true` 和 `nodeIntegration: false`，渲染进程无法直接访问 Node.js API
- **桥接通信：** 所有主进程操作通过 `contextBridge.exposeInMainWorld` 暴露的 `electronAPI` 调用
- **安全双校验：** `rule-engine.js` 的 `isExcludedPath` 在扫描时跳过 + 删除时再次校验，防止绕过
- **回收站优先：** 所有删除操作使用 `shell.trashItem` 移至回收站，不做永久删除

---

## 6. 主进程详解

### 6.1 main.js — 入口与 IPC 调度

窗口配置：
- 尺寸：1000 × 750，最小 800 × 600
- 开发模式：`loadURL('http://localhost:5173')` + 自动打开 DevTools
- 生产模式：`loadFile('dist/index.html')`

IPC 通道按功能域注册（详见第 8 节）。

### 6.2 scanner.js — 扫描引擎

扫描流程：

```
startScan(drives)
  │
  ├─ 遍历预定义缓存目录列表
  │    ├─ temp     → os.tmpdir()
  │    ├─ browser  → Chrome/Edge/360/IE 缓存
  │    ├─ app      → 微信/QQ/钉钉缓存
  │    ├─ system   → 系统日志/DeliveryOptimization
  │    └─ large-file → 用户指定目录
  │
  ├─ 每条文件经过 rule-engine 判定 safety
  ├─ 每批次通过 onScanProgress 推送
  └─ 完成后回传完整 ScanResult
```

大文件扫描（`startLargeFileScan`）：递归遍历用户指定目录，按大小排序，返回 Top N。

取消机制：设置模块级 `cancelRequested = true`，扫描循环检查标志位后退出。

### 6.3 rule-engine.js — 安全规则引擎

定位：离线安全评估，无需 AI。

#### 排除列表（始终跳过）

```javascript
C:\Windows
C:\Program Files
C:\Program Files (x86)
C:\ProgramData
C:\Boot
C:\System Volume Information
C:\$Recycle.Bin
C:\Recovery
```

#### 系统文件扩展名（标记为 keep）

`.sys` `.dll` `.exe` `.ocx` `.drv` `.cpl`

#### 安全等级判定

| 类别 | safe 条件 | caution 条件 | keep 条件 |
|------|-----------|-------------|-----------|
| temp | 修改时间 > 24 小时前 | ≤ 24 小时 | — |
| browser | 修改时间 > 7 天前 | ≤ 7 天 | — |
| app | 修改时间 > 3 天前 | ≤ 3 天 | — |
| system | — | 始终 caution | — |
| large-file | < 1 GB | ≥ 1 GB | — |
| 系统路径/扩展名 | — | — | 始终 keep |

底層函数：`getAgeHours(mtimeMs)` 计算文件修改时间距今的小时数。

### 6.4 file-operator.js — 文件操作

- **moveToTrash(itemPath)：** 移动单条到回收站，操作前再次调用 `isExcludedPath` 安全校验
- **moveBatchToTrash(items)：** 批量操作，返回每条结果
- **createSystemRestorePoint()：** 调用 PowerShell `Checkpoint-Computer`，60 秒超時

### 6.5 ai-provider.js — AI 客户端

支持三种模式：
- `disabled`：关闭 AI 功能
- `preset`：从内建预设中选择（DeepSeek / MiniMax / SiliconFlow）
- `custom`：自定义 endpoint 和 model

预设提供者：

| 名称 | 端点 | 默认模型 |
|------|------|----------|
| deepseek | `https://api.deepseek.com` | deepseek-v4-flash |
| minimax | `https://api.minimax.chat/v1` | Minimax-M3 |
| siliconflow | `https://api.siliconflow.cn/v1` | Qwen/Qwen2.5-7B-Instruct |

### 6.6 store.js — 持久化存储

基于 JSON 文件的键值存储，存储路径：`app.getPath('userData')/config.json`

存储内容：
- `aiConfig`：AI 配置（mode / endpoint / apiKey / model）
- `aiPresets`：用户自定义预设列表
- `aiActivePreset`：当前激活的预设名称
- `settings`：应用设置（createRestorePoint）

### 6.7 logger.js — 操作日志

日志格式：`[timestamp] action: details`，记录每次清理操作的文件路径和结果。

### 6.8 file-detail.js — 文件详情

获取单文件的元信息（大小、修改时间、类型等），供 AI 分析使用。

---

## 7. 渲染进程详解

### 7.1 页面路由

应用在 `App.tsx` 中维护当前模式状态，切换 `SimpleMode` 和 `AdvancedMode` 两个顶级页面。

#### SimpleMode（极简模式）

六阶段状态机：

```
idle → scanning → scan-done → cleaning → clean-done
                        ↓
                     error
```

每个阶段对应 UI 状态：
- **idle：** 显示"开始扫描"按钮，FloatingLines 背景
- **scanning：** 实时进度条，ParticleBackground 动效
- **scan-done：** 扫描结果摘要（文件数 + 可释放空间），可切换清理或进入高级模式
- **cleaning：** 清理进度条
- **clean-done：** 清理结果展示（释放空间 + 文件数）
- **error：** 错误信息 + 重试按钮

#### AdvancedMode（高级模式）

侧边导航 + 内容区布局，导航项：

| 图标 | 标签 | 组件 | 功能 |
|------|------|------|------|
| 圆环图 | 空间概览 | SpaceOverview | ECharts 饼图 + 分类 Top 10 |
| 复选框 | 逐项清理 | CleanItems | 安全等级标记 + 勾选删除 |
| 文件夹 | 大文件分析 | LargeFiles | 类型筛选 + AI 分析 + 单文件详情 |
| 机器人 | AI 助手 | AIAssistant | AI 对话 + 文件分析 |
| 设置 | AI 配置 | AIConfigPage | 预设/自定义模式 + 预设管理 |
| 工具 | 设置 | SettingsPage | 还原点开关等 |

### 7.2 SpaceOverview（空间概览）

- ECharts 饼图：按分类（temp / browser / app / system / large-file）展示空间分布
- Top 10 列表：按大小排序的可清理文件
- 空状态设计：FloatingLines 动态背景 + 引导文字

### 7.3 CleanItems（逐项清理）

- 列表展示每条文件：名称、路径、分类、大小
- 安全等级标记：safe（绿色）/ caution（黄色）/ keep（灰色）
- 按分类筛选
- 全选/反选 + 批量清理

### 7.4 LargeFiles（大文件分析）

- 递归扫描用户指定目录
- 按文件类型筛选（文档 / 视频 / 压缩包 / 其他）
- AI 分析按钮：调用 ai-provider 判断文件是否可删
- 单文件详情弹窗

### 7.5 AIAssistant（AI 助手）

- 对话界面，上下文保持
- 支持发送扫描摘要让 AI 给出清理建议
- 支持单文件分析：调用 `file-detail.js` 获取元信息后发送给 AI

### 7.6 状态管理 — AppContext

```typescript
interface AppState {
  scanResult: ScanItem[] | null;      // 扫描结果
  totalScanSize: number;               // 扫描总大小
  isScanning: boolean;                 // 扫描中
  scanProgress: ScanProgress | null;   // 扫描进度
  cleanResult: CleanResult | null;     // 清理结果
  isCleaning: boolean;                 // 清理中
  cleanProgress: CleanProgress | null; // 清理进度
  aiConfig: AIConfig | null;           // AI 配置
  settings: Settings;                  // 应用设置
}
```

Action 类型：`SET_SCAN_RESULT` / `SET_SCANNING` / `SET_SCAN_PROGRESS` / `SET_CLEAN_RESULT` / `SET_CLEANING` / `SET_CLEAN_PROGRESS` / `SET_AI_CONFIG` / `SET_SETTINGS`

---

## 8. IPC 通信层

### 8.1 通道命名规范

格式：`模块名:动作`

### 8.2 通道列表

#### 扫描相关

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `scan:start` | invoke | `drives: string[]` | `ScanResult` |
| `scan:cancel` | invoke | — | `void` |
| `scan:progress` | on | `ScanProgress` | — |
| `scan:complete` | on | `ScanResult` | — |

#### 大文件扫描

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `largefile:start` | invoke | `drives: string[]` | `ScanItem[] + totalSize` |
| `largefile:cancel` | invoke | — | `void` |
| `largefile:progress` | on | `ScanProgress` | — |
| `largefile:complete` | on | `{items, totalSize}` | — |

#### 清理相关

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `clean:execute` | invoke | `items: ScanItem[]` | `{itemCount, freedBytes}` |
| `clean:progress` | on | `{current, total, currentItem}` | — |
| `clean:complete` | on | `{itemCount, freedBytes}` | — |

#### AI 相关

| 通道 | 方向 | 说明 |
|------|------|------|
| `ai:test-connection` | invoke | 测试 AI 连接 |
| `ai:suggest` | invoke | 获取清理建议 |
| `ai:chat` | invoke | 对话 |
| `ai:analyze-files` | invoke | 批量分析文件 |
| `ai:analyze-single-file` | invoke | 单文件分析 |
| `ai:save-preset` / `ai:get-presets` / `ai:delete-preset` | invoke | 预设管理 |
| `ai:save-active-preset` / `ai:get-active-preset` | invoke | 活跃预设 |
| `ai:save-config` / `ai:get-config` | invoke | AI 配置 |

#### 其他

| 通道 | 方向 | 说明 |
|------|------|------|
| `drives:detect` | invoke | 检测可用盘符 |
| `log:get` / `log:open-folder` | invoke | 日志读写 |
| `settings:get` / `settings:save` | invoke | 设置持久化 |
| `system:create-restore-point` | invoke | 创建还原点 |
| `shell:open-file-location` | invoke | 在资源管理器中显示文件 |
| `app:reload` | invoke | 重载渲染进程 |

### 8.3 preload 桥接

`preload.js` 通过 `contextBridge.exposeInMainWorld('electronAPI', { ... })` 暴露方法。

渲染进程调用方式：

```typescript
window.electronAPI.startScan(['C:\\'])
window.electronAPI.onScanProgress((progress) => { ... })
```

---

## 9. 数据流

### 9.1 扫描流程

```
用户点击"开始扫描"
       │
       ▼
[SimpleMode] 调用 window.electronAPI.startScan(drives)
       │
       ▼ (IPC invoke)
[main.js] ipcMain.handle('scan:start') → scanner.startScan()
       │
       ├─ 遍历缓存目录
       ├─ 每条文件 → rule-engine.evaluate() 判定安全等级
       ├─ 每批次 → mainWindow.webContents.send('scan:progress')
       │       │
       │       ▼ (IPC on)
       │   [preload] → dispatch(SET_SCAN_PROGRESS)
       │       │
       │       ▼
       │   [SimpleMode] 更新进度条
       │
       └─ 完成 → mainWindow.webContents.send('scan:complete')
               │
               ▼ (IPC on)
           [preload] → dispatch(SET_SCAN_RESULT)
               │
               ▼
           [SimpleMode] 展示扫描结果
```

### 9.2 清理流程

```
用户勾选文件 → 点击"清理选中"
       │
       ▼
[CleanItems] 调用 window.electronAPI.executeClean(items)
       │
       ▼ (IPC invoke)
[main.js] ipcMain.handle('clean:execute') → file-operator.moveBatchToTrash(items)
       │
       ├─ 逐条 file-operator.moveToTrash(path)
       │     ├─ rule-engine.isExcludedPath() 二次校验
       │     ├─ shell.trashItem() 移至回收站
       │     └─ logger.write() 记录日志
       │
       ├─ 每条 → mainWindow.webContents.send('clean:progress')
       └─ 完成 → mainWindow.webContents.send('clean:complete')
```

---

## 10. 类型系统

全局类型定义在 `src/vite-env.d.ts` 中，通过 `declare global` 共享给渲染进程。

### 核心类型

```typescript
interface ScanItem {
  id: string;
  name: string;
  path: string;
  category: 'temp' | 'browser' | 'app' | 'system' | 'large-file';
  size: number; // bytes
  safety: 'safe' | 'caution' | 'keep';
  description?: string;
}

interface ScanProgress {
  current: number;
  total: number;
  currentItem: string;
  phase: string;
  batchItems?: ScanItem[];
}

interface ScanResult {
  items: ScanItem[];
  totalSize: number;
}

interface CleanResult {
  freedBytes: number;
  itemCount: number;
}

interface AIConfig {
  mode: 'disabled' | 'preset' | 'custom';
  provider?: string;
  endpoint?: string;
  apiKey?: string;
  model?: string;
}

interface SingleFileAnalysis {
  type: string;
  purpose: string;
  riskLevel: 'low' | 'medium' | 'high';
  suggestDelete: boolean;
  reason: string;
  alternativeAction?: string;
}

interface ElectronAPI {
  // 扫描
  startScan(drives: string[]): Promise<ScanResult>;
  cancelScan(): void;
  onScanProgress(callback: (data: ScanProgress) => void): void;
  onScanComplete(callback: (data: ScanResult) => void): void;
  // ...（完整签名见 vite-env.d.ts）
}
```

`window.electronAPI` 通过 preload.js 的 `contextBridge.exposeInMainWorld` 注入，仅在 Electron 环境中可用。浏览器 dev 模式下调用会返回 `undefined`。

---

## 11. 安全机制

### 11.1 进程隔离

```javascript
// main.js
new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
  },
})
```

渲染进程无法访问 Node.js API、`require` 或主进程上下文。所有操作必须通过 `contextBridge` 暴露的有限 API。

### 11.2 路径排除双校验

**第一次（扫描时）：** `scanner.js` 在遍历目录时调用 `ruleEngine.isExcludedPath()`，跳过系统关键路径。

**第二次（删除时）：** `file-operator.js` 的 `moveToTrash()` 再次调用 `isExcludedPath()`，即使扫描结果被篡改也无法删除系统文件。

### 11.3 回收站机制

所有删除操作使用 `shell.trashItem()` 移至回收站，不做永久删除。用户可从回收站恢复误删文件。

### 11.4 系统还原点

可選创建系统还原点（通过 PowerShell `Checkpoint-Computer`），在批量清理前创建还原点以便系统级恢复。

---

## 12. 构建与打包

### 12.1 Vite 配置

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  base: './',  // 相对路径，适配 Electron file:// 协议
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
})
```

`base: './'` 是关键，确保 Electron 使用 `loadFile` 加载时资源路径正确。

### 12.2 electron-builder 配置

```json
{
  "build": {
    "appId": "com.cdrive.cleaner",
    "productName": "C盘清理工具",
    "directories": { "output": "release" },
    "files": ["dist/**/*", "electron/**/*", "package.json"],
    "electronDist": "node_modules/electron/dist",
    "win": {
      "target": [{ "target": "nsis", "arch": ["x64"] }],
      "icon": "public/icon.png"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "shortcutName": "C盘清理工具"
    }
  }
}
```

注意：
- `electronDist` 指向本地安装的 Electron，避免打包时重复下载
- 打包前需要确保 `vite build` 已完成

### 12.3 输出产物

```
release/
├── C盘清理工具 Setup x.x.x.exe    # NSIS 安装包
└── win-unpacked/                  # 免安装版（便携运行）
```

---

## 13. 常见任务

### 13.1 添加新的缓存扫描目标

1. 在 `electron/scanner.js` 的 `SCAN_TARGETS` 数组中添加新条目（category / path / pattern）
2. 若需要特殊安全规则，在 `electron/rule-engine.js` 的 `evaluate()` 中添加判定分支
3. 若已有的类型枚举满足需求，无需修改类型定义；否则需更新 `vite-env.d.ts`

### 13.2 添加新的 AI 预设提供者

1. 在 `electron/ai-provider.js` 的 `PRESET_PROVIDERS` 中添加新的 provider
2. 在 `AIConfigPage.tsx` 的选择列表中增加选项

### 13.3 添加新的 IPC 通道

1. 在 `electron/main.js` 中用 `ipcMain.handle()` 注册处理函数
2. 在 `electron/preload.js` 的 `electronAPI` 对象中添加对应方法
3. 在 `src/vite-env.d.ts` 的 `ElectronAPI` 接口中添加方法签名
4. 在渲染进程中通过 `window.electronAPI.xxx()` 调用

### 13.4 修改窗口默认行为

编辑 `electron/main.js` 中 `createWindow()` 函数的 `BrowserWindow` 构造参数：

| 参数 | 当前值 | 说明 |
|------|--------|------|
| `width` / `height` | 1000 / 750 | 默认窗口尺寸 |
| `minWidth` / `minHeight` | 800 / 600 | 最小窗口尺寸 |
| `title` | "C盘清理工具" | 窗口标题 |
| `icon` | `public/icon.png` | 窗口图标 |

---

## 附录

### 依赖清单

```json
{
  "dependencies": {
    "@ant-design/icons": "^6.3.2",
    "antd": "^6.5.0",
    "echarts": "^6.1.0",
    "echarts-for-react": "^3.0.6",
    "gsap": "^3.15.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
  },
  "devDependencies": {
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.3",
    "concurrently": "^10.0.3",
    "cross-env": "^10.1.0",
    "electron": "^42.5.1",
    "electron-builder": "^26.15.3",
    "typescript": "^6.0.3",
    "vite": "^8.1.0",
    "wait-on": "^9.0.10"
  }
}
```

### 相关文档

- [Electron 文档](https://www.electronjs.org/docs)
- [React 文档](https://react.dev/)
- [Vite 文档](https://vitejs.dev/)
- [electron-builder 文档](https://www.electron.build/)
- [Ant Design 6 文档](https://ant.design/)
