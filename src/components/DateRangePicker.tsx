import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateRangePickerProps {
  value: { from: string; to: string }; // YYYY-MM-DD
  onChange: (value: { from: string; to: string }) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 内部草稿状态：用户在面板中的临时选择
  const [draftFrom, setDraftFrom] = useState<string>(value.from);
  const [draftTo, setDraftTo] = useState<string>(value.to);
  const [viewDate, setViewDate] = useState<Date>(() => {
    const ref = value.from || value.to;
    return ref ? new Date(ref) : new Date();
  });

  // 跟踪 hover 用于预览范围高亮
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // 同步 props -> draft（打开面板时同步）
  useEffect(() => {
    if (open) {
      setDraftFrom(value.from);
      setDraftTo(value.to);
      const ref = value.from || value.to;
      setViewDate(ref ? new Date(ref) : new Date());
    }
  }, [open, value.from, value.to]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toDateStr = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const toDisplayStr = (s: string): string => {
    if (!s) return '—';
    const [y, m, d] = s.split('-');
    return `${y}/${m}/${d}`;
  };

  const sameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const isDateInRange = (date: Date): boolean => {
    // 已确认范围
    if (draftFrom && draftTo) {
      const from = new Date(draftFrom);
      const to = new Date(draftTo);
      return date.getTime() > from.getTime() && date.getTime() < to.getTime();
    }
    // 预览范围（仅选了开始）
    if (draftFrom && !draftTo && hoverDate) {
      const d = new Date(hoverDate);
      const from = new Date(draftFrom);
      const lo = d < from ? d : from;
      const hi = d < from ? from : d;
      return date.getTime() > lo.getTime() && date.getTime() < hi.getTime();
    }
    return false;
  };

  const isRangeStart = (date: Date): boolean =>
    !!draftFrom && sameDay(date, new Date(draftFrom));

  const isRangeEnd = (date: Date): boolean =>
    !!draftTo && sameDay(date, new Date(draftTo));

  const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];

  const daysInMonth = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const cells: (Date | null)[] = [];
    // 前面补空
    const startWeekday = firstDay.getDay();
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      cells.push(new Date(year, month, d));
    }
    return cells;
  }, [viewDate]);

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  const handleDateClick = (date: Date) => {
    const dateStr = toDateStr(date);
    if (!draftFrom || (draftFrom && draftTo)) {
      // 重新开始选
      setDraftFrom(dateStr);
      setDraftTo('');
    } else {
      // 选结束日期
      if (new Date(dateStr) < new Date(draftFrom)) {
        // 早于开始日期，重新开始
        setDraftFrom(dateStr);
        setDraftTo('');
      } else {
        setDraftTo(dateStr);
      }
    }
  };

  const handleConfirm = () => {
    onChange({ from: draftFrom, to: draftTo });
    setOpen(false);
  };

  const handleClear = () => {
    setDraftFrom('');
    setDraftTo('');
    onChange({ from: '', to: '' });
    setOpen(false);
  };

  const handleClearTrigger = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ from: '', to: '' });
  };

  const hasValue = value.from || value.to;

  const triggerText = hasValue
    ? `${toDisplayStr(value.from)}  →  ${toDisplayStr(value.to)}`
    : '开始日期  →  结束日期';

  return (
    <div ref={containerRef} className="relative">
      {/* 触发器 */}
      <div
        onClick={() => setOpen(o => !o)}
        className={`drp-trigger flex items-center h-9 rounded-lg border bg-[var(--surface-soft)] border-[var(--border-strong)] overflow-hidden cursor-pointer px-1 ${open ? 'drp-trigger--open' : ''}`}
      >
        <div className="flex items-center px-2 text-xs flex-1 whitespace-nowrap select-none">
          <span className={!hasValue ? 'text-[var(--text-soft)]' : 'text-[var(--text)]'}>{triggerText}</span>
        </div>
        {hasValue && (
          <button
            onClick={handleClearTrigger}
            className="flex items-center justify-center w-7 h-full text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors"
            title="清除日期筛选"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* 日历面板 */}
      {open && (
        <div className="drp-panel absolute right-0 top-full mt-1.5 z-50 w-[336px] rounded-xl border bg-[var(--surface-soft)] border-[var(--border-strong)] shadow-xl p-3">
          {/* 月份导航 */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={prevMonth}
              className="drp-nav-btn w-8 h-8 rounded-md flex items-center justify-center transition-colors"
              title="上个月"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-[var(--text)] select-none">
              {viewDate.getFullYear()} 年 {viewDate.getMonth() + 1} 月
            </span>
            <button
              onClick={nextMonth}
              className="drp-nav-btn w-8 h-8 rounded-md flex items-center justify-center transition-colors"
              title="下个月"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 星期标题 */}
          <div className="grid grid-cols-7 gap-0 mb-1">
            {weekdayLabels.map(w => (
              <div key={w} className="text-center text-xs text-[var(--text-soft)] py-1 select-none">
                {w}
              </div>
            ))}
          </div>

          {/* 日期网格 */}
          <div className="grid grid-cols-7 gap-0">
            {daysInMonth.map((date, idx) => {
              if (!date) return <div key={idx} className="h-9" />;
              const dateStr = toDateStr(date);
              const inRange = isDateInRange(date);
              const isStart = isRangeStart(date);
              const isEnd = isRangeEnd(date);
              const isSelected = isStart || isEnd;
              return (
                <div
                  key={idx}
                  onClick={() => handleDateClick(date)}
                  onMouseEnter={() => draftFrom && !draftTo && setHoverDate(dateStr)}
                  onMouseLeave={() => setHoverDate(null)}
                  className={`drp-day-cell relative text-center text-xs flex items-center justify-center h-9 cursor-pointer select-none ${isSelected ? 'drp-day--selected' : ''} ${isStart ? 'drp-day--range-start' : ''} ${isEnd ? 'drp-day--range-end' : ''}`}
                >
                  {/* 范围高亮背景（连接选中首尾） */}
                  {inRange && (
                    <div className="drp-day-range-bg absolute inset-x-0 inset-y-0" />
                  )}
                  {/* 选中日的圆形/半圆前景 */}
                  <span className="drp-day-num relative z-10 inline-flex items-center justify-center w-8 h-8 rounded-full text-[var(--text)]">
                    {date.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 底部按钮 */}
          <div className="flex justify-end gap-2 mt-3 pt-2.5 border-t border-[var(--border-strong)]">
            <button
              onClick={handleClear}
              className="drp-btn-clear px-3 py-1.5 text-xs rounded-md border transition-colors"
            >
              清除
            </button>
            <button
              onClick={handleConfirm}
              className="drp-btn-confirm px-3 py-1.5 text-xs rounded-md font-medium transition-all"
            >
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
