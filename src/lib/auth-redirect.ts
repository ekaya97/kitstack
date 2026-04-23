/**
 * Build a login URL that returns the user to the current page after auth,
 * optionally with a pending action to execute on return.
 *
 * Example: loginUrl("/skills/crm-kit", "wishlist")
 *   => "/login?redirect=/skills/crm-kit&action=wishlist"
 */
export function loginUrl(returnTo: string, action?: string): string {
  const params = new URLSearchParams({ redirect: returnTo });
  if (action) params.set("action", action);
  return `/login?${params.toString()}`;
}

/**
 * Get the redirect URL from the current page's search params.
 * Falls back to "/dashboard" if no redirect is specified.
 */
export function getRedirectUrl(searchParams: URLSearchParams): string {
  return searchParams.get("redirect") || "/dashboard";
}
