import { AxiosError, isAxiosError } from 'axios';
import { getSafeErrorMessage, redactString } from '../../utils/logger';

export class ApiError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly isTimeout: boolean;
  readonly isNetwork: boolean;
  readonly safeMessage: string;

  constructor(message: string, options: { status?: number; code?: string; isTimeout?: boolean; isNetwork?: boolean } = {}) {
    const safeMessage = redactString(message);
    super(safeMessage);
    this.name = 'ApiError';
    this.safeMessage = safeMessage;
    this.status = options.status;
    this.code = options.code;
    this.isTimeout = !!options.isTimeout;
    this.isNetwork = !!options.isNetwork;
  }
}

function pickResponseMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const record = data as Record<string, unknown>;
  const error = record.error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string') {
    return (error as Record<string, string>).message;
  }
  for (const key of ['message', 'msg', 'detail', 'error_message']) {
    if (typeof record[key] === 'string') return record[key] as string;
  }
  return undefined;
}

export function getApiSafeMessage(error: unknown, fallback = '请求失败'): string {
  if (error instanceof ApiError) return error.safeMessage;
  return getSafeErrorMessage(error, fallback);
}

export function normalizeAxiosError(error: unknown, fallback: string): ApiError {
  if (isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const code = axiosError.code;
    const isTimeout = code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout/i.test(axiosError.message);
    const isNetwork = !axiosError.response && !isTimeout;
    const responseMessage = pickResponseMessage(axiosError.response?.data);
    const message = responseMessage
      || (isTimeout ? `${fallback}: 请求超时` : undefined)
      || (isNetwork ? `${fallback}: 网络连接异常` : undefined)
      || (status ? `${fallback}: HTTP ${status}` : getSafeErrorMessage(error, fallback));
    return new ApiError(message, { status, code, isTimeout, isNetwork });
  }
  return new ApiError(getSafeErrorMessage(error, fallback));
}
