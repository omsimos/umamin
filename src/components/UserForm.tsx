import React, { useState } from 'react';
import { BsFillPersonFill } from 'react-icons/bs';
import { HiLockClosed } from 'react-icons/hi';
import toast from 'react-hot-toast';
import Image from 'next/image';
import Link from 'next/link';

interface Props {
  type: 'login' | 'register';
  // eslint-disable-next-line no-unused-vars
  onSubmit: (username: string, password: string) => void;
  isLoading: boolean;
}

export const UserForm = ({ type, onSubmit, isLoading }: Props) => {
  const isLogin = type === 'login';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit: React.FormEventHandler = (e) => {
    e.preventDefault();
    if (!isLogin) {
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }

    onSubmit(username, password);
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
              onChange={(e) => setUsername(e.target.value)}
              type='text'
              placeholder='Username'
              minLength={3}
              maxLength={15}
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
        <Image src='/assets/hearts.svg' layout='fill' objectFit='contain' />
      </div>
    </section>
  );
};
