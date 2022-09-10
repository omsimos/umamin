/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import Image from 'next/image';
import { useQuery } from 'react-query';
import { useSession } from 'next-auth/react';
import { RiSendPlaneFill } from 'react-icons/ri';

import { getMessages } from '@/api';
import { ChatBubble } from '../ChatBubble';
import { useUser } from '@/hooks';

export const Seen = () => {
  const [message, setMessage] = useState('');

  const handleSend: React.FormEventHandler = (e) => {
    e.preventDefault();

    setMessage('');
  };

  const { data } = useSession();
  const { email } = data?.user ?? {};

  const { data: userData } = useUser(email ?? '', 'email');

  const { data: messages } = useQuery(
    ['messages', { userId: userData?.id ?? '', cursorId: '', type: 'seen' }],
    () => getMessages({ userId: userData?.id ?? '', cursorId: '', type: 'seen' }),
    { select: (data) => data.getMessages, enabled: !!userData?.id }
  );

  return (
    <section className='mb-8 flex flex-col space-y-12'>
      {!messages?.length  && <p className='font-medium'>No messages to show</p>}

      {messages?.map((m) => (
        <div className='border-secondary-100 bg-secondary-200 w-full overflow-hidden rounded-2xl border-2'>
          <div className='border-secondary-100 flex items-center justify-between border-b-2 bg-[#171819] py-1'>
            <div className='relative mx-auto h-[40px] w-[120px]'>
              <Image src='/assets/logo.svg' layout='fill' objectFit='contain' />
            </div>
          </div>

          {/* Message */}
          <div className='flex min-h-[170px] flex-col justify-between gap-4 px-5 pt-10 pb-3 sm:px-7 sm:pt-7 md:gap-3'>
            <ChatBubble state='send' content={m.receiverMsg} />
            <ChatBubble state='receive' content={m.content} />
          </div>

          {/* Send Message */}
          <form
            onSubmit={handleSend}
            className=' relative flex  items-center justify-between py-5 px-4 md:px-5'
          >
            {!m.reply ? (
              <>
                <input
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  minLength={3}
                  maxLength={200}
                  type='text'
                  placeholder='Reply..'
                  className='bg-secondary-100 w-full rounded-full py-3 px-5 pr-12 outline-none transition-all md:py-2'
                />

                <button
                  type='submit'
                  className='text-primary-100 absolute right-9 cursor-pointer text-2xl transition-all md:right-10 lg:text-[1.35rem]'
                >
                  <RiSendPlaneFill />
                </button>
              </>
            ) : (
              <p className='text-secondary-400 mx-auto text-center'>
                You can only reply once
              </p>
            )}
          </form>
        </div>
      ))}
    </section>
  );
};
