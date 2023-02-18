import React from 'react';
import { Error, Layout } from '@/components';

const Offline = () => {
  return <Error message='You are offline' />;
};

Offline.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export default Offline;
