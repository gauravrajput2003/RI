import axios, { AxiosError, type AxiosAdapter } from 'axios';
import { demoCredentials, demoLocations, demoTokens, demoVehicles } from './data';

export interface DemoAdapterOptions {
  fallbackToReal?: boolean;
}

// Entirely local: intercept demo requests and optionally pass others to real adapter.
export function createDemoAdapter(options: DemoAdapterOptions = {}): AxiosAdapter {
  return async request => {
    const reply = (data: unknown, status = 200) => ({ config: request, data, status, statusText: '', headers: {} });
    const fail = (status: number) => { throw new AxiosError('Demo request rejected', 'ERR_BAD_REQUEST', request, undefined, reply({ success: false }, status)); };
    let body: Record<string, unknown> = {};
    try { body = typeof request.data === 'string' ? JSON.parse(request.data) : request.data ?? {}; } catch { return fail(400); }
    let path = request.url ?? '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      try {
        path = new URL(path).pathname;
      } catch {
        // fallback
      }
    }
    if (path.startsWith('/api/v1')) {
      path = path.slice('/api/v1'.length);
    }
    const method = request.method?.toLowerCase();

    if (method === 'post' && path === '/auth/login') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const allowedEmails = [demoCredentials.email.toLowerCase(), 'debugwithgaurav@gmail.com'];
      if (allowedEmails.includes(email) && body.password === demoCredentials.password) {
        return reply({ success: true, data: { ...demoTokens } });
      }
      if (!options.fallbackToReal) return fail(401);
    }
    if (method === 'post' && (path === '/auth/refresh' || path === '/auth/logout')) {
      if (body.refreshToken === demoTokens.refreshToken) {
        return path === '/auth/logout' ? reply(undefined, 204) : reply({ success: true, data: { ...demoTokens } });
      }
      if (!options.fallbackToReal) return fail(401);
    }
    const authHeader = typeof request.headers?.get === 'function'
      ? request.headers.get('Authorization')
      : ((request.headers as Record<string, unknown>)?.[
          'Authorization'
        ] as string | undefined) ||
        ((request.headers as Record<string, unknown>)?.[
          'authorization'
        ] as string | undefined);

    const isDemoToken = authHeader === 'Bearer ' + demoTokens.accessToken;

    if (isDemoToken) {
      if (method === 'get' && path === '/vehicles') return reply({ success: true, data: demoVehicles.map(vehicle => ({ ...vehicle })), nextCursor: null });
      const match = path?.match(/^\/vehicles\/([^/]+)\/latest-location$/);
      if (method === 'get' && match) {
        const point = demoLocations()[decodeURIComponent(match[1])];
        if (point) return reply({ success: true, data: point });
      }
      return fail(404);
    }

    if (!options.fallbackToReal) {
      if (authHeader !== 'Bearer ' + demoTokens.accessToken) return fail(401);
      return fail(404);
    }

    const defaultAdapter = axios.defaults.adapter;
    if (typeof defaultAdapter === 'function') {
      return (defaultAdapter as AxiosAdapter)(request);
    } else if (Array.isArray(defaultAdapter)) {
      for (const adapter of defaultAdapter) {
        if (typeof adapter === 'function') return adapter(request);
      }
    }
    return fail(500);
  };
}
