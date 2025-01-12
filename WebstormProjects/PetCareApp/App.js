import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text } from 'react-native';
import { Home, Heart, User, Bell } from 'lucide-react-native';
import { HomeScreen } from './screens/HomeScreen';
import { VetScreen } from './screens/VetScreen';
import { PetsScreen } from './screens/PetsScreen';
import { AlertsScreen } from './screens/AlertsScreen';

const Tab = createBottomTabNavigator();


export default function App() {
  return (
      <NavigationContainer>
        <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({ color, size }) => {
                if (route.name === 'Home') {
                  return <Home size={size} color={color} />;
                } else if (route.name === 'Pets') {
                  return <Heart size={size} color={color} />;
                } else if (route.name === 'Vet') {
                  return <User size={size} color={color} />;
                } else if (route.name === 'Alerts') {
                  return <Bell size={size} color={color} />;
                }
              },
              tabBarActiveTintColor: '#3b82f6',
              tabBarInactiveTintColor: 'gray',
            })}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Pets" component={PetsScreen} />
          <Tab.Screen name="Vet" component={VetScreen} />
          <Tab.Screen name="Alerts" component={AlertsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
  );
}