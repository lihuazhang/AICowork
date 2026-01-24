/**
 * 记忆管理模块
 * @author Alan
 * @copyright AGCPA v3.0
 * @created 2025-01-24
 * @Email alan@example.com
 *
 * 只负责配置管理，具体记忆功能由 SDK 通过 MCP 处理
 */

import type { MemoryConfig } from "./types.js";

// 缓存配置以避免频繁读取文件
let cachedConfig: Partial<MemoryConfig> | null = null;

/**
 * 获取记忆工具配置（同步版本）
 *
 * 注意：记忆功能的具体实现由 SDK 通过 MCP 服务器处理
 * 应用层只负责配置的存储和读取
 *
 * 此函数返回缓存的配置或默认配置，不会阻塞
 */
export function getMemoryToolConfig(): Partial<MemoryConfig> {
  // 如果有缓存，直接返回
  if (cachedConfig) {
    return cachedConfig;
  }

  // 返回默认配置
  return {
    enabled: false,
    autoStore: false,
  };
}

/**
 * 异步加载记忆配置
 * 在应用启动时调用以预热缓存
 */
export async function loadMemoryToolConfig(): Promise<void> {
  try {
    const { getMemoryConfig } = await import("../../utils/memory-config.js");
    const result = await getMemoryConfig();
    if (result.success && result.config) {
      cachedConfig = result.config;
    }
  } catch (error) {
    // 保持默认配置
    console.error('[memory-manager] Failed to load memory config:', error);
  }
}

/**
 * 注意：不再提供记忆指南提示
 *
 * SDK 会通过 MCP 服务器提供记忆工具，AI 会自然发现并使用这些工具
 * 遵循"按需加载、渐进式加载"的设计理念，不在系统提示中预先注入工具说明
 */

/**
 * 清除记忆指南缓存
 * （保留此函数以兼容现有代码，但现在只是空操作）
 */
export function clearMemoryGuidanceCache(): void {
  // 不再需要缓存，SDK 直接处理
  cachedConfig = null;
}

/**
 * 触发自动记忆分析
 *
 * 注意：此功能现在由 SDK 的记忆工具自动处理
 * 应用层不再需要单独实现自动分析逻辑
 */
export async function triggerAutoMemoryAnalysis(
  _session: unknown,
  _prompt: string,
  _memConfig: MemoryConfig,
  _onEvent: (event: unknown) => void
): Promise<void> {
  const { log } = await import("../../logger.js");

  // 此功能已由 SDK 处理，只记录日志
  log.debug('[Memory] Auto-analysis handled by SDK MCP tools');

  // 如果配置启用了自动存储，SDK 会自动处理
  // 应用层不再需要额外调用 API 进行分析
}
