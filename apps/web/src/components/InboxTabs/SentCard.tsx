import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { SentMessage } from '@umamin/generated';

import { ClueDialog } from '../Dialog';
import { ChatBubble } from '../ChatBubble';

export const SentCard = ({ data }: { data: SentMessage }) => {
  const { createdAt, receiverUsername, receiverMsg, content, reply, clue } =
    data;

  const [clueDialog, setClueDialog] = useState(false);

  return (
    <>
      {clue && (
        <ClueDialog isOpen={clueDialog} setIsOpen={setClueDialog} clue={clue} />
      )}

      <div
        className='border-secondary-100 bg-secondary-200 w-full overflow-hidden rounded-2xl border-2 relative'
      >
        <div className='border-secondary-100 flex items-center justify-between border-b-2 bg-[#171819] px-7 py-3'>
          <p className='font-medium text-gray-100'>
            <span className='font-light text-gray-400'>To&#58;</span>{' '}
            {receiverUsername}
          </p>
          <h3 className='font-syneExtrabold text-gradient text-center text-base'>
            umamin
          </h3>
        </div>

        {/* Message */}
        <div className='flex min-h-[170px] flex-col justify-between gap-4 pr-5 pl-4 pt-10 pb-3 sm:pl-6 sm:pr-7 sm:pt-8 md:gap-3'>
          <ChatBubble
            type='receiver'
            content={receiverMsg}
            userData={{
              username: receiverUsername,
            }}
          />
          <ChatBubble type='sender' content={content} />

          {reply && (
            <ChatBubble
              type='receiver'
              content={reply}
              userData={{
                username: receiverUsername,
              }}
            />
          )}
        </div>

        <p className='text-secondary-400 pb-4 text-center text-sm font-medium italic'>
          {formatDistanceToNow(new Date(createdAt), {
            addSuffix: true,
          })}
        </p>
        <div className='absolute text-lg right-3 bottom-3 space-x-4'>
          {clue && (
            <button type='button' onClick={() => setClueDialog(true)}>
              🧩
            </button>
          )}
        </div>
      </div>
    </>
  );
};
