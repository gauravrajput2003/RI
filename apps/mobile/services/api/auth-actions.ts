import type { AxiosInstance } from 'axios';
import type { createAuthStore } from '../../features/auth/session';
import { z } from 'zod';
const tokens = z.object({ accessToken: z.string().min(1), refreshToken: z.string().min(1) });
export function createAuthActions(client: AxiosInstance, auth: ReturnType<typeof createAuthStore>) {
  return {
    async login(email: string, password: string) {
      const { data } = await client.post('/auth/login', { email, password });
      await auth.getState().setTokens(tokens.parse(data.data));
    },
    async logout() {
      const refreshToken = auth.getState().tokens?.refreshToken;
      const cleanup = auth.getState().setTokens(null);
      if (refreshToken) void client.post('/auth/logout', { refreshToken }).catch(() => undefined);
      await cleanup;
    },
  };
}
