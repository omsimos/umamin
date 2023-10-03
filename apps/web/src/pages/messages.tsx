import React from 'react';
import dynamic from 'next/dynamic';

import { Container } from '@/components/Utils';
import { InboxProvider, useInboxContext } from '@/contexts/InboxContext';
import { Layout, Create, BottomNavbar, ManyMessages } from '@/components';
import type { NextPageWithLayout } from '..';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const Inbox: NextPageWithLayout = () => {
  const { user } = useInboxContext();

  return (
    <section className='mx-auto'>
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
            <ManyMessages />
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
