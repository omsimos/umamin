import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { GlobalMessage } from '@umamin/generated';
import { useInfiniteQuery } from '@tanstack/react-query';

import { getGlobalMessages } from '@/api';
import { SendGlobalModal } from '@/components/Dialog';
import { ImageFill, Container } from '@/components/Utils';
import { Layout, GlobalPost, BottomNavbar } from '@/components';
import { InboxProvider, useInboxContext } from '@/contexts/InboxContext';

import type { NextPageWithLayout } from '..';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const Global: NextPageWithLayout = () => {
  const [sendGlobalModal, setSendGlobalModal] = useState(false);
  const [messageData, setMessageData] = useState<
    GlobalMessage | null | undefined
  >(null);

  const { user } = useInboxContext();
  const { data } = useSession();
  const { push } = useRouter();

  const {
    data: messages,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['global_messages', { userId: user?.id }],
    queryFn: ({ pageParam }) => getGlobalMessages({ cursorId: pageParam }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.getGlobalMessages?.cursorId,
    select: (data) =>
      data.pages.flatMap((page) => page.getGlobalMessages?.data),
  });

  if (isLoading) {
    return (
      <div className='mt-52 flex justify-center'>
        <span className='loader-2' />
      </div>
    );
  }

  return (
    <>
      <SendGlobalModal
        setMessageData={setMessageData}
        isOpen={sendGlobalModal}
        setIsOpen={setSendGlobalModal}
      />

      <section className='mx-auto max-w-lg pb-52'>
        {process.env.NEXT_PUBLIC_GLOBAL_MAINTENANCE === 'true' ? (
          <Container>
            <h1 className='text-4xl font-semibold'>We&quot;ll be back!</h1>
            <p className='text-secondary-400 mt-1'>
              This page is currently taking a break
            </p>
          </Container>
        ) : (
          <>
            <Container className='flex flex-col mb-12'>
              <div className='bg-secondary-200 p-8 rounded-2xl'>
                <div className='relative inline-block'>
                  <p className='mb-4 text-base text-secondary-400'>
                    Global Messages
                  </p>
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
                    onClick={() => {
                      if (!user) {
                        push('/login');
                      } else {
                        setSendGlobalModal(true);
                      }
                    }}
                    className='rounded-full w-full bg-secondary-100 px-6 py-3 text-secondary-400 text-left'
                  >
                    Send a global message &rarr;
                  </button>
                </div>
              </div>
            </Container>

            <AdContainer slotId='7492157497' className='mb-4' />

            <div className='space-y-12 pt-12'>
              {messageData && (
                <GlobalPost message={messageData} key={messageData.id} />
              )}
              {messages?.map((m) => (
                <GlobalPost message={m} key={m?.id} />
              ))}
            </div>

            <AdContainer slotId='2048259127' className='my-4' />

            <Container className='grid place-items-center mt-12'>
              {isFetchingNextPage ? (
                <span className='loader' />
              ) : (
                messages &&
                messages?.length >= 5 &&
                hasNextPage && (
                  <button
                    className='bg-secondary-200 border border-secondary-100 mx-auto text-white px-6 py-2 rounded-lg'
                    onClick={() => {
                      fetchNextPage();
                    }}
                    type='button'
                  >
                    Load More
                  </button>
                )
              )}
            </Container>
          </>
        )}

        {user && <BottomNavbar />}
      </section>
    </>
  );
};

Global.getLayout = (page: React.ReactElement) => {
  return (
    <InboxProvider>
      <Layout>{page}</Layout>
    </InboxProvider>
  );
};

export default Global;
