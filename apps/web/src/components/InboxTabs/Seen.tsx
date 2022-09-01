import React, { useState } from 'react';
import { RiSendPlaneFill } from 'react-icons/ri';
import Image from 'next/image';

export const Seen = () => {
  const [message, setMessage] = useState('');
  const [msgSent, setMsgSent] = useState<boolean>(false);

  const handleSend: React.FormEventHandler = (e) => {
    e.preventDefault();

    setMessage('');
    setMsgSent(true);
  };

  return (
    <section className='mb-8 flex flex-col items-center space-y-12'>
      {/* Top */}
      <div className='border-secondary-100 bg-secondary-200 w-full overflow-hidden rounded-2xl border-2 md:w-[500px]'>
        <div className='border-secondary-100 flex items-center justify-between border-b-2 bg-[#171819] py-1'>
          <div className='relative mx-auto h-[40px] w-[120px]'>
            <Image src='/assets/logo.svg' layout='fill' objectFit='contain' />
          </div>
        </div>

        {/* Message */}
        <div className='flex min-h-[170px] flex-col justify-between space-y-5 px-7 pt-10 pb-3 text-lg sm:pt-7 md:space-y-3 [&>*]:px-[20px] [&>*]:py-[15px]'>
          <div className='chat-p send bg-primary-200 before:bg-primary-200 after:bg-secondary-200 inline-block max-w-[255px]  self-end text-white'>
            Send me an anonymous message!
          </div>
          <div
            className='chat-p receive
            after:bg-secondary-200 bg-secondary-100 before:bg-secondary-100 inline-block max-w-[255px] self-start text-white
          '
          >
            The quick brown fox jumps over the lazy dog near the bank of the
            river. LMAO
          </div>
        </div>

        {/* Send Message */}
        <form
          onSubmit={handleSend}
          className=' relative flex  items-center justify-between py-5 px-4 md:px-5'
        >
          {!msgSent ? (
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
    </section>
  );
};
