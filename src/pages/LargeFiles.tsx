import { useState } from 'react';
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
} from 'antd';
import { FileSearchOutlined, DeleteOutlined, FolderOpenOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

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
  const [sortOrder, setSortOrder] = useState<'descend' | 'ascend'>('descend');

  const handleScan = async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.startLargeFileScan();
      setFiles(result);
      message.success(`找到 ${result.length} 个大文件`);
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
    { title: '修改时间', dataIndex: 'description', key: 'modified' },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: ScanItem) => (
        <Button
          type="link"
          size="small"
          icon={<FolderOpenOutlined />}
          onClick={() => handleOpenLocation(record.path)}
        >
          打开位置
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>大文件分析</Title>
        <Space>
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            options={FILE_TYPE_OPTIONS}
            style={{ width: 120 }}
          />
          {files.length > 0 && (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleDelete}
              disabled={selectedIds.size === 0}
            >
              删除选中 ({selectedIds.size})
            </Button>
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
              ? '正在扫描大文件...'
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
    </div>
  );
}
