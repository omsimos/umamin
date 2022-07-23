import React from 'react';
import { useUser } from '@/hooks';
import { DialogContainer, DialogContainerProps } from './Container';

interface Props extends DialogContainerProps {
  username: string;
}

export const SettingsDialog = ({ username, ...rest }: Props) => {
  const user = useUser(username);

  return (
    <DialogContainer {...rest}>
      <div className='card p-6'>
        <textarea
          className='resize-y rounded-md bg-secondary-100 px-5 py-3 outline-none'
          value={user?.message}
        />
      </div>
    </DialogContainer>
  );
};
