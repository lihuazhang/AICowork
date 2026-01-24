/**
 * 安全过滤器
 * 用于日志脱敏和输入验证
 */

/**
 * 敏感字段列表（用于日志脱敏）
 */
const SENSITIVE_FIELDS = [
  'apiKey',
  'api_key',
  'apikey',
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'session',
  'credit',
  'private',
];

/**
 * 危险工具黑名单
 */
export const FORBIDDEN_TOOLS = [
  'delete',
  'format',
  'exec',
  'eval',
  'system',
  'spawn',
];

/**
 * 允许的 URL 协议
 */
const ALLOWED_PROTOCOLS = ['https:', 'http:', 'mailto:', 'tel:'];

/**
 * URL 白名单（可选，用于额外限制）
 */
const ALLOWED_DOMAINS = [
  'anthropic.com',
  '*.anthropic.com',
  'github.com',
  'docs.qq.com',
];

/**
 * 类：安全过滤器
 */
export class SecuritySanitizer {
  /**
   * 验证 URL 是否安全
   * @param url - 要验证的 URL
   * @returns URL 是否安全
   */
  static sanitizeUrl(url: string): boolean {
    try {
      const parsed = new URL(url);

      // 检查协议
      if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        return false;
      }

      // 可选：检查域名白名单
      // if (ALLOWED_DOMAINS.length > 0) {
      //   const hostname = parsed.hostname.toLowerCase();
      //   const isAllowed = ALLOWED_DOMAINS.some(domain => {
      //     if (domain.startsWith('*.')) {
      //       return hostname.endsWith(domain.substring(2));
      //     }
      //     return hostname === domain;
      //   });
      //   if (!isAllowed) return false;
      // }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 对对象进行脱敏处理（用于日志记录）
   * @param obj - 要脱敏的对象
   * @returns 脱敏后的对象
   */
  static sanitizeForLogging<T = unknown>(obj: T): T {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => SecuritySanitizer.sanitizeForLogging(item)) as T;
    }

    const sanitized = { ...obj } as Record<string, unknown>;

    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();

      // 检查是否是敏感字段
      if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        // 递归处理嵌套对象
        sanitized[key] = SecuritySanitizer.sanitizeForLogging(sanitized[key]);
      }
    }

    return sanitized as T;
  }

  /**
   * 对字符串进行脱敏处理（用于日志记录）
   * @param str - 要脱敏的字符串
   * @returns 脱敏后的字符串
   */
  static sanitizeString(str: string): string {
    // 脱敏常见敏感信息模式
    return str
      .replace(/(apiKey|api_key|apikey|token|secret|authorization|password)[=:]\s*[^\s,}"]+/gi, '$1=[REDACTED]')
      .replace(/Bearer\s+[^\s,}"]+/gi, 'Bearer [REDACTED]')
      .replace(/sk-ant-[^\s,}"]+/gi, '[REDACTED]')
      .replace(/sk-[^\s,}"]+/gi, '[REDACTED]');
  }

  /**
   * 验证工具是否在白名单中
   * @param toolName - 工具名称
   * @returns 工具是否被允许
   */
  static isToolAllowed(toolName: string): boolean {
    return !FORBIDDEN_TOOLS.includes(toolName);
  }

  /**
   * 验证配置对象的安全性
   * @param config - 配置对象
   * @returns 验证结果
   */
  static validateConfig(config: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查是否包含危险工具
    if (config.allowedTools && Array.isArray(config.allowedTools)) {
      const forbiddenFound = config.allowedTools.filter(tool =>
        FORBIDDEN_TOOLS.includes(tool as string)
      );
      if (forbiddenFound.length > 0) {
        errors.push(`Forbidden tools in allowedTools: ${forbiddenFound.join(', ')}`);
      }
    }

    // 检查权限模式
    if (config.permissionMode === 'bypassPermissions') {
      // bypassPermissions 需要特别确认
      errors.push('bypassPermissions mode requires explicit user confirmation');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * 导出单例实例（便捷使用）
 */
export const sanitizer = SecuritySanitizer;
