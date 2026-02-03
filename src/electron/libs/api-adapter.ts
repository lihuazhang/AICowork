/**
 * API 配置模块
 * @author Alan
 * @copyright AGCPA v3.0
 * @created 2025-01-24
 * @Email alan@example.com
 *
 * 只提供配置数据，API 格式转换由 SDK 处理
 */

import type { ApiProvider } from '../config/constants.js';

// 重新导出 ApiProvider 类型
export type { ApiProvider } from '../config/constants.js';

// 重新导出 UI 配置工具函数
export {
  detectApiFormat,
  getAnthropicFormatUrl,
  getAllPresetUrls,
} from './api-adapters/utils.js';

/**
 * 厂商默认配置缓存
 * 用于 UI 配置界面，避免重复创建
 */
const providerDefaultsCache = new Map<ApiProvider, {
  baseURL: string;
  models: string[];
  defaultModel: string;
}>();

/**
 * 推荐的厂商（Anthropic 原生格式）
 * 所有厂商都与 Claude Agent SDK 原生兼容
 */
const RECOMMENDED_PROVIDERS: Set<ApiProvider> = new Set([
  'anthropic', 'zhipu', 'deepseek', 'minimax', 'xita', 'idealab', 'custom'
]);

/**
 * 厂商默认配置
 * 所有厂商都与 SDK 原生兼容
 */
const PROVIDER_DEFAULTS: Record<ApiProvider, { baseURL: string; models: string[]; defaultModel: string }> = {
  // Anthropic 官方
  anthropic: {
    baseURL: 'https://api.anthropic.com',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
    defaultModel: 'claude-sonnet-4-20250514',
  },
  // 国内厂商 - Anthropic 兼容格式
  zhipu: {
    baseURL: 'https://open.bigmodel.cn/api/anthropic',
    models: ['glm-4', 'glm-4-flash', 'glm-3-turbo'],
    defaultModel: 'glm-4',
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
  },
  minimax: {
    baseURL: 'https://api.minimaxi.com/anthropic',
    models: ['MiniMax-M2.1', 'MiniMax-M2.1-lightning', 'MiniMax-M2'],
    defaultModel: 'MiniMax-M2.1',
  },
  xita: {
    baseURL: 'https://antchat.alipay.com',
    models: ['DeepSeek-R1', 'DeepSeek-V3', 'claude-sonnet-4-20250514', 'gpt-4o'],
    defaultModel: 'DeepSeek-R1',
  },
  idealab: {
    baseURL: 'https://idealab.alibaba-inc.com/api/openai/v1/chat/completions',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o',
  },
  // 自定义
  custom: {
    baseURL: 'https://api.example.com',
    models: ['custom-model'],
    defaultModel: 'custom-model',
  },
};

/**
 * 获取厂商默认配置（使用缓存）
 *
 * 注意：API 格式转换由 SDK 自动处理
 * 此函数仅用于 UI 配置界面显示默认值
 */
export function getProviderDefaults(provider: ApiProvider): {
  baseURL: string;
  models: string[];
  defaultModel: string;
} {
  // 检查缓存
  const cachedDefaults = providerDefaultsCache.get(provider);
  if (cachedDefaults) {
    return cachedDefaults;
  }

  const result = PROVIDER_DEFAULTS[provider];

  // 缓存结果
  providerDefaultsCache.set(provider, result);
  return result;
}

/**
 * 检查厂商是否被推荐
 * 所有保留的厂商都是推荐的
 */
export function isProviderRecommended(provider: ApiProvider): boolean {
  return RECOMMENDED_PROVIDERS.has(provider);
}
