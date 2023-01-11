import React, { useState, useEffect } from 'react';
import { RiSendPlaneFill } from 'react-icons/ri';
import { useSession } from 'next-auth/react';
import { useMutation } from 'react-query';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { NextSeo } from 'next-seo';
import dynamic from 'next/dynamic';
import Image from 'next/image';

import { prisma } from '@/utils/db';
import { sendMessage } from '@/api';
import { useLogEvent } from '@/hooks';
import { GetStaticProps } from 'next/types';
import { Error, Layout } from '@/components';
import type { User } from '@umamin/generated';
import type { NextPageWithLayout } from '@/index';
import { ChatBubble } from '@/components/ChatBubble';
import { ConfirmDialog } from '@/components/Dialog';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const SendTo: NextPageWithLayout = ({
  username,
  userData,
}: {
  username: string;
  userData: User;
}) => {
  const { push } = useRouter();
  const triggerEvent = useLogEvent();
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';

  const [message, setMessage] = useState('');
  const [msgSent, setMsgSent] = useState<boolean>(false);
  const [warningDialog, setWarningDialog] = useState<boolean>(false);

  const { mutate, data, isLoading, reset } = useMutation(sendMessage);

  const revalidate = async () => {
    await fetch(
      `/api/revalidate?${new URLSearchParams({
        username,
      })}`
    );
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      setWarningDialog(true);
    }
  }, [status]);

  const handleSend: React.FormEventHandler = (e) => {
    e.preventDefault();
    if (userData?.id === session?.user?.id) {
      setMessage('');
      toast.error("You can't send a message to yourself");
    } else if (userData) {
      mutate(
        {
          input: {
            receiverUsername: username,
            content: message,
            receiverMsg: userData.message,
          },
        },
        {
          onSuccess: () => {
            setMessage('');
            setMsgSent(true);
          },
          onError() {
            toast.error('User may no longer exist');
            revalidate();
          },
        }
      );

      triggerEvent('send_message');
    }
  };

  if (!userData) {
    return <Error message='Are you lost?' />;
  }

  return (
    <>
      <NextSeo
        title='umamin - Send Anonymous Messages'
        openGraph={{
          title: userData
            ? `👀 Send anonymous messages to ${userData.username}!`
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
              content={userData?.message ?? ''}
              userData={{ username, image: userData?.image }}
            />

            {data?.sendMessage && (
              <ChatBubble type='sender' content={data.sendMessage} />
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
                  placeholder='Send an anonymous message...'
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

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const username = params?.username as string;

  const userData = await prisma.user.findUnique({
    where: { username },
  });

  if (!userData) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      username,
      userData: JSON.parse(JSON.stringify(userData)),
    },
  };
};

export const getStaticPaths = async () => {
  return {
    paths: [],
    fallback: 'blocking',
  };
};

export default SendTo;
