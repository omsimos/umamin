import React, { useState } from 'react';
import { useMutation } from 'react-query';
import { User } from '@umamin/generated';
import toast from 'react-hot-toast';
import bcrypt from 'bcryptjs';

import { changePassword } from '@/api';

interface Props {
  user: User;
  handleClose: () => void;
}

export const ChangePassword = ({ user, handleClose }: Props) => {
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');

  const { mutate } = useMutation(changePassword);

  const handleChangePassword: React.FormEventHandler = (e) => {
    e.preventDefault();
    const correctPassword = bcrypt.compareSync(currentPass, user.password);

    if (!correctPassword) {
      toast.error('Current password is incorrect');
    } else if (currentPass === newPass) {
      toast.error('New password is the same as current password');
    } else if (newPass !== confirmNewPass) {
      toast.error('New passwords do not match');
    } else {
      mutate(
        {
          username: user.username,
          newPassword: newPass,
        },
        {
          onSuccess: () => {
            toast.success('Password updated');
            handleClose();
          },
        }
      );
    }
  };

  return (
    <form onSubmit={handleChangePassword} className='flex flex-col'>
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
      <div className='line my-4' />

      <div className='flex items-center space-x-4 self-end'>
        <button type='button' onClick={handleClose}>
          Close
        </button>

        <button className='primary-btn' type='submit'>
          Change
        </button>
      </div>
    </form>
  );
};
