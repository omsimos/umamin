import React, { useId } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { IoIosCopy } from 'react-icons/io';
import { IoChatboxEllipses } from 'react-icons/io5';

const Inbox = () => {
  const { query } = useRouter();

  return (
    <section className='mx-auto flex flex-col items-center pb-24 sm:w-[500px]'>
      <h1 className='h1-text'>Your inbox</h1>
      <div className='mt-8 flex w-full gap-3'>
        <div className='card flex w-full items-center gap-3 px-4 py-3'>
          <IoIosCopy className='text-primary-100' />
          <p>umamin.link/to/{query.username}</p>
        </div>

        <button type='button' className='secondary-btn flex-none'>
          Change PIN
        </button>
      </div>

      <div className='mt-8 w-full text-left'>
        <p className='mb-4 text-sm'>Latest messages</p>
        <ul className='space-y-8'>
          {Array.from({ length: 3 }).map(() => (
            <li key={useId()} className='card p-3'>
              <Image
                src='/assets/logo.svg'
                objectFit='contain'
                width={110}
                height={30}
              />
              <div className='relative rounded bg-secondary-100 p-4'>
                <p className='font-medium'>
                  Lorem ipsum dolor sit amet, consectetur adipisicing elit.
                  Veniam eaque quis sapiente beatae omnis itaque? Alias sint
                  architecto veniam, sequi vitae aliquid?
                </p>

                <IoChatboxEllipses className='absolute -top-7 right-4 text-5xl text-primary-100' />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default Inbox;
