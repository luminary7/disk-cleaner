/**
 * AI 提供商共享配置
 *
 * 渲染进程的权威数据源，所有前端页面从此 import。
 * 主进程（electron/ai-provider.js）保留自身副本。
 */

export type PresetProvider = 'deepseek' | 'minimax' | 'siliconflow' | 'agens';

export interface ProviderConfig {
  endpoint: string;
  model: string;
  label: string;
}

export const PRESET_PROVIDERS: Record<PresetProvider, ProviderConfig> = {
  deepseek: { endpoint: 'https://api.deepseek.com', model: 'deepseek-v4-flash', label: 'DeepSeek' },
  minimax: { endpoint: 'https://api.minimax.chat/v1', model: 'Minimax-M3', label: 'MiniMax' },
  siliconflow: { endpoint: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct', label: '硅基流动' },
  agens: { endpoint: 'https://apihub.agnes-ai.com/v1/', model: 'agnes-2.0-flash', label: 'Agnes AI' },
};

export const AGENS_LINKS = {
  site: 'https://agnes-ai.com/',
  docs: 'https://agnes-ai.com/zh-Hans/docs/agnes-20-flash',
};
