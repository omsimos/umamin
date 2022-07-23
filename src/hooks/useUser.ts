import { useQuery } from 'react-query';
import { getUser } from '@/api';

export const useUser = (username: string) => {
  const queryData = useQuery(
    ['user', { username }],
    () => getUser({ username }),
    {
      select: (data) => data.user,
    }
  );

  return { ...queryData };
};
