import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { deleteCustomPrompt, loadCustomPrompts, updateCustomPrompt, whenPromptLibraryReady } from '../../services/promptLibrary';
import type { PromptItem } from '../../services/promptLibrary';

interface PromptLibraryPanelProps {
  /** 布局测量锚点（Prompt 输入区），面板高度按所在滚动视口计算 */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** 内容变化触发重新测量（Prompt 输入框数量） */
  promptCount: number;
  /** 父页面新增词库条目后自增，面板据此重载列表并重置分类 */
  refreshVersion: number;
  onInsertPrompt: (text: string) => void;
  onClose: () => void;
}

/**
 * 个人词库面板：自包含词库状态（列表/分类/搜索/编辑）与 sticky 布局计算。
 * 启动时等待文件恢复完成后再刷新一次，避免与 initPromptLibrary 的竞态。
 */
const PromptLibraryPanel: React.FC<PromptLibraryPanelProps> = ({ anchorRef, promptCount, refreshVersion, onInsertPrompt, onClose }) => {
  const [promptLibrary, setPromptLibrary] = useState<PromptItem[]>(() => loadCustomPrompts());
  const [category, setCategory] = useState<string>('全部');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [editText, setEditText] = useState('');
  const [layout, setLayout] = useState<{ panelStyle: React.CSSProperties; listMaxHeight: number }>({
    panelStyle: { position: 'sticky', top: 24, width: '100%', maxHeight: '78vh' },
    listMaxHeight: 320,
  });

  useEffect(() => {
    let cancelled = false;
    void whenPromptLibraryReady().then(() => {
      if (!cancelled) setPromptLibrary(loadCustomPrompts());
    });
    return () => { cancelled = true; };
  }, []);

  // 父页面新增词库后重载列表并重置分类
  useEffect(() => {
    if (refreshVersion === 0) return;
    setPromptLibrary(loadCustomPrompts());
    setCategory('全部');
  }, [refreshVersion]);

  const updateLayout = useCallback(() => {
    if (typeof window === 'undefined') return;
    const scrollViewportRect = anchorRef.current?.closest('.app-main')?.getBoundingClientRect();
    const stickyOffset = 24;
    const viewportTop = scrollViewportRect?.top ?? 0;
    const viewportBottom = scrollViewportRect?.bottom ?? window.innerHeight;
    const availableHeight = viewportBottom - viewportTop - stickyOffset - 16;
    const maxHeight = Math.max(260, Math.min(availableHeight, window.innerHeight * 0.78));
    const listMaxHeight = Math.max(140, maxHeight - 178);

    setLayout(prev => {
      const current = prev.panelStyle;
      if (
        current.position === 'sticky' &&
        current.top === stickyOffset &&
        current.width === '100%' &&
        current.maxHeight === maxHeight &&
        prev.listMaxHeight === listMaxHeight
      ) {
        return prev;
      }
      return {
        panelStyle: { position: 'sticky', top: stickyOffset, width: '100%', maxHeight },
        listMaxHeight,
      };
    });
  }, [anchorRef]);

  useEffect(() => {
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => {
      window.removeEventListener('resize', updateLayout);
    };
  }, [updateLayout, promptCount, promptLibrary.length, editingId, search, category]);

  const categories = useMemo(() => ['全部', ...Array.from(new Set(promptLibrary.map(p => p.category)))], [promptLibrary]);
  const filteredPrompts = useMemo(() => {
    let list = category === '全部' ? promptLibrary : promptLibrary.filter(p => p.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.text.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    return list;
  }, [category, search, promptLibrary]);

  const handleStartEdit = (p: PromptItem) => {
    setEditingId(p.id);
    setEditCategory(p.category);
    setEditText(p.text);
  };
  const handleSaveEdit = () => {
    if (editingId) {
      updateCustomPrompt(editingId, { category: editCategory, text: editText });
      setPromptLibrary(loadCustomPrompts());
    }
    setEditingId(null);
  };
  const handleDeletePrompt = (id: string) => {
    deleteCustomPrompt(id);
    setPromptLibrary(loadCustomPrompts());
  };

  return (
    <div className="prompt-library-panel z-[1000] flex flex-col rounded-xl border border-purple-200 bg-white p-3 shadow-2xl" style={layout.panelStyle}>
      <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-purple-900">个人词库</p>
          <p className="mt-0.5 text-[11px] leading-4 text-gray-500">仅展示你自己保存的提示词，可编辑分类。</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-purple-50 hover:text-purple-600 active:bg-purple-100 focus:bg-purple-50"
          title="关闭词库"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 shrink-0">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索个人提示词..."
          className="prompt-library-search w-full min-h-10 rounded-lg border border-purple-200 px-3 py-2 text-sm leading-normal focus:outline-none focus:ring-2 focus:ring-purple-100"
        />
      </div>

      <div className="mb-2 flex shrink-0 flex-wrap gap-1.5">
        {categories.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`min-h-8 rounded-full border px-3 py-1 text-xs font-medium leading-normal transition-colors focus:outline-none focus:ring-2 focus:ring-purple-100 ${
              category === cat
                ? '!border-purple-600 !bg-purple-600 !text-white hover:!bg-purple-700 active:!bg-purple-800 focus:!bg-purple-600'
                : '!border-purple-200 !bg-purple-100 !text-purple-700 hover:!bg-purple-200 active:!bg-purple-200 focus:!bg-purple-100'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="prompt-library-list min-h-0 space-y-1 overflow-y-auto pr-1" style={{ maxHeight: layout.listMaxHeight }}>
        {filteredPrompts.length === 0 ? (
          <p className="py-4 text-center text-xs leading-5 text-gray-400">暂无个人提示词。先在左侧填写 Prompt，再点击输入框右侧的“添加词库”。</p>
        ) : filteredPrompts.map(p => (
          <div key={p.id} className="group rounded border border-purple-100 bg-white p-2 transition-colors hover:border-purple-300">
            {editingId === p.id ? (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                  className="min-h-10 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm leading-normal focus:outline-none focus:ring-2 focus:ring-purple-100"
                  placeholder="分类"
                />
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  className="w-full min-h-[88px] rounded-lg border border-gray-200 px-3 py-2 text-sm leading-normal resize-y focus:outline-none focus:ring-2 focus:ring-purple-100"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingId(null)} className="min-h-9 rounded-lg px-3 py-2 text-sm leading-normal text-gray-600 hover:bg-gray-100">取消</button>
                  <button type="button" onClick={handleSaveEdit} className="prompt-library-save min-h-9 rounded-lg border border-purple-600 bg-purple-600 px-3 py-2 text-sm font-medium leading-normal text-white shadow-sm transition-colors hover:bg-purple-700 active:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-200" data-prompt-library-action="save">保存</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => onInsertPrompt(p.text)}
                    className="prompt-library-item-text flex-1 text-left text-xs leading-relaxed text-gray-700"
                    style={{ maxHeight: '6.5em', overflowY: 'auto', whiteSpace: 'pre-wrap' }}
                    title="点击填充到空 Prompt；没有空输入框时自动新增"
                  >
                    {p.text}
                  </button>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(p)}
                      className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-600 shadow-sm hover:border-amber-300 hover:bg-amber-100 hover:text-amber-700"
                      title="编辑提示词"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePrompt(p.id)}
                      className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-500 shadow-sm hover:border-red-300 hover:bg-red-100 hover:text-red-600"
                      title="删除提示词"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-0.5 flex items-center gap-1">
                  <span className="rounded bg-purple-50 px-1 text-[10px] text-purple-500">{p.category}</span>
                  <span className="sr-only">个人提示词</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 shrink-0 text-center text-[10px] text-gray-400">点击提示词会优先填充空输入框，没有空输入框时自动新增，词库面板会保持打开。</p>
    </div>
  );
};

export default PromptLibraryPanel;
