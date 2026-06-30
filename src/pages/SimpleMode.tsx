import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button, Typography, Progress, Space, Alert, Modal } from 'antd';
import {
  ScanOutlined,
  DeleteOutlined,
  ReloadOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
  LockOutlined,
  FileTextOutlined,
  DownOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import gsap from 'gsap';
import ParticleBackground from '../components/ParticleBackground';
import DriveSelectModal from '../components/DriveSelectModal';
import logoImg from '../assets/logo.png';
import scanStateImg from '../assets/ui-kit/scan-state.png';
import safeCleanImg from '../assets/ui-kit/safe-clean.png';
import cautionProtectImg from '../assets/ui-kit/caution-protect.png';

const { Title, Text } = Typography;

type Phase = 'idle' | 'scanning' | 'scan-done' | 'cleaning' | 'clean-done' | 'error';
const PAGE_SIZE = 50;

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  temp: { label: '临时缓存', color: '#faad14' },
  browser: { label: '浏览器缓存', color: '#1677ff' },
  app: { label: '应用数据', color: '#52c41a' },
  system: { label: '系统文件', color: '#ff4d4f' },
  'large-file': { label: '大文件', color: '#722ed1' },
};

const SAFETY_STYLE: Record<string, { text: string; color: string; icon: React.ReactNode }> = {
  safe: {
    text: '可安全删除',
    color: '#52c41a',
    icon: <SafetyCertificateOutlined />,
  },
  caution: {
    text: '谨慎删除',
    color: '#faad14',
    icon: <WarningOutlined />,
  },
  keep: {
    text: '建议保留',
    color: '#ff4d4f',
    icon: <LockOutlined />,
  },
};

interface Props {
  onSwitchToAdvanced: () => void;
}

