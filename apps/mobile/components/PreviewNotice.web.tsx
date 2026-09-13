import { Text, View } from 'react-native';
import { useSegments } from 'expo-router';
export function PreviewNotice() {
  const segments = useSegments();
  if (segments[0] === '(auth)' || segments[0] === '(app)') return null;
  return <View style={{ padding: 8, backgroundColor: '#e0f2fe' }}><Text>Web preview: sign-in and cached data last only for this page session. The interactive map is available on Android/iOS.</Text></View>;
}
