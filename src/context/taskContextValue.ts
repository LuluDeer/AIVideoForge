import { createContext } from 'react';
import type { GenerationMode, Task } from '../types';

export interface TaskContextType {
  tasks: Task[];
  addTask: (task: Omit<Task, 'created_at' | 'updated_at'>) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  clearTasks: () => void;
  cancelTask: (taskId: string) => Promise<void>;
  refreshTask: (taskId: string) => Promise<void>;
  fetchRemoteTasks: (options?: { page?: number; pageSize?: number; status?: string }) => Promise<void>;
  retryTask: (taskId: string) => Promise<void>;
  runningCount: number;
  reuseTaskData: { platformId: string; model: string; mode: GenerationMode; prompt: string; paramValues: Record<string, unknown> } | null;
  requestReuseTask: (taskId: string) => void;
  clearReuseTaskData: () => void;
  /** 任务历史持久化异常（配额不足/超限裁剪）的用户告警，null 表示正常 */
  storageWarning: string | null;
}

export const TaskContext = createContext<TaskContextType | undefined>(undefined);
