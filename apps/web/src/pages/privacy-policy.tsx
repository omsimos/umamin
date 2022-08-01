import React from 'react';
import { markdown } from '@/constants';
import { Markdown } from '@/components';

const PrivacyPolicy = () => {
  return <Markdown content={markdown.privacy} />;
};

export default PrivacyPolicy;
