import React from 'react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { IoIosCopy } from 'react-icons/io';
import { useInfiniteQuery } from '@tanstack/react-query';

import { getMessages } from '@/api';
import { useLogEvent } from '@/hooks';
import { ImageFill, Container } from '@/components/Utils';
import { useInboxContext } from '@/contexts/InboxContext';

import { MessageCard } from './MessageCard';
import { SentMessageCard } from './SentMessageCard';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

interface Props {
  type: 'recent' | 'sent';
}

export const InboxTab = ({ type }: Props) => {
  const { user } = useInboxContext();
  const triggerEvent = useLogEvent();

  const {
    data: messages,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [`${type}_messages`, { type, userId: user?.id }],
    queryFn: ({ pageParam }) =>
      getMessages({ cursorId: pageParam, userId: user?.id!, type }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.getMessages?.cursorId,
    select: (data) => data.pages.flatMap((page) => page.getMessages?.data),
    enabled: !!user?.id,
  });

  const copyLink = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/to/${user?.username}`
    );
    toast.success('Copied to clipboard');

    triggerEvent('copy_link');
  };

  if (isLoading) {
    return (
      <div className='mt-20 flex min-h-screen justify-center'>
        <span className='loader-2' />
      </div>
    );
  }

  return (
    <section className='flex flex-col space-y-6'>
      {!messages?.length ? (
        <Container>
          <div className='msg-card'>
            <p className='text-secondary-400 mb-4'>
              {type === 'sent'
                ? 'You have not sent any messages yet. Send anonymous messages to your friends!'
                : 'You have 0 messages. Start receiving anonymous messages by sharing your link!'}
            </p>

            <div className='flex items-center gap-x-2'>
              <ImageFill
                alt='profile picture'
                src={user?.image}
                unoptimized
                className='border-secondary-100 h-[40px] w-[40px] rounded-full border object-cover'
              />

              <button
                type='button'
                onClick={copyLink}
                className='border-secondary-100 flex items-center justify-center gap-3 truncate rounded-lg border px-4 py-2'
              >
                <p>
                  {window.location.host}/to/{user?.username}
                </p>
                <IoIosCopy className='text-primary-200 flex-none' />
              </button>
            </div>
          </div>
        </Container>
      ) : (
        <>
          {type === 'recent' && (
            <div>
              {messages?.map((m, i) => (
                <div key={m?.id}>
                  {(i + 1) % 3 === 0 && <AdContainer slotId='5900805117' />}

                  <MessageCard key={m?.id} refetch={refetch} message={m} />
                </div>
              ))}
            </div>
          )}

          {type === 'sent' && (
            <div className='space-y-6'>
              {messages?.map((m, i) => (
                <div key={m?.id}>
                  {(i + 1) % 3 === 0 && (
                    <AdContainer slotId='5900805117' className='mb-6' />
                  )}

                  <Container className='space-y-6'>
                    <SentMessageCard key={m?.id} data={m} />
                  </Container>
                </div>
              ))}
            </div>
          )}

          <Container className='grid place-items-center'>
            {isFetchingNextPage ? (
              <span className='loader' />
            ) : (
              messages &&
              messages?.length >= 5 &&
              hasNextPage && (
                <button
                  className='bg-secondary-200 border-secondary-100 mx-auto rounded-lg border px-6 py-2 text-white'
                  onClick={() => {
                    fetchNextPage?.();
                  }}
                  type='button'
                >
                  Load More
                </button>
              )
            )}
          </Container>

          <AdContainer slotId='7293553855' className='my-4' />
        </>
      )}
    </section>
  );
};
