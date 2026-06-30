const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 扫描相关
  startScan: () => ipcRenderer.invoke('scan:start'),
  cancelScan: () => ipcRenderer.invoke('scan:cancel'),
  onScanProgress: (callback) => {
    ipcRenderer.on('scan:progress', (_event, data) => callback(data));
  },
  onScanComplete: (callback) => {
    ipcRenderer.on('scan:complete', (_event, data) => callback(data));
  },
  onScanError: (callback) => {
    ipcRenderer.on('scan:error', (_event, data) => callback(data));
  },

  // 清理相关
  executeClean: (items) => ipcRenderer.invoke('clean:execute', items),
  onCleanProgress: (callback) => {
    ipcRenderer.on('clean:progress', (_event, data) => callback(data));
  },
  onCleanComplete: (callback) => {
    ipcRenderer.on('clean:complete', (_event, data) => callback(data));
  },

  // 大文件扫描
  startLargeFileScan: () => ipcRenderer.invoke('largefile:start'),
  cancelLargeFileScan: () => ipcRenderer.invoke('largefile:cancel'),
  onLargeFileProgress: (callback) => {
    ipcRenderer.on('largefile:progress', (_event, data) => callback(data));
  },
  onLargeFileComplete: (callback) => {
    ipcRenderer.on('largefile:complete', (_event, data) => callback(data));
  },

  // AI 相关
  testAIConnection: (config) => ipcRenderer.invoke('ai:test-connection', config),
  getAISuggestion: (scanSummary) => ipcRenderer.invoke('ai:suggest', scanSummary),
  sendAIMessage: (messages) => ipcRenderer.invoke('ai:chat', messages),
  saveAIConfig: (config) => ipcRenderer.invoke('ai:save-config', config),
  getAIConfig: () => ipcRenderer.invoke('ai:get-config'),
  analyzeFiles: (files) => ipcRenderer.invoke('ai:analyze-files', files),
  saveAIPreset: (preset) => ipcRenderer.invoke('ai:save-preset', preset),
  getAIPresets: () => ipcRenderer.invoke('ai:get-presets'),
  deleteAIPreset: (name) => ipcRenderer.invoke('ai:delete-preset', name),
  saveActivePreset: (name) => ipcRenderer.invoke('ai:save-active-preset', name),
  getActivePreset: () => ipcRenderer.invoke('ai:get-active-preset'),

  // 日志相关
  getLogs: () => ipcRenderer.invoke('log:get'),
  openLogFolder: () => ipcRenderer.invoke('log:open-folder'),

  // 设置相关
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // 系统还原点
  createRestorePoint: () => ipcRenderer.invoke('system:create-restore-point'),

  // 打开文件位置
  openFileLocation: (filePath) => ipcRenderer.invoke('shell:open-file-location', filePath),
});
