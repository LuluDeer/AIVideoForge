import { useState, useEffect, useCallback } from 'react';
import { parseJson, readJsonStorage, removeStorageKey, writeJsonStorage } from '../utils/storage';
import { logger } from '../utils/logger';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => readJsonStorage(key, initialValue));

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const valueToStore = value instanceof Function ? value(prev) : value;
      writeJsonStorage(key, valueToStore, error => {
        logger.warn('useLocalStorage', `Error setting localStorage key "${key}"`, error);
      });
      return valueToStore;
    });
  }, [key]);

  const removeValue = useCallback(() => {
    removeStorageKey(key, error => {
      logger.warn('useLocalStorage', `Error removing localStorage key "${key}"`, error);
    });
    setStoredValue(initialValue);
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

export function useLocalStorageSync<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => readJsonStorage(key, initialValue));

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        setStoredValue(parseJson(e.newValue, initialValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, initialValue]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const valueToStore = value instanceof Function ? value(prev) : value;
      writeJsonStorage(key, valueToStore, error => {
        logger.warn('useLocalStorage', `Error setting localStorage key "${key}"`, error);
      });
      return valueToStore;
    });
  }, [key]);

  return [storedValue, setValue];
}
