import React, { useState } from 'react';
import { MdArrowDropDown } from 'react-icons/md';
import { signOut } from 'next-auth/react';
import { useMutation } from 'react-query';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';

import { useLogEvent } from '@/hooks';
import { useInboxContext } from '@/contexts/InboxContext';
import { ConfirmDialog, DialogContainer, DialogContainerProps } from '.';
import { editUserMessage, deleteUser, editUsername } from '@/api';

interface Props extends DialogContainerProps {}

export const SettingsDialog = ({ setIsOpen, ...rest }: Props) => {
  const { push } = useRouter();
  const triggerEvent = useLogEvent();
  const { user, refetchUser } = useInboxContext();
  const [deleteModal, setDeleteModal] = useState(false);
  const [changeUsername, setChangeUsername] = useState(false);
  const [message, setMessage] = useState(user?.message ?? '');
  const [username, setUsername] = useState(user?.username ?? '');

  const { mutate: deleteUserMutate } = useMutation(deleteUser);
  const { mutate: editUsernameMutate } = useMutation(editUsername);
  const { mutate: editUserMessageMutate } = useMutation(editUserMessage);

  const handleClose = () => {
    setTimeout(() => {
      setChangeUsername(false);
      setMessage(user?.message ?? '');
      setUsername(user?.username ?? '');
    }, 500);
  };

  const handleEdit = () => {
    if (user?.id) {
      if (changeUsername && username !== user.username) {
        editUsernameMutate(
          {
            id: user?.id,
            username,
          },
          {
            onSuccess: () => {
              setIsOpen(false);
              refetchUser();
              toast.success('Username updated');

              triggerEvent('edit_username');
            },
          }
        );
      }

      if (!changeUsername && message !== user.message) {
        editUserMessageMutate(
          {
            id: user?.id,
            message,
          },
          {
            onSuccess: () => {
              setIsOpen(false);
              refetchUser();
              toast.success('Username updated');

              triggerEvent('edit_user_message');
            },
          }
        );
      }
    }
  };

  const handleDeleteUser = () => {
    if (user?.id) {
      deleteUserMutate(
        { id: user.id },
        {
          onSuccess: async () => {
            toast.success('User deleted');
            await signOut({ redirect: false });
            push('/login');

            triggerEvent('delete_account');
          },
        }
      );
    }
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
        onClose={handleClose}
        className='grid place-items-center'
        {...rest}
      >
        <div className='msg-card flex flex-col space-y-4 p-6'>
          <div>
            <button
              type='button'
              onClick={() => setChangeUsername(false)}
              className='settings-label'
            >
              <p>Custom Message</p>
              {changeUsername && <MdArrowDropDown className='text-xl' />}
            </button>

            {!changeUsername && (
              <textarea
                minLength={1}
                maxLength={100}
                className='settings-input min-h-[100px] resize-none'
                value={message}
                placeholder='Enter a custom message'
                onChange={(e) => setMessage(e.target.value)}
              />
            )}
          </div>

          <span className='line' />

          <div>
            <button
              type='button'
              onClick={() => setChangeUsername(true)}
              className='settings-label'
            >
              <p>Change Username</p>
              {!changeUsername && <MdArrowDropDown className='text-xl' />}
            </button>
            {changeUsername && (
              <input
                minLength={3}
                maxLength={12}
                className='settings-input'
                value={username}
                placeholder='Enter a your username'
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
              />
            )}
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
              <button
                onClick={() => {
                  setIsOpen(false);
                  handleClose();
                }}
                type='button'
              >
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
