import React, { useState } from 'react';
import { useMutation } from 'react-query';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { createUser } from '@/api';
import { Success } from '@/components';
import type { User } from '@/generated/graphql';

const Create = () => {
  const [success, setSuccess] = useState(false);
  const [username, setUsername] = useState('');
  const [userInfo, setUserInfo] = useState({} as User);

  const { mutate, isLoading } = useMutation(createUser);

  const handleCreate: React.FormEventHandler = (e) => {
    e.preventDefault();
    mutate(
      { username },
      {
        onSuccess: (data) => {
          setUserInfo(data.createUser);
          setSuccess(true);
          toast.success('Link created!');
        },
      }
    );
  };

  return success ? (
    <Success data={userInfo} />
  ) : (
    <section className='flex flex-col items-center gap-8'>
      <h1 className='h1-text'>Getting started</h1>
      <form
        onSubmit={handleCreate}
        className='flex w-full flex-col justify-center gap-3 sm:flex-row'
      >
        <div className='relative sm:w-[50%] xl:w-[40%]'>
          <div className='flex w-full justify-between rounded bg-secondary-100 py-3 px-4 text-sm md:text-base'>
            <input
              required
              type='text'
              placeholder='Enter a name for your link'
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
              minLength={3}
              maxLength={15}
              className='w-full bg-secondary-100 outline-none'
            />
            {isLoading && <span className='loader flex-none' />}
          </div>
          <p className='absolute mt-2 hidden text-sm sm:block'>
            Already have an account?{' '}
            <Link href='login'>
              <a className='text-primary-100'>Login</a>
            </Link>
          </p>
        </div>

        <button
          type='submit'
          disabled={isLoading}
          className='primary-btn disabled:cursor-not-allowed'
        >
          Create your link
        </button>

        <div className='flex gap-2 self-end text-sm sm:hidden'>
          <p>Already have an account?</p>
          <Link href='login'>
            <a className='text-primary-100'>Login</a>
          </Link>
        </div>
      </form>
    </section>
  );
};

export default Create;
