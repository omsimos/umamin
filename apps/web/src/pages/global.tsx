import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { queryClient } from '@/api';
import { useRouter } from 'next/router';
import { MdWindow } from 'react-icons/md';
import { TbLogout } from 'react-icons/tb';
import { HiOutlineGlobeAlt } from 'react-icons/hi';
import { signOut, useSession } from 'next-auth/react';
import { BiLink, BiSolidColorFill } from 'react-icons/bi';

import { useLogEvent } from '@/hooks';
import { Layout, ImageFill, Container } from '@/components';
import { ConfirmDialog, SettingsDialog } from '@/components/Dialog';
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

  const { user, isUserLoading } = useInboxContext();
  const { data, status } = useSession();
  const triggerEvent = useLogEvent();

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

  if (isUserLoading) {
    return (
      <div className='mt-52 flex justify-center'>
        <span className='loader-2' />
      </div>
    );
  }

  return (
    <section className='mx-auto max-w-lg'>
      <>
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
              <p className='mb-4 text-base text-secondary-400'>
                Global Messages
              </p>
              <p className='absolute -top-2 -right-12 text-xs font-semibold bg-primary-200 rounded-full py-1 px-2'>
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

          <button
            type='button'
            onClick={() =>
              toast('Coming soon!', {
                icon: '🚧',
              })
            }
          >
            <HiOutlineGlobeAlt className='text-2xl' />
          </button>

          {status === 'loading' || loading ? (
            <span className='loader' />
          ) : (
            <button type='button' onClick={() => setLogoutModal(true)}>
              <TbLogout className='text-xl' />
            </button>
          )}
        </div>
      </>
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
