import React from 'react';
import toast from 'react-hot-toast';
import { IoIosCopy } from 'react-icons/io';
import { useSession } from 'next-auth/react';

import { useLogEvent } from '@/hooks';
import type { Message } from '@umamin/generated';
import { ImageFill, Container } from '@/components/Utils';
import { useInboxContext } from '@/contexts/InboxContext';

interface Props {
  tab?: string;
  isLoading: boolean;
  messages?: (Message | undefined)[];
  fetchNextPage?: () => void;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  children: React.ReactNode;
}

export const InboxTabContainer = ({
  tab,
  messages,
  fetchNextPage,
  isFetchingNextPage,
  isLoading,
  hasNextPage,
  children,
}: Props) => {
  const { data } = useSession();
  const { user } = useInboxContext();
  const triggerEvent = useLogEvent();

  const copyLink = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/to/${user?.username}`
    );
    toast.success('Copied to clipboard');

    triggerEvent('copy_link');
  };

  return (
    <section className='flex flex-col space-y-6'>
      {!messages?.length && !isLoading && (
        <Container>
          <div className='msg-card'>
            <p className='mb-4 text-secondary-400'>
              {tab === 'sent'
                ? 'You have not sent any messages yet. Send anonymous messages to your friends!'
                : 'You have 0 messages. Start receiving anonymous messages by sharing your link!'}
            </p>

            <div className='flex gap-x-2 items-center'>
              <ImageFill
                alt='profile picture'
                src={data?.user?.image}
                unoptimized
                className='border-secondary-100 h-[40px] w-[40px] object-cover rounded-full border'
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
      )}

      {isLoading ? (
        <div className='mt-20 flex min-h-screen justify-center'>
          <span className='loader-2' />
        </div>
      ) : (
        <>
          {children}
          <Container className='grid place-items-center'>
            {isFetchingNextPage ? (
              <span className='loader' />
            ) : (
              messages &&
              messages?.length >= 5 &&
              hasNextPage && (
                <button
                  className='bg-secondary-200 border border-secondary-100 mx-auto text-white px-6 py-2 rounded-lg'
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
        </>
      )}
    </section>
  );
};
