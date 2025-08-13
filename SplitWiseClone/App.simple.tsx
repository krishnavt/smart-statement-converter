import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PaperProvider, Button } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider>
        <View style={styles.container}>
          <Text style={styles.title}>SplitWise Clone</Text>
          <Text style={styles.subtitle}>Expense splitting made easy</Text>
          <Button mode="contained" style={styles.button}>
            Get Started
          </Button>
        </View>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6200EE',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: 32,
  },
});