import { Pressable, Text, View } from 'react-native';
import { useAuthStore } from '../store/authStore';
export function CredentialWarning() {
  const failed = useAuthStore(state => state.storageError);
  if (!failed) return null;
  return <View style={{ padding: 12, backgroundColor: '#fee2e2' }}><Text>Secure credential storage failed. Retry clearing saved credentials before closing this app.</Text>
    <Pressable accessibilityRole="button" onPress={() => { void useAuthStore.getState().setTokens(null).catch(() => undefined); }}><Text>Clear saved credentials</Text></Pressable></View>;
}
