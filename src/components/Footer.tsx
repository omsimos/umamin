import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { footerItems } from '@/constants';

export const Footer = () => {
  return (
    <footer className='contain pb-12'>
      <div className='mb-12 h-[2px] bg-secondary-100' />

      <div className='grid grid-cols-2 flex-wrap justify-between gap-y-16 sm:flex'>
        <div className='flex flex-col gap-4'>
          <p className='font-medium'>Project</p>
          {footerItems.withRoute.map((item) => (
            <Link href={item.href} key={item.name}>
              <a className='text-gray-400 transition-colors hover:text-gray-500'>
                {item.name}
              </a>
            </Link>
          ))}
        </div>

        {footerItems.withUrl.map((item) => (
          <div key={item.name} className='flex flex-col gap-4'>
            <p className='font-medium'>{item.name}</p>
            {item.children.map((c) => (
              <a
                key={c.name}
                href={c.href}
                target='_blank'
                rel='noopener noreferrer'
                className='text-gray-400 transition-colors hover:text-gray-500'
              >
                {c.name}
              </a>
            ))}
          </div>
        ))}

        <div className='relative hidden h-6 w-32 md:block'>
          <Image src='/assets/logo.svg' layout='fill' objectFit='contain' />
        </div>
      </div>

      <div className='mt-20 flex flex-col items-center'>
        <div className='relative mb-4 h-6 w-32 md:hidden'>
          <Image src='/assets/logo.svg' layout='fill' objectFit='contain' />
        </div>
        <p className='text-xs font-medium text-gray-500 sm:text-sm md:text-base'>
          Created with 💖 by{' '}
          <a
            href='https://github.com/joshxfi'
            target='_blank'
            rel='noreferrer noopener'
            className='hover:underline'
          >
            Josh Daniel Bañares
          </a>{' '}
          &{' '}
          <a
            href='https://github.com/joshxfi/umamin/graphs/contributors'
            target='_blank'
            rel='noreferrer noopener'
            className='hover:underline'
          >
            Contributors
          </a>
        </p>
      </div>
    </footer>
  );
};
