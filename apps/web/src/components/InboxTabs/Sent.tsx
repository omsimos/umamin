import React, { useState } from 'react';
import { getSentMessages } from '@/api';
import { useQuery } from '@tanstack/react-query';

import { Container } from '@/components/Utils';
import { useInboxContext } from '@/contexts/InboxContext';

import { InboxTabContainer } from './Container';
import { SentMessageCard } from './SentMessageCard';

export const Sent = () => {
  const [pageNo, setPageNo] = useState(1);
  const [cursorId, setCursorId] = useState('');

  const { user } = useInboxContext();
  const queryArgs = { userId: user?.id ?? '', cursorId };

  const { data: messages, isLoading } = useQuery({
    queryKey: ['sent_messages', queryArgs],
    queryFn: () => getSentMessages(queryArgs),
    select: (data) => data.getSentMessages,
    enabled: !!user?.id,
  });

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
      <Container className='space-y-6'>
        {messages?.map((m) => (
          <SentMessageCard key={m.id} data={m} />
        ))}
      </Container>
    </InboxTabContainer>
  );
};
