import React from 'react';
import { User } from '@umamin/generated';
import { ImageFill } from '@/components/Utils';

interface ChatBubbleProps {
  type: 'sender' | 'receiver';
  content?: string;
  userData?: Pick<User, 'username' | 'image'>;
}

export const ChatBubble = ({ type, content, userData }: ChatBubbleProps) => {
  return !userData ? (
    <p
      className={`${
        type === 'sender'
          ? 'chat-send chat-p send'
          : 'chat-receive chat-p receive'
      } chat-content`}
    >
      {content}
    </p>
  ) : (
    <div className='flex items-end space-x-2'>
      {userData.image && (
        <ImageFill
          unoptimized
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
          } chat-content`}
        >
          {content}
        </p>
      </div>
    </div>
  );
};
