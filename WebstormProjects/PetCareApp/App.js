import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, Heart, User, Bell } from "lucide-react-native";
import { HomeScreen } from "./screens/HomeScreen";
import { PetsScreen } from "./screens/PetsScreen";
import { VetScreen } from "./screens/VetScreen";
import { AlertsScreen } from "./screens/AlertsScreen";
import { PetProvider } from "./context/PetContext";

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <PetProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ color, size }) => {
              if (route.name === "Home") {
                return <Home size={size} color={color} />;
              } else if (route.name === "Pets") {
                return <Heart size={size} color={color} />;
              } else if (route.name === "Vet") {
                return <User size={size} color={color} />;
              } else if (route.name === "Alerts") {
                return <Bell size={size} color={color} />;
              }
            },
            tabBarActiveTintColor: "#3b82f6",
            tabBarInactiveTintColor: "gray",
          })}
        >
          <Tab.Screen 
            name="Home" 
            component={HomeScreen}
            options={{ title: "Pet Dashboard" }}
          />
          <Tab.Screen 
            name="Pets" 
            component={PetsScreen}
            options={{ title: "My Pets" }}
          />
          <Tab.Screen 
            name="Vet" 
            component={VetScreen}
            options={{ title: "Veterinarian" }}
          />
          <Tab.Screen 
            name="Alerts" 
            component={AlertsScreen}
            options={{ title: "Notifications" }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </PetProvider>
  );
}
