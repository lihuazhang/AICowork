/**
 * 应用服务初始化器
 * 在应用启动时预加载关键资源
 */

import { log } from '../logger.js';

/**
 * 初始化所有应用服务（在应用启动时执行）
 * 在后台异步执行，不阻塞窗口显示
 */
export async function initializeAppServices(): Promise<void> {
  log.info('[AppInit] Initializing app services...');
  const startTime = Date.now();

  // 并行初始化各项服务（使用 Promise.allSettled 确保稳定）
  const results = await Promise.allSettled([
    initializeSdkConfigCache(),
    prewarmMcpServers(),
  ]);

  // 记录初始化结果
  results.forEach((result, index) => {
    const serviceName = ['SDK Config Cache', 'MCP Servers'][index];
    if (result.status === 'fulfilled') {
      log.info(`[AppInit] ✓ ${serviceName} initialized`);
    } else {
      log.warn(`[AppInit] ✗ ${serviceName} initialization failed:`, result.reason);
    }
  });

  const duration = Date.now() - startTime;
  log.info(`[AppInit] ✓ Services initialized in ${duration}ms`);
}

/**
 * 初始化 SDK 配置缓存
 */
async function initializeSdkConfigCache(): Promise<void> {
  try {
    const { initializeConfigCache } = await import('../managers/sdk-config-cache.js');
    await initializeConfigCache();
    log.info('[AppInit] SDK config cache initialized');
  } catch (error) {
    log.warn('[AppInit] SDK config cache initialization failed (non-critical):', error);
  }
}

/**
 * 预热 MCP 服务器
 * 注意：MCP 服务器实例管理由 SDK 处理，无需预热
 * 此函数仅用于验证 MCP 配置可正常加载
 */
async function prewarmMcpServers(): Promise<void> {
  try {
    const { getMcpServers } = await import('../managers/mcp-server-manager.js');
    const servers = await getMcpServers();

    log.info(`[AppInit] MCP configs loaded: ${Object.keys(servers).length} servers`);
  } catch (error) {
    log.warn('[AppInit] MCP config loading failed (non-critical):', error);
  }
}
