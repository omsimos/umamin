import React, { useState } from 'react';
import { dehydrate, useMutation } from 'react-query';
import { RiSendPlaneFill } from 'react-icons/ri';
import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import dynamic from 'next/dynamic';
import Image from 'next/image';

import { useLogEvent, useUser } from '@/hooks';
import { getUser, queryClient, sendMessage } from '@/api';
import { ChatBubble } from '@/components/ChatBubble';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const SendTo = ({ username }: { username: string }) => {
  const router = useRouter();
  const { data: user } = useUser(username, 'username');
  const triggerEvent = useLogEvent();

  const [message, setMessage] = useState('');
  const [msgSent, setMsgSent] = useState<boolean>(false);

  const { mutate, data, isLoading, reset } = useMutation(sendMessage);

  const handleSend: React.FormEventHandler = (e) => {
    e.preventDefault();
    if (user) {
      mutate(
        {
          input: {
            receiverUsername: username,
            content: message,
            receiverMsg: user.message,
          },
        },
        {
          onSuccess: () => {
            setMessage('');
            setMsgSent(true);
          },
        }
      );

      triggerEvent('send_message');
    }
  };

  return (
    <>
      <NextSeo
        title='umamin - Send Anonymous Messages'
        openGraph={{
          title: user
            ? `👀 Send anonymous messages to ${user.username}!`
            : '404 - User not found',
          description:
            'Create your own link to start receiving anonymous confessions and messages!',
        }}
      />
      <section className='mb-8 flex flex-col items-center space-y-12'>
        {!user ? (
          <h1 className='h1-text'>Are you lost?</h1>
        ) : (
          <div className='border-secondary-100 bg-secondary-200 w-full overflow-hidden rounded-3xl border-2 md:w-[720px]'>
            {/* Top */}
            <div className='bg-secondary-300 border-secondary-100 flex items-center justify-between border-b-2 px-7 py-2'>
              <p className='font-medium capitalize text-white'>
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
            <div className='flex min-h-[170px] flex-col justify-between space-y-5 px-5 pt-10 sm:space-y-0 sm:px-7 md:mb-4'>
              <ChatBubble state='receive' content={user.message} senderInfo />

              {data?.sendMessage && (
                <ChatBubble state='send' content={data.sendMessage} />
              )}
            </div>

            {/* Send Message */}
            <form
              onSubmit={handleSend}
              className='bg-secondary-200 relative flex h-[100px] items-center justify-between py-5 px-4 md:h-[85px] md:px-7'
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
                    placeholder='Send an anonymous message..'
                    className='bg-secondary-100 w-full rounded-full py-3 px-5 pr-12 outline-none transition-all'
                  />

                  {isLoading ? (
                    <span className='loader absolute right-10' />
                  ) : (
                    <button
                      type='submit'
                      className='text-primary-100 absolute right-9 cursor-pointer text-2xl transition-all md:right-12'
                    >
                      <RiSendPlaneFill />
                    </button>
                  )}
                </>
              ) : (
                <div className='w-full'>
                  <p className='text-secondary-400 text-center font-medium'>
                    Anonymous message sent!
                  </p>
                  <div className='text-primary-100/80 flex justify-center space-x-2 font-normal'>
                    <button
                      type='button'
                      className='hover:text-primary-100 transition-colors'
                      onClick={() => {
                        setMsgSent(false);
                        reset();
                        triggerEvent('send_again');
                      }}
                    >
                      Send again
                    </button>
                    <span className='text-secondary-400'>•</span>
                    <button
                      type='button'
                      className='hover:text-primary-100 transition-colors'
                      onClick={() => router.push('/register')}
                    >
                      Create your link
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}
      </section>
      <AdContainer slot='9345002123' />
    </>
  );
};

export async function getServerSideProps({
  params,
}: {
  params: { username: string };
}) {
  await queryClient.prefetchQuery(
    ['user', { user: params.username, type: 'username' }],
    () => getUser({ user: params.username, type: 'username' })
  );

  return {
    props: {
      username: params.username,
      dehydratedState: dehydrate(queryClient),
    },
  };
}

export default SendTo;
