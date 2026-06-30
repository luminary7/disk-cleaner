import { useState, useEffect } from 'react';
import { Button, Typography, Progress, Space, Result, Alert } from 'antd';
import {
  ScanOutlined,
  DeleteOutlined,
  ReloadOutlined,
  RightOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

type Phase = 'idle' | 'scanning' | 'scan-done' | 'cleaning' | 'clean-done' | 'error';

interface Props {
  onSwitchToAdvanced: () => void;
}

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

export default function SimpleMode({ onSwitchToAdvanced }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 100, text: '' });
  const [scanResult, setScanResult] = useState<{ items: ScanItem[]; totalSize: number } | null>(null);
  const [cleanResult, setCleanResult] = useState<{ freedBytes: number } | null>(null);
  const [cleaningProgress, setCleaningProgress] = useState({ current: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState('');

  const hasAPI = !!window.electronAPI;

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onScanProgress((data) => {
      setProgress({
        current: data.current,
        total: data.total,
        text: data.currentItem || data.phase,
      });
    });

    window.electronAPI.onScanComplete((data) => {
      setScanResult({ items: data.items, totalSize: data.totalSize });
      setPhase('scan-done');
    });

    window.electronAPI.onCleanProgress((data) => {
      setCleaningProgress({ current: data.current, total: data.total });
    });

    window.electronAPI.onCleanComplete((data) => {
      setCleanResult({ freedBytes: data.freedBytes });
      setPhase('clean-done');
    });

    window.electronAPI.onScanError((data) => {
      setErrorMsg(data);
      setPhase('error');
    });
  }, []);

  const handleScan = async () => {
    // 检查 Electron API 是否可用
    if (!window.electronAPI) {
      setErrorMsg('未检测到 Electron 环境。请使用 npm run electron:dev 启动应用，而非 npm run dev。');
      setPhase('error');
      return;
    }
    setErrorMsg('');
    setPhase('scanning');
    setProgress({ current: 0, total: 100, text: '正在准备扫描...' });
    try {
      await window.electronAPI.startScan();
    } catch (err: any) {
      setErrorMsg(`扫描失败: ${err?.message || '未知错误'}`);
      setPhase('error');
    }
  };

  const handleClean = async () => {
    if (!scanResult || !window.electronAPI) return;
    setPhase('cleaning');
    try {
      await window.electronAPI.executeClean(scanResult.items.filter(i => i.safety === 'safe'));
    } catch (err: any) {
      setErrorMsg(`清理失败: ${err?.message || '未知错误'}`);
      setPhase('error');
    }
  };

  const handleReset = () => {
    setPhase('idle');
    setScanResult(null);
    setCleanResult(null);
    setProgress({ current: 0, total: 100, text: '' });
    setErrorMsg('');
  };

  const styles: Record<string, React.CSSProperties> = {
    container: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f7ff 100%)',
    },
    header: {
      position: 'absolute' as const,
      top: 20,
      right: 24,
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {!hasAPI && (
          <Alert
            message="浏览器模式"
            description="部分功能不可用，请运行 npm run electron:dev"
            type="warning"
            showIcon
            style={{ marginBottom: 8, padding: '4px 12px' }}
          />
        )}
        <Button type="link" onClick={onSwitchToAdvanced}>
          进入高级模式 <RightOutlined />
        </Button>
      </div>

      {phase === 'idle' && (
        <Space orientation="vertical" align="center" size="large">
          <ScanOutlined style={{ fontSize: 72, color: '#1677ff' }} />
          <Title level={2} style={{ margin: 0 }}>C盘智能清理</Title>
          <Text type="secondary">一键扫描并安全清理C盘垃圾文件</Text>
          <Button type="primary" size="large" icon={<ScanOutlined />} onClick={handleScan}>
            开始扫描
          </Button>
        </Space>
      )}

      {phase === 'scanning' && (
        <Space orientation="vertical" align="center" size="middle" style={{ width: 400 }}>
          <ScanOutlined style={{ fontSize: 48, color: '#1677ff' }} />
          <Title level={4}>正在扫描...</Title>
          <Progress
            percent={Math.round((progress.current / Math.max(progress.total, 1)) * 100)}
            status="active"
            style={{ width: '100%' }}
          />
          <Text type="secondary">{progress.text}</Text>
        </Space>
      )}

      {phase === 'scan-done' && scanResult && (
        <Space orientation="vertical" align="center" size="large">
          <Result
            status="success"
            title={`发现 ${formatSize(scanResult.totalSize)} 可清理垃圾`}
            subTitle={`共找到 ${scanResult.items.length} 项可清理项目`}
          />
          <Space size="middle">
            <Button
              type="primary"
              size="large"
              icon={<DeleteOutlined />}
              onClick={handleClean}
            >
              一键清理
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重新扫描
            </Button>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            所有清理项目将移至回收站，可随时恢复
          </Text>
        </Space>
      )}

      {phase === 'cleaning' && (
        <Space orientation="vertical" align="center" size="middle" style={{ width: 400 }}>
          <DeleteOutlined style={{ fontSize: 48, color: '#52c41a' }} />
          <Title level={4}>正在清理...</Title>
          <Progress
            percent={cleaningProgress.total > 0 ? Math.round((cleaningProgress.current / cleaningProgress.total) * 100) : 0}
            status="active"
            style={{ width: '100%' }}
          />
          <Text type="secondary">第 {cleaningProgress.current} / {cleaningProgress.total} 项</Text>
        </Space>
      )}

      {phase === 'clean-done' && cleanResult && (
        <Space orientation="vertical" align="center" size="large">
          <Result
            status="success"
            icon={<DeleteOutlined style={{ color: '#52c41a', fontSize: 64 }} />}
            title={`已释放 ${formatSize(cleanResult.freedBytes)}！`}
            subTitle="C盘空间已成功清理"
          />
          <Button type="primary" size="large" icon={<ReloadOutlined />} onClick={handleReset}>
            再扫一次
          </Button>
        </Space>
      )}

      {phase === 'error' && (
        <Space orientation="vertical" align="center" size="large">
          <Result
            status="error"
            title="操作失败"
            subTitle={errorMsg}
          />
          <Button type="primary" size="large" icon={<ReloadOutlined />} onClick={handleReset}>
            重试
          </Button>
        </Space>
      )}
    </div>
  );
}
