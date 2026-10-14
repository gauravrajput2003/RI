import { describe, expect, it } from 'vitest';
import { resolveEndpoints,secureBuildEndpoints } from './endpoints';

describe('development endpoints', () => {
  it('allows private LAN HTTP only in the explicit internal LAN build',()=>{
    const api='http://10.244.133.175:3000/api/v1',socket='http://10.244.133.175:3000';
    expect(secureBuildEndpoints(api,socket,true)).toBe(true);
    expect(secureBuildEndpoints(api,socket,false)).toBe(false);
    expect(secureBuildEndpoints('http://8.8.8.8','http://8.8.8.8',true)).toBe(false);
    expect(secureBuildEndpoints('http://127.0.0.1','http://localhost',true)).toBe(false);
    expect(secureBuildEndpoints(undefined,socket,true)).toBe(false);
    expect(secureBuildEndpoints('https://api.example.com/api/v1','https://api.example.com',false)).toBe(true);
  });
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
