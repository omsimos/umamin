import React from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from 'react-query';
import Image from 'next/image';

import { ChatBubble } from '../ChatBubble';
import { useUser } from '@/hooks';
import { getRepliedMessages } from '@/api';

export const Sent = () => {
  const { data } = useSession();
  const { email } = data?.user ?? {};

  const { data: userData } = useUser(email ?? '', 'email');

  const { data: messages } = useQuery(
    ['messages', { userId: userData?.id ?? '', cursorId: '', type: 'seen' }],
    () => getRepliedMessages({ userId: userData?.id ?? '', cursorId: '' }),
    { select: (data) => data.getRepliedMessages, enabled: !!userData?.id }
  );

  return (
    <section className='mb-8 flex flex-col space-y-12'>
      {!messages?.length && <p className='font-medium'>No messages to show</p>}

      {messages?.map((m) => (
        <div className='border-secondary-100 bg-secondary-200 w-full overflow-hidden rounded-2xl border-2'>
          <div className='border-secondary-100 flex items-center justify-between border-b-2 bg-[#171819] px-7 py-2'>
            <p className='font-medium capitalize text-gray-100'>
              <span className='font-light text-gray-400'>To&#58;</span> {m.id}
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
                username: userData?.username,
                image: userData?.image,
              }}
            />
            <ChatBubble type='sender' content={m.content} />

            {m.reply && (
              <ChatBubble
                type='receiver'
                content={m.reply}
                userData={{
                  username: userData?.username,
                  image: userData?.image,
                }}
              />
            )}
          </div>

          {!m.reply && (
            <p className='text-secondary-400 mx-auto py-5 px-4 text-center md:px-5'>
              No reply from Johndoe
            </p>
          )}
        </div>
      ))}
    </section>
  );
};
