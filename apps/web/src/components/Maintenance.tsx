import React from 'react';
import Image from 'next/image';

export const Maintenance = () => {
  return (
    <section className='contain text-base'>
      <div className='relative h-[75px] w-[150px] md:h-[100px] md:w-[200px]'>
        <Image
          priority
          src='/assets/logo.svg'
          layout='fill'
          objectFit='contain'
        />
      </div>

      <h1 className='mt-24 mb-2 text-5xl font-bold'>Maintenance</h1>
      <p className='mb-4 font-medium'>
        {process.env.NEXT_PUBLIC_MAINTENANCE_INFO}
      </p>

      {process.env.NEXT_PUBLIC_MAINTENANCE_URL && (
        <a
          className='text-primary-100'
          href={process.env.NEXT_PUBLIC_MAINTENANCE_URL}
        >
          More Info &rarr;
        </a>
      )}
    </section>
  );
};
