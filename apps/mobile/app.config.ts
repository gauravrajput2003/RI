import type { ConfigContext, ExpoConfig } from 'expo/config';
import {existsSync} from 'node:fs';
declare const process: { env: Record<string, string | undefined> };
export default ({ config }: ConfigContext): ExpoConfig => {
  const lanTest = process.env.EAS_BUILD_PROFILE === 'preview-lan';
  // Release bundling also sets NODE_ENV=production for internal preview APKs.
  // Only the store-oriented EAS production profile must reject demo data.
  if (process.env.EXPO_PUBLIC_DEMO_MODE === 'true' && process.env.EAS_BUILD_PROFILE === 'production') {
    throw new Error('Disable EXPO_PUBLIC_DEMO_MODE before creating a production build.');
  }
  return ({
  ...config,
  name: config.name ?? 'Fleet Tracker',
  slug: config.slug ?? 'fleet-tracker',
  extra: { ...config.extra, lanTest },
  android: { ...config.android, allowBackup: false,googleServicesFile:process.env.GOOGLE_SERVICES_JSON??(existsSync('./google-services.json')?'./google-services.json':config.android?.googleServicesFile) },
  ios: { ...config.ios, infoPlist: { ...config.ios?.infoPlist, NSAppTransportSecurity: {
    NSAllowsArbitraryLoads: false, NSAllowsLocalNetworking: true,
  } } },
  plugins: [...(config.plugins ?? []),'./plugins/with-lan-http.cjs','expo-sharing','@react-native-community/datetimepicker',['expo-notifications',{enableBackgroundRemoteNotifications:true,sounds:['./assets/voice/vehicle-running.wav','./assets/voice/vehicle-idle.wav','./assets/voice/vehicle-stopped.wav']}]],
  });
};
