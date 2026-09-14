import { randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

/** The only claims carried by a demo developer app token. */
export interface AppTokenClaims {
  sub: string;
  org: string;
  scopes: string[];
  exp: number;
}

export interface RegisteredApp {
  id: string;
  name: string;
  org: string;
  scopes: string[];
  createdAt: string;
}

export interface RegisterAppInput {
  name: string;
  org: string;
  scopes?: readonly string[];
  id?: string;
  createdAt?: string;
}

export interface AppRegistryOptions {
  /** A private HS256 secret. Production key management is outside this demo. */
  secret: Uint8Array | string;
  tokenTtlSeconds?: number;
  now?: () => number;
}

export class AppRegistry {
  private readonly apps = new Map<string, RegisteredApp>();
  readonly secret: Uint8Array;
  readonly tokenTtlSeconds: number;
  readonly now: () => number;

  constructor(options: AppRegistryOptions) {
    this.secret = typeof options.secret === "string"
      ? new TextEncoder().encode(options.secret)
      : options.secret;
    if (this.secret.byteLength < 32) {
      throw new Error("App token secret must be at least 32 bytes");
    }
    this.tokenTtlSeconds = options.tokenTtlSeconds ?? 15 * 60;
    if (!Number.isInteger(this.tokenTtlSeconds) || this.tokenTtlSeconds < 1) {
      throw new Error("tokenTtlSeconds must be a positive integer");
    }
    this.now = options.now ?? Date.now;
  }

  register(input: RegisterAppInput): RegisteredApp {
    return registerApp(this, input);
  }

  get(appId: string): RegisteredApp | undefined {
    const app = this.apps.get(appId);
    return app ? { ...app, scopes: [...app.scopes] } : undefined;
  }

  issue(appId: string): Promise<string> {
    return issueAppToken(this, appId);
  }

  async verify(token: string): Promise<AppTokenClaims> {
    return verifyAppToken(this, token);
  }

  /** Internal registry mutation kept behind the public registration function. */
  add(app: RegisteredApp): void {
    if (this.apps.has(app.id)) throw new Error(`App "${app.id}" is already registered`);
    this.apps.set(app.id, app);
  }
}

export function createAppRegistry(options: AppRegistryOptions): AppRegistry {
  return new AppRegistry(options);
}

export function registerApp(registry: AppRegistry, input: RegisterAppInput): RegisteredApp {
  const name = input.name.trim();
  const org = input.org.trim();
  if (!name) throw new Error("App name is required");
  if (!org) throw new Error("App org is required");

  const scopes = [...new Set(input.scopes ?? ["inference"])]
    .map((scope) => scope.trim())
    .filter(Boolean);
  if (scopes.length === 0) throw new Error("At least one app scope is required");

  const app: RegisteredApp = {
    id: input.id?.trim() || `app_${randomUUID()}`,
    name,
    org,
    scopes,
    createdAt: input.createdAt ?? new Date(registry.now()).toISOString(),
  };
  registry.add(app);
  return { ...app, scopes: [...app.scopes] };
}

export async function issueAppToken(registry: AppRegistry, appId: string): Promise<string> {
  const app = registry.get(appId);
  if (!app) throw new Error(`App "${appId}" is not registered`);
  const exp = Math.floor(registry.now() / 1000) + registry.tokenTtlSeconds;

  // This intentionally mirrors the existing jose approach without importing
  // the cloud router. No iat, kit, aud, or other claims are added.
  return new SignJWT({ org: app.org, scopes: app.scopes })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(app.id)
    .setExpirationTime(exp)
    .sign(registry.secret);
}

export async function verifyAppToken(
  registry: AppRegistry,
  token: string,
): Promise<AppTokenClaims> {
  const { payload } = await jwtVerify(token, registry.secret, {
    algorithms: ["HS256"],
    currentDate: new Date(registry.now()),
  });

  const keys = Object.keys(payload).sort();
  if (keys.join(",") !== "exp,org,scopes,sub") {
    throw new Error("Invalid app token: claims must be sub, org, scopes, and exp");
  }
  if (
    typeof payload.sub !== "string" ||
    typeof payload.org !== "string" ||
    !Array.isArray(payload.scopes) ||
    !payload.scopes.every((scope): scope is string => typeof scope === "string") ||
    typeof payload.exp !== "number"
  ) {
    throw new Error("Invalid app token claims");
  }

  const app = registry.get(payload.sub);
  if (!app || app.org !== payload.org) {
    throw new Error("Invalid app token: app is not registered for this org");
  }
  return {
    sub: payload.sub,
    org: payload.org,
    scopes: [...payload.scopes],
    exp: payload.exp,
  };
}

export function bearerToken(request: Request): string | null {
  const value = request.headers.get("authorization");
  if (!value) return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(value.trim());
  return match?.[1] ?? null;
}
