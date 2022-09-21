import React, { useState } from 'react';
import { useMutation } from 'react-query';
import { useSession } from 'next-auth/react';

import { Info } from '@/components';
import { editUsername } from '@/api';
import { useInboxContext } from '@/contexts/InboxContext';

export const Create = () => {
  const { data } = useSession();
  const { refetchUser } = useInboxContext();
  const { mutate } = useMutation(editUsername);
  const [username, setUsername] = useState('');

  const handleSubmit: React.FormEventHandler = (e) => {
    e.preventDefault();

    if (data?.user?.email) {
      mutate(
        { email: data.user.email ?? '', username },
        { onSuccess: () => refetchUser() }
      );
      setUsername('');
    }
  };

  return (
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
  );
};
