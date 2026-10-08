import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { Screen, Field, Button, form } from '../../components/MobileForm';
import { api } from '../../services/api/client';
import { mobileMessage, requireOnline } from '../../services/api/mobile';
import { useAuthStore } from '../../store/authStore';
export default function ChangePassword() {
  const [currentPassword,setCurrent]=useState(''),[newPassword,setNew]=useState(''),[confirmPassword,setConfirm]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(false);
  async function submit(){
    if(busy)return;
    setError('');
    if(newPassword!==confirmPassword){setError('New passwords do not match.');return}
    if(newPassword.length<8){setError('Use at least 8 characters.');return}
    if(!currentPassword){setError('Enter your current password.');return}
    setBusy(true);
    try{requireOnline();await api.post('/mobile/change-password',{currentPassword,newPassword,confirmPassword});setCurrent('');setNew('');setConfirm('');setSuccess(true)}catch(e){setError(mobileMessage(e))}finally{setBusy(false)}
  }
  return <Screen backTo="profile" title="Change Password">{success?<><Text>Password changed. Sign in again with your new password.</Text><Button label="Sign in" onPress={()=>{void useAuthStore.getState().setTokens(null).then(()=>router.replace('/(auth)/login'))}}/></>:<>
    <Field label="Current Password" placeholder="Enter current password" password value={currentPassword} onChangeText={setCurrent}/>
    <Field label="New Password" placeholder="Enter new password" password value={newPassword} onChangeText={setNew}/>
    <Field label="Confirm New Password" placeholder="Confirm new password" password value={confirmPassword} onChangeText={setConfirm}/>
    {error?<Text accessibilityRole="alert" style={form.error}>{error}</Text>:null}<Button label={busy?'Changing…':'Change Password'} disabled={busy} onPress={()=>void submit()}/>
  </>}</Screen>;
}
