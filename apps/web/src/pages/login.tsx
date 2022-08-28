import React from 'react';
import { signIn, useSession } from 'next-auth/react';
import { FaDiscord } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Image from 'next/image';

import { useLogEvent } from '@/hooks';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const Login = () => {
  const { status } = useSession();
  const { push, query } = useRouter();
  const triggerEvent = useLogEvent();

  if (status === 'authenticated') {
    push('/inbox');
  }

  return (
    <section className='min-h-screen space-y-8'>
      <div className='flex flex-col items-center space-y-12'>
        <div className='card z-[1] flex w-full flex-col space-y-10 rounded-md px-5 py-10 text-center sm:w-[500px] sm:px-10'>
          <span className='font-syne text-primary-200 text-5xl font-extrabold'>
            Login
          </span>

          <div>
            <button
              type='button'
              className='bg-dcblue hover:bg-dcblue/80 btn mb-2 flex w-full items-center justify-center space-x-2'
              onClick={() => {
                signIn('discord');
                triggerEvent('login', { provider: 'discord' });
              }}
            >
              <FaDiscord className='text-lg' />
              <p>Sign in with Discord</p>
            </button>
            <button
              type='button'
              className='btn mb-2 flex w-full items-center justify-center space-x-2 bg-white font-semibold text-black hover:bg-white/80'
              onClick={() => {
                signIn('google');
                triggerEvent('login', { provider: 'google' });
              }}
            >
              <FcGoogle className='text-xl' />
              <p>Sign in with Google</p>
            </button>

            {query.error === 'OAuthAccountNotLinked' && (
              <p className='mt-4'>
                Email is already linked to a different provider
              </p>
            )}
          </div>
        </div>
        <div className='absolute bottom-40 top-0 left-0 right-0 m-auto max-h-[650px] max-w-[650px] md:bottom-0'>
          <Image
            priority
            src='/assets/hearts.svg'
            layout='fill'
            objectFit='contain'
          />
        </div>
      </div>
      <AdContainer slot='7063833038' />
    </section>
  );
};

export default Login;
