import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Radio,
  Input,
  Typography,
  Space,
  message,
  Divider,
  Alert,
  Form,
  Row,
  Modal,
  Tag,
  Popconfirm,
} from 'antd';
import {
  RobotOutlined,
  CheckCircleOutlined,
  StarOutlined,
  DeleteOutlined,
  PlusOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import aiAnalysisImg from '../assets/ui-kit/ai-analysis.png';

const { Title, Text } = Typography;

const PRESET_PROVIDERS: Record<string, { endpoint: string; model: string }> = {
  deepseek: { endpoint: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
  minimax: { endpoint: 'https://api.minimax.chat/v1', model: 'Minimax-M3' },
  siliconflow: { endpoint: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
};

interface AIPreset extends AIConfig {
  name: string;
}

export default function AIAssistant() {
  const [mode, setMode] = useState<'disabled' | 'preset' | 'custom'>('disabled');
  const [provider, setProvider] = useState<'deepseek' | 'minimax' | 'siliconflow'>('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  // 配置预设相关
  const [presets, setPresets] = useState<AIPreset[]>([]);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [activePresetName, setActivePresetName] = useState('');

  useEffect(() => {
    (async () => {
      if (!window.electronAPI) return;
      try {
        const config = await window.electronAPI.getAIConfig();
        setMode(config.mode || 'disabled');
        setProvider(config.provider || 'deepseek');
        setApiKey(config.apiKey || '');
        setCustomEndpoint(config.endpoint || '');
        setCustomModel(config.model || '');
        setIsConfigured(config.mode !== 'disabled' && !!config.apiKey);
      } catch {
        // ignore
      }
    })();
  }, []);

  // 加载预设列表和当前启用预设
  useEffect(() => {
    loadPresets();
    loadActivePreset();
  }, []);

  const loadPresets = async () => {
    if (!window.electronAPI) return;
    if (!window.electronAPI.getAIPresets) return;
    try {
      const list = await window.electronAPI.getAIPresets();
      setPresets(list || []);
    } catch {
      // 静默忽略
    }
  };

  const loadActivePreset = async () => {
    if (!window.electronAPI) return;
    if (!window.electronAPI.getActivePreset) return;
    try {
      const name = await window.electronAPI.getActivePreset();
      setActivePresetName(name || '');
    } catch {
      // 静默忽略
    }
  };

  const getEndpoint = () => {
    if (mode === 'preset') return PRESET_PROVIDERS[provider].endpoint;
    if (mode === 'custom') return customEndpoint;
    return '';
  };

  const getModel = () => {
    if (mode === 'preset') return PRESET_PROVIDERS[provider].model;
    if (mode === 'custom') return customModel;
    return '';
  };

  const getProviderLabel = (p?: string) => {
    if (p === 'deepseek') return 'DeepSeek';
    if (p === 'minimax') return 'MiniMax';
    if (p === 'siliconflow') return '硅基流动';
    return p || '自定义';
  };

  const handleTest = async () => {
    if (!window.electronAPI) return;
    if (mode !== 'disabled' && !apiKey) {
      message.warning('请先输入 API Key');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.electronAPI.testAIConnection({
        mode,
        provider,
        endpoint: getEndpoint(),
        apiKey,
        model: getModel(),
      });
      setTestResult(result);
    } catch {
      setTestResult({ success: false, message: '连接测试失败' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!window.electronAPI) return;
    if (mode !== 'disabled' && !apiKey) {
      message.warning('请输入 API Key');
      return;
    }
    setSaving(true);
    try {
      await window.electronAPI.saveAIConfig({
        mode,
        provider: mode === 'preset' ? provider : undefined,
        endpoint: getEndpoint(),
        apiKey,
        model: getModel(),
      });
      setIsConfigured(mode !== 'disabled' && !!apiKey);
      message.success('配置已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 保存为预设
  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      message.warning('请输入预设名称');
      return;
    }
    if (!window.electronAPI) return;
    if (!window.electronAPI.saveAIPreset) {
      message.error('保存预设失败：Electron 预加载脚本未更新，请关闭应用后重新启动');
      return;
    }
    try {
      await window.electronAPI.saveAIPreset({
        name: presetName.trim(),
        mode,
        provider: mode === 'preset' ? provider : undefined,
        endpoint: getEndpoint(),
        apiKey,
        model: getModel(),
      });
      message.success('预设已保存');
      setPresetModalOpen(false);
      setPresetName('');
      loadPresets();
    } catch (e) {
      message.error(`保存预设失败：${e instanceof Error ? e.message : '未知错误'}`);
    }
  };

  // 应用预设
  const handleApplyPreset = async (preset: AIPreset) => {
    if (!window.electronAPI) return;
    setMode(preset.mode);
    if (preset.mode === 'preset') {
      setProvider(preset.provider || 'deepseek');
    }
    setCustomEndpoint(preset.endpoint || '');
    setCustomModel(preset.model || '');
    setApiKey(preset.apiKey || '');
    setTestResult(null);
    try {
      await window.electronAPI.saveAIConfig(preset);
      setIsConfigured(preset.mode !== 'disabled' && !!preset.apiKey);
      // 记录当前启用预设
      if (window.electronAPI.saveActivePreset) {
        await window.electronAPI.saveActivePreset(preset.name);
      }
      setActivePresetName(preset.name);
      message.success(`已启用配置: ${preset.name}`);
    } catch (e) {
      message.error(`应用配置失败：${e instanceof Error ? e.message : '未知错误'}`);
    }
  };

  // 删除预设
  const handleDeletePreset = async (name: string) => {
    if (!window.electronAPI) return;
    if (!window.electronAPI.deleteAIPreset) {
      message.error('删除失败：Electron 预加载脚本未更新，请关闭应用后重新启动');
      return;
    }
    try {
      await window.electronAPI.deleteAIPreset(name);
      message.success('预设已删除');
      loadPresets();
    } catch (e) {
      message.error(`删除失败：${e instanceof Error ? e.message : '未知错误'}`);
    }
  };

  const maskApiKey = (key?: string) => {
    if (!key || key.length < 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Space>
          <img src={aiAnalysisImg} alt="AI 助手" style={{ width: 32, height: 32, borderRadius: 6 }} />
          <Title level={4} style={{ margin: 0 }}>AI 助手设置</Title>
        </Space>
        <Space>
          {isConfigured && (
            <Alert
              type="success"
              message="AI 已配置"
              showIcon
              style={{ padding: '4px 12px' }}
            />
          )}
        </Space>
      </Row>

      <Card>
        <Form layout="vertical">
          <Form.Item label="AI 模式">
            <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
              <Radio.Button value="disabled">不启用 AI</Radio.Button>
              <Radio.Button value="preset">预置提供商</Radio.Button>
              <Radio.Button value="custom">自定义 OpenAI 兼容</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {mode !== 'disabled' && (
            <>
              {mode === 'preset' && (
                <>
                  <Form.Item label="选择提供商">
                    <Radio.Group
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                    >
                      <Radio value="deepseek">DeepSeek</Radio>
                      <Radio value="minimax">MiniMax</Radio>
                      <Radio value="siliconflow">硅基流动</Radio>
                    </Radio.Group>
                  </Form.Item>
                  <Form.Item label="API Endpoint">
                    <Input value={PRESET_PROVIDERS[provider].endpoint} disabled />
                  </Form.Item>
                  <Form.Item label="模型">
                    <Input value={PRESET_PROVIDERS[provider].model} disabled />
                  </Form.Item>
                </>
              )}

              {mode === 'custom' && (
                <>
                  <Form.Item label="API Endpoint" required>
                    <Input
                      value={customEndpoint}
                      onChange={(e) => setCustomEndpoint(e.target.value)}
                      placeholder="https://api.example.com/v1"
                    />
                  </Form.Item>
                  <Form.Item label="模型名称" required>
                    <Input
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      placeholder="gpt-4o / claude-3-sonnet / ..."
                    />
                  </Form.Item>
                </>
              )}

              <Form.Item label="API Key" required>
                <Input.Password
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                />
              </Form.Item>

              <Space>
                <Button onClick={handleTest} loading={testing}>
                  测试连接
                </Button>
                {testResult && (
                  <Alert
                    type={testResult.success ? 'success' : 'error'}
                    message={testResult.message}
                    showIcon
                    style={{ padding: '4px 12px' }}
                  />
                )}
              </Space>

              <Divider />
            </>
          )}

          <Space>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleSave}
              loading={saving}
            >
              保存配置
            </Button>
            {mode !== 'disabled' && (
              <Button icon={<PlusOutlined />} onClick={() => setPresetModalOpen(true)}>
                保存为预设
              </Button>
            )}
          </Space>
        </Form>
      </Card>

      {/* 预设配置列表 — 仅在启用 AI 时显示 */}
      {mode !== 'disabled' && presets.length > 0 && (
        <>
          <Divider />
          <Title level={5} style={{ marginBottom: 12 }}>
            <StarOutlined style={{ marginRight: 8 }} />
            已保存的配置预设
          </Title>
          <Space orientation="vertical" style={{ width: '100%' }}>
            {presets.map((item) => {
              const isActive = item.name === activePresetName;
              return (
                <Card
                  key={item.name}
                  size="small"
                  styles={{
                    body: { padding: '12px 16px' },
                  }}
                  style={{
                    border: isActive ? '2px solid #1677ff' : '1px solid #f0f0f0',
                    background: isActive ? '#f0f5ff' : '#fff',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Space style={{ marginBottom: 4 }}>
                        {isActive && (
                          <CheckCircleFilled style={{ color: '#1677ff', fontSize: 16 }} />
                        )}
                        <Text strong={isActive}>{item.name}</Text>
                        <Tag color="blue">{getProviderLabel(item.provider)}</Tag>
                        {item.model && <Text type="secondary">{item.model}</Text>}
                      </Space>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.endpoint}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12, marginLeft: 12 }}>
                          API Key: {maskApiKey(item.apiKey)}
                        </Text>
                      </div>
                    </div>
                    <Space style={{ marginLeft: 16, flexShrink: 0 }}>
                      {isActive ? (
                        <Button type="default" icon={<CheckCircleOutlined />} disabled>
                          已启用
                        </Button>
                      ) : (
                        <Button
                          type="link"
                          icon={<CheckCircleOutlined />}
                          onClick={() => handleApplyPreset(item)}
                        >
                          启用
                        </Button>
                      )}
                      <Popconfirm
                        title="确定删除此预设？"
                        onConfirm={() => handleDeletePreset(item.name)}
                      >
                        <Button type="link" danger icon={<DeleteOutlined />}>
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  </div>
                </Card>
              );
            })}
          </Space>
        </>
      )}

      {/* 保存预设对话框 */}
      <Modal
        title="保存为配置预设"
        open={presetModalOpen}
        onOk={handleSavePreset}
        onCancel={() => {
          setPresetModalOpen(false);
          setPresetName('');
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form layout="vertical">
          <Form.Item label="预设名称" required>
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="例如：工作电脑、家用电脑"
              onPressEnter={handleSavePreset}
            />
          </Form.Item>
        </Form>
        <Text type="secondary">
          将保存当前配置（含 API Key、端点、模型等信息）到本地，方便快速切换。
        </Text>
      </Modal>
    </div>
  );
}
