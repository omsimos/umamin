import React from 'react';
import Link from 'next/link';

import { footerItems } from '@/utils/constants';
import { ImageFill } from './ImageFill';

export const Footer = () => {
  return (
    <footer className='contain py-12 hidden md:block'>
      <div className='line mb-12' />

      <div className='grid grid-cols-2 flex-wrap justify-between gap-y-16 sm:flex'>
        <ul className='flex flex-col gap-4'>
          <li className='font-medium'>Resources</li>
          {footerItems.withRoute.map((item) => (
            <li key={item.name}>
              <Link
                href={item.href}
                className='text-gray-500 transition-colors hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-500'
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>

        {footerItems.withUrl.map((item) => (
          <ul key={item.name} className='flex flex-col gap-4'>
            <li className='font-medium'>{item.name}</li>
            {item.children.map((c) => (
              <li key={c.name}>
                <a
                  href={c.href}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-gray-500 transition-colors hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-500'
                >
                  {c.name}
                </a>
              </li>
            ))}
          </ul>
        ))}

        <ImageFill
          alt='logo'
          src='/assets/logo.svg'
          className='hidden h-6 w-32 object-contain md:block'
        />
      </div>

      <div className='mt-20 flex flex-col items-center md:items-start'>
        <ImageFill
          alt='logo'
          src='/assets/logo.svg'
          className='relative mb-2 h-6 w-32 object-contain md:hidden'
        />
        <a
          href='https://github.com/omsimos'
          target='_blank'
          rel='noreferrer noopener'
          className='text-sm font-medium text-gray-500 hover:underline md:text-base'
        >
          OMSIMOS© 2023
        </a>
      </div>
    </footer>
  );
};
