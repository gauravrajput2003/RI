import { StyleSheet, View } from 'react-native';
import {VehicleIcon} from './VehicleIcon';
import type {VehicleVisualType,VehicleVisualState} from '../../../../packages/shared-utils/src/index';

export function VehicleVisual({ visual,state }: { visual: VehicleVisualType;state?:VehicleVisualState }) {
  return <View style={styles.container}><VehicleIcon type={visual} state={state} size={42}/></View>;
}

const styles = StyleSheet.create({
  container: {
    width: 76,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
