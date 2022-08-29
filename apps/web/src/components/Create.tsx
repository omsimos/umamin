import React, { useState } from 'react';
import { useMutation } from 'react-query';
import { useSession } from 'next-auth/react';

import { Info } from '@/components';
import { editUsername } from '@/api';

export const Create = ({ refetch }: { refetch: () => void }) => {
  const { data } = useSession();
  const { mutate } = useMutation(editUsername);
  const [username, setUsername] = useState('');

  const handleSubmit: React.FormEventHandler = (e) => {
    e.preventDefault();

    if (data?.user?.email) {
      mutate(
        { email: data.user.email ?? '', username },
        { onSuccess: () =>  refetch()}
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
          onChange={(e) => setUsername(e.target.value)}
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
