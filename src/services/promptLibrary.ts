/**
 * 提示词库管理服务
 * - 内置默认提示词作为基础库
 * - 用户自定义提示词通过 localStorage（运行时缓存）+ 文件系统（持久化）双写
 * - 启动时从文件恢复数据，确保升级后不丢失
 * - 提供合并查询、增删改接口
 */

import { readJsonStorage, writeJsonStorage, readDataFileAsync, writeDataFileAsync } from '../utils/storage';
import { logger } from '../utils/logger';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export interface PromptItem {
  id: string;
  category: string;
  text: string;
  builtin?: boolean; // 是否为内置提示词（内置不可删除）
}

const STORAGE_KEY = 'geekai_prompt_library';
const DATA_FILENAME = 'prompt_library.json';
export const MAX_CUSTOM_PROMPTS = 200;
export const MAX_PROMPT_TEXT_LENGTH = 2000;
export const MAX_PROMPT_CATEGORY_LENGTH = 80;

const truncate = (value: string, max: number): string => value.length > max ? value.slice(0, max) : value;

// 内置默认提示词
const BUILTIN_PROMPTS: PromptItem[] = [
  { id: 'b1', category: '自然风景', builtin: true, text: '壮观的山脉日出，金色阳光穿透云层，薄雾缭绕山谷，超写实风格，电影级画质' },
  { id: 'b2', category: '自然风景', builtin: true, text: '热带雨林中的瀑布，水雾弥漫，阳光透过树冠形成丁达尔光效，4K超清' },
  { id: 'b3', category: '自然风景', builtin: true, text: '极光在夜空中舞动，绿色与紫色交织，倒映在宁静的湖面上，延时摄影风格' },
  { id: 'b4', category: '城市建筑', builtin: true, text: '未来都市夜景，霓虹灯倒映在雨后街道，赛博朋克风格，高对比度' },
  { id: 'b5', category: '城市建筑', builtin: true, text: '古典欧式建筑广场，鸽子飞起的瞬间，慢动作，暖色调，胶片质感' },
  { id: 'b6', category: '人物动作', builtin: true, text: '芭蕾舞演员在舞台上旋转，白色纱裙飘动，追光灯效果，慢动作' },
  { id: 'b7', category: '人物动作', builtin: true, text: '极限运动员在悬崖边滑翔，第一人称视角，风速感强烈，GoPro风格' },
  { id: 'b8', category: '动物自然', builtin: true, text: '猎豹在草原上全速奔跑追逐猎物，慢动作，肌肉线条清晰，BBC纪录片风格' },
  { id: 'b9', category: '动物自然', builtin: true, text: '深海水母群在蓝色光芒中漂浮，发光触须随水流摆动，梦幻感' },
  { id: 'b10', category: '抽象创意', builtin: true, text: '液态金属在空中流动变形，反射周围环境，超写实CGI，黑色背景' },
  { id: 'b11', category: '抽象创意', builtin: true, text: '彩色墨水在水中扩散，慢动作，微距镜头，色彩鲜艳对比强烈' },
  { id: 'b12', category: '产品展示', builtin: true, text: '高端香水瓶在黑色背景下旋转，光线折射出彩虹色，奢华质感' },
  { id: 'b13', category: '产品展示', builtin: true, text: '运动鞋从各角度展示，动态光影，粒子爆炸特效，品牌广告风格' },
];

/** 生成简单唯一 ID */
const genId = (): string => `u${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * 保存用户自定义提示词到 localStorage（同步缓存）
 * 同时异步写入文件系统作为持久化备份
 */
const saveCustomPrompts = (items: PromptItem[]): void => {
  writeJsonStorage(STORAGE_KEY, items, error => {
    logger.warn('promptLibrary', '保存 Prompt 库到 localStorage 失败', error);
  });
  // 异步写入文件，fire-and-forget
  writeDataFileAsync(DATA_FILENAME, items).then(ok => {
    if (!ok) logger.warn('promptLibrary', '保存 Prompt 库到文件失败');
  });
};

export const normalizePromptItem = (value: unknown): PromptItem | null => {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' && value.id.trim() ? truncate(value.id.trim(), 120) : genId();
  const text = typeof value.text === 'string' ? truncate(value.text.trim(), MAX_PROMPT_TEXT_LENGTH) : '';
  if (!text) return null;
  const rawCategory = typeof value.category === 'string' && value.category.trim() ? value.category.trim() : '自定义';
  return { id, category: truncate(rawCategory, MAX_PROMPT_CATEGORY_LENGTH), text };
};

export const cleanCustomPrompts = (raw: unknown[]): PromptItem[] => {
  const seen = new Set<string>();
  const cleaned: PromptItem[] = [];
  for (const item of raw) {
    const normalized = normalizePromptItem(item);
    if (!normalized) continue;
    const dedupeKey = `${normalized.category}\n${normalized.text}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    cleaned.push(normalized);
    if (cleaned.length >= MAX_CUSTOM_PROMPTS) break;
  }
  return cleaned;
};

