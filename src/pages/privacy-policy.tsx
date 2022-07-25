import React from 'react';
import { Markdown } from '@/components';
import { privacyPolicy } from '@/constants';

const PrivacyPolicy = () => {
  return <Markdown content={privacyPolicy} />;
};

export default PrivacyPolicy;
