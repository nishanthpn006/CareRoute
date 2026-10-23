export const THEME_STORAGE_KEY = 'careroute-theme';
export const DEFAULT_THEME = 'light';

/**
 * Safely retrieves initial theme from localStorage with error handling
 */
export function getStoredTheme(storage = typeof window !== 'undefined' ? window.localStorage : null) {
  try {
    if (!storage) return DEFAULT_THEME;
    const val = storage.getItem(THEME_STORAGE_KEY);
    if (val === 'dark' || val === 'light') {
      return val;
    }
  } catch {
    // Handle sandboxed iframes or disabled localStorage
  }
  return DEFAULT_THEME;
}

/**
 * Safely saves theme to localStorage
 */
export function persistTheme(theme, storage = typeof window !== 'undefined' ? window.localStorage : null) {
  try {
    if (storage) {
      storage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // Ignore storage failure (e.g., quota exceeded or privacy sandbox)
  }
}
