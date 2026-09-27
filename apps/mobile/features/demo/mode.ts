export function resolveDemoMode(flag: string | undefined, development: boolean): boolean {
  void development;
  return flag === 'true';
}
