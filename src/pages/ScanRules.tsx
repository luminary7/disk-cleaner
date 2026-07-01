import { Card, Typography, Tag, Table, Divider, Space, Tree } from 'antd';
import {
  SafetyCertificateOutlined,
  LockOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

interface SafetyRule {
  level: string;
  color: string;
  icon: React.ReactNode;
  desc: string;
}

const SAFETY_LEVELS: SafetyRule[] = [
  {
    level: 'safe',
    color: 'green',
    icon: <CheckCircleOutlined />,
    desc: '可安全删除。仅默认清理明确缓存/临时目录中符合规则的项目。',
  },
  {
    level: 'caution',
    color: 'gold',
    icon: <WarningOutlined />,
    desc: '谨慎删除。需要人工确认，默认一键清理不会自动包含。',
  },
  {
    level: 'keep',
    color: 'red',
    icon: <LockOutlined />,
    desc: '建议保留。普通清理入口会阻止删除，AI 也不能把它降级为可删。',
  },
];

const CATEGORY_RULES = [
  {
    category: 'temp',
    label: '系统临时文件',
    rule: '24 小时前的已知临时文件标记为 safe，近期文件标记为 caution',
    paths: '用户临时目录 (%TMP%)',
  },
  {
    category: 'browser',
    label: '浏览器缓存',
    rule: '7 天前的缓存标记为 safe，7 天内的标记为 caution',
    paths: 'Chrome / Edge / 360 浏览器 / IE 缓存目录',
  },
  {
    category: 'app',
    label: '应用缓存',
    rule: '仅扫描已知缓存/日志/临时子目录，7 天前的缓存可标记为 safe',
    paths: '微信 / QQ / 钉钉的 Cache / Code Cache / GPUCache / Logs / Temp 等子目录',
  },
  {
    category: 'system',
    label: '系统缓存',
    rule: '全部标记为 caution，需要用户确认',
    paths: 'Windows Temp / Prefetch / 更新缓存 / 日志 / 缩略图 / 错误报告',
  },
  {
    category: 'large-file',
    label: '大文件',
    rule: '大文件以发现和人工判断为主；压缩包/镜像为 caution，虚拟磁盘/游戏资源/未知类型为 keep',
    paths: '各盘符根目录下 >50MB 的文件',
  },
];

const EXTENSION_COLUMNS: ColumnsType<{ name: string; exts: string; safety: string; color: string }> = [
  { title: '分类', dataIndex: 'name', key: 'name', width: 140 },
  { title: '后缀名', dataIndex: 'exts', key: 'exts' },
  {
    title: '安全等级',
    dataIndex: 'safety',
    key: 'safety',
    width: 100,
    render: (v, record) => <Tag color={record.color}>{v}</Tag>,
  },
];

const EXTENSION_DATA = [
  {
    key: 'system',
    name: '系统关键文件',
    exts: '.sys .ocx .drv .cpl',
    safety: 'keep',
    color: 'red',
  },
  {
    key: 'exec',
    name: '可执行模块',
    exts: '.dll .exe .msi .bat .cmd .ps1 .vbs',
    safety: 'caution',
    color: 'gold',
  },
  {
    key: 'package',
    name: '安装包/压缩包',
    exts: '.zip .rar .7z .tar .gz .bz2 .xz .iso .img',
    safety: 'caution（大文件扫描）',
    color: 'gold',
  },
  {
    key: 'cache',
    name: '缓存/临时文件',
    exts: '.tmp .log .cache .bak .old .dmp .swp',
    safety: '按目录/时间判定',
    color: 'green',
  },
  {
    key: 'code',
    name: '代码/配置',
    exts: '.js .ts .css .html .json .xml .yaml .yml .txt .md .csv .ini .cfg',
    safety: '按目录/时间判定',
    color: 'gold',
  },
  {
    key: 'media',
    name: '图片/视频/音频',
    exts: '.png .jpg .jpeg .gif .svg .ico .bmp .webp .mp4 .avi .mkv .mov .wmv .flv .webm .mp3 .wav .flac .aac .ogg',
    safety: '用户目录不 safe',
    color: 'gold',
  },
  {
    key: 'doc',
    name: '文档/数据',
    exts: '.db .sqlite .sqlite3 .pdf .doc .docx .xls .xlsx .ppt .pptx',
    safety: '用户目录不 safe',
    color: 'gold',
  },
  {
    key: 'unknown',
    name: '未知文件类型',
    exts: '不在以上列表中的扩展名或无后缀文件',
    safety: 'keep',
    color: 'red',
  },
];

const EXCLUDED_TREE_DATA = [
  {
    title: 'C:\\',
    key: 'C:',
    children: [
      {
        title: 'Windows',
        key: 'Windows',
        children: [
          { title: 'System32', key: 'Windows\\System32' },
          { title: 'SysWOW64', key: 'Windows\\SysWOW64' },
          { title: 'WinSxS', key: 'Windows\\WinSxS' },
          { title: 'assembly', key: 'Windows\\assembly' },
          { title: 'Microsoft.NET', key: 'Windows\\Microsoft.NET' },
          { title: 'Installer', key: 'Windows\\Installer' },
          { title: 'servicing', key: 'Windows\\servicing' },
          { title: 'Globalization', key: 'Windows\\Globalization' },
          { title: 'AppReadiness', key: 'Windows\\AppReadiness' },
        ],
      },
      { title: 'Program Files', key: 'Program Files' },
      { title: 'Program Files (x86)', key: 'Program Files (x86)' },
      {
        title: 'ProgramData',
        key: 'ProgramData',
        children: [
          { title: 'WindowsApps', key: 'ProgramData\\WindowsApps' },
        ],
      },
      { title: 'Boot', key: 'Boot' },
      { title: 'System Volume Information', key: 'System Volume Information' },
      { title: '$Recycle.Bin', key: '$Recycle.Bin' },
      { title: 'Recovery', key: 'Recovery' },
    ],
  },
];

const CAUTION_DIRECTORIES = [
  'AppData\\Roaming\\',
  'Documents\\', 'Desktop\\', 'Downloads\\',
  'Pictures\\', 'Videos\\', 'Music\\',
  'Game\\', 'Games\\', 'Steam\\', 'SteamApps\\',
  'Epic\\', 'Common\\', '_data\\',
  'Minecraft\\', 'Projects\\', 'Backup\\',
  'OneDrive\\', 'Dropbox\\',
  'WSL\\', 'Node_Modules\\', 'Vendor\\',
  'Python\\', 'Anaconda\\', 'Miniconda\\', 'Envs\\',
];

export default function ScanRules() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Space align="center" style={{ marginBottom: 20 }}>
        <SafetyCertificateOutlined style={{ fontSize: 28, color: '#1677ff' }} />
        <Title level={4} style={{ margin: 0 }}>扫描规则说明</Title>
      </Space>

      {/* 安全等级总览 */}
      <Card title="安全等级总览" style={{ marginBottom: 16 }}>
        {SAFETY_LEVELS.map((s) => (
          <div
            key={s.level}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 0',
              borderBottom: '1px solid #f5f5f5',
            }}
          >
            <Tag color={s.color} style={{ fontSize: 13, padding: '2px 10px' }}>
              <Space size={4}>
                {s.icon}
                {s.level === 'safe' ? '可安全删除' : s.level === 'caution' ? '谨慎删除' : '建议保留'}
              </Space>
            </Tag>
            <Text style={{ fontSize: 13, color: '#595959' }}>{s.desc}</Text>
          </div>
        ))}
      </Card>

      {/* 扫描范围 */}
      <Card title="扫描目录" style={{ marginBottom: 16 }}>
        <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
          扫描引擎遍历以下目录，收集文件交由规则引擎判定安全等级：
        </Paragraph>
        {CATEGORY_RULES.map((cat) => (
          <div
            key={cat.category}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 0',
              borderBottom: '1px solid #f5f5f5',
              fontSize: 13,
            }}
          >
            <Tag style={{ flexShrink: 0, margin: 0, width: 100, textAlign: 'center' }}>
              {cat.label}
            </Tag>
            <div>
              <Text style={{ color: '#262626' }}>{cat.rule}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>路径: {cat.paths}</Text>
            </div>
          </div>
        ))}
      </Card>

      {/* 排除目录 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Card title="永不扫描的目录 (keep)" style={{ flex: 1 }}>
          <Tree
            treeData={EXCLUDED_TREE_DATA}
            showLine
            defaultExpandedKeys={['C:', 'Windows']}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
          <Divider style={{ margin: '8px 0' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            位于这些目录下的文件不会出现在扫描结果中，也不能被删除
          </Text>
        </Card>
        <Card title="谨慎处理目录 (caution)" style={{ flex: 1 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {CAUTION_DIRECTORIES.map((dir) => (
              <Tag key={dir} color="gold" style={{ fontSize: 11, margin: 2 }}>
                {dir.replace(/\\/g, '')}
              </Tag>
            ))}
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            位于这些目录下的文件不会仅因时间较久而标记为 safe；已知缓存子目录除外
          </Text>
        </Card>
      </div>

      {/* 扩展名规则 */}
      <Card title="文件扩展名规则" style={{ marginBottom: 16 }}>
        <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
          根据文件后缀名决定基础安全等级，再结合所在分类和目录进行微调：
        </Paragraph>
        <Table
          dataSource={EXTENSION_DATA}
          columns={EXTENSION_COLUMNS}
          pagination={false}
          size="small"
        />
      </Card>

      {/* 未知文件保护 */}
      <Card title="未知文件保护机制">
        <Space align="start" size={12}>
          <QuestionCircleOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />
          <div>
            <Text strong style={{ color: '#262626' }}>不在已知扩展名列表中的文件 → 标记为 keep</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 13 }}>
              当扫描到不认识的扩展名时（可能是游戏资源、专有格式、用户数据等），
              规则引擎会保守地将其标记为「建议保留」，避免误删。此规则优先于所有分类规则。
            </Text>
          </div>
        </Space>
      </Card>

      <Card title="删除前复核机制" style={{ marginTop: 16 }}>
        <Space align="start" size={12}>
          <LockOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />
          <div>
            <Text strong style={{ color: '#262626' }}>后端会在移入回收站前重新校验路径和安全等级</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 13 }}>
              safe 项可默认清理；caution 项必须由界面显式确认；keep 项会被普通清理入口阻止。
              AI 分析只作为辅助参考，可以提高风险等级，但不能把 keep 项降级为可删除。
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
}
