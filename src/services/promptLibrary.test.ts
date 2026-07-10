import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_CUSTOM_PROMPTS,
  MAX_PROMPT_CATEGORY_LENGTH,
  MAX_PROMPT_TEXT_LENGTH,
  addCustomPrompt,
  cleanCustomPrompts,
  getAllCategories,
  initPromptLibrary,
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

describe('initPromptLibrary migration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456);
    Object.defineProperty(globalThis, 'window', { value: { localStorage: new MemoryStorage() }, configurable: true });
  });

  it('does nothing when both file and localStorage are empty', async () => {
    // window.electronAPI is undefined in test env, so readDataFileAsync returns fallback (null)
    await initPromptLibrary();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('migrates localStorage data to file when file is empty (first migration)', async () => {
    // Mock electronAPI for this test
    const writeSpy = vi.fn().mockResolvedValue({ success: true });
    const readSpy = vi.fn().mockResolvedValue(null); // file does not exist
    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage: new MemoryStorage(),
        electronAPI: { readDataFile: readSpy, writeDataFile: writeSpy },
      },
      configurable: true,
    });

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: '1', category: 'A', text: 'hello' },
      { id: '2', category: 'B', text: 'world' },
    ]));

    await initPromptLibrary();

    expect(readSpy).toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalledWith('prompt_library.json', expect.arrayContaining([
      expect.objectContaining({ id: '1', text: 'hello' }),
      expect.objectContaining({ id: '2', text: 'world' }),
    ]));
  });

  it('restores from file when localStorage is empty (after upgrade)', async () => {
    const writeSpy = vi.fn().mockResolvedValue({ success: true });
    const readSpy = vi.fn().mockResolvedValue([
      { id: '1', category: 'A', text: 'restored' },
    ]);
    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage: new MemoryStorage(),
        electronAPI: { readDataFile: readSpy, writeDataFile: writeSpy },
      },
      configurable: true,
    });

    // localStorage is empty (simulating upgrade clearing cache)
    await initPromptLibrary();

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ id: '1', text: 'restored' });
  });

  it('merges file and localStorage data with deduplication', async () => {
    const writeSpy = vi.fn().mockResolvedValue({ success: true });
    const readSpy = vi.fn().mockResolvedValue([
      { id: '1', category: 'A', text: 'from_file' },
      { id: '2', category: 'B', text: 'shared' },
    ]);
    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage: new MemoryStorage(),
        electronAPI: { readDataFile: readSpy, writeDataFile: writeSpy },
      },
      configurable: true,
    });

    // localStorage has 'shared' (duplicate) and 'from_ls' (unique)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: '3', category: 'B', text: 'shared' },
      { id: '4', category: 'C', text: 'from_ls' },
    ]));

    await initPromptLibrary();

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(stored).toHaveLength(3); // from_file, shared (deduped), from_ls
    expect(stored.map((p: { text: string }) => p.text).sort()).toEqual(['from_file', 'from_ls', 'shared']);
  });
});