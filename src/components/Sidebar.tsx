import React from 'react';
import { Settings, Video, ListTodo, Sparkles, Moon, Sun, HelpCircle } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  runningCount?: number;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onOpenOnboarding?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, runningCount = 0, theme = 'light', onToggleTheme, onOpenOnboarding }) => {
  const menuItems = [
    { id: 'generate', icon: Video, label: '视频生成', desc: '创建批量生成任务' },
    { id: 'tasks', icon: ListTodo, label: '任务管理', desc: '追踪进度与结果', badge: runningCount > 0 ? runningCount : undefined },
    { id: 'config', icon: Settings, label: '系统配置', desc: '平台、模型与密钥' },
  ];
  return <aside className="app-sidebar">
    <div className="sidebar-brand"><div className="sidebar-brand__mark"><Sparkles className="w-5 h-5" /></div><div><h1>通用视频 API</h1><p>多平台视频生成工作台</p></div></div>
    <nav className="sidebar-nav" aria-label="主导航"><ul>{menuItems.map(item => <li key={item.id}><button type="button" onClick={() => onTabChange(item.id)} className={activeTab === item.id ? 'is-active' : ''}><span className="sidebar-nav__icon"><item.icon className="w-5 h-5" /></span><span className="sidebar-nav__text"><span>{item.label}</span><small>{item.desc}</small></span>{item.badge !== undefined && <span className="sidebar-nav__badge">{item.badge}</span>}</button></li>)}</ul></nav>
    <div className="sidebar-tools"><button type="button" onClick={onToggleTheme} aria-label={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}>{theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}<span>{theme === 'dark' ? '亮色主题' : '暗色主题'}</span></button><button type="button" onClick={onOpenOnboarding} aria-label="打开新手引导"><HelpCircle className="w-4 h-4" /><span>新手引导</span></button></div>
    <div className="sidebar-footer"><span className="sidebar-footer__dot" /><div><p>本地工作区</p><small>v1.1.1 · React/Vite</small></div></div>
  </aside>;
};
export default Sidebar;
