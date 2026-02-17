// Sentry Auth Setup
// Place your Sentry token in .env.local as SENTRY_AUTH_TOKEN=your_token_here

export function getSentryAuthToken(): string {
  if (!process.env.SENTRY_AUTH_TOKEN) {
    throw new Error('SENTRY_AUTH_TOKEN is not set in environment variables.');
  }
  return process.env.SENTRY_AUTH_TOKEN;
}

export function getSentryAuthHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getSentryAuthToken()}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}
