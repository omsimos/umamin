import React from 'react';
import toast from 'react-hot-toast';
import { useMutation } from '@tanstack/react-query';

import { createUser } from '@/api';
import { useLogEvent } from '@/hooks';
import { Layout, UserForm } from '@/components';
import { NextPageWithLayout } from '..';

const Register: NextPageWithLayout = () => {
  const triggerEvent = useLogEvent();
  const { mutate, isPending } = useMutation({ mutationFn: createUser });

  const handleRegister = (
    username: string,
    password: string,
    login: () => void
  ) => {
    mutate(
      { username, password },
      {
        onSuccess: (data) => {
          if (data.createUser.error) {
            toast.error(data.createUser.error);
            return;
          }

          login();
          toast.success('Link created!');
          triggerEvent('register');
        },
      }
    );
  };

  return (
    <UserForm type='register' onRegister={handleRegister} loading={isPending} />
  );
};

Register.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export default Register;
