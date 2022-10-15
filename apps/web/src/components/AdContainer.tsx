import React, { useEffect } from 'react';

interface Props {
  slotId: string;
  className?: string;
  fixed?: boolean;
}

const AdContainer = ({ slotId, className, fixed }: Props) => {
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
        className={`adsbygoogle ${
          fixed ? 'inline-block w-[432px] h-[100px]' : 'block'
        } `}
        data-ad-client='ca-pub-4274133898976040'
        data-ad-slot={slotId}
        data-ad-format='auto'
        data-full-width-responsive='true'
      />
    </div>
  );
};

export default AdContainer;
