import React, { useEffect } from 'react';

const AdContainer = ({ slot }: { slot: string }) => {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    }
  }, []);

  return (
    <div>
      <ins
        className='adsbygoogle block'
        data-ad-client='ca-pub-4274133898976040'
        data-ad-slot={slot}
        data-ad-format='auto'
        data-full-width-responsive='true'
      />
    </div>
  );
};

export default AdContainer;
