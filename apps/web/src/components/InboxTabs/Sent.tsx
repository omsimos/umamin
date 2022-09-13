import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from 'react-query';
import Image from 'next/image';

import { useUser } from '@/hooks';
import { getSentMessages } from '@/api';
import { ChatBubble } from '../ChatBubble';
import { InboxTabContainer } from './Container';

export const Sent = () => {
  const [pageNo, setPageNo] = useState(1);
  const [cursorId, setCursorId] = useState('');

  const { data } = useSession();
  const { email } = data?.user ?? {};

  const { data: userData } = useUser(email ?? '', 'email');
  const queryArgs = { userId: userData?.id ?? '', cursorId };

  const { data: messages, isLoading } = useQuery(
    ['messages', queryArgs],
    () => getSentMessages(queryArgs),
    { select: (data) => data.getMessages, enabled: !!userData?.id }
  );

  return (
    <InboxTabContainer
      pageNo={pageNo}
      cursorId={cursorId}
      messages={messages}
      isLoading={isLoading}
      setPageNo={setPageNo}
      setCursorId={setCursorId}
    >
      {!messages?.length && <p className='font-medium'>No messages to show</p>}

      {messages?.map((m) => (
        <div
          key={m.id}
          className='border-secondary-100 bg-secondary-200 w-full overflow-hidden rounded-2xl border-2'
        >
          <div className='border-secondary-100 flex items-center justify-between border-b-2 bg-[#171819] px-7 py-2'>
            <p className='font-medium capitalize text-gray-100'>
              <span className='font-light text-gray-400'>To&#58;</span>{' '}
              {m.username}
            </p>
            <div className='relative h-[40px] w-[110px]'>
              <Image src='/assets/logo.svg' layout='fill' objectFit='contain' />
            </div>
          </div>

          {/* Message */}
          <div className='flex min-h-[170px] flex-col justify-between gap-4 pr-5 pl-4 pt-10 pb-3 sm:pl-6 sm:pr-7 sm:pt-8 md:gap-3'>
            <ChatBubble
              type='receiver'
              content={m.receiverMsg}
              userData={{
                username: m?.username,
              }}
            />
            <ChatBubble type='sender' content={m.content} />

            {m.reply && (
              <ChatBubble
                type='receiver'
                content={m.reply}
                userData={{
                  username: m.username,
                }}
              />
            )}
          </div>
        </div>
      ))}
    </InboxTabContainer>
  );
};
