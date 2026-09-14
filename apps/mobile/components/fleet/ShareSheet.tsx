import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Sheet } from './Sheet';

export const shareDurations = [
  { label: '15 Minutes', duration: '15 minutes' },
  { label: '30 Minutes', duration: '30 minutes' },
  { label: '1 Hour', duration: '1 hour' },
  { label: '4 Hours', duration: '4 hours' },
  { label: '1 Day', duration: '1 day' },
] as const;

export function ShareSheet({ vehicleNumber, onClose }: { vehicleNumber: string | null; onClose(): void }) {
  const onSelect = async (duration: string) => {
    onClose();
    if (!vehicleNumber) return;
    try {
      await Share.share({
        title: `Vehicle ${vehicleNumber} Share`,
        message: `Sharing vehicle ${vehicleNumber} tracking for ${duration}. Note: Live tracking link is currently unavailable as the share-token service is not configured.`,
      });
    } catch {
      // Handled if share sheet is dismissed or unsupported
    }
  };

  return (
    <Sheet visible={Boolean(vehicleNumber)} onClose={onClose} title="Share Vehicle">
      <View style={styles.container}>
        <Text style={styles.subtitle}>Select duration to share tracking for {vehicleNumber}:</Text>
        {shareDurations.map(item => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={`Share for ${item.label}`}
            onPress={() => void onSelect(item.duration)}
            style={styles.row}
          >
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="clock-outline" size={20} color="#0f766e" />
            </View>
            <Text style={styles.label}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    gap: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    marginBottom: 6,
    gap: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e6f4f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
  },
});
