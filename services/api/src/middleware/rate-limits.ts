import rateLimit, { type Store } from 'express-rate-limit';
type Kind = 'auth' | 'api' | 'history';
/** One limiter family. Inject a fresh store per kind when deploying distributed instances. */
export function createRateLimits(storeFor?: (kind: Kind) => Store) {
  const make = (kind: Kind, windowMs: number, max: number) => rateLimit({
    windowMs, max, store: storeFor?.(kind), standardHeaders: true, legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests; try again later' } },
  });
  return {
    authRateLimit: make('auth', 15 * 60_000, 20),
    apiRateLimit: make('api', 60_000, 300),
    historyRateLimit: make('history', 60_000, 30),
  };
}
export const { authRateLimit, apiRateLimit, historyRateLimit } = createRateLimits();
