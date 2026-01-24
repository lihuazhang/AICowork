/**
 * 语言检测工具
 * 检测用户输入的语言并返回语言首选项提示
 * @author Alan <your.email@example.com>
 * @copyright AGCPA v3.0
 * @created 2024-01-24
 */

/**
 * 支持的语言类型
 */
export type Language = 'zh' | 'en' | 'ja' | 'ko' | 'unknown';

/**
 * 语言检测结果
 */
export interface LanguageDetectionResult {
  /** 检测到的语言 */
  language: Language;
  /** 语言名称 */
  languageName: string;
  /** 语言偏好提示（用于添加到 prompt） */
  preferenceHint: string;
}

/**
 * 最大文本采样长度（字符数）
 * 对于大文本，只分析前100个字符以提高性能
 */
const MAX_SAMPLE_SIZE = 100;

/**
 * 语言缓存大小限制
 */
const CACHE_MAX_SIZE = 500;

/**
 * 预编译的正则表达式模式
 * 使用静态常量避免重复创建正则表达式对象
 */
const PRECOMPILED_PATTERNS = {
  // 中文字符（基本汉字 + 扩展A）
  CHINESE: /[\u4e00-\u9fff\u3400-\u4dbf]/g,
  // 日文字符（平假名 + 片假名）
  JAPANESE: /[\u3040-\u309f\u30a0-\u30ff]/g,
  // 韩文字符（音节 + 字母）
  KOREAN: /[\uac00-\ud7af\u1100-\u11ff]/g,
  // 英文字符（拉丁字母）
  ENGLISH: /[a-zA-Z]/g,
} as const;

/**
 * 语言偏好提示模板
 */
const LANGUAGE_HINTS: Record<Language, string> = {
  zh: '请使用简体中文回复。',
  en: 'Please respond in English.',
  ja: '日本語で回答してください。',
  ko: '한국어로 답변해 주세요.',
  unknown: '',
};

/**
 * 语言检测缓存
 * 使用Map存储最近的语言检测结果，避免重复计算
 */
const languageCache = new Map<string, LanguageDetectionResult>();

/**
 * 生成缓存键
 * 使用文本的前100个字符作为缓存键
 */
function getCacheKey(text: string): string {
  return text.slice(0, 100);
}

/**
 * 清理缓存
 * 当缓存超过一定大小时，删除最旧的条目
 */
function cleanupCache(): void {
  if (languageCache.size > CACHE_MAX_SIZE) {
    const keysToDelete = Array.from(languageCache.keys()).slice(0, Math.floor(CACHE_MAX_SIZE * 0.2));
    for (const key of keysToDelete) {
      languageCache.delete(key);
    }
  }
}

/**
 * 检测文本语言
 * @param text 待检测的文本
 * @returns 语言检测结果
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  // 去除首尾空白
  const trimmedText = text.trim();

  if (!trimmedText) {
    return createResult('unknown');
  }

  // 检查缓存
  const cacheKey = getCacheKey(trimmedText);
  const cachedResult = languageCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // 限制文本采样大小以提高性能
  const sampleText = trimmedText.length > MAX_SAMPLE_SIZE
    ? trimmedText.slice(0, MAX_SAMPLE_SIZE)
    : trimmedText;

  // 统计各语言特征出现次数
  const scores: Record<Language, number> = {
    zh: 0,
    en: 0,
    ja: 0,
    ko: 0,
    unknown: 0,
  };

  // 使用预编译的正则表达式进行匹配
  const zhMatches = sampleText.match(PRECOMPILED_PATTERNS.CHINESE);
  if (zhMatches) {
    scores.zh = zhMatches.length;
  }

  const jaMatches = sampleText.match(PRECOMPILED_PATTERNS.JAPANESE);
  if (jaMatches) {
    scores.ja = jaMatches.length;
  }

  const koMatches = sampleText.match(PRECOMPILED_PATTERNS.KOREAN);
  if (koMatches) {
    scores.ko = koMatches.length;
  }

  const enMatches = sampleText.match(PRECOMPILED_PATTERNS.ENGLISH);
  if (enMatches) {
    scores.en = enMatches.length;
  }

  // 找出得分最高的语言
  let detectedLanguage: Language = 'unknown';
  let maxScore = 0;

  for (const [lang, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedLanguage = lang as Language;
    }
  }

  // 如果最高分低于阈值，视为未知语言
  if (maxScore < sampleText.length * 0.2) {
    detectedLanguage = 'unknown';
  }

  const result = createResult(detectedLanguage);

  // 缓存结果
  languageCache.set(cacheKey, result);
  cleanupCache();

  return result;
}

/**
 * 创建语言检测结果
 */
function createResult(language: Language): LanguageDetectionResult {
  const languageNames: Record<Language, string> = {
    zh: '简体中文',
    en: 'English',
    ja: '日本語',
    ko: '한국어',
    unknown: '未知',
  };

  return {
    language,
    languageName: languageNames[language],
    preferenceHint: LANGUAGE_HINTS[language],
  };
}

/**
 * 为 prompt 添加语言偏好提示
 * @param prompt 原始 prompt
 * @param detectedLanguage 检测到的语言（可选，如果不提供则自动检测）
 * @returns 添加了语言提示的 prompt
 */
export function addLanguagePreference(
  prompt: string,
  detectedLanguage?: Language
): string {
  const detection = detectedLanguage
    ? createResult(detectedLanguage)
    : detectLanguage(prompt);

  // 如果检测到明确语言且不是未知，添加语言偏好提示
  if (detection.language !== 'unknown' && detection.preferenceHint) {
    return `${detection.preferenceHint}\n\n${prompt}`;
  }

  return prompt;
}
