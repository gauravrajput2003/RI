import {StyleSheet,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
export type PlaybackMetric='covered'|'gps'|'speed'|'distance'|'running'|'average'|'halts'|'stoppage'|'maximum';
export function PlaybackMetricIcon({kind}:{kind:PlaybackMetric}){
 const gauge=['speed','average','maximum'].includes(kind);
 const timer=kind==='running'||kind==='stoppage'||kind==='gps';
 return <View testID={`playback-icon-${kind}`} style={s.box} accessible={false}>
  {gauge?<><View style={[s.gauge,{borderLeftColor:kind==='maximum'?'#ef4444':'#22c55e',borderTopColor:'#eab308',borderRightColor:kind==='average'?'#9333ea':'#ef4444'}]}/><View style={s.needle}/><View style={s.hub}/></>:null}
  {timer?<><MaterialCommunityIcons name={kind==='gps'?'clock-outline':'timer-outline'} size={21} color={kind==='stoppage'?'#ef4444':'#22c55e'}/><View style={[s.timerHand,{backgroundColor:kind==='gps'?'#22a6d5':'#ef4444'}]}/></>:null}
  {kind==='distance'?<><MaterialCommunityIcons name="map-marker" size={17} color="#ef4444" style={{position:'absolute',left:0,top:0}}/><MaterialCommunityIcons name="map-marker" size={16} color="#268bdd" style={{position:'absolute',right:-2,bottom:0}}/></>:null}
  {kind==='covered'?<><MaterialCommunityIcons name="map-marker-path" size={21} color="#364c56"/><View style={s.dot}/></>:null}
  {kind==='halts'?<><MaterialCommunityIcons name="gas-station" size={21} color="#ef4444"/><View style={s.haltAccent}/></>:null}
 </View>;
}
export function PlaybackOptionsIcon(){return <View style={s.box}>{['#94a3b8','#eab308','#22c55e'].map((color,index)=><View key={color} style={{height:2,width:20,backgroundColor:'#64748b',position:'absolute',top:4+index*7}}><View style={{position:'absolute',left:index===1?4:12,top:-2,width:5,height:6,backgroundColor:color}}/></View>)}</View>;}
const s=StyleSheet.create({box:{width:22,height:22,flexShrink:0,alignItems:'center',justifyContent:'center'},gauge:{width:20,height:20,borderRadius:10,borderWidth:4,borderBottomColor:'transparent',transform:[{rotate:'-15deg'}]},needle:{position:'absolute',top:7,left:11,width:2,height:9,backgroundColor:'#64748b',transform:[{rotate:'40deg'}]},hub:{position:'absolute',top:14,left:9,width:5,height:4,borderRadius:3,backgroundColor:'#64748b'},timerHand:{position:'absolute',top:7,left:11,width:1.5,height:7,transform:[{rotate:'-20deg'}]},dot:{position:'absolute',top:3,right:0,width:5,height:5,borderRadius:3,backgroundColor:'#eab308'},haltAccent:{position:'absolute',bottom:2,left:1,width:8,height:3,backgroundColor:'#22b8c7'}});
