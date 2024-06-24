import React from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { AiFillAndroid } from 'react-icons/ai';
import { IoChatboxEllipses } from 'react-icons/io5';
import { HiOutlineArrowNarrowRight } from 'react-icons/hi';

import { Layout } from '@/components';
import { Container } from '@/components/Utils';
import { indexItems } from '@/utils/constants';
import type { NextPageWithLayout } from '..';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const Home: NextPageWithLayout = () => {
  const { push } = useRouter();
  const { status } = useSession();

  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';

  if (status === 'authenticated') {
    push('/inbox');
  }

  return (
    <Container className='space-y-12'>
      <div className='relative flex flex-col justify-between text-center sm:text-left xl:flex-row'>
        <div>
          <h1 className='h1-text'>
            Receive confessions &<br />
            messages <span className='text-gradient'>anonymously!</span>
          </h1>

          <p className='mt-4 text-gray-600 dark:text-gray-200 md:text-lg xl:mt-6'>
            The ultimate platform for sending and receiving anonymous messages!
          </p>

          <div className='mt-8 flex justify-center gap-3 sm:justify-start xl:mt-12'>
            <button
              disabled={isLoading}
              onClick={() => push(isAuthenticated ? '/inbox' : '/register')}
              type='button'
              className='primary-btn'
            >
              {isAuthenticated ? 'View messages' : 'Create your link'}
            </button>

            <a
              href='https://play.google.com/store/apps/details?id=link.umamin.app'
              className='secondary-btn flex items-center space-x-2'
              target='_blank'
              rel='noreferrer noopener'
            >
              <p>Download</p>
              <AiFillAndroid className='text-lg' />
            </a>
          </div>
        </div>

        <div className='relative mt-28 self-end text-left md:mt-16 xl:mt-0 xl:self-start'>
          <div className='card font-syne max-w-[380px] px-8 pt-5 pb-10'>
            <p className='tracking-wider'>
              <span className='mr-2 text-lg font-bold'>Umamin</span>
              <span>(verb) [/u&apos;m&#593;&#58;min/]</span>
            </p>
            <p className='mt-4'>
              Declare to be true or admit the existence or reality or truth of
            </p>
          </div>

          <IoChatboxEllipses className='text-primary-100 absolute right-3 -top-11 text-7xl lg:right-2 lg:-top-14 lg:text-8xl xl:-left-12 xl:top-32' />
        </div>

        <div className='absolute top-44 right-0 -z-10 h-[450px] w-[450px] opacity-60 dark:opacity-10 sm:top-40 md:top-28 md:h-[550px] md:w-[550px] xl:-top-56 xl:-right-16 xl:mt-14 xl:w-[650px]'>
          <Image
            alt='hearts background'
            priority
            src='/assets/hearts_full.svg'
            fill
            className='object-contain'
          />
        </div>
      </div>

      <div className='grid grid-cols-1 justify-center justify-items-center gap-12 pt-24 sm:gap-24 sm:px-14 md:grid-cols-2 md:gap-7 md:px-0 xl:grid-cols-3'>
        {indexItems.map(({ title, description, Icon, link, className }) => (
          <div
            key={link.url}
            className={`${className} dark:bg-secondary-200 dark:border-secondary-100 flex max-w-[360px] flex-col justify-between gap-7 rounded-xl border-2 border-gray-400 bg-gray-300 p-7 transition-all duration-300 hover:scale-105 xl:max-w-[390px] xl:justify-self-auto`}
          >
            <div className='space-y-4'>
              <Icon className='text-primary-100 text-4xl' />
              <h3 className='text-lg font-medium'>{title}</h3>
              <p className='dark:text-secondary-400 text-gray-600'>
                {description}
              </p>
            </div>
            <div className='text-primary-100 mt-7 flex items-center gap-2'>
              <a
                href={link.url}
                target='_blank'
                rel='noreferrer noopener'
                className='hover-effect'
              >
                {link.title}
              </a>
              <HiOutlineArrowNarrowRight />
            </div>
          </div>
        ))}
      </div>

      <AdContainer slotId='7063833038' />
    </Container>
  );
};

Home.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export default Home;
