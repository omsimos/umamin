import { useQuery } from 'react-query';
import { getUser } from '@/api';

export const useUser = (
  key: string,
  user: string,
  type: 'email' | 'username'
) => {
  const { data, isLoading, refetch } = useQuery(
    [key, { user, type }],
    () => getUser({ user, type }),
    {
      select: (data) => data.user,
    }
  );

  return { data, isLoading, refetch };
};
