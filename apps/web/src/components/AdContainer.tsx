import React, { useEffect } from 'react';
import { twMerge } from 'tailwind-merge';

interface Props {
  slotId: string;
  className?: string;
  test?: boolean;
}

const AdContainer = ({ slotId, className, test }: Props) => {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && typeof window === 'object') {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    }
  }, []);

  return (
    <div className={twMerge(className, test && 'h-24 bg-blue-200')}>
      <ins
        className='adsbygoogle'
        style={{ display: 'block' }}
        data-ad-client='ca-pub-4274133898976040'
        data-ad-slot={slotId}
        data-ad-format='auto'
        data-full-width-responsive='true'
      />
    </div>
  );
};

export default AdContainer;
