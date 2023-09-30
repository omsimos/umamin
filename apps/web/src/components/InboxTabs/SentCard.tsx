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

      <div className='dark:border-secondary-100 dark:bg-secondary-200 relative w-full overflow-hidden rounded-2xl border-2 border-gray-400 bg-gray-200'>
        <div className='dark:border-secondary-100 flex items-center justify-between border-b-2 border-gray-400 bg-gray-300 px-7 py-3 dark:bg-[#171819]'>
          <p className='text-secondary-300 font-medium dark:text-gray-100'>
            <span className='font-light text-gray-500 dark:text-gray-400'>
              To&#58;
            </span>{' '}
            {receiverUsername}
          </p>
            <div className='flex items-center justify-center'>
              <h3 className='font-galyonBold text-tigris text-xl'>tigris</h3>
              <p className='text-secondary-400 text-xl font-light'>✗</p>
              <h3 className='text-primary-200 font-syneExtrabold'>umamin</h3>
            </div>
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
        <div className='absolute right-3 bottom-3 space-x-4 text-lg'>
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
