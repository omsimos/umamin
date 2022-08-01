import React from 'react';
import { markdown } from '@/constants';
import { Markdown } from '@/components';

const Donate = () => {
  return <Markdown content={markdown.donation} />;
};

export default Donate;
