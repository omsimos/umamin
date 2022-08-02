import React, { useState } from 'react';
import { dehydrate, useMutation } from 'react-query';
import { RiSendPlaneFill } from 'react-icons/ri';
import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import dynamic from 'next/dynamic';
import Image from 'next/image';

import { useLogEvent, useUser } from '@/hooks';
import { getUser, queryClient, sendMessage } from '@/api';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const SendTo = ({ username }: { username: string }) => {
  const router = useRouter();
  const { data: user } = useUser(username);
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
      <section className='flex flex-col min-h-screen items-center space-y-12'>
        {!user ? (
          <h1 className='h1-text'>Are you lost?</h1>
        ) : (
          <>
            {/* Top */}
            <div className='border-secondary-100 bg-secondary-100 w-full overflow-hidden rounded-md border-2 md:w-[720px]'>
              <div className='border-primary-100 bg-secondary-200 flex items-center justify-between border-b-2 px-7 py-2'>
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
              <div className='flex min-h-[170px] flex-col justify-between space-y-5 px-5 py-10 sm:space-y-0 sm:px-10 sm:py-7 [&>*]:px-[20px] [&>*]:py-[10px]'>
                <div className='chat-p receive  after:bg-secondary-100 inline-block max-w-[255px] self-start bg-[#e5e5ea]  font-medium text-black before:bg-[#e5e5ea]'>
                  {user.message}
                </div>
                {data?.sendMessage && (
                  <div className='chat-p send bg-primary-200 before:bg-primary-200 after:bg-secondary-100 inline-block max-w-[255px]  self-end text-white'>
                    {data.sendMessage}
                  </div>
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
                      className='border-primary-100 bg-secondary-100 w-full rounded-full border-2 py-3 px-5 pr-12 outline-none transition-all md:py-2'
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
                    <p className='text-center font-medium text-[#DAB5D3]'>
                      Anonymous message sent!
                    </p>
                    <div className='text-primary-100 flex justify-center space-x-2 font-normal'>
                      <button
                        type='button'
                        className='hover:text-primary-100/80 transition-colors'
                        onClick={() => {
                          setMsgSent(false);
                          reset();
                          triggerEvent('send_again');
                        }}
                      >
                        Send again
                      </button>
                      <span className='text-[#DAB5D3]'>•</span>
                      <button
                        type='button'
                        className='hover:text-primary-100/80 transition-colors'
                        onClick={() => router.push('/register')}
                      >
                        Create your link
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </>
        )}
        <AdContainer slot='7063833038' />
      </section>
    </>
  );
};

export async function getServerSideProps({
  params,
}: {
  params: { username: string };
}) {
  await queryClient.prefetchQuery(['user', { username: params.username }], () =>
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
