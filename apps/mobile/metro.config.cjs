const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { dirname } = require('node:path');
const config = getDefaultConfig(__dirname);
// NativeWind injects this runtime into React Native's development LogBox too.
// pnpm isolates React Native from app dependencies, so resolve the runtime from
// this app explicitly rather than from React Native's physical store directory.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-css-interop': dirname(require.resolve('react-native-css-interop/package.json')),
};
module.exports = withNativeWind(config, { input: './global.css' });
