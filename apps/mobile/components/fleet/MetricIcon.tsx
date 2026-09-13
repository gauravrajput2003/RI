import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type MetricIconKind = 'distance' | 'fuel' | 'speed' | 'maxSpeed' | 'since' | 'lastSync';
const blue = '#1249bd';
const red = '#ee1526';
const purple = '#9474c3';
const green = '#36bc80';

// Small, code-drawn symbols keep the reference silhouettes consistent on iOS,
// Android and web; they do not depend on platform emoji artwork or new packages.
export function MetricIcon({ kind }: { kind: MetricIconKind }) {
  return <View testID={'metric-icon-' + kind} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.canvas}>
    {kind === 'distance' ? <>
      <View style={styles.milestone}><Text allowFontScaling={false} style={styles.km}>KM</Text><View style={styles.milestoneLine} /></View>
      <View style={styles.base} />
    </> : null}
    {kind === 'fuel' ? <MaterialCommunityIcons name="gas-station" size={20} color="#c344ae" /> : null}
    {kind === 'speed' ? <>
      <View style={styles.speedArc} />
      {[[-6, 2, '-48deg'], [0, 0, '0deg'], [6, 2, '48deg']].map(([x, y, rotation], index) => <View key={index} style={[styles.tick, { left: 9 + Number(x), top: 5 + Number(y), transform: [{ rotate: String(rotation) as `${number}deg` }] }]} />)}
      <View style={styles.speedNeedle} /><View style={styles.speedHub} />
    </> : null}
    {kind === 'maxSpeed' ? <>
      <View style={styles.maxBody}><View style={styles.maxArc} /></View>
      <View style={styles.maxNeedle} /><View style={styles.maxHub} />
    </> : null}
    {kind === 'since' ? <>
      <View style={styles.flagPole} /><View style={styles.flagStart} /><View style={styles.flagEnd} />
      <Text allowFontScaling={false} style={styles.since}>SINCE</Text>
    </> : null}
    {kind === 'lastSync' ? <>
      <View style={styles.syncOrbit} /><View style={styles.syncArrowTop} /><View style={styles.syncArrowBottom} />
      <MaterialCommunityIcons name="map-marker-outline" size={15} color={red} />
      <View style={styles.pinDot} />
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  canvas: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  milestone: { position: 'absolute', left: 5, top: 2, width: 10, height: 14, borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: blue, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 3 },
  km: { fontSize: 4.5, lineHeight: 6, fontWeight: '800', color: '#fff' },
  milestoneLine: { width: 6, height: 1, backgroundColor: '#fff' },
  base: { position: 'absolute', bottom: 2, left: 4, width: 12, height: 1.5, backgroundColor: blue },
  speedArc: { position: 'absolute', top: 4, left: 1, width: 18, height: 10, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderWidth: 1.7, borderBottomWidth: 0, borderColor: red },
  tick: { position: 'absolute', width: 1.5, height: 3, backgroundColor: red },
  speedNeedle: { position: 'absolute', top: 6, left: 11, width: 1.8, height: 8, borderRadius: 1, backgroundColor: red, transform: [{ rotate: '35deg' }] },
  speedHub: { position: 'absolute', left: 8, top: 12, width: 4, height: 4, borderRadius: 2, backgroundColor: red },
  maxBody: { position: 'absolute', top: 4, left: 1, width: 18, height: 13, borderTopLeftRadius: 11, borderTopRightRadius: 11, borderBottomLeftRadius: 1, borderBottomRightRadius: 1, backgroundColor: purple },
  maxArc: { position: 'absolute', top: 3, left: 3, width: 12, height: 7, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1, borderBottomWidth: 0, borderColor: '#fff' },
  maxNeedle: { position: 'absolute', top: 7, left: 12, width: 1.5, height: 8, borderRadius: 1, backgroundColor: '#fff', transform: [{ rotate: '48deg' }] },
  maxHub: { position: 'absolute', left: 8, top: 13, width: 4, height: 3, borderRadius: 2, backgroundColor: '#fff' },
  flagPole: { position: 'absolute', top: 2, left: 4, width: 1.2, height: 10, backgroundColor: green },
  flagStart: { position: 'absolute', top: 2, left: 5, width: 6, height: 6, borderRadius: 1, backgroundColor: green },
  flagEnd: { position: 'absolute', top: 3, left: 10, width: 6, height: 6, borderRadius: 1, backgroundColor: green },
  since: { position: 'absolute', top: 12, fontSize: 5.5, lineHeight: 7, fontWeight: '800', color: green },
  syncOrbit: { position: 'absolute', width: 19, height: 19, borderRadius: 10, borderWidth: 1.8, borderLeftColor: red, borderRightColor: red, borderTopColor: 'transparent', borderBottomColor: 'transparent', transform: [{ rotate: '25deg' }] },
  syncArrowTop: { position: 'absolute', left: 3, top: 1, width: 4, height: 4, borderTopWidth: 1.6, borderRightWidth: 1.6, borderColor: red, transform: [{ rotate: '-20deg' }] },
  syncArrowBottom: { position: 'absolute', right: 3, bottom: 1, width: 4, height: 4, borderBottomWidth: 1.6, borderLeftWidth: 1.6, borderColor: red, transform: [{ rotate: '-20deg' }] },
  pinDot: { position: 'absolute', top: 7, left: 9, width: 2, height: 2, borderRadius: 1, backgroundColor: red },
});
