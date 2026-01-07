import React, {useEffect} from 'react';
import { View, StatusBar, SafeAreaView, Platform } from 'react-native';
import HeadlessScreen from './HeadlessScreen';
import { OtplessHeadlessModule } from 'otpless-headless-rn';

export const otplessHeadlessModule = new OtplessHeadlessModule()

const App = () => {

  useEffect(() => {    
    const creds = {
      'clientId': "otpless-di-poc",
      "clientSecret": "secret-8452d883-b923-47b3-b773-7be41cf2147b",
      "appId": "UKFVE9VSC1UDAUANZFL3"
    }
    otplessHeadlessModule.initIntelligence(creds)
    return () => {
    };
  }, []);

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
