# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Electron + React 桌面应用，用于 Windows C 盘智能清理。提供极简（一键扫描/清理）和高级（分类图表、大文件分析、AI 辅助）两种模式。

## 常用命令

```bash
npm run dev              # Vite 开发服务器（仅浏览器）
npm run electron:dev     # 完整 Electron 开发模式（Vite + Electron 并发）
npm run build            # Vite 生产构建
npm run electron:build   # 完整 Electron 构建打包（electron-builder）
npm run preview          # Vite 预览构建产物
```

## 技术栈

- **框架:** Electron (contextIsolation + preload 桥接)
- **前端:** React 19 + TypeScript + Ant Design 6 + ECharts
- **动画:** GSAP (粒子背景 / 页面过渡动效)
- **构建:** Vite 8 + electron-builder 27
- **无测试框架**

## 架构概览

```
electron/           # 主进程（Node.js）
  main.js           #   窗口管理 + IPC 注册
  preload.js        #   contextBridge 暴露 API 到渲染进程
  scanner.js        #   缓存目录/大文件递归扫描引擎
  rule-engine.js    #   内置安全规则（排除列表 + 安全等级判断）
  ai-provider.js    #   OpenAI 兼容 API 客户端
  file-operator.js  #   文件移至回收站 + 系统还原点创建
  file-detail.js    #   单文件元信息获取
  store.js          #   JSON 文件持久化（设置/presets）
  logger.js         #   操作日志写入与读取

src/                # 渲染进程（React）
  pages/
    SimpleMode.tsx  #   极简模式（idle/scanning/scan-done/cleaning/clean-done/error 六阶段 UI）
    AdvancedMode.tsx #  高级模式（侧边导航 + 多标签页）
    SpaceOverview.tsx # 空间概览（ECharts 饼图 + Top 10）
    CleanItems.tsx  #   逐项清理（安全等级标记 + 勾选删除）
    LargeFiles.tsx  #   大文件分析（类型筛选 + AI 分析 + 单文件详情）
    AIAssistant.tsx #   AI 助手配置（preset/custom 模式 + 预设管理）
  store/
    AppContext.tsx   #   Context + useReducer 全局状态
  components/
    ParticleBackground.tsx # GSAP Canvas 粒子动画背景
  vite-env.d.ts     #   全局类型定义（ScanItem/CleanResult/ElectronAPI 等）
```

## 关键数据流

**扫描流程:** 前端调用 `window.electronAPI.startScan()` → IPC invoke → `scanner.js` 递归遍历预定义目录 → 每条文件经过 `rule-engine.js` 判定 `safe/caution/keep` → `onScanProgress` 实时推送批次结果到渲染进程 → 扫描完成回传完整结果

**清理流程:** 前端调用 `window.electronAPI.executeClean(items)` → IPC invoke → `file-operator.js` 逐条移至回收站（`shell.trashItem`）+ 可选创建系统还原点 → `logger.js` 写操作日志 → IPC 推送进度和完成事件

## 类型系统

全局类型定义在 [src/vite-env.d.ts](src/vite-env.d.ts)，通过 `declare global` 共享。核心类型：
- `ScanItem` — id/name/path/category/size/safety
- `ElectronAPI` — 所有 IPC 桥接方法签名
- `AIConfig` / `SingleFileAnalysis` — AI 相关类型

`window.electronAPI` 通过 preload.js 的 `contextBridge.exposeInMainWorld` 注入，仅在 Electron 环境中可用。

## 重要约定

- **注释使用中文**
- **所有删除操作默认移至回收站**（`shell.trashItem`），不直接删除
- **安全双校验**: `rule-engine.js` 的 `isExcludedPath` 在扫描时跳过 + 删除时再次校验
- **IPC 通道命名规范**: `模块名:动作`（如 `scan:start`、`clean:execute`、`ai:chat`）
- **preload.js 方法命名**: camelCase（如 `startScan`、`executeClean`）
- **安全等级**: `safe`（可安全删除）/ `caution`（谨慎删除）/ `keep`（建议保留）
- **状态管理**: 使用 React Context + `useReducer`，无外部状态库
- **极简模式阶段**: idle → scanning → scan-done → cleaning → clean-done（或 error）
