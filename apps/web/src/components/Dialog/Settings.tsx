import React, { useState, useEffect } from 'react';
import { MdArrowDropDown, MdArrowDropUp } from 'react-icons/md';
import { signIn, signOut } from 'next-auth/react';
import { FaDiscord } from 'react-icons/fa';
import { useMutation } from 'react-query';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';

import { editUser, deleteUser } from '@/api';
import { useUser } from '@/hooks';
import { ChangePassword } from '../Settings';
import { ConfirmDialog, DialogContainer, DialogContainerProps } from '.';

interface Props extends DialogContainerProps {
  username: string;
}

export const SettingsDialog = ({ username, setIsOpen, ...rest }: Props) => {
  const { push } = useRouter();
  const { data: user, refetch } = useUser(username);
  const [deleteModal, setDeleteModal] = useState(false);
  const [message, setMessage] = useState(user?.message ?? '');
  const [openChangePass, setOpenChangePass] = useState(false);

  const { mutate: editUserMutate } = useMutation(editUser);
  const { mutate: deleteUserMutate } = useMutation(deleteUser);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setOpenChangePass(false);
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
      editUserMutate(
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

  const handleDeleteUser = () => {
    deleteUserMutate(
      { username },
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
          )}
        </div>
      </DialogContainer>
    </>
  );
};
