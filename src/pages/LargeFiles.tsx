import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Table,
  Typography,
  Space,
  Select,
  message,
  Modal,
  Tag,
  Row,
  Descriptions,
  Spin,
} from 'antd';
import {
  FileSearchOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  InboxOutlined,
  PlaySquareOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import largeFileImg from '../assets/ui-kit/large-file.png';
import type { ColumnsType } from 'antd/es/table';
import DriveSelectModal from '../components/DriveSelectModal';

const { Title, Text } = Typography;

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

// 文件扩展名 → 所属类别（缓存/数据/文档/安装包/视频/镜像/程序/代码/图片）
const FILE_CATEGORIES = [
  { exts: ['tmp', 'log', 'cache', 'bak', 'old', 'dmp', 'swp'], label: '缓存文件', color: '#faad14' },
  { exts: ['db', 'sqlite', 'sqlite3', 'mdb', 'dbx', 'mysql', 'sql', 'dbf'], label: '数据文件', color: '#ff4d4f' },
  { exts: ['json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg'], label: '配置数据', color: '#13c2c2' },
  { exts: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt'], label: '文档文件', color: '#2f54eb' },
  { exts: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'img'], label: '安装包/镜像', color: '#1677ff' },
  { exts: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'], label: '视频文件', color: '#722ed1' },
  { exts: ['exe', 'dll', 'msi', 'sys', 'ocx', 'drv', 'cpl', 'com', 'scr'], label: '可执行程序', color: '#ff4d4f' },
  { exts: ['js', 'ts', 'py', 'java', 'cpp', 'cs', 'go', 'rs', 'c', 'h', 'swift', 'kt'], label: '代码文件', color: '#722ed1' },
  { exts: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'tiff'], label: '图片文件', color: '#eb2f96' },
];

function getFileCategory(ext: string): { label: string; color: string } {
  for (const cat of FILE_CATEGORIES) {
    if (cat.exts.includes(ext)) return cat;
  }
  return { label: '其他', color: '#8c8c8c' };
}

function guessFileType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return getFileCategory(ext).label;
}

const FILE_TYPE_OPTIONS = [
  { value: 'all', label: '全部类型' },
  ...FILE_CATEGORIES.map(c => ({ value: c.label, label: c.label })),
];

type SafetyLevel = ScanItem['safety'];

const SAFETY_RANK: Record<SafetyLevel, number> = {
  safe: 0,
  caution: 1,
  keep: 2,
};

function cleanAIError(err: any): string {
  const msg = err?.message || '';
  // IPC invoke 包装格式: "Error invoking remote method 'xxx': Error: 真实消息"
  const idx = msg.lastIndexOf('Error: ');
  return idx >= 0 ? msg.slice(idx + 7) : msg || '请检查 AI 配置';
}
function getConservativeSafety(item: ScanItem, aiSafetyMap?: Map<string, { safety: SafetyLevel }>): SafetyLevel {
  const ai = aiSafetyMap?.get(item.id);
  if (!ai) return item.safety;
  return SAFETY_RANK[ai.safety] > SAFETY_RANK[item.safety] ? ai.safety : item.safety;
}

// 判断文件是否重要（不可随意删除），系统或 AI 任一标记 keep 即保护
function isImportantFile(item: ScanItem, aiSafetyMap?: Map<string, { safety: SafetyLevel }>): boolean {
  return getConservativeSafety(item, aiSafetyMap) === 'keep';
}

const SAFETY_TAGS: Record<string, { text: string; color: string }> = {
  safe: { text: '可安全删除', color: 'green' },
  caution: { text: '谨慎清理', color: 'orange' },
  keep: { text: '禁止清理', color: 'red' },
};

const AI_SAFETY_TAGS: Record<string, { text: string; color: string }> = {
  safe: { text: 'AI 可安全删除', color: 'green' },
  caution: { text: 'AI 谨慎清理', color: 'orange' },
  keep: { text: 'AI 禁止清理', color: 'red' },
};

