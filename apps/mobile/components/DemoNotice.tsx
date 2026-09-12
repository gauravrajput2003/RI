import { Text, View } from 'react-native';
import { config } from '../constants/config';
export function DemoNotice() {
  if (!config.demoMode) return null;
  return <View style={{ padding: 10, backgroundColor: '#fef3c7' }}><Text style={{ fontWeight: '700' }}>DEMO — local sample data, no database or live trackers</Text><Text>Sign in: gaurav@gmail.com / 123456. Demo sessions reset when the app reloads.</Text></View>;
}
