import { useQuery } from '@tanstack/react-query';
import { getUser } from '@/api';

export const useUser = (key: string, user: string, type: 'id' | 'username') => {
  const { data, isLoading, refetch } = useQuery({
    queryKey: [key, { user, type }],
    queryFn: () => getUser({ user, type }),
    select: (data) => data.getUser,
    enabled: !!user,
  });

  return { data, isLoading, refetch };
};
