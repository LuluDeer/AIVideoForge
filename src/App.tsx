import React, { useState, useEffect, lazy, Suspense } from 'react';
import { ConfigProvider } from './context/ConfigContext';
import { TaskProvider } from './context/TaskContext';
import { useTasks } from './context/useTasks';
import Sidebar from './components/Sidebar';
import './App.css';

const ConfigPage = lazy(() => import('./pages/ConfigPage'));
const GeneratePage = lazy(() => import('./pages/GeneratePage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));

const LoadingFallback: React.FC = () => (
  <div className="app-loading" aria-label="页面加载中">
    <div className="app-loading__spinner" />
    <span>正在准备工作台...</span>
  </div>
);

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('generate');
  const { runningCount, reuseTaskData } = useTasks();

  useEffect(() => {
    if (reuseTaskData) setActiveTab('generate');
  }, [reuseTaskData]);

  const isConfigTab = activeTab === 'config';

  return (
    <div className="app-shell">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} runningCount={runningCount} />
      <main className="app-main">
        <Suspense fallback={<LoadingFallback />}>
          {isConfigTab ? (
            <ConfigPage />
          ) : (
            <>
              <div style={{ display: activeTab === 'generate' ? 'block' : 'none' }}>
                <GeneratePage onNavigateToTasks={() => setActiveTab('tasks')} onNavigateToConfig={() => setActiveTab('config')} />
              </div>
              {activeTab === 'tasks' && <TasksPage />}
            </>
          )}
        </Suspense>
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <ConfigProvider>
    <TaskProvider>
      <AppContent />
    </TaskProvider>
  </ConfigProvider>
);

export default App;
