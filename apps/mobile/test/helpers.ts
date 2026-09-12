import { vi } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { createAuthStore } from '../features/auth/session';
export function memoryStorage() {
  const data = new Map<string, string>();
  return { data, getItem: vi.fn(async (key: string) => data.get(key) ?? null), setItem: vi.fn(async (key: string, value: string) => { data.set(key, value); }), removeItem: vi.fn(async (key: string) => { data.delete(key); }) };
}
export const makeAuth = () => createAuthStore(memoryStorage());
export const tokenA = { accessToken: 'access-a', refreshToken: 'refresh-a' };
export const tokenB = { accessToken: 'access-b', refreshToken: 'refresh-b' };
export function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export const response = (config: InternalAxiosRequestConfig, data: unknown, status = 200) => ({ config, data, status, statusText: '', headers: {} });
export const unauthorized = (config: InternalAxiosRequestConfig) => new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, response(config, {}, 401));
export const tick = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
