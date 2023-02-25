import React, { useState } from 'react';
import { SeenMessage } from '@umamin/generated';
import { useInboxContext } from '@/contexts/InboxContext';

import { SeenCard } from '.';
import { MessageDialog } from '../Dialog';
import { InboxTabContainer } from './Container';

export const Seen = () => {
  const [pageNo, setPageNo] = useState(1);
  const [msgModal, setMsgModal] = useState(false);
  const [messageData, setMessageData] = useState({} as SeenMessage);

  const { seenData, isSeenLoading, cursorId, setCursorId } = useInboxContext();

  return (
    <InboxTabContainer
      pageNo={pageNo}
      cursorId={cursorId}
      messages={seenData}
      isLoading={isSeenLoading}
      setPageNo={setPageNo}
      setCursorId={setCursorId}
    >
      <MessageDialog
        data={messageData}
        isOpen={msgModal}
        setIsOpen={setMsgModal}
      />
      <div>
        {seenData?.map((m) => (
          <button
            key={m.id}
            type='button'
            className='w-full text-left'
            onClick={() => {
              setMessageData(m);
              setMsgModal(true);
            }}
          >
            <SeenCard message={m} />
          </button>
        ))}
      </div>
    </InboxTabContainer>
  );
};
