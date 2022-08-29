/* eslint-disable no-nested-ternary */
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signOut, useSession } from 'next-auth/react';

import { ImageFill, Menu } from '@/components';
import { queryClient } from '@/api';

export const Navbar = () => {
  const [loading, setLoading] = useState(false);
  const { status } = useSession();
  const { push } = useRouter();

  const handleLogout = async () => {
    setLoading(true);
    await queryClient.invalidateQueries();
    await signOut({ redirect: false });
    push('/login');
    setLoading(false);
  };

  return (
    <nav className='relative z-10 mb-12 flex items-center justify-between xl:mb-24'>
      <Link href='/'>
        <ImageFill
          src='/assets/logo.svg'
          objectFit='contain'
          className='hide-tap-highlight h-[75px] w-[150px] cursor-pointer md:h-[100px] md:w-[200px]'
        />
      </Link>

      <div className='hidden items-center space-x-6 sm:flex'>
        {status === 'loading' || loading ? (
          <span className='loader' />
        ) : status === 'authenticated' ? (
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
              onClick={() => push('/register')}
              type='button'
              className='primary-btn'
            >
              Get started
            </button>
          </>
        )}
      </div>

      <Menu handleLogout={handleLogout} loading={loading} />
    </nav>
  );
};
