import React, { useState } from 'react';
import { getSession, signIn } from 'next-auth/react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';

import { UserForm } from '@/components';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (username: string, password: string) => {
    setLoading(true);

    const res = await signIn('credentials', {
      username,
      password,
      redirect: false,
    });

    if (res?.error) {
      toast.error(res.error);
    }

    if (res?.ok) {
      router.push('/inbox');
    }

    setLoading(false);
  };

  return <UserForm type='login' onSubmit={handleLogin} isLoading={loading} />;
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
