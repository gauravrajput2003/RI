import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { logout } from '../../services/api/auth';
export default function Profile() {
  const [error, setError] = useState(false);
  const signOut = async () => {
    try { await logout(); }
    catch { setError(true); return; }
    router.replace('/(auth)/login');
  };
  return <View style={styles.page}><Text style={styles.title}>Profile</Text>
    <Text>Profile data is not available from the current backend API.</Text>
    {error ? <Text>Could not remove saved credentials. Retry signing out before closing the app.</Text> : null}
    <Pressable accessibilityRole="button" onPress={signOut} style={styles.button}><Text style={styles.buttonText}>Sign out</Text></Pressable></View>;
}
const styles = StyleSheet.create({ page: { flex: 1, padding: 20, gap: 20, backgroundColor: '#f8fafc' }, title: { fontSize: 26, fontWeight: '800' }, button: { backgroundColor: '#b91c1c', padding: 14, borderRadius: 10, alignItems: 'center' }, buttonText: { color: '#fff', fontWeight: '800' } });
