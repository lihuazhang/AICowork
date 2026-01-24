import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { loadApiConfig, saveApiConfig, type ApiConfig } from "../storage/config-store.js";
import { app } from "electron";
import { log } from "../logger.js";

/**
 * API 配置缓存
 * 避免频繁读取配置文件
 */
let apiConfigCache: ApiConfig | null = null;
let apiConfigCacheTimestamp: number = 0;
const API_CONFIG_CACHE_TTL = 60000; // 60秒缓存（性能优化）

/**
 * Claude SDK 路径缓存
 * 避免重复计算路径
 */
let claudeCodePathCache: string | null = null;

/**
 * 获取 AI Agent SDK CLI 路径（带缓存）
 *
 * 重要说明：
 * 1. SDK 的 CLI 路径是可选的，仅用于特定场景
 * 2. 如果 CLI 不存在，SDK 可以继续正常工作
 * 3. 使用 fork() 会自动使用当前 Node.js 进程（Electron 内置的）
 *
 * @returns CLI 脚本的完整路径，如果不存在则返回 undefined
 */
export function getClaudeCodePath(): string | undefined {
  // 检查缓存
  if (claudeCodePathCache !== null) {
    return claudeCodePathCache || undefined;
  }

  let cliPath: string;

  if (app.isPackaged) {
    // 生产环境：使用 app.asar.unpacked 中的解包模块
    cliPath = join(
      process.resourcesPath,
      'app.asar.unpacked/node_modules/@anthropic-ai/claude-agent-sdk/cli.js'
    );

    // 验证文件存在
    if (!existsSync(cliPath)) {
      log.warn(`[claude-settings] CLI not found at: ${cliPath}`);
      log.warn(`[claude-settings] SDK will continue without CLI path`);
      // 缓存 null 以表示 CLI 不存在
      claudeCodePathCache = null;
      return undefined;
    }

    log.debug(`[claude-settings] Using packaged CLI: ${cliPath}`);
  } else {
    // 开发环境：使用 node_modules 中的 CLI
    cliPath = join(process.cwd(), 'node_modules/@anthropic-ai/claude-agent-sdk/cli.js');

    if (!existsSync(cliPath)) {
      log.warn(`[claude-settings] CLI not found at: ${cliPath}`);
      log.warn(`[claude-settings] Current directory: ${process.cwd()}`);
      // 缓存 null 以表示 CLI 不存在
      claudeCodePathCache = null;
      return undefined;
    }

    log.debug(`[claude-settings] Using dev CLI: ${cliPath}`);
  }

  // 缓存结果
  claudeCodePathCache = cliPath;
  return cliPath;
}

/**
 * 清除 API 配置缓存
 * 在配置更改时调用
 */
export function clearApiConfigCache(): void {
  apiConfigCache = null;
  apiConfigCacheTimestamp = 0;
  claudeCodePathCache = null;
  log.debug('[claude-settings] API 配置缓存已清除');

  // 同时清除 SDK 配置缓存（包含 API 配置）
  import("../managers/sdk-config-cache.js").then(module => {
    module.clearConfigCache().catch((error) => {
      log.warn('[claude-settings] Failed to clear SDK config cache:', error);
    });
  }).catch((error) => {
    log.warn('[claude-settings] Failed to import SDK config cache:', error);
  });
}

// 获取当前有效的配置（优先界面配置，然后是环境变量，最后回退到文件配置）
export function getCurrentApiConfig(): ApiConfig | null {
  // 检查缓存（5秒内有效）
  const now = Date.now();
  if (apiConfigCache && (now - apiConfigCacheTimestamp) < API_CONFIG_CACHE_TTL) {
    return apiConfigCache;
  }

  // 1. 优先检查 api-config.json
  const uiConfig = loadApiConfig();
  if (uiConfig) {
    log.debug("[claude-settings] Using UI config from api-config.json:", {
      baseURL: uiConfig.baseURL,
      model: uiConfig.model,
      apiType: uiConfig.apiType
    });
    // 更新缓存
    apiConfigCache = uiConfig;
    apiConfigCacheTimestamp = now;
    return uiConfig;
  }

  // 2. 检查 process.env（从 .env 文件加载的环境变量）
  const envAuthToken = process.env.ANTHROPIC_AUTH_TOKEN;
  const envBaseURL = process.env.ANTHROPIC_BASE_URL;
  const envModel = process.env.ANTHROPIC_MODEL;
  const envApiType = process.env.ANTHROPIC_API_TYPE;

  if (envAuthToken && envBaseURL && envModel) {
    log.debug("[claude-settings] Using config from process.env (.env file):", {
      baseURL: envBaseURL,
      model: envModel,
      apiType: envApiType
    });
    const config: ApiConfig = {
      id: 'env',
      name: '环境变量配置',
      apiKey: String(envAuthToken),
      baseURL: String(envBaseURL),
      model: String(envModel),
      apiType: (envApiType as any) || "anthropic"
    };
    // 持久化到 api-config.json 以便下次快速加载
    try {
      saveApiConfig(config);
      log.debug("[claude-settings] Persisted env config to api-config.json");
    } catch (e) {
      log.error("[claude-settings] Failed to persist config:", e);
    }
    // 更新缓存
    apiConfigCache = config;
    apiConfigCacheTimestamp = now;
    return config;
  }

  // 3. 回退到 ~/.claude/settings.json
  try {
    const settingsPath = join(homedir(), ".claude", "settings.json");
    const raw = readFileSync(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as { env?: Record<string, unknown> };
    if (parsed.env) {
      const authToken = parsed.env.ANTHROPIC_AUTH_TOKEN;
      const baseURL = parsed.env.ANTHROPIC_BASE_URL;
      const model = parsed.env.ANTHROPIC_MODEL;

      if (authToken && baseURL && model) {
        log.debug("[claude-settings] Using file config from ~/.claude/settings.json");
        const config: ApiConfig = {
          id: 'claude-settings',
          name: 'Claude Settings 配置',
          apiKey: String(authToken),
          baseURL: String(baseURL),
          model: String(model),
          apiType: "anthropic"
        };
        // 持久化到 api-config.json
        try {
          saveApiConfig(config);
          log.debug("[claude-settings] Persisted config to api-config.json");
        } catch (e) {
          log.error("[claude-settings] Failed to persist config:", e);
        }
        // 更新缓存
        apiConfigCache = config;
        apiConfigCacheTimestamp = now;
        return config;
      }
    }
  } catch {
    // Ignore missing or invalid settings file.
  }

  log.debug("[claude-settings] No config found");
  return null;
}

export function buildEnvForConfig(config: ApiConfig): Record<string, string> {
  const baseEnv = { ...process.env } as Record<string, string>;

  baseEnv.ANTHROPIC_AUTH_TOKEN = config.apiKey;

  // 保留原始 baseURL，不做路径清理
  // 适配器会根据 apiType 自动处理路径前缀
  baseEnv.ANTHROPIC_BASE_URL = config.baseURL;
  baseEnv.ANTHROPIC_MODEL = config.model;

  // 设置 Claude 配置目录路径，确保 SDK 能找到 MCP 配置
  const claudeConfigDir = join(homedir(), '.claude');
  baseEnv.CLAUDE_CONFIG_DIR = claudeConfigDir;

  log.info(`[claude-settings] CLAUDE_CONFIG_DIR set to: ${claudeConfigDir}`);

  return baseEnv;
}

// ===== 代理功能已移除，改为直连模式 =====
