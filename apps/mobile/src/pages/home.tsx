import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { Layout } from '../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const Home = ({
  route,
}: NativeStackScreenProps<RootStackParamList, 'Home'>) => {
  const { bottom } = useSafeAreaInsets();
  const { username } = route.params;

  const userUrl = `umamin.link/${username}`;

  return (
    <Layout>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'space-between',
          flexDirection: 'column',
        }}
        style={{ paddingBottom: 100 }}
        className='flex-1 px-6 pt-6 flex-grow'
      >
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Copied to clipboard');
          }}
          className='bg-secondary-200 border-primary-100 rounded p-4 border-2'
        >
          <Text className='text-primary-100'>{userUrl}</Text>
        </TouchableOpacity>

        <View className='my-5 flex flex-col'>
          <Text className='text-white font-medium'>Latest messages</Text>
          <View className='mt-1 flex flex-row items-center space-x-1 text-sm'>
            <View className='bg-primary-100 h-4 w-4 flex items-center justify-center rounded-full'>
              <Text className='italic text-black text-xs'>i</Text>
            </View>
            <Text className='text-[#f0f0f0] '>
              Tap a card to reveal an anonymous message.
            </Text>
          </View>
        </View>

        <View className='flex flex-1 flex-col'>
          {Array(10)
            .fill(0)
            .map((_, i) => (
              <MessageCard key={`message-${i}`} />
            ))}
        </View>

        {/* Spacer */}
        <View className='h-20' />
      </ScrollView>
    </Layout>
  );
};

const MessageCard = () => {
  return (
    <TouchableOpacity className='mb-4 border-secondary-100 bg-secondary-200 rounded-2xl border-2 px-6 py-3'>
      <Text className='text-primary-100 text-3xl text-center w-full italic font-bold'>
        umamin
      </Text>

      <View className='mt-2 bg-secondary-100 rounded-full flex max-w-full items-center space-x-3 px-6 py-4 font-medium'>
        <Text className='reply text-secondary-400'>
          Send me an anonymouse message
        </Text>
      </View>

      <View className='mt-2 flex flex-row items-center justify-between'>
        <Text className='text-secondary-400 text-xs italic'>
          17 minutes ago
        </Text>
        <Text className='text-secondary-400 text-xs italic'>Seen ✔</Text>
      </View>
    </TouchableOpacity>
  );
};
