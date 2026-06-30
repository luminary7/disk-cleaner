import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Tag,
  Typography,
  Modal,
  message,
  Space,
  Checkbox,
  Row,
  Col,
} from 'antd';
import { ScanOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;

const CATEGORY_LABELS: Record<string, string> = {
  temp: '系统临时文件',
  browser: '浏览器缓存',
  app: '应用缓存',
  system: '系统缓存',
  'large-file': '大文件',
};

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

export default function CleanItems() {
  const [items, setItems] = useState<ScanItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const handleScan = async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.startScan();
      setItems(result.items);
      // Auto-select safe items
      const safeIds = result.items.filter((i) => i.safety === 'safe').map((i) => i.id);
      setSelectedIds(new Set(safeIds));
    } finally {
      setLoading(false);
    }
  };

  const handleClean = () => {
    const selectedItems = items.filter((i) => selectedIds.has(i.id));
    const hasKeepItems = selectedItems.some((i) => i.safety === 'keep');

    const doClean = async () => {
      if (!window.electronAPI) return;
      setCleaning(true);
      try {
        const result = await window.electronAPI.executeClean(selectedItems);
        message.success(`已清理 ${result.itemCount} 项，释放 ${formatSize(result.freedBytes)}`);
        setItems((prev) => prev.filter((i) => !selectedIds.has(i.id)));
        setSelectedIds(new Set());
      } finally {
        setCleaning(false);
      }
    };

    if (hasKeepItems) {
      Modal.confirm({
        title: '确定要清理选中的「建议保留」项目吗？',
        content: '这些项目可能对系统正常运行有帮助，建议谨慎操作。',
        okText: '确认清理',
        cancelText: '取消',
        onOk: doClean,
      });
    } else {
      doClean();
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectSafe = () => {
    const safeIds = items.filter((i) => i.safety === 'safe').map((i) => i.id);
    setSelectedIds(new Set(safeIds));
  };

  const columns: ColumnsType<ScanItem> = [
    {
      title: <Checkbox checked={items.length > 0 && selectedIds.size === items.length} />,
      dataIndex: 'id',
      key: 'checkbox',
      width: 40,
      render: (id: string) => (
        <Checkbox checked={selectedIds.has(id)} onChange={() => toggleSelect(id)} />
      ),
    },
    { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '路径', dataIndex: 'path', key: 'path', ellipsis: true },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (v: number) => formatSize(v),
      sorter: (a, b) => a.size - b.size,
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      render: (v: string) => CATEGORY_LABELS[v] || v,
    },
    {
      title: '安全等级',
      dataIndex: 'safety',
      key: 'safety',
      render: (v: string) => {
        const colors: Record<string, string> = { safe: 'green', caution: 'gold', keep: 'red' };
        const labels: Record<string, string> = { safe: '安全', caution: '需注意', keep: '建议保留' };
        return <Tag color={colors[v]}>{labels[v] || v}</Tag>;
      },
    },
  ];

  const totalSelectedSize = items
    .filter((i) => selectedIds.has(i.id))
    .reduce((sum, i) => sum + i.size, 0);

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>逐项清理</Title>
        <Space>
          {items.length > 0 && (
            <>
              <Button onClick={selectSafe}>仅选安全项目</Button>
              <Button
                type="primary"
                icon={<DeleteOutlined />}
                onClick={handleClean}
                loading={cleaning}
                disabled={selectedIds.size === 0}
              >
                清理选中 ({selectedIds.size} 项, {formatSize(totalSelectedSize)})
              </Button>
            </>
          )}
          <Button
            type={items.length === 0 ? 'primary' : 'default'}
            icon={<ScanOutlined />}
            onClick={handleScan}
            loading={loading}
          >
            {items.length === 0 ? '开始扫描' : '重新扫描'}
          </Button>
        </Space>
      </Row>

      <Card>
        <Table
          dataSource={items}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          size="small"
          locale={{ emptyText: loading ? '扫描中...' : '点击「开始扫描」查找可清理项目' }}
        />
      </Card>
    </div>
  );
}

