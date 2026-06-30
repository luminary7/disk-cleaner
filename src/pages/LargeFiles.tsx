import { useState, useEffect } from 'react';
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
  Drawer,
  Tooltip,
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

interface FileAnalysis {
  name: string;
  type: string;
  purpose: string;
  suggestDelete: boolean;
  reason: string;
}

export default function LargeFiles() {
  const [files, setFiles] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState('all');

  // AI 分析相关状态
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMap, setAnalysisMap] = useState<Map<string, FileAnalysis>>(new Map());
  const [drawerVisible, setDrawerVisible] = useState(false);

  // 单文件 AI 分析
  const [singleAnalysis, setSingleAnalysis] = useState<SingleFileAnalysis | null>(null);
  const [singleModalVisible, setSingleModalVisible] = useState(false);
  const [analyzingFileId, setAnalyzingFileId] = useState<string | null>(null);

  // 仅监听增量批次，用于实时滚动展示
  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onLargeFileProgress((data) => {
      if (data.batchItems && data.batchItems.length > 0) {
        setFiles(prev => [...prev, ...data.batchItems!]);
      }
    });
  }, []);

  const handleScan = async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    setFiles([]);
    setAnalysisMap(new Map());
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

  // AI 分析
  const handleAIAnalysis = async () => {
    if (!window.electronAPI) return;
    if (files.length === 0) {
      message.warning('请先扫描大文件');
      return;
    }
    setAnalyzing(true);
    try {
      const result = await window.electronAPI.analyzeFiles(files);
      if (!result || !result.analysis) {
        throw new Error('分析返回结果为空');
      }
      const map = new Map<string, FileAnalysis>();
      result.analysis.forEach((a) => map.set(a.name.toLowerCase(), a));
      setAnalysisMap(map);
      setDrawerVisible(true);
      message.success(`AI 分析完成，共分析 ${result.analysis.length} 个文件`);
    } catch (err: any) {
      message.error(`AI 分析失败: ${err?.message || '请检查 AI 配置'}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSingleAnalysis = async (item: ScanItem) => {
    if (!window.electronAPI) return;
    if (analyzingFileId) return; // 防止同时分析多个
    setAnalyzingFileId(item.id);
    setSingleAnalysis(null);
    try {
      const result = await window.electronAPI.analyzeSingleFile(item);
      setSingleAnalysis(result);
      setSingleModalVisible(true);
    } catch (err: any) {
      message.error(`分析失败: ${err?.message || '请检查 AI 配置'}`);
    } finally {
      setAnalyzingFileId(null);
    }
  };

  const getAnalysis = (name: string): FileAnalysis | undefined => {
    return analysisMap.get(name.toLowerCase());
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
      width: 90,
      render: (_: unknown, record: ScanItem) => {
        const analysis = getAnalysis(record.name);
        if (!analysis) return null;
        return analysis.suggestDelete ? (
          <Tooltip title={analysis.reason}>
            <Tag color="error" icon={<WarningOutlined />}>建议删除</Tag>
          </Tooltip>
        ) : (
          <Tooltip title={analysis.reason}>
            <Tag color="success" icon={<CheckCircleOutlined />}>建议保留</Tag>
          </Tooltip>
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

  // 分析结果抽屉的列定义
  const analysisColumns: ColumnsType<FileAnalysis> = [
    { title: '文件名', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '文件类型', dataIndex: 'type', key: 'type', ellipsis: true },
    { title: '用途', dataIndex: 'purpose', key: 'purpose', ellipsis: true },
    {
      title: '建议操作',
      dataIndex: 'suggestDelete',
      key: 'suggestDelete',
      width: 100,
      render: (v: boolean) =>
        v ? (
          <Tag color="error" icon={<WarningOutlined />}>建议删除</Tag>
        ) : (
          <Tag color="success" icon={<CheckCircleOutlined />}>建议保留</Tag>
        ),
    },
    { title: '原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
  ];

  const analysisList = Array.from(analysisMap.values());

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
                icon={<RobotOutlined />}
                onClick={handleAIAnalysis}
                loading={analyzing}
                disabled={analysisMap.size > 0}
              >
                AI 分析
              </Button>
              {analysisMap.size > 0 && (
                <Button onClick={() => setDrawerVisible(true)}>
                  查看 AI 分析
                </Button>
              )}
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

      {/* AI 分析结果抽屉 */}
      <Drawer
        title="AI 文件分析结果"
        placement="right"
        width={700}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      >
        {analysisList.length === 0 ? (
          <Text type="secondary">暂无分析结果</Text>
        ) : (
          <>
            <Text style={{ marginBottom: 16, display: 'block' }}>
              AI 共分析了 <strong>{analysisList.length}</strong> 个文件，其中
              <Text type="danger"> <strong>{analysisList.filter((a) => a.suggestDelete).length}</strong> 个建议删除</Text>，
              <Text type="success"> <strong>{analysisList.filter((a) => !a.suggestDelete).length}</strong> 个建议保留</Text>。
            </Text>
            <Table
              dataSource={analysisList}
              columns={analysisColumns}
              rowKey="name"
              pagination={{ pageSize: 20 }}
              size="small"
            />
          </>
        )}
      </Drawer>

      {/* 单文件 AI 分析结果弹窗 */}
      <Modal
        title={
          <Space>
            <RobotOutlined />
            AI 文件分析详情
          </Space>
        }
        open={singleModalVisible}
        onCancel={() => setSingleModalVisible(false)}
        footer={
          <Button onClick={() => setSingleModalVisible(false)}>关闭</Button>
        }
        width={640}
      >
        {!singleAnalysis ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : (
          <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="文件类型">{singleAnalysis.type}</Descriptions.Item>
            <Descriptions.Item label="用途说明">{singleAnalysis.purpose}</Descriptions.Item>
            <Descriptions.Item label="风险等级">
              <Tag
                color={
                  singleAnalysis.riskLevel === 'low' ? 'success' :
                  singleAnalysis.riskLevel === 'medium' ? 'warning' : 'error'
                }
              >
                {singleAnalysis.riskLevel === 'low' ? '低风险' :
                 singleAnalysis.riskLevel === 'medium' ? '中风险' : '高风险'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="建议操作">
              {singleAnalysis.suggestDelete ? (
                <Tag color="error" icon={<WarningOutlined />}>建议删除</Tag>
              ) : (
                <Tag color="success" icon={<CheckCircleOutlined />}>建议保留</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="详细理由">{singleAnalysis.reason}</Descriptions.Item>
            {singleAnalysis.alternativeAction && (
              <Descriptions.Item label="替代方案">{singleAnalysis.alternativeAction}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
