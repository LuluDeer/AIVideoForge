import { useContext } from 'react';
import { TaskContext } from './taskContextValue';
import type { TaskContextType } from './taskContextValue';

export const useTasks = (): TaskContextType => {
  const context = useContext(TaskContext);
  if (!context) throw new Error('useTasks must be used within a TaskProvider');
  return context;
};
