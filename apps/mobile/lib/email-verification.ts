export const EMAIL_VERIFICATION_OTP_LENGTH = 6;

export function normalizeVerificationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeVerificationOtp(otp: string): string {
  return otp.replace(/\s+/g, '').trim();
}

export function isCompleteVerificationOtp(otp: string): boolean {
  return new RegExp(`^\\d{${String(EMAIL_VERIFICATION_OTP_LENGTH)}}$`).test(
    normalizeVerificationOtp(otp)
  );
}

const LINK_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function parseVerificationSearchParams(params: {
  email?: string | string[];
  otp?: string | string[];
  token?: string | string[];
}): { email: string; otp: string; token: string } | null {
  const first = (value?: string | string[]) =>
    Array.isArray(value) ? value[0] : value;
  const emailRaw = first(params.email);
  if (!emailRaw) return null;
  const email = normalizeVerificationEmail(emailRaw);
  if (!email.includes('@')) return null;
  const token = first(params.token)?.trim() ?? '';
  if (LINK_TOKEN.test(token)) return { email, otp: '', token };
  const otp = normalizeVerificationOtp(first(params.otp) ?? '');
  if (!isCompleteVerificationOtp(otp)) return null;
  return { email, otp, token: '' };
}
