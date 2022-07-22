/* eslint-disable no-nested-ternary */
import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { signOut, useSession } from 'next-auth/react';

import { Menu } from '@/components';

export const Navbar = () => {
  const [loading, setLoading] = useState(false);
  const { status } = useSession();
  const { push } = useRouter();

  const handleLogout = async () => {
    setLoading(true);
    await signOut({ redirect: false });
    setLoading(false);
    push('/login');
  };

  return (
    <nav className='relative z-20 mb-12 flex items-center justify-between xl:mb-24'>
      <Link href='/'>
        <div className='relative h-[75px] w-[150px] cursor-pointer md:h-[100px] md:w-[200px]'>
          <Image
            src='/assets/logo.svg'
            priority
            layout='fill'
            objectFit='contain'
          />
        </div>
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
