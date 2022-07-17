import React from 'react';
import { getSession } from 'next-auth/react';
import { GetServerSideProps } from 'next';

import { UserForm } from '@/components';

const Login = () => {
  return <UserForm type='login' />;
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

export default Login;
