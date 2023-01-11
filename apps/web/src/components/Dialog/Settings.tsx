import React, { useState } from 'react';
import { MdArrowDropDown } from 'react-icons/md';
import { signOut } from 'next-auth/react';
import { useMutation } from 'react-query';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import bcrypt from 'bcryptjs';

import {
  editUserMessage,
  deleteUser,
  editUsername,
  changePassword,
} from '@/api';
import { useLogEvent } from '@/hooks';
import { useInboxContext } from '@/contexts/InboxContext';
import { ConfirmDialog, DialogContainer, DialogContainerProps } from '.';

interface Props extends DialogContainerProps {}

export const SettingsDialog = ({ setIsOpen, ...rest }: Props) => {
  const { push } = useRouter();
  const triggerEvent = useLogEvent();
  const { user, refetchUser } = useInboxContext();
  const [deleteModal, setDeleteModal] = useState(false);
  const [message, setMessage] = useState(user?.message ?? '');
  const [username, setUsername] = useState(user?.username ?? '');

  const [currentOption, setCurrentOption] = useState<
    'message' | 'username' | 'password'
  >('message');

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');

  const { mutate: deleteUserMutate, isLoading: delUserL } =
    useMutation(deleteUser);
  const { mutate: editUsernameMutate, isLoading: editUserL } =
    useMutation(editUsername);
  const { mutate: editUserMessageMutate, isLoading: editUserMsgL } =
    useMutation(editUserMessage);
  const { mutate: changePasswordMutate, isLoading: changePassL } =
    useMutation(changePassword);

  const revalidate = async (username: string) => {
    await fetch(
      `/api/revalidate?${new URLSearchParams({
        username,
      })}`
    );
  };

  const handleClose = () => {
    setTimeout(() => {
      setCurrentOption('message');
      setMessage(user?.message ?? '');
      setUsername(user?.username ?? '');

      setNewPass('');
      setCurrentPass('');
      setConfirmNewPass('');
    }, 500);
  };

  const handleEdit: React.FormEventHandler = (e) => {
    e.preventDefault();

    if (user?.id) {
      if (currentOption === 'message' && message !== user.message) {
        editUserMessageMutate(
          {
            message,
          },
          {
            onSuccess: () => {
              setIsOpen(false);
              refetchUser();
              toast.success('Message updated');
              revalidate(user.username ?? '');

              triggerEvent('edit_user_message');
            },
          }
        );
      }

      if (currentOption === 'username' && username !== user.username) {
        editUsernameMutate(
          {
            username,
          },
          {
            onSuccess: () => {
              setIsOpen(false);
              refetchUser();
              revalidate(username);

              toast.success('Username updated');

              triggerEvent('edit_username');
            },
          }
        );
      }

      if (currentOption === 'password' && user.password) {
        const correctPassword = bcrypt.compareSync(currentPass, user.password);

        if (!correctPassword) {
          toast.error('Current password is incorrect');
        } else if (currentPass === newPass) {
          toast.error('New password is the same as current password');
        } else if (newPass !== confirmNewPass) {
          toast.error('New passwords do not match');
        } else {
          changePasswordMutate(
            {
              newPassword: newPass,
            },
            {
              onSuccess: () => {
                toast.success('Password updated');
                setIsOpen(false);
              },
            }
          );
        }
      }
    }
  };

  const handleDeleteUser = () => {
    if (user?.id) {
      deleteUserMutate(
        {},
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

  const isLoading = delUserL || editUserL || editUserMsgL || changePassL;

  return (
    <>
      <ConfirmDialog
        isOpen={deleteModal}
        setIsOpen={setDeleteModal}
        confirmText='Delete'
        danger
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
        <form
          onSubmit={handleEdit}
          className='msg-card flex flex-col space-y-4 p-6'
        >
          <div>
            <div className='flex justify-between'>
              <button
                type='button'
                onClick={() => setCurrentOption('message')}
                className='settings-label'
              >
                <p>Custom Message</p>
                {currentOption !== 'message' && (
                  <MdArrowDropDown className='text-xl' />
                )}
              </button>
              {isLoading && <span className='loader' />}
            </div>

            {currentOption === 'message' && (
              <textarea
                required
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
              onClick={() => setCurrentOption('username')}
              className='settings-label'
            >
              <p>Change Username</p>
              {currentOption !== 'username' && (
                <MdArrowDropDown className='text-xl' />
              )}
            </button>
            {currentOption === 'username' && (
              <input
                required
                minLength={3}
                maxLength={12}
                className='settings-input'
                value={username}
                placeholder='Enter a your username'
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
              />
            )}
          </div>

          {user?.password && (
            <div>
              <button
                type='button'
                onClick={() => setCurrentOption('password')}
                className='settings-label'
              >
                <p>Change Password</p>
                {currentOption !== 'password' && (
                  <MdArrowDropDown className='text-xl' />
                )}
              </button>
              {currentOption === 'password' && (
                <div className='space-y-3'>
                  <input
                    required
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    type='password'
                    placeholder='Current password'
                    className='settings-input'
                  />
                  <input
                    required
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    type='password'
                    placeholder='New password'
                    className='settings-input'
                  />
                  <input
                    required
                    value={confirmNewPass}
                    onChange={(e) => setConfirmNewPass(e.target.value)}
                    type='password'
                    placeholder='Confirm new password'
                    className='settings-input'
                  />
                </div>
              )}
            </div>
          )}

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
                disabled={isLoading}
                className='primary-btn'
                type='submit'
              >
                <p>Save</p>
              </button>
            </div>
          </div>
        </form>
      </DialogContainer>
    </>
  );
};
