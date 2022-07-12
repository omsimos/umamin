import React, { useState } from 'react';
import { BsFillPersonFill } from 'react-icons/bs';
import { HiLockClosed } from 'react-icons/hi';
import { useMutation } from 'react-query';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Image from 'next/image';
import Link from 'next/link';

import { loginUser } from '@/api';
import { useStore } from '@/hooks';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const { push } = useRouter();
  const { mutate } = useMutation(loginUser);

  const setCurrentUser = useStore((state) => state.setCurrentUser);

  const handleLogin: React.FormEventHandler = async (e) => {
    e.preventDefault();

    mutate(
      {
        username,
        password,
      },
      {
        onSuccess: () => {
          toast.success('Login successful');
          setCurrentUser(username);
          push(`/inbox/${username}`);
        },
      }
    );
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

export default Login;
