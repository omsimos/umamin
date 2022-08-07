import React, { useState, useEffect } from 'react';
import { MdArrowDropDown, MdArrowDropUp } from 'react-icons/md';
import { FaDiscord } from 'react-icons/fa';
import { useMutation } from 'react-query';
import { signIn } from 'next-auth/react';
import toast from 'react-hot-toast';

import { editUser } from '@/api';
import { useUser } from '@/hooks';
import { ChangePassword } from '../Settings';
import { DialogContainer, DialogContainerProps } from '.';

interface Props extends DialogContainerProps {
  username: string;
}

export const SettingsDialog = ({ username, setIsOpen, ...rest }: Props) => {
  const { data: user, refetch } = useUser(username);
  const [message, setMessage] = useState(user?.message ?? '');
  const [openChangePass, setOpenChangePass] = useState(false);

  const { mutate } = useMutation(editUser);

  const handleClose = () => {
    setIsOpen(false);
    setOpenChangePass(false);
    setMessage(user?.message ?? '');
  };

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
      className='grid h-full place-items-center'
      {...rest}
    >
      <div className='card flex flex-col space-y-4 p-6'>
        {!openChangePass && (
          <>
            <div>
              <p className='settings-label'>Custom Message</p>
              <textarea
                minLength={1}
                maxLength={100}
                className='settings-input min-h-[100px] resize-none'
                value={message}
                placeholder='Enter a custom message'
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
              
            <button
              type='button'
              className='bg-dcblue hover:bg-dcblue/80 btn mb-2 flex w-full items-center justify-center space-x-2'
              onClick={() => {
                signIn('discord');
              }}
            >
              <FaDiscord className='text-lg' />
              <p>Connect to Discord</p>
            </button>
          </>
        )}

        <div>
          <button
            type='button'
            onClick={() => setOpenChangePass((p) => !p)}
            className='settings-label flex items-center space-x-1'
          >
            <p>Change Password</p>
            {openChangePass ? (
              <MdArrowDropUp className='text-2xl' />
            ) : (
              <MdArrowDropDown className='text-2xl' />
            )}
          </button>

          {user && openChangePass && (
            <ChangePassword user={user} handleClose={handleClose} />
          )}
        </div>

        {!openChangePass && (
          <div className='flex items-center space-x-4 self-end'>
            <button onClick={handleClose} type='button'>
              Close
            </button>

            <button onClick={handleEdit} className='primary-btn' type='button'>
              Save
            </button>
          </div>
        )}
      </div>
    </DialogContainer>
  );
};
