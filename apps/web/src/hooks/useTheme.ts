import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

const DEFAULT_THEME = 'dark';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  const setMode = (mode: Theme) => {
    window.localStorage.setItem('theme', mode);
    setTheme(mode);
  };

  const toggleTheme = (): void => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    const oldTheme = newTheme === 'light' ? 'dark' : 'light';

    // Remove old color theme class
    const root = window.document.documentElement;
    root.classList.remove(oldTheme);

    // Add new color theme class
    root.classList.add(newTheme);
    setMode(newTheme);
  };

  useEffect(() => {
    const localTheme: Theme =
      (window.localStorage.getItem('theme') as Theme) ?? DEFAULT_THEME;

    const root = window.document.documentElement;
    root.classList.add(localTheme); // add the class to <html> element
    setTheme(localTheme);
  }, []);

  return { theme, toggleTheme };
};
