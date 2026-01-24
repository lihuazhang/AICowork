/**
 * 应用基础错误类
 * 所有自定义错误的基类
 */

/**
 * 应用错误基类
 */
export class AppError extends Error {
  /** 错误代码 */
  readonly code: string;

  /** HTTP 状态码（用于 API 错误） */
  readonly statusCode?: number;

  /** 原始错误（用于包装其他错误） */
  readonly cause?: Error;

  constructor(
    message: string,
    code: string = "APP_ERROR",
    statusCode?: number,
    cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;

    // 维护正确的堆栈跟踪（仅在 V8 中）
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * 转换为 JSON 可序列化对象
   */
  toJSON(): { message: string; code: string; statusCode?: number } {
    return {
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
    };
  }
}
