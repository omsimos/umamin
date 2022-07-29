import React from 'react';

export const Maintenance = () => {
  return (
    <div className='text-base'>
      <h1 className='mb-2 text-5xl font-bold'>Maintenance</h1>
      <p className='mb-4 font-medium'>Please check back soon. Thank You 💖</p>

      <a
        className='text-primary-100'
        href={process.env.NEXT_PUBLIC_MAINTENANCE_URL ?? '#'}
      >
        More Info &rarr;
      </a>
    </div>
  );
};
