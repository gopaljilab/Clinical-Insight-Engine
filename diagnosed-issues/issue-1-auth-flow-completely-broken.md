# Issue: Clinician Authentication Flow Completely Broken — Login, OTP Verification, and OTP Resend Non-Functional

**Severity:** Critical  
**Area:** `server/auth.ts`  
**Type:** Bug / Regression

## Description

The clinician authentication flow is broken at three critical endpoints due to references to undefined variables and reliance on a removed in-memory state. Users cannot log in, cannot verify OTPs, and cannot resend OTPs, making the entire provider-facing application inaccessible.

## Root Cause Analysis

### 1. `POST /api/auth/login` — Login Handler (lines 336–409)

The login handler references `userName` which is **never declared** in any scope:

```typescript
// Line 348 — userName is never declared; throws ReferenceError
if (!userName) {
```

Additionally, on line 363, the handler references `registeredUsers.get(email)` — an in-memory `Map` that was removed during a past refactor. Because `userName` throws a `ReferenceError` on line 348, the entire OTP generation and email-sending logic (lines 370–390) never executes. Every login attempt results in a 500 error.

There is also duplicated dead-code at lines 349–368 where the same DB query executes a second time redundantly.

### 2. `POST /api/auth/verify-otp` — OTP Verification (lines 497–605)

This endpoint has multiple issues:

- **Line 497:** Uses `otpLimiter` — a rate limiter that is **never defined** anywhere in the file.
- **Line 497:** Uses `verifyOtpDTOSchema` — a Zod schema that is **not imported** (only `verifyEmailDTOSchema` exists).
- **Lines 500, 512, 525, 547:** Relies on `pendingOtps.get(email)`, `.delete(email)`, `.set(email)` — an in-memory `Map<string, OTPEntry>` that was **never defined** in this file.

The entire endpoint operates on a non-existent in-memory OTP store instead of the DB-backed `email_verification_tokens` table that was implemented for the `/verify-email` endpoint. This means every OTP verification attempt fails.

### 3. `POST /api/auth/resend-otp` — OTP Resend (lines 415–491)

This handler also references multiple undefined symbols:

- **Line 426:** `if (mode === "login")` — `mode` is **never defined**.
- **Lines 427, 434, 438:** `pendingOtps.get(email)`, `.delete(email)`, `.set(...)` — same non-existent Map.
- **Line 439:** `sendVerificationCode(email, otp)` — this function is **not imported** (only `sendVerificationEmail` is imported from `../email`).

The entire `mode === "login"` branch is dead code that throws `ReferenceError` at runtime.

## Impact

- **Users cannot log in** — the login endpoint errors before sending an OTP.
- **Users cannot verify OTPs** — the verify-otp endpoint references a non-existent in-memory store.
- **Users cannot resend OTPs** — the resend-otp endpoint crashes on undefined variables.
- **Registration cannot complete** — the verify-otp dead-end leaves registrations perpetually unverified.
- **Complete authentication denial-of-service** — the provider application is unreachable.

## Required Changes

1. **Fix login handler (lines 336–409):**
   - Remove the `userName` variable and its surrounding dead code (lines 348–368).
   - Ensure OTP is generated, stored in `email_verification_tokens` table, and emailed on every valid login attempt.
   - The correct flow should: validate credentials → generate OTP → invalidate old unused tokens → insert new token → send email → return `{ success: true, pendingEmail: email }`.

2. **Fix verify-otp handler (lines 497–605):**
   - Define or import `otpLimiter` and `verifyOtpDTOSchema` (or reuse `verifyEmailLimiter` and `verifyEmailDTOSchema`).
   - Replace all `pendingOtps` references with DB queries against `email_verification_tokens` table (matching the pattern used in the `/verify-email` endpoint at lines 614–749).
   - **Alternatively**, consolidate with `/verify-email` to eliminate the duplicate endpoint.

3. **Fix resend-otp handler (lines 415–491):**
   - Remove the dead `mode === "login"` branch (lines 426–446) that references `pendingOtps` and `sendVerificationCode`.
   - Import `sendVerificationEmail` and use it directly.
   - Ensure resend invalidates old tokens and creates new ones in the `email_verification_tokens` table.

4. **Verify all imports** in `auth.ts` — ensure `verifyEmailLimiter` (line 79), `verifyEmailDTOSchema` (auth.dto.ts line 24), and `sendVerificationEmail` are all properly accessible.

## Files Modified

- `server/auth.ts` — main fix
- `server/validation/auth.dto.ts` — verify import exists (line 29 confirms `verifyOtpDTOSchema` is defined but not imported in `auth.ts`)

## Verification

- Unit tests should validate login → OTP → verify-OTP → authenticated session flow
- All three endpoints should return proper HTTP status codes with valid JSON responses
- OTP should be stored in `email_verification_tokens` table and respect the 3-attempt lockout
