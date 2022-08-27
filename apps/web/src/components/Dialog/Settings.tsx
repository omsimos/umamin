import React, { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { useMutation } from 'react-query';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';

import { useUser } from '@/hooks';
import { editUserMessage, deleteUser } from '@/api';
import { ConfirmDialog, DialogContainer, DialogContainerProps } from '.';

interface Props extends DialogContainerProps {
  email: string;
}

export const SettingsDialog = ({ email, setIsOpen, ...rest }: Props) => {
  const { push } = useRouter();
  const { data: user, refetch } = useUser(email, 'email');
  const [deleteModal, setDeleteModal] = useState(false);
  const [message, setMessage] = useState(user?.message ?? '');

  const { mutate: edutUserMessageMutate } = useMutation(editUserMessage);
  const { mutate: deleteUserMutate } = useMutation(deleteUser);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setMessage(user?.message ?? '');
    }, 500);
  };

  useEffect(() => {
    if (user?.message) {
      setMessage(user?.message);
    }
  }, [user?.message]);

  const handleEdit = () => {
    if (message !== user?.message) {
      edutUserMessageMutate(
        {
          email,
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

  const handleDeleteUser = () => {
    deleteUserMutate(
      { email },
      {
        onSuccess: async () => {
          toast.success('User deleted');
          await signOut({ redirect: false });
          push('/login');
        },
      }
    );
  };

  return (
    <>
      <ConfirmDialog
        isOpen={deleteModal}
        setIsOpen={setDeleteModal}
        content={
          <p>
            ⚠️ Are you sure you want to delete your account along with your
            messages? This action is permanent.
          </p>
        }
        handleConfirm={handleDeleteUser}
      />
      <DialogContainer
        transparent
        setIsOpen={setIsOpen}
        onClose={() => setMessage(user?.message ?? '')}
        className='grid h-full place-items-center'
        {...rest}
      >
        <div className='msg-card flex flex-col space-y-4 p-6'>
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

          <div className='flex items-center justify-between'>
            <button
              onClick={() => {
                setIsOpen(false);

                setTimeout(() => {
                  setDeleteModal(true);
                }, 500);
              }}
              className='text-red-500 hover:underline'
              type='button'
            >
              Delete Account
            </button>

            <div className='flex items-center space-x-4'>
              <button onClick={handleClose} type='button'>
                Close
              </button>

              <button
                onClick={handleEdit}
                className='primary-btn'
                type='button'
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </DialogContainer>
    </>
  );
};
