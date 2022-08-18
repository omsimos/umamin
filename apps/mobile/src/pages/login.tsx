import { Button, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { Layout } from '../components';

export const Login = ({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Login'>) => {
  return (
    <Layout className='items-center justify-center flex-row'>
      <Text className='text-lg text-white'>Welcome 👋</Text>
      <Button
        onPress={() => navigation.push('Home', { name: 'user' })}
        title='Login'
      />
    </Layout>
  );
};
