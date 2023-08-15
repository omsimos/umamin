import React from 'react';
import dynamic from 'next/dynamic';
import { Layout } from '@/components';
import { markdown } from '@/utils/constants';
import { Container, Markdown } from '@/components/Utils';
import type { NextPageWithLayout } from '..';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const PrivacyPolicy: NextPageWithLayout = () => {
  return (
    <Container className='space-y-12'>
      <AdContainer slotId='3709532062' />
      <Markdown content={markdown.privacy} />
      <AdContainer slotId='5214185424' />
    </Container>
  );
};

PrivacyPolicy.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export default PrivacyPolicy;
