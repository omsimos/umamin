import Link from 'next/link';
import dynamic from 'next/dynamic';
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { GlobalMessage } from '@umamin/generated';
import { BsFacebook, BsInstagram } from 'react-icons/bs';
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
            <Container className='mb-12 flex flex-col'>
              <div className='bg-secondary-200 mb-4 rounded-2xl p-8'>
                <p className='bg-primary-200 inline-block rounded-full px-2 text-[10px] font-bold tracking-wide'>
                  ANNOUNCEMENT
                </p>

                <p className='mt-4'>
                  🎉 Huge update coming to <strong>Umamin Global</strong>!
                </p>
                <p className='text-secondary-400 border-secondary-100 mt-5 border-t pt-5'>
                  Follow us for updates:
                </p>

                <div className='mt-2 flex space-x-4'>
                  <Link
                    className='flex items-center space-x-2 leading-none'
                    href='https://www.instagram.com/umamin.app/'
                    target='_blank'
                  >
                    <BsInstagram className='text-primary-300' />
                    <p>@umamin.app</p>
                  </Link>

                  <Link
                    className='flex items-center space-x-2 leading-none'
                    href='https://www.facebook.com/umamin.official/'
                    target='_blank'
                  >
                    <BsFacebook className='text-primary-300' />
                    <p>@umamin.official</p>
                  </Link>
                </div>
              </div>

              <div className='bg-secondary-200 rounded-2xl p-8'>
                <div className='relative inline-block'>
                  <p className='text-secondary-400 mb-4 text-base'>
                    Global Messages
                  </p>
                </div>

                <div className='flex items-center gap-x-2'>
                  <ImageFill
                    alt='profile picture'
                    src={data?.user?.image}
                    unoptimized
                    className='border-secondary-100 h-[45px] w-[45px] flex-none rounded-full border object-cover'
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
                    className='bg-secondary-100 text-secondary-400 w-full rounded-full px-6 py-3 text-left'
                  >
                    Send a global message
                  </button>
                </div>
              </div>
            </Container>

            <AdContainer slotId='7492157497' className='mb-4' />

            <div className='space-y-12 pt-12'>
              {messageData && (
                <GlobalPost message={messageData} key={messageData.id} />
              )}
              {messages?.map((m, i) => (
                <div key={m?.id}>
                  {(i + 1) % 5 === 0 && (
                    <AdContainer slotId='1966757556' test className='mb-12' />
                  )}

                  <GlobalPost message={m} />
                </div>
              ))}
            </div>

            <Container className='mt-12 grid place-items-center'>
              {isFetchingNextPage ? (
                <span className='loader' />
              ) : (
                messages &&
                messages?.length >= 10 &&
                hasNextPage && (
                  <button
                    className='bg-secondary-200 border-secondary-100 mx-auto rounded-lg border px-6 py-2 text-white'
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
