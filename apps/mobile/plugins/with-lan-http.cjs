const {withAndroidManifest} = require('expo/config-plugins');

module.exports = config => withAndroidManifest(config, mod => {
  const application = mod.modResults.manifest.application?.[0];
  if (application) application.$['android:usesCleartextTraffic'] = config.extra?.lanTest === true ? 'true' : 'false';
  return mod;
});
