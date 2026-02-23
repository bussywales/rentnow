import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createShortletJobRunKey,
  finishShortletJobRun,
  startShortletJobRun,
} from "@/lib/shortlet/job-runs.server";

void test("shortlet job-runs migration creates table and status constraint", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260223101000_shortlet_job_runs.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();

  assert.match(sql, /create table if not exists public\.shortlet_job_runs/);
  assert.match(sql, /run_key text not null unique/);
  assert.match(sql, /status text not null check \(status in \('started', 'succeeded', 'failed'\)\)/);
});

void test("createShortletJobRunKey returns deterministic prefix-friendly key", () => {
  const runKey = createShortletJobRunKey({
    jobName: "shortlet_reminders",
    now: new Date("2026-02-23T12:00:00.000Z"),
    suffix: "gha-100",
  });

  assert.equal(runKey, "shortlet_reminders:2026-02-23T12:00:00.000Z:gha-100");
});

void test("startShortletJobRun upserts started row by run_key", async () => {
  let receivedTable = "";
  let receivedPayload: Record<string, unknown> | null = null;
  let receivedOnConflict = "";
  const client = {
    from(table: string) {
      receivedTable = table;
      return {
        async upsert(payload: Record<string, unknown>, options?: { onConflict?: string }) {
          receivedPayload = payload;
          receivedOnConflict = String(options?.onConflict || "");
          return { data: null, error: null };
        },
      };
    },
  };

  await startShortletJobRun({
    client: client as never,
    jobName: "shortlet_reminders",
    runKey: "run-123",
    startedAt: new Date("2026-02-23T12:00:00.000Z"),
  });

  assert.equal(receivedTable, "shortlet_job_runs");
  assert.equal(receivedOnConflict, "run_key");
  assert.equal(receivedPayload?.job_name, "shortlet_reminders");
  assert.equal(receivedPayload?.run_key, "run-123");
  assert.equal(receivedPayload?.status, "started");
});

void test("finishShortletJobRun updates status and counters by run_key", async () => {
  let receivedTable = "";
  let receivedUpdate: Record<string, unknown> | null = null;
  let receivedEq: { column: string; value: string } | null = null;

  const client = {
    from(table: string) {
      receivedTable = table;
      return {
        update(values: Record<string, unknown>) {
          receivedUpdate = values;
          return {
            async eq(column: string, value: string) {
              receivedEq = { column, value };
              return { data: null, error: null };
            },
          };
        },
      };
    },
  };

  await finishShortletJobRun({
    client: client as never,
    runKey: "run-456",
    status: "succeeded",
    meta: { sent: 5, due: 8 },
    finishedAt: new Date("2026-02-23T12:10:00.000Z"),
  });

  assert.equal(receivedTable, "shortlet_job_runs");
  assert.equal(receivedEq?.column, "run_key");
  assert.equal(receivedEq?.value, "run-456");
  assert.equal(receivedUpdate?.status, "succeeded");
  assert.deepEqual(receivedUpdate?.meta, { sent: 5, due: 8 });
});
