const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync, execFileSync } = require('child_process');
const scanner = require('./scanner');
const fileOperator = require('./file-operator');
const { AIProvider } = require('./ai-provider');
const { getFileDetail } = require('./file-detail');
const Store = require('./store');
const logger = require('./logger');
const updater = require('./updater');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow = null;
let store = null;
let aiProvider = null;

// 清理取消状态（模块级，跨 clean:execute workers 共享）
let cleanCancelled = false;
let cleanCompletedItems = [];

// ── 窗口创建 ──

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    title: '我的磁盘怎么红红的，是要谈恋爱了吗',
    icon: path.join(__dirname, isDev ? '../public/icon.png' : '../dist/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 移除默认菜单（File / Edit / View 等）
  Menu.setApplicationMenu(null);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // 初始化模块
  store = new Store();
  const aiConfig = store.get('aiConfig', { mode: 'disabled' });
  aiProvider = new AIProvider(aiConfig);

  createWindow();
  registerIPC();

  // 初始化自动更新模块
  updater.init(mainWindow);
  const updateUrl = store.get('updateUrl', '');
  if (updateUrl) {
    updater.setFeedURL(updateUrl);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ── IPC 通道注册 ──

function registerIPC() {
  // ========= 扫描 =========
  ipcMain.handle('scan:start', async (_event, drives) => {
    const result = await scanner.startScan(
      (progress) => { mainWindow?.webContents.send('scan:progress', progress); },
      drives
    );
    mainWindow?.webContents.send('scan:complete', result);
    return result;
  });

  ipcMain.handle('scan:cancel', () => {
    scanner.cancelScan();
  });

  // ========= 大文件扫描 =========
  ipcMain.handle('largefile:start', async (_event, drives) => {
    const result = await scanner.startLargeFileScan(
      (progress) => { mainWindow?.webContents.send('largefile:progress', progress); },
      drives
    );
    const totalSize = result.reduce((s, i) => s + i.size, 0);
    mainWindow?.webContents.send('largefile:complete', { items: result, totalSize });
    return result;
  });

  ipcMain.handle('largefile:cancel', () => {
    scanner.cancelScan();
  });

  // ========= 盘符检测 =========
  ipcMain.handle('drives:detect', async () => {
    const drives = [];
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    for (const letter of letters) {
      const root = `${letter}:\\`;
      try {
        await fs.promises.access(root);
        let label = '';
        try {
          // 直接用 PowerShell 获取卷标，绕过 cmd.exe 编码问题
          const output = execFileSync('powershell.exe', [
            '-NoProfile', '-Command',
            `[Console]::OutputEncoding = [Text.Encoding]::UTF8; (Get-WmiObject Win32_LogicalDisk -Filter 'DeviceID="${letter}:"').VolumeName`,
          ], { encoding: 'utf8', timeout: 5000 });
          label = output.trim();
        } catch { /* volume label not available */ }
        drives.push({ letter, label, path: root });
      } catch { /* drive not accessible */ }
    }
    return drives;
  });

  // ========= 清理（并发池，200 条同时移动，支持取消）=========
  ipcMain.handle('clean:execute', async (_event, items, options = {}) => {
    cleanCancelled = false;
    cleanCompletedItems = [];

    const total = items.length;
    const CONCURRENCY = 200;
    const results = new Array(total);
    let completed = 0;
    let nextIdx = 0;
    let restorePoint = null;

    const shouldCreateRestorePoint =
      store?.get('settings', { createRestorePoint: true }).createRestorePoint &&
      items.some((item) => options.allowCaution || item.safety === 'caution' || item.category === 'system');

    if (shouldCreateRestorePoint) {
      restorePoint = fileOperator.createSystemRestorePoint();
    }

    async function worker() {
      while (!cleanCancelled) {
        const idx = nextIdx++;
        if (idx >= total) break;
        const item = items[idx];
        const r = await fileOperator.moveToTrash(item, options);
        results[idx] = { ...item, success: r.success, error: r.error };
        completed++;
        if (r.success) {
          cleanCompletedItems.push(item);
        }
        if (completed % CONCURRENCY === 0 || completed === total) {
          mainWindow?.webContents.send('clean:progress', {
            current: completed,
            total,
            currentItem: item.name || '',
          });
        }
      }
    }

    const poolSize = Math.min(CONCURRENCY, total);
    const workers = Array.from({ length: poolSize }, () => worker());
    await Promise.all(workers);

    // 被取消时发送 clean:cancelled 事件，不执行完成逻辑
    if (cleanCancelled) {
      mainWindow?.webContents.send('clean:cancelled', {
        completedItems: cleanCompletedItems,
      });
      return { cancelled: true, completedCount: cleanCompletedItems.length, completedItems: cleanCompletedItems };
    }

    // 正常完成
    const successCount = results.filter((r) => r?.success).length;
    const failedCount = results.filter((r) => r && !r.success).length;
    const freedBytes = results
      .filter((r) => r?.success)
      .reduce((sum, r) => sum + (r.size || 0), 0);

    mainWindow?.webContents.send('clean:complete', {
      itemCount: successCount,
      failedCount,
      freedBytes,
      restorePoint,
    });

    return { itemCount: successCount, failedCount, freedBytes, restorePoint, results };
  });

  // ========= 取消清理 =========
  ipcMain.handle('clean:cancel', async () => {
    cleanCancelled = true;
    return { cancelled: true };
  });

  // ========= 回滚清理（从回收站还原）=========
  ipcMain.handle('clean:restore', async (_event, items) => {
    const result = await fileOperator.restoreFromTrash(items, (current, total, itemName) => {
      mainWindow?.webContents.send('clean:restore-progress', { current, total, itemName });
    });
    // 回滚完成后重置取消状态
    cleanCancelled = false;
    cleanCompletedItems = [];
    return result;
  });

  // ========= AI =========

  // 批量分析大文件 — 分批发送，每批 20 个
  ipcMain.handle('ai:analyze-large-files', async (_event, items) => {
    const BATCH_SIZE = 20;
    const allResults = [];

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const current = Math.min(i + BATCH_SIZE, items.length);

      // 发送进度（开始处理该批）
      mainWindow?.webContents.send('ai:batch-progress', {
        current: i,
        total: items.length,
        currentItem: `正在分析 ${i + 1}-${current} / ${items.length}`,
      });

      const results = await aiProvider.analyzeLargeFiles(batch);
      allResults.push(...results);

      // 发送进度（该批完成）
      mainWindow?.webContents.send('ai:batch-progress', {
        current: current,
        total: items.length,
        currentItem: `已完成 ${current} / ${items.length}`,
      });
    }

    return { results: allResults };
  });

  ipcMain.handle('ai:test-connection', async (_event, config) => {
    const provider = new AIProvider(config);
    return await provider.testConnection();
  });

  ipcMain.handle('ai:suggest', async (_event, scanSummary) => {
    return await aiProvider.getSuggestion(scanSummary);
  });

  ipcMain.handle('ai:chat', async (_event, messages) => {
    return await aiProvider.chat(messages);
  });

  ipcMain.handle('ai:analyze-files', async (_event, files) => {
    return await aiProvider.analyzeFiles(files);
  });

  ipcMain.handle('ai:analyze-single-file', async (_event, item) => {
    // 查缓存
    const cache = store.get('aiAnalysisCache', {});
    if (cache[item.path]) {
      return cache[item.path].result;
    }
    // 无缓存，调用 AI
    const detail = await getFileDetail(item.path, item);
    const result = await aiProvider.analyzeSingleFile(detail);
    cache[item.path] = { result, cachedAt: Date.now() };
    store.set('aiAnalysisCache', cache);
    return result;
  });

  ipcMain.handle('ai:get-analysis-cache', async () => {
    const cache = store.get('aiAnalysisCache', {});
    // 只返回 result，前端不需要 cachedAt
    const entries = {};
    for (const [path, entry] of Object.entries(cache)) {
      entries[path] = entry.result;
    }
    return entries;
  });

  ipcMain.handle('ai:clear-analysis-cache', async () => {
    store.set('aiAnalysisCache', {});
  });

  // ========= AI 配置预设 =========
  ipcMain.handle('ai:save-preset', async (_event, preset) => {
    const presets = store.get('aiPresets', []);
    const idx = presets.findIndex((p) => p.name === preset.name);
    if (idx >= 0) {
      presets[idx] = preset;
    } else {
      presets.push(preset);
    }
    store.set('aiPresets', presets);
  });

  ipcMain.handle('ai:get-presets', async () => {
    return store.get('aiPresets', []);
  });

  ipcMain.handle('ai:delete-preset', async (_event, name) => {
    const presets = store.get('aiPresets', []);
    store.set('aiPresets', presets.filter((p) => p.name !== name));
  });

  ipcMain.handle('ai:save-active-preset', async (_event, name) => {
    store.set('aiActivePreset', name);
  });

  ipcMain.handle('ai:get-active-preset', async () => {
    return store.get('aiActivePreset', '');
  });

  ipcMain.handle('ai:save-config', async (_event, config) => {
    aiProvider.updateConfig(config);
    store.set('aiConfig', config);
  });

  ipcMain.handle('ai:get-config', async () => {
    return store.get('aiConfig', { mode: 'disabled' });
  });

  // ========= 日志 =========
  ipcMain.handle('log:get', async () => {
    return logger.readLogs();
  });

  ipcMain.handle('log:open-folder', async () => {
    const logsDir = logger.getLogsDir();
    shell.openPath(logsDir);
  });

  // ========= 设置 =========
  ipcMain.handle('settings:get', async () => {
    return store.get('settings', { createRestorePoint: true });
  });

  ipcMain.handle('settings:save', async (_event, settings) => {
    store.set('settings', settings);
  });

  // ========= 系统 =========
  ipcMain.handle('system:create-restore-point', async () => {
    return fileOperator.createSystemRestorePoint();
  });

  // ========= 单文件删除 =========
  ipcMain.handle('clean:single', async (_event, item, options = {}) => {
    const result = await fileOperator.moveToTrash(item, options);
    return { ...item, success: result.success, error: result.error };
  });

  // ========= 打开回收站 =========
  ipcMain.handle('system:open-recycle-bin', async () => {
    try {
      require('child_process').execSync('explorer shell:RecycleBinFolder', { timeout: 5000 });
    } catch { /* 静默失败 */ }
  });

  // ========= 应用信息 =========
  ipcMain.handle('app:info', async () => {
    // 每次清除 require 缓存以读取最新的 package.json
    const pkgPath = path.join(__dirname, '..', 'package.json');
    delete require.cache[require.resolve(pkgPath)];
    const pkg = require(pkgPath);
    return {
      appName: pkg.build?.productName || '我的磁盘怎么红红的，是要谈恋爱了吗',
      version: app.getVersion(),
      description: pkg.description || '',
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      author: pkg.author || '',
      license: pkg.license || 'MIT',
    };
  });

  // ========= 自动更新 =========
  ipcMain.handle('update:check', async () => {
    const url = store.get('updateUrl', '');
    if (!url) {
      return { status: 'no-url' };
    }
    updater.setFeedURL(url);
    updater.checkForUpdates();
    return { status: 'checking' };
  });

  ipcMain.handle('update:download', async () => {
    updater.downloadUpdate();
  });

  ipcMain.handle('update:install', async () => {
    updater.quitAndInstall();
  });

  ipcMain.handle('update:get-url', async () => {
    return store.get('updateUrl', '');
  });

  ipcMain.handle('update:set-url', async (_event, url) => {
    store.set('updateUrl', url);
    if (url) {
      updater.setFeedURL(url);
    }
  });

  // ========= Shell =========
  ipcMain.handle('shell:open-file-location', async (_event, filePath) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle('shell:open-external', async (_event, url) => {
    const target = new URL(url);
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      throw new Error('Unsupported URL protocol');
    }
    await shell.openExternal(target.toString());
  });
}
