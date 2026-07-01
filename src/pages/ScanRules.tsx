import type { ReactNode } from 'react';
import { Alert, Card, Divider, Space, Table, Tag, Tree, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  FolderOpenOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;

type SafetyLevel = 'safe' | 'caution' | 'keep';

interface SafetyRule {
  level: SafetyLevel;
  label: string;
  color: string;
  icon: ReactNode;
  desc: string;
}

interface ScopeRule {
  key: string;
  category: string;
  name: string;
  paths: string[];
  rule: string;
  safety: string;
  color: string;
}

interface ExtensionRule {
  key: string;
  name: string;
  exts: string;
  safety: string;
  color: string;
  note: string;
}

const SAFETY_LEVELS: SafetyRule[] = [
  {
    level: 'safe',
    label: '可安全清理',
    color: 'green',
    icon: <CheckCircleOutlined />,
    desc: '只用于明确的缓存、临时文件，并且满足时间阈值。默认一键清理只处理这一类。',
  },
  {
    level: 'caution',
    label: '需要确认',
    color: 'gold',
    icon: <WarningOutlined />,
    desc: '不确定但不应锁死的项目，例如近期缓存、模型文件、普通大文件、未知类型。必须由用户显式确认。',
  },
  {
    level: 'keep',
    label: '建议保留',
    color: 'red',
    icon: <LockOutlined />,
    desc: '系统关键文件、程序目录、结构性配置/数据库、密钥证书、虚拟磁盘和游戏资源。普通清理入口会阻止删除。',
  },
];

const QUICK_SCAN_RULES: ScopeRule[] = [
  {
    key: 'temp',
    category: 'temp',
    name: '用户临时文件',
    paths: ['%TEMP% / %TMP%'],
    rule: '递归扫描，最大深度 8；空文件和小于 1KB 的文件不进入结果。',
    safety: '24 小时以上 safe，否则 caution',
    color: 'green',
  },
  {
    key: 'browser',
    category: 'browser',
    name: '浏览器缓存',
    paths: [
      '%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Cache\\Cache_Data',
      '%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Code Cache\\js',
      '%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\Cache\\Cache_Data',
      '%LOCALAPPDATA%\\360Chrome\\Chrome\\User Data\\Default\\Cache',
      '%LOCALAPPDATA%\\360chrome\\Chrome\\User Data\\Default\\Cache',
      '%LOCALAPPDATA%\\Microsoft\\Windows\\INetCache',
    ],
    rule: '只扫描这些缓存叶子目录中的文件；不存在或无权限的路径会跳过。',
    safety: '7 天以上 safe，否则 caution',
    color: 'blue',
  },
  {
    key: 'app',
    category: 'app',
    name: '应用缓存',
    paths: [
      '%APPDATA%\\Tencent\\WeChat\\Cache / Code Cache / GPUCache / logs / xlog',
      '%APPDATA%\\Tencent\\QQ\\Cache / Code Cache / GPUCache / Logs / Temp',
      '%APPDATA%\\DingTalk\\Cache / Code Cache / GPUCache / logs / Temp',
    ],
    rule: '仅进入已知缓存、日志、临时子目录，不扫描聊天文件、文档目录和应用数据根目录。',
    safety: '7 天以上 safe，否则 caution',
    color: 'purple',
  },
  {
    key: 'system',
    category: 'system',
    name: '系统缓存',
    paths: [
      '%WINDIR%\\Temp',
      '%WINDIR%\\Prefetch',
      '%WINDIR%\\SoftwareDistribution\\Download',
      '%WINDIR%\\Logs',
      '%LOCALAPPDATA%\\Microsoft\\Windows\\Explorer',
      '%ProgramData%\\Microsoft\\Windows\\WER',
    ],
    rule: '只扫描 Windows 明确的缓存、日志、错误报告目录；系统核心目录永不进入扫描。',
    safety: '统一 caution',
    color: 'gold',
  },
  {
    key: 'other-drive',
    category: 'temp / app',
    name: '非系统盘常见缓存',
    paths: ['盘符根目录下的 Temp、Tmp、Cache、Logs'],
    rule: '只识别根目录下的常见临时/缓存文件夹，不做整盘清理式扫描。',
    safety: '按 temp / app 规则判定',
    color: 'cyan',
  },
];

const LARGE_FILE_RULES: ScopeRule[] = [
  {
    key: 'large-file',
    category: 'large-file',
    name: '大文件发现',
    paths: ['所选盘符根目录下的一级目录，排除系统核心目录后递归扫描'],
    rule: '最大深度 6；仅收集 50MB 及以上文件，用于发现空间占用，不做默认一键清理。',
    safety: '大多数 caution；高风险目录、结构性数据、虚拟磁盘和游戏资源 keep',
    color: 'volcano',
  },
];

const EXTENSION_COLUMNS: ColumnsType<ExtensionRule> = [
  { title: '文件类型', dataIndex: 'name', key: 'name', width: 150 },
  {
    title: '后缀名',
    dataIndex: 'exts',
    key: 'exts',
    render: (value) => <Text code style={{ whiteSpace: 'normal' }}>{value}</Text>,
  },
  {
    title: '基础等级',
    dataIndex: 'safety',
    key: 'safety',
    width: 130,
    render: (value, record) => <Tag color={record.color}>{value}</Tag>,
  },
  { title: '说明', dataIndex: 'note', key: 'note', width: 260 },
];

const EXTENSION_DATA: ExtensionRule[] = [
  {
    key: 'system',
    name: '系统关键文件',
    exts: '.sys .ocx .drv .cpl',
    safety: 'keep',
    color: 'red',
    note: '优先级最高，命中后直接建议保留。',
  },
  {
    key: 'high-risk',
    name: '高风险资源',
    exts: '.vhd .vhdx .vmdk .qcow2 .pak .obb',
    safety: 'keep',
    color: 'red',
    note: '常见于虚拟机、磁盘镜像、游戏资源，默认不清理。',
  },
  {
    key: 'structural',
    name: '结构性数据/配置',
    exts: '.db .sqlite .env .key .pem .pfx .crt .conf .config .toml .yaml .ini .cfg 等',
    safety: 'keep',
    color: 'red',
    note: '非缓存目录中通常是应用数据、配置或凭据，不进入普通清理。',
  },
  {
    key: 'exec',
    name: '可执行模块',
    exts: '.dll .exe .msi .bat .cmd .ps1 .vbs',
    safety: 'caution',
    color: 'gold',
    note: '可能是安装器或程序组件，必须确认。',
  },
  {
    key: 'package',
    name: '压缩包/镜像',
    exts: '.zip .rar .7z .tar .gz .bz2 .xz .iso .img',
    safety: 'caution',
    color: 'gold',
    note: '大文件扫描中只提示，不自动清理。',
  },
  {
    key: 'model',
    name: 'AI 模型/权重',
    exts: '.safetensors .ckpt .pt .pth .onnx .gguf .bin .model .weights 等',
    safety: 'caution',
    color: 'gold',
    note: '通常是用户主动下载的资产，可手动确认，不再直接锁死。',
  },
  {
    key: 'known-cache',
    name: '已知缓存类型',
    exts: '.tmp .log .cache .bak .old .dmp .swp 等',
    safety: '按目录/时间',
    color: 'green',
    note: '必须位于可清理目录，并满足时间阈值才可能为 safe。',
  },
  {
    key: 'user-data',
    name: '媒体/文档/数据',
    exts: '.png .jpg .mp4 .mp3 .db .pdf .docx .xlsx .pptx 等',
    safety: '按目录保护',
    color: 'gold',
    note: '在用户目录、大文件扫描中不会仅因体积或时间被当作 safe。',
  },
  {
    key: 'unknown',
    name: '未知类型',
    exts: '无后缀，或不在已知列表中的扩展名',
    safety: 'caution',
    color: 'gold',
    note: '默认交给用户确认；如果位于高风险目录，仍会提升为 keep。',
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
  'Documents\\',
  'Desktop\\',
  'Downloads\\',
  'Pictures\\',
  'Videos\\',
  'Music\\',
  'Game\\',
  'Games\\',
  'Steam\\',
  'SteamApps\\',
  'Epic\\',
  'Common\\',
  '_data\\',
  'Minecraft\\',
  'Projects\\',
  'Backup\\',
  'OneDrive\\',
  'Dropbox\\',
  'WSL\\',
  'Node_Modules\\',
  'Vendor\\',
  'Python\\',
  'Anaconda\\',
  'Miniconda\\',
  'Envs\\',
];

const CLEANUP_DIRECTORIES = [
  'Temp',
  'Tmp',
  'Cache',
  'Cache_Data',
  'Code Cache',
  'GPUCache',
  'INetCache',
  'Logs',
  'xlog',
  'Crash / Dumps',
  'Thumbnails',
  'Windows\\Temp',
  'Windows\\Prefetch',
  'SoftwareDistribution\\Download',
  'Microsoft\\Windows\\WER',
  'Microsoft\\Windows\\Explorer',
];

const DECISION_STEPS = [
  {
    title: '先排除危险区',
    desc: '系统核心目录、程序安装目录、回收站、恢复分区等路径不进入普通扫描，也会在删除前再次拦截。',
    icon: <LockOutlined />,
    color: '#ff4d4f',
  },
  {
    title: '再看文件类型',
    desc: '系统关键、高风险资源、结构性配置/数据库直接 keep；可执行模块、模型文件、未知扩展名或无后缀文件 caution。',
    icon: <FileProtectOutlined />,
    color: '#fa8c16',
  },
  {
    title: '最后结合目录和时间',
    desc: '只有已知缓存/临时目录内的旧文件才可能 safe；近期文件、系统缓存和用户目录默认更保守。',
    icon: <ClockCircleOutlined />,
    color: '#1677ff',
  },
  {
    title: '删除前重新复核',
    desc: '清理时后端会重新校验路径和安全等级：safe 可清理，caution 要确认，keep 会被阻止。',
    icon: <DeleteOutlined />,
    color: '#52c41a',
  },
];

function SafetyBadge({ level }: { level: SafetyLevel }) {
  const rule = SAFETY_LEVELS.find((item) => item.level === level);
  if (!rule) return null;
  return (
    <Tag color={rule.color} style={{ margin: 0 }}>
      <Space size={4}>
        {rule.icon}
        {rule.label}
      </Space>
    </Tag>
  );
}

function PathList({ paths }: { paths: string[] }) {
  return (
    <Space direction="vertical" size={2}>
      {paths.map((item) => (
        <Text key={item} code style={{ whiteSpace: 'normal' }}>
          {item}
        </Text>
      ))}
    </Space>
  );
}

function ScopeSection({ title, data }: { title: string; data: ScopeRule[] }) {
  const columns: ColumnsType<ScopeRule> = [
    {
      title: '类别',
      dataIndex: 'name',
      key: 'name',
      width: 130,
      render: (value, record) => (
        <Space direction="vertical" size={2}>
          <Tag color={record.color} style={{ width: 'fit-content' }}>{record.category}</Tag>
          <Text strong>{value}</Text>
        </Space>
      ),
    },
    {
      title: '扫描路径',
      dataIndex: 'paths',
      key: 'paths',
      render: (paths) => <PathList paths={paths} />,
    },
    { title: '扫描方式', dataIndex: 'rule', key: 'rule', width: 260 },
    {
      title: '安全判定',
      dataIndex: 'safety',
      key: 'safety',
      width: 190,
      render: (value) => <Text>{value}</Text>,
    },
  ];

  return (
    <Card title={title} style={{ marginBottom: 16 }} styles={{ body: { paddingTop: 12 } }}>
      <Table
        dataSource={data}
        columns={columns}
        pagination={false}
        size="small"
        scroll={{ x: 900 }}
      />
    </Card>
  );
}

export default function ScanRules() {
  return (
    <div style={{ maxWidth: 1120, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 24,
          marginBottom: 18,
        }}
      >
        <Space align="start" size={14}>
          <SafetyCertificateOutlined style={{ fontSize: 32, color: '#1677ff', marginTop: 2 }} />
          <div>
            <Title level={3} style={{ margin: 0 }}>扫描规则与安全边界</Title>
            <Paragraph type="secondary" style={{ margin: '6px 0 0', maxWidth: 720 }}>
              当前规则采用“保守优先”的策略：扫描范围限定在明确的缓存、临时、日志和错误报告目录；
              能确认可再生成的旧文件才会标记为 safe，不能确认的文件宁可保留或要求人工确认。
            </Paragraph>
          </div>
        </Space>
        <SafetyBadge level="safe" />
      </div>

      <Alert
        type="success"
        showIcon
        message="默认一键清理只处理 safe 项"
        description="caution 项需要在界面中逐项或批量确认；keep 项会被普通清理入口阻止。所有清理动作都会移入回收站，并在后端删除前再次复核路径和安全等级。"
        style={{ marginBottom: 16 }}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {SAFETY_LEVELS.map((rule) => (
          <Card key={rule.level} size="small" styles={{ body: { minHeight: 122 } }}>
            <Space direction="vertical" size={8}>
              <SafetyBadge level={rule.level} />
              <Text style={{ color: '#595959', lineHeight: 1.7 }}>{rule.desc}</Text>
            </Space>
          </Card>
        ))}
      </div>

      <ScopeSection title="快速扫描范围" data={QUICK_SCAN_RULES} />
      <ScopeSection title="大文件扫描范围" data={LARGE_FILE_RULES} />

      <Card title="安全判定顺序" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          {DECISION_STEPS.map((step, index) => (
            <div
              key={step.title}
              style={{
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                padding: 14,
                background: '#fff',
                minHeight: 138,
              }}
            >
              <Space align="start" size={10}>
                <div style={{ color: step.color, fontSize: 20, lineHeight: 1 }}>{step.icon}</div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>优先级 {index + 1}</Text>
                  <div style={{ marginTop: 2 }}>
                    <Text strong>{step.title}</Text>
                  </div>
                  <Paragraph type="secondary" style={{ margin: '6px 0 0', fontSize: 13 }}>
                    {step.desc}
                  </Paragraph>
                </div>
              </Space>
            </div>
          ))}
        </div>
      </Card>

      <Card title="文件扩展名规则" style={{ marginBottom: 16 }}>
        <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
          后缀名只决定基础风险，最终等级还会结合扫描类别、所在目录和文件修改时间。未知类型默认需要确认，高风险目录中仍会保留。
        </Paragraph>
        <Table
          dataSource={EXTENSION_DATA}
          columns={EXTENSION_COLUMNS}
          pagination={false}
          size="small"
          scroll={{ x: 900 }}
        />
      </Card>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Card title="永不扫描的系统区域">
          <Tree
            treeData={EXCLUDED_TREE_DATA}
            showLine
            defaultExpandedKeys={['C:', 'Windows']}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
          <Divider style={{ margin: '12px 0' }} />
          <Text type="secondary" style={{ fontSize: 13 }}>
            这些路径属于系统核心、程序安装、恢复或回收站区域。扫描时跳过，清理前也会再次拦截。
          </Text>
        </Card>

        <Card title="用户数据与缓存目录的区别">
          <Space direction="vertical" size={10}>
            <div>
              <Space size={8} style={{ marginBottom: 6 }}>
                <WarningOutlined style={{ color: '#faad14' }} />
                <Text strong>谨慎目录</Text>
              </Space>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CAUTION_DIRECTORIES.map((dir) => (
                  <Tag key={dir} color="gold" style={{ margin: 0 }}>
                    {dir}
                  </Tag>
                ))}
              </div>
            </div>
            <Divider style={{ margin: '4px 0' }} />
            <div>
              <Space size={8} style={{ marginBottom: 6 }}>
                <FolderOpenOutlined style={{ color: '#1677ff' }} />
                <Text strong>可清理目录标记</Text>
              </Space>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CLEANUP_DIRECTORIES.map((dir) => (
                  <Tag key={dir} color="blue" style={{ margin: 0 }}>
                    {dir}
                  </Tag>
                ))}
              </div>
            </div>
            <Text type="secondary" style={{ fontSize: 13 }}>
              用户目录不会仅因“体积大”或“时间久”被标记为 safe；只有明确命中缓存、日志、临时目录的项目，才会继续按时间阈值降级为 safe。
            </Text>
          </Space>
        </Card>
      </div>

      <Card title="删除前复核与 AI 安全边界">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 12,
          }}
        >
          <Space align="start" size={10}>
            <DeleteOutlined style={{ fontSize: 20, color: '#52c41a', marginTop: 2 }} />
            <div>
              <Text strong>只进回收站</Text>
              <Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 13 }}>
                当前清理使用系统回收站，不做直接永久删除。
              </Paragraph>
            </div>
          </Space>
          <Space align="start" size={10}>
            <LockOutlined style={{ fontSize: 20, color: '#ff4d4f', marginTop: 2 }} />
            <div>
              <Text strong>后端二次校验</Text>
              <Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 13 }}>
                清理前重新检查路径、盘符根目录、排除目录和安全等级。
              </Paragraph>
            </div>
          </Space>
          <Space align="start" size={10}>
            <FileSearchOutlined style={{ fontSize: 20, color: '#1677ff', marginTop: 2 }} />
            <div>
              <Text strong>AI 只做参考</Text>
              <Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 13 }}>
                AI 可以提示更高风险，但不能把 keep 降级为可删除。
              </Paragraph>
            </div>
          </Space>
        </div>
      </Card>
    </div>
  );
}
