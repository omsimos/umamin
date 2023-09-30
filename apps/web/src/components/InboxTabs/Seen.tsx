import React, { useState } from 'react';
import { useInboxContext } from '@/contexts/InboxContext';

import { SeenCard } from '.';
import { InboxTabContainer } from './Container';

export const Seen = () => {
  const [pageNo, setPageNo] = useState(1);

  const { seenData, refetchSeen, isSeenLoading, cursorId, setCursorId } =
    useInboxContext();

  return (
    <InboxTabContainer
      pageNo={pageNo}
      cursorId={cursorId}
      messages={seenData}
      isLoading={isSeenLoading}
      setPageNo={setPageNo}
      setCursorId={setCursorId}
    >
      <div>
        {seenData?.map((m) => (
          <SeenCard key={m.id} refetch={refetchSeen} message={m} />
        ))}
      </div>
    </InboxTabContainer>
  );
};
