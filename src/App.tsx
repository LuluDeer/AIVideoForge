import React, { useState, lazy, Suspense } from 'react';
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
          <main className="flex-1 overflow-auto">
            <Suspense fallback={<LoadingFallback />}>
              {renderContent()}
            </Suspense>
          </main>
        </div>
      </TaskProvider>
    </ConfigProvider>
  );
};

export default App;
