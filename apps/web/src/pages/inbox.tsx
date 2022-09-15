import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Tab } from '@headlessui/react';
import { useRouter } from 'next/router';
import { IoIosCopy } from 'react-icons/io';
import { useSession } from 'next-auth/react';
import { RiSettings3Fill } from 'react-icons/ri';

import { Create, ImageFill, Info } from '@/components';
import { useLogEvent, useUser } from '@/hooks';
import { SettingsDialog } from '@/components/Dialog';
import { Recent, Seen, Sent } from '@/components/InboxTabs';

function classNames(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

const Inbox = () => {
  const { push } = useRouter();
  const [settingsModal, setSettingsModal] = useState(false);

  const { data, status } = useSession();
  const triggerEvent = useLogEvent();
  const { image, email } = data?.user ?? {};

  const { data: userData, isLoading, refetch } = useUser(email ?? '', 'email');
  const { username } = userData ?? {};

  const copyLink = () => {
    navigator.clipboard.writeText(`https://umamin.link/to/${username}`);
    toast.success('Copied to clipboard');

    triggerEvent('copy_link');
  };

  const categories = [
    {
      title: 'Recent',
      Component: Recent,
    },
    {
      title: 'Seen',
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

  if (isLoading) {
    return (
      <div className='flex justify-center'>
        <span className='loader-2' />
      </div>
    );
  }

  return (
    <section className='mx-auto max-w-lg'>
      {!username && !isLoading ? (
        <Create refetch={refetch} />
      ) : (
        <>
          <SettingsDialog
            user={userData}
            refetch={refetch}
            isOpen={settingsModal}
            setIsOpen={setSettingsModal}
          />

          <div className='mb-5 flex w-full items-center justify-between px-4'>
            <ImageFill
              src={image}
              objectFit='cover'
              className='h-[80px] w-[80px] rounded-full sm:h-[120px] sm:w-[120px]'
            />
            <div className='flex flex-col items-end gap-2'>
              <div className='flex items-center gap-4'>
                <p className='text-lg md:text-xl'>{username}</p>
                <button
                  onClick={() => setSettingsModal(true)}
                  type='button'
                  className='border-secondary-100 flex items-center gap-3 rounded-lg border-2 px-4 py-2'
                >
                  <p>Settings</p>
                  <RiSettings3Fill className='text-primary-100 flex-none' />
                </button>
              </div>

              <button
                type='button'
                onClick={copyLink}
                className='border-secondary-100 flex items-center justify-center gap-3 truncate rounded-lg border-2 px-4 py-2'
              >
                <p>umamin.link/to/{username}</p>
                <IoIosCopy className='text-primary-100 flex-none' />
              </button>
            </div>
          </div>

          <div className='w-full pb-16'>
            <Info message='Tap a card to reveal an anonymous message.' />
            <Tab.Group>
              <Tab.List className='bg-secondary-200 mt-1 mb-4 flex space-x-1 rounded-xl p-1'>
                {categories.map(({ title }) => (
                  <Tab
                    key={title}
                    className={({ selected }) =>
                      classNames(
                        'w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-white',
                        'ring-offset-primary-300 ring-transparent ring-opacity-60 ring-offset-2 focus:outline-none focus:ring-2',
                        selected
                          ? 'text-secondary-200 bg-[#EB9DDC] shadow'
                          : 'text-white hover:bg-white/[0.12] hover:text-white'
                      )
                    }
                  >
                    {title}
                  </Tab>
                ))}
              </Tab.List>
              <Tab.Panels className='mt-2'>
                {categories.map(({ title, Component }) => (
                  <Tab.Panel key={title}>
                    <Component />
                  </Tab.Panel>
                ))}
              </Tab.Panels>
            </Tab.Group>
          </div>
        </>
      )}
    </section>
  );
};

export default Inbox;
