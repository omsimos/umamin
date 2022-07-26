import React, { useState, useEffect } from 'react';
import { useMutation } from 'react-query';
import toast from 'react-hot-toast';

import { editUser } from '@/api';
import { useUser } from '@/hooks';
import { DialogContainer, DialogContainerProps } from '.';

interface Props extends DialogContainerProps {
  username: string;
}

export const SettingsDialog = ({ username, setIsOpen, ...rest }: Props) => {
  const { data: user, refetch } = useUser(username);
  const [message, setMessage] = useState(user?.message ?? '');

  const { mutate } = useMutation(editUser);

  useEffect(() => {
    if (user?.message) {
      setMessage(user?.message);
    }
  }, [user?.message]);

  const handleEdit = () => {
    if (message !== user?.message) {
      mutate(
        {
          username,
          message,
        },
        {
          onSuccess: () => {
            toast.success('Message updated');
            setIsOpen(false);
            refetch();
          },
        }
      );
    }
  };

  return (
    <DialogContainer
      setIsOpen={setIsOpen}
      onClose={() => setMessage(user?.message ?? '')}
      className='mt-32 md:mt-52'
      {...rest}
    >
      <div className='card flex flex-col p-6'>
        <p className='mb-2 text-sm font-medium text-secondary-400'>
          Custom Message
        </p>
        <textarea
          maxLength={100}
          className='min-h-[100px] w-full resize-none rounded-md bg-secondary-100 px-5 py-3 outline-none'
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <div className='line my-4' />

        <div className='flex items-center space-x-4 self-end'>
          <button
            onClick={() => {
              setIsOpen(false);
              setMessage(user?.message ?? '');
            }}
            type='button'
          >
            Close
          </button>

          <button onClick={handleEdit} className='primary-btn' type='button'>
            Save
          </button>
        </div>
      </div>
    </DialogContainer>
  );
};
