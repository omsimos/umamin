import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { HiPuzzlePiece } from 'react-icons/hi2';
import { BiSolidMessageDetail } from 'react-icons/bi';
import type { RecentMessage } from '@umamin/generated';
import { useQuery, useMutation } from '@tanstack/react-query';

import { useLogEvent } from '@/hooks';
import { MessageDialog } from '@/components/Dialog';
import { editMessage, getRecentMessages } from '@/api';
import { useInboxContext } from '@/contexts/InboxContext';

import { InboxTabContainer } from './Container';

export const Recent = () => {
  const triggerEvent = useLogEvent();

  const [pageNo, setPageNo] = useState(1);
  const [cursorId, setCursorId] = useState('');
  const [msgModal, setMsgModal] = useState(false);
  const [messageData, setMessageData] = useState({} as RecentMessage);
  const [openedMessages, setOpenedMessages] = useState<string[]>([]);

  const { user } = useInboxContext();
  const queryArgs = { userId: user?.id ?? '', cursorId };

  const { data: messages, isLoading } = useQuery(
    ['recent_messages', queryArgs],
    () => getRecentMessages(queryArgs),
    {
      select: (data) => data.getRecentMessages,
      enabled: !!user?.id,
    }
  );

  const { mutate } = useMutation(editMessage);

  const handleOpen = (data: RecentMessage) => {
    setMessageData(data);
    const isOpened = openedMessages.includes(data.id);

    if (!isOpened && data.id) {
      setOpenedMessages((prev) => [...prev, data.id]);

      mutate(
        {
          id: data.id,
          isOpened: true,
        },
        {
          onSuccess: () => {
            triggerEvent('open_message');
          },
        }
      );
    }

    setMsgModal(true);
  };

  return (
    <InboxTabContainer
      pageNo={pageNo}
      cursorId={cursorId}
      messages={messages}
      isLoading={isLoading}
      setPageNo={setPageNo}
      setCursorId={setCursorId}
    >
      <MessageDialog
        type='recent'
        data={messageData}
        isOpen={msgModal}
        setIsOpen={setMsgModal}
      />

      {messages?.map((m) => (
        <button
          type='button'
          key={m.id}
          onClick={() => handleOpen(m)}
          className='msg-card hide-tap-highlight relative w-full cursor-pointer scroll-mt-6 overflow-hidden text-left'
        >
          <h3 className='font-syneExtrabold text-gradient mb-4 text-center text-3xl'>
            umamin
          </h3>

          <div className='send chat-p dark:bg-secondary-100 dark:before:bg-secondary-100 dark:after:bg-secondary-200 flex max-w-full items-center space-x-3 bg-gray-200 px-6 py-4 font-medium before:bg-gray-200 after:bg-gray-300'>
            <p className='reply text-secondary-400 truncate'>{m.receiverMsg}</p>
          </div>

          <div className='flex justify-between items-center'>
            <p className='text-secondary-400 text-sm font-medium italic'>
              {formatDistanceToNow(new Date(m.createdAt), {
                addSuffix: true,
              })}
            </p>

            <div className='flex gap-x-2'>
              <span className='rounded-full bg-[#6D4566] text-primary-200 p-2'>
                <BiSolidMessageDetail />
              </span>
              {m.clue && (
                <span className='rounded-full bg-[#456D51] text-[#4DF000] p-2'>
                  <HiPuzzlePiece />
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </InboxTabContainer>
  );
};
