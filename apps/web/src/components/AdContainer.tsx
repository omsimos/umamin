import React, { useEffect } from 'react';
import { twMerge } from 'tailwind-merge';

interface Props {
  slotId: string;
  className?: string;
  test?: boolean;
  type?: 'display' | 'in-feed';
}

const AdContainer = ({ slotId, className, test, type = 'display' }: Props) => {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      if (typeof window !== 'undefined') {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    }
  }, []);

  return (
    <div className={twMerge(className, test && 'h-24 bg-blue-200')}>
      {type === 'in-feed' ? (
        <ins
          className='adsbygoogle block'
          data-ad-client='ca-pub-4274133898976040'
          data-ad-slot={slotId}
          data-ad-format='fluid'
          data-ad-layout-key='-il+e-1e-2w+ap'
        />
      ) : (
        <ins
          className='adsbygoogle block'
          data-ad-client='ca-pub-4274133898976040'
          data-ad-slot={slotId}
          data-ad-format='auto'
          data-full-width-responsive='true'
        />
      )}
    </div>
  );
};

export default AdContainer;
