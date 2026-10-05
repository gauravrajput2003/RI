import { StyleSheet, View } from 'react-native';
import {VehicleIcon} from './VehicleIcon';
import type {VehicleVisualType} from '../../../../packages/shared-utils/src/index';

export function VehicleVisual({ visual }: { visual: VehicleVisualType }) {
  return <View style={styles.container}><VehicleIcon type={visual} state="UNREACHABLE" size={42}/></View>;
}

const styles = StyleSheet.create({
  container: {
    width: 76,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
