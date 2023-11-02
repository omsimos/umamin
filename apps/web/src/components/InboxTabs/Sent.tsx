import React from 'react';
import { getMessages } from '@/api';
import { useInfiniteQuery } from '@tanstack/react-query';

import { Container } from '@/components/Utils';
import { useInboxContext } from '@/contexts/InboxContext';

import { InboxTabContainer } from './Container';
import { SentMessageCard } from './SentMessageCard';

export const Sent = () => {
  const { user } = useInboxContext();

  const { data, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['sent_messages', { type: 'sent' }],
    queryFn: ({ pageParam }) =>
      getMessages({ cursorId: pageParam, type: 'sent' }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.getMessages?.cursorId,
    select: (data) => data.pages.flatMap((page) => page.getMessages?.data),
    enabled: !!user?.id,
  });

  return (
    <InboxTabContainer
      tab='sent'
      messages={data}
      isLoading={isLoading}
      hasNextPage={hasNextPage}
      fetchNextPage={fetchNextPage}
    >
      <Container className='space-y-6'>
        {data?.map((m) => (
          <SentMessageCard key={m?.id} data={m!} />
        ))}
      </Container>
    </InboxTabContainer>
  );
};
