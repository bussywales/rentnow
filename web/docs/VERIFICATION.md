# Verification Center (P1)

## Status definitions
- **Email verified**: Supabase Auth `email_confirmed_at` is present (derived server-side).
- **Phone verified**: `user_verifications.phone_verified_at` is set.
- **Bank verified**: `user_verifications.bank_verified_at` is set (manual admin toggle in P1).
- **Overall identity**: email + phone verified. Bank is displayed but not required for the public trust pill in P1.

## Tables
- `public.user_verifications`: verification timestamps, phone E.164, bank metadata.
- `public.verification_otps`: fallback OTP storage for phone verification via email.

## RLS summary
- Users can select their own verification row.
- Updates to verification timestamps are server-controlled.
- Admins can read/update all (bank verification toggle logs to `admin_actions_log`).

## Future plan
- Bank verification will be swapped for Stripe Connect/KYB without changing the UI contract.
