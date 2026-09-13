import { Text, View } from 'react-native';
import { config } from '../constants/config';
import { useSegments } from 'expo-router';
export function DemoNotice() {
  const segments = useSegments();
  if (!config.demoMode || segments[0] === '(auth)') return null;
  return <View style={{ padding: 10, backgroundColor: '#fef3c7' }}><Text style={{ fontWeight: '700' }}>DEMO — local sample data, no database or live trackers</Text><Text>Sign in: gaurav@gmail.com / 123456. Demo sessions reset when the app reloads.</Text></View>;
}
