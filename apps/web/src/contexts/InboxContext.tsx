import React, { useContext, createContext, useMemo, useState } from 'react';
import { GetUserQuery, SeenMessage } from '@umamin/generated';
import { useSession } from 'next-auth/react';
import { useQuery } from 'react-query';
import { useUser } from '@/hooks';
import { getSeenMessages } from '@/api';

interface Values {
  user: GetUserQuery['user'];
  isUserLoading: boolean;
  refetchUser: () => void;
  seenData?: SeenMessage[] | null;
  isSeenLoading: boolean;
  refetchSeen: () => void;
  cursorId: string;
  setCursorId: React.Dispatch<React.SetStateAction<string>>;
}

const InboxContext = createContext({} as Values);

export const useInbox = () => {
  return useContext(InboxContext);
};

export const InboxProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: session } = useSession();
  const { data, isLoading, refetch } = useUser(
    session?.user?.email ?? '',
    'email'
  );

  const [cursorId, setCursorId] = useState('');
  const queryArgs = { userId: data?.id ?? '', cursorId };

  const {
    data: seenData,
    isLoading: isSeenLoading,
    refetch: refetchSeen,
  } = useQuery(
    ['seen_messages', { userId: data?.id ?? '', cursorId }],
    () => getSeenMessages(queryArgs),
    {
      select: (data) => data.getSeenMessages,
    }
  );

  const values: Values = useMemo(
    () => ({
      user: data,
      isUserLoading: isLoading,
      refetchUser: refetch,
      seenData,
      isSeenLoading,
      refetchSeen,
      cursorId,
      setCursorId,
    }),
    [data, isLoading, refetch, seenData, isSeenLoading, refetchSeen, cursorId]
  );
  return (
    <InboxContext.Provider value={values}>{children}</InboxContext.Provider>
  );
};
