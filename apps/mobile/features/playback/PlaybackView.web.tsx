import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

export default function PlaybackViewWeb() {
  return (
    <View style={{ flex: 1, padding: 24, gap: 12, backgroundColor: '#f8fafc' }}>
      <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '700' }}>
        Playback Map available on Android and iOS
      </Text>
      <Text>
        The interactive route playback map uses a native map component. Open the app on your phone to view route history and tracking.
      </Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/(app)')}>
        <Text style={{ color: '#0f766e', fontWeight: '700' }}>Back to Dashboard</Text>
      </Pressable>
    </View>
  );
}
