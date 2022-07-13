import React, { useState } from 'react';
import { dehydrate, useMutation, useQuery } from 'react-query';
import { RiSendPlaneFill } from 'react-icons/ri';
import Image from 'next/image';

import { getUser, queryClient, sendMessage } from '@/api';

const SendTo = ({ username }: { username: string }) => {
  const [message, setMessage] = useState('');

  const { data: user } = useQuery('user', () => getUser({ username }), {
    select: (data) => data.user,
  });

  const { mutate, data } = useMutation(sendMessage);

  const handleSend: React.FormEventHandler = (e) => {
    e.preventDefault();
    mutate(
      { username, content: message },
      {
        onSuccess: () => {
          setMessage('');
        },
      }
    );
  };

  return (
    <section className='absolute top-0 left-0 flex h-screen w-screen items-center justify-center px-5'>
      {!user ? (
        <h1 className='h1-text'>Are you lost?</h1>
      ) : (
        <>
          {/* Top */}
          <div className='card w-full overflow-hidden bg-secondary-100 md:w-[720px]'>
            <div className='flex items-center justify-between border-b-2 border-primary-100 bg-secondary-200 px-7 py-2'>
              <p className='font-medium text-white'>
                <span className='font-light text-gray-400'>To&#58;</span>{' '}
                {username}
              </p>
              <div className='relative h-[40px] w-[110px] md:h-[50px] md:w-[130px]'>
                <Image
                  src='/assets/logo.svg'
                  layout='fill'
                  objectFit='contain'
                />
              </div>
            </div>

            {/* Message */}
            <div className='flex flex-col space-y-5 px-5 py-10 sm:space-y-0 sm:px-10 sm:py-7'>
              <div className='chat-p receive inline-block self-start font-medium'>
                Send me an anonymous message!
              </div>
              {data?.sendMessage.content && (
                <div className='chat-p send inline-block self-end'>
                  {data.sendMessage.content}
                </div>
              )}
            </div>

            {/* Send Message */}
            <form
              onSubmit={handleSend}
              className='relative flex items-center justify-between bg-secondary-200 py-5 px-4 md:px-7'
            >
              <input
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                minLength={1}
                maxLength={200}
                type='text'
                placeholder='Send an anonymous message..'
                className='w-full rounded-full border-2 border-primary-100 bg-secondary-100 py-2 pl-5 pr-12 outline-none'
              />
              <button
                type='submit'
                className='absolute right-10 cursor-pointer text-xl text-primary-100 md:right-12'
              >
                <RiSendPlaneFill />
              </button>
            </form>
          </div>
        </>
      )}
    </section>
  );
};

export async function getServerSideProps({
  params,
}: {
  params: { username: string };
}) {
  await queryClient.prefetchQuery('user', () =>
    getUser({ username: params.username })
  );

  return {
    props: {
      username: params.username,
      dehydratedState: dehydrate(queryClient),
    },
  };
}

export default SendTo;
