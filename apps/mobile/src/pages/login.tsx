import { useState } from 'react';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { Layout } from '../components';

export const Login = ({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Login'>) => {
  const [username, setUsername] = useState('joogie');

  return (
    <Layout className='justify-center'>
      <Text className='w-full text-2xl font-bold text-white'>
        Receive confessions & messages{' '}
        <Text className='text-primary-100'>anonymously!</Text>
      </Text>

      <TextInput
        value={username}
        onChangeText={setUsername}
        className='border-primary-100 mt-6 rounded border px-4 py-2 text-white'
      />

      <TouchableOpacity
        className='bg-primary-100 mt-2 self-start rounded px-4 py-2'
        onPress={() => navigation.push('Home', { username })}
      >
        <Text className='text-white'>Get your message 👉</Text>
      </TouchableOpacity>
    </Layout>
  );
};
