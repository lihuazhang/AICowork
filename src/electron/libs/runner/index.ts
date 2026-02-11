/**
 * Runner 模块主入口
 * 负责协调 Claude SDK 会话的执行
 */

import { query, type SDKMessage, type SDKUserMessage } from "@qwen-code/sdk";
import type { RunnerOptions, RunnerHandle } from "./types.js";
import { UserInputQueue } from "../user-input-queue.js";

import {
  buildEnvForConfig,
  getQwenCodePath
} from "../../services/qwen-settings.js";
import { getCachedApiConfig } from "../../managers/sdk-config-cache.js";
import { getEnhancedEnv } from "../../utils/util.js";
import { addLanguagePreference } from "../../utils/language-detector.js";
import { getAILanguagePreference } from "../../services/language-preference-store.js";

import { PerformanceMonitor } from "./performance-monitor.js";
import { createPermissionHandler, handleToolUseEvent, mapPermissionMode } from "./permission-handler.js";
import { clearMcpServerCache } from "../../managers/mcp-server-manager.js";

const DEFAULT_CWD = process.cwd();

// ========== 历史消息处理 ==========

/**
 * 创建持久的对话流生成器
 * 这个 generator 会一直运行，持续从队列中读取用户输入并 yield
 * SDK 会自动通过 session_id 维护对话历史
 * 
 * 参考：https://github.com/QwenLM/qwen-code-examples/blob/main/sdk/demo/cli-chatbot.ts
 * 
 * @param inputQueue - 用户输入队列
 * @param sdkSessionId - SDK 会话 ID
 * @param initialPrompt - 第一个用户输入
 * @returns AsyncIterable<SDKUserMessage> 格式的消息流
 */
async function* createConversationStream(
  inputQueue: any,
  sdkSessionId: string,
  initialPrompt: string
): AsyncIterable<SDKUserMessage> {
  const { log } = await import("../../logger.js");
  
  // ✅ 先 yield 第一个消息
  log.info(`[Runner] Yielding initial prompt for session ${sdkSessionId}`);
  yield {
    type: 'user',
    uuid: crypto.randomUUID(),
    session_id: sdkSessionId,
    message: {
      role: 'user',
      content: initialPrompt
    },
    parent_tool_use_id: null
  };

  // ✅ 持续等待后续的用户输入
  while (true) {
    log.info(`[Runner] Waiting for next user input for session ${sdkSessionId}`);
    const nextPrompt = await inputQueue.getNextInput();
    
    if (nextPrompt === null) {
      log.info(`[Runner] Input queue closed for session ${sdkSessionId}`);
      break;
    }
    
    log.info(`[Runner] Yielding next prompt for session ${sdkSessionId}`);
    yield {
      type: 'user',
      uuid: crypto.randomUUID(),
      session_id: sdkSessionId,
      message: {
        role: 'user',
        content: nextPrompt
      },
      parent_tool_use_id: null
    };
  }
}

// ========== 全局缓存 - 跨会话复用 ==========

/**
 * 清除全局缓存（在配置更改时调用）
 * 注意：这会关闭所有缓存的 MCP 服务器
 */
export function clearRunnerCache(): void {
  // 使用 MCP 服务器管理器清除缓存
  clearMcpServerCache();

  // 注意：记忆配置缓存不再需要清除
  // SDK 通过 Memory MCP 自动处理记忆功能
  // 清除配置缓存会导致记忆功能意外返回默认禁用状态
}

// 重新导出类型
export type { RunnerOptions, RunnerHandle } from "./types.js";
export { PerformanceMonitor } from "./performance-monitor.js";

/**
 * 执行 Claude SDK 会话
 *
 * @param options - 运行选项
 * @returns 可中止的运行句柄
 */
