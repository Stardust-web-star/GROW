import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const transitionTimerRef = useRef<number | null>(null);
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('grow_theme') as Theme | null;
      if (saved === 'dark' || saved === 'light') return saved;
      // Default to dark mode (standard GROW professional aesthetic)
      return 'dark';
    } catch {
      return 'dark';
    }
  });

  const applyThemeToDom = useCallback((targetTheme: Theme, animate = true) => {
    const root = document.documentElement;

    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }

    if (animate) {
      root.classList.add('theme-transitioning');
    }

    if (targetTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.style.colorScheme = 'light';
    }

    // Update theme-color meta tag for mobile browser address bars
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', targetTheme === 'dark' ? '#02121e' : '#f8fafc');
    }

    if (animate) {
      transitionTimerRef.current = window.setTimeout(() => {
        root.classList.remove('theme-transitioning');
        transitionTimerRef.current = null;
      }, 220);
    }
  }, []);

  useEffect(() => {
    applyThemeToDom(theme, false);
    try {
      localStorage.setItem('grow_theme', theme);
    } catch (e) {
      console.warn('Unable to persist theme in localStorage:', e);
    }
  }, [theme, applyThemeToDom]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  const setTheme = (newTheme: Theme) => {
    applyThemeToDom(newTheme, true);
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    applyThemeToDom(nextTheme, true);
    setThemeState(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
