import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  children: React.ReactNode;
  className?: string;
}

export const Layout = ({ children, className = '' }: Props) => {
  const { top } = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: top,
      }}
      className={`bg-secondary-300 flex-1 ${className}`}
    >
      {children}
    </View>
  );
};
