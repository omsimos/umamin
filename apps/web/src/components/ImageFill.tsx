import React from 'react';
import Image, { ImageProps } from 'next/image';

interface ImageFillProps extends Omit<ImageProps, 'className' | 'layout'> {
  className?: string;
  contain?: boolean;
}

export const ImageFill = ({ className, contain, ...rest }: ImageFillProps) => {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image layout='fill' {...rest} />
    </div>
  );
};
