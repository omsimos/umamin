import React from 'react';
import dynamic from 'next/dynamic';
import { markdown } from '@/utils/constants';
import type { NextPageWithLayout } from '..';
import { Layout, Markdown } from '@/components';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const PrivacyPolicy: NextPageWithLayout = () => {
  return (
    <section className='space-y-8'>
      <AdContainer slot='3709532062' />
      <Markdown content={markdown.privacy} />
      <AdContainer slot='5214185424' />
    </section>
  );
};

PrivacyPolicy.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export default PrivacyPolicy;
