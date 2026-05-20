import React, { useState } from 'react';
import { ConfigProvider } from './context/ConfigContext';
import { TaskProvider } from './context/TaskContext';
import Sidebar from './components/Sidebar';
import ConfigPage from './pages/ConfigPage';
import GeneratePage from './pages/GeneratePage';
import TasksPage from './pages/TasksPage';

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
            {renderContent()}
          </main>
        </div>
      </TaskProvider>
    </ConfigProvider>
  );
};

export default App;
