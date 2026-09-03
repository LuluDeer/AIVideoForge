import React, { useEffect, useState } from 'react';
import { X, Keyboard } from 'lucide-react';
import { formatShortcut } from '../hooks/useShortcuts';

export type ShortcutDescriptor = { combo: string; label: string; scope?: string };

const STORAGE_KEY = 'aivideoforge_shortcuts_help_dismissed';

const ShortcutsHelpDialog: React.FC<{ shortcuts: ShortcutDescriptor[] }> = ({ shortcuts }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    const hide = () => setOpen(false);
    window.addEventListener('aivideoforge:show-shortcuts', show);
    window.addEventListener('aivideoforge:hide-shortcuts', hide);
    return () => {
      window.removeEventListener('aivideoforge:show-shortcuts', show);
      window.removeEventListener('aivideoforge:hide-shortcuts', hide);
    };
  }, []);

  if (!open) return null;

  const grouped = shortcuts.reduce<Record<string, ShortcutDescriptor[]>>((acc, s) => {
    const key = s.scope ?? '通用';
    acc[key] ??= [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      onClick={() => {
        setOpen(false);
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* noop */ }
      }}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 id="shortcuts-title" className="flex items-center gap-2 text-base font-semibold text-gray-800">
            <Keyboard className="h-4 w-4 text-blue-600" /> 快捷键速查
          </h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-4">
          {Object.entries(grouped).map(([scope, items]) => (
            <section key={scope}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{scope}</h4>
              <ul className="space-y-1.5">
                {items.map(s => (
                  <li key={`${scope}-${s.combo}`} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 text-sm">
                    <span className="text-gray-700">{s.label}</span>
                    <kbd className="rounded-md border border-gray-200 bg-white px-2 py-0.5 font-mono text-[11px] text-gray-700">{formatShortcut(s.combo)}</kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-2 text-[11px] text-gray-500">
          按 <kbd className="rounded border border-gray-200 bg-white px-1 font-mono text-[10px]">?</kbd> 再次打开 / <kbd className="rounded border border-gray-200 bg-white px-1 font-mono text-[10px]">Esc</kbd> 关闭
        </div>
      </div>
    </div>
  );
};

export default ShortcutsHelpDialog;
