import React, { Dispatch, SetStateAction } from 'react';
import toast from 'react-hot-toast';
import { useLogEvent } from '@/hooks';
import { IoIosCopy } from 'react-icons/io';
import { useSession } from 'next-auth/react';
import { ImageFill, Container } from '@/components/Utils';
import { useInboxContext } from '@/contexts/InboxContext';

interface Props {
  pageNo: number;
  tab?: string;
  cursorId: string;
  isLoading: boolean;
  messages?: any;
  setPageNo: Dispatch<SetStateAction<number>>;
  setCursorId: Dispatch<SetStateAction<string>>;
  children: React.ReactNode;
}

export const InboxTabContainer = ({
  tab,
  cursorId,
  pageNo,
  messages,
  isLoading,
  setCursorId,
  setPageNo,
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
                <IoIosCopy className='text-tigris flex-none' />
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
        children
      )}

      <Container>
        {!messages?.length && cursorId && !isLoading && (
          <div className='flex justify-center pt-24'>
            <button
              onClick={() => {
                setPageNo(1);
                setCursorId('');
              }}
              className='hover:underline'
              type='button'
            >
              &larr; Go back to latest messages
            </button>
          </div>
        )}

        {!isLoading && messages && messages?.length > 0 && (
          <div
            className={`flex ${cursorId ? 'justify-between' : 'justify-end'}`}
          >
            {cursorId && (
              <button
                className='hover:underline'
                onClick={() => {
                  setPageNo(1);
                  setCursorId('');
                }}
                type='button'
              >
                &larr; Latest
              </button>
            )}

            {cursorId && <p>{pageNo}</p>}

            {messages.length === 3 && (
              <button
                className='hover:underline'
                onClick={() => {
                  setPageNo(cursorId ? pageNo + 1 : 2);
                  setCursorId(messages?.length ? messages[2]?.id! : '');
                }}
                type='button'
              >
                More &rarr;
              </button>
            )}
          </div>
        )}
      </Container>
    </section>
  );
};
