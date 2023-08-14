import React from 'react';

type Props = {
  className?: string;
  children: React.ReactNode;
} & React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
>;

export const Container = ({ className, children, ...rest }: Props) => {
  return (
    <div
      className={`mx-auto md:w-[90%] w-full px-6 md:px-0 max-w-screen-xl ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};
