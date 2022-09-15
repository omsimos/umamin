import React, { useContext, createContext, useMemo } from 'react';
import { GetUserQuery } from '@umamin/generated';
import { useSession } from 'next-auth/react';
import { useUser } from '@/hooks';

interface Values {
  user: GetUserQuery['user'];
  isUserLoading: boolean;
  refetchUser: () => void;
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

  const values: Values = useMemo(
    () => ({ user: data, isUserLoading: isLoading, refetchUser: refetch }),
    [data, isLoading, refetch]
  );
  return (
    <InboxContext.Provider value={values}>{children}</InboxContext.Provider>
  );
};
