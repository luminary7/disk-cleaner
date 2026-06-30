import { createContext, useContext, useReducer, ReactNode } from 'react';

interface AppState {
  scanResult: ScanItem[] | null;
  totalScanSize: number;
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  cleanResult: CleanResult | null;
  isCleaning: boolean;
  cleanProgress: CleanProgress | null;
  aiConfig: AIConfig | null;
  settings: Settings;
}

type AppAction =
  | { type: 'SET_SCAN_RESULT'; items: ScanItem[]; totalSize: number }
  | { type: 'SET_SCANNING'; scanning: boolean }
  | { type: 'SET_SCAN_PROGRESS'; progress: ScanProgress }
  | { type: 'SET_CLEAN_RESULT'; result: CleanResult }
  | { type: 'SET_CLEANING'; cleaning: boolean }
  | { type: 'SET_CLEAN_PROGRESS'; progress: CleanProgress }
  | { type: 'SET_AI_CONFIG'; config: AIConfig }
  | { type: 'SET_SETTINGS'; settings: Settings };

const initialState: AppState = {
  scanResult: null,
  totalScanSize: 0,
  isScanning: false,
  scanProgress: null,
  cleanResult: null,
  isCleaning: false,
  cleanProgress: null,
  aiConfig: null,
  settings: { createRestorePoint: true },
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SCAN_RESULT':
      return { ...state, scanResult: action.items, totalScanSize: action.totalSize };
    case 'SET_SCANNING':
      return { ...state, isScanning: action.scanning };
    case 'SET_SCAN_PROGRESS':
      return { ...state, scanProgress: action.progress };
    case 'SET_CLEAN_RESULT':
      return { ...state, cleanResult: action.result };
    case 'SET_CLEANING':
      return { ...state, isCleaning: action.cleaning };
    case 'SET_CLEAN_PROGRESS':
      return { ...state, cleanProgress: action.progress };
    case 'SET_AI_CONFIG':
      return { ...state, aiConfig: action.config };
    case 'SET_SETTINGS':
      return { ...state, settings: action.settings };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
