import type { ConfigContext, ExpoConfig } from 'expo/config';
declare const process: { env: Record<string, string | undefined> };
export default ({ config }: ConfigContext): ExpoConfig => {
  if (process.env.EXPO_PUBLIC_DEMO_MODE === 'true' && (process.env.NODE_ENV === 'production' || process.env.EAS_BUILD_PROFILE === 'production')) {
    throw new Error('Disable EXPO_PUBLIC_DEMO_MODE before creating a production build.');
  }
  return ({
  ...config,
  name: config.name ?? 'Fleet Tracker',
  slug: config.slug ?? 'fleet-tracker',
  android: { ...config.android, allowBackup: false },
  ios: { ...config.ios, infoPlist: { ...config.ios?.infoPlist, NSAppTransportSecurity: {
    NSAllowsArbitraryLoads: false, NSAllowsLocalNetworking: true,
  } } },
  plugins: [...(config.plugins ?? []), ['react-native-maps', {
    androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_ANDROID_MAPS_API_KEY,
  }]],
  });
};
