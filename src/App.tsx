import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { ConfigProvider } from './context/ConfigContext';
import { TaskProvider } from './context/TaskContext';
import { OfflineQueueProvider } from './context/OfflineQueueContext';
import { useTasks } from './context/useTasks';
import Sidebar from './components/Sidebar';
import OnboardingOverlay from './components/OnboardingOverlay';
import ErrorBoundary from './components/ErrorBoundary';
import ShortcutsHelpDialog, { type ShortcutDescriptor } from './components/ShortcutsHelpDialog';
import { useShortcuts } from './hooks/useShortcuts';
import { initPromptLibrary, setPromptLibraryReady } from './services/promptLibrary';
import './App.css';
import './theme-dark.css';

setPromptLibraryReady(initPromptLibrary());
type Theme = 'light' | 'dark';
const THEME_STORAGE_KEY = 'aivideoforge-theme';
const DEFAULT_THEME: Theme = 'light';
const readInitialTheme = (): Theme => {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};
const persistTheme = (theme: Theme) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 存储不可用时仍允许本次会话切换主题。
  }
};
const initialTheme = readInitialTheme();
document.documentElement.dataset.theme = initialTheme;
const ConfigPage = lazy(() => import('./pages/ConfigPage'));
const GeneratePage = lazy(() => import('./pages/GeneratePage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const LoadingFallback: React.FC = () => <div className="app-loading" aria-label="页面加载中"><div className="app-loading__spinner" /><span>正在准备工作台...</span></div>;

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('generate');
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const { runningCount, reuseTaskData } = useTasks();
  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => { if (reuseTaskData) setActiveTab('generate'); }, [reuseTaskData]);

  const focusTaskSearch = () => {
    const alreadyOnTasks = activeTabRef.current === 'tasks';
    if (!alreadyOnTasks) setActiveTab('tasks');
    window.setTimeout(() => window.dispatchEvent(new Event('aivideoforge:focus-task-search')), alreadyOnTasks ? 0 : 350);
  };

  const refreshTasks = () => {
    const alreadyOnTasks = activeTabRef.current === 'tasks';
    if (!alreadyOnTasks) setActiveTab('tasks');
    window.setTimeout(() => window.dispatchEvent(new Event('aivideoforge:refresh-tasks')), alreadyOnTasks ? 0 : 350);
  };

  const shortcuts = React.useMemo(() => [
    { combo: 'mod+f', label: '聚焦任务搜索框', tab: 'tasks', run: focusTaskSearch },
    { combo: 'mod+r', label: '同步云端任务列表', tab: 'tasks', run: refreshTasks },
    { combo: 'mod+shift+g', label: '跳到视频生成页', run: () => setActiveTab('generate') },
    { combo: 'mod+shift+t', label: '跳到任务管理页', run: () => setActiveTab('tasks') },
    { combo: 'mod+shift+,', label: '跳到系统配置页', run: () => setActiveTab('config') },
    { combo: '/', label: '聚焦当前页主搜索', run: () => {
      // 让对应页面响应；找不到监听者时不抢焦。
      window.dispatchEvent(new CustomEvent('aivideoforge:focus-page-search', { detail: { tab: activeTabRef.current } }));
    } },
    { combo: '?', label: '打开快捷键速查', run: () => window.dispatchEvent(new Event('aivideoforge:show-shortcuts')) },
    { combo: 'esc', label: '关闭顶层弹窗', run: () => window.dispatchEvent(new Event('aivideoforge:close-overlay')) },
  ], []);

  useShortcuts(shortcuts);

  const shortcutList = React.useMemo<ShortcutDescriptor[]>(() => [
    { combo: 'mod+shift+g', label: '跳到视频生成页', scope: '导航' },
    { combo: 'mod+shift+t', label: '跳到任务管理页', scope: '导航' },
    { combo: 'mod+shift+,', label: '跳到系统配置页', scope: '导航' },
    { combo: 'mod+f', label: '聚焦任务搜索框', scope: '任务管理' },
    { combo: 'mod+r', label: '同步云端任务列表', scope: '任务管理' },
    { combo: '/', label: '聚焦当前页主搜索', scope: '通用' },
    { combo: '?', label: '打开 / 关闭快捷键速查', scope: '通用' },
    { combo: 'esc', label: '关闭弹窗 / 对话框', scope: '通用' },
  ], []);

  return <div className="app-shell">
    <Sidebar
      activeTab={activeTab}
      onTabChange={setActiveTab}
      runningCount={runningCount}
      theme={theme}
      onToggleTheme={() => setTheme(value => {
        const nextTheme = value === 'dark' ? 'light' : 'dark';
        persistTheme(nextTheme);
        return nextTheme;
      })}
      onOpenOnboarding={() => window.dispatchEvent(new Event('aivideoforge:open-onboarding'))}
      onOpenShortcuts={() => window.dispatchEvent(new Event('aivideoforge:show-shortcuts'))}
    />
    <ShortcutsHelpDialog shortcuts={shortcutList} />
    <main className="app-main">
      <Suspense fallback={<LoadingFallback />}>
        {activeTab === 'config' ? <ConfigPage /> : <>
          <div style={{ display: activeTab === 'generate' ? 'block' : 'none' }}>
            <GeneratePage onNavigateToTasks={() => setActiveTab('tasks')} onNavigateToConfig={() => setActiveTab('config')} />
          </div>
          {activeTab === 'tasks' && <TasksPage />}
        </>}
      </Suspense>
    </main>
    <OnboardingOverlay onNavigate={setActiveTab} />
  </div>;
};

const App: React.FC = () => <ErrorBoundary><ConfigProvider><TaskProvider><OfflineQueueProvider><AppContent /></OfflineQueueProvider></TaskProvider></ConfigProvider></ErrorBoundary>;
export default App;
