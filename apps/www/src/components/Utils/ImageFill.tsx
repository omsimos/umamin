import React from 'react';
import Image, { ImageProps } from 'next/image';

interface ImageFillProps
  extends Omit<ImageProps, 'src' | 'className' | 'layout'> {
  src?: string | null;
  className?: string;
}

export const ImageFill = ({ src, className, ...rest }: ImageFillProps) => {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image src={src || '/icons/icon-96.png'} fill {...rest} />
    </div>
  );
};
