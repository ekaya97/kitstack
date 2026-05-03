/**
 * Validate that a callback URL is a safe localhost URL.
 * Returns null if valid, or an error string if invalid.
 */
export function validateCallbackUrl(callback: string): string | null {
  let callbackUrl: URL;
  try {
    callbackUrl = new URL(callback);
  } catch {
    return "Invalid callback URL";
  }

  if (callbackUrl.protocol !== "http:") {
    return "Callback must use http:";
  }

  const allowedHosts = ["localhost", "127.0.0.1", "[::1]"];
  if (!allowedHosts.includes(callbackUrl.hostname)) {
    return "Callback must be localhost";
  }

  if (callbackUrl.username || callbackUrl.password) {
    return "Callback must not contain credentials";
  }

  const port = parseInt(callbackUrl.port || "80", 10);
  if (port < 1024 || port > 65535) {
    return "Callback port must be 1024-65535";
  }

  return null;
}
