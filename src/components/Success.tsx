import React from 'react';
import { useRouter } from 'next/router';
import { BsInfoCircleFill } from 'react-icons/bs';
import { IoChatboxEllipses } from 'react-icons/io5';

export const Success = () => {
  const { push } = useRouter();

  return (
    <section className='mx-auto flex flex-col items-center sm:w-[500px]'>
      <h1 className='h1-text'>Success!</h1>
      <div className='card relative mt-8 w-full p-8 [&>p>span]:text-primary-100'>
        <p>
          Username: <span>johndoe</span>
        </p>
        <p>
          PIN: <span>012345</span>
        </p>

        <div className='mt-8 flex items-center gap-2 text-sm'>
          <BsInfoCircleFill className='text-primary-100' />
          <p>Take a screenshot to save your credentials</p>
        </div>

        <IoChatboxEllipses className='absolute -top-10 right-4 text-7xl text-primary-100' />
      </div>

      <div className='mt-3 flex w-full gap-3 [&>*]:w-full'>
        <button type='button' className='secondary-btn'>
          Undo
        </button>

        <button
          onClick={() => push('/messages/johndoe')}
          type='button'
          className='primary-btn'
        >
          Proceed
        </button>
      </div>
    </section>
  );
};
