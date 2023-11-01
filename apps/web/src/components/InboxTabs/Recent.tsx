import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getMessages } from '@/api';
import { useInboxContext } from '@/contexts/InboxContext';

import { MessageCard } from '.';
import { InboxTabContainer } from './Container';

export const Recent = () => {
  const { user } = useInboxContext();
  const [pageNo, setPageNo] = useState(1);
  const [cursorId, setCursorId] = useState('');

  const queryArgs = { userId: user?.id ?? '', cursorId };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['seen_messages', queryArgs],
    queryFn: () => getMessages(queryArgs),
    select: (_data) => _data.getMessages,
  });

  return (
    <InboxTabContainer
      pageNo={pageNo}
      cursorId={cursorId}
      messages={data}
      isLoading={isLoading}
      setPageNo={setPageNo}
      setCursorId={setCursorId}
    >
      <div>
        {data?.map((m) => (
          <MessageCard key={m.id} refetch={refetch} message={m} />
        ))}
      </div>
    </InboxTabContainer>
  );
};
