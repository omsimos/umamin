import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { IoChatboxEllipses } from 'react-icons/io5';

const Home: NextPage = () => {
  const { push } = useRouter();
  const { data } = useSession();

  const currentUser = data?.user?.username;

  return (
    <section className='relative flex flex-col justify-between text-center sm:text-left xl:flex-row'>
      <div>
        <h1 className='h1-text'>
          Receive confessions &<br />
          messages <span className='text-primary-100'>anonymously!</span>
        </h1>

        <p className='mt-4 text-gray-200 md:text-lg xl:mt-6'>
          An ad-free and open-source platform for sending and receiving
          anonymous <br className='hidden sm:block' />
          messages. Start receiving messages by{' '}
          <Link href='/register'>
            <span className='cursor-pointer text-primary-100'>
              creating your own link
            </span>
          </Link>
          !
        </p>

        <div className='mt-8 flex justify-center gap-3 sm:justify-start xl:mt-12'>
          <button
            onClick={() => push(currentUser ? '/inbox' : '/register')}
            type='button'
            className='primary-btn'
          >
            {currentUser ? 'View messages' : 'Create your link'}
          </button>

          <a
            href='https://github.com/joshxfi/umamin'
            target='_blank'
            rel='noopener noreferrer'
            className='secondary-btn'
          >
            View source
          </a>
        </div>
      </div>

      <div className='relative mt-28 self-end text-left md:mt-16 xl:mt-0 xl:self-start'>
        <div className='card w-full self-end p-8 font-syne md:w-[450px]'>
          <p>
            <span className='mr-2 text-lg font-bold'>Umamin</span>
            <span>(verb) [/u&apos;m&#593;&#58;min/]</span>
          </p>
          <p className='mt-1'>
            Declare to be true or admit the existence or reality or truth of
          </p>
        </div>

        <IoChatboxEllipses className='absolute right-4 -top-14 text-8xl text-primary-100 xl:-left-12 xl:top-28 xl:text-9xl' />
      </div>

      <div className='absolute top-48 right-0 -z-10 h-[450px] w-[450px] sm:top-40 md:top-28 md:h-[550px] md:w-[550px] xl:-top-56 xl:-right-16 xl:mt-14 xl:w-[650px]'>
        <Image
          priority
          src='/assets/hearts.svg'
          layout='fill'
          objectFit='contain'
        />
      </div>
    </section>
  );
};

export default Home;