export async function runClaude(options: RunnerOptions): Promise<RunnerHandle> {
  const { prompt, session, resumeSessionId, onEvent, onSessionUpdate } = options;
  const abortController = new AbortController();
  
  // ✅ 在函数顶层创建 inputQueue，确保 return 语句可以访问
  const inputQueue = new UserInputQueue();

  // 开始性能监控
  const perfMonitor = new PerformanceMonitor();
  perfMonitor.start();

  // 在函数开始就导入 logger，确保日志可用
  const { log } = await import("../../logger.js");
  log.info(`[Runner] Starting Claude query for session ${session.id}`, { promptLength: prompt.length });

  const sendMessage = (message: SDKMessage) => {
    onEvent({
      type: "stream.message",
      payload: { sessionId: session.id, message }
    });
  };

  const sendPermissionRequest = (toolUseId: string, toolName: string, input: unknown) => {
    onEvent({
      type: "permission.request",
      payload: { sessionId: session.id, toolUseId, toolName, input }
    });
  };

  // Start the query in the background
  (async () => {
    // 在 try 块外部声明变量，便于 catch 块访问
    let config: Awaited<ReturnType<typeof getCachedApiConfig>> = null;
    let claudeCodePath: string | undefined = undefined;

    try {
      // 1. 获取并验证 API 配置（使用预加载的缓存）
      log.debug(`[Runner] Fetching API config...`);
      config = await getCachedApiConfig();

      if (!config) {
        log.error(`[Runner] No API config found for session ${session.id}`);
        onEvent({
          type: "session.status",
          payload: { sessionId: session.id, status: "error", title: session.title, cwd: session.cwd, error: "API configuration not found. Please configure API settings." }
        });
        return;
      }
      log.info(`[Runner] API config loaded`, { baseURL: config.baseURL, model: config.model });

      // 2. 构建环境变量（直连模式）
      perfMonitor.mark('Environment Setup');
      const env = buildEnvForConfig(config);
      const mergedEnv = {
        ...getEnhancedEnv(),
        ...env
      };
      perfMonitor.measure('Environment Setup');

      // 3. 处理提示词（使用用户设置的语言偏好）
      // ✅ 获取用户在设置中选择的 AI 回复语言
      const userLanguage = getAILanguagePreference();
      
      // ✅ 使用用户设置的语言强制添加语言偏好
      const enhancedPrompt = addLanguagePreference(prompt, userLanguage);
      
      log.debug(`[Runner] Using user-preferred AI language: ${userLanguage}`);

      // 4. 加载外部 MCP 服务器配置（从 ~/.qwen/settings.json）
      perfMonitor.mark('MCP Servers Loading');
      const { getMcpServers } = await import("../../managers/mcp-server-manager.js");
      const externalMcpServers = await getMcpServers();
      log.info(`[Runner] Loaded ${Object.keys(externalMcpServers).length} external MCP server configs`);
      // 详细记录每个 MCP 服务器的名称（避免序列化循环引用）
      for (const [name, config] of Object.entries(externalMcpServers)) {
        log.debug(`[Runner] MCP Server "${name}": command=${config.command}, args=${config.args?.join(' ') || 'none'}`);
      }
      perfMonitor.measure('MCP Servers Loading');

      // 7. 确定权限模式（使用最严格的默认值）
      const claudePermissionMode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'delegate' | 'dontAsk' =
        "default";  // 使用最严格的默认模式，防止权限绕过
      
      // 映射到 Qwen SDK 的权限模式
      const qwenPermissionMode = mapPermissionMode(claudePermissionMode);

      log.debug(`[Runner] Permission mode: ${claudePermissionMode} → ${qwenPermissionMode}`);

      // 5. 合并所有 MCP 服务器配置
      const allMcpServers: Record<string, any> = {
        ...externalMcpServers,
      };

      log.info(`[Runner] Total MCP servers to load: ${Object.keys(allMcpServers).length}`);
      if (Object.keys(allMcpServers).length > 0) {
        log.debug(`[Runner] MCP server names:`, Object.keys(allMcpServers));
        // 注意：不序列化完整配置，因为可能包含循环引用
        log.debug(`[Runner] MCP servers loaded successfully`);
      } else {
        log.warn(`[Runner] No MCP servers to load!`);
      }

      // 6. 记录会话启动完成
      perfMonitor.measureTotal();

      // 7. 创建并执行查询
      log.info(`[Runner] Starting SDK query for session ${session.id}`);

      // 获取 CLI 路径
      claudeCodePath = getQwenCodePath();

      log.info(`[Runner] CLI mode: ${claudeCodePath ? 'enabled' : 'disabled (HTTP API mode)'} for provider: ${config.apiType}`);

      if (!claudeCodePath) {
        log.warn('[Runner] CLI path not found, falling back to HTTP API mode');
      }

      // ========== 记录详细的 API 请求信息 ==========
      try {
        const apiEndpoint = buildApiEndpoint(config);
        const requestHeaders = buildApiHeaders(config);
        const requestBody = buildApiRequestBody(config, enhancedPrompt);

        // 打印详细的请求信息（类似 api-tester.ts 的格式）
        log.info('========================================');
        log.info('=== API Request Details ===');
        log.info(`Session ID: ${session.id}`);
        log.info(`URL: ${apiEndpoint}`);
        log.info('Method: POST');
        log.info(`Headers: ${JSON.stringify(requestHeaders, null, 2)}`);
        log.info(`Body: ${JSON.stringify(requestBody, null, 2)}`);
        log.info('========================================');
      } catch (logError) {
        log.warn('[Runner] Failed to log API request details:', logError);
      }
      // ========== 结束：API 请求信息记录 ==========

      // ✅ 判断是新会话还是继续会话
      const isNewSession = session.claudeSessionId === undefined;
      
      let sdkSessionId: string;
      if (isNewSession) {
        // 新会话：生成新的 session_id
        sdkSessionId = crypto.randomUUID();
        log.info(`[Runner] Creating new session with SDK session: ${sdkSessionId}`);
      } else {
        // 继续会话：使用已有的 session_id
        sdkSessionId = session.claudeSessionId!;
        log.info(`[Runner] Continuing session with SDK session: ${sdkSessionId}`);
      }

      const q = query({
        // ✅ 使用持久的 generator，一直运行直到会话关闭
        prompt: createConversationStream(inputQueue, sdkSessionId, enhancedPrompt),
        options: {
          cwd: session.cwd ?? DEFAULT_CWD,
          // ✅ 启用 resume 参数，支持会话恢复功能（SDK 0.1.5-preview.1+）
          ...(resumeSessionId ? { resume: resumeSessionId } : {}),
          abortController,
          env: mergedEnv,
          // 阿里云不传递 CLI 路径，使用纯 HTTP API 模式
          // ✅ 参数名更新：pathToClaudeCodeExecutable → pathToQwenExecutable
          ...(claudeCodePath ? { pathToQwenExecutable: claudeCodePath } : {}),
          // ✅ 使用映射后的 Qwen 权限模式
          permissionMode: qwenPermissionMode,
          includePartialMessages: true,
          // ❌ Qwen SDK 不支持 settingSources 参数
          // settingSources: ['user'],
          // ❌ Qwen SDK 不支持 extraArgs 参数，语言偏好提示已移除
          // 注意：如需添加系统提示，应该在 prompt 中直接包含
          // ✅ 动态传递所有 MCP 服务器配置（包括 Memory 和外部服务器）
          ...(Object.keys(allMcpServers).length > 0 ? { mcpServers: allMcpServers as any } : {}),
          // 权限处理
          canUseTool: createPermissionHandler(session, sendPermissionRequest)
        }
      });

      // 8. 处理消息流
      log.debug(`[Runner] Starting message loop for session ${session.id}`);
      let messageCount = 0;
      for await (const message of q) {
        messageCount++;
        
        // ========== 详细的消息日志记录 ==========
        // 记录每条消息的类型和关键信息
        log.info(`[Runner] Message #${messageCount}: type=${message.type}, subtype=${'subtype' in message ? (message as any).subtype : 'N/A'}`);
        
        // 对于前几条消息，记录完整内容以便调试
        if (messageCount <= 5) {
          try {
            const messagePreview = JSON.stringify(message, null, 2);
            // 限制日志长度，避免过长
            const truncated = messagePreview.length > 2000 
              ? messagePreview.substring(0, 2000) + '... [truncated]' 
              : messagePreview;
            log.info(`[Runner] Message #${messageCount} content: ${truncated}`);
          } catch {
            log.info(`[Runner] Message #${messageCount} content: [unable to serialize]`);
          }
        }
        
        // 检测错误消息并记录详细信息
        if (message.type === "result" && 'subtype' in message && (message as any).subtype !== "success") {
          log.error('========================================');
          log.error('=== SDK Error Response ===');
          log.error(`Session ID: ${session.id}`);
          log.error(`Message Type: ${message.type}`);
          log.error(`Subtype: ${(message as any).subtype}`);
          log.error(`Full Message: ${JSON.stringify(message, null, 2)}`);
          
          // 记录请求信息以便调试
          if (config) {
            const apiEndpoint = buildApiEndpoint(config);
            const requestHeaders = buildApiHeaders(config);
            const requestBody = buildApiRequestBody(config, prompt);
            
            log.error('--- Request Info ---');
            log.error(`Request URL: ${apiEndpoint}`);
            log.error(`Request Headers: ${JSON.stringify(requestHeaders, null, 2)}`);
            log.error(`Request Body: ${JSON.stringify(requestBody, null, 2)}`);
          }
          log.error('========================================');
        }
        // ========== 结束：消息日志记录 ==========
        
        // 提取 session_id 并附加实际配置的模型名称
        if (message.type === "system" && "subtype" in message && message.subtype === "init") {
          const sdkSessionId = message.session_id;
          if (sdkSessionId) {
            session.claudeSessionId = sdkSessionId;
            onSessionUpdate?.({ claudeSessionId: sdkSessionId });
          }
          
          // ✅ 附加实际配置的模型名称（覆盖 SDK 返回的 coder-model）
          // 这样前端可以显示用户实际配置的模型名称
          (message as any).configuredModel = config.model;
          log.debug(`[Runner] System init message enhanced with configured model: ${config.model}`);
        }

        // 处理工具使用事件
        if (message.type === "assistant") {
          const assistantMsg = message as any;
          if (assistantMsg.message && assistantMsg.message.content) {
            for (const content of assistantMsg.message.content) {
              if (content.type === "tool_use") {
                await handleToolUseEvent(content.name, content.input, session, onEvent);
              }
            }
          }
        }

        // 发送消息到前端
        sendMessage(message);

        // 检查结果以更新会话状态
        if (message.type === "result") {
          const status = message.subtype === "success" ? "completed" : "error";
          onEvent({
            type: "session.status",
            payload: { sessionId: session.id, status, title: session.title }
          });
        }
      }

      // 11. 查询正常完成
      log.info(`[Runner] Message loop completed for session ${session.id}, total messages: ${messageCount}`);
      if (session.status === "running") {
        onEvent({
          type: "session.status",
          payload: { sessionId: session.id, status: "completed", title: session.title }
        });
      }
    } catch (error) {
      const errorName = (error as Error).name;
      if (errorName === "AbortError") {
        // 会话被中止，不视为错误
        log.info(`[Runner] Session ${session.id} aborted by user`);
        return;
      }
      
      // ========== 增强的错误日志记录 ==========
      log.error('========================================');
      log.error('=== API Error Details ===');
      log.error(`Session ID: ${session.id}`);
      log.error(`Error Name: ${errorName}`);
      log.error(`Error Message: ${(error as Error).message}`);
      
      // 记录 API 请求信息（用于调试 404 等错误）
      if (config) {
        const apiEndpoint = buildApiEndpoint(config);
        const requestHeaders = buildApiHeaders(config);
        const requestBody = buildApiRequestBody(config, prompt);
        
        log.error('--- Request Info ---');
        log.error(`Request URL: ${apiEndpoint}`);
        log.error(`Request Method: POST`);
        log.error(`Request Headers: ${JSON.stringify(requestHeaders, null, 2)}`);
        log.error(`Request Body: ${JSON.stringify(requestBody, null, 2)}`);
      }
      
      // 尝试提取更多错误信息（如 HTTP 状态码、响应体等）
      const errorObj = error as any;
      if (errorObj.status || errorObj.statusCode) {
        log.error(`HTTP Status: ${errorObj.status || errorObj.statusCode}`);
      }
      if (errorObj.response) {
        log.error(`Response: ${JSON.stringify(errorObj.response, null, 2)}`);
      }
      if (errorObj.body) {
        log.error(`Response Body: ${typeof errorObj.body === 'string' ? errorObj.body : JSON.stringify(errorObj.body, null, 2)}`);
      }
      if (errorObj.cause) {
        log.error(`Error Cause: ${JSON.stringify(errorObj.cause, null, 2)}`);
      }
      
      log.error(`Stack Trace: ${(error as Error).stack}`);
      log.error('========================================');
      
      // 详细的错误日志记录（保留原有格式）
      const errorDetails = {
        name: errorName,
        message: (error as Error).message,
        stack: (error as Error).stack,
        sessionId: session.id,
        apiType: config?.apiType,
        baseURL: config?.baseURL,
        model: config?.model,
        claudeCodePath: claudeCodePath ?? 'undefined (HTTP API mode)',
      };
      log.error(`[Runner] Error in session ${session.id}:`, errorDetails);
      onEvent({
        type: "session.status",
        payload: { sessionId: session.id, status: "error", title: session.title, error: String(error) }
      });
    }
  })();

  return {
    abort: () => {
      log.info(`[Runner] Aborting session ${session.id}`);
      inputQueue.close();  // ✅ 关闭队列
      abortController.abort();
    },
    // ✅ 添加方法来接收新的用户输入
    addUserInput: (prompt: string) => {
      log.info(`[Runner] Adding user input to queue for session ${session.id}`);
      inputQueue.addInput(prompt);
    }
  };
}

