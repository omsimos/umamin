import React from 'react';
import { Navbar, Footer } from '.';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <main className='contain min-h-screen'>
        <Navbar />
        {children}
      </main>
      <Footer />
    </>
  );
};
