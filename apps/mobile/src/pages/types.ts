import { createNativeStackNavigator } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Home: { username: string };
  Login: undefined;
};

export const RootStack = createNativeStackNavigator<RootStackParamList>();
