/**
 * Memory SDK 集成模块
 * 将自定义记忆功能深度集成到 SDK 的记忆系统中
 *
 * 实现：
 * - SessionStart Hook: 自动检索相关记忆并注入上下文
 * - SessionEnd Hook: 自动分析会话并存储摘要
 *
 * @author Alan
 * @copyright AGCPA v3.0
 * @updated 2025-01-24
 */

import type {
  HookCallback,
  SessionStartHookInput,
  SessionEndHookInput,
  HookJSONOutput,
  BaseHookInput
} from "@anthropic-ai/claude-agent-sdk";
import { memorySearch, memoryStore, getMemoryToolConfig } from "./memory-tools.js";
import { log } from "../logger.js";

/**
 * 创建 SessionStart Hook - 自动注入记忆上下文
 *
 * 当会话开始时，根据用户输入检索相关记忆，并将记忆上下文
 * 注入到 additionalContext 中，让 AI 能够访问历史信息。
 */
export function createMemorySessionStartHook(): HookCallback {
  return async (_input: SessionStartHookInput, _toolUseId: string | undefined, _options: { signal: AbortSignal }) => {
    // 检查记忆功能是否启用
    const memConfig = getMemoryToolConfig();
    if (!memConfig.enabled) {
      return { continue: true };
    }

    try {
      // 获取会话信息（注意：这些参数在当前实现中未使用）
      // const { session_id, transcript_path, cwd } = _input;

      log.debug(`[Memory Hooks] SessionStart triggered`);

      // 从会话历史中提取最近的用户消息（用于检索相关记忆）
      // 注意：这里我们需要读取会话历史或从参数中获取用户意图
      // 由于 SDK Hook 限制，我们使用 transcript_path 读取会话历史

      // TODO: 实现从 transcript_path 或其他方式获取用户当前意图
      // 目前使用通用检索，获取最近的记忆

      // 检索最近的相关记忆
      const searchResult = await memorySearch(
        "最近的会话、项目信息、技术决策", // 通用检索查询
        memConfig.defaultK || 6
      );

      if (searchResult && searchResult.trim().length > 0) {
        log.info(`[Memory Hooks] Injected memory context`);

        // 将记忆上下文注入到 additionalContext
        return {
          continue: true,
          hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext: `\n📚 相关记忆上下文：\n${searchResult}\n`
          }
        };
      }

      return { continue: true };
    } catch (error) {
      log.error('[Memory Hooks] SessionStart hook error:', error);
      return { continue: true };
    }
  };
}

/**
 * 创建 SessionEnd Hook - 自动存储会话摘要
 *
 * 当会话结束时，分析会话内容并提取关键信息存储到记忆中。
 */
export function createMemorySessionEndHook(): HookCallback {
  return async (_input: SessionEndHookInput, _toolUseId: string | undefined, _options: { signal: AbortSignal }) => {
    // 检查记忆功能是否启用
    const memConfig = getMemoryToolConfig();
    if (!memConfig.enabled || !memConfig.autoStore) {
      return { continue: true };
    }

    try {
      // 注意：会话信息参数当前未使用
      // const { session_id, transcript_path, reason } = _input;

      log.debug(`[Memory Hooks] SessionEnd triggered`);

      // TODO: 实现从 transcript_path 读取会话历史
      // 并提取关键信息（项目决策、技术方案、用户偏好等）

      // 目前跳过自动存储，因为：
      // 1. transcript_path 需要异步读取和处理
      // 2. 需要智能分析会话内容
      // 3. 这已经在 runner 的 triggerAutoMemoryAnalysis 中实现

      log.info(`[Memory Hooks] SessionEnd hook completed`);
      return { continue: true };
    } catch (error) {
      log.error('[Memory Hooks] SessionEnd hook error:', error);
      return { continue: true };
    }
  };
}

/**
 * 创建 Memory SDK Hooks 配置
 *
 * 返回完整的 hooks 配置对象，可以直接传递给 SDK query()。
 */
export function createMemorySdkHooks(): {
  SessionStart: { hooks: HookCallback[] };
  SessionEnd: { hooks: HookCallback[] };
} {
  return {
    SessionStart: {
      hooks: [createMemorySessionStartHook()]
    },
    SessionEnd: {
      hooks: [createMemorySessionEndHook()]
    }
  };
}

/**
 * 创建增强的 SessionStart Hook - 基于用户意图检索
 *
 * 这个版本接受用户提示词作为参数，用于更精确的检索。
 *
 * @param userPrompt - 用户的当前输入/提示词
 */
export function createEnhancedMemorySessionStartHook(userPrompt: string): HookCallback {
  return async (_input: SessionStartHookInput, _toolUseId: string | undefined, _options: { signal: AbortSignal }) => {
    const memConfig = getMemoryToolConfig();
    if (!memConfig.enabled) {
      return { continue: true };
    }

    try {
      log.debug(`[Memory Hooks] Enhanced SessionStart with user prompt: ${userPrompt.substring(0, 50)}...`);

      // ⚡ 性能优化：设置 800ms 超时，避免记忆检索阻塞会话启动
      const searchPromise = memorySearch(userPrompt, memConfig.defaultK || 6);

      // 使用 Promise.race 实现超时机制
      const timeoutPromise = new Promise<{ result?: string; timedOut: true }>((resolve) => {
        setTimeout(() => resolve({ timedOut: true }), 800);
      });

      const searchResult = await Promise.race([
        searchPromise.then(result => ({ result, timedOut: false })),
        timeoutPromise
      ]);

      if (searchResult.timedOut) {
        log.warn('[Memory Hooks] Memory search timed out (800ms), skipping injection to avoid blocking session');
        return { continue: true };
      }

      if (searchResult.result && searchResult.result.trim().length > 0) {
        log.info(`[Memory Hooks] Injected enhanced memory context`);

        return {
          continue: true,
          hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext: `\n📚 相关记忆（基于当前话题）：\n${searchResult.result}\n`
          }
        };
      }

      return { continue: true };
    } catch (error) {
      log.error('[Memory Hooks] Enhanced SessionStart hook error:', error);
      // 即使失败也不阻塞会话
      return { continue: true };
    }
  };
}
