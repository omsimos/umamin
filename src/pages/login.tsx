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
        <div className='w-full space-y-2 [&>div]:flex [&>div]:items-center [&>div]:space-x-2 [&>div]:rounded-md [&>div]:bg-secondary-100 [&>div]:px-5 [&>div]:py-3 [&>div,_input]:w-full [&>div>input]:bg-transparent [&>div>input]:outline-none [&>div>svg]:text-xl [&>div>svg]:text-[#9CA3AF]'>
          <div>
            <BsFillPersonFill />
            <input type='text' placeholder='Username' />
          </div>
          <div>
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
      <Image
        src='/assets/hearts.svg'
        layout='fill'
        objectFit='contain'
        className='scale-50'
      />
    </section>
  );
};

export default Login;
