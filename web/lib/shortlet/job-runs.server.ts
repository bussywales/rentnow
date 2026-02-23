import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export type ShortletJobRunStatus = "started" | "succeeded" | "failed";

function normalizeRunKey(runKey: string) {
  const trimmed = String(runKey || "").trim();
  return trimmed.slice(0, 200);
}

function toErrorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  return String(value || "").trim() || "Unable to persist shortlet job run";
}

export function createShortletJobRunKey(input?: {
  jobName?: string;
  now?: Date;
  suffix?: string;
}) {
  const now = input?.now ?? new Date();
  const iso = now.toISOString();
  const job = String(input?.jobName || "shortlet_job").trim().replace(/[^a-z0-9_-]+/gi, "_");
  const suffix = String(input?.suffix || crypto.randomUUID()).trim().replace(/[^a-z0-9_-]+/gi, "_");
  return normalizeRunKey(`${job}:${iso}:${suffix}`);
}

export async function startShortletJobRun(input: {
  client: UntypedAdminClient;
  jobName: string;
  runKey: string;
  startedAt?: Date;
}) {
  const runKey = normalizeRunKey(input.runKey);
  if (!runKey) throw new Error("RUN_KEY_REQUIRED");
  const jobName = String(input.jobName || "").trim() || "shortlet_job";
  const startedAt = (input.startedAt ?? new Date()).toISOString();
  const result = await input.client.from("shortlet_job_runs").upsert(
    {
      job_name: jobName,
      run_key: runKey,
      started_at: startedAt,
      status: "started",
      meta: {},
      error: null,
      finished_at: null,
    },
    { onConflict: "run_key" }
  );

  if (result.error) {
    throw new Error(toErrorMessage(result.error));
  }
}

export async function finishShortletJobRun(input: {
  client: UntypedAdminClient;
  runKey: string;
  status: Exclude<ShortletJobRunStatus, "started">;
  finishedAt?: Date;
  meta?: Record<string, unknown>;
  error?: string | null;
}) {
  const runKey = normalizeRunKey(input.runKey);
  if (!runKey) throw new Error("RUN_KEY_REQUIRED");
  const result = await input.client
    .from("shortlet_job_runs")
    .update({
      status: input.status,
      finished_at: (input.finishedAt ?? new Date()).toISOString(),
      meta: input.meta ?? {},
      error: input.error ?? null,
    })
    .eq("run_key", runKey);

  if (result.error) {
    throw new Error(toErrorMessage(result.error));
  }
}
