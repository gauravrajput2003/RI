export interface SocketPort {
  auth: Record<string, unknown>;
  on(event: string, handler: (...args: unknown[]) => void): unknown;
  removeAllListeners(): unknown;
  connect(): unknown;
  disconnect(): unknown;
}
export function createSocketLifecycle(factory: (token: string) => SocketPort, callbacks: {
  location(payload: unknown): void; status(payload: unknown): void;
  connected(): void; connection(value: boolean): void; unauthorized?(): void;
}) {
  let socket: SocketPort | null = null;
  let session: string | null = null;
  let token: string | null = null;
  let online = false;
  let active = true;
  let started = false;
  const sync = () => {
    const wanted = Boolean(socket && online && active);
    if (wanted === started) return;
    started = wanted;
    if (wanted) socket?.connect();
    else { socket?.disconnect(); callbacks.connection(false); }
  };
  const stop = () => {
    socket?.removeAllListeners(); socket?.disconnect();
    socket = null; session = null; token = null; started = false;
    callbacks.connection(false);
  };
  return {
    setSession(nextSession: string | null, nextToken: string | null) {
      if (!nextSession || !nextToken) { stop(); return; }
      if (session === nextSession && token === nextToken) return;
      // Token rotation replaces the transport, never overlaps two connections.
      stop(); session = nextSession; token = nextToken;
      const current = factory(nextToken); socket = current;
      const guard = (handler: (...args: unknown[]) => void) => (...args: unknown[]) => {
        if (socket === current) handler(...args);
      };
      current.on('vehicle:location', guard(callbacks.location));
      current.on('vehicle:status', guard(callbacks.status));
      current.on('connect', guard(() => { callbacks.connection(true); callbacks.connected(); }));
      current.on('disconnect', guard(() => callbacks.connection(false)));
      current.on('connect_error', guard(error => {
        callbacks.connection(false);
        if (error && typeof error === 'object' && 'message' in error && error.message === 'UNAUTHORIZED') callbacks.unauthorized?.();
      }));
      sync();
    },
    setNetwork(value: boolean) { online = value; sync(); },
    setActive(value: boolean) { active = value; sync(); },
    stop,
  };
}
