import React, { useState } from 'react';
import { useMutation } from 'react-query';
import dynamic from 'next/dynamic';

import { Info } from '@/components';
import { editUsername } from '@/api';
import { useInboxContext } from '@/contexts/InboxContext';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

export const Create = () => {
  const { refetchUser } = useInboxContext();
  const { mutate } = useMutation(editUsername);
  const [username, setUsername] = useState('');

  const handleSubmit: React.FormEventHandler = (e) => {
    e.preventDefault();

    mutate({ username }, { onSuccess: () => refetchUser() });
    setUsername('');
  };

  return (
    <>
      <AdContainer
        slotId='2894865577'
        className='mb-8'
        adClassName='h-[120px]'
      />

      <section className='mx-auto max-w-screen-sm'>
        <form onSubmit={handleSubmit} className='mb-2 flex space-x-2'>
          <input
            required
            type='text'
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder='Enter new username'
            minLength={3}
            maxLength={12}
            className='settings-input'
          />
          <button type='submit' className='primary-btn flex-none'>
            Set Username
          </button>
        </form>

        <Info message='You can still change your username later.' />
      </section>

      <AdContainer slotId='3864332312' className='mt-8' />
    </>
  );
};
