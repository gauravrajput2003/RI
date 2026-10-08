import type { ReactNode } from 'react';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAccount } from '../services/api/mobile';
import { capabilities } from '../features/account/capabilities';
import { ErrorState, Loading } from './StateViews';
export type MobileCapability = keyof ReturnType<typeof capabilities>;
export function Access({ capability, children }: { capability: MobileCapability; children: ReactNode }) {
  const account = useAccount();
  if (account.isLoading) return <Loading />;
  if (account.isError) return <ErrorState message="Unable to verify access" retry={() => account.refetch()} />;
  if (!capabilities(account.data)[capability]) return <View style={form.page}><Text style={form.heading}>Access Denied</Text><Button label="Back to Profile" onPress={() => router.replace('/(app)/profile')} /></View>;
  return <>{children}</>;
}
export function Screen({title,children,accent=false,onBack,backTo}:{title:string;children:ReactNode;accent?:boolean;onBack?():void;backTo?:'profile'|'vehicles'}) {
  return <KeyboardAvoidingView style={{flex:1,backgroundColor:'#f6f8fa'}} behavior={Platform.OS==='ios'?'padding':undefined}>
    <View style={[form.header,accent&&{backgroundColor:'#ee0509'}]}>{!accent?<Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={()=>onBack?onBack():backTo?router.replace(backTo==='profile'?'/(app)/profile':'/(app)/vehicles'):router.back()} style={form.back}><Feather name="arrow-left" size={24}/></Pressable>:null}<Text style={[form.heading,accent&&{color:'#fff',flex:1,paddingLeft:8}]}>{title}</Text>{accent?<Pressable accessibilityRole="button" accessibilityLabel="Close announcement" onPress={onBack} style={form.back}><Feather name="x-circle" size={22} color="#fff"/></Pressable>:null}</View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={form.page}>{children}</ScrollView>
  </KeyboardAvoidingView>;
}
export function Field({label,password,...props}:TextInputProps & {label:string;password?:boolean}) {
  const [visible,setVisible]=useState(false);
  return <View style={form.field}><Text style={form.label}>{label}</Text><View style={form.inputRow}><TextInput accessibilityLabel={label} placeholderTextColor="#8a8a8a" style={form.input} secureTextEntry={password&&!visible} autoCapitalize="none" {...props}/>{password?<Pressable accessibilityRole="button" accessibilityLabel={`Show ${label}`} onPress={()=>setVisible(!visible)} style={form.back}><Feather name={visible?'eye':'eye-off'} size={20} color="#555"/></Pressable>:null}</View></View>;
}
export function Button({label,onPress,disabled=false}:{label:string;onPress():void;disabled?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={[form.button,disabled&&{opacity:0.5}]}><Text style={form.buttonText}>{label}</Text></Pressable>;
}
export function Check({label,checked,onPress}:{label:string;checked:boolean;onPress():void}) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{checked}} onPress={onPress} style={form.check}><Feather name={checked?'check-square':'square'} size={22} color="#ee0509"/><Text>{label}</Text></Pressable>;
}
export function Options({label,value,options,onChange}:{label:string;value:string;options:{id:string;label:string}[];onChange(value:string):void}) {
  const [open,setOpen]=useState(false);
  return <View style={form.field}><Text style={form.label}>{label}</Text><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={()=>setOpen(!open)} style={form.select}><Text>{options.find(item=>item.id===value)?.label||`Select ${label}`}</Text><Feather name="chevron-down" size={18}/></Pressable>{open?<View style={form.card}>{options.length?options.map(item=><Pressable key={item.id} accessibilityRole="radio" accessibilityState={{checked:item.id===value}} onPress={()=>{onChange(item.id);setOpen(false)}} style={form.option}><Text>{item.label}</Text></Pressable>):<Text>No options available.</Text>}</View>:null}</View>;
}
export const form=StyleSheet.create({page:{padding:16,gap:16,flexGrow:1},header:{height:52,backgroundColor:'#fff',borderBottomWidth:1,borderColor:'#eee',flexDirection:'row',alignItems:'center',paddingHorizontal:8,gap:8},back:{padding:12},heading:{fontSize:18,fontWeight:'700',color:'#171c25'},label:{fontSize:15,fontWeight:'600',color:'#303845',marginBottom:5},field:{gap:2,marginBottom:10},inputRow:{flexDirection:'row',borderWidth:1,borderColor:'#777',borderRadius:9,backgroundColor:'#fff',alignItems:'center'},input:{flex:1,padding:12,minHeight:44,color:'#111',fontSize:15},button:{padding:14,backgroundColor:'#ee0509',borderRadius:9,alignItems:'center',marginVertical:8,minHeight:48},buttonText:{color:'#fff',fontWeight:'700',fontSize:16},card:{backgroundColor:'#fff',borderRadius:12,padding:14,gap:12,borderWidth:1,borderColor:'#e6e6e6'},error:{color:'#bd1010',fontSize:14},muted:{color:'#657080',lineHeight:21},check:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:6,minHeight:44},select:{borderWidth:1,borderColor:'#d8dce2',borderRadius:8,padding:13,flexDirection:'row',justifyContent:'space-between',backgroundColor:'#fff'},option:{padding:12,borderBottomWidth:1,borderBottomColor:'#eee'}});
