import React from 'react';
import Image from 'next/image';
import { RiSendPlaneFill } from 'react-icons/ri';

const SendTo = () => {
  return (
    <section className='absolute top-0 left-0 flex h-screen w-screen items-center justify-center px-5'>
      {/* Top */}
      <div className='card w-full overflow-hidden bg-secondary-100 md:w-[720px]'>
        <div className='flex items-center justify-between border-b-2 border-primary-100 bg-secondary-200 px-7 py-2'>
          <p className='font-medium text-white'>
            <span className='font-light text-gray-400'>To&#58;</span> Doe
          </p>
          <div className='relative h-[40px] w-[110px] md:h-[50px] md:w-[130px]'>
            <Image src='/assets/logo.svg' layout='fill' objectFit='contain' />
          </div>
        </div>

        {/* Message */}
        <div className='flex flex-col space-y-5 px-5 py-10 sm:space-y-0 sm:px-10 sm:py-7'>
          <div className='chat-p receive inline-block self-start font-medium'>
            Send me an anonymous message!
          </div>
          <div className='chat-p send inline-block self-end'>
            The quick brown fox jumps over the lazy dog near the bank of the
            river. LMAO
          </div>
        </div>

        {/* Send Message */}
        <div className='relative flex items-center justify-between bg-secondary-200 py-5 px-4 md:px-7'>
          <input
            type='text'
            placeholder='Send an anonymous message..'
            className='w-full rounded-full border-2 border-primary-100 bg-secondary-100 px-5 py-2 outline-none'
          />
          <RiSendPlaneFill className='absolute right-10 cursor-pointer text-xl text-primary-100 md:right-12' />
        </div>
      </div>
    </section>
  );
};

export default SendTo;
