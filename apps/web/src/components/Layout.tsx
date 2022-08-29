import React, { useState } from 'react';
import { Navbar, Footer } from '.';
import { Info } from './Dialog';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [dialog, setDialog] = useState(true)
  return (
    <>
      <Info isOpen={dialog} setIsOpen={setDialog} />
      <main className='contain min-h-screen'>
        <Navbar />
        {children}
      </main>
      <Footer />
    </>
  );
};
