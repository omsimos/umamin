import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { RootStack } from './pages/types';
import { Login, Home } from './pages';

export default function App() {
  return (
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
  );
}
