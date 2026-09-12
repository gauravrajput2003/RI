export function resolveDemoMode(flag: string | undefined, development: boolean): boolean {
  if (flag === 'true' && !development) throw new Error('Demo mode is development-only. Disable EXPO_PUBLIC_DEMO_MODE for release builds.');
  return flag === 'true' && development;
}
