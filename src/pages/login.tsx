import React from 'react';
import Image from 'next/image';
import { BsFillPersonFill } from 'react-icons/bs';
import { HiLockClosed } from 'react-icons/hi';

const Login = () => {
  return (
    <section className='absolute top-0 left-0 flex h-screen w-screen items-center justify-center px-5'>
      <form
        onSubmit={(e) => e.preventDefault()}
        className='card z-[1] flex w-full flex-col space-y-10 rounded-md px-5 py-10 text-center sm:w-[500px] sm:px-10'
      >
        <span className='font-syne text-5xl font-extrabold text-primary-200'>
          login
        </span>
        <div className='w-full space-y-2'>
          <div className='input-field'>
            <BsFillPersonFill />
            <input type='text' placeholder='Username' />
          </div>
          <div className='input-field'>
            <HiLockClosed />
            <input type='password' placeholder='Password' />
          </div>
        </div>
        <div className='w-full'>
          <input
            type='submit'
            value='Login'
            className='primary-btn mb-2 w-full cursor-pointer text-lg'
          />
          <p className='text-base'>
            Don&apos;t have an account?{' '}
            <span className='cursor-pointer text-primary-100'>Get started</span>
          </p>
        </div>
      </form>
      <div className='absolute bottom-40 top-0 left-0 right-0 m-auto max-h-[650px] max-w-[650px] sm:bottom-0'>
        <Image src='/assets/hearts.svg' layout='fill' objectFit='contain' />
      </div>
    </section>
  );
};

export default Login;
