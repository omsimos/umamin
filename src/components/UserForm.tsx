/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { BsFillPersonFill } from 'react-icons/bs';
import { HiLockClosed } from 'react-icons/hi';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Image from 'next/image';
import Link from 'next/link';

import { useLogEvent } from '@/hooks';

interface Props {
  type: 'register' | 'login';
  onRegister?: (username: string, password: string, login: () => void) => void;
  loading?: boolean;
}

export const UserForm = ({ type, onRegister, loading }: Props) => {
  const isLogin = type === 'login';
  const { push } = useRouter();
  const { status } = useSession();
  const triggerEvent = useLogEvent();

  useEffect(() => {
    if (status === 'authenticated') {
      push('/inbox');
    }
  }, [status]);

  const [loginLoading, setLoading] = useState(false);
  const isLoading = loading || loginLoading;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogin = async () => {
    setLoading(true);

    const res = await signIn('credentials', {
      username,
      password,
      redirect: false,
    });

    if (res?.error) {
      toast.error(res.error);
    }

    if (res?.ok) {
      push('/inbox');
    }

    setLoading(false);

    if (isLogin) {
      triggerEvent('login');
    }
  };

  const handleSubmit: React.FormEventHandler = (e) => {
    e.preventDefault();
    if (onRegister) {
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }

      onRegister(username, password, handleLogin);
      return;
    }

    handleLogin();
  };

  const buttonText = () => {
    if (isLogin) {
      return isLoading ? 'Logging in...' : 'Login';
    }

    return isLoading ? 'Creating link...' : 'Register';
  };

  return (
    <section className='flex justify-center md:absolute md:left-0 md:top-0 md:h-screen md:w-full md:items-center'>
      <form
        onSubmit={handleSubmit}
        className='card z-[1] flex w-full flex-col space-y-10 rounded-md px-5 py-10 text-center sm:w-[500px] sm:px-10'
      >
        <span className='font-syne text-5xl font-extrabold text-primary-200'>
          {type}
        </span>

        <div className='w-full space-y-2'>
          <div className='input-field'>
            <BsFillPersonFill />
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              type='text'
              placeholder='Username'
              minLength={3}
              maxLength={12}
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
              minLength={5}
            />
          </div>

          {!isLogin && (
            <div className='input-field'>
              <HiLockClosed />
              <input
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type='password'
                placeholder='Confirm Password'
                minLength={5}
              />
            </div>
          )}
        </div>

        <div className='w-full'>
          <button
            disabled={isLoading}
            type='submit'
            className='primary-btn mb-2 w-full cursor-pointer'
          >
            {buttonText()}
          </button>

          <p className='text-sm'>
            {isLogin ? "Don't" : 'Already'} have an account?{' '}
            <Link href={`${isLogin ? '/register' : 'login'}`}>
              <a className='text-primary-100'>
                {isLogin ? 'Get started' : 'Login'}
              </a>
            </Link>
          </p>
        </div>
      </form>
      <div className='absolute bottom-40 top-0 left-0 right-0 m-auto max-h-[650px] max-w-[650px] md:bottom-0'>
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
