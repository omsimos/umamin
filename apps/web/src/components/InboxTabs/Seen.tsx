import React, { useState } from 'react';
import { SeenCard } from '.';
import { InboxTabContainer } from './Container';
import { useInbox } from '@/contexts/InboxContext';

export const Seen = () => {
  const [pageNo, setPageNo] = useState(1);

  const { seenData, isSeenLoading, refetchSeen, cursorId, setCursorId } =
    useInbox();

  return (
    <InboxTabContainer
      pageNo={pageNo}
      cursorId={cursorId}
      messages={seenData}
      isLoading={isSeenLoading}
      setPageNo={setPageNo}
      setCursorId={setCursorId}
    >
      {seenData?.map((m) => (
        <SeenCard key={m.id} refetch={refetchSeen} message={m} />
      ))}
    </InboxTabContainer>
  );
};
