import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';

import logo from 'public/assets/logo.svg';

export const Navbar = () => {
  const { push } = useRouter();

  return (
    <nav className='flex items-center justify-between'>
      <Link href='/'>
        <div className='relative h-[75px] w-[150px] md:h-[100px] md:w-[200px]'>
          <Image src={logo} layout='fill' objectFit='contain' />
        </div>
      </Link>

      <div className='flex items-center space-x-6'>
        <Link href='/login'>
          <p className='text-sm md:text-base'>Login</p>
        </Link>

        <button
          onClick={() => push('/create')}
          type='button'
          className='primary-btn'
        >
          Get started
        </button>
      </div>
    </nav>
  );
};