// ========== 辅助函数：构建 API 请求信息（用于日志记录） ==========

/**
 * 检测厂商类型（基于 Base URL）
 */
function detectProviderType(baseURL: string): 'anthropic' | 'openai' {
  const url = baseURL.toLowerCase();
  
  // OpenAI 兼容的厂商列表
  const openaiProviders = [
    'api.deepseek.com',
    'api.openai.com',
    'antchat.alipay.com', // 矽塔（蚂蚁聊天）
    'idealab.alibaba-inc.com', // IdeaLab
  ];
  
  for (const provider of openaiProviders) {
    if (url.includes(provider)) {
      return 'openai';
    }
  }
  
  // 默认使用 Anthropic 格式
  return 'anthropic';
}

/**
 * 构建 API 端点 URL
 * 根据厂商类型使用不同的 API 格式
 */
function buildApiEndpoint(config: { baseURL: string }): string {
  const baseUrl = config.baseURL.replace(/\/+$/, ''); // 移除尾部斜杠
  const providerType = detectProviderType(config.baseURL);

  // 使用正则检查 URL 是否以特定路径结尾（完整端点）
  const endsWithPath = (pattern: string) => new RegExp(`${pattern}/?$`).test(baseUrl);

  // 如果 URL 已包含完整的 API 端点路径，直接使用
  if (endsWithPath('/messages') || endsWithPath('/chat/completions')) {
    return baseUrl;
  }

  // 阿里云百炼特殊处理：compatible-mode/v1 使用 OpenAI 格式
  if (baseUrl.includes('dashscope.aliyuncs.com/compatible-mode/v1')) {
    return `${baseUrl}/chat/completions`;
  }

  // 根据厂商类型构建端点
  if (providerType === 'openai') {
    // OpenAI 格式：/v1/chat/completions
    if (endsWithPath('/v1')) return `${baseUrl}/chat/completions`;
    return `${baseUrl}/v1/chat/completions`;
  } else {
    // Anthropic 格式：/v1/messages
    if (endsWithPath('/v1')) return `${baseUrl}/messages`;
    return `${baseUrl}/v1/messages`;
  }
}

