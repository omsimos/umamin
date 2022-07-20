import React from 'react';
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

      <div className='mt-8 w-full text-left'>
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
        <ul className='space-y-8'>
          {messages?.map((m) => (
            <li key={m.id} className='card overflow-hidden rounded-2xl p-5'>
              <p className='flex items-center justify-center pb-2  font-syne font-extrabold'>
                <span className='text-primary-200'>umamin</span>.link/to/
                {username}
              </p>

              <div className='receive-inbox chat-p max-w-full px-6 py-5 font-medium'>
                <div className='mb-3 flex items-center space-x-3'>
                  <div className='w-1 rounded bg-secondary-400 py-3 ' />
                  <p className='text-secondary-400'>{m.receiverMsg}</p>
                </div>
                <p>{m.content}</p>
              </div>
            </li>
          ))}
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
