import React from 'react';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import LookupScreen from './src/screens/LookupScreen';
import WordOfDayScreen from './src/screens/WordOfDayScreen';
import SavedScreen from './src/screens/SavedScreen';
import FlashcardsScreen from './src/screens/FlashcardsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import PlayScreen from './src/screens/PlayScreen';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

const ICONS: Record<string, string> = {
  Lookup: '🔍',
  Daily: '🌅',
  Saved: '⭐',
  Cards: '🃏',
  Play: '🎮',
  History: '🕘',
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            animation: 'shift',
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.textDim,
            tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 18, color }}>{ICONS[route.name] ?? '•'}</Text>
            ),
          })}
        >
          <Tab.Screen name="Lookup" component={LookupScreen} />
          <Tab.Screen name="Daily" component={WordOfDayScreen} />
          <Tab.Screen name="Saved" component={SavedScreen} />
          <Tab.Screen name="Cards" component={FlashcardsScreen} />
          <Tab.Screen name="Play" component={PlayScreen} />
          <Tab.Screen name="History" component={HistoryScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
