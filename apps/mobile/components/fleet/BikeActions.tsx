import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sheet } from './Sheet';
import { FontAwesome6 } from '@expo/vector-icons';
import { useAccount } from '../../services/api/mobile';
import { capabilities } from '../../features/account/capabilities';
export const bikeActions = [
  ['Live Map','📍'], ['Play Back','▶️'], ['Edit','📝'], ['Share','🟢'], ['Notification','🔔'],
  ['Report','📋'], ['NearBy','📍'], ['Parking','🚙'], ['Street View','🧍'],
  ['Lock','🔒'], ['Driver','👨‍✈️'],
] as const;
export type BikeAction = typeof bikeActions[number][0];
export function BikeActions({ vehicle, onClose, onAction }: { vehicle: string | null; onClose(): void; onAction(action: BikeAction): void }) {
  const account=useAccount(),caps=capabilities(account.data);
  return <Sheet visible={Boolean(vehicle)} onClose={onClose}><View style={styles.grid}>
    {bikeActions.filter(([label])=>label==='Edit'?caps.editVehicle:label==='Notification'?caps.notifications:label==='Share'?caps.share:true).map(([label, icon]) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => onAction(label)} style={styles.action}>{label==='Edit'||label==='Share'||label==='Notification'?<FontAwesome6 name={label==='Edit'?'file-pen':label==='Share'?'share-nodes':'bell-slash'} size={21} color="#555"/>:<Text style={styles.icon}>{icon}</Text>}<Text style={styles.label}>{label}</Text></Pressable>)}
  </View></Sheet>;
}
const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 1 }, action: { width: '25%', minHeight: 48, alignItems: 'center', justifyContent: 'flex-start', paddingBottom: 6 }, icon: { fontSize: 21, lineHeight: 25 }, label: { fontSize: 13, color: '#111', lineHeight: 18 } });
