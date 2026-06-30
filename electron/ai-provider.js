/**
 * AI 模块
 * 兼容 OpenAI 格式的 API 客户端
 */
const https = require('https');
const http = require('http');

const PRESET_PROVIDERS = {
  deepseek: { endpoint: 'https://api.deepseek.com', model: 'deepseek-chat' },
  minimax: { endpoint: 'https://api.minimax.chat/v1', model: 'minimax-text-01' },
  siliconflow: { endpoint: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
};

class AIProvider {
  constructor(config = {}) {
    this.updateConfig(config);
  }

  updateConfig(config) {
    this.mode = config.mode || 'disabled';
    this.apiKey = config.apiKey || '';

    if (config.mode === 'preset' && config.provider) {
      const preset = PRESET_PROVIDERS[config.provider];
      if (preset) {
        this.endpoint = config.endpoint || preset.endpoint;
        this.model = config.model || preset.model;
      }
    } else if (config.mode === 'custom') {
      this.endpoint = config.endpoint || '';
      this.model = config.model || '';
    }
  }

  isConfigured() {
    return this.mode !== 'disabled' && !!this.apiKey && !!this.endpoint;
  }

  /**
   * 测试 API 连接
   */
  async testConnection() {
    if (!this.apiKey || !this.endpoint) {
      return { success: false, message: '请完善 API 配置' };
    }
    try {
      const response = await this._request('/chat/completions', {
        model: this.model || 'default',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      });
      if (response && response.choices) {
        return { success: true, message: '连接成功！' };
      }
      return { success: false, message: '响应格式异常' };
    } catch (err) {
      return { success: false, message: `连接失败: ${err.message}` };
    }
  }

  /**
   * 获取 AI 清理建议
   */
  async getSuggestion(scanSummary) {
    if (!this.isConfigured()) return null;

    const systemPrompt = `你是一个 Windows C 盘清理助手。以下是扫描结果摘要，请分析哪些可以安全清理，给出建议。请用中文回答，简洁明了。`;

    try {
      const response = await this._request('/chat/completions', {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `扫描结果摘要：\n${scanSummary}\n\n请给出清理建议。` },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      });
      return response.choices?.[0]?.message?.content || null;
    } catch {
      return null;
    }
  }

  /**
   * 多轮对话
   */
  async chat(messages) {
    if (!this.isConfigured()) {
      return 'AI 未配置，请先在设置中配置 API Key。';
    }

    try {
      const response = await this._request('/chat/completions', {
        model: this.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: 2000,
        temperature: 0.7,
      });
      return response.choices?.[0]?.message?.content || '抱歉，AI 返回为空。';
    } catch (err) {
      return `AI 响应失败: ${err.message}`;
    }
  }

  /**
   * 发送 HTTP 请求到 OpenAI 兼容 API
   */
  _request(path, body) {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(this.endpoint + path);
        const isHttps = url.protocol === 'https:';
        const transport = isHttps ? https : http;

        const options = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 30000,
        };

      const req = transport.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`解析响应失败: ${data.slice(0, 200)}`));
          }
        });
      });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('请求超时'));
        });

        req.write(JSON.stringify(body));
        req.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = { AIProvider, PRESET_PROVIDERS };
