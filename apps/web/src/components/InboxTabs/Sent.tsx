import React, { useState } from 'react';
import Image from 'next/image';

import { ChatBubble } from '../ChatBubble';

export const Sent = () => {
  const [msgReplied] = useState<boolean>(true);

  return (
    <section className='flex flex-col items-center'>
      {/* Top */}
      <div className='border-secondary-100 bg-secondary-200 w-full overflow-hidden rounded-2xl border-2 md:w-[500px]'>
        <div className='border-secondary-100 flex items-center justify-between border-b-2 bg-[#171819] px-7 py-2'>
          <p className='font-medium capitalize text-gray-100'>
            <span className='font-light text-gray-400'>To&#58;</span> Johndoe
          </p>
          <div className='relative h-[40px] w-[110px]'>
            <Image src='/assets/logo.svg' layout='fill' objectFit='contain' />
          </div>
        </div>

        {/* Message */}
        <div className='flex min-h-[170px] flex-col justify-between gap-4 pr-7 pl-6 pt-10 pb-3 text-lg sm:pt-8 md:gap-3'>
          <ChatBubble
            state='receive'
            senderInfo
            content='Send me an anonymous message!'
          />
          <ChatBubble
            state='send'
            content=' The quick brown fox jumps over the lazy dog near the bank of the
            river. LMAO'
          />

          {msgReplied && (
            <ChatBubble
              state='receive'
              senderInfo
              content='Excellent! See you Saturday at 1pm in front of the cafe. 😉'
            />
          )}
        </div>

        {!msgReplied && (
          <p className='text-secondary-400 mx-auto py-5 px-4 text-center md:px-5'>
            No reply from Johndoe
          </p>
        )}
      </div>
    </section>
  );
};
