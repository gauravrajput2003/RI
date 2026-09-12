import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
export default function LiveMapWeb() {
  return <View style={{ flex: 1, padding: 24, gap: 12, backgroundColor: '#f8fafc' }}>
    <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '700' }}>Map available on Android and iOS</Text>
    <Text>The interactive map uses a native map component. Open the app on your phone to view it. Vehicle data is available in the Vehicles tab of this web preview.</Text>
    <Pressable accessibilityRole="button" onPress={() => router.push('/(app)/vehicles')}><Text style={{ color: '#0f766e', fontWeight: '700' }}>View vehicles</Text></Pressable>
  </View>;
}
