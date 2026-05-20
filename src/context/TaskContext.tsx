import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Task } from '../types';
import VideoApi from '../services/api';
import { useConfig } from './ConfigContext';

interface TaskContextType {
  tasks: Task[];
  addTask: (task: Omit<Task, 'created_at' | 'updated_at'>) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  clearTasks: () => void;
  loadTasks: () => void;
  saveTasks: () => void;
  pollRunningTasks: () => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const useTasks = (): TaskContextType => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
};

interface TaskProviderProps {
  children: ReactNode;
}

export const TaskProvider: React.FC<TaskProviderProps> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [polling, setPolling] = useState(false);
  const { config, activePlatform } = useConfig();

  const loadTasks = (): Task[] => {
    try {
      const saved = localStorage.getItem('geekai_tasks');
      if (saved) {
        const parsed = JSON.parse(saved) as Task[];
        const loadedTasks = parsed.map((t) => ({
          ...t,
          created_at: typeof t.created_at === 'number' ? t.created_at : new Date(t.created_at).getTime(),
          updated_at: typeof t.updated_at === 'number' ? t.updated_at : new Date(t.updated_at).getTime(),
        }));
        setTasks(loadedTasks);
        return loadedTasks;
      }
    } catch (error) {
      console.error('加载任务失败:', error);
    }
    return [];
  };

  const saveTasks = () => {
    try {
      localStorage.setItem('geekai_tasks', JSON.stringify(tasks));
      console.log(`=== 保存任务 ===`);
      console.log(`保存了 ${tasks.length} 个任务`);
      tasks.forEach(t => console.log(`任务 ${t.id}: 状态=${t.status}, 已下载=${t.downloaded}`));
    } catch (error) {
      console.error('保存任务失败:', error);
    }
  };

  const addTask = (taskData: Omit<Task, 'created_at' | 'updated_at'>): Task => {
    const newTask: Task = {
      ...taskData,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    setTasks(prev => [newTask, ...prev]);
    saveTasks();
    return newTask;
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => {
      const updatedTasks = prev.map(task => {
        if (task.id === id) {
          return { ...task, ...updates, updated_at: Date.now() };
        }
        return task;
      });
      setTimeout(() => {
        localStorage.setItem('geekai_tasks', JSON.stringify(updatedTasks));
        console.log(`=== 更新任务 ===`);
        console.log(`任务 ${id} 更新后: 状态=${updatedTasks.find(t => t.id === id)?.status}, 已下载=${updatedTasks.find(t => t.id === id)?.downloaded}`);
      }, 0);
      return updatedTasks;
    });
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id));
    saveTasks();
  };

  const clearTasks = () => {
    setTasks([]);
    saveTasks();
  };

  const pollRunningTasks = useCallback(async () => {
    if (polling || !activePlatform?.apiKey) return;
    
    const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'pending');
    if (activeTasks.length === 0) {
      console.log('没有需要轮询的任务');
      return;
    }

    setPolling(true);
    const api = new VideoApi(activePlatform);

    for (const task of activeTasks) {
      if (task.status === 'succeed' || task.status === 'failed') {
        console.log(`任务 ${task.id} 已完成，跳过轮询`);
        continue;
      }
      
      try {
        const result = await api.waitForTask(task.id);
        const videoUrl = result.video_result?.[0]?.url;
        
        updateTask(task.id, {
          status: result.task_status,
          video_url: videoUrl,
          updated_at: Date.now(),
        });

        if (result.task_status === 'succeed' && videoUrl && task.auto_download && !task.downloaded && config.downloadPath) {
          if (window.electronAPI) {
            try {
              await window.electronAPI.downloadFile(videoUrl, config.downloadPath);
              updateTask(task.id, { downloaded: true });
              console.log(`视频 ${task.id} 已自动下载`);
            } catch (downloadErr) {
              console.error('自动下载失败:', downloadErr);
            }
          }
        }
      } catch (err) {
        console.error(`轮询任务 ${task.id} 失败:`, err);
      }
    }

    setPolling(false);
  }, [tasks, polling, activePlatform, config.downloadPath]);

  useEffect(() => {
    const loadedTasks = loadTasks();
    console.log(`=== 加载任务 ===`);
    console.log(`加载到 ${loadedTasks.length} 个任务`);
    loadedTasks.forEach(t => console.log(`任务 ${t.id}: 状态=${t.status}, 已下载=${t.downloaded}, 视频URL=${t.video_url ? '有' : '无'}`));
    setTasks(loadedTasks);
    
    const activeTasks = loadedTasks.filter(t => t.status === 'running' || t.status === 'pending');
    console.log(`活跃任务数: ${activeTasks.length}`);
    if (activeTasks.length > 0) {
      console.log(`检测到 ${activeTasks.length} 个正在运行的任务，开始自动轮询...`);
      setTimeout(() => pollRunningTasks(), 1000);
    }
  }, []);

  useEffect(() => {
    const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'pending');
    if (activeTasks.length > 0 && !polling) {
      const interval = setInterval(() => {
        pollRunningTasks();
      }, 15000);

      return () => clearInterval(interval);
    }
  }, [tasks, polling, pollRunningTasks]);

  return (
    <TaskContext.Provider value={{ tasks, addTask, updateTask, removeTask, clearTasks, loadTasks, saveTasks, pollRunningTasks }}>
      {children}
    </TaskContext.Provider>
  );
};
