import { useState } from 'react';
import { Layout, Menu, Button } from 'antd';
import {
  PieChartOutlined,
  FormatPainterOutlined,
  FileSearchOutlined,
  RobotOutlined,
  InfoCircleOutlined,
  ArrowLeftOutlined,
  AuditOutlined,
  ReadOutlined,
} from '@ant-design/icons';
import SpaceOverview from './SpaceOverview';
import CleanItems from './CleanItems';
import LargeFiles from './LargeFiles';
import AIAssistant from './AIAssistant';
import AIConfigPage from './AIConfigPage';
import SettingsPage from './SettingsPage';
import ScanRules from './ScanRules';
import About from './About';
import Changelog from './Changelog';

const { Sider, Content } = Layout;

type TabKey = 'overview' | 'clean-items' | 'large-files' | 'ai-chat' | 'ai-config' | 'settings' | 'scan-rules' | 'changelog' | 'about';

interface Props {
  onSwitchToSimple: () => void;
}

const menuItems = [
  { key: 'overview', icon: <PieChartOutlined />, label: '空间概览' },
  { key: 'clean-items', icon: <FormatPainterOutlined />, label: '逐项清理' },
  { key: 'large-files', icon: <FileSearchOutlined />, label: '大文件分析' },
  { key: 'scan-rules', icon: <AuditOutlined />, label: '扫描规则' },
  { key: 'ai-chat', icon: <RobotOutlined />, label: 'AI 助手' },
  { key: 'changelog', icon: <ReadOutlined />, label: '更新看板' },
  { key: 'about', icon: <InfoCircleOutlined />, label: '关于' },
];

export default function AdvancedMode({ onSwitchToSimple }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [siderCollapsed, setSiderCollapsed] = useState(false);

  const renderContent = () => {
    // 同时渲染所有标签页，用 display:none 控制显隐以保留状态
    const tabs = {
      overview: <SpaceOverview />,
      'clean-items': <CleanItems />,
      'large-files': <LargeFiles />,
      'scan-rules': <ScanRules />,
      'ai-chat': <AIAssistant />,
      'changelog': <Changelog />,
      'about': <About />,
    };
    return (
      <>
        {Object.entries(tabs).map(([key, el]) => (
          <div key={key} style={{ display: key === activeTab ? '' : 'none', height: '100%' }}>
            {el}
          </div>
        ))}
        {/* ai-config 和 settings 仍然通过条件渲染，因为它们不需要保留状态 */}
        {activeTab === 'ai-config' && <AIConfigPage onBack={() => setActiveTab('overview')} />}
        {activeTab === 'settings' && <SettingsPage onBack={() => setActiveTab('overview')} />}
      </>
    );
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
