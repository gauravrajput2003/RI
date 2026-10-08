import {useEffect,useState} from 'react';
import {Image,Linking,Pressable,StyleSheet,Text,View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {router} from 'expo-router';
import {Screen} from '../../components/MobileForm';
import {ErrorState,Loading} from '../../components/StateViews';
import {mobileMessage,useSupportContact} from '../../services/api/mobile';
import defaultLogo from '../../assets/loginlogo.png';

export default function Contact(){
 const contact=useSupportContact();
 const [logoFailed,setLogoFailed]=useState(false),[linkError,setLinkError]=useState('');
 useEffect(()=>setLogoFailed(false),[contact.data?.logoUrl]);
 const phone=contact.data?.phone?.trim(),email=contact.data?.email?.trim();
 const dial=phone?.replace(/[^+\d]/g,'');
 async function open(url:string){setLinkError('');try{await Linking.openURL(url)}catch{setLinkError('Unable to open this contact method on your device.')}}
 return <Screen title="Contact" onBack={()=>router.replace('/(app)')}>
  {contact.isLoading?<Loading/>:contact.isError?<ErrorState message={mobileMessage(contact.error)} retry={()=>contact.refetch()}/>:<View style={styles.content}>
   <Image accessibilityLabel="Support logo" source={contact.data?.logoUrl&&!logoFailed?{uri:contact.data.logoUrl}:defaultLogo} onError={()=>setLogoFailed(true)} resizeMode="contain" style={styles.logo}/>
   <Text style={styles.name}>{contact.data?.name||'Support Team'}</Text>
   <View style={styles.card}>
    <Text style={styles.title}>How can we help you?</Text>
    <Text style={styles.subtitle}>We're here to assist you</Text>
    <View style={styles.divider}/>
    <Pressable accessibilityRole="button" accessibilityLabel={phone?`Call ${phone}`:'Phone number not provided'} disabled={!dial} onPress={()=>void open(`tel:${dial}`)} style={styles.row}>
     <View style={styles.icon}><Feather name="phone" size={23} color="#fff"/></View><View style={styles.detail}><Text style={styles.label}>PHONE NUMBER</Text><Text selectable style={styles.value}>{phone||'Not provided'}</Text></View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={email?`Email ${email}`:'Email address not provided'} disabled={!email} onPress={()=>void open(`mailto:${encodeURIComponent(email!)}`)} style={styles.row}>
     <View style={styles.icon}><Feather name="mail" size={23} color="#fff"/></View><View style={styles.detail}><Text style={styles.label}>EMAIL ADDRESS</Text><Text selectable style={styles.value}>{email||'Not provided'}</Text></View>
    </Pressable>
   </View>
   {!contact.data?<Text style={styles.subtitle}>No parent support contact is available for this account.</Text>:null}
   {linkError?<Text accessibilityRole="alert" style={styles.error}>{linkError}</Text>:null}
   <Pressable accessibilityRole="button" accessibilityLabel="Call Now" accessibilityState={{disabled:!dial}} disabled={!dial} onPress={()=>void open(`tel:${dial}`)} style={[styles.call,!dial&&styles.disabled]}><Feather name="phone" size={23} color="#fff"/><Text style={styles.callText}>Call Now</Text></Pressable>
   <Text style={styles.subtitle}>Contact your account provider for assistance</Text>
  </View>}
 </Screen>;
}
const styles=StyleSheet.create({
 content:{width:'100%',maxWidth:460,alignSelf:'center',alignItems:'center',paddingVertical:12,gap:18},
 logo:{width:128,height:128,borderRadius:64,backgroundColor:'#fff'},name:{fontSize:20,fontWeight:'600',color:'#171c25',textAlign:'center'},
 card:{width:'100%',backgroundColor:'#fff',borderRadius:18,borderWidth:1,borderColor:'#e1e5eb',padding:20,marginVertical:12,shadowColor:'#000',shadowOffset:{width:0,height:2},shadowOpacity:.12,shadowRadius:4,elevation:3},
 title:{fontSize:23,fontWeight:'700',color:'#1b2030',textAlign:'center'},subtitle:{fontSize:14,color:'#7c8290',textAlign:'center',lineHeight:21},divider:{height:2,backgroundColor:'#102c52',marginTop:20,marginBottom:8},
 row:{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:16,minHeight:72},icon:{width:44,height:44,borderRadius:22,backgroundColor:'#102c52',alignItems:'center',justifyContent:'center'},detail:{flex:1,gap:5},label:{fontSize:11,letterSpacing:1,color:'#666'},value:{fontSize:15,fontWeight:'600',color:'#1b2030',flexShrink:1},
 call:{backgroundColor:'#2bc86c',borderRadius:30,paddingVertical:15,paddingHorizontal:30,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12,minHeight:52},callText:{color:'#fff',fontSize:20,fontWeight:'700'},disabled:{opacity:.45},error:{color:'#bd1010',textAlign:'center'}
});
