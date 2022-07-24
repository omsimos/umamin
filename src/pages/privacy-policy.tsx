import React from 'react';
import { legal } from '@/constants';
import { Markdown } from '@/components';

const PrivacyPolicy = () => {
  return <Markdown content={legal.privacy} />;
};

export default PrivacyPolicy;
