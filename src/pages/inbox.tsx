import React, { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation } from 'react-query';
import { useSession } from 'next-auth/react';
import { IoIosCopy } from 'react-icons/io';
import { BsCheck2 } from 'react-icons/bs';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Image from 'next/image';

import { Info } from '@/components';
import { useLogEvent } from '@/hooks';
import { editMessage, getMessages } from '@/api';
import type { Message } from '@/generated/graphql';
import { MessageDialog, SettingsDialog } from '@/components/Dialog';

const Inbox = () => {
  const { push } = useRouter();
  const triggerEvent = useLogEvent();
  const showMoreRef = useRef<HTMLButtonElement>(null);

  const [pageNo, setPageNo] = useState(1);
  const [cursorId, setCursorId] = useState('');
  const [msgModal, setMsgModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [messageData, setMessageData] = useState({} as Partial<Message>);

  const { data, status } = useSession();
  const { id, username } = data?.user ?? {};

  const { data: messages, refetch } = useQuery(
    ['messages', { userId: id ?? '', cursorId }],
    () => getMessages({ userId: id ?? '', cursorId }),
    {
      select: (data) => data.messages,
    }
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

  useEffect(() => {
    if (status === 'unauthenticated') {
      push('/login');
    }
  }, [status]);

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
          <p className='font-medium'>
            {messages?.length ? 'Latest messages' : 'No messages to show'}
          </p>
          <Info message='Tap a card to reveal an anonymous message.' />
        </div>

        <div className='space-y-6'>
          {messages?.map((m, i) => (
            <button
              ref={i === messages.length - 5 ? showMoreRef : null}
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

              <div className='send chat-p flex max-w-full items-center space-x-3 bg-secondary-100 px-6 py-4 font-medium before:bg-secondary-100 after:bg-secondary-200'>
                <p className='reply text-secondary-400'>{m.receiverMsg}</p>
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
          ))}
          <div
            className={`flex ${cursorId ? 'justify-between' : 'justify-end'}`}
          >
            {cursorId && (
              <button
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

            <button
              onClick={() => {
                setPageNo(cursorId ? pageNo + 1 : 2);
                setCursorId(messages?.length ? messages[2]?.id : '');
              }}
              type='button'
            >
              More &rarr;
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Inbox;
