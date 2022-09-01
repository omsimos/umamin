import React from 'react';

interface ChatBubbleProps {
  state: 'send' | 'receive';
  content: string;
  senderInfo?: boolean;
}

export const ChatBubble = ({ state, content, senderInfo }: ChatBubbleProps) => {
  return !senderInfo ? (
    <p
      className={`${
        state === 'send'
          ? 'chat-send chat-p send'
          : 'chat-receive chat-p receive'
      } inline-block max-w-[255px] px-5 py-4 text-white`}
    >
      {content}
    </p>
  ) : (
    <div className='flex space-x-2'>
      {/*
                <Image
                width={35}
                height={35}
                layout="fixed"
                src={message.author.photoURL as string}
                alt="user image"
                className="z-10 rounded-full"
                /> 

            */}
      <span className='relative bottom-2 z-10 inline-block h-[35px] w-[35px] self-end rounded-full bg-gray-500' />
      <div className='relative self-start'>
        <span className='text-secondary-400 absolute left-4 -top-4 block text-xs'>
          Eliza
        </span>
        <p
          className={`${
            state === 'send'
              ? 'chat-send chat-p send'
              : 'chat-receive chat-p receive'
          } inline-block max-w-[255px] px-5 py-4 text-white`}
        >
          {state === 'receive' ? content : 'WARN: Change state prop to send.'}
        </p>
      </div>
    </div>
  );
};
