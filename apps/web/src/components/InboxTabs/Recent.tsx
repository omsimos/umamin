import React, { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import type { Message } from '@umamin/generated';
import { formatDistanceToNow } from 'date-fns';
import { useSession } from 'next-auth/react';
import { BsCheck2 } from 'react-icons/bs';
import dynamic from 'next/dynamic';
import Image from 'next/image';

import { useLogEvent, useUser } from '@/hooks';
import { editMessage, getMessages, queryClient } from '@/api';
import { Create } from '@/components';
import { MessageDialog } from '@/components/Dialog';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

export const Recent = () => {
  const triggerEvent = useLogEvent();

  const [pageNo, setPageNo] = useState(1);
  const [cursorId, setCursorId] = useState('');
  const [msgModal, setMsgModal] = useState(false);
  const [messageData, setMessageData] = useState({} as Partial<Message>);

  const { data } = useSession();
  const { email } = data?.user ?? {};

  const { data: userData, refetch: refetchUser } = useUser(
    email ?? '',
    'email'
  );
  const { username } = userData ?? {};

  const {
    data: messages,
    refetch,
    isLoading,
  } = useQuery(
    ['messages', { userId: userData?.id ?? '', cursorId, type: 'recent' }],
    () => getMessages({ userId: userData?.id ?? '', cursorId, type: 'recent' }),
    { select: (data) => data.getMessages, enabled: !!userData?.id }
  );

  const { mutate } = useMutation(editMessage);

  const handleOpen = (data: Partial<Message>) => {
    setMessageData(data);

    if (data.id && !data.isOpened) {
      mutate(
        {
          id: data.id,
          isOpened: true,
        },
        {
          onSuccess: () => {
            refetch();
            queryClient.invalidateQueries([
              'messages',
              { userId: userData?.id ?? '', cursorId: '', type: 'seen' },
            ]);
          },
        }
      );
    }
    setMsgModal(true);
    triggerEvent('open_message');
  };

  return (
    <section className='space-y-8'>
      {!username ? (
        <Create refetch={refetchUser} />
      ) : (
        <div className='mx-auto flex flex-col items-center'>
          <MessageDialog
            username={username ?? ''}
            data={messageData}
            isOpen={msgModal}
            setIsOpen={setMsgModal}
          />

          <div className='mb-10 w-full text-left'>
            <p className='font-medium'>
              {messages?.length || isLoading ? null : 'No messages to show'}
            </p>

            <div className='space-y-6'>
              {isLoading ? (
                <div className='mt-24 flex justify-center'>
                  <span className='loader-2' />
                </div>
              ) : (
                messages?.map((m) => (
                  <button
                    type='button'
                    key={m.id}
                    onClick={() => handleOpen(m)}
                    className='msg-card hide-tap-highlight w-full cursor-pointer scroll-mt-6 overflow-hidden text-left'
                  >
                    <div className='relative mb-3 h-[40px]'>
                      <Image
                        src='/assets/logo.svg'
                        layout='fill'
                        objectFit='contain'
                      />
                    </div>

                    <div className='send chat-p bg-secondary-100 before:bg-secondary-100 after:bg-secondary-200 flex max-w-full items-center space-x-3 px-6 py-4 font-medium'>
                      <p className='reply text-secondary-400'>
                        {m.receiverMsg}
                      </p>
                    </div>
                    <div className='text-secondary-400 flex items-center justify-between text-sm font-medium italic'>
                      <p>
                        {formatDistanceToNow(new Date(m.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                      <div
                        className={
                          m.isOpened ? 'flex items-center space-x-1' : 'hidden'
                        }
                      >
                        <p>Seen</p>
                        <BsCheck2 className='text-base' />
                      </div>
                    </div>
                  </button>
                ))
              )}

              {!messages?.length && cursorId && !isLoading && (
                <div className='mt-24 flex justify-center'>
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
                  className={`flex ${
                    cursorId ? 'justify-between' : 'justify-end'
                  }`}
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
                        setCursorId(messages?.length ? messages[2]?.id : '');
                      }}
                      type='button'
                    >
                      More &rarr;
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AdContainer slot='7293553855' />
    </section>
  );
};
