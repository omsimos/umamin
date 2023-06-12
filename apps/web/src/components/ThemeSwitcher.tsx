import React from 'react';
import { DarkModeSwitch } from 'react-toggle-dark-mode';
import { useTheme } from '@/hooks';

export const ThemeSwitcher = ({
  className,
  size,
}: {
  className?: string;
  size?: number;
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={className}>
      <DarkModeSwitch
        checked={theme === 'light'}
        onChange={toggleTheme}
        size={size ?? 24}
        moonColor='#1C1D21'
        sunColor='#fff'
      />
    </div>
  );
};
