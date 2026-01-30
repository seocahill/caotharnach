import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IslandListScreen } from './src/screens/IslandListScreen';
import { CreateIslandScreen } from './src/screens/CreateIslandScreen';
import { StudyIslandScreen } from './src/screens/StudyIslandScreen';
import { AboutScreen } from './src/screens/AboutScreen';
import { Island } from './src/types/island';

export type RootStackParamList = {
  IslandList: undefined;
  CreateIsland: undefined;
  StudyIsland: { island: Island };
  About: undefined;
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
            options={({ navigation }) => ({
              title: 'Oileáin',
              headerRight: () => (
                <TouchableOpacity onPress={() => navigation.navigate('About')}>
                  <Ionicons name="information-circle-outline" size={28} color="#fff" />
                </TouchableOpacity>
              ),
            })}
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
          <Stack.Screen
            name="About"
            component={AboutScreen}
            options={{ title: 'Faisnéis' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
