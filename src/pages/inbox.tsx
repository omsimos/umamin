import React from 'react';
import Image from 'next/image';
import { IoReload } from 'react-icons/io5';
import { useQuery, dehydrate } from 'react-query';
import { getSession } from 'next-auth/react';
import { IoIosCopy } from 'react-icons/io';
import { GetServerSideProps } from 'next';
import toast from 'react-hot-toast';

import { getMessages, queryClient } from '@/api';

interface Props {
  userId: string;
  username: string;
}

const Inbox = ({ userId, username }: Props) => {
  const [open, setOpen] = React.useState('');

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
  };

  return (
    <section className='[&>h1]:h1-text mx-auto flex flex-col items-center pb-24 sm:w-[500px]'>
      <h1>Your inbox</h1>
      <div className='mt-8 flex w-full gap-3'>
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

      <div className='mt-10 w-full text-left'>
        <div className='mb-4 flex justify-between'>
          <p className='text-sm'>
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
        <ul className='space-y-10'>
          {messages?.map((m) =>
            m.id === open ? (
              <li
                key={m.id}
                className='card overflow-hidden rounded-2xl px-7 py-5'
              >
                <p className='flex items-center justify-center pb-2  font-syne font-extrabold'>
                  <span className='text-primary-200'>umamin</span>.link/to/
                  {username}
                </p>

                <div className='send chat-p max-w-full bg-secondary-100 px-6 py-5 font-medium before:bg-secondary-100 after:bg-secondary-200'>
                  <div className='mb-3 flex items-center space-x-3'>
                    <div className='w-1 rounded bg-secondary-400 py-3 ' />
                    <p className='text-secondary-400'>{m.receiverMsg}</p>
                  </div>
                  <p className='text-xl'>{m.content}</p>
                </div>
              </li>
            ) : (
              <button
                type='button'
                key={m.id}
                onClick={() => {
                  setOpen(m.id);
                }}
                className='card w-full cursor-pointer overflow-hidden rounded-2xl px-7 py-5 text-left'
              >
                <div className='relative mb-3 h-[60px]'>
                  <Image
                    src='/assets/logo.svg'
                    layout='fill'
                    objectFit='contain'
                  />
                </div>

                <div className='receive chat-p flex max-w-full items-center  space-x-3 bg-secondary-100 px-6 py-5 font-medium before:bg-secondary-100 after:bg-secondary-200'>
                  <div className='h-full w-1  rounded bg-secondary-400 py-3 ' />
                  <p className='text-xl text-secondary-400'>{m.receiverMsg}</p>
                </div>
              </button>
            )
          )}
        </ul>
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
