import React, { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import type { Message } from '@umamin/generated';
import { formatDistanceToNow } from 'date-fns';
import { useSession } from 'next-auth/react';
import { IoIosCopy } from 'react-icons/io';
import { BsCheck2 } from 'react-icons/bs';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import Image from 'next/image';

import { useLogEvent, useUser } from '@/hooks';
import { editMessage, getMessages } from '@/api';
import { Create, ImageFill, Info } from '@/components';
import { MessageDialog, SettingsDialog } from '@/components/Dialog';

const AdContainer = dynamic(() => import('@/components/AdContainer'), {
  ssr: false,
});

const Inbox = () => {
  const { push } = useRouter();
  const triggerEvent = useLogEvent();

  const [pageNo, setPageNo] = useState(1);
  const [cursorId, setCursorId] = useState('');
  const [msgModal, setMsgModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [messageData, setMessageData] = useState({} as Partial<Message>);

  const { data, status } = useSession();
  const { image, email } = data?.user ?? {};

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
    ['messages', { userId: userData?.id ?? '', cursorId }],
    () => getMessages({ userId: userData?.id ?? '', cursorId }),
    { select: (data) => data.messages, enabled: !!userData?.id }
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
          },
        }
      );
    }
    setMsgModal(true);
    triggerEvent('open_message');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`https://umamin.link/to/${username}`);
    toast.success('Copied to clipboard');

    triggerEvent('copy_link');
  };

  if (status === 'unauthenticated') {
    push('/login');
  }

  return (
    <section className='space-y-8'>
      {!username ? (
        <Create refetch={refetchUser} />
      ) : (
        <div className='mx-auto flex max-w-[500px] flex-col items-center'>
          <MessageDialog
            username={username ?? ''}
            data={messageData}
            isOpen={msgModal}
            setIsOpen={setMsgModal}
          />

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

          <div className='my-10 w-full text-left'>
            <div className='mb-5 flex flex-col'>
              <p className='font-medium'>
                {messages?.length || isLoading
                  ? 'Latest messages'
                  : 'No messages to show'}
              </p>
              <Info message='Tap a card to reveal an anonymous message.' />
            </div>

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

export default Inbox;
