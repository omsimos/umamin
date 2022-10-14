import React from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

import type { NextPageWithLayout } from '..';
import { Layout, UserForm } from '@/components';

const Login: NextPageWithLayout = () => {
  const { status } = useSession();
  const { push } = useRouter();

  if (status === 'authenticated') {
    push('/inbox');
  }

  return <UserForm type='login' />;
};

Login.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export default Login;
