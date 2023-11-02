import React from 'react';
import dynamic from 'next/dynamic';
import { Tab } from '@headlessui/react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

import { Container } from '@/components/Utils';
import { InboxTab } from '@/components/InboxTabs';
import { Layout, Create, BottomNavbar } from '@/components';
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
  const { status } = useSession();
  const { user, isUserLoading } = useInboxContext();

  const categories: ('recent' | 'sent')[] = ['recent', 'sent'];

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
          <Container className='flex flex-col mb-12'>
            <p className='text-lg'>Hello,</p>
            <h1 className='text-4xl font-semibold'>{user.username}</h1>
          </Container>

          <div className='w-full pb-16'>
            <AdContainer slotId='7607907295' className='mb-4' />
            <Tab.Group>
              <Tab.List>
                <Container className='mb-4 flex space-x-6'>
                  {categories.map((c) => (
                    <Tab
                      key={c}
                      className={({ selected }) =>
                        classNames(
                          'rounded-full py-2 px-8 font-semibold text-white outline-none capitalize',
                          selected ? 'bg-primary-200' : 'text-[#8B8B8B]'
                        )
                      }
                    >
                      {c}
                    </Tab>
                  ))}
                </Container>
              </Tab.List>
              <Tab.Panels className='mt-2 pb-24'>
                {categories.map((c) => (
                  <Tab.Panel key={c}>
                    <InboxTab type={c} />
                  </Tab.Panel>
                ))}
              </Tab.Panels>
            </Tab.Group>
          </div>

          <BottomNavbar />
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
