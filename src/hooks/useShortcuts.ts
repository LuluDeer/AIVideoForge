import { useEffect } from 'react';

export type Shortcut = {
  /** Human-readable label, shown in the ? help dialog */
  label: string;
  /** Key combo: use lowercase, plus modifiers */
  combo: string;
  /** Whether the shortcut needs the current active tab to match */
  tab?: string;
  /** What to do when triggered */
  run: (e: KeyboardEvent) => void;
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const formatCombo = (raw: string): string => {
  const parts = raw.split('+').map(p => p.trim());
  return parts
    .map(p => {
      if (p === 'mod') return isMac ? '⌘' : 'Ctrl';
      if (p === 'ctrl') return isMac ? '⌃' : 'Ctrl';
      if (p === 'shift') return isMac ? '⇧' : 'Shift';
      if (p === 'alt') return isMac ? '⌥' : 'Alt';
      if (p === 'enter') return 'Enter';
      if (p === 'esc' || p === 'escape') return 'Esc';
      if (p === 'space') return 'Space';
      if (p === 'slash' || p === '/') return '/';
      if (p === '?' || p === 'question') return '?';
      return p.toUpperCase();
    })
    .join(' + ');
};

export const formatShortcut = (combo: string): string => formatCombo(combo);

const parseCombo = (combo: string): { key: string; mod: boolean; shift: boolean; alt: boolean; ctrl: boolean } => {
  const parts = combo.toLowerCase().split('+').map(p => p.trim());
  const out = { key: '', mod: false, shift: false, alt: false, ctrl: false };
  for (const p of parts) {
    if (p === 'mod' || p === 'cmd' || p === 'meta') out.mod = true;
    else if (p === 'ctrl') out.ctrl = true;
    else if (p === 'shift') out.shift = true;
    else if (p === 'alt' || p === 'option') out.alt = true;
    else if (p === 'enter') out.key = 'enter';
    else if (p === 'esc' || p === 'escape') out.key = 'escape';
    else if (p === 'space') out.key = ' ';
    else if (p === '/' || p === 'slash') out.key = '/';
    else if (p === '?' || p === 'question') out.key = '?';
    else out.key = p;
  }
  return out;
};

const eventMatches = (e: KeyboardEvent, combo: string): boolean => {
  const want = parseCombo(combo);
  const mod = e.metaKey || e.ctrlKey;
  // '?' is produced by shift+/ on most layouts
  if (want.key === '?') {
    return e.key === '?' && e.shiftKey && !e.altKey && !mod;
  }
  if (want.key === '/') {
    return e.key === '/' && !e.shiftKey && !e.altKey && !mod;
  }
  return e.key.toLowerCase() === want.key && mod === want.mod && e.shiftKey === want.shift && e.altKey === want.alt;
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
};

export type ShortcutOptions = {
  /** Global shortcuts always fire; scoped shortcuts only fire when activeTab matches */
  activeTab?: string;
};

export function useShortcuts(shortcuts: Shortcut[], options: ShortcutOptions = {}): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 1) shortcuts that explicitly opt out of editing areas (those with no inputs involved)
      const editable = isEditableTarget(e.target);
      for (const s of shortcuts) {
        if (s.tab && options.activeTab !== s.tab) continue;
        // For single-key shortcuts (no modifier) that target an input, skip — let the input handle it.
        const want = parseCombo(s.combo);
        const hasMod = want.mod || want.ctrl || want.alt || want.shift;
        if (!hasMod && editable) continue;
        if (eventMatches(e, s.combo)) {
          e.preventDefault();
          s.run(e);
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts, options.activeTab]);
}
