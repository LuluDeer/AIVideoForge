import React from 'react';
import { Settings, Video, ListTodo, Layers } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const menuItems = [
    { id: 'generate', icon: Video, label: '视频生成' },
    { id: 'tasks', icon: ListTodo, label: '任务管理' },
    { id: 'modelConfig', icon: Layers, label: '模型配置' },
    { id: 'config', icon: Settings, label: '系统配置' },
  ];

  return (
    <div className="w-64 bg-gray-800 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold text-white">通用视频API生成工具</h1>
        <p className="text-gray-400 text-sm mt-1">自定义各种请求参数及请求格式</p>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map(item => (
            <li key={item.id}>
              <button
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${
                  activeTab === item.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5 mr-3" />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="p-4 border-t border-gray-700">
        <p className="text-gray-500 text-xs">Version 1.0.0</p>
      </div>
    </div>
  );
};

export default Sidebar;
