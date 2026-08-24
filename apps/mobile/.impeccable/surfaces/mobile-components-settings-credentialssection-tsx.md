---
version: 1
slug: 'mobile-components-settings-credentialssection-tsx'
primary_target: 'apps/mobile/components/settings/CredentialsSection.tsx'
related_targets:
  [
    'apps/mobile/app/(tabs)/settings.tsx',
    'apps/mobile/components/settings/PasswordSection.tsx',
  ]
---

# Surface: Settings credentials

## Scope

Operate mode. Settings credentials panel — email identity, change email (OTP), change password (reveal). Primary: `apps/mobile/components/settings/CredentialsSection.tsx`. Related: `PasswordSection.tsx` (legacy wrapper), `apps/mobile/app/(tabs)/settings.tsx`.

## Audience / job

Signed-in collectors adjusting account credentials without leaving the instrument Settings surface.

## Task

Scan current email + verification state; expand only when changing email or password; confirm new email via OTP before it becomes active.

## Constraints

Inherit DESIGN.md terminal war room. No new visual world. Mail-configured only for email change + reset link. Match AuthSlabCorners / ash hairline vocabulary used by SharedCollection and EmailVerification.

## Direction

Unified Credentials panel (scan-first expands). Assumption after unanswered brief probe: recommended unified structure with inline OTP (product already uses emailOTP).

## Memorable moment

Identity strip at rest; opening Change email reveals a tight new-address → code → commit ladder on the same slab.
