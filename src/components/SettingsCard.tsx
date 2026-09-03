import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'border-gray-200 bg-white',
  success: 'border-emerald-200 bg-emerald-50/40',
  warning: 'border-amber-200 bg-amber-50/40',
  danger: 'border-red-200 bg-red-50/40',
  info: 'border-blue-200 bg-blue-50/40',
};

const BADGE_TONE: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-600',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
};

interface SettingsCardProps {
  /** 顶栏左侧图标（lucide） */
  icon: React.ReactNode;
  /** 卡片标题 */
  title: string;
  /** 卡片副标题/一句话描述 */
  description?: string;
  /** 状态徽章文字 */
  badge?: string;
  badgeTone?: Tone;
  /** 默认 true；若卡片需要折叠面板则传 false，并在内部自己放 [data-settings-card-body] */
  defaultOpen?: boolean;
  children: React.ReactNode;
  /** 右上角额外按钮区 */
  actions?: React.ReactNode;
}

const SettingsCard: React.FC<SettingsCardProps> = ({
  icon, title, description, badge, badgeTone = 'neutral',
  defaultOpen = true, children, actions,
}) => {
  const [open, setOpen] = React.useState(defaultOpen);
  const hasCollapse = defaultOpen === false;
  const tone: Tone = badgeTone ?? 'neutral';
  return (
    <div className={`settings-card flex flex-col rounded-xl border ${TONE_CLASSES[tone]} p-3 shadow-sm`}>
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/70 text-blue-600 ring-1 ring-blue-100">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
            {badge && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE_TONE[tone]}`}>
                {badge}
              </span>
            )}
          </div>
          {description && <p className="mt-0.5 text-[11px] leading-5 text-gray-500">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {hasCollapse && (
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              className="rounded p-1 text-gray-400 hover:bg-white/60 hover:text-gray-700"
              aria-label={open ? '折叠' : '展开'}
              aria-expanded={open}
            >
              {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
      {open && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
};

export default SettingsCard;
export type { Tone };
