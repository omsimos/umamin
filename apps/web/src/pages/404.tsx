import React from 'react';
import { Layout } from '@/components';
import { Error } from '@/components/Utils';

const Error404 = () => {
  return <Error message='Are you lost?' />;
};

Error404.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export default Error404;
