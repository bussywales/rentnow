---
# PropatyHub Go-Live Runbook (Internal)

**Purpose:** A fast, repeatable checklist to validate PropatyHub is safe to ship (or re-ship) without breaking core flows.  
**Scope:** Web app + Supabase + settings toggles.  
**Time to run:** ~30–60 minutes.

---

## 0) Before you start

- ✅ You have access to:
  - Production URL
  - Supabase project + migrations history
  - Admin account + 1 tenant + 1 agent/landlord test account
- ✅ You know the target release (commit/tag) you’re deploying.

---

## 1) Build & environment sanity

- ✅ Deployer runtime is Node **20+**
- ✅ `npm run build` succeeds in CI/deploy environment
- ✅ Latest Supabase migrations applied to production (verify timestamps match repo)
- ✅ Secrets are server-side only (no service role keys exposed to client)

**Fail = stop launch.**

---

## 2) Role landings & navigation (must pass)

### Role landings
- **Admin** lands on: `/admin`
- **Tenant** lands on: `/tenant/home`
- **Agent/Landlord** lands on: `/home`

### Navigation checks (logged in as agent/landlord)
- Menu includes:
  - **Home**
  - **Collections**
  - **Saved searches**
  - **Referrals**
- ✅ `/saved-searches` redirects to correct role page

**Fail = fix before launch** (bad UX + support tickets).

---

## 3) Demo listings behaviour (prod expectation)

In production:
- ✅ Admin can see demo listings
- ✅ Non-admin browse/search does **not** include demo listings

Admin settings:
- `demo_badge_enabled` set as desired (admin-only visibility ok)
- `demo_watermark_enabled` set as desired (admin-only visibility ok)

---

## 4) Trust & verification (avoid “Identity pending everywhere”)

Admin Settings → Trust/Verification requirements:
- ✅ `verification_require_email` = **ON**
- ⛔ `verification_require_phone` = **OFF** (until SMS provider live)
- ⛔ `verification_require_bank` = **OFF** (until bank verification live)

Spot checks:
- ✅ Email-verified user shows **VERIFIED** (not “Identity pending”)
- ✅ Trust help page loads: `/help/trust`

---

## 5) Public sharing readiness (virality baseline)

### Collections share
1. Create or open a collection
2. Share → open link in incognito
3. ✅ `/collections/[shareId]` loads read-only
4. ✅ WhatsApp preview shows title/image (OG metadata works)

### Listing share (public)
1. Go to `/properties`
2. Click Share on a card → **Copy link**
3. ✅ Clipboard contains `/properties/[id]`
4. Click Share → **WhatsApp**
5. ✅ WhatsApp intent opens with message + URL
6. Go to `/properties/[id]` and repeat (detail share button)

### Agent page share
1. Open `/agents/[slug]` logged out
2. Click **Share profile**
3. ✅ Copy/WhatsApp/Native share works

---

## 6) Saved searches (retention foundation)

1. Go to `/properties`
2. Apply filters
3. Click **Follow this search**
4. ✅ Toast confirms follow + link to “View saved searches”
5. Open saved searches page:
   - Tenant: `/tenant/saved-searches`
   - Agent/Landlord: `/dashboard/saved-searches`
6. ✅ Toggle Pause/Resume works
7. ✅ “View matches” returns to `/properties` with filters applied

---

## 7) Referrals readiness (monetisation engine — can be “dark launched”)

Even with no real payments yet:

### Agent/Landlord
- ✅ `/dashboard/referrals` loads
- ✅ Default campaigns exist for a fresh account
- ✅ Tracked link click increases “clicks”
- ✅ Capture flow increases “captures”

### Admin (ops pages must not crash)
- ✅ `/admin/referrals/attribution` loads and is empty-safe
- ✅ `/admin/referrals/payouts` loads and is empty-safe (filters don’t crash)

> Note: Cashout/payouts can stay OFF until revenue begins; ops surfaces must still be stable.

---

## 8) Legal + trust surfaces

- ✅ Marketplace disclaimer can be acknowledged (“Got it”) and stays dismissed
- ✅ Terms / Privacy / Disclaimer pages load
- ✅ Mobile footer looks correct (links accessible; “More” works)

---

## 9) Performance / “no embarrassment” checks (mobile-first)

On iPhone-width viewport:
- ✅ Home feed loads without layout jumps
- ✅ Cards do not overflow (price/badges/buttons)
- ✅ Images have fallbacks (no broken thumbnails)
- ✅ Map does not show a broken state if coordinates are missing  
  - Preferred: hide map or show friendly message (not “no coordinates”)

---

## 10) Recommended launch toggles (default stance)

- Share tracking: **ON**
- Leaderboard: **ON** (initials-only preferred)
- Payouts by jurisdiction: **OFF** until real revenue
- Requires manual approval (cashouts): **ON** for first month
- Verification requirements: **email-only** (phone/bank OFF)

---

## Rollback rule

If any “must pass” section fails:
- Stop launch
- Roll back to last known-good tag/commit
- Log issue + fix forward

---

## Release record (fill in)

- Release date:
- Commit/tag:
- Checked by:
- Notes/issues found:
---
