/** Name of the HttpOnly cookie that stores the WorkOS sealed session */
export const SESSION_COOKIE_NAME = "wos-session";

/**
 * Options applied when writing or clearing the session cookie.
 *
 * - httpOnly:  prevents client-side JS from reading the cookie (XSS protection)
 * - secure:    only sent over HTTPS in production
 * - sameSite:  'lax' protects against CSRF while allowing top-level navigation
 * - path:      scoped to the entire application
 * - maxAge:    7-day rolling window (matches WorkOS default session duration)
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: 7 * 24 * 60 * 60,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
} as const;
