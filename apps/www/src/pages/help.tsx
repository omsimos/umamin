import React from 'react';
import dynamic from 'next/dynamic';

import { Layout } from '@/components';
import { markdown } from '@/utils/constants';
import { Container, Markdown } from '@/components/Utils';
import type { NextPageWithLayout } from '..';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const Help: NextPageWithLayout = () => {
  return (
    <Container>
      <AdContainer slotId='2204878701' className='mb-12' />
      <Markdown content={markdown.help} />
      <AdContainer slotId='2013307015' className='mt-12' />
    </Container>
  );
};

Help.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export default Help;