// 将单文件分析结果映射为 aiSafetyMap 格式（综合判断用）
function mapToAISafety(analysis: SingleFileAnalysis): { safety: 'safe' | 'caution' | 'keep'; reason: string } {
  if (analysis.suggestDelete) return { safety: 'safe', reason: analysis.reason };
  if (analysis.riskLevel === 'high') return { safety: 'keep', reason: analysis.reason };
  return { safety: 'caution', reason: analysis.reason };
}

export default function LargeFiles() {
  const [files, setFiles] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState('all');
  const [safetyFilter, setSafetyFilter] = useState('all');

  // 单文件 AI 分析 — 按文件 id 存储分析结果
  const [singleAnalysisMap, setSingleAnalysisMap] = useState<Map<string, SingleFileAnalysis>>(new Map());
  const [analyzingFileId, setAnalyzingFileId] = useState<string | null>(null);
  const [viewingFileId, setViewingFileId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentItem: string } | null>(null);
  const [aiReady, setAiReady] = useState(false);
  const [aiSafetyMap, setAiSafetyMap] = useState<Map<string, { safety: 'safe' | 'caution' | 'keep'; reason: string }>>(new Map());
  const [analysisCache, setAnalysisCache] = useState<Record<string, SingleFileAnalysis> | null>(null);

  const [pageSize, setPageSize] = useState(20);
  const [showDriveSelect, setShowDriveSelect] = useState(false);

  // 倒计时删除确认
  const [countdownState, setCountdownState] = useState<{
    visible: boolean;
    countdown: number;
    files: ScanItem[];
    timerId?: any;
  } | null>(null);

  // 监听增量批次，用于实时滚动展示
  useEffect(() => {
    if (!window.electronAPI) return;

    const cleanup = window.electronAPI.onLargeFileProgress((data) => {
      if (data.batchItems && data.batchItems.length > 0) {
        setFiles(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const newItems = data.batchItems!.filter(i => !existingIds.has(i.id));
          if (newItems.length === 0) return prev;
          const next = [...prev, ...newItems];
          next.sort((a, b) => b.size - a.size);
          return next;
        });
      }
    });

    return cleanup;
  }, []);

  // 文件或 AI 结果更新时自动取消勾选综合 keep 的项
  useEffect(() => {
    const combinedKeepIds = new Set(
      files.filter(f => getConservativeSafety(f, aiSafetyMap) === 'keep').map(f => f.id)
    );
    setSelectedIds(prev => {
      let changed = false;
      for (const id of prev) {
        if (combinedKeepIds.has(id)) { changed = true; break; }
      }
      if (!changed) return prev;
      const next = new Set(prev);
      combinedKeepIds.forEach(id => next.delete(id));
      return next;
    });
  }, [files, aiSafetyMap]);

  const handleScan = () => {
    setShowDriveSelect(true);
  };

  const loadAnalysisCache = async (scanFiles?: ScanItem[]) => {
    if (!window.electronAPI) return;
    try {
      const cache = await window.electronAPI.getAnalysisCache();
      setAnalysisCache(cache);
    } catch { /* 忽略缓存加载失败 */ }
  };

  // analysisCache 或 files 变化时，自动恢复 aiSafetyMap 和 singleAnalysisMap
  useEffect(() => {
    if (!analysisCache || files.length === 0) return;
    const safetyMap = new Map<string, { safety: 'safe' | 'caution' | 'keep'; reason: string }>();
    const analysisMap = new Map<string, SingleFileAnalysis>();
    for (const file of files) {
      if (analysisCache[file.path]) {
        safetyMap.set(file.id, mapToAISafety(analysisCache[file.path]));
        analysisMap.set(file.id, analysisCache[file.path]);
      }
    }
    if (safetyMap.size > 0) setAiSafetyMap(safetyMap);
    if (analysisMap.size > 0) setSingleAnalysisMap(analysisMap);
  }, [analysisCache, files]);

  const handleStartScanWithDrives = async (drives: string[]) => {
    setShowDriveSelect(false);
    if (!window.electronAPI) return;
    setLoading(true);
    setFiles([]);
    setSingleAnalysisMap(new Map());
    setAiSafetyMap(new Map());
    setSelectedIds(new Set());
    try {
      const result = await window.electronAPI.startLargeFileScan(drives);
      // 按大小倒序排序，保证初始展示和增量数据一致
      result.sort((a, b) => b.size - a.size);
      setFiles(result);
      message.success(`找到 ${result.length} 个大文件`);
      // 扫描完成后加载缓存，恢复历史 AI 分析结果
      await loadAnalysisCache(result);
    } catch {
      message.error('大文件扫描失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLocation = (filePath: string) => {
    if (window.electronAPI) {
      window.electronAPI.openFileLocation(filePath);
    }
  };

  const handleDelete = () => {
    const selectedFiles = files.filter((f) => selectedIds.has(f.id));
    if (selectedFiles.length === 0) return;

    // 检查是否包含重要文件
    const importantFiles = selectedFiles.filter(f => isImportantFile(f, aiSafetyMap));

    if (importantFiles.length > 0) {
      message.warning('选中文件中包含禁止清理项目，已被安全策略阻止');
      setSelectedIds(prev => {
        const next = new Set(prev);
        importantFiles.forEach(f => next.delete(f.id));
        return next;
      });
      return;
    }

    const cautionCount = selectedFiles.filter(f => getConservativeSafety(f, aiSafetyMap) === 'caution').length;
    Modal.confirm({
      title: `确定要清理选中的 ${selectedFiles.length} 个文件吗？`,
      content: (
        <div>
          <p>文件将移至回收站，总计 {formatSize(selectedFiles.reduce((s, f) => s + f.size, 0))}</p>
          {cautionCount > 0 && <p>其中 {cautionCount} 个为谨慎项，请确认文件用途后再清理。</p>}
        </div>
      ),
      okText: '确认清理',
      okType: 'primary',
      cancelText: '取消',
      onOk: () => doDelete(selectedFiles),
    });
  };

  const doDelete = async (targetFiles: ScanItem[]) => {
    if (!window.electronAPI) return;
    // 关闭倒计时弹窗
    setCountdownState(null);
    // 安全过滤：综合 keep 永远不通过普通清理
    const cleanFiles = targetFiles.filter(f => getConservativeSafety(f, aiSafetyMap) !== 'keep');
    if (cleanFiles.length === 0) {
      message.warning('选中文件中无可清理项目');
      return;
    }
    try {
      const result = await window.electronAPI.executeClean(cleanFiles, { allowCaution: true });
      if (result.failedCount && result.failedCount > 0) {
        message.warning(`已清理 ${result.itemCount} 个文件，${result.failedCount} 个被安全策略阻止`);
      } else {
        message.success(`已清理 ${result.itemCount} 个文件，释放 ${formatSize(result.freedBytes)}`);
      }
      const successIds = new Set((result.results || []).filter((r) => r.success).map((r) => r.id));
      setFiles((prev) => prev.filter((f) => !successIds.has(f.id)));
      setSelectedIds(new Set());
    } catch {
      message.error('删除失败');
    }
  };

  const handleCancelDelete = () => {
    if (countdownState?.timerId) {
      clearInterval(countdownState.timerId);
    }
    setCountdownState(null);
  };

  const handleSingleAnalysis = async (item: ScanItem) => {
    if (!window.electronAPI) return;
    if (analyzingFileId) return; // 防止同时分析多个

    // 查缓存
    if (analysisCache?.[item.path]) {
      const cached = analysisCache[item.path];
      setSingleAnalysisMap(prev => {
        const next = new Map(prev);
        next.set(item.id, cached);
        return next;
      });
      setAiSafetyMap(prev => {
        const next = new Map(prev);
        next.set(item.id, mapToAISafety(cached));
        return next;
      });
      setViewingFileId(item.id);
      return;
    }

    setAnalyzingFileId(item.id);
    try {
      const result = await window.electronAPI.analyzeSingleFile(item);
      setSingleAnalysisMap(prev => {
        const next = new Map(prev);
        next.set(item.id, result);
        return next;
      });
      // 同步更新 AI 风险评估列和综合删除判断
      setAiSafetyMap(prev => {
        const next = new Map(prev);
        next.set(item.id, mapToAISafety(result));
        return next;
      });
      // 分析完成后自动弹出建议详情
      setViewingFileId(item.id);
    } catch (err: any) {
      message.error(`分析失败: ${cleanAIError(err)}`);
    } finally {
      setAnalyzingFileId(null);
    }
  };

  // 获取文件的有效安全等级：系统与 AI 取更保守结果
  const getEffectiveSafety = (item: ScanItem): SafetyLevel => getConservativeSafety(item, aiSafetyMap);

  const filteredFiles = files
    .filter((f) => typeFilter === 'all' || guessFileType(f.name) === typeFilter)
    .filter((f) => safetyFilter === 'all' || getEffectiveSafety(f) === safetyFilter);

  // 批量 AI 分析 — 每次分析最大的 10 个未分析文件
  const handleBatchAnalysis = useCallback(async () => {
    if (!window.electronAPI || loading) return;

    // 按大小降序排列，取前 10 个未分析且未缓存的文件
    const sorted = [...files].sort((a, b) => b.size - a.size);
    const unanalyzed = sorted.filter(f => {
      if (aiSafetyMap.has(f.id)) return false;          // 本次会话已分析
      if (analysisCache?.[f.path]) return false;         // 历史缓存
      return true;
    });
    const total = unanalyzed.length;
    if (total === 0) {
      message.info('所有文件已通过 AI 评估');
      return;
    }

    const batchSize = Math.min(10, total);
    const batch = unanalyzed.slice(0, batchSize);
    const remaining = total - batchSize;

    setBatchProgress({ current: 0, total: batchSize, currentItem: `准备分析 0/${batchSize}` });

    let analyzedCount = 0;

    for (let i = 0; i < batchSize; i++) {
      const file = batch[i];
      setBatchProgress({ current: i + 1, total: batchSize, currentItem: `正在分析 ${i + 1}/${batchSize}: ${file.name}` });

      try {
        const result = await window.electronAPI.analyzeSingleFile(file);

        // 存入 singleAnalysisMap（供 AI 建议详情弹窗使用）
        setSingleAnalysisMap(prev => {
          const next = new Map(prev);
          next.set(file.id, result);
          return next;
        });

        // 映射到 aiSafetyMap（供 AI 风险评估列和综合删除判断）
        setAiSafetyMap(prev => {
          const next = new Map(prev);
          next.set(file.id, mapToAISafety(result));
          return next;
        });

        analyzedCount++;
      } catch {
        // 分析失败重试最多 2 次（共 3 次）
        let retrySuccess = false;
        for (let r = 0; r < 2; r++) {
          setBatchProgress({ current: i + 1, total: batchSize, currentItem: `正在分析 ${i + 1}/${batchSize}: ${file.name}（重试 ${r + 1}/2）` });
          try {
            const retryResult = await window.electronAPI.analyzeSingleFile(file);
            setSingleAnalysisMap(prev => {
              const next = new Map(prev);
              next.set(file.id, retryResult);
              return next;
            });
            setAiSafetyMap(prev => {
              const next = new Map(prev);
              next.set(file.id, mapToAISafety(retryResult));
              return next;
            });
            analyzedCount++;
            retrySuccess = true;
            break;
          } catch {
            // 继续重试
          }
        }
        if (!retrySuccess) {
          // 三次均失败，跳过该文件
        }
      }
    }

    if (remaining > 0) {
      message.success(`已分析 ${analyzedCount} 个文件，剩余 ${remaining} 个未评估`);
    } else {
      message.success(`AI 评估完成，共分析 ${analyzedCount} 个文件`);
    }
    setBatchProgress(null);
  }, [files, aiSafetyMap, loading]);

  // 检查 AI 是否已配置
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.getAIConfig().then((config) => {
      setAiReady(config.mode !== 'disabled' && !!config.apiKey);
    }).catch(() => setAiReady(false));
  }, []);

  const columns: ColumnsType<ScanItem> = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string) => (
        <span title={name}>{name}</span>
      ),
    },
    {
      title: '类型',
      key: 'category',
      width: 110,
      render: (_: unknown, record: ScanItem) => {
        const ext = record.name.split('.').pop()?.toLowerCase() || '';
        const cat = getFileCategory(ext);
        return <Tag color={cat.color}>{cat.label}</Tag>;
      },
    },
    { title: '路径', dataIndex: 'path', key: 'path', ellipsis: true },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 80,
      render: (v: number) => <strong>{formatSize(v)}</strong>,
      sorter: (a, b) => a.size - b.size,
      defaultSortOrder: 'descend',
    },
    {
      title: '安全等级',
      key: 'safety',
      width: 100,
      render: (_: unknown, record: ScanItem) => {
        const st = SAFETY_TAGS[getEffectiveSafety(record)] || { text: '未知', color: 'default' };
        return <Tag color={st.color}>{st.text}</Tag>;
      },
    },
    {
      title: 'AI 风险评估',
      key: 'ai-safety',
      width: 100,
      render: (_: unknown, record: ScanItem) => {
        const ai = aiSafetyMap.get(record.id);
        if (!ai) return null;
        const st = AI_SAFETY_TAGS[ai.safety] || { text: '未知', color: 'default' };
        return (
          <Tag color={st.color} title={ai.reason}>{st.text}</Tag>
        );
      },
    },
    {
      title: 'AI 建议',
      key: 'ai-suggestion',
      width: 100,
      render: (_: unknown, record: ScanItem) => {
        const analysis = singleAnalysisMap.get(record.id);
        if (!analysis) return null;
        return (
          <Button
            type="link"
            size="small"
            icon={<RobotOutlined />}
            onClick={() => setViewingFileId(record.id)}
          >
            查看建议
          </Button>
        );
      },
    },
    { title: '修改时间', dataIndex: 'description', key: 'modified', width: 140 },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: ScanItem) => {
        const isAnalyzing = analyzingFileId === record.id;
        return (
          <Space>
            <Button
              type="link"
              size="small"
              icon={isAnalyzing ? <LoadingOutlined /> : <RobotOutlined />}
              disabled={!!analyzingFileId}
              onClick={() => handleSingleAnalysis(record)}
            >
              {isAnalyzing ? '分析中...' : 'AI 分析'}
            </Button>
            <Button
              type="link"
              size="small"
              icon={<FolderOpenOutlined />}
              onClick={() => handleOpenLocation(record.path)}
            >
              打开位置
            </Button>
          </Space>
        );
      },
    },
  ];

  // 当前要查看详情弹窗的文件分析结果
  const viewingAnalysis = viewingFileId ? singleAnalysisMap.get(viewingFileId) : null;

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Space>
          <img src={largeFileImg} alt="大文件" style={{ width: 32, height: 32, borderRadius: 6 }} />
          <Title level={4} style={{ margin: 0 }}>大文件分析</Title>
          {loading && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              已扫描 {files.length} 个大文件...
            </Text>
          )}
        </Space>
        <Space>
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            options={FILE_TYPE_OPTIONS}
            style={{ width: 120 }}
          />
          <Select
            value={safetyFilter}
            onChange={setSafetyFilter}
            options={[
              { value: 'all', label: '全部等级' },
              { value: 'safe', label: '可安全删除' },
              { value: 'caution', label: '谨慎清理' },
              { value: 'keep', label: '禁止清理' },
            ]}
            style={{ width: 120 }}
          />
          <Button
            icon={<RobotOutlined />}
            onClick={handleBatchAnalysis}
            loading={!!batchProgress}
            disabled={!aiReady || loading}
            title={!aiReady ? '请先在 AI 配置中设置 API Key' : loading ? '扫描中无法分析' : '每次分析最多 10 个最大的未评估文件'}
            style={{ fontSize: 13 }}
          >
            {batchProgress ? batchProgress.currentItem : 'AI 批量分析'}
          </Button>
          {analysisCache && Object.keys(analysisCache).length > 0 && (
            <Button
              icon={<DeleteOutlined />}
              onClick={async () => {
                await window.electronAPI?.clearAnalysisCache();
                setAnalysisCache(null);
                setAiSafetyMap(new Map());
                setSingleAnalysisMap(new Map());
                message.success('AI 分析缓存已清除');
              }}
              style={{ fontSize: 12 }}
            >
              清除 AI 缓存
            </Button>
          )}
          <Button
            icon={<FolderOpenOutlined />}
            onClick={() => window.electronAPI?.openRecycleBin()}
            style={{ fontSize: 13 }}
          >
            回收站
          </Button>
          {files.length > 0 && (
            <>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleDelete}
                disabled={selectedIds.size === 0}
              >
                清理选中 ({selectedIds.size})
              </Button>
            </>
          )}
          <Button
            type="primary"
            icon={<FileSearchOutlined />}
            onClick={handleScan}
            loading={loading}
          >
            {files.length === 0 ? '开始扫描' : '重新扫描'}
          </Button>
        </Space>
      </Row>

      {files.length === 0 && !loading ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <img src={largeFileImg} alt="大文件分析" style={{ width: 120, height: 'auto', marginBottom: 16 }} />
            <Title level={4} style={{ margin: '0 0 6px' }}>大文件分析</Title>
            <Text type="secondary" style={{ fontSize: 14, display: 'block', marginBottom: 28, maxWidth: 420, margin: '0 auto 28px' }}>
              扫描磁盘中占用空间较大的文件，按类型分类查看，选择性清理
            </Text>
            <Button type="primary" size="large" icon={<FileSearchOutlined />} onClick={handleScan} loading={loading}>
              开始扫描
            </Button>

            <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              {[
                { label: '缓存文件', ext: 'tmp / log / cache', color: '#faad14', icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#faad14' }} /> },
                { label: '数据文件', ext: 'db / sqlite / mdb', color: '#ff4d4f', icon: <DatabaseOutlined style={{ fontSize: 24, color: '#ff4d4f' }} /> },
                { label: '安装包', ext: 'zip / rar / iso', color: '#1677ff', icon: <InboxOutlined style={{ fontSize: 24, color: '#1677ff' }} /> },
                { label: '视频文件', ext: 'mp4 / avi / mkv', color: '#722ed1', icon: <PlaySquareOutlined style={{ fontSize: 24, color: '#722ed1' }} /> },
                { label: '文档文件', ext: 'pdf / doc / csv', color: '#2f54eb', icon: <FileTextOutlined style={{ fontSize: 24, color: '#2f54eb' }} /> },
              ].map((cat) => (
                <div
                  key={cat.label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '12px 16px',
                    background: '#fafafa',
                    borderRadius: 8,
                    border: '1px solid #f0f0f0',
                    minWidth: 100,
                  }}
                >
                  {cat.icon}
                  <div style={{ fontSize: 13, fontWeight: 500, color: cat.color }}>{cat.label}</div>
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>{cat.ext}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          {files.length > 0 && (
            <>
              <div style={{
                marginBottom: 8,
                padding: '10px 16px',
                background: '#fffbe6',
                border: '1px solid #ffe58f',
                borderRadius: 8,
                fontSize: 13,
                color: '#ad8b00',
                lineHeight: 1.6,
              }}>
                ⚠ 大文件删除后请确认不影响正在使用的程序。如不确定文件用途，建议先搜索确认。
              </div>
              <div style={{
                marginBottom: 16,
                padding: '10px 16px',
                background: '#fff2f0',
                border: '1px solid #ffccc7',
                borderRadius: 8,
                fontSize: 13,
                color: '#cf1322',
                lineHeight: 1.6,
                fontWeight: 500,
              }}>
                AI 分析建议仅供参考，请务必确认文件用途后再清理。普通文件恢复以回收站为准。
              </div>
            </>
          )}
          <Table
          dataSource={filteredFiles}
          columns={columns}
          rowKey="id"
          pagination={{
            pageSize: pageSize,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onShowSizeChange: (_current, size) => setPageSize(size),
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          size="small"
          rowSelection={{
            selectedRowKeys: Array.from(selectedIds),
            onChange: (keys) => {
              const nextKeys = (keys as string[]).filter((id) => {
                const file = files.find((f) => f.id === id);
                return file && getEffectiveSafety(file) !== 'keep';
              });
              setSelectedIds(new Set(nextKeys));
            },
            getCheckboxProps: (record: ScanItem) => ({
              disabled: getEffectiveSafety(record) === 'keep',
            }),
          }}
          locale={{
            emptyText: loading
              ? `正在扫描大文件，已发现 ${files.length} 个...`
              : '点击「开始扫描」查找 50MB 以上的大文件',
          }}
        />
      </Card>
      )}


      {/* 重要文件清理倒计时弹窗 */}
      <Modal
        title={
          <Space>
            <WarningOutlined style={{ color: '#ff4d4f' }} />
            检测到重要文件，请仔细确认
          </Space>
        }
        open={!!countdownState?.visible}
        onCancel={handleCancelDelete}
        footer={
          <Space>
            <Button onClick={handleCancelDelete}>取消清理</Button>
            <Button
              danger
              type="primary"
              disabled={(countdownState?.countdown ?? 1) > 0}
              onClick={() => doDelete(countdownState!.files)}
            >
              {countdownState && countdownState.countdown > 0
                ? `确认清理 (${countdownState.countdown}s)`
                : '确认清理'}
            </Button>
          </Space>
        }
        width={560}
      >
        <div style={{ padding: '8px 0' }}>
          <Text type="danger" strong style={{ fontSize: 15 }}>
            以下重要文件不建议清理，否则可能导致程序运行异常或数据丢失！
          </Text>

          {countdownState && countdownState.countdown > 0 && (
            <div
              style={{
                textAlign: 'center',
                margin: '16px 0',
                padding: 12,
                background: '#fff2f0',
                borderRadius: 8,
                border: '1px solid #ffccc7',
              }}
            >
              <Text style={{ fontSize: 36, fontWeight: 700, color: '#ff4d4f' }}>
                {countdownState.countdown}
              </Text>
              <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                秒后可确认清理
              </Text>
            </div>
          )}

          <div
            style={{
              maxHeight: 240,
              overflow: 'auto',
              marginTop: 12,
              border: '1px solid #ffccc7',
              borderRadius: 6,
              padding: '8px 12px',
              background: '#fff',
            }}
          >
            {countdownState?.files.filter(f => isImportantFile(f, aiSafetyMap)).map(f => (
              <div
                key={f.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                  borderBottom: '1px solid #f5f5f5',
                }}
              >
                <Space>
                  <Tag color="red" style={{ marginRight: 4 }}>重要</Tag>
                  <Text style={{ fontSize: 13 }}>{f.name}</Text>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>{formatSize(f.size)}</Text>
              </div>
            ))}
            {countdownState && countdownState.files.filter(f => !isImportantFile(f, aiSafetyMap)).length > 0 && (
              <div style={{ padding: '8px 0', color: '#8c8c8c', fontSize: 12 }}>
                另有 {countdownState.files.filter(f => !isImportantFile(f, aiSafetyMap)).length} 个安全文件
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* AI 分析详情弹窗 */}
      <Modal
        title={
          <Space>
            <RobotOutlined />
            AI 文件分析详情
          </Space>
        }
        open={!!viewingFileId}
        onCancel={() => setViewingFileId(null)}
        footer={
          <Button onClick={() => setViewingFileId(null)}>关闭</Button>
        }
        width={640}
      >
        {!viewingAnalysis ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : (
          <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }} labelStyle={{ width: 100 }}>
            <Descriptions.Item label="文件类型">{viewingAnalysis.type}</Descriptions.Item>
            <Descriptions.Item label="用途说明">{viewingAnalysis.purpose}</Descriptions.Item>
            <Descriptions.Item label="风险等级">
              <Tag
                color={
                  viewingAnalysis.riskLevel === 'low' ? 'success' :
                  viewingAnalysis.riskLevel === 'medium' ? 'warning' : 'error'
                }
              >
                {viewingAnalysis.riskLevel === 'low' ? '低风险' :
                 viewingAnalysis.riskLevel === 'medium' ? '中风险' : '高风险'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="建议操作">
              {viewingAnalysis.suggestDelete ? (
                <Tag color="success" icon={<CheckCircleOutlined />}>建议删除</Tag>
              ) : (
                <Tag color="error" icon={<WarningOutlined />}>建议保留</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="详细理由">{viewingAnalysis.reason}</Descriptions.Item>
            {viewingAnalysis.alternativeAction && (
              <Descriptions.Item label="替代方案">{viewingAnalysis.alternativeAction}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* 盘符选择弹窗 */}
      <DriveSelectModal
        open={showDriveSelect}
        onConfirm={handleStartScanWithDrives}
        onCancel={() => setShowDriveSelect(false)}
      />
    </div>
  );
}
