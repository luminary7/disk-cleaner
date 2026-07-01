import { useEffect, useState } from 'react';
import { Card, Descriptions, Tag, Typography, Space, Divider, Spin, Modal } from 'antd';
import InfoCircleOutlined from '@ant-design/icons/InfoCircleOutlined';
import UserOutlined from '@ant-design/icons/UserOutlined';
import douyinIcon from '../assets/ui/douyin.webp';
import redNoteIcon from '../assets/ui/red-note.webp';
import thumbBqb from '../assets/bqb/thumb.webp';

const { Title, Paragraph, Link, Text } = Typography;

const DOUYIN_URL = 'https://www.douyin.com/user/MS4wLjABAAAAaKE9XNmNidFz3kXtZcoyxzVOPRN02nvlixNzwU0wSQsITXlZP6wWn8uG-_2kR9nk?from_tab_name=main&is_search=0&list_name=fans&nt=0';
const XHS_URL = 'https://www.xiaohongshu.com/user/profile/6107f74600000000010021ba?xsec_token=ABqHv2xwRDm21nl0aQAKUuXzKDIR9LmqqujXuU8fsQESU%3D&xsec_source=pc_search&m_source=itab';

const iconStyle: React.CSSProperties = { width: 20, height: 20, borderRadius: 4, verticalAlign: 'middle' };
const linkItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 8,
  cursor: 'pointer',
  transition: 'background 0.2s',
};
const linkItemHoverStyle: React.CSSProperties = { background: '#f5f5f5' };

function SocialLink({
  icon,
  label,
  username,
  url,
}: {
  icon: string;
  label: string;
  username: string;
  url: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ ...linkItemStyle, ...(hovered ? linkItemHoverStyle : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => window.electronAPI.openExternal(url)}
    >
      <img src={icon} alt={label} style={iconStyle} />
      <div>
        <Text strong style={{ fontSize: 14 }}>{label}</Text>
        <br />
        <Text type="secondary" style={{ fontSize: 13 }}>{username}</Text>
      </div>
    </div>
  );
}

export default function About() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [eggVisible, setEggVisible] = useState(false);

  useEffect(() => {
    window.electronAPI.getAppInfo().then((info) => {
      setAppInfo(info);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <Spin style={{ display: 'block', margin: '80px auto' }} />;
  }

  if (!appInfo) return null;

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      {/* 软件标识 */}
      <Card style={{ textAlign: 'center', marginBottom: 16 }}>
        <InfoCircleOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 12 }} />
        <Title level={3} style={{ margin: 0 }}>{appInfo.appName}</Title>
        <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
          v{appInfo.version}
        </Paragraph>
        <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 13 }}>
          {appInfo.description}
        </Paragraph>
        <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center', gap: 8 }}>
          <Tag color="blue">{appInfo.license}</Tag>
          <Tag
            color="orange"
            style={{ cursor: 'pointer' }}
            onClick={() => setEggVisible(true)}
          >
            不可以点我哦
          </Tag>
        </div>
      </Card>

      {/* 关注我 */}
      <Card title={<span><UserOutlined style={{ marginRight: 6 }} />关注我</span>} size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={0}>
          <SocialLink
            icon={douyinIcon}
            label="抖音"
            username="7号只会咕咕咕"
            url={DOUYIN_URL}
          />
          <Divider style={{ margin: '4px 0' }} />
          <SocialLink
            icon={redNoteIcon}
            label="小红书"
            username="7号只会咕咕咕"
            url={XHS_URL}
          />
        </Space>
      </Card>

      {/* 运行环境 */}
      <Card title="运行环境" size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Electron">{appInfo.electron}</Descriptions.Item>
          <Descriptions.Item label="Chromium">{appInfo.chrome}</Descriptions.Item>
          <Descriptions.Item label="Node.js">{appInfo.node}</Descriptions.Item>
          <Descriptions.Item label="平台">Windows</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 技术栈 */}
      <Card title="致谢" size="small" style={{ marginBottom: 16 }}>
        <Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
          本软件基于以下开源项目构建：
        </Paragraph>
        <div style={{ marginTop: 8, lineHeight: 2 }}>
          <Tag>React 19</Tag>
          <Tag>TypeScript</Tag>
          <Tag>Electron</Tag>
          <Tag>Ant Design 6</Tag>
          <Tag>ECharts</Tag>
          <Tag>GSAP</Tag>
          <Tag>Vite</Tag>
        </div>
      </Card>

      {/* 源码说明 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Paragraph type="secondary" style={{ margin: 0, textAlign: 'center', fontSize: 13 }}>
          源码目前处于开发阶段，后续再公开
        </Paragraph>
      </Card>

      <Divider style={{ margin: '12px 0' }} />
      <Paragraph type="secondary" style={{ textAlign: 'center', fontSize: 12, marginBottom: 0 }}>
        Copyright &copy; {new Date().getFullYear()} {appInfo.author || '7号只会咕咕咕'}.
      </Paragraph>

      {/* 彩蛋弹窗 */}
      <Modal
        title="🎉 没有用的彩蛋 +1"
        open={eggVisible}
        footer={null}
        width={480}
        centered
        onCancel={() => setEggVisible(false)}
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <img
            src={thumbBqb}
            alt="表情包"
            style={{ width: 200, height: 'auto', borderRadius: 12, marginBottom: 20 }}
          />
          <Paragraph style={{ fontSize: 15, lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>
            各位老大好，这是我的第一款VibeCoding正式发布的作品，可能有很多不足之处，希望大家可以谅解，我都会慢慢完善。有软件上的问题反馈或者你对Vibe Coding有问题，都可以随时联系我，只要主包有空都会帮你们解答。非常感谢各位老大的支持🎉
          </Paragraph>
          <Paragraph style={{ fontSize: 15, lineHeight: 1.8, margin: '8px 0 0', fontWeight: 700 }}>
            最后就是希望大家可以天天开心，万事如意~
          </Paragraph>
        </div>
      </Modal>
    </div>
  );
}
