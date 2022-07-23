import React, { useState, useEffect } from 'react';

import { useUser } from '@/hooks';
import { DialogContainer, DialogContainerProps } from './Container';

interface Props extends DialogContainerProps {
  username: string;
}

export const SettingsDialog = ({ username, setIsOpen, ...rest }: Props) => {
  const { data: user } = useUser(username);
  const [message, setMessage] = useState(user?.message);

  useEffect(() => {
    setMessage(user?.message);
  }, [user?.message]);

  return (
    <DialogContainer
      setIsOpen={setIsOpen}
      onClose={() => setMessage(user?.message)}
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
          <button onClick={() => setIsOpen(false)} type='button'>
            Close
          </button>

          <button className='primary-btn' type='button'>
            Save
          </button>
        </div>
      </div>
    </DialogContainer>
  );
};
