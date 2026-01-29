import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { IslandListScreen } from './src/screens/IslandListScreen';
import { CreateIslandScreen } from './src/screens/CreateIslandScreen';
import { StudyIslandScreen } from './src/screens/StudyIslandScreen';
import { Island } from './src/types/island';

export type RootStackParamList = {
  IslandList: undefined;
  CreateIsland: undefined;
  StudyIsland: { island: Island };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="IslandList"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#1a5f2a',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen
            name="IslandList"
            component={IslandListScreen}
            options={{ title: 'Oileáin' }}
          />
          <Stack.Screen
            name="CreateIsland"
            component={CreateIslandScreen}
            options={{ title: 'Oileán Nua' }}
          />
          <Stack.Screen
            name="StudyIsland"
            component={StudyIslandScreen}
            options={({ route }) => ({
              title: route.params.island.title
            })}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
