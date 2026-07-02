# 我的磁盘怎么红红的，是要谈恋爱了吗

> Windows C 盘智能清理工具 — 极简一键清理 × AI 辅助分析

## 功能

**极简模式（Simple Mode）**
- 一键扫描缓存目录，自动分级安全/谨慎/保留
- 一键清理所有可安全删除的文件

**高级模式（Advanced Mode）**
- **空间概览** — ECharts 饼图展示各类目占用 + Top 10 大文件
- **逐项清理** — 按安全等级筛选，选择性清理
- **大文件分析** — 递归扫描用户盘，支持类型筛选 + AI 分析
- **AI 助手** — 接入 OpenAI 兼容 API（DeepSeek / MiniMax / SiliconFlow 等），智能建议清理策略

**安全机制**
- 内置规则引擎（排除系统关键路径、安全等级判定）
- 所有删除默认移至回收站，支持创建系统还原点
- 删除前双重校验（扫描时 + 执行时）

**自动更新**
- 基于 electron-updater + GitHub Releases 自动检测更新

## 技术栈

| 层面 | 技术选型 |
|------|---------|
| 框架 | Electron 42 (contextIsolation + preload) |
| 前端 | React 19 + TypeScript + Ant Design 6 |
| 图表 | ECharts 6 |
| 动画 | GSAP（粒子背景 / 页面过渡） |
| 构建 | Vite 8 + electron-builder 26 |
| 自动更新 | electron-updater (GitHub Provider) |
| AI | 兼容 OpenAI 格式 API |

## 快速开始

```bash
# 安装依赖
npm install

# 浏览器开发模式（仅前端）
npm run dev

# Electron 完整开发模式
npm run electron:dev

# 生产构建
npm run build

# Electron 打包
npm run electron:build
```

## 项目结构

```
├── electron/                # 主进程（Node.js）
│   ├── main.js              #   窗口管理 + IPC 注册
│   ├── preload.js           #   contextBridge 桥接
│   ├── scanner.js           #   缓存目录/大文件扫描引擎
│   ├── rule-engine.js       #   安全规则（排除列表 + 安全等级判断）
│   ├── file-operator.js     #   文件移至回收站 + 系统还原点
│   ├── file-detail.js       #   单文件元信息获取
│   ├── ai-provider.js       #   OpenAI 兼容 API 客户端
│   ├── store.js             #   JSON 持久化存储
│   ├── logger.js            #   操作日志
│   └── updater.js           #   自动更新模块
├── src/                     # 渲染进程（React）
│   ├── pages/
│   │   ├── SimpleMode.tsx   #   极简模式
│   │   ├── AdvancedMode.tsx #   高级模式（侧边导航 + 多标签）
│   │   ├── SpaceOverview.tsx#   空间概览图表
│   │   ├── CleanItems.tsx   #   逐项清理
│   │   ├── LargeFiles.tsx   #   大文件分析
│   │   ├── AIAssistant.tsx  #   AI 助手
│   │   └── About.tsx        #   关于页
│   ├── components/          #   通用组件
│   ├── store/               #   Context + useReducer 全局状态
│   └── vite-env.d.ts        #   全局类型定义
├── public/
│   └── icon.png             #   应用图标
└── scripts/
    └── publish-oss.mjs      #   阿里云 OSS 发布脚本
```

## 发布

```bash
# 构建 + 发布到 GitHub Releases
npm run publish:github

# 构建 + 上传到阿里云 OSS（需配置 .env.oss）
npm run publish:oss
```

## 协议

MIT
