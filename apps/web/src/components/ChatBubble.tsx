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
    <div className='flex items-end space-x-2'>
      {userData.image && (
        <ImageFill
          src={userData.image as string}
          alt='user image'
          className='bottom-3 z-10 h-[35px] w-[35px] rounded-full'
        />
      )}

      <div className='relative self-start'>
        <span className='text-secondary-400 absolute left-4 -top-5 block text-xs'>
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
