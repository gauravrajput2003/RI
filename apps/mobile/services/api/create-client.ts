import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import type { createAuthStore } from '../../features/auth/session';
import type { ApiEnvelope, Tokens } from '../../types/models';

type Request = InternalAxiosRequestConfig & { _retried?: boolean; _token?: string; _session?: string | null };
const publicRequest = (url?: string) => {
  if (!url) return false;
  return url.endsWith('/auth/login') || url.endsWith('/auth/refresh') || url.endsWith('/auth/logout') ||
    url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout');
};
export function createApiClient(baseURL: string, auth: ReturnType<typeof createAuthStore>, adapter?: AxiosAdapter) {
  const client = axios.create({ baseURL, timeout: 12_000, adapter, headers: { Accept: 'application/json' } });
  let refresh: { session: string; promise: Promise<void> } | null = null;
  const refreshSession = () => {
    const state = auth.getState();
    if (!state.sessionKey || !state.tokens) return Promise.reject(new axios.CanceledError('Session changed'));
    const session = state.sessionKey;
    const expected = state.tokens;
    if (refresh?.session === session) return refresh.promise;
    const promise = (async () => {
      try {
        const result = await client.post<ApiEnvelope<Tokens>>('/auth/refresh', { refreshToken: expected.refreshToken });
        const next = result.data.data;
        if (!next || typeof next.accessToken !== 'string' || !next.accessToken || typeof next.refreshToken !== 'string' || !next.refreshToken) throw new Error('Invalid token response');
        if (auth.getState().sessionKey !== session || !await auth.getState().replaceTokens(expected, next)) throw new axios.CanceledError('Session changed');
      } catch (cause) {
        if (auth.getState().sessionKey === session) await auth.getState().setTokens(null);
        throw cause;
      }
    })();
    refresh = { session, promise };
    void promise.finally(() => { if (refresh?.promise === promise) refresh = null; }).catch(() => undefined);
    return promise;
  };
  client.interceptors.request.use((request: Request) => {
    if (!publicRequest(request.url)) {
      const state = auth.getState();
      if (request._retried && request._session !== state.sessionKey) throw new axios.CanceledError('Session changed');
      request._session = state.sessionKey;
      request._token = state.tokens?.accessToken;
      if (request._token) request.headers.set('Authorization', 'Bearer ' + request._token);
      else request.headers.delete('Authorization');
    }
    return request;
  });
  client.interceptors.response.use(response => {
    const request = response.config as Request;
    if (!publicRequest(request.url) && request._session !== auth.getState().sessionKey) throw new axios.CanceledError('Session changed');
    return response;
  }, async (error: AxiosError) => {
    const request = error.config as Request | undefined;
    if (!request || error.response?.status !== 401 || publicRequest(request.url)) throw error;
    const state = auth.getState();
    if (!state.tokens || state.sessionKey !== request._session) throw new axios.CanceledError('Session changed');
    if (request._retried) { await auth.getState().setTokens(null); throw error; }
    request._retried = true;
    // A delayed 401 from an old access token reuses the already-rotated token.
    if (state.tokens.accessToken === request._token) await refreshSession();
    return client(request);
  });
  return Object.assign(client, { refreshSession });
}
