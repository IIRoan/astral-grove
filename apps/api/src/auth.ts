import { expo } from '@better-auth/expo';
import { bearer, emailOTP } from 'better-auth/plugins';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import type { Database } from './db/client.js';
import { resolveAuthAdvanced } from './lib/auth-advanced.js';
import { resolveAuthCookieDomain } from './lib/auth-cookie-domain.js';
import { isEmailConfigured, sendTransactionalEmail } from './lib/email.js';
import type { Env } from './env.js';
import { resolveTrustedOrigins } from './lib/trusted-origins.js';
import { logActionFailure } from './lib/logger.js';
import {
  changeEmailOtpEmailContent,
  resolveVerificationAppUrl,
  verificationEmailContent,
} from './lib/verification-email.js';
import {
  resetPasswordEmailContent,
  resolvePasswordResetAppUrl,
} from './lib/password-reset-email.js';

export interface AuthApi {
  api: {
    getSession: (input: { headers: Headers }) => Promise<{
      user: { id: string; name: string; email: string; image?: string | null };
      session: { id: string; userId: string; expiresAt: Date };
    } | null>;
  };
  handler: (request: Request) => Response | Promise<Response>;
}

export type Auth = AuthApi;

export function createAuth(db: Database, env: Env): AuthApi {
  const cookieDomain = resolveAuthCookieDomain(env);
  const emailEnabled = isEmailConfigured(env);

  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg' }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      // New signups verify when mail is configured; existing accounts are grandfathered via 0009_grandfather_email_verified.sql.
      requireEmailVerification: emailEnabled,
      revokeSessionsOnPasswordReset: true,
      ...(emailEnabled
        ? {
            sendResetPassword: async ({
              user,
              url,
              token,
            }: {
              user: { email: string };
              url: string;
              token: string;
            }) => {
              const content = resetPasswordEmailContent({
                email: user.email,
                token,
                appUrl: resolvePasswordResetAppUrl(env),
                callbackUrl: url,
              });
              try {
                await sendTransactionalEmail(env, { to: user.email, ...content });
              } catch (error) {
                logActionFailure('auth.reset-email', error, { to: user.email });
                throw error;
              }
            },
          }
        : {}),
    },
    ...(emailEnabled
      ? {
          emailVerification: {
            sendOnSignUp: true,
            sendOnSignIn: true,
            autoSignInAfterVerification: true,
          },
        }
      : {}),
    plugins: [
      expo(),
      bearer(),
      // Always mount so /email-otp/* exists; sending still requires mail env.
      emailOTP({
        overrideDefaultEmailVerification: emailEnabled,
        changeEmail: {
          enabled: true,
        },
        async sendVerificationOTP(
          {
            email,
            otp,
            type,
          }: {
            email: string;
            otp: string;
            type: string;
          },
          ctx
        ) {
          if (type !== 'email-verification' && type !== 'change-email') return;
          if (!emailEnabled) {
            throw new Error('Email sending is not configured');
          }
          const currentEmail =
            typeof ctx?.context?.session?.user?.email === 'string'
              ? ctx.context.session.user.email
              : undefined;
          const content =
            type === 'change-email'
              ? changeEmailOtpEmailContent({
                  email,
                  otp,
                  ...(currentEmail ? { currentEmail } : {}),
                })
              : verificationEmailContent({
                  email,
                  otp,
                  appUrl: resolveVerificationAppUrl(env),
                });
          try {
            await sendTransactionalEmail(env, { to: email, ...content });
          } catch (error) {
            logActionFailure(
              type === 'change-email' ? 'auth.change-email-otp' : 'auth.verify-email',
              error,
              { to: email }
            );
            throw error;
          }
        },
      }),
    ],
    trustedOrigins: resolveTrustedOrigins(env),
    advanced: resolveAuthAdvanced(cookieDomain, {
      useSecureCookies:
        env.NODE_ENV === 'production' || env.BETTER_AUTH_URL.startsWith('https://'),
    }),
  }) as unknown as AuthApi;
}
