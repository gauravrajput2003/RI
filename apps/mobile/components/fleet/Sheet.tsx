import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
export function Sheet({ visible, onClose, children, title }: { visible: boolean; onClose(): void; children: ReactNode; title?: string }) {
  const insets = useSafeAreaInsets();
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <View style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss sheet" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {title ? <Text accessibilityRole="header" style={styles.title}>{title}</Text> : null}{children}
      </View>
    </View>
  </Modal>;
}
export function NoticeSheet({ message, onClose }: { message: string | null; onClose(): void }) {
  return <Sheet visible={Boolean(message)} onClose={onClose} title="Preview"><Text style={styles.message}>{message}</Text><Pressable accessibilityRole="button" onPress={onClose} style={styles.close}><Text>Close</Text></Pressable></Sheet>;
}
const styles = StyleSheet.create({ overlay: { flex: 1, backgroundColor: '#0006', justifyContent: 'flex-end', alignItems: 'center' }, sheet: { width: '100%', maxWidth: 520, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: '#fff', paddingTop: 14, paddingHorizontal: 14 }, title: { fontSize: 19, fontWeight: '700', textAlign: 'center', marginBottom: 16 }, message: { fontSize: 15, lineHeight: 22, padding: 8 }, close: { alignItems: 'center', padding: 14, backgroundColor: '#f4f4f4', borderRadius: 8, marginTop: 12 } });
