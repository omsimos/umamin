import React, { useState, useEffect } from 'react';
import { dehydrate, QueryClient, useMutation } from '@tanstack/react-query';
import { RiSendPlaneFill } from 'react-icons/ri';
import { HiOutlinePuzzle } from 'react-icons/hi';
import { useSession } from 'next-auth/react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

import { Layout } from '@/components';
import { getUser, sendMessage } from '@/api';
import { useLogEvent, useUser } from '@/hooks';
import type { NextPageWithLayout } from '@/index';
import { ChatBubble } from '@/components/ChatBubble';
import { Container, Error } from '@/components/Utils';
import { AddClueDialog, ConfirmDialog } from '@/components/Dialog';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const SendTo: NextPageWithLayout = () => {
  const username = 'tigris';
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
  const [msgSent, setMsgSent] = useState(false);
  const [clueDialog, setClueDialog] = useState(false);
  const [warningDialog, setWarningDialog] = useState(false);

  const { mutate, data, isPending, reset } = useMutation({ mutationFn: sendMessage });

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
            receiverMsg: user?.message,
            clue,
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

      <AddClueDialog
        isOpen={clueDialog}
        setIsOpen={setClueDialog}
        clue={clue}
        setClue={setClue}
      />

      <Container className='flex flex-col items-center space-y-12'>
        <div className='dark:border-secondary-100 dark:bg-secondary-200 w-full overflow-hidden rounded-3xl border-2 border-gray-400 bg-gray-200 md:w-[720px]'>
          {/* Top */}
          <div className='dark:bg-secondary-300 dark:border-secondary-100 flex items-center justify-between border-b-2 border-gray-400 bg-gray-300 px-7 py-4'>
            <p className='text-secondary-300 font-medium dark:text-white'>
              <span className='text-secondary-100 font-light dark:text-gray-400'>
                To&#58;
              </span>{' '}
              {username}
            </p>

            <div className='flex items-center justify-center'>
              <h3 className='font-galyonBold text-tigris text-xl'>👻 tigris</h3>
              <p className='text-secondary-400 text-xl font-light'>✗</p>
              <h3 className='text-primary-200 font-syneExtrabold'>umamin 🕸️</h3>
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
            className='dark:bg-secondary-200 h-[85px] items-center bg-gray-300 py-5 px-4 md:px-7'
          >
            {!msgSent ? (
              <div className='dark:bg-secondary-100 flex items-center rounded-full bg-gray-200 p-2 pr-4'>
                <button
                  type='button'
                  onClick={() => setClueDialog(true)}
                  className={`${
                    clue ? 'bg-green-500' : 'bg-tigris'
                  }  mr-4 flex-none rounded-full p-2`}
                >
                  <HiOutlinePuzzle className='text-lg text-white' />
                </button>

                <input
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  minLength={3}
                  maxLength={200}
                  type='text'
                  placeholder='Send an anonymous message...'
                  className='dark:bg-secondary-100 w-full bg-gray-200 outline-none'
                />

                {isPending ? (
                  <span className='loader flex-none' />
                ) : (
                  <button
                    type='submit'
                    className='text-tigris flex-none cursor-pointer text-2xl'
                  >
                    <RiSendPlaneFill />
                  </button>
                )}
              </div>
            ) : (
              <div className='w-full'>
                <p className='dark:text-secondary-400 text-center font-medium text-gray-500'>
                  Anonymous message sent!
                </p>
                <div className='text-tigris flex justify-center space-x-2 font-normal'>
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
      </Container>

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
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ['to_user', { user: params?.username, type: 'username' }],
    queryFn: () => getUser({ user: username, type: 'username' }),
  });

  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=30');

  return {
    props: {
      username,
      dehydratedState: dehydrate(queryClient),
    },
  };
};

export default SendTo;
