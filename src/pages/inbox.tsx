import React, { useRef, useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { useSession } from 'next-auth/react';
import { IoIosCopy } from 'react-icons/io';
import { BsCheck2 } from 'react-icons/bs';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Image from 'next/image';
import { nanoid } from 'nanoid';

import SwipeToDelete from 'react-swipe-to-delete-ios';
import { BiMessageDots } from 'react-icons/bi';
import { Info } from '@/components';
import { useLogEvent } from '@/hooks';
import { deleteMessage, editMessage, getMessages } from '@/api';
import type { Message } from '@/generated/graphql';
import { MessageDialog, SettingsDialog } from '@/components/Dialog';

const Inbox = () => {
  const { push } = useRouter();
  const triggerEvent = useLogEvent();

  const [pageNo, setPageNo] = useState(1);
  const [cursorId, setCursorId] = useState('');
  const [msgModal, setMsgModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [messageData, setMessageData] = useState({} as Partial<Message>);
  const state = useRef({ x: 0 });

  const { data, status } = useSession();
  const { id, username } = data?.user ?? {};

  const {
    data: messages,
    refetch,
    isLoading,
  } = useQuery(
    ['messages', { userId: id ?? '', cursorId }],
    () => getMessages({ userId: id ?? '', cursorId }),
    { select: (data) => data.messages, enabled: !!id }
  );

  const handleMouseDown = (e: { screenX: number }) => {
    state.current.x = e.screenX;
  };

  const handleDelete = useMutation(deleteMessage);

  const { mutate } = useMutation(editMessage);

  const handleOpen =
    (data: Partial<Message>) =>
    (e: { screenX: number; stopPropagation: () => void }) => {
      setMessageData(data);

      const delta = Math.abs(e.screenX - state.current.x);

      if (delta < 10) {
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
      }
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
    <section className='mx-auto flex max-w-[500px] flex-col items-center pb-24'>
      <MessageDialog
        username={username ?? ''}
        data={messageData}
        isOpen={msgModal}
        setIsOpen={setMsgModal}
      />

      <SettingsDialog
        username={username ?? ''}
        isOpen={settingsModal}
        setIsOpen={setSettingsModal}
      />

      <div className='flex w-full gap-3'>
        <button
          type='button'
          onClick={copyLink}
          className='card flex w-full items-center gap-3 truncate px-4 py-3'
        >
          <IoIosCopy className='flex-none text-primary-100' />
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
          {messages?.length || isLoading ? (
            <div>
              <p className='font-medium'>Latest messages</p>
              <Info message='Tap a card to reveal an anonymous message or swipe left to delete.' />
            </div>
          ) : (
            <div className='mb-5 text-center'>
              <BiMessageDots className='mx-auto text-3xl' />
              <p className='font-medium'>No messages to show.</p>
              <button
                type='button'
                onClick={() => refetch()}
                className='text-xs text-primary-100'
              >
                Tap to refresh
              </button>
            </div>
          )}
        </div>

        <div className='space-y-6'>
          {isLoading
            ? Array.from({ length: 3 }).map(() => (
                <div
                  key={nanoid()}
                  className='msg-card hide-tap-highlight w-full cursor-pointer scroll-mt-6 overflow-hidden text-left'
                >
                  <div className='relative mb-3 h-[40px]'>
                    <Image
                      src='/assets/logo.svg'
                      layout='fill'
                      objectFit='contain'
                    />
                  </div>

                  <div className='send chat-p flex max-w-full items-center space-x-3 bg-secondary-100 px-6 py-4 font-medium before:bg-secondary-100 after:bg-secondary-200'>
                    <p className='reply text-secondary-400'>
                      Send me an anonymous message!
                    </p>
                  </div>
                  <div className='flex items-center justify-end space-x-1 text-right text-sm font-medium italic text-secondary-400'>
                    <p>Seen</p>
                    <BsCheck2 className='text-base' />
                  </div>
                </div>
              ))
            : messages?.map((m) => (
                <SwipeToDelete
                  key={m.id}
                  onDelete={() => {
                    handleDelete.mutate(
                      { id: m.id },
                      {
                        onSuccess: () => {
                          toast.success('Message deleted');
                          refetch();
                        },
                      }
                    );
                  }}
                  height={200}
                  deleteWidth={100}
                  deleteColor='transparent'
                  className='my-auto'
                >
                  <button
                    type='button'
                    key={m.id}
                    onMouseDown={handleMouseDown}
                    onClick={handleOpen(m)}
                    className='msg-card hide-tap-highlight h-[200px] w-full cursor-pointer scroll-mt-6 overflow-hidden text-left'
                  >
                    <div className='relative mb-3 h-[40px]'>
                      <Image
                        src='/assets/logo.svg'
                        layout='fill'
                        objectFit='contain'
                      />
                    </div>

                    <div className='send chat-p flex max-w-full items-center space-x-3 bg-secondary-100 px-6 py-4 font-medium before:bg-secondary-100 after:bg-secondary-200'>
                      <p className='reply text-secondary-400'>
                        {m.receiverMsg}
                      </p>
                    </div>
                    <div
                      className={
                        m.isOpened
                          ? 'flex items-center justify-end space-x-1 text-right text-sm font-medium italic text-secondary-400'
                          : 'hidden'
                      }
                    >
                      <p>Seen</p>
                      <BsCheck2 className='text-base' />
                    </div>
                  </button>
                </SwipeToDelete>
              ))}

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
    </section>
  );
};

export default Inbox;
