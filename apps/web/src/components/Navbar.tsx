/* eslint-disable no-nested-ternary */
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FaDiscord, FaFacebook } from 'react-icons/fa';
import { signOut, useSession } from 'next-auth/react';
import { BiUserCircle } from 'react-icons/bi';
import { HiMenuAlt3 } from 'react-icons/hi';
import { useRouter } from 'next/router';
import Link from 'next/link';

import { Menu } from '@/components';
import { ImageFill, Container } from '@/components/Utils';

export const Navbar = () => {
  const [loading, setLoading] = useState(false);
  const { data, status } = useSession();
  const { push } = useRouter();

  const queryClient = useQueryClient();

  const handleLogout = async () => {
    setLoading(true);
    await queryClient.invalidateQueries();
    await signOut({ redirect: false });
    push('/login');
    setLoading(false);
  };

  return (
    <Container className='relative z-10 mb-12 flex items-center justify-between xl:mb-24'>
      <Link href={status === 'authenticated' ? '/inbox' : '/'}>
        <ImageFill
          alt='logo'
          src='/assets/logo.svg'
          className='hide-tap-highlight h-[75px] w-[150px] cursor-pointer object-contain md:h-[100px] md:w-[200px]'
        />
      </Link>

      <div className='items-center space-x-5 md:space-x-6 flex'>
        {/* <ThemeSwitcher className='mb-1 sm:mb-0' /> */}

        <div className='hidden items-center justify-center space-x-6 md:flex'>
          {status === 'loading' || loading ? (
            <span className='loader' />
          ) : status === 'authenticated' ? (
            <button
              onClick={handleLogout}
              type='button'
              className='primary-btn'
            >
              Logout
            </button>
          ) : (
            <>
              <Link
                href='/login'
                className='cursor-pointer text-sm font-medium text-gray-600 transition-colors hover:text-gray-700 dark:text-gray-200 hover:dark:text-gray-400 md:text-base'
              >
                Login
              </Link>

              <button
                onClick={() => push('/login')}
                type='button'
                className='primary-btn'
              >
                Get started
              </button>
            </>
          )}
        </div>

        <Menu
          className='md:hidden'
          panelStyles='top-14 right-0'
          button={
            status === 'loading' || loading ? (
              <span className='loader' />
            ) : status === 'authenticated' ? (
              <ImageFill
                alt='profile picture'
                src={data?.user?.image}
                unoptimized
                className='border-secondary-100 h-[50px] w-[50px] object-cover rounded-full border'
              />
            ) : (
              <HiMenuAlt3 className='transition-colors hover:text-gray-300' />
            )
          }
          panel={
            <>
              {status === 'unauthenticated' && (
                <Link href='/login' className='menu-item'>
                  <BiUserCircle className='text-base' />
                  <p>Get started</p>
                </Link>
              )}
              <a
                href='https://www.facebook.com/umamin.official'
                target='_blank'
                rel='noreferrer noopener'
                className='menu-item'
              >
                <FaFacebook />
                <p>Facebook</p>
              </a>
              <a
                href='https://discord.gg/bQKG7axhcF'
                target='_blank'
                rel='noreferrer noopener'
                className='menu-item'
              >
                <FaDiscord className='text-base' />
                <p>Discord</p>
              </a>
            </>
          }
        />
      </div>
    </Container>
  );
};
