import React from 'react';
import toast from 'react-hot-toast';
import { useMutation } from 'react-query';

import { createUser } from '@/api';
import { useLogEvent } from '@/hooks';
import { NextPageWithLayout } from '..';
import { Layout, UserForm } from '@/components';

const Register: NextPageWithLayout = () => {
  const triggerEvent = useLogEvent();
  const { mutate, isLoading } = useMutation(createUser);

  const handleRegister = (
    username: string,
    password: string,
    login: () => void
  ) => {
    mutate(
      { username, password },
      {
        onSuccess: () => {
          login();
          toast.success('Link created!');
          triggerEvent('register');
        },
      }
    );
  };

  return (
    <UserForm type='register' onRegister={handleRegister} loading={isLoading} />
  );
};

Register.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export default Register;
