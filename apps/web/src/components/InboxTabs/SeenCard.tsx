import React, { useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { SeenMessage } from '@umamin/generated';

interface Props {
  message: SeenMessage;
}

export const SeenCard = ({ message }: Props) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { content, receiverMsg, createdAt } = message;

  return (
    <div
      ref={cardRef}
      className='relative border-secondary-100 bg-secondary-200 w-full overflow-hidden rounded-2xl border-2 mb-6 flex flex-col justify-between gap-6 p-5'
    >
      {/* Message */}
      <p className='text-center text-lg font-bold'>{receiverMsg}</p>
      <div>
        <p className='chat-send font-bold text-lg chat-p px-8 py-5 receive w-full'>
          {content}
        </p>
        <p className='text-secondary-400 text-sm font-medium italic text-right'>
          {formatDistanceToNow(new Date(createdAt), {
            addSuffix: true,
          })}
        </p>
      </div>
    </div>
  );
};
