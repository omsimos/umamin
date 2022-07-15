import React from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { IoIosCopy } from 'react-icons/io';
import { useQuery } from 'react-query';
import { IoChatboxEllipses, IoReload } from 'react-icons/io5';
import { getSession } from 'next-auth/react';
import { GetServerSideProps } from 'next';

import { getMessages } from '@/api';

const Inbox = ({ username }: { username: string }) => {
  const {
    data: messages,
    refetch,
    isLoading,
    isRefetching,
  } = useQuery(['messages', { username }], () => getMessages({ username }), {
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
            <li key={m.id} className='card p-3'>
              <Image
                src='/assets/logo.svg'
                objectFit='contain'
                width={110}
                height={30}
              />
              <div className='relative rounded bg-secondary-100 p-4'>
                <p className='font-medium'>{m.content}</p>

                <IoChatboxEllipses className='absolute -top-7 right-4 text-5xl text-primary-100' />
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

  if (!session?.user?.username) {
    return {
      redirect: {
        statusCode: 301,
        destination: '/login',
      },
    };
  }

  return {
    props: {
      username: session.user.username,
    },
  };
};

export default Inbox;
