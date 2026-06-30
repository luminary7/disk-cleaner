import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Col, Row, Space, Spin, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import ReactEChartsCore from 'echarts-for-react';
import {
  LockOutlined,
  SafetyCertificateOutlined,
  ScanOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import gsap from 'gsap';
import FloatingLines from '../components/FloatingLines';
import tempCacheImg from '../assets/ui-kit/temp-cache.png';
import browserCacheImg from '../assets/ui-kit/browser-cache.png';
import appCacheImg from '../assets/ui-kit/app-cache.png';
import systemCacheImg from '../assets/ui-kit/system-cache.png';
import largeFileImg from '../assets/ui-kit/large-file.png';
import safeCleanImg from '../assets/ui-kit/safe-clean.png';
import driveImg from '../assets/ui-kit/disk-drive.png';

const { Title, Text } = Typography;

interface CategoryStat {
  category: string;
  label: string;
  size: number;
  count: number;
  color: string;
}

interface CategoryTheme {
  label: string;
  color: string;
  softColor: string;
  image: string;
  description: string;
  tag: 'safe' | 'caution' | 'keep';
}

const CATEGORY_THEME: Record<ScanItem['category'], CategoryTheme> = {
  temp: {
    label: '系统临时文件',
    color: '#14b8a6',
    softColor: '#ecfeff',
    image: tempCacheImg,
    description: '应用运行和系统过程产生的临时缓存，可优先清理',
    tag: 'safe',
  },
  browser: {
    label: '浏览器缓存',
    color: '#22c55e',
    softColor: '#f0fdf4',
    image: browserCacheImg,
    description: '浏览器缓存、站点数据和访问残留',
    tag: 'safe',
  },
  app: {
    label: '应用缓存',
    color: '#1677ff',
    softColor: '#eff6ff',
    image: appCacheImg,
    description: '第三方应用产生的缓存和可清理数据',
    tag: 'caution',
  },
  system: {
    label: '系统缓存',
    color: '#64748b',
    softColor: '#f8fafc',
    image: systemCacheImg,
    description: '系统更新残留、日志和需要谨慎判断的项目',
    tag: 'keep',
  },
  'large-file': {
    label: '大文件',
    color: '#7c3aed',
    softColor: '#f5f3ff',
    image: largeFileImg,
    description: '占用明显的大体积文件，建议确认用途后处理',
    tag: 'caution',
  },
};

const FALLBACK_THEME: CategoryTheme = {
  label: '其他项目',
  color: '#64748b',
  softColor: '#f8fafc',
  image: appCacheImg,
  description: '扫描发现的其他可归类项目',
  tag: 'caution',
};

const SAFETY_THEME: Record<ScanItem['safety'], { label: string; color: string; bg: string; border: string }> = {
  safe: { label: '安全', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  caution: { label: '注意', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  keep: { label: '保留', color: '#e11d48', bg: '#fff1f2', border: '#fecdd3' },
};

function getCategoryTheme(category: string): CategoryTheme {
  return CATEGORY_THEME[category as ScanItem['category']] || FALLBACK_THEME;
}

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

function formatPercent(value: number, total: number): string {
  if (total <= 0) return '0%';
  return `${((value / total) * 100).toFixed(2)}%`;
}

export default function SpaceOverview() {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [topItems, setTopItems] = useState<ScanItem[]>([]);
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const emptyRef = useRef<HTMLDivElement>(null);

  // 组件挂载时自动检测盘符
  useEffect(() => {
    (window.electronAPI?.detectDrives() ?? Promise.resolve([]))
      .then((list) => setDrives(list))
      .catch(() => setDrives([]));
  }, []);

  // 空状态入场动画
  useEffect(() => {
    if (categories.length > 0 || loading) return;
    const el = emptyRef.current;
    if (!el) return;
    const cards = el.querySelectorAll('.drive-card, .feature-card');
    gsap.fromTo(
      cards,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }
    );
  }, [categories, loading, drives]);

  const totalSize = useMemo(() => categories.reduce((sum, c) => sum + c.size, 0), [categories]);
  const totalCount = useMemo(() => categories.reduce((sum, c) => sum + c.count, 0), [categories]);
  const leadingCategories = categories.slice(0, 2);

  const handleScan = async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.startScan();
      processResult(result);
    } finally {
      setLoading(false);
    }
  };

  const handleScanWithDrive = async (letter: string) => {
    if (!window.electronAPI) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.startScan([`${letter}:\\`]);
      processResult(result);
    } finally {
      setLoading(false);
    }
  };

  function processResult(result: ScanResult) {
    const catMap = new Map<string, { size: number; count: number }>();
    result.items.forEach((item) => {
      const existing = catMap.get(item.category) || { size: 0, count: 0 };
      existing.size += item.size;
      existing.count += 1;
      catMap.set(item.category, existing);
    });

    const catStats: CategoryStat[] = Array.from(catMap.entries())
      .map(([key, val]) => {
        const theme = getCategoryTheme(key);
        return {
          category: key,
          label: theme.label,
          size: val.size,
          count: val.count,
          color: theme.color,
        };
      })
      .sort((a, b) => b.size - a.size);

    setCategories(catStats);
    setTopItems([...result.items].sort((a, b) => b.size - a.size).slice(0, 10));
  }

  const pieOption = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const item = categories.find((cat) => cat.label === params.name);
        return [
          `<strong>${params.name}</strong>`,
          `大小：${formatSize(params.value)}`,
          `数量：${item?.count ?? 0} 项`,
          `占比：${params.percent}%`,
        ].join('<br/>');
      },
    },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '42%',
        style: {
          text: formatSize(totalSize),
          fill: '#111827',
          fontSize: 28,
          fontWeight: 700,
          textAlign: 'center',
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '53%',
        style: {
          text: '可清理空间',
          fill: '#8c8c8c',
          fontSize: 13,
          textAlign: 'center',
        },
      },
    ],
    series: [
      {
        type: 'pie',
        radius: ['58%', '78%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 4 },
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 6,
        },
        data: categories.map((cat) => ({
          name: cat.label,
          value: cat.size,
          itemStyle: { color: cat.color },
        })),
      },
    ],
  }), [categories, totalSize]);

  const columns: ColumnsType<ScanItem> = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string) => (
        <Tooltip title={name}>
          <span style={{ fontWeight: 500 }}>{name}</span>
        </Tooltip>
      ),
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      ellipsis: true,
      render: (path: string) => (
        <Tooltip title={path}>
          <Text type="secondary" ellipsis style={{ maxWidth: 360 }}>{path}</Text>
        </Tooltip>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      align: 'right',
      render: (value: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {formatSize(value)}
        </span>
      ),
      sorter: (a, b) => a.size - b.size,
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => {
        const theme = getCategoryTheme(category);
        return (
          <Tag
            style={{
              margin: 0,
              color: theme.color,
              background: theme.softColor,
              borderColor: `${theme.color}33`,
              borderRadius: 6,
            }}
          >
            {theme.label}
          </Tag>
        );
      },
    },
    {
      title: '安全等级',
      dataIndex: 'safety',
      key: 'safety',
      render: (safety: ScanItem['safety']) => {
        const theme = SAFETY_THEME[safety] || SAFETY_THEME.caution;
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: theme.color,
              background: theme.bg,
              border: `1px solid ${theme.border}`,
              borderRadius: 6,
              padding: '2px 8px',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: theme.color,
                boxShadow: `0 0 0 3px ${theme.color}1f`,
              }}
            />
            {theme.label}
          </span>
        );
      },
    },
  ];

  const renderSummaryCard = (cat: CategoryStat) => {
    const theme = getCategoryTheme(cat.category);
    return (
      <Card
        title={cat.label}
        styles={{
          body: {
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            minHeight: 112,
          },
        }}
      >
        <img
          src={theme.image}
          alt={cat.label}
          style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Title level={4} style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            {formatSize(cat.size)}
          </Title>
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            {cat.count} 项 · {formatPercent(cat.size, totalSize)}
          </Text>
        </div>
      </Card>
    );
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 18 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>空间概览</Title>
          {categories.length > 0 && (
            <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 13 }}>
              本次扫描发现 {totalCount} 项，占用 {formatSize(totalSize)}
            </Text>
          )}
        </div>
        <Button type="primary" icon={<ScanOutlined />} onClick={handleScan} loading={loading}>
          扫描C盘
        </Button>
      </Row>

      {categories.length === 0 && !loading && (
        <div ref={emptyRef}>
          <Card
            style={{
              marginBottom: 16,
              border: 'none',
              background: 'linear-gradient(135deg, #dce8f5 0%, #d8f0ec 100%)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
              <FloatingLines animationSpeed={0.6} linesGradient={['#b8cce0', '#c8dce4']} />
            </div>
            <div style={{ textAlign: 'center', padding: '60px 0', position: 'relative', zIndex: 1 }}>
              <Title level={3} style={{ margin: 0, color: '#1a1a2e' }}>欢迎使用 C 盘智能清理</Title>
              <Text style={{ fontSize: 14, color: '#4a4a5e', display: 'block', marginTop: 8 }}>
                一键扫描并安全清理磁盘垃圾文件，释放宝贵的存储空间
              </Text>
            </div>
          </Card>

          <Row gutter={16} style={{ marginBottom: 24 }}>
            {drives.map((drive) => (
              <Col span={6} key={drive.letter}>
                <Card
                  className="drive-card"
                  hoverable
                  onClick={() => handleScanWithDrive(drive.letter)}
                  styles={{ body: { display: 'flex', alignItems: 'center', gap: 12, padding: '20px 16px' } }}
                >
                  <img src={driveImg} alt={drive.letter} style={{ width: 32, height: 32 }} />
                  <div>
                    <Text strong style={{ fontSize: 15 }}>{drive.letter}:</Text>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{drive.label || drive.path}</div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          <Title level={5} style={{ marginBottom: 12 }}>可清理的文件类型</Title>
          <Row gutter={[16, 16]}>
            {Object.entries(CATEGORY_THEME).map(([key, theme]) => (
              <Col span={8} key={key}>
                <Card className="feature-card" size="small" styles={{ body: { display: 'flex', alignItems: 'center', gap: 12 } }}>
                  <img src={theme.image} alt={theme.label} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Text strong style={{ fontSize: 13 }}>{theme.label}</Text>
                      <Tag
                        color={theme.tag === 'safe' ? 'green' : theme.tag === 'caution' ? 'orange' : 'red'}
                        style={{ fontSize: 10, lineHeight: '18px', padding: '0 6px' }}
                      >
                        {theme.tag === 'safe' ? '安全' : theme.tag === 'caution' ? '谨慎' : '保留'}
                      </Tag>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{theme.description}</Text>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          <div style={{ textAlign: 'center', marginTop: 24, color: '#8c8c8c', fontSize: 13 }}>
            <Space>
              <SafetyCertificateOutlined style={{ color: SAFETY_THEME.safe.color }} />
              删除操作默认移至回收站
              <WarningOutlined style={{ color: SAFETY_THEME.caution.color, marginLeft: 16 }} />
              不确定的项目会标记为注意
              <LockOutlined style={{ color: SAFETY_THEME.keep.color, marginLeft: 16 }} />
              受保护文件建议保留
            </Space>
          </div>
        </div>
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
            <Col span={10}>
              <Card
                title="总览"
                styles={{
                  body: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 132,
                    gap: 20,
                  },
                }}
              >
                <div>
                  <Text type="secondary">可清理空间</Text>
                  <Title
                    level={1}
                    style={{
                      margin: '6px 0 4px',
                      color: '#1677ff',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatSize(totalSize)}
                  </Title>
                  <Text type="secondary">{totalCount} 个项目已归类</Text>
                </div>
                <img src={safeCleanImg} alt="可清理空间" style={{ width: 92, height: 92, borderRadius: 14, objectFit: 'cover' }} />
              </Card>
            </Col>
            {leadingCategories.map((cat) => (
              <Col span={7} key={cat.category}>
                {renderSummaryCard(cat)}
              </Col>
            ))}
          </Row>

          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={13}>
              <Card title="空间分布" styles={{ body: { minHeight: 388 } }}>
                <ReactEChartsCore option={pieOption} style={{ height: 320 }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', padding: '0 10px 4px' }}>
                  {categories.map((cat) => (
                    <span key={cat.category} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#595959', fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color }} />
                      {cat.label} {formatPercent(cat.size, totalSize)}
                    </span>
                  ))}
                </div>
              </Card>
            </Col>
            <Col span={11}>
              <Card title="分类详情" styles={{ body: { minHeight: 388 } }}>
                <Space orientation="vertical" size={14} style={{ width: '100%' }}>
                  {categories.map((cat) => {
                    const theme = getCategoryTheme(cat.category);
                    const percent = totalSize > 0 ? (cat.size / totalSize) * 100 : 0;
                    return (
                      <div key={cat.category}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 100px 92px 66px', alignItems: 'center', gap: 12 }}>
                          <Space size={10}>
                            <img src={theme.image} alt={cat.label} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                            <Text strong>{cat.label}</Text>
                          </Space>
                          <Text style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatSize(cat.size)}</Text>
                          <Text type="secondary">{cat.count} 项</Text>
                          <Text style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#595959' }}>
                            {formatPercent(cat.size, totalSize)}
                          </Text>
                        </div>
                        <div style={{ marginLeft: 50, marginTop: 8, height: 8, background: '#f0f0f0', borderRadius: 999, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.max(percent, 2)}%`,
                              height: '100%',
                              background: cat.color,
                              borderRadius: 999,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </Space>
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
