import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sheet } from './Sheet';
export const bikeActions = [
  ['Live Map','📍'], ['Play Back','▶️'], ['Share','🟢'], ['Notification','🔔'],
  ['Report','📋'], ['NearBy','📍'], ['Parking','🚙'], ['Street View','🧍'],
  ['Lock','🔒'], ['Driver','👨‍✈️'],
] as const;
export type BikeAction = typeof bikeActions[number][0];
export function BikeActions({ vehicle, onClose, onAction }: { vehicle: string | null; onClose(): void; onAction(action: BikeAction): void }) {
  return <Sheet visible={Boolean(vehicle)} onClose={onClose}><View style={styles.grid}>
    {bikeActions.map(([label, icon]) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => onAction(label)} style={styles.action}><Text style={styles.icon}>{icon}</Text><Text style={styles.label}>{label}</Text></Pressable>)}
  </View></Sheet>;
}
const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 1 }, action: { width: '25%', minHeight: 48, alignItems: 'center', justifyContent: 'flex-start', paddingBottom: 6 }, icon: { fontSize: 21, lineHeight: 25 }, label: { fontSize: 13, color: '#111', lineHeight: 18 } });
