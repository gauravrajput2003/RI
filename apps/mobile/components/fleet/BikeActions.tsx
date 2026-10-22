import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sheet } from './Sheet';
import {VehicleActionIcon} from './VehicleActionIcon';
import { useAccount } from '../../services/api/mobile';
import { capabilities } from '../../features/account/capabilities';
export const bikeActions = [
  'Live Map', 'Play Back', 'Share', 'Notification',
  'Report', 'NearBy', 'Parking', 'Street View',
  'Lock', 'Driver', 'Edit',
] as const;
export type BikeAction = typeof bikeActions[number];
export function BikeActions({ vehicle, onClose, onAction }: { vehicle: string | null; onClose(): void; onAction(action: BikeAction): void }) {
  const account=useAccount(),caps=capabilities(account.data);
  return <Sheet visible={Boolean(vehicle)} onClose={onClose}><View style={styles.grid}>
    {bikeActions.filter(label=>label==='Edit'?caps.editVehicle:label==='Notification'?caps.notifications:label==='Share'?caps.share:true).map(label => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => onAction(label)} style={styles.action}><VehicleActionIcon action={label}/><Text maxFontSizeMultiplier={1.2} style={styles.label}>{label}</Text></Pressable>)}
  </View></Sheet>;
}
const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 1 }, action: { width: '25%', minHeight: 52, alignItems: 'center', justifyContent: 'flex-start', paddingBottom: 6, gap: 2 }, label: { fontSize: 12, fontWeight: '500', color: '#111', lineHeight: 16, textAlign: 'center' } });
