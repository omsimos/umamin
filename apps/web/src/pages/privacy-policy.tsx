import React from 'react';
import dynamic from 'next/dynamic';
import { markdown } from '@/constants';
import { Markdown } from '@/components';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const PrivacyPolicy = () => {
  return (
    <section className='space-y-8'>
      <AdContainer slot='7063833038' />
      <Markdown content={markdown.privacy} />
      <AdContainer slot='7063833038' />
    </section>
  );
};

export default PrivacyPolicy;
