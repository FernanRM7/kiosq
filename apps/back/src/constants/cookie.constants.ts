/** Name of the HttpOnly cookie that stores the WorkOS sealed session */
export const SESSION_COOKIE_NAME = "wos-session";

/**
 * Options applied when writing or clearing the session cookie.
 *
 * - httpOnly:  prevents client-side JS from reading the cookie (XSS protection)
 * - secure:    always true — Chrome requires Secure for SameSite=None, and
 *              Chrome accepts Secure cookies on localhost without HTTPS
 * - sameSite:  'none' allows the cookie to be sent cross-origin (frontend on
 *              port 5173 → backend on port 3000). This is safe because the
 *              cookie is HttpOnly and carries a WorkOS-sealed session.
 * - path:      scoped to the entire application
 * - maxAge:    7-day rolling window (matches WorkOS default session duration)
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: 7 * 24 * 60 * 60,
  path: "/",
  sameSite: "none" as const,
  secure: true,
} as const;
