import React from 'react';
import { getSession } from 'next-auth/react';
import { GetServerSideProps } from 'next';
import { useMutation } from 'react-query';
import toast from 'react-hot-toast';

import { createUser } from '@/api';
import { UserForm } from '@/components';

const Register = () => {
  const { mutate, isLoading } = useMutation(createUser);

  const handleRegister = (
    username: string,
    password: string,
    login: () => void
  ) => {
    mutate(
      { username, password },
      {
        onSuccess: async () => {
          toast.success('Link created!');
          login();
        },
      }
    );
  };

  return (
    <UserForm type='register' onRegister={handleRegister} loading={isLoading} />
  );
};

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const session = await getSession({ req });

  if (session?.user?.username) {
    return {
      redirect: {
        statusCode: 301,
        destination: '/inbox',
      },
    };
  }

  return {
    props: {},
  };
};

export default Register;
