import React, { useEffect } from 'react';

interface Props {
  slotId: string;
  className?: string;
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
        className='adsbygoogle block'
        data-ad-client='ca-pub-4274133898976040'
        data-ad-layout-key="-il+e-1e-2w+ap"
        data-ad-slot={slotId}
        data-ad-format='fluid'
      />
    </div>
  );
};

export default AdContainer;
