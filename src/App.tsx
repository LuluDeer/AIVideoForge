import React, { useEffect, useState, lazy, Suspense } from 'react';
import { ConfigProvider } from './context/ConfigContext';
import { TaskProvider } from './context/TaskContext';
import { OfflineQueueProvider } from './context/OfflineQueueContext';
import { useTasks } from './context/useTasks';
import Sidebar from './components/Sidebar';
import OnboardingOverlay from './components/OnboardingOverlay';
import ErrorBoundary from './components/ErrorBoundary';
import { initPromptLibrary } from './services/promptLibrary';
import './App.css';
import './theme-dark.css';

initPromptLibrary();
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => { if (reuseTaskData) setActiveTab('generate'); }, [reuseTaskData]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setActiveTab('tasks');
        window.dispatchEvent(new Event('aivideoforge:focus-task-search'));
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        window.dispatchEvent(new Event('aivideoforge:refresh-tasks'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
    />
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
