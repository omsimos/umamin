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
    <section>
      <AdContainer slotId='2204878701' className='mb-12' />
      <Markdown content={markdown.help} />
      <AdContainer slotId='2013307015' className='mt-12' />
      <AdContainer slotId='5695099369' className='mt-4' />
    </section>
  );
};

Help.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export default Help;
