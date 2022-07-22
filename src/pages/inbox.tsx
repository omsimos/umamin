import React, { useState } from 'react';
import { useQuery, dehydrate } from 'react-query';
import { getSession } from 'next-auth/react';
import { IoReload } from 'react-icons/io5';
import { IoIosCopy } from 'react-icons/io';
import { GetServerSideProps } from 'next';
import toast from 'react-hot-toast';
import Image from 'next/image';

import { useLogEvent } from '@/hooks';
import { Info, MessageModal } from '@/components';
import { getMessages, queryClient } from '@/api';
import type { Message } from '@/generated/graphql';

interface Props {
  userId: string;
  username: string;
}

const Inbox = ({ userId, username }: Props) => {
  const triggerEvent = useLogEvent();
  const [modal, setModal] = useState(false);
  const [messageData, setMessageData] = useState({} as Partial<Message>);

  const {
    data: messages,
    refetch,
    isLoading,
    isRefetching,
  } = useQuery(['messages', { userId }], () => getMessages({ userId }), {
    select: (data) => data.messages,
  });

  const copyLink = () => {
    navigator.clipboard.writeText(`https://umamin.link/${username}`);
    toast.success('Copied to clipboard');

    triggerEvent('copy_link');
  };

  return (
    <section className='mx-auto flex max-w-[500px] flex-col items-center pb-24'>
      <MessageModal
        username={username}
        data={messageData}
        isOpen={modal}
        setIsOpen={setModal}
      />
      <div className='flex w-full gap-3'>
        <button
          type='button'
          onClick={copyLink}
          className='card flex w-full items-center gap-3 truncate px-4 py-3'
        >
          <IoIosCopy className='flex-none text-primary-100' />
          <p>umamin.link/to/{username}</p>
        </button>

        <button type='button' className='secondary-btn flex-none'>
          Settings
        </button>
      </div>

      <div className='my-10 w-full text-left'>
        <div className='mb-5 flex flex-col'>
          <div className='flex justify-between'>
            <p className='font-medium'>
              {messages?.length ? 'Latest messages' : 'No messages to show'}
            </p>
            <button type='button' onClick={() => refetch()}>
              <IoReload
                className={`text-lg ${
                  isLoading || isRefetching ? 'animate-spin' : ''
                }`}
              />
            </button>
          </div>
          <Info message='Tap a card to reveal an anonymous message.' />
        </div>

        <div className='space-y-6'>
          {messages?.map((m) => (
            <button
              type='button'
              key={m.id}
              onClick={() => {
                setMessageData(m);
                window.scrollTo(0, 0);
                setTimeout(() => {
                  setModal(true);
                }, 500);

                triggerEvent('open_message');
              }}
              className='w-full cursor-pointer overflow-hidden rounded-2xl border-2 border-secondary-100 bg-secondary-200 px-7 py-5 text-left'
            >
              <div className='relative mb-3 h-[40px]'>
                <Image
                  src='/assets/logo.svg'
                  layout='fill'
                  objectFit='contain'
                />
              </div>

              <div className='send chat-p flex max-w-full items-center space-x-3 bg-secondary-100 px-6 py-4 font-medium before:bg-secondary-100 after:bg-secondary-200'>
                <p className='reply text-secondary-400'>{m.receiverMsg}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const session = await getSession({ req });
  const { id, username } = session?.user ?? {};

  if (!id) {
    return {
      redirect: {
        statusCode: 301,
        destination: '/login',
      },
    };
  }

  await queryClient.prefetchQuery(['messages', { userId: id }], () =>
    getMessages({ userId: id })
  );

  return {
    props: {
      userId: id,
      username,
      dehydratedState: dehydrate(queryClient),
    },
  };
};

export default Inbox;
