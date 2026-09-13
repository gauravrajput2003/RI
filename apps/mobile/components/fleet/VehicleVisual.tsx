import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export function VehicleVisual({ visual }: { visual: 'scooter' | 'car' | 'bike' }) {
  if (visual === 'scooter') {
    return (
      <View style={styles.container}>
        <View style={[styles.badge, { backgroundColor: '#fee2e2' }]}>
          <MaterialCommunityIcons name="moped" size={42} color="#dc2626" />
        </View>
      </View>
    );
  }

  if (visual === 'car') {
    return (
      <View style={styles.container}>
        <View style={[styles.badge, { backgroundColor: '#fef3c7' }]}>
          <MaterialCommunityIcons name="car-sports" size={40} color="#d97706" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: '#fee2e2' }]}>
        <MaterialCommunityIcons name="motorbike" size={42} color="#dc2626" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 76,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    width: 68,
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
