/**
 * 统一日志系统
 * - 受 appConfig.debug 控制，避免生产环境输出冗余日志
 * - 所有输出统一经过 sanitize/redact，避免泄露 apiKey、Cookie、Bearer、token 等敏感信息
 */

import { readJsonStorage } from './storage';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const REDACTED = '[REDACTED]';
const MAX_STRING_LENGTH = 2000;
const MAX_DEPTH = 5;

const SENSITIVE_KEYS = new Set([
  'apikey',
  'api_key',
  'api-key',
  'uploadck',
  'upload_ck',
  'authorization',
  'cookie',
  'set-cookie',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'secretkey',
  'secret_key',
  'x-cos-security-token',
]);

const SENSITIVE_PATTERNS: Array<[RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`],
  [/(Authorization\s*[:=]\s*)([^\s,;]+)/gi, `$1${REDACTED}`],
  [/(Cookie\s*[:=]\s*)([^\n]+)/gi, `$1${REDACTED}`],
  [/(Set-Cookie\s*[:=]\s*)([^\n]+)/gi, `$1${REDACTED}`],
  [/((?:apiKey|api_key|uploadCk|token|secret|secret_key|x-cos-security-token)\s*["']?\s*[:=]\s*["']?)([^"'\s,}]+)/gi, `$1${REDACTED}`],
  [/((?:access_token|refresh_token)=)([^&\s]+)/gi, `$1${REDACTED}`],
];

const normalizeKey = (key: string): string => key.toLowerCase().replace(/[\s-]/g, '-').replace(/_/g, '_');

const isSensitiveKey = (key: string): boolean => {
  const lower = key.toLowerCase();
  const compact = lower.replace(/[^a-z0-9]/g, '');
  return SENSITIVE_KEYS.has(lower) || SENSITIVE_KEYS.has(compact) || /apikey|uploadck|authorization|cookie|token|secret/.test(compact) || normalizeKey(key) === 'x-cos-security-token';
};

export function redactString(value: string): string {
  const trimmed = value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncated]` : value;
  return SENSITIVE_PATTERNS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), trimmed);
}

export function sanitizeForLog<T = unknown>(value: T, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value;
  if (typeof value === 'function') return '[Function]';
  if (typeof value !== 'object') return String(value);
  if (depth >= MAX_DEPTH) return '[MaxDepth]';

  const obj = value as object;
  if (seen.has(obj)) return '[Circular]';
  seen.add(obj);

  if (value instanceof Error) {
    const maybeAxios = value as Error & { code?: string; status?: number; response?: { status?: number; data?: unknown }; config?: { url?: string; method?: string; baseURL?: string } };
    return {
      name: value.name,
      message: redactString(value.message),
      code: maybeAxios.code,
      status: maybeAxios.status ?? maybeAxios.response?.status,
      url: maybeAxios.config?.url ? redactString(maybeAxios.config.url) : undefined,
      method: maybeAxios.config?.method,
    };
  }

  if (Array.isArray(value)) return value.slice(0, 50).map(item => sanitizeForLog(item, depth + 1, seen));

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = isSensitiveKey(key) ? REDACTED : sanitizeForLog(item, depth + 1, seen);
  }
  return output;
}

export function getSafeErrorMessage(error: unknown, fallback = '操作失败'): string {
  if (error instanceof Error) return redactString(error.message || fallback);
  if (typeof error === 'string') return redactString(error || fallback);
  return fallback;
}

class Logger {
  private minLevel: LogLevel = 'warn';

  setDebug(enabled: boolean) {
    this.minLevel = enabled ? 'debug' : 'warn';
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.minLevel];
  }

  private format(level: LogLevel, scope: string, msg: string): string {
    const ts = new Date().toISOString().slice(11, 23);
    return `[${ts}] [${level.toUpperCase()}] [${scope}] ${redactString(msg)}`;
  }

  private safeArgs(args: unknown[]): unknown[] {
    return args.map(arg => sanitizeForLog(arg));
  }

  debug(scope: string, msg: string, ...args: unknown[]) {
    if (this.shouldLog('debug')) {
      console.debug(this.format('debug', scope, msg), ...this.safeArgs(args));
    }
  }

  info(scope: string, msg: string, ...args: unknown[]) {
    if (this.shouldLog('info')) {
      console.info(this.format('info', scope, msg), ...this.safeArgs(args));
    }
  }

  warn(scope: string, msg: string, ...args: unknown[]) {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', scope, msg), ...this.safeArgs(args));
    }
  }

  error(scope: string, msg: string, ...args: unknown[]) {
    // error 始终输出，但参数仍统一脱敏
    console.error(this.format('error', scope, msg), ...this.safeArgs(args));
  }
}

export const logger = new Logger();

// 从 localStorage 初始化 debug 开关：优先读取当前配置 key，兼容旧版本 key。
const cfg = readJsonStorage<{ debug?: unknown }>('video_gen_app_config', {});
const legacyCfg = typeof cfg.debug === 'boolean' ? {} : readJsonStorage<{ debug?: unknown }>('geekai_config', {});
const debugValue = typeof cfg.debug === 'boolean' ? cfg.debug : legacyCfg.debug;
if (typeof debugValue === 'boolean') logger.setDebug(debugValue);
