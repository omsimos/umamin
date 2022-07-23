import { useQuery } from 'react-query';
import { getUser } from '@/api';

export const useUser = (username: string) => {
  const { data } = useQuery(['user', { username }], () =>
    getUser({ username })
  );

  return data?.user;
};
