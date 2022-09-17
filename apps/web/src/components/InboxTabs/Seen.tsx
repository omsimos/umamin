import React, { useState } from 'react';
import { useQuery } from 'react-query';

import { SeenCard } from '.';
import { getSeenMessages } from '@/api';
import { InboxTabContainer } from './Container';
import { useInbox } from '@/contexts/InboxContext';

export const Seen = () => {
  const [pageNo, setPageNo] = useState(1);
  const [cursorId, setCursorId] = useState('');

  const { user } = useInbox();
  const queryArgs = { userId: user?.id ?? '', cursorId };

  const {
    data: messages,
    isLoading,
    refetch,
  } = useQuery(['seen_messages', queryArgs], () => getSeenMessages(queryArgs), {
    select: (data) => data.getSeenMessages,
  });

  return (
    <InboxTabContainer
      pageNo={pageNo}
      cursorId={cursorId}
      messages={messages}
      isLoading={isLoading}
      setPageNo={setPageNo}
      setCursorId={setCursorId}
    >
      {messages?.map((m) => (
        <SeenCard key={m.id} refetch={refetch} message={m} />
      ))}
    </InboxTabContainer>
  );
};
