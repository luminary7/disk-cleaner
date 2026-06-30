/// <reference types="vite/client" />

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

interface ElectronAPI {
  startScan: () => Promise<ScanResult>;
  cancelScan: () => Promise<void>;
  onScanProgress: (callback: (data: ScanProgress) => void) => void;
  onScanComplete: (callback: (data: ScanResult) => void) => void;
  onScanError: (callback: (data: string) => void) => void;

  executeClean: (items: ScanItem[]) => Promise<CleanResult>;
  onCleanProgress: (callback: (data: CleanProgress) => void) => void;
  onCleanComplete: (callback: (data: CleanResult) => void) => void;

  startLargeFileScan: () => Promise<ScanItem[]>;
  cancelLargeFileScan: () => Promise<void>;
  onLargeFileProgress: (callback: (data: ScanProgress) => void) => void;
  onLargeFileComplete: (callback: (data: ScanItem[] & { totalSize: number }) => void) => void;

  testAIConnection: (config: AIConfig) => Promise<{ success: boolean; message: string }>;
  getAISuggestion: (scanSummary: string) => Promise<string>;
  sendAIMessage: (messages: { role: string; content: string }[]) => Promise<string>;
  saveAIConfig: (config: AIConfig) => Promise<void>;
  getAIConfig: () => Promise<AIConfig>;

  getLogs: () => Promise<string[]>;
  openLogFolder: () => Promise<void>;

  getSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<void>;

  createRestorePoint: () => Promise<{ success: boolean; message: string }>;

  openFileLocation: (filePath: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
