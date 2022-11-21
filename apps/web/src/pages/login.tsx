import React from 'react';
import { Layout, UserForm } from '@/components';
import type { NextPageWithLayout } from '..';

const Login: NextPageWithLayout = () => {
  return <UserForm type='login' />;
};

Login.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export default Login;
