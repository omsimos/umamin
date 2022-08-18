import { Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from 'react-query';
import { RootStackParamList } from './types';
import { Layout } from '../components';
import { getUser } from '../api';

export const Home = ({
  route,
}: NativeStackScreenProps<RootStackParamList, 'Home'>) => {
  const { username } = route.params;
  const user = useQuery(['user', { username }], () => getUser({ username }));
  const isLoading = user.isLoading || user.isFetching || user.isRefetching;

  return (
    <Layout className='justify-center'>
      <Text className='text-lg text-white'>
        Hello {username} from{' '}
        <Text className='text-primary-200 font-bold'>Umamin!</Text>
      </Text>

      <Text className='text-white'>
        <Text>Your Message: </Text>
        {isLoading ? (
          <Text>Loading...</Text>
        ) : user.isError ? (
          <Text>Error</Text>
        ) : user.data ? (
          <Text>{user.data.user?.message}</Text>
        ) : (
          <Text>No data</Text>
        )}
      </Text>
    </Layout>
  );
};
