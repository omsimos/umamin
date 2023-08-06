import React, { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { useRouter } from 'next/router';
import { MdWindow } from 'react-icons/md';
import { TbLogout } from 'react-icons/tb';
import { useQuery } from '@tanstack/react-query';
import { HiOutlineGlobeAlt } from 'react-icons/hi';
import { signOut, useSession } from 'next-auth/react';
import { BiLink, BiSolidColorFill } from 'react-icons/bi';

import { useLogEvent } from '@/hooks';
import { getGlobalMessages, queryClient } from '@/api';
import { ConfirmDialog, SettingsDialog } from '@/components/Dialog';
import { Layout, ImageFill, Container, GlobalPost } from '@/components';
import { InboxProvider, useInboxContext } from '@/contexts/InboxContext';
import type { NextPageWithLayout } from '..';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const Inbox: NextPageWithLayout = () => {
  const { push } = useRouter();
  const [loading, setLoading] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [logoutModal, setLogoutModal] = useState(false);
  const [linkModal, setLinkModal] = useState(false);

  const [pageNo, setPageNo] = useState(1);
  const [cursorId, setCursorId] = useState('');

  const { user, isUserLoading } = useInboxContext();
  const { data, status } = useSession();
  const triggerEvent = useLogEvent();

  const queryArgs = { userId: user?.id ?? '', cursorId };

  const { data: messages, isLoading } = useQuery(
    ['global_messages', queryArgs],
    () => getGlobalMessages(queryArgs),
    {
      select: (data) => data.getGlobalMessages,
    }
  );

  const copyLink = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/to/${user?.username}`
    );
    toast.success('Copied to clipboard');

    triggerEvent('copy_link');
  };

  const handleLogout = async () => {
    setLoading(true);
    await queryClient.invalidateQueries();
    await signOut({ redirect: false });
    push('/login');
    setLoading(false);
  };

  if (isUserLoading || isLoading) {
    return (
      <div className='mt-52 flex justify-center'>
        <span className='loader-2' />
      </div>
    );
  }

  return (
    <section className='mx-auto max-w-lg pb-52'>
      <SettingsDialog isOpen={settingsModal} setIsOpen={setSettingsModal} />
      <ConfirmDialog
        isOpen={linkModal}
        setIsOpen={setLinkModal}
        confirmText='Copy'
        handleConfirm={copyLink}
        content={
          <div>
            <p className='mb-4 text-secondary-400'>
              To change your link, simply update your username.
            </p>

            <div className='flex gap-x-2 items-center'>
              <ImageFill
                alt='profile picture'
                src={data?.user?.image}
                unoptimized
                className='border-secondary-100 h-[40px] w-[40px] object-cover rounded-full border'
              />
              <p className='border-secondary-100 rounded-lg border px-4 py-2 inline-block'>
                {window.location.host}/to/{user?.username}
              </p>
            </div>
          </div>
        }
      />

      <ConfirmDialog
        isOpen={logoutModal}
        setIsOpen={setLogoutModal}
        confirmText='Logout'
        danger
        content={<p>Are you sure you want to logout?</p>}
        handleConfirm={handleLogout}
      />

      <Container className='flex flex-col mb-12'>
        <div className='bg-secondary-200 p-8 rounded-2xl'>
          <div className='relative inline-block'>
            <p className='mb-4 text-base text-secondary-400'>Global Messages</p>
            <p className='absolute -top-2 -right-12 text-[10px] font-bold bg-primary-200 rounded-full px-2 tracking-wide'>
              BETA
            </p>
          </div>

          <div className='flex gap-x-2 items-center'>
            <ImageFill
              alt='profile picture'
              src={data?.user?.image}
              unoptimized
              className='border-secondary-100 h-[45px] w-[45px] object-cover rounded-full border flex-none'
            />

            <button
              type='button'
              className='rounded-full w-full bg-secondary-100 px-6 py-3 text-secondary-400 text-left'
            >
              Send a global message &rarr;
            </button>
          </div>
        </div>
      </Container>

      <AdContainer slotId='7607907295' className='mb-4' />

      <div className='space-y-12 pt-12'>
        {messages?.map((m) => (
          <GlobalPost message={m} key={m.id} />
        ))}
      </div>

      {!isLoading && messages && messages?.length > 0 && (
        <Container
          className={`flex mt-4 ${
            cursorId ? 'justify-between' : 'justify-end'
          }`}
        >
          {cursorId && (
            <button
              className='hover:underline'
              onClick={() => {
                setPageNo(1);
                setCursorId('');
              }}
              type='button'
            >
              &larr; Latest
            </button>
          )}

          {cursorId && <p>{pageNo}</p>}

          {messages.length === 10 && (
            <button
              className='hover:underline'
              onClick={() => {
                setPageNo(cursorId ? pageNo + 1 : 2);
                setCursorId(messages?.length ? messages[9]?.id! : '');
              }}
              type='button'
            >
              More &rarr;
            </button>
          )}
        </Container>
      )}

      <div className='bg-secondary-200 border-t-2 border-secondary-100 fixed w-full py-4 z-50 left-0 bottom-0 md:hidden flex justify-evenly items-center'>
        <button type='button' onClick={() => setLinkModal(true)}>
          <BiLink className='text-2xl' />
        </button>

        <button
          type='button'
          onClick={() =>
            toast('Coming soon!', {
              icon: '🚧',
            })
          }
        >
          <BiSolidColorFill className='text-2xl' />
        </button>

        <button
          type='button'
          onClick={() => setSettingsModal(true)}
          className='p-3 rounded-full bg-primary-200'
        >
          <MdWindow className='text-3xl' />
        </button>

        <Link href='/global'>
          <HiOutlineGlobeAlt className='text-2xl' />
        </Link>

        {status === 'loading' || loading ? (
          <span className='loader' />
        ) : (
          <button type='button' onClick={() => setLogoutModal(true)}>
            <TbLogout className='text-xl' />
          </button>
        )}
      </div>
    </section>
  );
};

Inbox.getLayout = (page: React.ReactElement) => {
  return (
    <InboxProvider>
      <Layout>{page}</Layout>
    </InboxProvider>
  );
};

export default Inbox;
