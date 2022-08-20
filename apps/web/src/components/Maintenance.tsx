import React from 'react';
import Image from 'next/image';
import { FaDiscord, FaFacebook } from 'react-icons/fa';

import { Footer } from '.';

export const Maintenance = () => {
  return (
    <>
      <section className='contain text-base min-h-screen'>
        <div className='relative h-[75px] w-[150px] md:h-[100px] md:w-[200px]'>
          <Image
            priority
            src='/assets/logo.svg'
            layout='fill'
            objectFit='contain'
          />
        </div>

        <h1 className='mt-24 mb-2 text-5xl font-bold'>
          {process.env.NEXT_PUBLIC_MAINTENANCE_TITLE}
        </h1>
        <p className='mb-4 font-medium'>
          {process.env.NEXT_PUBLIC_MAINTENANCE_INFO}
        </p>

        <div className='mt-12 inline-flex flex-col space-y-4'>
          <a
            href='https://discord.gg/bQKG7axhcF'
            target='_blank'
            rel='noreferrer noopener'
            className='btn flex items-center space-x-2 rounded bg-[#5865f2] hover:bg-[#5865f2]/80'
          >
            <FaDiscord className='text-lg' />
            <p>Join Discord Server</p>
          </a>

          <a
            href='https://www.facebook.com/umamin.official'
            target='_blank'
            rel='noreferrer noopener'
            className='btn flex items-center space-x-2 rounded bg-[#2374e1] hover:bg-[#2374e1]/80'
          >
            <FaFacebook className='text-lg' />
            <p>Like Facebook Page</p>
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
