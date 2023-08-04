import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

import { Container, Info } from '@/components';
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

    mutate(
      { username },
      {
        onSuccess: (data) => {
          if (data.editUsername.error) {
            toast.error(data.editUsername.error);
            return;
          }

          refetchUser();
        },
      }
    );
    setUsername('');
  };

  return (
    <>
      <Container className='mx-auto max-w-screen-sm'>
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
      </Container>

      <AdContainer slotId='3864332312' className='mt-8' />
    </>
  );
};
