import {StyleSheet,Text,View} from 'react-native';
import {formatDuration,type RouteStats} from './route';
import {PlaybackMetricIcon,type PlaybackMetric} from './PlaybackMetricIcon';

export function PlaybackStatsGrid({stats,hasRecordings}:{stats:RouteStats;hasRecordings:boolean}){
 const cells:{kind:PlaybackMetric;label:string;value:string}[]=[
  {kind:'distance',label:'KM Travelled',value:`${stats.kmTravelled} KM`},
  {kind:'running',label:'Total Running',value:formatDuration(stats.totalRunningSeconds)},
  {kind:'average',label:'Avg Speed',value:`${stats.avgSpeedKmh} KMH`},
  {kind:'halts',label:'Halt Count',value:String(stats.haltCount)},
  {kind:'stoppage',label:'Total Stoppage',value:formatDuration(stats.totalStoppageSeconds)},
  {kind:'maximum',label:'Max Speed',value:`${stats.maxSpeedKmh} KMH`},
 ];
 return <View testID="playback-stats-grid" style={styles.grid}>{[0,3].map(offset=><View key={offset} testID={`playback-stats-row-${offset/3}`} style={styles.row}>
  {cells.slice(offset,offset+3).map(cell=><View key={cell.kind} accessible accessibilityLabel={`${cell.label}: ${hasRecordings?cell.value:'Unavailable'}`} testID={`playback-stat-${cell.kind}`} style={styles.cell}>
   <View style={styles.heading}><PlaybackMetricIcon kind={cell.kind}/><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.8} maxFontSizeMultiplier={1.3} style={styles.label}>{cell.label}</Text></View>
   <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.value}>{hasRecordings?cell.value:'--'}</Text>
  </View>)}
 </View>)}</View>;
}
const styles=StyleSheet.create({
 grid:{flexGrow:0,flexShrink:0,width:'100%',backgroundColor:'#fff',borderTopWidth:1,borderColor:'#ddd'},
 row:{height:52,flexGrow:0,flexShrink:0,flexDirection:'row',borderBottomWidth:1,borderColor:'#ddd'},
 cell:{width:'33.333333%',minWidth:0,paddingHorizontal:3,paddingVertical:4,borderRightWidth:1,borderColor:'#e2e8f0',alignItems:'center',justifyContent:'flex-start'},
 heading:{height:24,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:3,width:'100%'},
 label:{fontSize:10,fontWeight:'700',color:'#111',flexShrink:1,includeFontPadding:false},
 value:{fontSize:12,lineHeight:17,fontWeight:'600',color:'#111',marginTop:1,includeFontPadding:false,textAlign:'center'},
});
