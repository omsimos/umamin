import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';

import { useStore } from '@/hooks';

export const Navbar = () => {
  const { push } = useRouter();
  const currentUser = useStore((state) => state.currentUser);
  const setCurrentUser = useStore((state) => state.setCurrentUser);

  const handleLogout = () => {
    push('/');
    setCurrentUser(null);
  };

  return (
    <nav className='relative z-10 mb-12 flex items-center justify-between xl:mb-24'>
      <Link href='/'>
        <div className='relative h-[75px] w-[150px] cursor-pointer md:h-[100px] md:w-[200px]'>
          <Image src='/assets/logo.svg' layout='fill' objectFit='contain' />
        </div>
      </Link>

      <div className='flex items-center space-x-6'>
        {currentUser ? (
          <button onClick={handleLogout} type='button' className='primary-btn'>
            Logout
          </button>
        ) : (
          <>
            <Link href='/login'>
              <p className='cursor-pointer text-sm font-medium text-gray-200 transition-colors hover:text-gray-400 md:text-base'>
                Login
              </p>
            </Link>

            <button
              onClick={() => push('/create')}
              type='button'
              className='primary-btn'
            >
              Get started
            </button>
          </>
        )}
      </div>
    </nav>
  );
};
