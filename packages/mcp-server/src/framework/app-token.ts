import { SignJWT, jwtVerify } from "jose";

const getSecret = () => {
  const secret = process.env.MCP_JWT_SECRET;
  if (!secret) throw new Error("MCP_JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
};

export interface AppTokenPayload {
  sub: string; // userId
  kit: string; // kitId
}

export async function signAppToken(payload: AppTokenPayload): Promise<string> {
  return new SignJWT({ kit: payload.kit })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getSecret());
}

export async function verifyAppToken(token: string): Promise<AppTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  if (!payload.sub || !payload.kit) {
    throw new Error("Invalid app token: missing sub or kit");
  }
  return {
    sub: payload.sub as string,
    kit: payload.kit as string,
  };
}
