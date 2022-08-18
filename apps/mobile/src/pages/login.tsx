import { Text, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { Layout } from '../components';

export const Login = ({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Login'>) => {
  return (
    <Layout className='justify-center'>
      <Text className='w-full text-2xl font-bold text-white'>
        Receive confessions & messages{' '}
        <Text className='text-primary-100'>anonymously!</Text>
      </Text>

      <TouchableOpacity
        className="bg-primary-100 mt-4 px-4 py-2 rounded self-start"
        onPress={() => navigation.push('Home', { name: 'user' })}
      >
        <Text className='text-white'>Create your link</Text>
      </TouchableOpacity>
    </Layout>
  );
};
