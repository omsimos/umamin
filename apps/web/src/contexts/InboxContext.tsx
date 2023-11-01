import React, { useContext, createContext, useMemo } from 'react';
import type { User } from '@umamin/generated';
import { useSession } from 'next-auth/react';

import { useUser } from '@/hooks';

interface Values {
  user?: User | null;
  isUserLoading: boolean;
  refetchUser: () => void;
}

const InboxContext = createContext({} as Values);

export const useInboxContext = () => {
  return useContext(InboxContext);
};

export const InboxProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: session } = useSession();
  const {
    data: user,
    isLoading,
    refetch,
  } = useUser('inbox_user', session?.user?.id ?? '', 'id');

  const values: Values = useMemo(
    () => ({
      user,
      isUserLoading: isLoading,
      refetchUser: refetch,
    }),
    [user, isLoading, refetch]
  );
  return (
    <InboxContext.Provider value={values}>{children}</InboxContext.Provider>
  );
};
