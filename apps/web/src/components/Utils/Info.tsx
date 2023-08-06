import React from 'react';
import { BsInfoCircleFill } from 'react-icons/bs';

interface Props {
  className?: string;
  message: string;
}

export const Info = ({ className, message }: Props) => {
  return (
    <div className={`mt-1 flex items-center space-x-1 text-sm ${className}`}>
      <BsInfoCircleFill className='text-primary-100' />
      <p className='text-[#f0f0f0] '>{message}</p>
    </div>
  );
};
