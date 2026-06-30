import { useState, useRef, useEffect } from 'react';
import { Card, Button, Input, Typography, Space, Alert, Spin, message, Row } from 'antd';
import { RobotOutlined, SendOutlined, SettingOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'system',
      content:
        '你好！我是C盘清理助手。你可以问我关于C盘清理的问题，比如"微信缓存能清吗？"、"临时文件有什么用？"。建议先进行一次扫描，我可以基于扫描结果给出更精准的建议。',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [scanData, setScanData] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check AI config and load scan data
  useEffect(() => {
    (async () => {
      if (!window.electronAPI) return;
      try {
        const config = await window.electronAPI.getAIConfig();
        setAiConfigured(config.mode !== 'disabled' && !!config.apiKey);
      } catch {
        setAiConfigured(false);
      }
    })();
  }, []);

  const handleScanFirst = async () => {
    if (!window.electronAPI) return;
    try {
      const result = await window.electronAPI.startScan();
      const summary = `C盘扫描结果：共发现 ${result.totalSize} 字节（${(result.totalSize / 1073741824).toFixed(2)} GB）可清理空间，${result.items.length} 个项目。`;
      setScanData(summary);
      message.info('扫描完成，已获取C盘数据，可以开始提问了！');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `已扫描完成！${summary}\n\n你可以问具体的问题，比如「微信缓存能清多少？」「临时文件安全吗？」`,
        },
      ]);
    } catch {
      message.error('扫描失败');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !window.electronAPI) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Build context from scan data
      const contextMessages: ChatMessage[] = scanData
        ? [
            {
              role: 'system',
              content: `你是C盘清理助手。用户已扫描C盘，以下是扫描结果作为参考：\n${scanData}\n请据此给出具体建议。如果问题与扫描结果无关，正常回答即可。`,
            },
          ]
        : [
            {
              role: 'system',
              content:
                '你是C盘清理助手，帮助用户理解C盘文件、判断哪些可以安全清理。回答简洁、易懂。',
            },
          ];

      const allMessages = [...contextMessages, ...messages.filter((m) => m.role !== 'system'), userMsg];
      const response = await window.electronAPI.sendAIMessage(
        allMessages.map((m) => ({ role: m.role, content: m.content }))
      );
      setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '抱歉，AI 响应失败。请检查 AI 配置是否正确，或稍后重试。',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Space>
          <RobotOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>
            AI 助手
          </Title>
        </Space>
        <Space>
          {!aiConfigured && (
            <Alert
              type="warning"
              message="未配置 AI"
              description="设置 API Key 以获得 AI 建议"
              showIcon
              style={{ padding: '4px 12px' }}
              action={
                <Button size="small" type="link">
                  去配置
                </Button>
              }
            />
          )}
        </Space>
      </Row>

      <Card
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 16 } }}
      >
        {/* Chat area */}
        <div style={{ flex: 1, overflow: 'auto', marginBottom: 16 }}>
          {messages
            .filter((m) => m.role !== 'system')
            .map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  marginBottom: 12,
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: msg.role === 'user' ? '#1677ff' : '#f0f0f0',
                    color: msg.role === 'user' ? '#fff' : '#000',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          {loading && (
            <div style={{ display: 'flex', marginBottom: 12 }}>
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: '#f0f0f0',
                }}
              >
                <Spin size="small" /> 思考中...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div>
          {!scanData && !loading && (
            <div style={{ marginBottom: 8 }}>
              <Button size="small" onClick={handleScanFirst}>
                先扫描C盘获取数据
              </Button>
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                扫描后可获得更精准的建议
              </Text>
            </div>
          )}
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入你想了解的问题..."
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
              disabled={loading}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={loading}
              disabled={!input.trim()}
            >
              发送
            </Button>
          </Space.Compact>
        </div>
      </Card>
    </div>
  );
}
