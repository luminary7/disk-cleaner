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

const FILE_TYPE_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: 'video', label: '视频' },
  { value: 'archive', label: '压缩包' },
  { value: 'log', label: '日志' },
  { value: 'image', label: '镜像(ISO)' },
  { value: 'other', label: '其他' },
];

function guessFileType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv'].includes(ext)) return 'video';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  if (['log', 'tmp'].includes(ext)) return 'log';
  if (['iso', 'img'].includes(ext)) return 'image';
  return 'other';
}

export default function LargeFiles() {
  const [files, setFiles] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState('all');

  // 单文件 AI 分析 — 按文件 id 存储分析结果
  const [singleAnalysisMap, setSingleAnalysisMap] = useState<Map<string, SingleFileAnalysis>>(new Map());
  const [analyzingFileId, setAnalyzingFileId] = useState<string | null>(null);
  const [viewingFileId, setViewingFileId] = useState<string | null>(null);

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

    Modal.confirm({
      title: `确定要删除选中的 ${selectedFiles.length} 个文件吗？`,
      content: (
        <div>
          <p>文件将移至回收站，总计 {formatSize(selectedFiles.reduce((s, f) => s + f.size, 0))}</p>
          <ul style={{ maxHeight: 200, overflow: 'auto', paddingLeft: 20 }}>
            {selectedFiles.slice(0, 20).map((f) => (
              <li key={f.id}>{f.name} ({formatSize(f.size)})</li>
            ))}
            {selectedFiles.length > 20 && <li>...及其他 {selectedFiles.length - 20} 个文件</li>}
          </ul>
        </div>
      ),
      okText: '确认删除',
      okType: 'primary',
      cancelText: '取消',
      onOk: async () => {
        if (!window.electronAPI) return;
        try {
          const result = await window.electronAPI.executeClean(selectedFiles);
          message.success(`已删除 ${result.itemCount} 个文件，释放 ${formatSize(result.freedBytes)}`);
          setFiles((prev) => prev.filter((f) => !selectedIds.has(f.id)));
          setSelectedIds(new Set());
        } catch {
          message.error('删除失败');
        }
      },
    });
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
      message.error(`分析失败: ${err?.message || '请检查 AI 配置'}`);
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
        <span>
          <Tag>{name.split('.').pop()}</Tag> {name}
        </span>
      ),
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
