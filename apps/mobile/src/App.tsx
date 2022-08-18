import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from 'react-query';
import { RootStack } from './pages/types';
import { Login, Home } from './pages';
import { queryClient } from './api';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style='light' />

          <RootStack.Navigator
            screenOptions={{ headerShown: false }}
            initialRouteName='Login'
          >
            <RootStack.Screen name='Login' component={Login} />
            <RootStack.Screen name='Home' component={Home} />
          </RootStack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
