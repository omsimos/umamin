import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import type { Message } from '@umamin/generated';
import { formatDistanceToNow } from 'date-fns';
import { useSession } from 'next-auth/react';
import Image from 'next/image';

import { useLogEvent, useUser } from '@/hooks';
import { editMessage, getRecentMessages } from '@/api';
import { MessageDialog } from '@/components/Dialog';
import { InboxTabContainer } from './Container';

export const Recent = () => {
  const triggerEvent = useLogEvent();

  const [pageNo, setPageNo] = useState(1);
  const [cursorId, setCursorId] = useState('');
  const [msgModal, setMsgModal] = useState(false);
  const [messageData, setMessageData] = useState({} as Partial<Message>);

  const { data } = useSession();
  const queryClient = useQueryClient();

  const { email } = data?.user ?? {};
  const { data: userData } = useUser(email ?? '', 'email');
  const { username } = userData ?? {};
  const queryArgs = { userId: userData?.id ?? '', cursorId };

  const {
    data: messages,
    refetch,
    isLoading,
  } = useQuery(['messages', queryArgs], () => getRecentMessages(queryArgs), {
    select: (data) => data.getMessages,
    enabled: !!userData?.id,
  });

  const { mutate } = useMutation(editMessage);

  const handleOpen = (data: Partial<Message>) => {
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
            queryClient.invalidateQueries([
              'messages',
              { userId: userData?.id ?? '', cursorId: '', type: 'seen' },
            ]);

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
        username={username ?? ''}
        data={messageData}
        isOpen={msgModal}
        setIsOpen={setMsgModal}
      />

      {messages?.map((m) => (
        <button
          type='button'
          key={m.id}
          onClick={() => handleOpen(m)}
          className='msg-card hide-tap-highlight w-full cursor-pointer scroll-mt-6 overflow-hidden text-left'
        >
          <div className='relative mb-3 h-[40px]'>
            <Image src='/assets/logo.svg' layout='fill' objectFit='contain' />
          </div>

          <div className='send chat-p bg-secondary-100 before:bg-secondary-100 after:bg-secondary-200 flex max-w-full items-center space-x-3 px-6 py-4 font-medium'>
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
