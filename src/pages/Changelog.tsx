import { Card, Tag, Typography, Space } from 'antd';
import HistoryOutlined from '@ant-design/icons/HistoryOutlined';
import Markdown from 'react-markdown';

const { Title, Text } = Typography;

interface ReleaseSection {
  title: string;
  items: string[];
}

interface Release {
  version: string;
  date: string;
  title?: string;
  isLatest?: boolean;
  sections: ReleaseSection[];
}

const releases: Release[] = [
  {
    version: 'v1.1.0',
    date: '2026-07-01',
    title: '关于页面上线 & 安全规则大升级',
    isLatest: true,
    sections: [
      {
        title: '✨ 整了点新活',
        items: [
          '新增了**关于页面**，可以看到版本号、运行环境这些信息',
          '关于页面藏了个**小彩蛋**',
          '新增**更新看板**页面，每次更新了什么一目了然',
          'AI 助手页面大翻新，`预设提供商` 和 `自定义` 两种模式分开了，用起来更清爽',
          '现在可以**编辑**已经保存的 AI 配置了，不用删了重加',
          '大文件 AI 分析单个文件失败会自动**重试最多 3 次**，网络波动也不怕',
          'AI 分析结果现在会**按文件路径缓存**到本地，下次重新扫描直接展示历史结果',
          '批量分析时会**跳过已有缓存**的文件，避免重复调用 API 浪费额度',
        ],
      },
      {
        title: '🔒 安全规则大升级',
        items: [
          '新增**结构性文件保护**：`.db`/`.env`/`.key`/`.pem`/`.conf` 这类配置和数据库文件，在非缓存目录下直接标记为保留，防止误删重要数据',
          '新增 **AI 模型文件分类**：`.safetensors`/`.ckpt`/`.pt`/`.onnx`/`.gguf` 等模型权重统一识别，不再一刀切锁死',
          '**未知文件类型**不再直接保留（`keep`），改为交给用户确认（`caution`），想删什么你自己定',
          '游戏资源（Steam 目录等）和虚拟磁盘仍然严格保留，误删不存在的',
          '扫描规则页面同步更新了文件类型说明和决策流程图',
        ],
      },
      {
        title: '🎨 看着更顺眼了',
        items: [
          '逐项清理列表优化了安全等级标记，一眼看清哪些能删',
          '大文件分析的筛选和列布局调整了，浏览更舒服',
          '加了 AI 分析提示横幅，安全提示更醒目',
        ],
      },
    ],
  },
  {
    version: 'v1.0.0',
    date: '2026-06-30',
    title: '大版本更新 — AI 批量分析 + 多盘符扫描',
    sections: [
      {
        title: '✨ 整了点新活',
        items: [
          '**可以选盘符了！** 扫描前弹窗让你选扫哪个盘，不只能扫 C 盘了',
          'AI 现在能**批量分析**扫描结果，帮你判断哪些文件可以安全清理',
          '新增了 agens 供应商预设，现在有 `deepseek`/`minimax`/`siliconflow`/`agens` 四家可选',
          '清理到一半想停？支持**终止清理**，已经删的还能**回滚恢复**',
          '大文件支持 AI **一个一个分析**，还能综合判断安全性',
          '逐项清理列表可以**排序**了',
          '支持**单文件删除**，还能直接跳转到回收站',
        ],
      },
      {
        title: '🎨 看着更顺眼了',
        items: [
          '加了 `FloatingLines` 动态线条背景，桌面更生动了',
          '空间概览空状态重新设计了，没数据也不丑',
          '大文件页面新增类型列 / 安全等级列 / 删除倒计时警告',
          '极简模式文件列表加了"打开位置"、"回收站"按钮',
        ],
      },
      {
        title: '🐛 修修补补',
        items: [
          '大文件列表现在按从大到小排了，之前顺序有点奇怪',
          '扫描总量和实际可清理数量对不上的问题修好了',
          '高级模式扫描完成判断改成了以返回值为主，避免事件冲突',
          '极简模式列表滑不动、扫描状态消失、报 `duplicate key` 的问题都修了',
        ],
      },
    ],
  },
  {
    version: 'v0.9.0',
    date: '2026-06-30',
    title: '极简模式大翻新 & 文件实时展示',
    sections: [
      {
        title: '✨ 整了点新活',
        items: [
          '极简模式扫描时能**实时看到文件列表**了，不用干等着',
          '极简模式新增**两个清理按钮**（安全清理 / 强制清理），想怎么清都行',
          '高级模式的逐项清理和大文件分析也支持**实时展示**了',
          '加了取消全选功能',
        ],
      },
      {
        title: '🎨 看着更顺眼了',
        items: [
          '极简模式首页加了 GSAP 粒子动态背景，B格拉满',
          '文件类型按类别分组展示，不再是原始后缀名了',
          '卡片布局和状态标签优化了一波',
        ],
      },
      {
        title: '🐛 修修补补',
        items: [
          '单文件删除报错没提示的问题修好了',
          '大文件重复和扫描中排序不对的问题解决了',
        ],
      },
    ],
  },
  {
    version: 'v0.8.0',
    date: '2026-06-30',
    title: 'AI 分析上线 & 图表可视化',
    sections: [
      {
        title: '✨ 整了点新活',
        items: [
          'AI 可以**分析单个文件**了，调用大模型判断文件安不安全',
          '空间概览加了 ECharts **饼图**，磁盘占用情况一目了然',
          'AI 配置支持保存为预设，可以存多套配置随时切换',
          '标签页切换不会丢失状态了，切出去再回来还在原位',
        ],
      },
      {
        title: '🎨 看着更顺眼了',
        items: [
          '加了 GSAP 粒子的动态背景动画',
          '整体包装结构和布局优化了一波',
        ],
      },
    ],
  },
  {
    version: 'v0.1.0',
    date: '2026-06-30',
    title: '第一版！',
    sections: [
      {
        title: '🎉 从零开始',
        items: [
          'C 盘智能清理工具的**第一个版本**诞生了',
          '极简模式 / 高级模式双界面都有',
          '缓存目录递归扫描引擎安排上了',
          '内置安全规则引擎，防止误删重要文件',
          '删除文件走回收站，删错了还能捞回来',
          '基于 Electron + React + Ant Design + TypeScript 构建',
        ],
      },
    ],
  },
];

