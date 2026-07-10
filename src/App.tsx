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
const initialTheme: 'light' | 'dark' = localStorage.getItem('aivideoforge-theme') === 'dark' ? 'dark' : 'light';
document.documentElement.dataset.theme = initialTheme;
const ConfigPage = lazy(() => import('./pages/ConfigPage'));
const GeneratePage = lazy(() => import('./pages/GeneratePage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const LoadingFallback: React.FC = () => <div className="app-loading" aria-label="页面加载中"><div className="app-loading__spinner" /><span>正在准备工作台...</span></div>;

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('generate');
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);
  const { runningCount, reuseTaskData } = useTasks();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('aivideoforge-theme', theme);
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

  // #region debug-point A-E:dark-theme-cascade
  useEffect(() => {
    if (theme !== 'dark') return;
    const selectors = [
      '.config-page',
      '.config-page .config-platform-card',
      '.config-page .config-platform-card__header',
      '.config-page .config-platform-card__header *',
      '.config-page .config-platform-card > div:nth-child(2)',
      '.config-page .config-platform-card > div:nth-child(2) button',
      '.config-page .config-platform-card__body',
      '.config-page .config-platform-card__body > div',
      '.config-page .config-platform-card__body input',
      '.config-page .config-platform-card__body textarea',
      '.config-page .config-platform-card__body button',
      '.config-page .update-panel',
      '.config-page .update-panel *',
      '.config-page section',
      '.config-page .bg-white',
    ];
    let timer = 0;
    const report = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const data = selectors.flatMap(selector => Array.from(document.querySelectorAll<HTMLElement>(selector)).slice(0, 8).map((element, index) => {
          const style = window.getComputedStyle(element);
          const parentStyle = element.parentElement ? window.getComputedStyle(element.parentElement) : null;
          return {
            selector,
            index,
            tag: element.tagName,
            className: element.className,
            text: element.textContent?.trim().slice(0, 80),
            background: style.backgroundColor,
            backgroundImage: style.backgroundImage,
            color: style.color,
            border: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`,
            parentBackground: parentStyle?.backgroundColor,
            inlineStyle: element.getAttribute('style'),
          };
        }));
        fetch('http://127.0.0.1:7778/event', { method: 'POST', body: JSON.stringify({ sessionId: 'dark-theme-cascade', runId: 'pre-fix', hypothesisId: 'A-E', location: 'src/App.tsx:dark-theme-cascade', msg: '[DEBUG] Dark theme cascade snapshot', data: { theme: { html: document.documentElement.dataset.theme, body: document.body.dataset.theme ?? null }, styleSheets: Array.from(document.styleSheets).map(sheet => sheet.href ?? 'inline'), nodes: data }, ts: Date.now() }) }).catch(() => {});
      }, 250);
    };
    report();
    const observer = new MutationObserver(report);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [activeTab, theme]);
  // #endregion

  return <div className="app-shell">
    <Sidebar
      activeTab={activeTab}
      onTabChange={setActiveTab}
      runningCount={runningCount}
      theme={theme}
      onToggleTheme={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}
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
