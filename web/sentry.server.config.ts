import * as Sentry from "@sentry/nextjs";
import { getSharedSentryOptions } from "@/lib/monitoring/sentry";

Sentry.init({
  ...getSharedSentryOptions("server"),
});
