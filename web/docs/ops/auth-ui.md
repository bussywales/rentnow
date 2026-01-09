# Auth UI Ops

## Navigation sync after login
The top navigation links are driven by the client auth state. After a successful login, the
nav should update automatically without a hard refresh. If it does not:
1) Confirm the browser has an active Supabase session.
2) Log out and log back in.
3) Use the "Refresh session" action on `/onboarding` if the email confirmation banner persists.

## Email confirmation banner
The onboarding role page will auto-check the session and hide the confirmation banner once
an active session is detected. If the banner stays visible after confirming email, ask the
user to log in again or use the Refresh session action.