export default function Changelog() {
  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #1677ff, #69b1ff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <HistoryOutlined style={{ fontSize: 16, color: '#fff' }} />
        </div>
        <Title level={4} style={{ margin: 0 }}>更新看板</Title>
      </div>

      {/* 版本时间线 */}
      <div style={{ position: 'relative', paddingLeft: 24 }}>
        {/* 左侧竖线 */}
        <div
          style={{
            position: 'absolute',
            left: 11,
            top: 6,
            bottom: 6,
            width: 2,
            background: 'linear-gradient(to bottom, #1677ff, #e8e8e8)',
          }}
        />

        {releases.map((release, idx) => (
          <div
            key={release.version}
            style={{
              position: 'relative',
              paddingLeft: 28,
              marginBottom: idx === releases.length - 1 ? 0 : 24,
            }}
          >
            {/* 时间线圆点 */}
            <div
              style={{
                position: 'absolute',
                left: 4,
                top: 6,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: release.isLatest ? '#1677ff' : '#d9d9d9',
                border: release.isLatest ? '3px solid #bae0ff' : '3px solid #f0f0f0',
                zIndex: 1,
              }}
            />

            {/* 版本卡片 */}
            <Card
              size="small"
              styles={{ body: { padding: 16 } }}
              style={{
                border: release.isLatest ? '1px solid #91caff' : '1px solid #f0f0f0',
                borderRadius: 8,
                boxShadow: release.isLatest
                  ? '0 2px 8px rgba(22,119,255,0.08)'
                  : '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              {/* 卡片头部：版本号 + 日期 */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <Space>
                  <Tag
                    color={release.isLatest ? 'blue' : 'default'}
                    style={{
                      fontSize: 14,
                      padding: '2px 10px',
                      fontWeight: 600,
                      borderRadius: 4,
                      marginRight: 0,
                    }}
                  >
                    {release.version}
                  </Tag>
                  {release.isLatest && <Tag color="blue">最新版</Tag>}
                  {release.title && (
                    <Text style={{ fontSize: 13, fontWeight: 500, color: '#555' }}>
                      {release.title}
                    </Text>
                  )}
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {release.date}
                </Text>
              </div>

              {/* 更新内容章节 */}
              {release.sections.map((section) => (
                <div key={section.title} style={{ marginBottom: 12 }}>
                  <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                    {section.title}
                  </Text>
                  <div style={{ fontSize: 13, lineHeight: 2, color: '#444' }}>
                    <Markdown
                      components={{
                        ul: ({ children }) => (
                          <ul style={{ margin: 0, paddingLeft: 20 }}>{children}</ul>
                        ),
                        li: ({ children }) => (
                          <li style={{ margin: 0 }}>{children}</li>
                        ),
                      }}
                    >
                      {section.items.map((item) => `- ${item}`).join('\n')}
                    </Markdown>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        ))}
      </div>

      {/* 尾部 */}
      <div style={{ textAlign: 'center', marginTop: 28, marginBottom: 24 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          感谢你看到了这里 ❤️ 后面还会继续更新的！
        </Text>
      </div>
    </div>
  );
}
