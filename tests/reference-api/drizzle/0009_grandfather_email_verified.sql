-- Grandfather existing accounts before email verification became required.
-- Users were created with email_verified=false while verification was never
-- enforced; turning on requireEmailVerification would lock them out of
-- password sign-in. New signups after this migration still start unverified.
UPDATE "user"
SET email_verified = true
WHERE email_verified = false;
