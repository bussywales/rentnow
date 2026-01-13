# Auth UI Ops

## Navigation sync after login
The top navigation links are rendered server-side based on the current session. After a
successful login redirect, the nav should reflect the authenticated state. If it does not:
1) Confirm the browser has an active Supabase session.
2) Log out and log back in.
3) Use the "Refresh session" action on `/onboarding` if the email confirmation banner persists.

## Email confirmation banner
The onboarding role page will auto-check the session and hide the confirmation banner once
an active session is detected. If the banner stays visible after confirming email, ask the
user to log in again or use the Refresh session action.

## Session cookie validation (Photos step)
Use this checklist when a logged-in user is bounced to `/auth/login` on the Photos step:
1) Open DevTools → Application → Cookies and confirm the Supabase auth cookies exist for the current domain.
2) Verify the cookie domain matches the production host (e.g. `.rentnow.space`) and is marked Secure.
3) Confirm `SameSite=Lax` and that the browser is not blocking third-party cookies.
4) Reload `/dashboard/properties/<id>?step=photos` and confirm the session persists.
5) If the issue persists, log out/in and retry the same URL to ensure the session refresh path works.

## Auth cookie persistence
Auth cookies are written server-side on `/auth/login` with canonical options (path `/`, SameSite=Lax,
Secure in prod, HttpOnly, and the canonical domain). Middleware refreshes sessions without clearing
cookies on failures; only the explicit logout flow clears auth cookies.
