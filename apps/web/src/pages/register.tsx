import React from 'react';
import type { NextPageWithLayout } from '..';
import { Layout, UserForm } from '@/components';

const Register: NextPageWithLayout = () => {
  return <UserForm type='register' />;
};

Register.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export default Register;
