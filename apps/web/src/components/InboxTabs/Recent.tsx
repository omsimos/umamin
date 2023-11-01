import React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { getMessages } from '@/api';
import { useInboxContext } from '@/contexts/InboxContext';

import { MessageCard } from '.';
import { InboxTabContainer } from './Container';

export const Recent = () => {
  const { user } = useInboxContext();

  const { data, isLoading, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['recent_messages'],
      queryFn: ({ pageParam }) => getMessages({ cursorId: pageParam }),
      initialPageParam: '',
      getNextPageParam: (lastPage) => lastPage.getMessages?.cursorId,
      select: (data) => data.pages.flatMap((page) => page.getMessages?.data),
      enabled: !!user?.id,
    });

  return (
    <InboxTabContainer
      messages={data}
      isLoading={isLoading}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
    >
      <div>
        {data?.map((m) => (
          <MessageCard key={m?.id} refetch={refetch} message={m!} />
        ))}
      </div>
    </InboxTabContainer>
  );
};
