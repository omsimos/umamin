import React from 'react';
import dynamic from 'next/dynamic';
import { Markdown } from '@/components';
import { markdown } from '@/utils/constants';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const Help = () => {
  return (
    <section className='space-y-8'>
      <AdContainer slot='2204878701' />
      <Markdown content={markdown.help} />
      <AdContainer slot='2013307015' />
    </section>
  );
};

export default Help;
