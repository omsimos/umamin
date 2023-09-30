import React, { useState } from 'react';
import { getSentMessages } from '@/api';
import { useQuery } from '@tanstack/react-query';

import { Container } from '@/components/Utils';
import { useInboxContext } from '@/contexts/InboxContext';

import { SentCard } from './SentCard';
import { InboxTabContainer } from './Container';

export const Sent = () => {
  const [pageNo, setPageNo] = useState(1);
  const [cursorId, setCursorId] = useState('');

  const { user } = useInboxContext();
  const queryArgs = { userId: user?.id ?? '', cursorId };

  const { data: messages, isLoading } = useQuery(
    ['sent_messages', queryArgs],
    () => getSentMessages(queryArgs),
    { select: (data) => data.getSentMessages, enabled: !!user?.id }
  );

  return (
    <InboxTabContainer
      tab='sent'
      pageNo={pageNo}
      cursorId={cursorId}
      messages={messages}
      isLoading={isLoading}
      setPageNo={setPageNo}
      setCursorId={setCursorId}
    >
      <Container className='space-y-4'>
        {messages?.map((m) => (
          <SentCard key={m.id} data={m} />
        ))}
      </Container>
    </InboxTabContainer>
  );
};
