/**
 * 后端常量配置
 * 统一管理文件大小、超时、轮询间隔等常量
 */

// 重新导出删除检测模式（从共享模块）
export { DELETION_PATTERNS } from "../../shared/deletion-detection.js";

// ==================== 文件大小限制 ====================

/** 日志文件最大大小（5MB） */
export const MAX_LOG_FILE_SIZE = 5242880;

/** 最大保留日志文件数量 */
export const MAX_LOG_FILES = 5;

// ==================== 轮询和超时 ====================

/** 资源轮询间隔（2秒） */
export const RESOURCE_POLL_INTERVAL = 2000;

/** 默认会话超时时间（5分钟） */
export const DEFAULT_SESSION_TIMEOUT = 300000;

/** Runner 超时时间（5分钟） */
export const RUNNER_TIMEOUT = 300000;

/** 默认工作目录限制 */
export const DEFAULT_CWD_LIMIT = 8;

// ==================== API 验证 ====================

/** API Key 最小长度 */
export const API_KEY_MIN_LENGTH = 20;

/** API Key 最大长度 */
export const API_KEY_MAX_LENGTH = 200;

/** Model 名称最小长度 */
export const MODEL_NAME_MIN_LENGTH = 3;

/** Model 名称最大长度 */
export const MODEL_NAME_MAX_LENGTH = 100;

/** 基础 URL 最小长度 */
export const BASE_URL_MIN_LENGTH = 10;

/** 基础 URL 最大长度 */
export const BASE_URL_MAX_LENGTH = 500;

// ==================== 日志级别 ====================

/** 日志级别枚举 */
export const LOG_LEVELS = {
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  DEBUG: "debug",
} as const;

/** 日志级别类型 */
export type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

// ==================== 会话状态 ====================

/** 会话状态枚举 */
export const SESSION_STATUS = {
  IDLE: "idle",
  RUNNING: "running",
  COMPLETED: "completed",
  ERROR: "error",
} as const;

/** 会话状态类型 */
export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

// ==================== API 厂商映射 ====================

/**
 * API 厂商类型定义
 * 只包含与 Anthropic SDK 原生兼容的厂商
 *
 * @author Alan
 * @updated 2025-01-24 (精简为只保留兼容厂商)
 */
export type ApiProvider =
  // Anthropic 官方
  | 'anthropic'        // Anthropic (Claude) - 官方
  // 国内厂商 - Anthropic 兼容格式（推荐）
  | 'zhipu'            // 智谱 AI (GLM)
  | 'deepseek'         // DeepSeek
  | 'alibaba'          // 阿里云 (通义千问)
  | 'qiniu'            // 七牛云 AI
  | 'moonshot'         // 月之暗面 (Kimi)
  | 'n1n'              // N1N.AI
  | 'minimax'          // MiniMax
  // 自定义（用户自行负责兼容性）
  | 'custom';          // 自定义 Anthropic 兼容 API

/**
 * 厂商兼容性标记
 * 标识哪些厂商与 Anthropic SDK 原生兼容
 *
 * 所有保留的厂商都与 SDK 原生兼容
 *
 * @author Alan
 * @updated 2025-01-24 (精简为只保留兼容厂商)
 */
export const PROVIDER_COMPATIBILITY: Record<ApiProvider, {
  /** API 格式类型 */
  format: 'anthropic';
  /** 是否推荐使用 */
  recommended: true;
  /** 备注说明 */
  note?: string;
}> = {
  // Anthropic 官方
  anthropic: { format: 'anthropic', recommended: true },

  // 国内厂商 - Anthropic 兼容格式（推荐）
  zhipu: { format: 'anthropic', recommended: true, note: '智谱 AI Anthropic 兼容端点' },
  deepseek: { format: 'anthropic', recommended: true, note: 'DeepSeek Anthropic 兼容端点' },
  alibaba: { format: 'anthropic', recommended: true, note: '阿里云百炼 Anthropic 兼容端点' },
  qiniu: { format: 'anthropic', recommended: true, note: '七牛云 AI Anthropic 兼容端点' },
  moonshot: { format: 'anthropic', recommended: true, note: '月之暗面 Anthropic 兼容端点' },
  minimax: { format: 'anthropic', recommended: true, note: 'MiniMax Anthropic 兼容端点' },
  n1n: { format: 'anthropic', recommended: true, note: 'N1N.AI Anthropic 兼容端点' },

  // 自定义（用户自行负责兼容性）
  custom: { format: 'anthropic', recommended: true, note: '自定义 Anthropic 兼容端点' },
};

/**
 * 获取推荐的厂商列表
 * 用于 UI 优先显示
 */
export function getRecommendedProviders(): ApiProvider[] {
  return Object.keys(PROVIDER_COMPATIBILITY) as ApiProvider[];
}
