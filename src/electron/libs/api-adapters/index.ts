/**
 * API 配置模块索引
 * @author Alan
 * @copyright AGCPA v3.0
 * @created 2025-01-24
 * @Email alan@example.com
 *
 * 只提供配置类型和 UI 工具函数，API 格式转换由 SDK 处理
 */

// 类型定义（用于配置）
export type {
  ApiConfig,
  ApiFormat,
  UrlFormatDetection,
  AnthropicMessage,
  AnthropicContentBlock,
  AnthropicRequest,
  AnthropicResponse,
} from './types.js';

// 常量（用于 UI 显示）
export { VENDOR_ENDPOINTS, OPENAI_ENDPOINTS, ANTHROPIC_ENDPOINTS } from './constants.js';

// UI 工具函数
export {
  detectApiFormat,
  getAnthropicFormatUrl,
  getAllPresetUrls,
} from './utils.js';
