import { loadCredentials } from "./credentials";

export interface CliApiClientOptions {
  readonly baseUrl?: string;
  readonly token: string;
  readonly fetch?: typeof globalThis.fetch;
}

export class CliApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "CliApiError";
  }
}

/** Small authenticated client shared by CLI operations. */
export class CliApiClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(private readonly options: CliApiClientOptions) {
    this.baseUrl = (options.baseUrl ?? process.env.KITSTACK_API_URL ?? "https://kitstack.co").replace(/\/$/, "");
    this.fetcher = options.fetch ?? globalThis.fetch;
    if (!this.fetcher) throw new Error("A fetch implementation is required");
    if (!options.token.trim()) throw new Error("KitStack API token is required");
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = path.startsWith("http://") || path.startsWith("https://")
      ? path
      : `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.options.token}`);
    if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

    const response = await this.fetcher(url, { ...init, headers });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try { body = JSON.parse(text); } catch { body = text; }
    }
    if (!response.ok) {
      const detail = typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : `HTTP ${response.status}`;
      throw new CliApiError(detail, response.status, body);
    }
    return body as T;
  }
}

export function authenticatedCliClient(): CliApiClient {
  const credentials = loadCredentials();
  if (!credentials) throw new Error("Not logged in. Run: kitstack login");
  return new CliApiClient({ token: credentials.token });
}

export function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}
