/**
 * 敏感信息加密存储工具
 *
 * 使用 Electron 的 safeStorage API（OS 级密钥库，如 Windows DPAPI / macOS Keychain / Linux Secret Service）
 * 对 API Key 等敏感字符串进行加密后再写入 localStorage，替代明文存储。
 *
 * 加密后的值会带有 `enc:` 前缀用于识别，未加密的旧数据（明文）保持向后兼容，
 * 读取时若检测不到该前缀则视为明文直接返回，下一次保存时会被自动加密。
 *
 * 在非 Electron 环境（如浏览器预览、单元测试）中，window.electronAPI 不存在，
 * 此时会退化为明文直传，保证功能可用性。
 */

import type { AppConfig } from '../types';

const ENCRYPTED_PREFIX = 'enc:';

/**
 * 加密明文字符串。加密失败或加密不可用时，原样返回明文（保证配置仍可用）。
 */
export async function encryptSecret(plainText: string | undefined | null): Promise<string> {
  const value = plainText ?? '';
  if (!value) return '';
  try {
    const api = window.electronAPI;
    if (!api?.encryptString) return value;
    const result = await api.encryptString(value);
    if (result?.success && result.encrypted) return `${ENCRYPTED_PREFIX}${result.encrypted}`;
    return value;
  } catch {
    return value;
  }
}

/**
 * 解密字符串。若不带加密前缀，视为历史遗留明文直接返回；
 * 解密失败时返回空字符串，避免把密文当作有效 Key 使用。
 */
export async function decryptSecret(value: string | undefined | null): Promise<string> {
  const raw = value ?? '';
  if (!raw) return '';
  if (!raw.startsWith(ENCRYPTED_PREFIX)) return raw;
  try {
    const api = window.electronAPI;
    if (!api?.decryptString) return '';
    const result = await api.decryptString(raw.slice(ENCRYPTED_PREFIX.length));
    return result?.success ? (result.decrypted ?? '') : '';
  } catch {
    return '';
  }
}

export function isEncryptedSecret(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * 将 AppConfig 中的敏感字段（各平台 apiKey、uploadCk）加密，得到一份仅用于
 * 写入 localStorage 的“存储快照”。传入的 config 本身不会被修改，
 * React 状态中仍保持明文，保证运行时业务逻辑（发起 API 请求等）不受影响。
 */
export async function encryptAppConfigForStorage(config: AppConfig): Promise<AppConfig> {
  const platforms = await Promise.all(config.platforms.map(async platform => ({
    ...platform,
    apiKey: isEncryptedSecret(platform.apiKey) ? platform.apiKey : await encryptSecret(platform.apiKey),
  })));
  const customPlatforms = config.customPlatforms
    ? await Promise.all(config.customPlatforms.map(async platform => ({
        ...platform,
        apiKey: isEncryptedSecret(platform.apiKey) ? platform.apiKey : await encryptSecret(platform.apiKey),
      })))
    : config.customPlatforms;
  const uploadCk = isEncryptedSecret(config.uploadCk) ? config.uploadCk : await encryptSecret(config.uploadCk);
  const cloudreveApiKey = isEncryptedSecret(config.cloudreveApiKey) ? config.cloudreveApiKey : await encryptSecret(config.cloudreveApiKey);
  return { ...config, platforms, customPlatforms, uploadCk, cloudreveApiKey };
}

/**
 * 将从 localStorage 读取到的存储快照中的加密字段解密还原为明文，
 * 用于恢复到 React 状态供业务逻辑使用。未加密（历史明文）字段原样返回。
 */
export async function decryptAppConfigFromStorage(config: AppConfig): Promise<AppConfig> {
  const platforms = await Promise.all(config.platforms.map(async platform => ({
    ...platform,
    apiKey: await decryptSecret(platform.apiKey),
  })));
  const customPlatforms = config.customPlatforms
    ? await Promise.all(config.customPlatforms.map(async platform => ({
        ...platform,
        apiKey: await decryptSecret(platform.apiKey),
      })))
    : config.customPlatforms;
  const uploadCk = await decryptSecret(config.uploadCk);
  const cloudreveApiKey = await decryptSecret(config.cloudreveApiKey);
  return { ...config, platforms, customPlatforms, uploadCk, cloudreveApiKey };
}
