import { describe, expect, it } from 'vitest';
import { resolveEndpoints } from './endpoints';

describe('development endpoints', () => {
  it('uses the Metro computer address on a physical phone', () => {
    expect(resolveEndpoints({ expoHostUri: '192.168.198.175:8081' }).apiUrl)
      .toBe('http://192.168.198.175:3000/api/v1');
  });
  it('uses the browser hostname for web previews', () => {
    expect(resolveEndpoints({ webHostname: 'localhost', expoHostUri: '192.168.198.175:8081' }).socketUrl)
      .toBe('http://localhost:3000');
  });
  it('allows empty environment values to use automatic discovery', () => {
    expect(resolveEndpoints({ apiUrl: '', socketUrl: '', expoHostUri: '192.168.1.20:8081' }).apiUrl)
      .toBe('http://192.168.1.20:3000/api/v1');
  });
  it('preserves explicitly configured production endpoints', () => {
    expect(resolveEndpoints({ apiUrl: 'https://api.example.com/api/v1', socketUrl: 'https://api.example.com' }))
      .toEqual({ apiUrl: 'https://api.example.com/api/v1', socketUrl: 'https://api.example.com' });
  });
  it('falls back to the Android emulator host without Metro metadata', () => {
    expect(resolveEndpoints({}).apiUrl).toBe('http://10.0.2.2:3000/api/v1');
  });
});
