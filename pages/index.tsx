import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { IoChatboxEllipses } from 'react-icons/io5';

const Home: NextPage = () => {
  const { push } = useRouter();

  return (
    <section className='relative flex flex-col justify-between xl:flex-row'>
      <div>
        <h1 className='h1-text'>
          Receive confessions &<br />
          messages <span className='text-primary-100'>anonymously!</span>
        </h1>

        <p className='mt-4 text-gray-200 xl:mt-6'>
          An ad-free and open-source platform for sending and receiving
          anonymous <br className='hidden sm:block' />
          messages. Start receiving messages by{' '}
          <Link href='/create'>
            <span className='cursor-pointer text-primary-100'>
              creating your own link
            </span>
          </Link>
          !
        </p>

        <div className='mt-8 flex gap-3 xl:mt-12'>
          <button
            onClick={() => push('/create')}
            type='button'
            className='primary-btn'
          >
            Create your link
          </button>

          <a
            href='https://github.com/joshxfi/umamin'
            target='_blank'
            rel='noopener noreferrer'
            className='rounded border border-gray-400 bg-secondary-100 px-6 py-3 text-sm font-medium transition-colors hover:bg-secondary-100/80 md:text-base'
          >
            View source
          </a>
        </div>
      </div>

      <div className='relative mt-28 self-end md:mt-16 lg:mt-10 xl:mt-0 xl:self-start'>
        <div className='font-syne w-full self-end rounded border-2 border-primary-100 bg-secondary-200 p-8 md:w-[450px]'>
          <p>
            <span className='mr-2 text-lg font-bold'>Umamin</span>
            <span>(verb) [/uˈmɑːmin/]</span>
          </p>
          <p>
            Declare to be true or admit the existence or reality or truth of
          </p>
        </div>

        <IoChatboxEllipses className='absolute right-4 -top-14 text-8xl text-primary-100 xl:-left-12 xl:top-28 xl:text-9xl' />
      </div>

      <div className='absolute top-48 right-0 -z-10 h-[450px] w-full sm:top-40 sm:w-[450px] md:top-28 md:h-[550px] md:w-[550px] lg:h-[650px] lg:w-[650px] xl:-top-56 xl:-right-16'>
        <Image src='/assets/hearts.svg' layout='fill' objectFit='contain' />
      </div>
    </section>
  );
};

export default Home;
