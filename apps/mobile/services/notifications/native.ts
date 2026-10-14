import Constants from 'expo-constants';
import {Platform} from 'react-native';

export function isNativePushAvailable(){
 return Platform.OS!=='web'&&Constants.appOwnership!=='expo'&&Constants.executionEnvironment!=='storeClient';
}

// Importing expo-notifications itself initializes Android remote push code.
// Keep it entirely unloaded in Expo Go, even when no push API is called.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- A static import initializes unsupported Expo Go remote push before the runtime guard.
export function loadNativeNotifications(loader:()=>typeof import('expo-notifications')=()=>require('expo-notifications')){
 return isNativePushAvailable()?loader():null;
}
