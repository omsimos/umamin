import React, { useEffect } from 'react';

interface Props {
  slotId: string
  className?: string
}

const AdContainer = ({ slotId, className }: Props) => {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      if (typeof window !== 'undefined') {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    }
  }, []);

  return (
    <div className={className}>
      <ins
        className='block adsbygoogle'
        data-ad-client='ca-pub-4274133898976040'
        data-ad-slot={slotId}
        data-ad-format='auto'
        data-full-width-responsive='true'
      />
    </div>
  );
};

export default AdContainer;
