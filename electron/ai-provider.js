/**
 * AI 模块
 * 兼容 OpenAI 格式的 API 客户端
 */
const https = require('https');
const http = require('http');

const PRESET_PROVIDERS = {
  deepseek: { endpoint: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
  minimax: { endpoint: 'https://api.minimax.chat/v1', model: 'Minimax-M3' },
  siliconflow: { endpoint: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
  agens: { endpoint: 'https://apihub.agnes-ai.com/v1/', model: 'agnes-2.0-flash' },
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
    // 统一去掉末尾斜杠，避免拼接 path 时出现双斜杠
    if (this.endpoint) {
      this.endpoint = this.endpoint.replace(/\/+$/, '');
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
   * 分析大文件列表，判断每个文件是否建议删除
   */
  async analyzeFiles(files) {
    if (!this.isConfigured()) {
      throw new Error('AI 未配置，请先在设置中配置 API Key');
    }

    const fileList = files
      .slice(0, 100)
      .map((f) => `- ${f.name} | 路径: ${f.path} | 大小: ${(f.size / 1048576).toFixed(1)}MB`)
      .join('\n');

    const systemPrompt = `你是一个 Windows C 盘清理助手。以下是用户 C 盘中的大文件列表，请逐一分析每个文件是什么类型的文件、可能的用途，并判断是否建议删除。请按以下 JSON 格式回复（不要包含其他内容）：

{
  "analysis": [
    {
      "name": "文件名",
      "type": "文件类型描述",
      "purpose": "可能的用途",
      "suggestDelete": true/false,
      "reason": "建议删除/保留的原因"
    }
  ]
}`;

    const response = await this._request('/chat/completions', {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请分析以下大文件：\n${fileList}` },
      ],
      max_tokens: 4000,
      temperature: 0.3,
    });
    const content = response.choices?.[0]?.message?.content || null;
    if (!content) {
      throw new Error('AI 返回内容为空，请检查 API 配置或重试');
    }

    // 尝试从内容中提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (!parsed.analysis || !Array.isArray(parsed.analysis)) {
          throw new Error('AI 返回格式异常：缺少 analysis 数组');
        }
        return parsed;
      } catch (err) {
        if (err instanceof SyntaxError) {
          throw new Error('AI 返回的 JSON 格式无法解析，请重试');
        }
        throw err;
      }
    }
    throw new Error('AI 响应中未找到有效的 JSON，请重试');
  }

  /**
   * 分析单个文件，使用更详细的元信息
   * @param {object} detail - 由 getFileDetail 返回的完整文件元信息
   */
  async analyzeSingleFile(detail) {
    if (!this.isConfigured()) {
      throw new Error('AI 未配置，请先在设置中配置 API Key');
    }

    const info = [
      `文件名: ${detail.name}`,
      `路径: ${detail.path}`,
      `目录: ${detail.dir}`,
      `扩展名: ${detail.ext}`,
      `大小: ${detail.sizeFormatted} (${detail.size} 字节)`,
      `创建时间: ${detail.created}`,
      `修改时间: ${detail.modified}`,
      `上次访问: ${detail.accessed}`,
      `安全评级: ${
        detail.safety === 'safe' ? '可安全删除' :
        detail.safety === 'caution' ? '谨慎删除' : '建议保留'
      }`,
    ].join('\n');

    const systemPrompt = `你是一个 Windows C 盘清理专家。用户提供了一个大文件的详细信息，你需要分析并给出是否建议删除的判断。

请从以下角度分析：
1. **文件类型** — 根据扩展名和路径判断是什么类型文件
2. **用途推测** — 根据文件名、路径、创建时间等推测它的用途
3. **安全性评估** — 是否为系统文件、是否可能被程序使用、删除风险高低
4. **清理建议** — 是否建议删除，并给出具体理由

请按以下 JSON 格式回复（不要包含其他内容）：

{
  "type": "文件类型",
  "purpose": "详细用途说明",
  "riskLevel": "low|medium|high",
  "suggestDelete": true/false,
  "reason": "建议删除或保留的详细理由",
  "alternativeAction": "如果建议删除，可以说明是否可以先移动到回收站等"
}`;

    const response = await this._request('/chat/completions', {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请分析以下文件：\n\n${info}` },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });
    const content = response.choices?.[0]?.message?.content || null;
    if (!content) {
      throw new Error('AI 返回内容为空，请检查 API 配置或重试');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.suggestDelete === undefined) {
          throw new Error('AI 返回格式异常：缺少 suggestDelete 字段');
        }
        return parsed;
      } catch (err) {
        if (err instanceof SyntaxError) {
          throw new Error('AI 返回的 JSON 格式无法解析，请重试');
        }
        throw err;
      }
    }
    throw new Error('AI 响应中未找到有效的 JSON，请重试');
  }

  /**
   * 批量分析大文件 — 一次性发送所有文件给 AI，返回每条的安全裁定
   * @param {Array<{name: string, path: string, size: number, safety: string}>} files
   * @returns {Promise<Array<{path: string, safety: string, reason: string}>>}
   */
  async analyzeLargeFiles(files) {
    if (!this.isConfigured()) {
      throw new Error('AI 未配置，请先在设置中配置 API Key');
    }

    // 构建文件列表文本
    const fileList = files.map((f, i) => {
      const ext = f.name.split('.').pop() || '(无后缀)';
      const sizeMB = (f.size / 1048576).toFixed(1);
      const levelText = f.safety === 'safe' ? '可安全删除' : f.safety === 'caution' ? '谨慎删除' : '建议保留';
      return `${i + 1}. [${ext}] ${f.path} | ${sizeMB}MB | 系统评级: ${levelText}`;
    }).join('\n');

    const systemPrompt = `你是一个 Windows 磁盘清理专家。用户提供了一批大文件信息，请逐条判断是否可以安全删除。

请从以下维度评估每个文件：
1. **文件类型与用途** — 根据扩展名、路径、文件名推测
2. **安全风险** — 是否为系统组件、正在被使用、删除后是否影响程序运行
3. **清理建议** — 明确给出 safe（可删）/ caution（谨慎）/ keep（建议保留）

回复严格按以下 JSON 格式（不要包含其他内容）：
{
  "results": [
    {"path": "完整路径", "safety": "safe/caution/keep", "reason": "判断理由"}
  ]
}`;

    const response = await this._request('/chat/completions', {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请分析以下 ${files.length} 个文件：\n\n${fileList}` },
      ],
      max_tokens: Math.min(files.length * 150, 16000),
      temperature: 0.3,
    });

    const content = response.choices?.[0]?.message?.content || null;
    if (!content) {
      throw new Error('AI 返回内容为空，请检查 API 配置或重试');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI 响应中未找到有效的 JSON，请重试');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.results || !Array.isArray(parsed.results)) {
        throw new Error('AI 返回格式异常：缺少 results 数组');
      }
      return parsed.results;
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error('AI 返回的 JSON 格式无法解析，请重试');
      }
      throw err;
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
            const parsed = JSON.parse(data);
            // 检查 HTTP 状态码，非 2xx 抛错
            if (res.statusCode < 200 || res.statusCode >= 300) {
              const errMsg = parsed?.error?.message || parsed?.error || `HTTP ${res.statusCode}`;
              return reject(new Error(`API 错误 (${res.statusCode}): ${errMsg}`));
            }
            resolve(parsed);
          } catch (err) {
            if (err instanceof SyntaxError) {
              reject(new Error(`解析响应失败: ${data.slice(0, 200)}`));
            } else {
              reject(err);
            }
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
