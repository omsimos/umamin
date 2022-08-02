import React from 'react';
import dynamic from 'next/dynamic';
import { markdown } from '@/constants';
import { Markdown } from '@/components';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const Help = () => {
  return (
    <section className='space-y-4'>
      <AdContainer slot='7063833038' />
      <Markdown content={markdown.help} />
      <AdContainer slot='7063833038' />
    </section>
  );
};

export default Help;
