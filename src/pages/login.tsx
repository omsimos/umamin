import React, { useState } from 'react';
import { BsFillPersonFill } from 'react-icons/bs';
import { HiLockClosed } from 'react-icons/hi';
import Image from 'next/image';
import Link from 'next/link';
import { getSession, signIn } from 'next-auth/react';
import { GetServerSideProps } from 'next';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin: React.FormEventHandler = async (e) => {
    e.preventDefault();
    await signIn('credentials', { username, password });
  };

  return (
    <section className='absolute top-0 left-0 flex h-screen w-screen items-center justify-center px-5'>
      <form
        onSubmit={handleLogin}
        className='card z-[1] flex w-full flex-col space-y-10 rounded-md px-5 py-10 text-center sm:w-[500px] sm:px-10'
      >
        <span className='font-syne text-5xl font-extrabold text-primary-200'>
          login
        </span>
        <div className='w-full space-y-2'>
          <div className='input-field'>
            <BsFillPersonFill />
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              type='text'
              placeholder='Username'
            />
          </div>
          <div className='input-field'>
            <HiLockClosed />
            <input
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type='password'
              placeholder='Password'
            />
          </div>
        </div>
        <div className='w-full'>
          <button
            type='submit'
            className='primary-btn mb-2 w-full cursor-pointer'
          >
            Login
          </button>
          <p className='text-sm'>
            Don&apos;t have an account?{' '}
            <Link href='/create'>
              <a className='text-primary-100'>Get started</a>
            </Link>
          </p>
        </div>
      </form>
      <div className='absolute bottom-40 top-0 left-0 right-0 m-auto max-h-[650px] max-w-[650px] sm:bottom-0'>
        <Image src='/assets/hearts.svg' layout='fill' objectFit='contain' />
      </div>
    </section>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const session = await getSession({ req });

  if (session?.user?.username) {
    return {
      redirect: {
        statusCode: 301,
        destination: '/inbox',
      },
    };
  }

  return {
    props: {},
  };
};

export default Login;
