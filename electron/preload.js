const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 盘符检测
  detectDrives: () => ipcRenderer.invoke('drives:detect'),

  // 扫描相关
  startScan: (drives) => ipcRenderer.invoke('scan:start', drives),
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
  cancelClean: () => ipcRenderer.invoke('clean:cancel'),
  restoreItems: (items) => ipcRenderer.invoke('clean:restore', items),
  onCleanProgress: (callback) => {
    ipcRenderer.on('clean:progress', (_event, data) => callback(data));
  },
  onCleanComplete: (callback) => {
    ipcRenderer.on('clean:complete', (_event, data) => callback(data));
  },
  onCleanCancelled: (callback) => {
    ipcRenderer.on('clean:cancelled', (_event, data) => callback(data));
  },
  onRestoreProgress: (callback) => {
    ipcRenderer.on('clean:restore-progress', (_event, data) => callback(data));
  },

  // 大文件扫描
  startLargeFileScan: (drives) => ipcRenderer.invoke('largefile:start', drives),
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
  analyzeSingleFile: (item) => ipcRenderer.invoke('ai:analyze-single-file', item),
  analyzeBatchFiles: (items) => ipcRenderer.invoke('ai:analyze-batch', items),
  cancelBatchAnalysis: () => ipcRenderer.invoke('ai:batch-cancel'),
  onBatchAnalysisProgress: (callback) => {
    ipcRenderer.on('ai:batch-progress', (_event, data) => callback(data));
  },
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

  // 单文件删除（不触发 clean:complete 事件）
  cleanSingle: (item) => ipcRenderer.invoke('clean:single', item),

  // 打开回收站
  openRecycleBin: () => ipcRenderer.invoke('system:open-recycle-bin'),

  // 打开文件位置
  openFileLocation: (filePath) => ipcRenderer.invoke('shell:open-file-location', filePath),

  // IPC 监听器清理（组件卸载时移除指定通道的所有监听器）
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // 开发辅助：重载窗口（preload 变更后生效）
  reloadWindow: () => ipcRenderer.invoke('app:reload'),
});
