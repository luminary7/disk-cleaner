import { useState, useEffect, useRef } from 'react';
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
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

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

function cleanAIError(err: any): string {
  const msg = err?.message || '';
  // IPC invoke 包装格式: "Error invoking remote method 'xxx': Error: 真实消息"
  const idx = msg.lastIndexOf('Error: ');
  return idx >= 0 ? msg.slice(idx + 7) : msg || '请检查 AI 配置';
}
function isImportantFile(item: ScanItem): boolean {
  if (item.safety !== 'safe') return true;
  const ext = item.name.split('.').pop()?.toLowerCase() || '';
  const dangerousExts = ['db', 'sqlite', 'sqlite3', 'mdb', 'dbx', 'mysql', 'sql', 'dbf',
    'exe', 'dll', 'msi', 'sys', 'ocx', 'drv', 'cpl'];
  return dangerousExts.includes(ext);
}

const SAFETY_TAGS: Record<string, { text: string; color: string }> = {
  safe: { text: '可安全删除', color: 'green' },
  caution: { text: '谨慎清理', color: 'orange' },
  keep: { text: '禁止清理', color: 'red' },
};

export default function LargeFiles() {
  const [files, setFiles] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState('all');

  // 单文件 AI 分析 — 按文件 id 存储分析结果
  const [singleAnalysisMap, setSingleAnalysisMap] = useState<Map<string, SingleFileAnalysis>>(new Map());
  const [analyzingFileId, setAnalyzingFileId] = useState<string | null>(null);
  const [viewingFileId, setViewingFileId] = useState<string | null>(null);

  // 倒计时删除确认
  const [countdownState, setCountdownState] = useState<{
    visible: boolean;
    countdown: number;
    files: ScanItem[];
    timerId?: any;
  } | null>(null);

  // 仅监听增量批次，用于实时滚动展示
  // 用 ref 防止 StrictMode 下重复注册导致文件重复
  const listenerRegistered = useRef(false);
  useEffect(() => {
    if (!window.electronAPI) return;
    if (listenerRegistered.current) return;
    listenerRegistered.current = true;

    window.electronAPI.onLargeFileProgress((data) => {
      if (data.batchItems && data.batchItems.length > 0) {
        setFiles(prev => {
          const next = [...prev, ...data.batchItems!];
          next.sort((a, b) => b.size - a.size);
          return next;
        });
      }
    });
  }, []);

  // 文件更新时自动取消勾选"禁止清理"项
  useEffect(() => {
    const keepIds = new Set(files.filter(f => f.safety === 'keep').map(f => f.id));
    setSelectedIds(prev => {
      let changed = false;
      for (const id of prev) {
        if (keepIds.has(id)) { changed = true; break; }
      }
      if (!changed) return prev;
      const next = new Set(prev);
      keepIds.forEach(id => next.delete(id));
      return next;
    });
  }, [files]);

  const handleScan = async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    setFiles([]);
    setSingleAnalysisMap(new Map());
    setSelectedIds(new Set());
    try {
      const result = await window.electronAPI.startLargeFileScan();
      // 按大小倒序排序，保证初始展示和增量数据一致
      result.sort((a, b) => b.size - a.size);
      setFiles(result);
      message.success(`找到 ${result.length} 个大文件`);
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
    const importantFiles = selectedFiles.filter(isImportantFile);

    if (importantFiles.length > 0) {
      // 10 秒倒计时警告
      let count = 10;
      setCountdownState({ visible: true, countdown: count, files: selectedFiles });

      const timerId = setInterval(() => {
        count--;
        setCountdownState(prev => prev ? { ...prev, countdown: count } : null);
        if (count <= 0) {
          clearInterval(timerId);
        }
      }, 1000);

      setCountdownState(prev => prev ? { ...prev, timerId } : null);
      return;
    }

    // 无重要文件，直接确认删除
    Modal.confirm({
      title: `确定要删除选中的 ${selectedFiles.length} 个文件吗？`,
      content: (
        <div>
          <p>文件将移至回收站，总计 {formatSize(selectedFiles.reduce((s, f) => s + f.size, 0))}</p>
        </div>
      ),
      okText: '确认删除',
      okType: 'primary',
      cancelText: '取消',
      onOk: () => doDelete(selectedFiles),
    });
  };

  const doDelete = async (targetFiles: ScanItem[]) => {
    if (!window.electronAPI) return;
    // 关闭倒计时弹窗
    setCountdownState(null);
    // 安全过滤：禁止清理的文件不可删除
    const cleanFiles = targetFiles.filter(f => f.safety !== 'keep');
    if (cleanFiles.length === 0) {
      message.warning('选中文件中无可删除项目');
      return;
    }
    try {
      const result = await window.electronAPI.executeClean(cleanFiles);
      message.success(`已删除 ${result.itemCount} 个文件，释放 ${formatSize(result.freedBytes)}`);
      setFiles((prev) => prev.filter((f) => !cleanFiles.some(t => t.id === f.id)));
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
    setAnalyzingFileId(item.id);
    try {
      const result = await window.electronAPI.analyzeSingleFile(item);
      setSingleAnalysisMap(prev => {
        const next = new Map(prev);
        next.set(item.id, result);
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

  const filteredFiles = files
    .filter((f) => typeFilter === 'all' || guessFileType(f.name) === typeFilter);

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
      render: (v: number) => <strong>{formatSize(v)}</strong>,
      sorter: (a, b) => a.size - b.size,
      defaultSortOrder: 'descend',
    },
    {
      title: '安全等级',
      key: 'safety',
      width: 100,
      render: (_: unknown, record: ScanItem) => {
        const st = SAFETY_TAGS[record.safety] || { text: '未知', color: 'default' };
        return <Tag color={st.color}>{st.text}</Tag>;
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
    { title: '修改时间', dataIndex: 'description', key: 'modified' },
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
          {files.length > 0 && (
            <>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleDelete}
                disabled={selectedIds.size === 0}
              >
                删除选中 ({selectedIds.size})
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

      <Card>
        <Table
          dataSource={filteredFiles}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          size="small"
          rowSelection={{
            selectedRowKeys: Array.from(selectedIds),
            onChange: (keys) => setSelectedIds(new Set(keys as string[])),
            getCheckboxProps: (record: ScanItem) => ({
              disabled: record.safety === 'keep',
            }),
          }}
          locale={{
            emptyText: loading
              ? `正在扫描大文件，已发现 ${files.length} 个...`
              : '点击「开始扫描」查找 50MB 以上的大文件',
          }}
        />
      </Card>

      {files.length > 0 && (
        <Card style={{ marginTop: 16, background: '#fffbe6' }}>
          <Typography.Text type="warning">
            ⚠ 大文件删除后请确认不影响正在使用的程序。如不确定文件用途，建议先搜索确认。
          </Typography.Text>
        </Card>
      )}

      {/* 开发辅助：重载窗口（修改 electron/ 下文件后点击，替代重启） */}
      {window.electronAPI?.reloadWindow && (
        <div style={{ textAlign: 'right', marginTop: 8 }}>
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => window.electronAPI!.reloadWindow()}
          >
            重载窗口（开发用）
          </Button>
        </div>
      )}

      {/* 重要文件删除倒计时弹窗 */}
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
            <Button onClick={handleCancelDelete}>取消删除</Button>
            <Button
              danger
              type="primary"
              disabled={(countdownState?.countdown ?? 1) > 0}
              onClick={() => doDelete(countdownState!.files)}
            >
              {countdownState && countdownState.countdown > 0
                ? `确认删除 (${countdownState.countdown}s)`
                : '确认删除'}
            </Button>
          </Space>
        }
        width={560}
      >
        <div style={{ padding: '8px 0' }}>
          <Text type="danger" strong style={{ fontSize: 15 }}>
            以下重要文件不建议删除，否则可能导致程序运行异常或数据丢失！
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
                秒后可确认删除
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
            {countdownState?.files.filter(isImportantFile).map(f => (
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
            {countdownState && countdownState.files.filter(f => !isImportantFile(f)).length > 0 && (
              <div style={{ padding: '8px 0', color: '#8c8c8c', fontSize: 12 }}>
                另有 {countdownState.files.filter(f => !isImportantFile(f)).length} 个安全文件
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
          <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
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
                <Tag color="error" icon={<WarningOutlined />}>建议删除</Tag>
              ) : (
                <Tag color="success" icon={<CheckCircleOutlined />}>建议保留</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="详细理由">{viewingAnalysis.reason}</Descriptions.Item>
            {viewingAnalysis.alternativeAction && (
              <Descriptions.Item label="替代方案">{viewingAnalysis.alternativeAction}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
