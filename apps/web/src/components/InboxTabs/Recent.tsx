import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useQuery, useMutation } from 'react-query';
import type { RecentMessage } from '@umamin/generated';

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

  const { user, refetchSeen } = useInboxContext();
  const queryArgs = { userId: user?.id ?? '', cursorId };

  const {
    data: messages,
    refetch,
    isLoading,
  } = useQuery(
    ['recent_messages', queryArgs],
    () => getRecentMessages(queryArgs),
    {
      select: (data) => data.getRecentMessages,
      enabled: !!user?.id,
    }
  );

  const { mutate } = useMutation(editMessage);

  const handleOpen = (data: RecentMessage) => {
    if (data.id) {
      setMessageData(data);

      mutate(
        {
          id: data.id,
          isOpened: true,
        },
        {
          onSuccess: () => {
            refetch();
            refetchSeen();
            triggerEvent('open_message');
          },
        }
      );
      setMsgModal(true);
    }
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
        refetch={refetchSeen}
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
          {m.clue && <p className='absolute right-3 top-3 text-lg'>🧩</p>}

          <h3 className='font-syneExtrabold text-gradient mb-4 text-center text-3xl'>
            umamin
          </h3>

          <div className='send chat-p dark:bg-secondary-100 dark:before:bg-secondary-100 dark:after:bg-secondary-200 flex max-w-full items-center space-x-3 bg-gray-200 px-6 py-4 font-medium before:bg-gray-200 after:bg-gray-300'>
            <p className='reply text-secondary-400'>{m.receiverMsg}</p>
          </div>
          <p className='text-secondary-400 text-sm font-medium italic'>
            {formatDistanceToNow(new Date(m.createdAt), {
              addSuffix: true,
            })}
          </p>
        </button>
      ))}
    </InboxTabContainer>
  );
};
