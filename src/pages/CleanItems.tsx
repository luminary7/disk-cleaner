import { useState, useEffect, useRef } from 'react';
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
} from 'antd';
import { ScanOutlined, DeleteOutlined, CloseCircleOutlined, FolderOpenOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import safeCleanImg from '../assets/ui-kit/safe-clean.png';
import tempCacheImg from '../assets/ui-kit/temp-cache.png';
import browserCacheImg from '../assets/ui-kit/browser-cache.png';
import appCacheImg from '../assets/ui-kit/app-cache.png';
import systemCacheImg from '../assets/ui-kit/system-cache.png';
import largeFileImg from '../assets/ui-kit/large-file.png';

const { Title, Text } = Typography;

const CATEGORY_LABELS: Record<string, string> = {
  temp: '系统临时文件',
  browser: '浏览器缓存',
  app: '应用缓存',
  system: '系统缓存',
  'large-file': '大文件',
};

const CATEGORY_IMAGES: Record<string, string> = {
  temp: tempCacheImg,
  browser: browserCacheImg,
  app: appCacheImg,
  system: systemCacheImg,
  'large-file': largeFileImg,
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
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const pendingRestoreRef = useRef<ScanItem[]>([]);

  // 监听增量批次，用于实时滚动展示
  useEffect(() => {
    if (!window.electronAPI) return;

    const cleanups: (() => void)[] = [];

    cleanups.push(window.electronAPI.onScanProgress((data) => {
      if (data.batchItems && data.batchItems.length > 0) {
        setItems(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const newItems = data.batchItems!.filter(i => !existingIds.has(i.id));
          if (newItems.length === 0) return prev;
          return [...prev, ...newItems];
        });
      }
    }));

    cleanups.push(window.electronAPI.onCleanCancelled((data) => {
      pendingRestoreRef.current = data.completedItems;
    }));

    return () => {
      cleanups.forEach(fn => fn());
    };
  }, []);

  const handleScan = async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    setItems([]);
    setSelectedIds(new Set());
    try {
      const result = await window.electronAPI.startScan();
      // 以返回值为准，覆盖增量积累
      setItems(result.items);
      setSelectedIds(new Set(result.items.filter(i => i.safety === 'safe').map(i => i.id)));
    } catch {
      message.error('扫描失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClean = () => {
    const selectedItems = items.filter((i) => selectedIds.has(i.id));
    const cleanableItems = selectedItems.filter((i) => i.safety !== 'keep');
    const hasCautionItems = cleanableItems.some((i) => i.safety === 'caution');

    if (cleanableItems.length === 0) {
      message.warning('选中项目均为建议保留，已被安全策略阻止');
      return;
    }

    const doClean = async () => {
      if (!window.electronAPI) return;
      setCleaning(true);
      pendingRestoreRef.current = [];
      try {
        const result = await window.electronAPI.executeClean(
          cleanableItems,
          hasCautionItems ? { allowCaution: true } : undefined
        );
        if (result.cancelled) {
          const completed = result.completedItems || [];
          if (completed.length > 0) {
            message.loading({ content: '正在回滚已删除文件...', key: 'restore' });
            const r = await window.electronAPI.restoreItems(completed);
            if (r.failed > 0) {
              message.warning({
                content: `已取消清理，恢复 ${r.restored} 项，${r.failed} 项恢复失败`,
                key: 'restore',
                duration: 5,
              });
            } else {
              message.success({ content: `已取消清理，全部 ${r.restored} 项已恢复`, key: 'restore' });
            }
          } else {
            message.info('已取消清理（无已删除文件需要恢复）');
          }
        } else {
          const restoreMsg = result.restorePoint?.message ? `，${result.restorePoint.message}` : '';
          if (result.failedCount && result.failedCount > 0) {
            message.warning(`已清理 ${result.itemCount} 项，${result.failedCount} 项被阻止${restoreMsg}`);
          } else {
            message.success(`已清理 ${result.itemCount} 项，释放 ${formatSize(result.freedBytes)}${restoreMsg}`);
          }
          const successIds = new Set((result.results || []).filter((r) => r.success).map((r) => r.id));
          setItems((prev) => prev.filter((i) => !successIds.has(i.id)));
          setSelectedIds(new Set());
        }
      } finally {
        setCleaning(false);
      }
    };

    if (hasCautionItems) {
      Modal.confirm({
        title: '确定要清理选中的「谨慎项」吗？',
        content: '谨慎项可能包含近期缓存、系统缓存或需要人工判断的文件。请确认这些项目不影响你的数据和程序使用。',
        okText: '确认清理',
        cancelText: '取消',
        onOk: doClean,
      });
    } else {
      doClean();
    }
  };

  const toggleSelect = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (item?.safety === 'keep') return;
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

  const handleSingleDelete = async (item: ScanItem) => {
    if (!window.electronAPI) return;

    if (item.safety === 'keep') {
      message.warning('建议保留项目已被安全策略阻止');
      return;
    }

    let options: CleanOptions | undefined;
    if (item.safety === 'caution') {
      const confirmed = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: '确认清理谨慎项？',
          content: '此项目需要人工确认。请确认它不是正在使用的数据或重要文件。',
          okText: '确认清理',
          okType: 'danger',
          cancelText: '取消',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!confirmed) return;
      options = { allowCaution: true };
    }

    setDeletingIds(prev => new Set(prev).add(item.id));
    try {
      const result = await window.electronAPI.cleanSingle(item, options);
      if (result.success) {
        message.success(`已清理: ${item.name}`);
        setItems(prev => prev.filter(i => i.id !== item.id));
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      } else {
        message.error(`删除失败: ${result.error || '未知错误'}`);
      }
    } catch {
      message.error('删除失败');
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const sortedItems = [...items].sort((a, b) => b.size - a.size);

  const columns: ColumnsType<ScanItem> = [
    {
      title: (
        <Checkbox
          checked={items.some((i) => i.safety !== 'keep') && selectedIds.size === items.filter((i) => i.safety !== 'keep').length}
          onChange={() => {
            const selectableItems = items.filter((i) => i.safety !== 'keep');
            if (selectedIds.size === selectableItems.length) {
              setSelectedIds(new Set());
            } else {
              setSelectedIds(new Set(selectableItems.map((i) => i.id)));
            }
          }}
        />
      ),
      dataIndex: 'id',
      key: 'checkbox',
      width: 40,
      render: (id: string, record) => (
        <Checkbox
          checked={selectedIds.has(id)}
          disabled={record.safety === 'keep'}
          onChange={() => toggleSelect(id)}
        />
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
      render: (v: string) => (
        <Space size={4}>
          <img
            src={CATEGORY_IMAGES[v]}
            alt={CATEGORY_LABELS[v] || v}
            style={{ width: 20, height: 20, borderRadius: 3, verticalAlign: 'middle' }}
          />
          {CATEGORY_LABELS[v] || v}
        </Space>
      ),
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
    {
      title: '操作',
      key: 'action',
      width: 130,
      render: (_: unknown, record: ScanItem) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            icon={<FolderOpenOutlined />}
            onClick={() => window.electronAPI?.openFileLocation(record.path)}
          />
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            loading={deletingIds.has(record.id)}
            disabled={record.safety === 'keep'}
            onClick={() => handleSingleDelete(record)}
          >
            清理
          </Button>
        </Space>
      ),
    },
  ];

  const totalSelectedSize = items
    .filter((i) => selectedIds.has(i.id))
    .reduce((sum, i) => sum + i.size, 0);

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Space>
          <img src={safeCleanImg} alt="逐项清理" style={{ width: 40,  borderRadius: 6 }} />
          <Title level={4} style={{ margin: 0 }}>逐项清理</Title>
          {loading && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              已扫描 {items.length} 项...
            </Text>
          )}
        </Space>
        <Space>
          {items.length > 0 && !cleaning && (
            <>
              <Button onClick={selectSafe}>仅选安全项目</Button>
              {selectedIds.size > 0 && (
                <Button onClick={() => setSelectedIds(new Set())}>取消选择</Button>
              )}
              <Button
                type="primary"
                icon={<DeleteOutlined />}
                onClick={handleClean}
                disabled={selectedIds.size === 0}
              >
                清理选中 ({selectedIds.size} 项, {formatSize(totalSelectedSize)})
              </Button>
            </>
          )}
          {cleaning && (
            <Button
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => window.electronAPI?.cancelClean()}
            >
              终止清理
            </Button>
          )}
          <Button
            icon={<DeleteOutlined />}
            onClick={() => window.electronAPI?.openRecycleBin()}
          >
            打开回收站
          </Button>
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

      {items.length === 0 && !loading ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <img src={safeCleanImg} alt="逐项清理" style={{ width: 200, height: 'auto', marginBottom: 16 }} />
            <Title level={4} style={{ margin: '0 0 6px' }}>逐项清理</Title>
            <Text type="secondary" style={{ fontSize: 14, display: 'block', marginBottom: 28, maxWidth: 420, margin: '0 auto 28px' }}>
              勾选需要清理的项目，逐项确认后再批量删除，更加安全可控
            </Text>
            <Button type="primary" size="large" icon={<ScanOutlined />} onClick={handleScan} loading={loading}>
              开始扫描
            </Button>

            <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              {[
                { key: 'temp', label: '临时文件', icon: tempCacheImg, desc: '系统及应用运行缓存' },
                { key: 'browser', label: '浏览器缓存', icon: browserCacheImg, desc: '浏览记录及缓存' },
                { key: 'app', label: '应用缓存', icon: appCacheImg, desc: '第三方应用数据' },
                { key: 'system', label: '系统文件', icon: systemCacheImg, desc: '系统更新残留' },
                { key: 'large-file', label: '大文件', icon: largeFileImg, desc: '占用空间较大的文件' },
              ].map((cat) => (
                <div
                  key={cat.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: '#fafafa',
                    borderRadius: 8,
                    border: '1px solid #f0f0f0',
                  }}
                >
                  <img src={cat.icon} alt={cat.label} style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#262626' }}>{cat.label}</div>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>{cat.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <Table
          dataSource={sortedItems}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          size="small"
          locale={{
            emptyText: loading
              ? `正在扫描中，已发现 ${items.length} 项...`
              : '点击「开始扫描」查找可清理项目',
          }}
        />
      </Card>
      )}
    </div>
  );
}