/** 读取用户自定义提示词，并清理旧 schema/脏数据 */
export const loadCustomPrompts = (): PromptItem[] => {
  const raw = readJsonStorage<unknown[]>(STORAGE_KEY, [], Array.isArray);
  const cleaned = cleanCustomPrompts(raw);
  if (cleaned.length !== raw.length) saveCustomPrompts(cleaned);
  return cleaned;
};

/**
 * 词库初始化就绪信号：App 启动时通过 setPromptLibraryReady 注入 initPromptLibrary() 的 Promise，
 * 消费方（如 GeneratePage）await 它以确保文件恢复完成后再读取，避免启动竞态。
 */
let readyPromise: Promise<void> = Promise.resolve();
export const setPromptLibraryReady = (promise: Promise<void>): void => { readyPromise = promise; };
export const whenPromptLibraryReady = (): Promise<void> => readyPromise;

/**
 * 应用启动时调用：从文件系统恢复词库到 localStorage。
 * - 如果文件中有数据但 localStorage 为空（如升级安装后 Chromium 缓存丢失），从文件恢复
 * - 如果两边都有数据，取并集去重
 * - 如果文件不存在但 localStorage 有数据，将 localStorage 数据写入文件（首次迁移）
 */
export const initPromptLibrary = async (): Promise<void> => {
  try {
    const fileData = await readDataFileAsync<unknown[] | null>(DATA_FILENAME, null);
    const lsRaw = readJsonStorage<unknown[]>(STORAGE_KEY, [], Array.isArray);

    if (fileData && Array.isArray(fileData) && fileData.length > 0) {
      // 文件有数据
      const fileCleaned = cleanCustomPrompts(fileData);
      const lsCleaned = cleanCustomPrompts(lsRaw);

      // 合并去重
      const merged = [...fileCleaned];
      const seen = new Set(fileCleaned.map(p => `${p.category}\n${p.text}`));
      for (const item of lsCleaned) {
        const key = `${item.category}\n${item.text}`;
        if (!seen.has(key)) {
          merged.push(item);
          seen.add(key);
        }
      }

      if (merged.length !== lsCleaned.length) {
        // localStorage 需要更新（恢复或合并了数据）
        writeJsonStorage(STORAGE_KEY, merged, error => {
          logger.warn('promptLibrary', '恢复词库到 localStorage 失败', error);
        });
      }
      if (merged.length !== fileCleaned.length) {
        // 文件也需要更新（合并了 localStorage 独有的数据）
        await writeDataFileAsync(DATA_FILENAME, merged);
      }
    } else if (lsRaw.length > 0) {
      // 文件不存在但 localStorage 有数据：首次迁移
      const lsCleaned = cleanCustomPrompts(lsRaw);
      await writeDataFileAsync(DATA_FILENAME, lsCleaned);
    }
  } catch (error) {
    logger.warn('promptLibrary', '词库迁移/恢复失败', error);
  }
};

/** 获取全部提示词（内置 + 自定义） */
export const getAllPrompts = (): PromptItem[] => {
  const custom = loadCustomPrompts();
  return [...BUILTIN_PROMPTS, ...custom];
};

/** 添加一条自定义提示词 */
export const addCustomPrompt = (category: string, text: string): PromptItem => {
  const trimmedCat = truncate(category.trim() || '自定义', MAX_PROMPT_CATEGORY_LENGTH);
  const trimmedText = truncate(text.trim(), MAX_PROMPT_TEXT_LENGTH);
  const item: PromptItem = { id: genId(), category: trimmedCat, text: trimmedText };
  const custom = loadCustomPrompts();
  custom.push(item);
  saveCustomPrompts(cleanCustomPrompts(custom));
  return item;
};

/** 更新一条自定义提示词 */
export const updateCustomPrompt = (id: string, patch: Partial<Pick<PromptItem, 'category' | 'text'>>): void => {
  const custom = loadCustomPrompts();
  const idx = custom.findIndex(p => p.id === id);
  if (idx >= 0) {
    if (patch.category) custom[idx].category = truncate(patch.category.trim() || '自定义', MAX_PROMPT_CATEGORY_LENGTH);
    if (patch.text !== undefined) custom[idx].text = truncate(patch.text.trim(), MAX_PROMPT_TEXT_LENGTH);
    saveCustomPrompts(cleanCustomPrompts(custom));
  }
};

/** 删除一条自定义提示词 */
export const deleteCustomPrompt = (id: string): void => {
  const custom = loadCustomPrompts().filter(p => p.id !== id);
  saveCustomPrompts(custom);
};

/** 获取所有分类 */
export const getAllCategories = (): string[] => {
  const set = new Set<string>();
  getAllPrompts().forEach(p => set.add(p.category));
  return Array.from(set);
};

export { BUILTIN_PROMPTS };