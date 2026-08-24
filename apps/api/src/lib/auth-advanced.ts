/** Railway overwrites X-Real-IP; Better Auth needs trustedProxies + a single-value X-Forwarded-For in production. */
export const AUTH_IP_ADDRESS_HEADERS = ['x-real-ip'] as const;

export function resolveAuthAdvanced(
  cookieDomain: string | undefined,
  options?: { useSecureCookies?: boolean }
) {
  const secure = options?.useSecureCookies ?? Boolean(cookieDomain);

  return {
    ipAddress: {
      ipAddressHeaders: [...AUTH_IP_ADDRESS_HEADERS],
    },
    defaultCookieAttributes: {
      secure,
      httpOnly: true,
      sameSite: 'lax' as const,
    },
    ...(cookieDomain
      ? {
          crossSubDomainCookies: {
            enabled: true as const,
            domain: cookieDomain,
          },
        }
      : {}),
  };
}
