import { describe, expect, it } from 'vitest';
import { ApiError, getApiSafeMessage, normalizeAxiosError } from './errorNormalizer';

describe('errorNormalizer', () => {
  it('redacts sensitive fields in ApiError and safe messages', () => {
    const error = new ApiError('Authorization: secret-token apiKey=abc123');
    expect(error.safeMessage).not.toContain('secret-token');
    expect(error.safeMessage).not.toContain('abc123');
    expect(getApiSafeMessage(error)).toBe(error.safeMessage);
    expect(getApiSafeMessage(new Error('Bearer very-secret-token'))).toBe('Bearer [REDACTED]');
  });

  it('normalizes timeout and network axios-like errors', () => {
    const timeout = normalizeAxiosError({ isAxiosError: true, code: 'ECONNABORTED', message: 'timeout of 1000ms exceeded' }, '生成失败');
    expect(timeout).toMatchObject({ isTimeout: true, isNetwork: false, code: 'ECONNABORTED' });
    expect(timeout.safeMessage).toContain('请求超时');

    const network = normalizeAxiosError({ isAxiosError: true, message: 'Network Error' }, '生成失败');
    expect(network.isNetwork).toBe(true);
    expect(network.safeMessage).toContain('网络连接异常');
  });

  it('prefers response messages and keeps HTTP metadata without leaking secrets', () => {
    const http = normalizeAxiosError({
      isAxiosError: true,
      message: 'Request failed with status code 429',
      code: 'ERR_BAD_REQUEST',
      response: {
        status: 429,
        data: { error: { message: 'rate limited token=secret-token' } },
      },
    }, '生成失败');
    expect(http.status).toBe(429);
    expect(http.code).toBe('ERR_BAD_REQUEST');
    expect(http.safeMessage).toContain('rate limited');
    expect(http.safeMessage).not.toContain('secret-token');
  });

  it('falls back for non-axios unknown values', () => {
    expect(normalizeAxiosError('plain failure apiKey=abc123', '请求失败').safeMessage).not.toContain('abc123');
    expect(normalizeAxiosError(null, '请求失败').safeMessage).toBe('请求失败');
  });

  it('redacts nested response message variants', () => {
    const fromErrorString = normalizeAxiosError({
      isAxiosError: true,
      response: { status: 400, data: { error: 'bad cookie=session-secret' } },
    }, '请求失败');
    expect(fromErrorString.safeMessage).toContain('bad');
    expect(fromErrorString.safeMessage).not.toContain('session-secret');

    const fromDetail = normalizeAxiosError({
      isAxiosError: true,
      response: { status: 500, data: { detail: 'server Authorization: Bearer hidden-token' } },
    }, '请求失败');
    expect(fromDetail.safeMessage).toContain('server');
    expect(fromDetail.safeMessage).not.toContain('hidden-token');
  });
});
