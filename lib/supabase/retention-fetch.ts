type LogRecord = Record<string, string | number | boolean>;

// Retry only explicit PostgREST JWT rejections. Never replay a successful
// mutation or an ambiguous network failure. Scoped to the retention client.
export function createRetentionFetch(runId: string, options: {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  log?: (level: "warn" | "info", record: LogRecord) => void;
} = {}): typeof fetch {
  const transport = options.fetch ?? globalThis.fetch;
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const log = options.log ?? ((level, record) => console[level](JSON.stringify(record)));
  const delays = [1000, 2000];
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const canRetry = url.pathname.startsWith("/rest/v1/") && ["GET", "PATCH"].includes(method);
    const template = input instanceof Request ? input.clone() : input;
    for (let attempt = 0; ; attempt++) {
      const response = await transport(template instanceof Request ? template.clone() : template, { ...init, cache: "no-store" });
      let code: unknown;
      if (canRetry && response.status === 401) {
        try { code = (await response.clone().json()).code; } catch { /* Not a PostgREST response. */ }
      }
      if (code !== "PGRST303" || attempt >= delays.length) {
        if (attempt && response.ok) log("info", { event: "retention.auth_recovered", runId, path: url.pathname, attempts: attempt + 1 });
        return response;
      }
      log("warn", { event: "retention.auth_retry", runId, path: url.pathname, status: 401, code: "PGRST303", attempt: attempt + 1, delayMs: delays[attempt] });
      await sleep(delays[attempt]);
    }
  };
}
