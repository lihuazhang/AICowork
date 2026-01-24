/**
 * 错误处理器
 * 统一的错误处理和日志记录
 */

import { log } from "../logger.js";
import type { AppError } from "./app-error.js";

/**
 * 错误日志级别
 */
type ErrorLogLevel = "error" | "warn" | "info" | "debug";

/**
 * 错误处理器选项
 */
export interface ErrorHandlerOptions {
  /** 是否记录堆栈跟踪 */
  includeStackTrace?: boolean;
  /** 是否记录原因错误 */
  includeCause?: boolean;
  /** 自定义上下文信息 */
  context?: Record<string, unknown>;
}

/**
 * 处理并记录错误
 */
export function handleError(
  error: Error | AppError | unknown,
  options: ErrorHandlerOptions = {}
): void {
  const {
    includeStackTrace = true,
    includeCause = true,
    context = {},
  } = options;

  // 确定日志级别
  const level = getErrorLogLevel(error);

  // 构建日志消息
  const logMessage = buildLogMessage(error, context);

  // 记录错误
  if (level === "error") {
    log.error(logMessage, includeStackTrace ? error : undefined);
  } else if (level === "warn") {
    log.warn(logMessage, includeStackTrace ? error : undefined);
  } else if (level === "info") {
    log.info(logMessage);
  } else {
    log.debug(logMessage);
  }

  // 记录原因错误
  if (includeCause && error instanceof Error && error.cause) {
    log.error("[Cause]", error.cause);
  }
}

/**
 * 获取错误日志级别
 */
function getErrorLogLevel(error: unknown): ErrorLogLevel {
  if (error instanceof Error) {
    // 根据错误名称或代码确定级别
    if (error.name.includes("Warning") || error.message.includes("deprecated")) {
      return "warn";
    }
  }
  return "error";
}

/**
 * 构建日志消息
 */
function buildLogMessage(
  error: unknown,
  context: Record<string, unknown>
): string {
  let message = "";

  // 添加错误类型
  if (error instanceof Error) {
    message += `[${error.name}]`;
  }

  // 添加错误消息
  if (error instanceof Error) {
    message += ` ${error.message}`;
  } else {
    message += ` ${String(error)}`;
  }

  // 添加错误代码（如果是 AppError）
  if (error && typeof error === "object" && "code" in error) {
    message += ` (code: ${error.code})`;
  }

  // 添加上下文信息
  const contextStr = Object.entries(context)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(", ");
  if (contextStr) {
    message += ` [${contextStr}]`;
  }

  return message;
}

/**
 * 将错误转换为 IPC 友好的格式
 */
export function errorToIPCResponse(error: unknown): {
  success: false;
  error: string;
  code?: string;
} {
  if (error instanceof Error) {
    return {
      success: false,
      error: error.message,
      code: "code" in error ? String(error.code) : undefined,
    };
  }
  return {
    success: false,
    error: String(error),
  };
}
