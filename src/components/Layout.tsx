import React from 'react';
import { Navbar } from './Navbar';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className='mx-auto min-h-screen w-[90%] max-w-screen-xl md:text-lg 2xl:w-full'>
      <Navbar />
      {children}
    </main>
  );
};
