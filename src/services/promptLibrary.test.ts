import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_CUSTOM_PROMPTS,
  MAX_PROMPT_CATEGORY_LENGTH,
  MAX_PROMPT_TEXT_LENGTH,
  addCustomPrompt,
  cleanCustomPrompts,
  getAllCategories,
  loadCustomPrompts,
  normalizePromptItem,
} from './promptLibrary';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, value); }
}

const STORAGE_KEY = 'geekai_prompt_library';

describe('promptLibrary sanitizers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456);
    Object.defineProperty(globalThis, 'window', { value: { localStorage: new MemoryStorage() }, configurable: true });
  });

  it('normalizes dirty prompt items and filters empty text', () => {
    expect(normalizePromptItem({ category: '  cat  ', text: '  hello  ' })).toMatchObject({ category: 'cat', text: 'hello' });
    expect(normalizePromptItem({ category: 'cat', text: '   ' })).toBeNull();
    const long = normalizePromptItem({
      id: 'x'.repeat(200),
      category: 'c'.repeat(MAX_PROMPT_CATEGORY_LENGTH + 10),
      text: 't'.repeat(MAX_PROMPT_TEXT_LENGTH + 10),
    });
    expect(long?.id).toHaveLength(120);
    expect(long?.category).toHaveLength(MAX_PROMPT_CATEGORY_LENGTH);
    expect(long?.text).toHaveLength(MAX_PROMPT_TEXT_LENGTH);
  });

  it('deduplicates, drops invalid rows and caps custom prompt count', () => {
    const raw = [
      { id: '1', category: 'A', text: 'same' },
      { id: '2', category: 'A', text: 'same' },
      { id: '3', category: 'A', text: '' },
      ...Array.from({ length: MAX_CUSTOM_PROMPTS + 5 }, (_, index) => ({ id: `p-${index}`, category: 'B', text: `text-${index}` })),
    ];
    const cleaned = cleanCustomPrompts(raw);
    expect(cleaned).toHaveLength(MAX_CUSTOM_PROMPTS);
    expect(cleaned.filter(item => item.text === 'same')).toHaveLength(1);
    expect(cleaned.some(item => item.text === '')).toBe(false);
  });

  it('loads cleaned localStorage data and saves cleaned rows back', () => {
    globalThis.window.localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: '1', category: 'A', text: 'keep' },
      { id: '2', category: 'A', text: 'keep' },
      { id: '3', category: 'A', text: '   ' },
    ]));
    expect(loadCustomPrompts()).toEqual([{ id: '1', category: 'A', text: 'keep' }]);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(1);
  });

  it('trims additions and exposes categories without empty custom values', () => {
    const item = addCustomPrompt('', `  ${'x'.repeat(MAX_PROMPT_TEXT_LENGTH + 5)}  `);
    expect(item.category).toBe('自定义');
    expect(item.text).toHaveLength(MAX_PROMPT_TEXT_LENGTH);
    expect(getAllCategories()).toContain('自定义');
  });
});
