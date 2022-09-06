import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Tab } from '@headlessui/react';
import { IoIosCopy } from 'react-icons/io';
import { useSession } from 'next-auth/react';
import { RiSettings3Fill } from 'react-icons/ri';

import { useLogEvent, useUser } from '@/hooks';
import { ImageFill, Info } from '@/components';
import { Sent } from '@/components/InboxTabs/Sent';
import { Seen } from '@/components/InboxTabs/Seen';
import { SettingsDialog } from '@/components/Dialog';
import { Recent } from '@/components/InboxTabs/Recent';

function classNames(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

const Inbox = () => {
  const [settingsModal, setSettingsModal] = useState(false);

  const { data } = useSession();
  const triggerEvent = useLogEvent();
  const { image, email } = data?.user ?? {};

  const { data: userData } = useUser(email ?? '', 'email');
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

  return (
    <section className='grid place-items-center gap-y-5'>
      <SettingsDialog
        email={email ?? ''}
        isOpen={settingsModal}
        setIsOpen={setSettingsModal}
      />

      <div className='flex w-full max-w-lg items-center justify-center gap-3 px-2 sm:flex-row sm:gap-20 sm:px-0'>
        <ImageFill
          src={image}
          objectFit='cover'
          className='h-[80px] w-[80px] rounded-full sm:h-[120px] sm:w-[120px]'
        />
        <div className='flex flex-col gap-2'>
          <div className='flex items-center justify-between'>
            <p className='text-xl sm:text-2xl'>{username}</p>
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

      <div className='w-full max-w-lg pb-16'>
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
    </section>
  );
};

export default Inbox;
