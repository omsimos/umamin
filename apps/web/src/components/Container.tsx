import React from 'react';

type Props = {
  className?: string;
  children: React.ReactNode;
};

export const Container = ({ className, children }: Props) => {
  return (
    <div className={`mx-auto md:w-[90%] px-6 md:px-0 max-w-screen-xl ${className}`}>
      {children}
    </div>
  );
};
