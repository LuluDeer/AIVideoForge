import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X, Sparkles, Keyboard } from 'lucide-react';
import { readDataFileAsync, readJsonStorage, writeDataFileAsync, writeJsonStorage } from '../utils/storage';

type Props = { onNavigate: (tab: string) => void };
type OnboardingState = { completedVersion?: number };

const STORAGE_KEY = 'aivideoforge_onboarding_done';
const DATA_FILENAME = 'onboarding_state.json';
const CURRENT_VERSION = 2;

const readCachedVersion = () => {
  const cached = readJsonStorage<number | string | null>(STORAGE_KEY, null);
  return Number(cached) || 0;
};

type StepDef = {
  title: string;
  body: string;
  tab: string;
  image: string;
  highlight?: string;
  detail?: string;
};

const STEPS: StepDef[] = [
  {
    title: '欢迎使用 AIVideoForge',
    body: '这是一个多平台 AI 视频生成工作台，支持 Seedance / 火山方舟、GeekAI、APIZZZ、Kling 等平台。下面用 4 步完成首次使用。',
    tab: 'generate',
    image: 'docs/images/generate-page.png',
    detail: '左侧三个主标签：视频生成、任务管理、系统配置。',
  },
  {
    title: '1. 配置平台与模型',
    body: '先到「系统配置」填写平台 API Key，确认可用模型。建议开启自动下载并选择本地下载目录，方便后续离线归档。',
    tab: 'config',
    image: 'docs/images/config-page.png',
    highlight: 'config',
    detail: '点「开始使用」会跳到配置页并自动滚到平台卡片。',
  },
  {
    title: '2. 选择模式并填写 Prompt',
    body: '回到「视频生成」选择模式（文生视频/图生视频/首尾帧/多图/多模态）、模型、参数，填入 Prompt 后提交。',
    tab: 'generate',
    image: 'docs/images/generate-page.png',
    highlight: 'generate',
    detail: '支持批量 Prompt；可一键保存到「个人词库」复用。',
  },
  {
    title: '3. 在任务管理页追踪结果',
    body: '任务页会显示状态、缩略图、自动下载进度。支持搜索、筛选、批量重试、复用参数与复制任务 ID。',
    tab: 'tasks',
    image: 'docs/images/tasks-page.png',
    detail: '失败任务点击重试即可生成变体；右键任务可快速复用参数。',
  },
];

const KEYBOARD_HINTS: { key: string; desc: string }[] = [
  { key: 'Ctrl/⌘ + F', desc: '在任务页聚焦搜索框' },
  { key: 'Ctrl/⌘ + R', desc: '在任务页同步云端任务列表' },
  { key: 'Ctrl/⌘ + Shift + G', desc: '跳到视频生成页' },
  { key: 'Ctrl/⌘ + Shift + T', desc: '跳到任务管理页' },
  { key: 'Ctrl/⌘ + Shift + ,', desc: '跳到系统配置页' },
  { key: '/', desc: '在当前页聚焦主搜索框' },
  { key: '?', desc: '打开 / 关闭快捷键速查' },
  { key: 'Esc', desc: '关闭弹窗或对话框' },
];

