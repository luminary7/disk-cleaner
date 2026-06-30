/// <reference types="vite/client" />

declare global {
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
    batchItems?: ScanItem[]; // 当前批次发现的文件
  }

  interface ScanResult {
    items: ScanItem[];
    totalSize: number;
  }

  interface CleanProgress {
    current: number;
    total: number;
    currentItem: string;
  }

  interface CleanResult {
    freedBytes: number;
    itemCount: number;
  }

  interface AIConfig {
    mode: 'disabled' | 'preset' | 'custom';
    provider?: 'deepseek' | 'minimax' | 'siliconflow';
    endpoint?: string;
    apiKey?: string;
    model?: string;
  }

  interface Settings {
    createRestorePoint: boolean;
  }

  interface SingleFileAnalysis {
    type: string;
    purpose: string;
    riskLevel: 'low' | 'medium' | 'high';
    suggestDelete: boolean;
    reason: string;
    alternativeAction?: string;
  }

  interface DriveInfo {
    letter: string;
    label: string;
    path: string;
  }

  interface ElectronAPI {
    detectDrives: () => Promise<DriveInfo[]>;
    startScan: (drives?: string[]) => Promise<ScanResult>;
    cancelScan: () => Promise<void>;
    onScanProgress: (callback: (data: ScanProgress) => void) => void;
    onScanComplete: (callback: (data: ScanResult) => void) => void;
    onScanError: (callback: (data: string) => void) => void;

    executeClean: (items: ScanItem[]) => Promise<CleanResult>;
    cancelClean: () => Promise<{ cancelled: boolean }>;
    restoreItems: (items: ScanItem[]) => Promise<{ restored: number; failed: number; errors: string[] }>;
    onCleanProgress: (callback: (data: CleanProgress) => void) => void;
    onCleanComplete: (callback: (data: CleanResult) => void) => void;
    onCleanCancelled: (callback: (data: { completedItems: ScanItem[] }) => void) => void;
    onRestoreProgress: (callback: (data: { current: number; total: number; itemName: string }) => void) => void;

    // IPC 监听器清理
    removeAllListeners: (channel: string) => void;

    startLargeFileScan: (drives?: string[]) => Promise<ScanItem[]>;
    cancelLargeFileScan: () => Promise<void>;
    onLargeFileProgress: (callback: (data: ScanProgress) => void) => void;
    onLargeFileComplete: (callback: (data: { items: ScanItem[]; totalSize: number }) => void) => void;

    testAIConnection: (config: AIConfig) => Promise<{ success: boolean; message: string }>;
    getAISuggestion: (scanSummary: string) => Promise<string>;
    sendAIMessage: (messages: { role: string; content: string }[]) => Promise<string>;
    saveAIConfig: (config: AIConfig) => Promise<void>;
    getAIConfig: () => Promise<AIConfig>;
    analyzeFiles: (files: ScanItem[]) => Promise<{ analysis: Array<{ name: string; type: string; purpose: string; suggestDelete: boolean; reason: string }> } | null>;
    analyzeSingleFile: (item: ScanItem) => Promise<SingleFileAnalysis>;
    analyzeBatchFiles: (items: ScanItem[]) => Promise<{ cancelled: boolean; results: Array<{ fileId: string; analysis: SingleFileAnalysis | null; error?: string }> }>;
    cancelBatchAnalysis: () => Promise<{ cancelled: boolean }>;
    onBatchAnalysisProgress: (callback: (data: { current: number; total: number; currentItem: string }) => void) => void;
    saveAIPreset: (preset: AIConfig & { name: string }) => Promise<void>;
    getAIPresets: () => Promise<(AIConfig & { name: string })[]>;
    deleteAIPreset: (name: string) => Promise<void>;
    saveActivePreset: (name: string) => Promise<void>;
    getActivePreset: () => Promise<string>;

    getLogs: () => Promise<string[]>;
    openLogFolder: () => Promise<void>;

    getSettings: () => Promise<Settings>;
    saveSettings: (settings: Settings) => Promise<void>;

    createRestorePoint: () => Promise<{ success: boolean; message: string }>;

    openFileLocation: (filePath: string) => Promise<void>;

    // 单文件删除
    cleanSingle: (item: ScanItem) => Promise<ScanItem & { success: boolean; error?: string }>;

    // 打开回收站
    openRecycleBin: () => Promise<void>;

    // 开发辅助
    reloadWindow: () => Promise<void>;
  }

  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
