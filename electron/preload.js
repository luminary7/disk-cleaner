const { contextBridge, ipcRenderer } = require('electron');

// 辅助函数：注册 IPC 监听器并返回 cleanup 函数
function onIpc(channel, callback) {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('electronAPI', {
  // 盘符检测
  detectDrives: () => ipcRenderer.invoke('drives:detect'),

  // 扫描相关
  startScan: (drives) => ipcRenderer.invoke('scan:start', drives),
  cancelScan: () => ipcRenderer.invoke('scan:cancel'),
  onScanProgress: (callback) => onIpc('scan:progress', callback),
  onScanComplete: (callback) => onIpc('scan:complete', callback),
  onScanError: (callback) => onIpc('scan:error', callback),

  // 清理相关
  executeClean: (items, options) => ipcRenderer.invoke('clean:execute', items, options),
  cancelClean: () => ipcRenderer.invoke('clean:cancel'),
  restoreItems: (items) => ipcRenderer.invoke('clean:restore', items),
  onCleanProgress: (callback) => onIpc('clean:progress', callback),
  onCleanComplete: (callback) => onIpc('clean:complete', callback),
  onCleanCancelled: (callback) => onIpc('clean:cancelled', callback),
  onRestoreProgress: (callback) => onIpc('clean:restore-progress', callback),

  // 大文件扫描
  startLargeFileScan: (drives) => ipcRenderer.invoke('largefile:start', drives),
  cancelLargeFileScan: () => ipcRenderer.invoke('largefile:cancel'),
  onLargeFileProgress: (callback) => onIpc('largefile:progress', callback),
  onLargeFileComplete: (callback) => onIpc('largefile:complete', callback),

  // AI 相关
  testAIConnection: (config) => ipcRenderer.invoke('ai:test-connection', config),
  getAISuggestion: (scanSummary) => ipcRenderer.invoke('ai:suggest', scanSummary),
  sendAIMessage: (messages) => ipcRenderer.invoke('ai:chat', messages),
  saveAIConfig: (config) => ipcRenderer.invoke('ai:save-config', config),
  getAIConfig: () => ipcRenderer.invoke('ai:get-config'),
  analyzeFiles: (files) => ipcRenderer.invoke('ai:analyze-files', files),
  analyzeSingleFile: (item) => ipcRenderer.invoke('ai:analyze-single-file', item),
  analyzeLargeFiles: (items) => ipcRenderer.invoke('ai:analyze-large-files', items),
  onBatchAnalysisProgress: (callback) => onIpc('ai:batch-progress', callback),
  saveAIPreset: (preset) => ipcRenderer.invoke('ai:save-preset', preset),
  getAIPresets: () => ipcRenderer.invoke('ai:get-presets'),
  deleteAIPreset: (name) => ipcRenderer.invoke('ai:delete-preset', name),
  saveActivePreset: (name) => ipcRenderer.invoke('ai:save-active-preset', name),
  getActivePreset: () => ipcRenderer.invoke('ai:get-active-preset'),
  getAnalysisCache: () => ipcRenderer.invoke('ai:get-analysis-cache'),
  clearAnalysisCache: () => ipcRenderer.invoke('ai:clear-analysis-cache'),

  // 日志相关
  getLogs: () => ipcRenderer.invoke('log:get'),
  openLogFolder: () => ipcRenderer.invoke('log:open-folder'),

  // 设置相关
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // 系统还原点
  createRestorePoint: () => ipcRenderer.invoke('system:create-restore-point'),

  // 单文件删除（不触发 clean:complete 事件）
  cleanSingle: (item, options) => ipcRenderer.invoke('clean:single', item, options),

  // 打开回收站
  openRecycleBin: () => ipcRenderer.invoke('system:open-recycle-bin'),

  // 应用信息
  getAppInfo: () => ipcRenderer.invoke('app:info'),

  // 打开文件位置
  openFileLocation: (filePath) => ipcRenderer.invoke('shell:open-file-location', filePath),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),

  // IPC 监听器清理（组件卸载时移除指定通道的所有监听器 — 保留向后兼容）
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // 自动更新
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  getUpdateUrl: () => ipcRenderer.invoke('update:get-url'),
  setUpdateUrl: (url) => ipcRenderer.invoke('update:set-url', url),
  onUpdateStatus: (callback) => onIpc('update:status', callback),
  onUpdateProgress: (callback) => onIpc('update:download-progress', callback),

  // 扩展预留
});
