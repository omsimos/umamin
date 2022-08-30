import React from 'react';
import dynamic from 'next/dynamic';
import { Markdown } from '@/components';
import { markdown } from '@/utils/constants';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const PrivacyPolicy = () => {
  return (
    <section className='space-y-8'>
      <AdContainer slot='3709532062' />
      <Markdown content={markdown.privacy} />
      <AdContainer slot='5214185424' />
    </section>
  );
};

export default PrivacyPolicy;
