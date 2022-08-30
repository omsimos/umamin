import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { ImageFill } from './ImageFill';
import { footerItems } from '@/utils/constants';

export const Footer = () => {
  return (
    <footer className='contain py-12'>
      <div className='line mb-12' />

      <div className='grid grid-cols-2 flex-wrap justify-between gap-y-16 sm:flex'>
        <ul className='flex flex-col gap-4'>
          <li className='font-medium'>Resources</li>
          {footerItems.withRoute.map((item) => (
            <li key={item.name}>
              <Link href={item.href}>
                <a className='text-gray-400 transition-colors hover:text-gray-500'>
                  {item.name}
                </a>
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
          src='/assets/logo.svg'
          objectFit='contain'
          className='hidden h-6 w-32 md:block'
        />
      </div>

      <div className='mt-20 flex flex-col items-center md:items-start'>
        <div className='relative mb-4 h-6 w-32 md:hidden'>
          <Image src='/assets/logo.svg' layout='fill' objectFit='contain' />
        </div>
        <p className='text-xs font-medium text-gray-500 sm:text-sm md:text-base'>
          Created by{' '}
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
          >
            Contributors
          </a>
        </p>
      </div>
    </footer>
  );
};
