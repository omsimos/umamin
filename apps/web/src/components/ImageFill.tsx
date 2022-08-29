import React from 'react';
import Image, { ImageProps } from 'next/image';

interface ImageFillProps
  extends Omit<ImageProps, 'src' | 'className' | 'layout'> {
  src?: string;
  className?: string;
  contain?: boolean;
}

export const ImageFill = ({
  src,
  className,
  contain,
  ...rest
}: ImageFillProps) => {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image src={src || '/icons/icon-128x128.png'} layout='fill' {...rest} />
    </div>
  );
};
