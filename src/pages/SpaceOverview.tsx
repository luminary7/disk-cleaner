import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Col, Row, Space, Spin, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { TooltipComponent, GraphicComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([PieChart, TooltipComponent, GraphicComponent, CanvasRenderer]);
import LockOutlined from '@ant-design/icons/LockOutlined';
import SafetyCertificateOutlined from '@ant-design/icons/SafetyCertificateOutlined';
import ScanOutlined from '@ant-design/icons/ScanOutlined';
import WarningOutlined from '@ant-design/icons/WarningOutlined';
import gsap from 'gsap';
import FloatingLines from '../components/FloatingLines';
import DriveSelectModal from '../components/DriveSelectModal';
import tempCacheImg from '../assets/ui-kit/temp-cache.webp';
import browserCacheImg from '../assets/ui-kit/browser-cache.webp';
import appCacheImg from '../assets/ui-kit/app-cache.webp';
import systemCacheImg from '../assets/ui-kit/system-cache.webp';
import largeFileImg from '../assets/ui-kit/large-file.webp';
import safeCleanImg from '../assets/ui-kit/safe-clean.webp';
import driveImg from '../assets/ui-kit/disk-drive.webp';

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
  const [showDriveSelect, setShowDriveSelect] = useState(false);
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

  const handleScan = () => {
    setShowDriveSelect(true);
  };

  const handleStartScanWithDrives = async (drives: string[]) => {
    setShowDriveSelect(false);
    if (!window.electronAPI) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.startScan(drives);
      processResult(result);
    } finally {
      setLoading(false);
    }
  };

  const handleReselectDrive = () => {
    setCategories([]);
    setTopItems([]);
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
        <Space>
          {categories.length > 0 && !loading && (
            <Button icon={<ScanOutlined />} onClick={handleReselectDrive}>
              重新选择盘符
            </Button>
          )}
          <Button type="primary" icon={<ScanOutlined />} onClick={handleScan} loading={loading}>
            {categories.length === 0 ? '选择盘符扫描' : '重新扫描'}
          </Button>
        </Space>
      </Row>

      {categories.length === 0 && !loading && (
        <div ref={emptyRef}>
          <Card
            style={{
              marginBottom: 16,
              border: 'none',
              background: '#241832',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08), 0 18px 44px rgba(42,24,61,0.16)',
              position: 'relative',
              overflow: 'hidden',
            }}
            styles={{ body: { padding: 0 } }}
          >
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.96 }}>
              <FloatingLines
                animationSpeed={0.72}
                enabledWaves={['top', 'middle', 'bottom']}
                lineCount={[8, 8, 7]}
                lineDistance={[8, 8, 7]}
                topWavePosition={{ x: 10.0, y: 0.38, rotate: -0.32 }}
                middleWavePosition={{ x: 5.0, y: -0.02, rotate: 0.18 }}
                bottomWavePosition={{ x: 2.0, y: -0.52, rotate: 0.42 }}
                linesGradient={['#fff7ff', '#ff7af6', '#b78cff', '#ffffff']}
                mixBlendMode="screen"
              />
            </div>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 0,
                background:
                  'radial-gradient(circle at 50% 48%, rgba(184,112,255,0.22) 0%, rgba(77,46,103,0.34) 34%, rgba(27,18,39,0.66) 100%), linear-gradient(135deg, rgba(83,51,110,0.62) 0%, rgba(40,25,56,0.44) 48%, rgba(31,19,44,0.68) 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '-8%',
                right: '-8%',
                top: '52%',
                height: 7,
                zIndex: 0,
                transform: 'rotate(7deg)',
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(181,124,255,0.45) 18%, rgba(255,111,244,0.9) 42%, rgba(255,255,255,0.95) 50%, rgba(255,111,244,0.86) 58%, rgba(181,124,255,0.42) 82%, transparent 100%)',
                boxShadow:
                  '0 0 18px rgba(255,111,244,0.78), 0 0 38px rgba(174,119,255,0.48), 0 0 72px rgba(255,255,255,0.22)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '-8%',
                right: '-8%',
                top: '52%',
                height: 34,
                zIndex: 0,
                transform: 'translateY(-38%) rotate(7deg)',
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(181,124,255,0.14) 18%, rgba(255,111,244,0.28) 46%, rgba(255,255,255,0.2) 52%, rgba(181,124,255,0.16) 82%, transparent 100%)',
                filter: 'blur(10px)',
              }}
            />
            <div
              style={{
                textAlign: 'center',
                minHeight: 276,
                padding: '72px 24px',
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textShadow: '0 4px 24px rgba(0,0,0,0.52)',
              }}
            >
              <Title
                level={2}
                style={{
                  margin: 0,
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 38,
                  lineHeight: 1.12,
                  textWrap: 'balance',
                }}
              >
                我的磁盘怎么红红的，是要谈恋爱了吗
              </Title>
              <Text
                style={{
                  fontSize: 15,
                  color: 'rgba(255,255,255,0.76)',
                  display: 'block',
                  marginTop: 12,
                  fontWeight: 500,
                }}
              >
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

          <div style={{ textAlign: 'center', marginTop: 24, color: '#595959', fontSize: 14, fontWeight: 500 }}>
            <Space size={20}>
              <SafetyCertificateOutlined style={{ color: SAFETY_THEME.safe.color, fontSize: 16 }} />
              删除操作默认移至回收站
              <WarningOutlined style={{ color: SAFETY_THEME.caution.color, marginLeft: 16, fontSize: 16 }} />
              不确定的项目会标记为注意
              <LockOutlined style={{ color: SAFETY_THEME.keep.color, marginLeft: 16, fontSize: 16 }} />
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
                <ReactEChartsCore echarts={echarts} option={pieOption} style={{ height: 320 }} />
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
      {/* 盘符选择弹窗 */}
      <DriveSelectModal
        open={showDriveSelect}
        onConfirm={handleStartScanWithDrives}
        onCancel={() => setShowDriveSelect(false)}
      />
    </div>
  );
}
