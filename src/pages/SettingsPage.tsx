import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Switch,
  Typography,
  Space,
  message,
  Divider,
  List,
} from 'antd';
import ArrowLeftOutlined from '@ant-design/icons/ArrowLeftOutlined';
import SafetyCertificateOutlined from '@ant-design/icons/SafetyCertificateOutlined';
import FileTextOutlined from '@ant-design/icons/FileTextOutlined';
import FolderOpenOutlined from '@ant-design/icons/FolderOpenOutlined';

const { Title, Text } = Typography;

interface Props {
  onBack: () => void;
}

export default function SettingsPage({ onBack }: Props) {
  const [createRestorePoint, setCreateRestorePoint] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!window.electronAPI) return;
      try {
        const settings = await window.electronAPI.getSettings();
        setCreateRestorePoint(settings.createRestorePoint);
      } catch {
        // ignore
      }
      try {
        const logData = await window.electronAPI.getLogs();
        setLogs(logData);
      } catch {
        // ignore
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!window.electronAPI) return;
    setSaving(true);
    try {
      await window.electronAPI.saveSettings({ createRestorePoint });
      message.success('设置已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenLogFolder = async () => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.openLogFolder();
    } catch {
      message.error('无法打开日志文件夹');
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={onBack} type="text">
          返回
        </Button>
        <Title level={4} style={{ margin: 0 }}>设置</Title>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space align="start" size="middle">
          <SafetyCertificateOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <div style={{ flex: 1 }}>
            <Text strong>清理谨慎项前创建系统还原点</Text>
            <br />
            <Text type="secondary">
              仅辅助恢复系统状态；普通文件恢复仍以回收站为准
            </Text>
          </div>
          <Switch
            checked={createRestorePoint}
            onChange={setCreateRestorePoint}
          />
        </Space>

        <Divider />

        <Button type="primary" onClick={handleSave} loading={saving}>
          保存设置
        </Button>
      </Card>

      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>操作日志</span>
          </Space>
        }
        extra={
          <Button size="small" icon={<FolderOpenOutlined />} onClick={handleOpenLogFolder}>
            打开日志文件夹
          </Button>
        }
      >
        {logs.length === 0 ? (
          <Text type="secondary">暂无日志记录</Text>
        ) : (
          <List
            size="small"
            dataSource={logs}
            renderItem={(log) => <List.Item>{log}</List.Item>}
          />
        )}
      </Card>
    </div>
  );
}
