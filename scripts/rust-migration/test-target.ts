export function requireLocalTestDatabase(value: string | undefined): string {
  if (!value)
    throw new Error('TEST_DB_URL is required; never fall back to DATABASE_URL');
  const url = new URL(value);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/^\/riftbound_test(?:_[a-zA-Z0-9_]+)?$/.test(url.pathname)
  ) {
    throw new Error(
      'Test database must be loopback PostgreSQL with a riftbound_test name'
    );
  }
  return value;
}

export function requireLocalTestApi(value: string): string {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('Test API must be a loopback origin');
  }
  return url.origin;
}
