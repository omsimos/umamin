import React from 'react';
import { markdown } from '@/constants';
import { Markdown } from '@/components';

const Help = () => {
  return <Markdown content={markdown.help} />;
};

export default Help;
