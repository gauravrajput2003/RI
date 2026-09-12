import type { createAuthStore } from '../../features/auth/session';
export function bindSessionLifecycle(auth: ReturnType<typeof createAuthStore>, actions: {
  clear(): void; transport(session: string | null, token: string | null): void;
  load(session: string): Promise<void>; remove(session: string): Promise<void>;
  ready(session: string | null): void;
}) {
  let session: string | null = null;
  let generation = 0;
  const reconcile = () => {
    const next = auth.getState();
    if (next.sessionKey !== session) {
      const previous = session;
      session = next.sessionKey;
      const current = ++generation;
      actions.transport(null, null); actions.ready(null); actions.clear();
      if (previous) void actions.remove(previous).catch(() => undefined);
      if (session) {
        const expected = session;
        void actions.load(expected).catch(() => undefined).then(() => {
          if (generation === current) {
            actions.ready(expected);
            actions.transport(expected, auth.getState().tokens?.accessToken ?? null);
          }
        });
      }
    } else if (session) actions.transport(session, next.tokens?.accessToken ?? null);
  };
  const unsubscribe = auth.subscribe(reconcile);
  reconcile();
  return () => { ++generation; unsubscribe(); actions.transport(null, null); actions.ready(null); actions.clear(); };
}
