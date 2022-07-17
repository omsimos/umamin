import React from 'react';
import { useMutation } from 'react-query';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';

import { createUser } from '@/api';
import { UserForm } from '@/components';

const Register = () => {
  const { push } = useRouter();
  const { mutate, isLoading } = useMutation(createUser);

  const handleRegister = (username: string, password: string) => {
    mutate(
      { username, password },
      {
        onSuccess: () => {
          toast.success('Link created!');
          push('/login');
        },
      }
    );
  };

  return (
    <UserForm type='register' onSubmit={handleRegister} isLoading={isLoading} />
  );
};

export default Register;
