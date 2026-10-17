import {Pressable,StyleSheet,Text,View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {SvgXml} from 'react-native-svg';
import {router} from 'expo-router';
export function DriverHeader({title,onBack}:{title:string;onBack?():void}){
 return <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel={`Back from ${title}`} onPress={()=>onBack?onBack():router.canGoBack()?router.back():router.replace('/(app)')} style={styles.back}><Feather name="arrow-left" size={23} color="#111"/></Pressable><Text accessibilityRole="header" style={styles.title}>{title}</Text></View>;
}
const avatar=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><path d="M8 75v-9c0-13 13-20 32-20s32 7 32 20v9Z" fill="#c4e3f7" stroke="#84afd0" stroke-width="2"/><path d="M30 44v14l10 8 10-8V44" fill="#ffe5a0" stroke="#a2ab80" stroke-width="2"/><path d="M22 27c-7-17 10-25 22-23 16 1 19 12 15 26l-8 7H28Z" fill="#e8b284" stroke="#af835f" stroke-width="2"/><path d="M25 24c9 1 13-7 17-7 1 6 9 7 14 6v13c0 13-7 21-16 21S24 48 24 36Z" fill="#fff1b2" stroke="#b4ac79" stroke-width="2"/><ellipse cx="40" cy="72" rx="19" ry="13" fill="none" stroke="#5682a7" stroke-width="5"/><path d="M24 68l16 6 16-6M40 74v6" stroke="#5682a7" stroke-width="4"/></svg>`;
export function DriverAvatar(){return <SvgXml xml={avatar} width={72} height={72}/>;}
const styles=StyleSheet.create({header:{height:48,backgroundColor:'#fff',borderBottomWidth:1,borderColor:'#eee',flexDirection:'row',alignItems:'center',gap:2},back:{width:44,height:48,alignItems:'center',justifyContent:'center'},title:{fontSize:17,fontWeight:'600',color:'#111'}});
