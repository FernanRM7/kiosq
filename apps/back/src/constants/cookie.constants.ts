/** Name of the HttpOnly cookie that stores the WorkOS sealed session */
export const SESSION_COOKIE_NAME = "wos-session";

/**
 * Options applied when writing or clearing the session cookie.
 *
 * - httpOnly:  prevents client-side JS from reading the cookie (XSS protection)
 * - secure:    always true — Chrome requires Secure for cross-origin cookies, and
 *              Chrome accepts Secure cookies on localhost without HTTPS
 * - sameSite:  'lax' prevents CSRF for state-mutating requests (POST, DELETE, PUT)
 *              sent by external sites, while still allowing same-site cross-port
 *              dev fetch calls (frontend on port 5173 → backend on port 3000).
 *              'none' would allow the cookie from any origin and require an
 *              Anti-CSRF mechanism; 'lax' eliminates that need.
 * - path:      scoped to the entire application
 * - maxAge:    7-day rolling window (matches WorkOS default session duration)
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: 7 * 24 * 60 * 60,
  path: "/",
  sameSite: "lax" as const,
  secure: true,
} as const;
