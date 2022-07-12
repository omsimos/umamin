import React, { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useMutation } from 'react-query';

import { createUser } from '@/api';
import { Success } from '@/components';
import { IUser } from '@/types/models';

const Create = () => {
  const [success, setSuccess] = useState(false);
  const [username, setUsername] = useState('');
  const [userInfo, setUserInfo] = useState({} as IUser);

  const { mutate } = useMutation(createUser);

  const handleCreate: React.FormEventHandler = (e) => {
    e.preventDefault();

    mutate(
      {
        username,
      },
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
      <h1 className='h1-text'>Create your profile</h1>
      <form
        onSubmit={handleCreate}
        className='flex w-full flex-col justify-center gap-3 md:flex-row'
      >
        <div className='relative md:w-[50%]'>
          <input
            required
            type='text'
            placeholder='Enter a name for your link'
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
            minLength={3}
            maxLength={20}
            className='w-full rounded bg-secondary-100 py-3 px-4 text-sm md:text-base'
          />
          <div className='absolute mt-2 hidden gap-2 text-sm md:flex'>
            <p>Already have an account?</p>
            <Link href='login'>
              <a className='text-primary-100'>Login</a>
            </Link>
          </div>
        </div>

        <button type='submit' className='primary-btn'>
          Check availability
        </button>

        <div className='flex gap-2 self-end text-sm md:hidden'>
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
