/** Name of the HttpOnly cookie that stores the WorkOS sealed session */
export const SESSION_COOKIE_NAME = "wos-session";

/** Name of the HttpOnly cookie that stores the cashier session id */
export const CASHIER_SESSION_COOKIE_NAME = "cashier-session";

/**
 * Options applied when writing or clearing the cashier session cookie.
 *
 * Same shape as SESSION_COOKIE_OPTIONS but with no maxAge (persistent
 * by design — the cashier stays logged in until explicitly logged out).
 */
export const CASHIER_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  path: "/",
  sameSite:
    (process.env.WORKOS_COOKIE_SAMESITE as "lax" | "none" | "strict") ??
    (process.env.VERCEL ? "none" : "lax"),
  secure: true,
} as const;

/**
 * Options applied when writing or clearing the session cookie.
 *
 * - httpOnly: prevents client-side JS from reading the cookie (XSS protection)
 * - secure:   always true — Chrome requires Secure for cross-origin cookies, and
 *             Chrome accepts Secure cookies on localhost without HTTPS
 * - sameSite: defaults to 'lax' for local development; in production (VERCEL)
 *             uses 'none' so the cookie is sent cross-origin when the frontend
 *             and backend live on different Vercel domains
 *             (e.g. kiosq-front.vercel.app → kiosq-back.vercel.app).
 *             When both are on the same custom domain, override with
 *             `WORKOS_COOKIE_SAMESITE=lax` in env.
 * - path:     scoped to the entire application
 * - maxAge:   7-day rolling window in milliseconds (Express expects ms).
 *             WorkOS default session duration is 7 days.
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
  sameSite:
    (process.env.WORKOS_COOKIE_SAMESITE as "lax" | "none" | "strict") ??
    (process.env.VERCEL ? "none" : "lax"),
  secure: true,
} as const;
