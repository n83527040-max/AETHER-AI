// Minimal ambient declarations so `tsc` can typecheck the Deno entrypoint in
// environments without the Deno type library. Deno itself provides these.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
    toObject(): Record<string, string | undefined>;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
  upgradeWebSocket(request: Request): { socket: WebSocket; response: Response };
  openKv(): Promise<unknown>;
};
