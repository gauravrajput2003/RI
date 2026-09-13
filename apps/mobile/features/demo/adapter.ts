import { AxiosError, type AxiosAdapter } from 'axios';
import { demoCredentials, demoLocations, demoTokens, demoVehicles } from './data';

// Used only when demo mode is explicitly enabled. Never delegates to a real API.
export function createDemoAdapter(): AxiosAdapter {
  return async request => {
    const reply = (data: unknown, status = 200) => ({ config: request, data, status, statusText: '', headers: {} });
    const fail = (status: number) => { throw new AxiosError('Demo request rejected', 'ERR_BAD_REQUEST', request, undefined, reply({ success: false }, status)); };
    let body: Record<string, unknown> = {};
    try { body = typeof request.data === 'string' ? JSON.parse(request.data) : request.data ?? {}; } catch { return fail(400); }
    let path = request.url ?? '';
    if (/^https?:\/\//.test(path)) path = new URL(path).pathname;
    if (path.startsWith('/api/v1')) path = path.slice('/api/v1'.length);
    const method = request.method?.toLowerCase();
    if (method === 'post' && path === '/auth/login') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if ([demoCredentials.email.toLowerCase(), 'debugwithgaurav@gmail.com'].includes(email) && body.password === demoCredentials.password) {
        return reply({ success: true, data: { ...demoTokens } });
      }
      return fail(401);
    }
    if (method === 'post' && (path === '/auth/refresh' || path === '/auth/logout')) {
      if (body.refreshToken === demoTokens.refreshToken) return path === '/auth/logout' ? reply(undefined, 204) : reply({ success: true, data: { ...demoTokens } });
      return fail(401);
    }
    if (request.headers.get('Authorization') !== 'Bearer ' + demoTokens.accessToken) return fail(401);
    if (method === 'get' && path === '/vehicles') return reply({ success: true, data: demoVehicles.map(vehicle => ({ ...vehicle })), nextCursor: null });
    const match = path.match(/^\/vehicles\/([^/]+)\/latest-location$/);
    if (method === 'get' && match) {
      const point = demoLocations()[decodeURIComponent(match[1])];
      if (point) return reply({ success: true, data: point });
    }
    return fail(404);
  };
}
