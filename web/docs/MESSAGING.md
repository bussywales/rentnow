# Messaging

## Overview
- Threads are stored in `public.message_threads` with posts in `public.messages`.
- Read tracking is stored in `public.message_thread_reads`.

## Contact Exchange Protection
- Setting: `contact_exchange_mode` in `public.app_settings`
  - `off`: no filtering
  - `redact` (default): replaces contact details with `[email removed]` / `[phone removed]`
  - `block`: rejects messages that include contact details
- Applied server-side in:
  - `/api/messages`
  - `/api/messages/thread/[id]`
  - `/api/viewings/request`
  - `/api/viewings/respond`
- UI shows a small composer notice: “For your safety, contact details are hidden until booking is confirmed.”
