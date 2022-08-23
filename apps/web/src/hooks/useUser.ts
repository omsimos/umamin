import { useQuery } from 'react-query';
import { getUser } from '@/api';

export const useUser = (
  user: string,
  type: 'email' | 'username' = 'username'
) => {
  const queryData = useQuery(
    ['user', { user, type }],
    () => getUser({ user, type }),
    {
      select: (data) => data.user,
      enabled: !!user,
    }
  );

  return { ...queryData };
};
