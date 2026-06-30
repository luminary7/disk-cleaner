import { useState } from 'react';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AppProvider } from './store/AppContext';
import SimpleMode from './pages/SimpleMode';
import AdvancedMode from './pages/AdvancedMode';

type AppMode = 'simple' | 'advanced';

function App() {
  const [mode, setMode] = useState<AppMode>('simple');

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
        },
      }}
    >
      <AppProvider>
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          {mode === 'simple' ? (
            <SimpleMode onSwitchToAdvanced={() => setMode('advanced')} />
          ) : (
            <AdvancedMode onSwitchToSimple={() => setMode('simple')} />
          )}
        </div>
      </AppProvider>
    </ConfigProvider>
  );
}

export default App;
