import React from 'react';
import { Tab } from '@headlessui/react';
import { Sent } from '@/components/InboxTabs/Sent';
import { Seen } from '@/components/InboxTabs/Seen';
import { Recent } from '@/components/InboxTabs/Recent';

function classNames(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

const Inbox = () => {
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
    <section className='grid place-items-center'>
      <div className='w-full max-w-md px-2 py-16 sm:px-0'>
        <Tab.Group>
          <Tab.List className='flex space-x-1 rounded-xl bg-blue-900/20 p-1'>
            {categories.map(({ title }) => (
              <Tab
                key={title}
                className={({ selected }) =>
                  classNames(
                    'w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-blue-700',
                    'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'bg-white shadow'
                      : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'
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
