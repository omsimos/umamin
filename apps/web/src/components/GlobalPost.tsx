import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { GlobalMessage } from '@umamin/generated';

import { Container } from './Container';
import { ImageFill } from './ImageFill';

export const GlobalPost = ({ message }: { message: GlobalMessage }) => {
  return (
    <>
      <Container className='flex gap-x-4'>
        <ImageFill
          alt='profile picture'
          src={message.isAnonymous ? '' : message.user?.image}
          unoptimized
          className='border-secondary-100 h-[45px] w-[45px] object-cover rounded-full border flex-none'
        />

        <div>
          <div className='flex gap-x-2'>
            <p className='font-medium'>
              {(message.isAnonymous ? 'anonymous' : message.user?.username) ||
                'anonymous'}
            </p>
            <p className='text-secondary-400 text-center text-sm'>
              {formatDistanceToNow(new Date(message.createdAt), {
                addSuffix: true,
              })}
            </p>
          </div>
          <p className='font-light mt-1'>{message.content}</p>
        </div>
      </Container>

      <div className='w-full h-[1px] bg-secondary-100' />
    </>
  );
};