const OnboardingOverlay: React.FC<Props> = ({ onNavigate }) => {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(() => {
    if (readCachedVersion() >= CURRENT_VERSION) return false;
    return !window.electronAPI?.readDataFile;
  });

  useEffect(() => {
    if (!window.electronAPI?.readDataFile) return;

    let cancelled = false;
    const restore = async () => {
      const cachedVersion = readCachedVersion();
      const state = await readDataFileAsync<OnboardingState | null>(DATA_FILENAME, null);
      if (cancelled) return;

      const fileVersion = Number(state?.completedVersion) || 0;
      const completedVersion = Math.max(cachedVersion, fileVersion);
      if (completedVersion >= CURRENT_VERSION) {
        writeJsonStorage(STORAGE_KEY, CURRENT_VERSION);
        setVisible(false);
        if (fileVersion < CURRENT_VERSION) {
          void writeDataFileAsync(DATA_FILENAME, { completedVersion: CURRENT_VERSION });
        }
      } else {
        setVisible(true);
      }
    };

    void restore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const open = () => { setIndex(0); setVisible(true); };
    window.addEventListener('aivideoforge:open-onboarding', open);
    return () => window.removeEventListener('aivideoforge:open-onboarding', open);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') setIndex(v => Math.min(STEPS.length - 1, v + 1));
      else if (e.key === 'ArrowLeft') setIndex(v => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!visible) return null;

  const close = () => {
    setVisible(false);
    writeJsonStorage(STORAGE_KEY, CURRENT_VERSION);
    void writeDataFileAsync(DATA_FILENAME, { completedVersion: CURRENT_VERSION });
  };

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const goToStepTarget = () => {
    onNavigate(step.tab);
    if (step.highlight) {
      // 等页面挂载后定位锚点；Generate/Config/Tasks 都在 data-anchor 上声明区域
      window.setTimeout(() => {
        const el = document.querySelector(`[data-anchor="${step.highlight}"]`);
        if (el && 'scrollIntoView' in el) {
          (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 280);
    }
    if (isLast) close();
    else setIndex(v => v + 1);
  };

  return (
    <div className="onboarding-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-dialog flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:flex-row">
        <div className="onboarding-figure relative hidden bg-gradient-to-br from-blue-600 to-indigo-600 md:flex md:w-2/5 md:flex-col md:justify-between md:p-6 md:text-white">
          <div className="flex items-center gap-2 text-sm font-semibold opacity-90">
            <Sparkles className="h-4 w-4" />
            AIVideoForge · 快速上手
          </div>
          <div className="relative my-4 aspect-video w-full overflow-hidden rounded-lg border border-white/30 bg-white/10">
            <img
              src={step.image}
              alt={step.title}
              className="h-full w-full object-cover object-top"
              loading="lazy"
            />
          </div>
          <div className="space-y-1.5 text-xs leading-5 text-blue-50/90">
            <div className="flex items-center gap-1.5 font-semibold text-white/95">
              <Keyboard className="h-3.5 w-3.5" /> 常用快捷键
            </div>
            {KEYBOARD_HINTS.slice(0, 4).map(h => (
              <div key={h.key} className="flex items-center gap-2">
                <kbd className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] leading-4">{h.key}</kbd>
                <span className="truncate">{h.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-6 md:p-8">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-blue-600">快速上手 {index + 1} / {STEPS.length}</p>
            <button type="button" onClick={close} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="关闭引导">
              <X className="h-4 w-4" />
            </button>
          </div>
          <h2 id="onboarding-title" className="text-xl font-semibold text-gray-900">{step.title}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">{step.body}</p>
          {step.detail && (
            <p className="mt-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs leading-5 text-blue-800">{step.detail}</p>
          )}

          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-[11px] leading-5 text-gray-500 md:hidden">
            <div className="mb-1 font-semibold text-gray-700">常用快捷键</div>
            <ul className="space-y-0.5">
              {KEYBOARD_HINTS.slice(0, 4).map(h => (
                <li key={h.key} className="flex items-center gap-2">
                  <kbd className="rounded bg-white px-1 font-mono text-[10px] leading-4 text-gray-700">{h.key}</kbd>
                  <span>{h.desc}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 flex items-center gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={index + 1}>
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i <= index ? 'bg-blue-600' : 'bg-gray-200'}`}
                aria-label={`跳到第 ${i + 1} 步`}
              />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between gap-2">
            <button type="button" onClick={close} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">跳过</button>
            <div className="flex items-center gap-2">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => setIndex(v => v - 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4" /> 上一步
                </button>
              )}
              <button
                type="button"
                onClick={goToStepTarget}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                {isLast ? '开始使用' : (step.tab === 'generate' && index === 0 ? '我知道了，下一步' : '跳转并继续')}
                {!isLast && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingOverlay;
