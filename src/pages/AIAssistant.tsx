import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Switch,
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
  Empty,
} from 'antd';
import {
  RobotOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  CheckCircleFilled,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { PRESET_PROVIDERS } from '../shared/provider-config';
import type { PresetProvider } from '../shared/provider-config';
import aiAnalysisImg from '../assets/ui-kit/ai-analysis.png';

const { Title, Text } = Typography;

interface AIPreset extends AIConfig {
  name: string;
}

export default function AIAssistant() {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [presets, setPresets] = useState<AIPreset[]>([]);
  const [activePresetName, setActivePresetName] = useState('');

  // 弹窗表单
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [provider, setProvider] = useState<PresetProvider>('deepseek');
  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [editingPreset, setEditingPreset] = useState<AIPreset | null>(null);

  useEffect(() => {
    loadPresets();
    loadActivePreset();
    loadConfig();
  }, []);

  const loadConfig = async () => {
    if (!window.electronAPI) return;
    try {
      const config = await window.electronAPI.getAIConfig();
      setAiEnabled(config.mode !== 'disabled' && !!config.apiKey);
    } catch { /* ignore */ }
  };

  const loadPresets = async () => {
    if (!window.electronAPI) return;
    try {
      const list = await window.electronAPI.getAIPresets();
      setPresets(list || []);
    } catch { /* ignore */ }
  };

  const loadActivePreset = async () => {
    if (!window.electronAPI) return;
    try {
      const name = await window.electronAPI.getActivePreset();
      setActivePresetName(name || '');
    } catch { /* ignore */ }
  };

  const getProviderLabel = (p?: string) => {
    if (p && p in PRESET_PROVIDERS) return PRESET_PROVIDERS[p as PresetProvider].label;
    return p || '自定义';
  };

  const maskApiKey = (key?: string) => {
    if (!key || key.length < 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
  };

  const handleModeChange = (newMode: 'preset' | 'custom') => {
    setMode(newMode);
    if (newMode === 'preset') {
      setEndpoint(PRESET_PROVIDERS[provider].endpoint);
      setModel(PRESET_PROVIDERS[provider].model);
    }
  };

  const handleProviderChange = (newProvider: PresetProvider) => {
    setProvider(newProvider);
    setEndpoint(PRESET_PROVIDERS[newProvider].endpoint);
    setModel(PRESET_PROVIDERS[newProvider].model);
  };

  const handleTest = async () => {
    if (!window.electronAPI) return;
    if (!apiKey) { message.warning('请先输入 API Key'); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.electronAPI.testAIConnection({
        mode,
        provider: mode === 'preset' ? provider : undefined,
        endpoint,
        apiKey,
        model,
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
    if (!apiKey) { message.warning('请输入 API Key'); return; }
    if (!presetName.trim()) { message.warning('请输入预设名称'); return; }
    setSaving(true);
    try {
      const config = {
        mode: mode as AIConfig['mode'],
        provider: mode === 'preset' ? provider : undefined,
        endpoint,
        apiKey,
        model,
      };
      // 编辑模式：若名称已修改，先删除旧预设
      if (editingPreset && presetName.trim() !== editingPreset.name) {
        await window.electronAPI.deleteAIPreset(editingPreset.name);
        if (activePresetName === editingPreset.name) {
          setActivePresetName('');
        }
      }
      await window.electronAPI.saveAIPreset({ name: presetName.trim(), ...config });
      // 非编辑模式（新增）才自动切换为当前配置
      if (!editingPreset) {
        await window.electronAPI.saveAIConfig(config);
        setAiEnabled(true);
      }
      message.success(editingPreset ? '预设已更新' : '配置已保存');
      setModalOpen(false);
      await loadPresets();
      await loadActivePreset();
      resetForm();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPreset = async (preset: AIPreset) => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.saveAIConfig(preset);
      if (window.electronAPI.saveActivePreset) {
        await window.electronAPI.saveActivePreset(preset.name);
      }
      setActivePresetName(preset.name);
      setAiEnabled(true);
      message.success(`已启用配置: ${preset.name}`);
    } catch {
      message.error('应用配置失败');
    }
  };

  const handleDeletePreset = async (name: string) => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.deleteAIPreset(name);
      message.success('预设已删除');
      loadPresets();
      if (name === activePresetName) {
        setActivePresetName('');
      }
    } catch {
      message.error('删除失败');
    }
  };

  const handleSwitchChange = async (checked: boolean) => {
    setAiEnabled(checked);
    if (!checked && window.electronAPI) {
      await window.electronAPI.saveAIConfig({ mode: 'disabled', apiKey: '' });
    }
  };

  const resetForm = () => {
    setMode('preset');
    setProvider('deepseek');
    setEndpoint(PRESET_PROVIDERS.deepseek.endpoint);
    setModel(PRESET_PROVIDERS.deepseek.model);
    setApiKey('');
    setTestResult(null);
    setPresetName('');
    setEditingPreset(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (preset: AIPreset) => {
    setEditingPreset(preset);
    setMode(preset.mode as 'preset' | 'custom');
    if (preset.provider && preset.provider in PRESET_PROVIDERS) {
      setProvider(preset.provider as PresetProvider);
    }
    setEndpoint(preset.endpoint || '');
    setModel(preset.model || '');
    setApiKey(preset.apiKey || '');
    setPresetName(preset.name);
    setTestResult(null);
    setModalOpen(true);
  };

  const showEmpty = !aiEnabled || presets.length === 0;

  return (
    <div>
      {/* 顶栏 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Space>
          <img src={aiAnalysisImg} alt="AI 助手" style={{ width: 32, height: 32, borderRadius: 6 }} />
          <Title level={4} style={{ margin: 0 }}>AI 助手设置</Title>
        </Space>
        <Space>
          <Space>
            <Text strong>启用 AI</Text>
            <Switch checked={aiEnabled} onChange={handleSwitchChange} />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
            添加 API 配置
          </Button>
        </Space>
      </Row>

      {/* 空状态 */}
      {showEmpty ? (
        <Card>
          <Empty
            image={aiAnalysisImg}
            imageStyle={{ height: 120, marginTop: 20 }}
            description={
              !aiEnabled
                ? 'AI 功能未启用，开启后可管理 API 配置'
                : '暂无 API 配置，点击右上角添加'
            }
          >
            {!aiEnabled ? (
              <Button type="primary" onClick={() => handleSwitchChange(true)}>
                启用 AI
              </Button>
            ) : (
              <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
                添加 API 配置
              </Button>
            )}
          </Empty>
        </Card>
      ) : (
        /* 已保存的配置预设列表 */
        <>
          <Title level={5} style={{ marginBottom: 12 }}>
            已保存的配置预设
          </Title>
          <Space direction="vertical" style={{ width: '100%' }}>
            {presets.map((item) => {
              const isActive = item.name === activePresetName;
              const providerInfo = item.provider && item.provider in PRESET_PROVIDERS
                ? PRESET_PROVIDERS[item.provider as PresetProvider]
                : null;

              return (
                <Card
                  key={item.name}
                  size="small"
                  styles={{ body: { padding: 16 } }}
                  style={{
                    border: isActive ? '2px solid #1677ff' : '1px solid #f0f0f0',
                    background: isActive ? '#f0f5ff' : '#fff',
                  }}
                >
                  {/* 预设头部 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Space>
                      {isActive && <CheckCircleFilled style={{ color: '#1677ff', fontSize: 16 }} />}
                      <Text strong={isActive} style={{ fontSize: 15 }}>{item.name}</Text>
                      <Tag color="blue">{getProviderLabel(item.provider)}</Tag>
                    </Space>
                    <Space>
                      {isActive ? (
                        <Button size="small" icon={<CheckCircleOutlined />} disabled>已启用</Button>
                      ) : (
                        <Button size="small" icon={<CheckCircleOutlined />} onClick={() => handleApplyPreset(item)}>
                          启用
                        </Button>
                      )}
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(item)}>
                        编辑
                      </Button>
                      <Popconfirm title="确定删除此预设？" onConfirm={() => handleDeletePreset(item.name)}>
                        <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                      </Popconfirm>
                    </Space>
                  </div>

                  {/* 配置详情 */}
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12, fontSize: 13 }}>
                    <div><Text type="secondary">Endpoint: </Text><Text>{item.endpoint}</Text></div>
                    <div><Text type="secondary">Model: </Text><Text>{item.model}</Text></div>
                    <div><Text type="secondary">API Key: </Text><Text>{maskApiKey(item.apiKey)}</Text></div>
                  </div>

                  {/* 供应商官网链接卡片 */}
                  {providerInfo && (
                    <Card
                      size="small"
                      hoverable
                      style={{ background: '#fafafa', borderRadius: 6, cursor: 'pointer' }}
                      styles={{ body: { padding: '8px 12px' } }}
                      onClick={() => window.electronAPI?.openExternal(providerInfo.site)}
                    >
                      <Space>
                        <LinkOutlined />
                        <Text type="secondary">访问 {providerInfo.label} 官网</Text>
                      </Space>
                    </Card>
                  )}
                </Card>
              );
            })}
          </Space>
        </>
      )}

      {/* 添加/编辑 API 配置弹窗 */}
      <Modal
        title={editingPreset ? '编辑 API 配置' : '添加 API 配置'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={560}
        destroyOnClose
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label={<Text strong>AI 模式</Text>}>
            <Radio.Group value={mode} onChange={(e) => handleModeChange(e.target.value)}>
              <Radio.Button value="preset">预置提供商</Radio.Button>
              <Radio.Button value="custom">自定义 OpenAI 兼容</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {mode === 'preset' && (
            <>
              <Form.Item label={<Text strong>选择提供商</Text>}>
                <Radio.Group value={provider} onChange={(e) => handleProviderChange(e.target.value)}>
                  {Object.entries(PRESET_PROVIDERS).map(([key, cfg]) => (
                    <Radio key={key} value={key}>{cfg.label}</Radio>
                  ))}
                </Radio.Group>
              </Form.Item>
              <Card
                size="small"
                hoverable
                style={{ marginBottom: 16, background: '#fafafa', borderRadius: 6, cursor: 'pointer' }}
                styles={{ body: { padding: '8px 12px' } }}
                onClick={() => window.electronAPI?.openExternal(PRESET_PROVIDERS[provider].site)}
              >
                <Space>
                  <LinkOutlined />
                  <Text type="secondary">访问 {PRESET_PROVIDERS[provider].label} 官网</Text>
                </Space>
              </Card>
            </>
          )}

          <Form.Item label={<Text strong>API Endpoint</Text>} required>
            <Input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.example.com/v1"
            />
          </Form.Item>

          <Form.Item label={<Text strong>模型</Text>} required>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="模型名称"
            />
          </Form.Item>

          <Form.Item label={<Text strong>API Key</Text>} required>
            <Input.Password
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </Form.Item>

          <Form.Item label={<Text strong>预设名称</Text>}>
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="保存为预设，方便快速切换"
            />
          </Form.Item>

          <Space>
            <Button onClick={handleTest} loading={testing}>测试连接</Button>
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

          <Space>
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleSave} loading={saving}>
              保存
            </Button>
            <Button onClick={() => setModalOpen(false)}>取消</Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
