import { AxiosError, type AxiosAdapter } from 'axios';
import { demoCredentials, demoLocations, demoTokens, demoVehicles } from './data';
import { generateDemoHistory } from '../playback/route';

// Used only when demo mode is explicitly enabled. Never delegates to a real API.
export function createDemoAdapter(): AxiosAdapter {
  return async request => {
    const reply = (data: unknown, status = 200) => ({ config: request, data, status, statusText: '', headers: {} });
    const fail = (status: number) => { throw new AxiosError('Demo request rejected', 'ERR_BAD_REQUEST', request, undefined, reply({ success: false }, status)); };
    let body: Record<string, unknown> = {};
    try { body = typeof request.data === 'string' ? JSON.parse(request.data) : request.data ?? {}; } catch { return fail(400); }
    const rawUrl = request.url ?? '';
    let path = rawUrl;
    let searchParams = new URLSearchParams();
    if (/^https?:\/\//.test(path)) {
      const parsedUrl = new URL(path);
      path = parsedUrl.pathname;
      searchParams = parsedUrl.searchParams;
    } else if (path.includes('?')) {
      const [p, q] = path.split('?');
      path = p;
      searchParams = new URLSearchParams(q);
    }
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
    const historyMatch = path.match(/^\/vehicles\/([^/]+)\/history$/);
    if (method === 'get' && historyMatch) {
      const vehicleId = decodeURIComponent(historyMatch[1]);
      const params = (request.params as Record<string, string> | undefined) ?? {};
      const fromStr = params.from || searchParams.get('from');
      const toStr = params.to || searchParams.get('to');
      const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 24 * 3600 * 1000);
      const to = toStr ? new Date(toStr) : new Date();
      const points = generateDemoHistory(vehicleId, from, to);
      return reply({ success: true, data: points });
    }
    return fail(404);
  };
}

