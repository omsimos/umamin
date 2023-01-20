import React, { useState, useEffect } from 'react';
import { dehydrate, useMutation } from 'react-query';
import { RiSendPlaneFill } from 'react-icons/ri';
import { HiOutlinePuzzle } from 'react-icons/hi';
import { useSession } from 'next-auth/react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { NextSeo } from 'next-seo';
import dynamic from 'next/dynamic';
import Image from 'next/image';

import { Error, Layout } from '@/components';
import { useLogEvent, useUser } from '@/hooks';
import type { NextPageWithLayout } from '@/index';
import { ConfirmDialog } from '@/components/Dialog';
import { ChatBubble } from '@/components/ChatBubble';
import { getUser, queryClient, sendMessage } from '@/api';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const SendTo: NextPageWithLayout = ({ username }: { username: string }) => {
  const { push } = useRouter();
  const triggerEvent = useLogEvent();
  const { data: user, isLoading: isUserLoading } = useUser(
    'to_user',
    username,
    'username'
  );
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';

  const [clue, setClue] = useState('');
  const [message, setMessage] = useState('');
  const [msgSent, setMsgSent] = useState<boolean>(false);
  const [clueDialog, setClueDialog] = useState<boolean>(false);
  const [warningDialog, setWarningDialog] = useState<boolean>(false);

  const { mutate, data, isLoading, reset } = useMutation(sendMessage);

  useEffect(() => {
    if (status === 'unauthenticated') {
      setWarningDialog(true);
    }
  }, [status]);

  const handleSend: React.FormEventHandler = (e) => {
    e.preventDefault();
    if (user?.id === session?.user?.id) {
      setMessage('');
      toast.error("You can't send a message to yourself");
    } else if (user) {
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

  if (isUserLoading) {
    return (
      <div className='mt-52 flex justify-center'>
        <span className='loader-2' />
      </div>
    );
  }

  if (!user) {
    return <Error message='Are you lost?' />;
  }

  return (
    <>
      <NextSeo
        title='umamin - Send Anonymous Messages'
        openGraph={{
          title: user
            ? `👀 Send anonymous messages to ${user.username}!`
            : '404 - user not found',
          description:
            'Create your own link to start receiving anonymous confessions and messages!',
        }}
      />

      <ConfirmDialog
        isOpen={warningDialog}
        setIsOpen={setWarningDialog}
        confirmText='Sign in'
        cancelText='Continue'
        handleConfirm={() => push('/login')}
        content={
          <p>
            ⚠️ You are currently not logged in. Your message will not be saved
            in your inbox.
          </p>
        }
      />

      <ConfirmDialog
        confirmText='Save'
        handleConfirm={() => setClueDialog(false)}
        isOpen={clueDialog}
        setIsOpen={setClueDialog}
        content={
          <div>
            <h2 className='font-semibold'>
              🧩 Write a clue about your identity
            </h2>
            <div className='line my-3' />

            <textarea
              required
              value={clue}
              onChange={(e) => setClue(e.target.value)}
              minLength={3}
              maxLength={100}
              placeholder='Enter here...'
              className='bg-secondary-100 w-full h-[120px] outline-none p-3 rounded resize-none'
            />
          </div>
        }
      />

      <section className='flex flex-col items-center space-y-12'>
        <div className='border-secondary-100 bg-secondary-200 w-full overflow-hidden rounded-3xl border-2 md:w-[720px]'>
          {/* Top */}
          <div className='bg-secondary-300 border-secondary-100 flex items-center justify-between border-b-2 px-7 py-2'>
            <p className='font-medium text-white'>
              <span className='font-light text-gray-400'>To&#58;</span>{' '}
              {username}
            </p>
            <div className='relative h-[40px] w-[110px] md:h-[50px] md:w-[130px]'>
              <Image
                alt='logo'
                src='/assets/logo.svg'
                fill
                className='object-contain'
              />
            </div>
          </div>

          {/* Message */}
          <div className='flex min-h-[170px] flex-col justify-between space-y-5 px-5 pt-10 sm:space-y-0 sm:px-7 md:mb-4'>
            <ChatBubble
              type='receiver'
              content={user?.message ?? ''}
              userData={{ username, image: user?.image }}
            />

            {data?.sendMessage && (
              <ChatBubble type='sender' content={data.sendMessage} />
            )}
          </div>

          {/* Send Message */}
          <form
            onSubmit={handleSend}
            className='bg-secondary-200 items-center py-5 px-4 h-[85px] md:px-7'
          >
            {!msgSent ? (
              <div className='flex rounded-full items-center bg-secondary-100 p-2 pr-4'>
                <button
                  type='button'
                  onClick={() => setClueDialog(true)}
                  className='bg-primary-300 rounded-full p-2 mr-4 flex-none'
                >
                  <HiOutlinePuzzle className='text-lg' />
                </button>

                <input
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  minLength={3}
                  maxLength={200}
                  type='text'
                  placeholder='Send an anonymous message...'
                  className='bg-secondary-100 w-full outline-none'
                />

                {isLoading ? (
                  <span className='loader flex-none' />
                ) : (
                  <button
                    type='submit'
                    className='text-primary-100 cursor-pointer flex-none text-2xl'
                  >
                    <RiSendPlaneFill />
                  </button>
                )}
              </div>
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
                  {!isAuthenticated ? (
                    <button
                      type='button'
                      className='hover:text-primary-100 transition-colors'
                      onClick={() => push('/login')}
                    >
                      Create your link
                    </button>
                  ) : (
                    <button
                      type='button'
                      className='hover:text-primary-100 transition-colors'
                      onClick={() => push('/inbox')}
                    >
                      Visit inbox
                    </button>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>
      </section>

      <AdContainer slotId='4180346918' className='mt-12' />
    </>
  );
};

SendTo.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;

export const getServerSideProps: GetServerSideProps = async ({
  res,
  params,
}) => {
  const username = params?.username as string;

  await queryClient.prefetchQuery(
    ['to_user', { user: params?.username, type: 'username' }],
    () => getUser({ user: username, type: 'username' })
  );

  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=30');

  return {
    props: {
      username,
      dehydratedState: dehydrate(queryClient),
    },
  };
};

export default SendTo;
