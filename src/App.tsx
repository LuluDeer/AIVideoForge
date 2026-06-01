import React, { useState, useEffect, lazy, Suspense } from 'react';
import { ConfigProvider } from './context/ConfigContext';
import { TaskProvider } from './context/TaskContext';
import Sidebar from './components/Sidebar';

const ConfigPage = lazy(() => import('./pages/ConfigPage'));
const GeneratePage = lazy(() => import('./pages/GeneratePage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const ModelConfigPage = lazy(() => import('./pages/ModelConfigPage'));

const LoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
  </div>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('generate');
  const [showFirstRunBanner, setShowFirstRunBanner] = useState(false);

  useEffect(() => {
    const hasData = !!localStorage.getItem('model_configs') || !!localStorage.getItem('geekai_config');
    const dismissed = !!localStorage.getItem('first_run_banner_dismissed');
    if (!hasData && !dismissed) {
      setShowFirstRunBanner(true);
    }
  }, []);

  const dismissBanner = () => {
    localStorage.setItem('first_run_banner_dismissed', '1');
    setShowFirstRunBanner(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'config':
        return <ConfigPage />;
      case 'generate':
        return <GeneratePage />;
      case 'tasks':
        return <TasksPage />;
      case 'modelConfig':
        return <ModelConfigPage />;
      default:
        return <GeneratePage />;
    }
  };

  return (
    <ConfigProvider>
      <TaskProvider>
        <div className="flex h-screen bg-gray-100">
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
          <main className="flex-1 overflow-auto flex flex-col">
            {showFirstRunBanner && (
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border-b border-amber-200 flex-shrink-0">
                <span className="text-amber-500 text-base leading-5 flex-shrink-0">⚠</span>
                <p className="flex-1 text-sm text-amber-800">
                  <span className="font-medium">首次使用提示：</span>
                  如需从其他客户端迁移配置，请先在「模型配置」页导入参数配置，再在「系统配置」页导入系统配置，否则可能产生多余的临时配置。
                </p>
                <button
                  onClick={dismissBanner}
                  className="text-amber-400 hover:text-amber-600 flex-shrink-0 text-xl leading-none"
                  aria-label="关闭提示"
                >
                  ×
                </button>
              </div>
            )}
            <div className="flex-1 overflow-auto">
              <Suspense fallback={<LoadingFallback />}>
                {renderContent()}
              </Suspense>
            </div>
          </main>
        </div>
      </TaskProvider>
    </ConfigProvider>
  );
};

export default App;
