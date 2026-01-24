/**
 * API 厂商端点配置
 * @author Alan
 * @copyright AGCPA v3.0
 * @updated 2025-01-24 (清空 - SDK 直接处理 API 调用)
 * @Email alan@example.com
 *
 * ===== 已弃用 =====
 *
 * Claude Agent SDK 原生处理所有 API 调用，无需手动配置端点。
 * 此文件保留为空文件，以避免破坏导入。
 *
 * 厂商配置现在通过以下方式管理：
 * - ApiProvider 类型定义（在 constants.ts 中）
 * - getProviderDefaults() 函数（在 api-adapter.ts 中）
 * - PROVIDER_COMPATIBILITY 兼容性标记（在 constants.ts 中）
 */

import type { ApiProvider } from '../../config/constants.js';

/**
 * 厂商端点配置（已弃用，保留类型兼容性）
 */
export const VENDOR_ENDPOINTS: Partial<Record<ApiProvider, {
  /** Anthropic 兼容端点路径 */
  anthropic?: string;
  /** OpenAI 兼容端点路径 */
  openai?: string;
  /** 默认使用的端点类型 */
  default: 'anthropic' | 'openai';
}>> = {};

/**
 * 各厂商的 OpenAI 格式端点映射（已弃用）
 */
export const OPENAI_ENDPOINTS: Record<string, string> = {};

/**
 * 各厂商的 Anthropic 格式端点映射（已弃用）
 */
export const ANTHROPIC_ENDPOINTS: Record<string, string> = {};
