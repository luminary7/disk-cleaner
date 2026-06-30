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
} from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, LinkOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const PRESET_PROVIDERS: Record<string, { endpoint: string; model: string; site?: string; docs?: string }> = {
  deepseek: { endpoint: 'https://api.deepseek.com', model: 'deepseek-chat' },
  minimax: { endpoint: 'https://api.minimax.chat/v1', model: 'minimax-text-01' },
  siliconflow: { endpoint: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
  agens: {
    endpoint: 'https://apihub.agnes-ai.com/v1/',
    model: 'agnes-2.0-flash',
    site: 'https://agnes-ai.com/',
    docs: 'https://agnes-ai.com/zh-Hans/docs/agnes-20-flash',
  },
};

interface Props {
  onBack: () => void;
}

export default function AIConfigPage({ onBack }: Props) {
  const [mode, setMode] = useState<'disabled' | 'preset' | 'custom'>('disabled');
  const [provider, setProvider] = useState<'deepseek' | 'minimax' | 'siliconflow' | 'agens'>('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

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
      } catch {
        // ignore
      }
    })();
  }, []);

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

  const handleTest = async () => {
    if (!window.electronAPI) return;
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
      message.success('配置已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={onBack} type="text">
          返回
        </Button>
        <Title level={4} style={{ margin: 0 }}>AI 助手设置</Title>
      </Space>

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
                      <Radio value="agens">Agnes AI（免费）</Radio>
                    </Radio.Group>
                  </Form.Item>
                  {provider === 'agens' && (
                    <div style={{ marginBottom: 16, display: 'flex', gap: 16, fontSize: 13 }}>
                      <a href={PRESET_PROVIDERS.agens.site} target="_blank" rel="noopener noreferrer">
                        <LinkOutlined /> 官网
                      </a>
                      <a href={PRESET_PROVIDERS.agens.docs} target="_blank" rel="noopener noreferrer">
                        <LinkOutlined /> API 文档
                      </a>
                    </div>
                  )}
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

          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={handleSave}
            loading={saving}
          >
            保存配置
          </Button>
        </Form>
      </Card>
    </div>
  );
}
