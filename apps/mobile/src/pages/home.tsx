import { Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { Layout } from '../components';

export const Home = ({
  route,
}: NativeStackScreenProps<RootStackParamList, 'Home'>) => {
  const { name } = route.params;

  return (
    <Layout className='items-center justify-center'>
      <Text className='text-lg text-white'>
        Hello {name} from{' '}
        <Text className='text-primary-200 font-bold'>Umamin!</Text>
      </Text>
    </Layout>
  );
};
