import { useState } from 'react';
import { Layout, Menu, Button } from 'antd';
import {
  PieChartOutlined,
  FormatPainterOutlined,
  FileSearchOutlined,
  RobotOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import SpaceOverview from './SpaceOverview';
import CleanItems from './CleanItems';
import LargeFiles from './LargeFiles';
import AIAssistant from './AIAssistant';
import AIConfigPage from './AIConfigPage';
import SettingsPage from './SettingsPage';

const { Sider, Content } = Layout;

type TabKey = 'overview' | 'clean-items' | 'large-files' | 'ai-chat' | 'ai-config' | 'settings';

interface Props {
  onSwitchToSimple: () => void;
}

const menuItems = [
  { key: 'overview', icon: <PieChartOutlined />, label: '空间概览' },
  { key: 'clean-items', icon: <FormatPainterOutlined />, label: '逐项清理' },
  { key: 'large-files', icon: <FileSearchOutlined />, label: '大文件分析' },
  { key: 'ai-chat', icon: <RobotOutlined />, label: 'AI 助手' },
];

export default function AdvancedMode({ onSwitchToSimple }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [siderCollapsed, setSiderCollapsed] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <SpaceOverview />;
      case 'clean-items':
        return <CleanItems />;
      case 'large-files':
        return <LargeFiles />;
      case 'ai-chat':
        return <AIAssistant />;
      case 'ai-config':
        return <AIConfigPage onBack={() => setActiveTab('overview')} />;
      case 'settings':
        return <SettingsPage onBack={() => setActiveTab('overview')} />;
      default:
        return <SpaceOverview />;
    }
  };

  return (
    <Layout style={{ height: '100%' }}>
      <Sider
        collapsible
        collapsed={siderCollapsed}
        onCollapse={setSiderCollapsed}
        theme="light"
        style={{ borderRight: '1px solid #f0f0f0' }}
      >
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onSwitchToSimple}
            style={{ width: '100%' }}
          >
            {siderCollapsed ? '' : '返回极简模式'}
          </Button>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeTab]}
          items={menuItems}
          onClick={({ key }) => setActiveTab(key as TabKey)}
        />
        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, padding: '0 16px' }}>
          <Button type="text" block onClick={() => setActiveTab('settings')}>
            {siderCollapsed ? '⚙' : '设置'}
          </Button>
        </div>
      </Sider>
      <Content style={{ padding: 24, overflow: 'auto', background: '#f5f5f5' }}>
        {renderContent()}
      </Content>
    </Layout>
  );
}