/**
 * 构造 API 请求头（脱敏显示）
 * 根据厂商类型使用不同的格式
 */
function buildApiHeaders(config: { baseURL: string; apiKey: string }): Record<string, string> {
  const providerType = detectProviderType(config.baseURL);
  
  // 脱敏处理：只显示前 10 个字符
  const maskedApiKey = config.apiKey.length > 10 
    ? `${config.apiKey.substring(0, 10)}...` 
    : '***';
  
  if (providerType === 'openai') {
    // OpenAI 格式：使用 Authorization Bearer
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${maskedApiKey}`
    };
  } else {
    // Anthropic 格式：使用 x-api-key
    return {
      'Content-Type': 'application/json',
      'x-api-key': maskedApiKey,
      'anthropic-version': '2023-06-01'
    };
  }
}

/**
 * 构造 API 请求体（用于日志显示）
 * 根据厂商类型使用不同的格式
 */
function buildApiRequestBody(
  config: { baseURL: string; model: string; maxTokens?: number; temperature?: number }, 
  prompt: string
): any {
  const providerType = detectProviderType(config.baseURL);
  
  // 截断过长的 prompt 用于日志显示
  const truncatedPrompt = prompt.length > 200 
    ? `${prompt.substring(0, 200)}... (total ${prompt.length} chars)` 
    : prompt;
  
  if (providerType === 'openai') {
    // OpenAI 格式
    return {
      model: config.model,
      max_tokens: config.maxTokens || 8192,
      temperature: config.temperature || 1.0,
      messages: [{ role: 'user', content: truncatedPrompt }]
    };
  } else {
    // Anthropic 格式
    return {
      model: config.model,
      max_tokens: config.maxTokens || 8192,
      temperature: config.temperature || 1.0,
      messages: [{ role: 'user', content: truncatedPrompt }]
    };
  }
}
