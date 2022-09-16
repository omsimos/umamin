import React from 'react';
import dynamic from 'next/dynamic';
import { markdown } from '@/utils/constants';
import type { NextPageWithLayout } from '..';
import { Layout, Markdown } from '@/components';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const Help: NextPageWithLayout = () => {
  return (
    <section className='space-y-8'>
      <AdContainer slot='2204878701' />
      <Markdown content={markdown.help} />
      <AdContainer slot='2013307015' />
    </section>
  );
};

Help.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export default Help;
