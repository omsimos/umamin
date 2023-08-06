import React, { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { queryClient } from '@/api';
import { Tab } from '@headlessui/react';
import { useRouter } from 'next/router';
import { MdWindow } from 'react-icons/md';
import { TbLogout } from 'react-icons/tb';
import { IoIosCopy } from 'react-icons/io';
import { RiSettings3Fill } from 'react-icons/ri';
import { HiOutlineGlobeAlt } from 'react-icons/hi';
import { signOut, useSession } from 'next-auth/react';
import { BiLink, BiSolidColorFill } from 'react-icons/bi';

import { useLogEvent } from '@/hooks';
import { Layout, Create } from '@/components';
import { ImageFill, Container } from '@/components/Utils';
import { Recent, Seen, Sent } from '@/components/InboxTabs';
import { ConfirmDialog, SettingsDialog } from '@/components/Dialog';
import { InboxProvider, useInboxContext } from '@/contexts/InboxContext';
import type { NextPageWithLayout } from '..';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

function classNames(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

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

  const categories = [
    {
      title: 'Recent',
      Component: Recent,
    },
    {
      title: 'Old',
      Component: Seen,
    },
    {
      title: 'Sent',
      Component: Sent,
    },
  ];

  if (status === 'unauthenticated') {
    push('/login');
  }

  if (isUserLoading) {
    return (
      <div className='mt-52 flex justify-center'>
        <span className='loader-2' />
      </div>
    );
  }

  return (
    <section className='mx-auto max-w-lg'>
      {!user?.username ? (
        <Create />
      ) : (
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

          <Container className='md:hidden flex flex-col mb-12'>
            <p className='text-lg'>Hello,</p>
            <h1 className='text-4xl font-semibold'>{user.username}</h1>
          </Container>

          <Container className='mb-5 w-full items-center justify-between px-4 hidden md:flex'>
            <ImageFill
              alt='profile picture'
              src={data?.user?.image}
              unoptimized
              className='dark:border-secondary-100 h-[80px] w-[80px] object-cover rounded-full border-2 border-gray-400 sm:h-[120px] sm:w-[120px]'
            />
            <div className='flex flex-col items-end gap-2'>
              <div className='flex items-center gap-4'>
                <p className='text-lg md:text-xl'>{user?.username}</p>
                <button
                  onClick={() => setSettingsModal(true)}
                  type='button'
                  className='dark:border-secondary-100 flex items-center gap-3 rounded-lg border-2 border-gray-400 px-4 py-2'
                >
                  <p>Settings</p>
                  <RiSettings3Fill className='text-primary-100 flex-none' />
                </button>
              </div>

              <button
                type='button'
                onClick={copyLink}
                className='dark:border-secondary-100 flex items-center justify-center gap-3 truncate rounded-lg border-2 border-gray-400 px-4 py-2'
              >
                <p>
                  {window.location.host}/to/{user?.username}
                </p>
                <IoIosCopy className='text-primary-100 flex-none' />
              </button>
            </div>
          </Container>

          <div className='w-full pb-16'>
            <AdContainer slotId='7607907295' className='mb-4' />
            <Tab.Group>
              <Tab.List>
                <Container className='mb-4 flex space-x-6'>
                  {categories.map(({ title }) => (
                    <Tab
                      key={title}
                      className={({ selected }) =>
                        classNames(
                          'rounded-full py-2 px-8 font-semibold text-white outline-none',
                          selected ? 'bg-primary-200' : 'text-[#8B8B8B]'
                        )
                      }
                    >
                      {title}
                    </Tab>
                  ))}
                </Container>
              </Tab.List>
              <Tab.Panels className='mt-2 pb-24'>
                {categories.map(({ title, Component }) => (
                  <Tab.Panel key={title}>
                    <Component />
                  </Tab.Panel>
                ))}
              </Tab.Panels>
            </Tab.Group>
          </div>

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
        </>
      )}
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
