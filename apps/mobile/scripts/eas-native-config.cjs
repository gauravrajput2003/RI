const {spawnSync} = require('node:child_process');
const process = require('node:process');

// Android is checked in, so EAS does not automatically apply config plugins.
// Apply them without cleaning the existing native project after dependencies
// and the GOOGLE_SERVICES_JSON secret file are available on the build worker.
if (process.env.EAS_BUILD_PLATFORM === 'android') {
  if (!process.env.GOOGLE_SERVICES_JSON) {
    throw new Error('Set the GOOGLE_SERVICES_JSON file variable in this EAS environment before building Android push notifications.');
  }
  const result = spawnSync(process.execPath,
    [require.resolve('expo/bin/cli'), 'prebuild', '--platform', 'android', '--no-install'],
    {stdio: 'inherit'});
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
