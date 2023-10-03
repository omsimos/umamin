import { getManyMessages } from '@/api';
import { useUser } from '@/hooks';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import React, { useState } from 'react';
import { InboxTabContainer, SeenCard } from './InboxTabs';

export const ManyMessages = () => {
  const [pageNo, setPageNo] = useState(1);

  const { data: session } = useSession();
  const { data: user } = useUser('inbox_user', session?.user?.id ?? '', 'id');

  const [cursorId, setCursorId] = useState('');
  const queryArgs = { userId: user?.id ?? '', cursorId };

  const {
    data: seenData,
    isLoading,
    refetch: refetchSeen,
  } = useQuery(
    ['many_messages', { userId: user?.id ?? '', cursorId }],
    () => getManyMessages(queryArgs),
    {
      select: (data) => data.getManyMessages,
    }
  );

  return (
    <InboxTabContainer
      isMany
      pageNo={pageNo}
      cursorId={cursorId}
      messages={seenData}
      isLoading={isLoading}
      setPageNo={setPageNo}
      setCursorId={setCursorId}
    >
      <div className='grid grid-cols-3 max-w-screen-2xl mx-auto w-full'>
        {seenData?.map((m) => (
          <SeenCard key={m.id} refetch={refetchSeen} message={m} />
        ))}
      </div>
    </InboxTabContainer>
  );
};
