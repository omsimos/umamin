import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  children: React.ReactNode;
  className?: string;
}

export const Layout = ({ children, className = '' }: Props) => {
  return (
    <SafeAreaView className={`bg-secondary-300 flex-1 ${className}`}>
      {children}
    </SafeAreaView>
  );
};
