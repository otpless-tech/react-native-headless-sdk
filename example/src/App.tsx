import React from 'react';
import { View, StatusBar, SafeAreaView, Platform } from 'react-native';
import HeadlessScreen from './HeadlessScreen';

const App = () => {
  return Platform.OS === 'ios' ? (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1 }}>
        <HeadlessScreen />
      </View>
    </SafeAreaView>
  ) : (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar barStyle="light-content" />
      <HeadlessScreen />
    </View>
  );
};

export default App;
