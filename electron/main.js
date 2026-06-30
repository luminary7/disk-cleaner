const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const scanner = require('./scanner');
const fileOperator = require('./file-operator');
const { AIProvider } = require('./ai-provider');
const { getFileDetail } = require('./file-detail');
const Store = require('./store');
const logger = require('./logger');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow = null;
let store = null;
let aiProvider = null;

// ── 窗口创建 ──

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    title: 'C盘清理工具',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

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
          const output = execSync(
            `wmic logicaldisk where name="${letter}:" get volumename /format:value`,
            { encoding: 'utf8', timeout: 2000 }
          );
          const match = output.match(/VolumeName=(.+)/);
          label = match ? match[1].trim() : '';
        } catch { /* volume label not available */ }
        drives.push({ letter, label, path: root });
      } catch { /* drive not accessible */ }
    }
    return drives;
  });

  // ========= 清理 =========
  ipcMain.handle('clean:execute', async (_event, items) => {
    const results = await fileOperator.moveBatchToTrash(items);
    const successCount = results.filter((r) => r.success).length;
    const freedBytes = results
      .filter((r) => r.success)
      .reduce((sum, r) => sum + (r.size || 0), 0);

    // 进度上报
    let completed = 0;
    for (const r of results) {
      completed++;
      mainWindow?.webContents.send('clean:progress', {
        current: completed,
        total: results.length,
        currentItem: r.name || '',
      });
    }

    mainWindow?.webContents.send('clean:complete', {
      itemCount: successCount,
      freedBytes,
    });

    return { itemCount: successCount, freedBytes };
  });

  // ========= AI =========
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
    const detail = await getFileDetail(item.path, item);
    return await aiProvider.analyzeSingleFile(detail);
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

  // ========= 开发辅助 =========
  ipcMain.handle('app:reload', () => {
    mainWindow?.webContents.reload(); // 重载渲染进程 + preload 脚本
  });

  // ========= Shell =========
  ipcMain.handle('shell:open-file-location', async (_event, filePath) => {
    shell.showItemInFolder(filePath);
  });
}
