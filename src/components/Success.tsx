import React from 'react';
import { useRouter } from 'next/router';
import { BsInfoCircleFill } from 'react-icons/bs';
import { IoChatboxEllipses } from 'react-icons/io5';

import type { User } from '@/generated/graphql';

export const Success = ({ data }: { data: User }) => {
  const { push } = useRouter();

  const handleProceed = () => {
    push('/inbox');
  };

  return (
    <section className='mx-auto flex flex-col items-center sm:w-[500px]'>
      <h1 className='h1-text'>Success!</h1>
      <div className='card relative mt-8 w-full p-6 [&>p>span]:text-primary-100'>
        <p>
          Username: <span>{data.username}</span>
        </p>
        <p>
          Password: <span>{data.password}</span>
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

        <button onClick={handleProceed} type='button' className='primary-btn'>
          Proceed
        </button>
      </div>
    </section>
  );
};
