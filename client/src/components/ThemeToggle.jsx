import { useTheme } from '../context/ThemeContext.jsx';

function SunIcon({ className = 'theme-icon' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className = 'theme-icon' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function ThemeToggle({
  className = '',
  variant = 'header',
  showLabel = false,
  id = 'theme-toggle-btn',
}) {
  const { theme, toggleTheme, isDark } = useTheme();

  const actionLabel = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  const currentModeText = isDark ? 'Dark mode' : 'Light mode';

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        id={id}
        className={`staff-nav-item staff-theme-toggle ${className}`}
        onClick={toggleTheme}
        aria-label={actionLabel}
        title={actionLabel}
      >
        <span className="staff-nav-icon theme-toggle-icon-wrap" aria-hidden="true">
          {isDark ? <SunIcon /> : <MoonIcon />}
        </span>
        <span className="theme-toggle-label-text">
          {isDark ? 'Light Theme' : 'Dark Theme'}
        </span>
      </button>
    );
  }

  if (variant === 'mobile') {
    return (
      <button
        type="button"
        id={id}
        className={`mobile-nav-link mobile-theme-toggle ${className}`}
        onClick={toggleTheme}
        aria-label={actionLabel}
        title={actionLabel}
      >
        <span className="mobile-theme-icon-wrap" aria-hidden="true">
          {isDark ? <SunIcon /> : <MoonIcon />}
        </span>
        <span>{actionLabel}</span>
      </button>
    );
  }

  // Default: header compact button
  return (
    <button
      type="button"
      id={id}
      className={`theme-toggle-btn ${isDark ? 'theme-toggle-dark' : 'theme-toggle-light'} ${className}`}
      onClick={toggleTheme}
      aria-label={actionLabel}
      title={actionLabel}
      aria-pressed={isDark}
    >
      <span className="theme-toggle-slider" aria-hidden="true">
        {isDark ? <SunIcon /> : <MoonIcon />}
      </span>
      {showLabel && <span className="theme-toggle-text">{currentModeText}</span>}
    </button>
  );
}
