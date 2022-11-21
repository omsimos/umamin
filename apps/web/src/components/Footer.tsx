import React from 'react';
import Link from 'next/link';

import { footerItems } from '@/utils/constants';
import { ImageFill } from './ImageFill';

export const Footer = () => {
  return (
    <footer className='contain py-12'>
      <div className='line mb-12' />

      <div className='grid grid-cols-2 flex-wrap justify-between gap-y-16 sm:flex'>
        <ul className='flex flex-col gap-4'>
          <li className='font-medium'>Resources</li>
          {footerItems.withRoute.map((item) => (
            <li key={item.name}>
              <Link
                href={item.href}
                className='text-gray-400 transition-colors hover:text-gray-500'>

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
                  className='text-gray-400 transition-colors hover:text-gray-500'
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
          objectFit='contain'
          className='hidden h-6 w-32 md:block'
        />
      </div>

      <div className='mt-20 flex flex-col items-center md:items-start'>
        <ImageFill
          alt='logo'
          src='/assets/logo.svg'
          objectFit='contain'
          className='relative mb-4 h-6 w-32 md:hidden'
        />
        <a
          href='https://github.com/omsimos'
          target='_blank'
          rel='noreferrer noopener'
          className='text-xs font-medium text-gray-500 hover:underline sm:text-sm md:text-base'
        >
          Ⓒ 2022 Omsimos Collective
        </a>
      </div>
    </footer>
  );
};
