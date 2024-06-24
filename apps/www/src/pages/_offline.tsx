import React from 'react';
import { Layout } from '@/components';
import { Error } from '@/components/Utils';

const Offline = () => {
  return <Error message='You are offline' />;
};

Offline.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export default Offline;