export default function SimpleMode({ onSwitchToAdvanced }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 100, text: '' });
  const [allScanItems, setAllScanItems] = useState<ScanItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [totalScanSize, setTotalScanSize] = useState(0);
  const [cleanResult, setCleanResult] = useState<{ freedBytes: number } | null>(null);
  const [cleaningProgress, setCleaningProgress] = useState({ current: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState('');
  const [showDriveSelect, setShowDriveSelect] = useState(false);

  const hasAPI = !!window.electronAPI;

  // Refs for GSAP
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const idleContentRef = useRef<HTMLDivElement>(null);
  const cleanButtonsRef = useRef<HTMLDivElement>(null);
  const fileListRef = useRef<HTMLDivElement>(null);
  const lastAnimatedCountRef = useRef(0);

  // ============================
  // 派生数据
  // ============================
  const sortedItems = useMemo(() => {
    return [...allScanItems].sort((a, b) => b.size - a.size);
  }, [allScanItems]);

  const displayItems = useMemo(() => {
    return sortedItems.slice(0, visibleCount);
  }, [sortedItems, visibleCount]);

  const hasMore = visibleCount < sortedItems.length;
  const totalItemCount = sortedItems.length;

  const { allDeletableSize, safeDeletableSize, keptCount } = useMemo(() => {
    const allDel = allScanItems.filter(i => i.safety !== 'keep');
    const safeDel = allScanItems.filter(i => i.safety === 'safe');
    const kept = allScanItems.filter(i => i.safety === 'keep');
    return {
      allDeletableSize: allDel.reduce((s, i) => s + i.size, 0),
      safeDeletableSize: safeDel.reduce((s, i) => s + i.size, 0),
      keptCount: kept.length,
    };
  }, [allScanItems]);

  // ============================
  // IPC 监听
  // ============================
  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onScanProgress((data) => {
      setProgress({
        current: data.current,
        total: data.total,
        text: data.currentItem || data.phase,
      });
      if (data.batchItems && data.batchItems.length > 0) {
        setAllScanItems(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const newItems = data.batchItems!.filter(i => !existingIds.has(i.id));
          if (newItems.length === 0) return prev;
          return [...prev, ...newItems];
        });
      }
    });

    window.electronAPI.onScanComplete((data) => {
      setAllScanItems(data.items);
      setTotalScanSize(data.totalSize);
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

    // 清理：组件卸载时移除所有 IPC 监听器，防止累积导致重复 key
    return () => {
      if (!window.electronAPI) return;
      window.electronAPI.removeAllListeners('scan:progress');
      window.electronAPI.removeAllListeners('scan:complete');
      window.electronAPI.removeAllListeners('scan:error');
      window.electronAPI.removeAllListeners('clean:progress');
      window.electronAPI.removeAllListeners('clean:complete');
    };
  }, []);

  // ============================
  // GSAP: 空闲入场动效
  // ============================
  useEffect(() => {
    if (phase === 'idle' && idleContentRef.current) {
      gsap.fromTo(
        idleContentRef.current.children,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.12, ease: 'power3.out' }
      );
    }
  }, [phase]);

  // ============================
  // GSAP: 扫描阶段 面板滑入（不控制 opacity，避免和 React 重渲染冲突导致面板消失）
  // ============================
  useEffect(() => {
    if (phase === 'scanning' && leftPanelRef.current && rightPanelRef.current) {
      gsap.fromTo(leftPanelRef.current, { x: -20 }, { x: 0, duration: 0.35, ease: 'power2.out' });
      gsap.fromTo(rightPanelRef.current, { x: 20 }, { x: 0, duration: 0.35, delay: 0.1, ease: 'power2.out' });
    }
  }, [phase]);

  // ============================
  // GSAP: scan-done 按钮脉冲
  // ============================
  useEffect(() => {
    if (phase === 'scan-done' && cleanButtonsRef.current) {
      // 入口动画
      gsap.fromTo(
        cleanButtonsRef.current.children,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.1, ease: 'back.out(1.7)' }
      );
    }
  }, [phase]);

  // ============================
  // GSAP: 新文件项入场（仅动画新增项）
  // ============================
  useEffect(() => {
    if (!fileListRef.current) return;
    const children = fileListRef.current.children;
    const startIdx = lastAnimatedCountRef.current;
    if (children.length > startIdx) {
      const newItems: Element[] = [];
      for (let i = startIdx; i < children.length; i++) {
        newItems.push(children[i]);
      }
      gsap.fromTo(
        newItems,
        { opacity: 0, y: 14, scale: 0.97 },
        {
          opacity: 1, y: 0, scale: 1,
          duration: 0.35, stagger: 0.025, ease: 'power2.out',
        }
      );
      lastAnimatedCountRef.current = children.length;
    }
  }, [displayItems.length]);

  // ============================
  // GSAP: clean-done 数字动画
  // ============================
  useEffect(() => {
    if (phase === 'clean-done' && cleanResult) {
      const tl = gsap.timeline();
      tl.fromTo('.clean-done-content', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
    }
  }, [phase, cleanResult]);

  // ============================
  // 处理函数
  // ============================
  const handleStartScanWithDrives = useCallback(async (drives: string[]) => {
    setShowDriveSelect(false);
    setErrorMsg('');
    setAllScanItems([]);
    setVisibleCount(PAGE_SIZE);
    setTotalScanSize(0);
    setCleanResult(null);
    setPhase('scanning');
    setProgress({ current: 0, total: 100, text: '正在准备扫描...' });
    try {
      await window.electronAPI!.startScan(drives);
    } catch (err: any) {
      setErrorMsg(`扫描失败: ${err?.message || '未知错误'}`);
      setPhase('error');
    }
  }, []);

  const handleScan = useCallback(() => {
    if (!window.electronAPI) {
      setErrorMsg('未检测到 Electron 环境。请使用 npm run electron:dev 启动应用，而非 npm run dev。');
      setPhase('error');
      return;
    }
    // 极简模式默认扫描 C 盘，跳过盘符选择
    handleStartScanWithDrives(['C:\\']);
  }, [handleStartScanWithDrives]);

  const handleCleanAll = useCallback(async () => {
    if (!window.electronAPI) return;
    const items = allScanItems.filter(i => i.safety !== 'keep');
    if (items.length === 0) return;
    setPhase('cleaning');
    try {
      await window.electronAPI.executeClean(items);
    } catch (err: any) {
      setErrorMsg(`清理失败: ${err?.message || '未知错误'}`);
      setPhase('error');
    }
  }, [allScanItems]);

  const handleCleanSafe = useCallback(async () => {
    if (!window.electronAPI) return;
    const items = allScanItems.filter(i => i.safety === 'safe');
    if (items.length === 0) return;
    setPhase('cleaning');
    try {
      await window.electronAPI.executeClean(items);
    } catch (err: any) {
      setErrorMsg(`清理失败: ${err?.message || '未知错误'}`);
      setPhase('error');
    }
  }, [allScanItems]);

  const handleReset = useCallback(() => {
    setPhase('idle');
    setAllScanItems([]);
    setVisibleCount(PAGE_SIZE);
    setTotalScanSize(0);
    setCleanResult(null);
    setProgress({ current: 0, total: 100, text: '' });
    setErrorMsg('');
  }, []);

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => prev + PAGE_SIZE);
  }, []);

  // 单文件删除：直接从列表中移除，不改变当前阶段
  const handleCleanSingle = useCallback(async (item: ScanItem) => {
    if (!window.electronAPI) return;

    // 建议保留的文件，弹窗确认
    if (item.safety === 'keep') {
      const confirmed = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: '确认删除系统保护文件？',
          content: (
            <div>
              <p style={{ color: '#ff4d4f', marginBottom: 8 }}>
                此文件被标记为"建议保留"，删除可能导致程序运行异常或数据丢失！
              </p>
              <p style={{ fontSize: 13, color: '#595959', wordBreak: 'break-all' }}>
                {item.path}
              </p>
            </div>
          ),
          okText: '确认删除',
          okType: 'danger',
          cancelText: '取消',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!confirmed) return;
    }

    try {
      const result = await window.electronAPI.cleanSingle(item);
      if (result.success) {
        setAllScanItems(prev => prev.filter(i => i.id !== item.id));
      }
    } catch { /* 静默 */ }
  }, []);

  // ============================
  // 渲染: 文件列表项
  // ============================
  const renderFileItem = (item: ScanItem) => {
    const safety = SAFETY_STYLE[item.safety];
    const cat = CATEGORY_CONFIG[item.category] || { label: item.category, color: '#8c8c8c' };
    return (
      <div
        key={item.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 14px',
          background: '#fff',
          borderRadius: 8,
          marginBottom: 6,
          border: '1px solid #f0f0f0',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#d9d9d9'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#f0f0f0'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        <FileTextOutlined style={{ fontSize: 18, color: '#1677ff', marginRight: 12, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
          <Text
            ellipsis
            style={{ fontSize: 13, fontWeight: 500, color: '#262626', display: 'block' }}
            title={item.name}
          >
            {item.name}
          </Text>
          <Text
            type="secondary"
            ellipsis
            style={{ fontSize: 11, display: 'block', marginTop: 1 }}
            title={item.path}
          >
            {item.path}
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 2 }}>
            <span style={{ color: safety.color, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              {safety.icon}
              {safety.text}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <Button
            type="text"
            size="small"
            icon={<FolderOpenOutlined />}
            title="打开文件所在位置"
            onClick={() => window.electronAPI?.openFileLocation(item.path)}
            style={{ fontSize: 13, color: '#8c8c8c' }}
          />
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            title={item.safety === 'keep' ? '建议保留，可强制删除' : '删除此文件'}
            onClick={() => handleCleanSingle(item)}
            style={{ fontSize: 13, color: item.safety === 'keep' ? '#d9d9d9' : '#ff4d4f' }}
          />
          <span
            style={{
              fontSize: 11,
              color: cat.color,
              background: `${cat.color}15`,
              padding: '2px 8px',
              borderRadius: 4,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              marginLeft: 4,
            }}
          >
            {cat.label}
          </span>
          <Text style={{ fontSize: 13, fontWeight: 500, color: '#595959', minWidth: 60, textAlign: 'right' }}>
            {formatSize(item.size)}
          </Text>
        </div>
      </div>
    );
  };

  // ============================
  // 渲染: 右侧文件列表面板
  // ============================
  const renderFileListPanel = (showHeader: boolean) => (
    <div
      ref={rightPanelRef}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#fafafa',
        borderRadius: 12,
        border: '1px solid #f0f0f0',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      {/* 面板标题 */}
      {showHeader && (
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #f0f0f0',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text strong style={{ fontSize: 14, color: '#262626' }}>
            <FileTextOutlined style={{ marginRight: 6 }} />
            扫描文件列表
          </Text>
          <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
            已发现 {totalItemCount} 项
            {sortedItems.length > 0 && (
              <> · 最大 {formatSize(sortedItems[0]?.size || 0)}</>
            )}
          </Text>
        </div>
      )}

      {/* 列表内容 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
        }}
      >
        {displayItems.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 }}>
            <Space orientation="vertical" align="center">
              <ScanOutlined style={{ fontSize: 32, color: '#d9d9d9' }} />
              <Text type="secondary">正在扫描，文件即将出现...</Text>
            </Space>
          </div>
        ) : (
          <div ref={fileListRef}>
            {displayItems.map((item) => renderFileItem(item))}
          </div>
        )}
      </div>

      {/* 加载更多 */}
      {hasMore && (
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid #f0f0f0',
            textAlign: 'center',
            background: '#fff',
          }}
        >
          <Button
            type="link"
            icon={<DownOutlined />}
            onClick={handleLoadMore}
            style={{ fontSize: 13 }}
          >
            加载更多 ({sortedItems.length - visibleCount} 项)
          </Button>
        </div>
      )}
    </div>
  );

  // ============================
  // 主渲染
  // ============================
  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: 24,
        background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f7ff 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 粒子动态背景 */}
      <ParticleBackground phase={phase} />

      {/* 内容层（在粒子之上） */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 顶栏 */}
      <div style={{ position: 'absolute', right: 20, zIndex: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        {!hasAPI && (
          <Alert
            message="浏览器模式"
            description="部分功能不可用，请运行 npm run electron:dev"
            type="warning"
            showIcon
            style={{ padding: '4px 12px', fontSize: 12 }}
          />
        )}
        <Button type="link" onClick={onSwitchToAdvanced} style={{ fontSize: 13, marginBottom: 4 }}>
          进入高级模式 <RightOutlined />
        </Button>
      </div>

      {/* IDLE 阶段 */}
      {phase === 'idle' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div ref={idleContentRef} style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 12 }}>
              <img src={logoImg} alt="C盘清理工具" style={{ width: 80, height: 80 }} />
            </div>
            <Title level={2} style={{ margin: '8px 0 4px' }}>C盘智能清理</Title>
            <Text type="secondary" style={{ fontSize: 15, display: 'block', marginBottom: 24 }}>
              一键扫描并安全清理C盘垃圾文件
            </Text>
            <Button
              type="primary"
              size="large"
              icon={<ScanOutlined />}
              onClick={handleScan}
              style={{ height: 44, paddingInline: 32, fontSize: 16 }}
            >
              开始扫描
            </Button>
          </div>
        </div>
      )}

      {/* SCANNING 阶段 */}
      {phase === 'scanning' && (
        <div style={{ flex: 1, display: 'flex', gap: 20, overflow: 'hidden', paddingTop: 40, minHeight: 0 }}>
          {/* 左面板：进度 */}
          <div
            ref={leftPanelRef}
            style={{
              width: 260,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.85)',
              borderRadius: 12,
              padding: '32px 24px',
              border: '1px solid rgba(255,255,255,0.9)',
            }}
          >
            <img src={scanStateImg} alt="扫描中" style={{ width: 160, height: 'auto', marginBottom: 12 }} />
            <Title level={4} style={{ margin: '0 0 16px' }}>正在扫描...</Title>
            <Progress
              type="circle"
              percent={Math.round((progress.current / Math.max(progress.total, 1)) * 100)}
              status="active"
              size={100}
            />
            <Text
              type="secondary"
              style={{ marginTop: 16, fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}
            >
              {progress.text}
            </Text>
            <Text style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
              已发现 {totalItemCount} 项
            </Text>
          </div>
          {/* 右面板：文件列表 */}
          {renderFileListPanel(true)}
        </div>
      )}

      {/* SCAN-DONE 阶段 */}
      {phase === 'scan-done' && (
        <div style={{ flex: 1, display: 'flex', gap: 20, overflow: 'hidden', paddingTop: 40 }}>
          {/* 左面板：结果 + 清理按钮 */}
          <div
            ref={leftPanelRef}
            style={{
              width: 260,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.85)',
              borderRadius: 12,
              padding: '24px 20px',
              border: '1px solid rgba(255,255,255,0.9)',
            }}
          >
            <img src={safeCleanImg} alt="扫描完成" style={{ width: 160, height: 'auto', marginBottom: 12 }} />
            <Title level={4} style={{ margin: '0 0 4px' }}>扫描完成</Title>
            <Text
              strong
              style={{ fontSize: 22, color: '#1677ff', margin: '8px 0 2px' }}
            >
              {formatSize(allDeletableSize)}
            </Text>
            <Text type="secondary" style={{ fontSize: 13, marginBottom: 20 }}>
              共 {totalItemCount - keptCount} 项可清理
              {keptCount > 0 && <> · {keptCount} 项系统文件已排除</>}
            </Text>

            <div ref={cleanButtonsRef} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button
                type="primary"
                size="large"
                icon={<DeleteOutlined />}
                onClick={handleCleanAll}
                style={{ height: 48, fontSize: 15, width: '100%' }}
              >
                全部删除 · {formatSize(allDeletableSize)}
              </Button>
              <Button
                size="large"
                icon={<SafetyCertificateOutlined />}
                onClick={handleCleanSafe}
                style={{ height: 44, fontSize: 14, width: '100%', borderColor: '#52c41a', color: '#52c41a' }}
              >
                安全删除 · {formatSize(safeDeletableSize)}
              </Button>
              <Text style={{ fontSize: 11, color: '#8c8c8c', textAlign: 'center', marginTop: 4 }}>
                安全删除仅清理标记为"可安全删除"的项目
              </Text>
            </div>

            <Button
              icon={<ReloadOutlined />}
              onClick={handleReset}
              style={{ marginTop: 16, width: '100%' }}
            >
              重新扫描
            </Button>
            <Button
              icon={<FolderOpenOutlined />}
              onClick={() => window.electronAPI?.openRecycleBin()}
              style={{ marginTop: 8, width: '100%', fontSize: 12 }}
              size="small"
            >
              打开回收站
            </Button>
          </div>
          {/* 右面板：文件列表 */}
          {renderFileListPanel(true)}
        </div>
      )}

      {/* CLEANING 阶段 */}
      {phase === 'cleaning' && (
        <div style={{ flex: 1, display: 'flex', gap: 20, overflow: 'hidden', paddingTop: 40 }}>
          {/* 左面板：清理进度 */}
          <div
            style={{
              width: 260,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.85)',
              borderRadius: 12,
              padding: '32px 24px',
              border: '1px solid rgba(255,255,255,0.9)',
            }}
          >
            <img src={cautionProtectImg} alt="正在清理" style={{ width: 160, height: 'auto', marginBottom: 12 }} />
            <Title level={4} style={{ margin: '0 0 16px' }}>正在清理...</Title>
            <Progress
              type="circle"
              percent={cleaningProgress.total > 0 ? Math.round((cleaningProgress.current / cleaningProgress.total) * 100) : 0}
              status="active"
              size={100}
            />
            <Text type="secondary" style={{ marginTop: 16 }}>
              第 {cleaningProgress.current} / {cleaningProgress.total} 项
            </Text>
          </div>
          {/* 右面板：仍然显示文件列表 */}
          {renderFileListPanel(true)}
        </div>
      )}

      {/* CLEAN-DONE 阶段 */}
      {phase === 'clean-done' && cleanResult && (
        <div
          className="clean-done-content"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <img src={safeCleanImg} alt="清理完成" style={{ width: 160, height: 'auto', marginBottom: 16 }} />
            <Title level={2} style={{ margin: '0 0 4px' }}>
              已释放 {formatSize(cleanResult.freedBytes)}！
            </Title>
            <Text type="secondary" style={{ fontSize: 15, display: 'block', marginBottom: 28 }}>
              C盘空间已成功清理
            </Text>
            <Button
              type="primary"
              size="large"
              icon={<ReloadOutlined />}
              onClick={handleReset}
              style={{ height: 44, paddingInline: 32, fontSize: 16 }}
            >
              再扫一次
            </Button>
          </div>
        </div>
      )}

      {/* ERROR 阶段 */}
      {phase === 'error' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, color: '#ff4d4f', marginBottom: 16 }}>✕</div>
            <Title level={3} style={{ margin: '0 0 8px' }}>操作失败</Title>
            <Text type="secondary" style={{ fontSize: 14, display: 'block', marginBottom: 24, maxWidth: 400 }}>
              {errorMsg}
            </Text>
            <Button
              type="primary"
              size="large"
              icon={<ReloadOutlined />}
              onClick={handleReset}
              style={{ height: 44, paddingInline: 32 }}
            >
              重试
            </Button>
          </div>
        </div>
      )}

      {/* 盘符选择弹窗 */}
      <DriveSelectModal
        open={showDriveSelect}
        onConfirm={handleStartScanWithDrives}
        onCancel={() => setShowDriveSelect(false)}
      />
    </div>
    </div>
  );
}
