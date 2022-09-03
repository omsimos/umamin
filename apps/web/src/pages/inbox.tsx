import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Tab } from '@headlessui/react';
import { IoIosCopy } from 'react-icons/io';
import { useSession } from 'next-auth/react';
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
      <div className='flex w-full max-w-lg flex-col items-center px-2 sm:px-0'>
        <SettingsDialog
          email={email ?? ''}
          isOpen={settingsModal}
          setIsOpen={setSettingsModal}
        />

        <ImageFill
          src={image}
          objectFit='cover'
          className='mb-4 h-[100px] w-[100px] rounded-full'
        />
        <div className='flex w-full gap-3'>
          <button
            type='button'
            onClick={copyLink}
            className='card flex w-full items-center gap-3 truncate px-4 py-3'
          >
            <IoIosCopy className='text-primary-100 flex-none' />
            <p>umamin.link/to/{username}</p>
          </button>

          <button
            onClick={() => setSettingsModal(true)}
            type='button'
            className='secondary-btn flex-none'
          >
            Settings
          </button>
        </div>
      </div>

      <div className='w-full max-w-lg px-2 pb-16 sm:px-0'>
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
