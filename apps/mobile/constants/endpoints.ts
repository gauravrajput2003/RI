type EndpointOptions = {
  apiUrl?: string;
  socketUrl?: string;
  webHostname?: string;
  expoHostUri?: string | null;
};

// Physical devices must use the computer running Metro, not the phone's localhost.
export function resolveEndpoints(options: EndpointOptions) {
  let hostname = options.webHostname || '10.0.2.2';
  if (!options.webHostname && options.expoHostUri) {
    try {
      hostname = new URL(`http://${options.expoHostUri}`).hostname;
    } catch {
      // Keep the Android emulator fallback when Metro has no usable host.
    }
  }
  const host = `http://${hostname}:3000`;
  return {
    apiUrl: options.apiUrl?.trim() || `${host}/api/v1`,
    socketUrl: options.socketUrl?.trim() || host,
  };
}
