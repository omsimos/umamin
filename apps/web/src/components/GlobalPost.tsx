import React, { useState } from 'react';
import { MdVerified } from 'react-icons/md';
import { formatDistanceToNow } from 'date-fns';
import { GlobalMessage } from '@umamin/generated';
import { Container, ImageFill } from '@/components/Utils';
import { GlobalMsg } from './Dialog';

export const GlobalPost = ({ message }: { message: GlobalMessage }) => {
  const [globalMsgModal, setGlobalMsgModal] = useState(false);

  return (
    <>
      <GlobalMsg
        message={message}
        isOpen={globalMsgModal}
        setIsOpen={setGlobalMsgModal}
      />

      <button
        type='button'
        className='w-full text-left'
        onClick={() => setGlobalMsgModal(true)}
      >
        <Container className='flex gap-x-4 mb-12'>
          <div className='relative'>
            <ImageFill
              alt='profile picture'
              src={message.isAnonymous ? '' : message.user?.image}
              unoptimized
              className='border-secondary-100 h-[45px] w-[45px] object-cover rounded-full border flex-none'
            />

            {!message.isAnonymous &&
              message.user &&
              message.user.username &&
              process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(',').includes(
                message.user.username
              ) && (
                <MdVerified className='text-sky-400 shadow-sm text-lg absolute right-0 top-7' />
              )}
          </div>

          <div>
            <div className='flex gap-x-2 items-center'>
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
            <p className='font-light mt-1 break-words max-w-[350px]'>
              {message.content}
            </p>
          </div>
        </Container>

        <div className='w-full h-[1px] bg-secondary-100' />
      </button>
    </>
  );
};
