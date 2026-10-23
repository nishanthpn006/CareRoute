import { createContext, useContext, useEffect, useState, useCallback } from 'react';

import {
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
  getStoredTheme,
  persistTheme,
} from './themeStorage.js';

export {
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
  getStoredTheme,
  persistTheme,
};

export const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: false,
});

export function ThemeProvider({ children, initialTheme }) {
  const [theme, setThemeState] = useState(() => {
    return initialTheme || getStoredTheme();
  });

  // Apply data-theme attribute on root and persist to storage
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    persistTheme(theme);
  }, [theme]);

  // Sync across tabs
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    function handleStorageChange(e) {
      if (e.key === THEME_STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        setThemeState(e.newValue);
      }
    }

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const setTheme = useCallback((newTheme) => {
    if (newTheme === 'dark' || newTheme === 'light') {
      setThemeState(newTheme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: DEFAULT_THEME,
      setTheme: () => {},
      toggleTheme: () => {},
      isDark: false,
    };
  }
  return context;
}
