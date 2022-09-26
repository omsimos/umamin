import React from 'react';
import dynamic from 'next/dynamic';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

export const Error = ({ message }: { message: string }) => {
  return (
    <section>
      <h1 className='h1-text text-center'>{message}</h1>

      <AdContainer slotId='3565320541' className='mt-12' />
      <AdContainer slotId='9939157208' className='mt-4' />
      <AdContainer slotId='4251716255' className='mt-4' />
    </section>
  );
};
