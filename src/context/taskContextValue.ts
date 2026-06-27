import { createContext } from 'react';
import type { GenerationMode, Task } from '../types';

export interface TaskContextType {
  tasks: Task[];
  addTask: (task: Omit<Task, 'created_at' | 'updated_at'>) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  clearTasks: () => void;
  loadTasks: () => Task[];
  saveTasks: () => void;
  pollRunningTasks: () => void;
  cancelTask: (taskId: string) => Promise<void>;
  refreshTask: (taskId: string) => Promise<void>;
  fetchRemoteTasks: (options?: { page?: number; pageSize?: number; status?: string }) => Promise<void>;
  retryTask: (taskId: string) => Promise<void>;
  runningCount: number;
  reuseTaskData: { platformId: string; model: string; mode: GenerationMode; prompt: string; paramValues: Record<string, unknown> } | null;
  requestReuseTask: (taskId: string) => void;
  clearReuseTaskData: () => void;
}

export const TaskContext = createContext<TaskContextType | undefined>(undefined);
