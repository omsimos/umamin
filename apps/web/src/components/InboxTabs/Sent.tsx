import React, { useState } from 'react';
import Image from 'next/image';

export const Sent = ({ username = 'johndoe' }: { username: string }) => {
  const [msgReplied] = useState<boolean>(true);

  return (
    <section className='flex flex-col items-center'>
      {/* Top */}
      <div className='border-secondary-100 bg-secondary-200 w-full overflow-hidden rounded-2xl border-2 md:w-[500px]'>
        <div className='border-secondary-100 flex items-center justify-between border-b-2 bg-[#171819] px-7 py-2'>
          <p className='font-medium capitalize text-gray-100'>
            <span className='font-light text-gray-400'>To&#58;</span> {username}
          </p>
          <div className='relative h-[40px] w-[110px]'>
            <Image src='/assets/logo.svg' layout='fill' objectFit='contain' />
          </div>
        </div>

        {/* Message */}
        <div className='flex min-h-[170px] flex-col justify-between gap-4 pr-7 pl-6 pt-10 pb-3 text-lg sm:pt-8 md:gap-3'>
          <ReceivedMsg content='Send me an anonymous message!' />

          <div className='chat-p send bg-primary-200 before:bg-primary-200 after:bg-secondary-200 inline-block max-w-[255px] self-end px-[20px] py-[15px] text-white'>
            The quick brown fox jumps over the lazy dog near the bank of the
            river. LMAO
          </div>

          {msgReplied && (
            <ReceivedMsg content='Excellent! See you Saturday at 1pm in front of the cafe. 😉' />
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

const ReceivedMsg = ({ content }: { content: string }) => (
  <div className='flex space-x-2'>
    {/* <Image
      width={35}
      height={35}
      layout="fixed"
      src={message.author.photoURL as string}
      alt="user image"
      className="z-10 rounded-full"
    /> */}
    <span className='relative bottom-2 z-10 inline-block h-[35px] w-[35px] self-end rounded-full bg-gray-500' />
    <div className='relative self-start'>
      <span className='text-secondary-400 absolute left-4 -top-4 block text-xs'>
        Eliza
      </span>
      <div className='chat-p receive after:bg-secondary-200 bg-secondary-100 before:bg-secondary-100 inline-block max-w-[255px] self-start px-5 py-4 text-white'>
        {content}
      </div>
    </div>
  </div>
);
