import React from 'react';
import Image from 'next/image';
import { FaFacebook, FaInstagram } from 'react-icons/fa';

import { Footer } from '.';

export const Maintenance = () => {
  return (
    <>
      <section className='contain min-h-screen text-base'>
        <div className='relative h-[75px] w-[150px] md:h-[100px] md:w-[200px]'>
          <Image
            alt='logo'
            priority
            src='/assets/logo.svg'
            fill
            className='object-contain'
          />
        </div>

        <h1 className='mt-24 mb-2 text-3xl font-bold'>
          {process.env.NEXT_PUBLIC_MAINTENANCE_TITLE}
        </h1>
        <p className='mb-4 font-medium'>
          {process.env.NEXT_PUBLIC_MAINTENANCE_INFO}
        </p>

        <div className='mt-12 inline-flex flex-col space-y-4'>
          <a
            href='https://www.instagram.com/umamin.app/'
            target='_blank'
            rel='noreferrer noopener'
            className='btn flex items-center space-x-2 rounded bg-pink-600 hover:bg-pink-700'
          >
            <FaInstagram className='text-lg' />
            <p>Instagram</p>
          </a>

          <a
            href='https://www.facebook.com/umamin.official'
            target='_blank'
            rel='noreferrer noopener'
            className='btn flex items-center space-x-2 rounded bg-[#2374e1] hover:bg-[#2374e1]/80'
          >
            <FaFacebook className='text-lg' />
            <p>Facebook</p>
          </a>

          {process.env.NEXT_PUBLIC_MAINTENANCE_URL && (
            <a
              className='text-primary-100'
              href={process.env.NEXT_PUBLIC_MAINTENANCE_URL}
            >
              More Info &rarr;
            </a>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
};
