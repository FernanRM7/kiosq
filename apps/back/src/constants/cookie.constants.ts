/** Name of the HttpOnly cookie that stores the WorkOS sealed session. */
export const SESSION_COOKIE_NAME = "wos-session";

/** Name of the HttpOnly cookie that stores the cashier session id. */
export const CASHIER_SESSION_COOKIE_NAME = "cashier-session";

/** Host-only cookie used once to correlate the WorkOS OAuth callback. */
export const OAUTH_STATE_COOKIE_NAME = "__Host-kiosq-oauth-state";

/** Cashier sessions are intentionally shorter than administrator sessions. */
export const CASHIER_SESSION_TTL_SECONDS = 12 * 60 * 60;

const OAUTH_STATE_TTL_SECONDS = 10 * 60;

function resolveSameSite(): "lax" | "none" | "strict" {
  const configured = process.env.WORKOS_COOKIE_SAMESITE;

  if (
    configured === "lax" ||
    configured === "none" ||
    configured === "strict"
  ) {
    return configured;
  }

  if (configured) {
    throw new Error("WORKOS_COOKIE_SAMESITE debe ser 'lax', 'none' o 'strict'");
  }

  return process.env.VERCEL ? "none" : "lax";
}

const COOKIE_SAME_SITE = resolveSameSite();

/**
 * Options applied when writing or clearing the cashier session cookie.
 *
 * Cashier sessions expire after a bounded shift-length window even if the
 * operator forgets to log out.
 */
export const CASHIER_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: CASHIER_SESSION_TTL_SECONDS * 1000,
  path: "/",
  sameSite: COOKIE_SAME_SITE,
  secure: true,
} as const;

export const OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: OAUTH_STATE_TTL_SECONDS * 1000,
  path: "/",
  sameSite: COOKIE_SAME_SITE === "strict" ? "lax" : COOKIE_SAME_SITE,
  secure: true,
} as const;

/**
 * Options applied when writing or clearing the session cookie.
 *
 * - httpOnly: prevents client-side JS from reading the cookie (XSS protection)
 * - secure:   always true - Chrome requires Secure for cross-origin cookies, and
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
  sameSite: COOKIE_SAME_SITE,
  secure: true,
} as const;
