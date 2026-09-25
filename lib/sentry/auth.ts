// Sentry Auth Setup
// Place your Sentry token in .env.local as SENTRY_AUTH_TOKEN=your_token_here

/**
 * Reads the Sentry auth token from the `SENTRY_AUTH_TOKEN` environment variable.
 *
 * @remarks
 * The token is never cached; every call reads `process.env` directly.
 * The token should be set in `.env.local`.
 *
 * @returns The Sentry auth token string.
 * @throws Error When `SENTRY_AUTH_TOKEN` is not set.
 */
export function getSentryAuthToken(): string {
  if (!process.env.SENTRY_AUTH_TOKEN) {
    throw new Error('SENTRY_AUTH_TOKEN is not set in environment variables.');
  }
  return process.env.SENTRY_AUTH_TOKEN;
}

/**
 * Builds the HTTP Authorization headers for Sentry API requests.
 *
 * @remarks
 * Uses the token from {@link getSentryAuthToken} to construct a Bearer
 * Authorization header with JSON content type.
 *
 * @returns An object with `Authorization`, `Content-Type`, and `Accept` headers.
 * @throws Error Propagated from {@link getSentryAuthToken} when the token is not set.
 */
export function getSentryAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getSentryAuthToken()}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}
