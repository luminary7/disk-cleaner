/**
 * 自动更新模块（基于 electron-updater + generic 提供商）
 *
 * 用法：
 *   const updater = require('./updater');
 *   updater.init(mainWindow);
 *   updater.setFeedURL('https://example.com/releases');
 *   updater.checkForUpdates();  // 事件通过 IPC 推送到渲染进程
 */
const { autoUpdater } = require('electron-updater');
const { app } = require('electron');

// 不由 updater 自动下载，由渲染进程按钮控制下载时机
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let initialized = false;

function init(win) {
  if (initialized) return;
  initialized = true;

  autoUpdater.removeAllListeners();

  autoUpdater.on('checking-for-update', () => {
    win?.webContents.send('update:status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    win?.webContents.send('update:status', {
      status: 'update-available',
      version: info?.version,
      releaseDate: info?.releaseDate,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    win?.webContents.send('update:status', {
      status: 'update-not-available',
      version: info?.version,
    });
  });

  autoUpdater.on('download-progress', (p) => {
    win?.webContents.send('update:download-progress', {
      percent: Math.round(p.percent),
      bytesPerSecond: p.bytesPerSecond,
      transferred: p.transferred,
      total: p.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    win?.webContents.send('update:status', {
      status: 'update-downloaded',
      version: info?.version,
      releaseDate: info?.releaseDate,
    });
  });

  autoUpdater.on('error', (err) => {
    win?.webContents.send('update:status', {
      status: 'error',
      message: err == null ? '未知错误' : err.message || String(err),
    });
  });
}

/** 设置更新源地址（generic provider） */
function setFeedURL(url) {
  autoUpdater.setFeedURL({ provider: 'generic', url });
}

/** 检查更新（仅在打包后生效） */
function checkForUpdates() {
  if (!app.isPackaged) {
    autoUpdater.emit('error', new Error('开发模式下无法检查更新，请打包后测试'));
    return;
  }
  autoUpdater.checkForUpdates().catch(() => {
    // 错误已由 error 事件处理
  });
}

/** 开始下载更新 */
function downloadUpdate() {
  autoUpdater.downloadUpdate();
}

/** 退出并安装更新 */
function quitAndInstall() {
  setImmediate(() => {
    app.removeAllListeners('window-all-closed');
    autoUpdater.quitAndInstall();
  });
}

module.exports = { init, setFeedURL, checkForUpdates, downloadUpdate, quitAndInstall };
