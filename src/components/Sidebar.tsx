import React from 'react';
import { Settings, Video, ListTodo, Sparkles } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  runningCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, runningCount = 0 }) => {
  const menuItems = [
    { id: 'generate', icon: Video, label: '视频生成', desc: '创建批量生成任务' },
    { id: 'tasks', icon: ListTodo, label: '任务管理', desc: '追踪进度与结果', badge: runningCount > 0 ? runningCount : undefined },
    { id: 'config', icon: Settings, label: '系统配置', desc: '平台、模型与密钥' },
  ];

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand__mark">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1>通用视频 API</h1>
          <p>多平台视频生成工作台</p>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="主导航">
        <ul>
          {menuItems.map(item => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onTabChange(item.id)}
                className={activeTab === item.id ? 'is-active' : ''}
              >
                <span className="sidebar-nav__icon"><item.icon className="w-5 h-5" /></span>
                <span className="sidebar-nav__text">
                  <span>{item.label}</span>
                  <small>{item.desc}</small>
                </span>
                {item.badge !== undefined && (
                  <span className="sidebar-nav__badge" aria-label={`${item.badge} 个运行中任务`}>
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-footer__dot" />
        <div>
          <p>本地工作区</p>
          <small>v1.2.0 · React/Vite</small>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
