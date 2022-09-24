import React from 'react';
import { Layout } from '@/components';

const Error404 = () => {
  return (
    <section>
      <h1 className='h1-text text-center'>Are you lost?</h1>
    </section>
  );
};

Error404.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export default Error404;
