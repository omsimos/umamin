import React from 'react';
import { getSentMessages } from '@/api';
import { useInfiniteQuery } from '@tanstack/react-query';

import { Container } from '@/components/Utils';
import { useInboxContext } from '@/contexts/InboxContext';

import { InboxTabContainer } from './Container';
import { SentMessageCard } from './SentMessageCard';

export const Sent = () => {
  const { user } = useInboxContext();

  const { data, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['sent_messages'],
    queryFn: ({ pageParam }) => getSentMessages({ cursorId: pageParam }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.getSentMessages?.cursorId,
    select: (data) => data.pages.flatMap((page) => page.getSentMessages?.data),
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
