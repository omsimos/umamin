import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaView className='flex-1 items-center justify-center'>
      <StatusBar style='auto' />

      <Text className='text-lg'>
        Hello World from{' '}
        <Text className='text-primary-200 font-bold'>Umamin!</Text>
      </Text>
    </SafeAreaView>
  );
}
