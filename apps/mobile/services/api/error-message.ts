import axios from 'axios';

export function apiErrorMessage(error:unknown,demoMode=false){
  if(!axios.isAxiosError(error))return 'The request could not be completed.';
  const status=error.response?.status;
  const apiError=error.response?.data?.error;
  const login=/\/auth\/login(?:\?|$)/.test(error.config?.url??'');
  if(status===401){
    if(login)return demoMode?'Demo mode only accepts demo credentials. Use live mode to sign in with your web client account.':'Incorrect username or password. Use the password set for this client in the web app.';
    return 'Your session expired. Please sign in again.';
  }
  if(status===400&&login)return 'Check your username and password. Live accounts require a password of at least 8 characters.';
  if(status===429)return 'Too many requests. Please try again shortly.';
  if(status===409&&login&&apiError?.code==='DEVICE_LIMIT_REACHED'){
    return typeof apiError.message==='string'?apiError.message:'This account has reached its device limit. Log out on another device and try again.';
  }
  if(!error.response)return 'Unable to connect. Check your network and try again.';
  return 'The request could not be completed.';
}
