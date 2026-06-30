import { useEffect, useState } from 'react';
import { Card, Col, Row, Table, Typography, Button, Spin } from 'antd';
import ReactEChartsCore from 'echarts-for-react';
import { ScanOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface CategoryStat {
  category: string;
  label: string;
  size: number;
  count: number;
  color: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  temp: '系统临时文件',
  browser: '浏览器缓存',
  app: '应用缓存',
  system: '系统缓存',
  'large-file': '大文件',
};

const CATEGORY_COLORS: Record<string, string> = {
  temp: '#1677ff',
  browser: '#52c41a',
  app: '#faad14',
  system: '#ff4d4f',
  'large-file': '#722ed1',
};

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

export default function SpaceOverview() {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [topItems, setTopItems] = useState<ScanItem[]>([]);

  const handleScan = async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.startScan();
      // Aggregate by category
      const catMap = new Map<string, { size: number; count: number }>();
      result.items.forEach((item) => {
        const existing = catMap.get(item.category) || { size: 0, count: 0 };
        existing.size += item.size;
        existing.count += 1;
        catMap.set(item.category, existing);
      });
      const catStats: CategoryStat[] = Array.from(catMap.entries())
        .map(([key, val]) => ({
          category: key,
          label: CATEGORY_LABELS[key] || key,
          size: val.size,
          count: val.count,
          color: CATEGORY_COLORS[key] || '#999',
        }))
        .sort((a, b) => b.size - a.size);
      setCategories(catStats);

      // Top items
      const sorted = [...result.items].sort((a, b) => b.size - a.size).slice(0, 10);
      setTopItems(sorted);
    } finally {
      setLoading(false);
    }
  };

  const pieOption = {
    tooltip: {
      formatter: (params: any) =>
        `${params.name}<br/>大小: ${formatSize(params.value)}<br/>占比: ${params.percent}%`,
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: {
          formatter: '{b}\n{d}%',
        },
        data: categories.map((c) => ({
          name: c.label,
          value: c.size,
          itemStyle: { color: c.color },
        })),
      },
    ],
  };

  const columns = [
    { title: '文件名', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '路径', dataIndex: 'path', key: 'path', ellipsis: true },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (v: number) => formatSize(v),
      sorter: (a: any, b: any) => a.size - b.size,
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
        const map: Record<string, { text: string; color: string }> = {
          safe: { text: '🟢 安全', color: '#52c41a' },
          caution: { text: '🟡 需注意', color: '#faad14' },
          keep: { text: '🔴 建议保留', color: '#ff4d4f' },
        };
        return <span style={{ color: map[v]?.color }}>{map[v]?.text || v}</span>;
      },
    },
  ];

  const totalSize = categories.reduce((sum, c) => sum + c.size, 0);

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>空间概览</Title>
        <Button type="primary" icon={<ScanOutlined />} onClick={handleScan} loading={loading}>
          扫描C盘
        </Button>
      </Row>

      {categories.length === 0 && !loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
            点击「扫描C盘」查看空间使用情况
          </div>
        </Card>
      )}

      {loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>正在扫描，请稍候...</div>
          </div>
        </Card>
      )}

      {categories.length > 0 && !loading && (
        <>
          <Row gutter={16}>
            <Col span={8}>
              <Card title="总览">
                <Title level={2} style={{ color: '#1677ff', margin: 0 }}>
                  {formatSize(totalSize)}
                </Title>
                <div style={{ color: '#999', marginTop: 8 }}>可清理空间</div>
              </Card>
            </Col>
            {categories.slice(0, 2).map((cat) => (
              <Col span={8} key={cat.category}>
                <Card title={cat.label}>
                  <Title level={4} style={{ margin: 0 }}>
                    {formatSize(cat.size)}
                  </Title>
                  <div style={{ color: '#999', marginTop: 8 }}>{cat.count} 个项目</div>
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Card title="空间分布">
                <ReactEChartsCore option={pieOption} style={{ height: 300 }} />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="分类详情">
                {categories.map((cat) => (
                  <Row key={cat.category} align="middle" style={{ marginBottom: 12 }}>
                    <Col span={8}>
                      <span style={{ color: cat.color }}>●</span> {cat.label}
                    </Col>
                    <Col span={8}>{formatSize(cat.size)}</Col>
                    <Col span={4}>{cat.count} 项</Col>
                    <Col span={4}>
                      <div
                        style={{
                          height: 8,
                          background: '#f0f0f0',
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${(cat.size / totalSize) * 100}%`,
                            height: '100%',
                            background: cat.color,
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </Col>
                  </Row>
                ))}
              </Card>
            </Col>
          </Row>

          <Card title="占用空间 Top 10" style={{ marginTop: 16 }}>
            <Table
              dataSource={topItems}
              columns={columns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </>
      )}
    </div>
  );
}
