import React from 'react';
import { Navbar, Footer } from '.';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className='text-sm md:text-base 2xl:w-full'>
      <div className='min-h-screen'>
        <Navbar />
        {children}
      </div>

      <Footer />
    </main>
  );
};
