import React from 'react';
import { User } from '@umamin/generated';

import { ImageFill } from './ImageFill';

interface ChatBubbleProps {
  type: 'sender' | 'receiver';
  content: string;
  userData?: Pick<User, 'username' | 'image'>;
}

export const ChatBubble = ({ type, content, userData }: ChatBubbleProps) => {
  return !userData ? (
    <p
      className={`${
        type === 'sender'
          ? 'chat-send chat-p send'
          : 'chat-receive chat-p receive'
      } inline-block max-w-[255px] px-5 py-4 text-white`}
    >
      {content}
    </p>
  ) : (
    <div className='flex space-x-2 items-end'>
      <ImageFill
        src={userData.image as string}
        alt='user image'
        className='rounded-full w-[35px] h-[35px] z-10 bottom-3'
      />

      <div className='relative self-start'>
        <span className='text-secondary-400 absolute left-4 -top-4 block text-xs'>
          {userData.username}
        </span>
        <p
          className={`${
            type === 'sender'
              ? 'chat-send chat-p send'
              : 'chat-receive chat-p receive'
          } inline-block max-w-[255px] px-5 py-4 text-white`}
        >
          {content}
        </p>
      </div>
    </div>
  );
};
