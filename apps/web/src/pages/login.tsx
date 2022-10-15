import React from 'react';
import type { NextPageWithLayout } from '..';
import { Layout, UserForm } from '@/components';

const Login: NextPageWithLayout = () => {
  return <UserForm type='login' />;
};

Login.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export default Login;
