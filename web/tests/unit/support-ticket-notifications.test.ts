import test from "node:test";
import assert from "node:assert/strict";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { notifyAdminsOfSupportTicket } from "@/lib/support/support-ticket-notifications.server";

void test("support ticket notifications send standard requests only to admins opted into all support requests", async () => {
  const sentTo: string[] = [];
  const result = await notifyAdminsOfSupportTicket(
    {
      requestId: "support-1",
      category: "billing",
      role: "tenant",
      name: "Tenant User",
      email: "tenant@example.com",
      message: "I need help with a duplicate billing charge.",
      metadata: { submittedAt: "2026-04-12T10:00:00.000Z" },
      escalated: false,
    },
    {
      hasServiceRoleEnv: () => true,
      createServiceRoleClient: () => ({}) as ReturnType<typeof createServiceRoleClient>,
      getSiteUrl: async () => "https://www.propatyhub.com",
      loadAdminProfiles: async () => [
        {
          id: "admin-1",
          role: "admin",
          support_request_email_enabled: true,
          support_escalation_email_enabled: false,
        },
        {
          id: "admin-2",
          role: "admin",
          support_request_email_enabled: false,
          support_escalation_email_enabled: true,
        },
      ],
      getAdminEmail: async (_client, userId) =>
        userId === "admin-1" ? "ops1@example.com" : "ops2@example.com",
      sendEmail: async ({ to, subject, html }) => {
        sentTo.push(to);
        assert.match(subject, /\[Support\]/);
        assert.match(html, /duplicate billing charge/i);
        assert.match(html, /\/admin\/support/);
        return { ok: true };
      },
    }
  );

  assert.deepEqual(sentTo, ["ops1@example.com"]);
  assert.deepEqual(result, {
    ok: true,
    attempted: 1,
    sent: 1,
    skipped: 1,
  });
});

void test("support ticket notifications send escalations to all-support and escalation-only admins", async () => {
  const sentTo: string[] = [];
  const result = await notifyAdminsOfSupportTicket(
    {
      requestId: "support-2",
      category: "listing",
      role: "guest",
      name: null,
      email: "guest@example.com",
      message: "The listing page fails after Ask Assistant could not resolve the issue.",
      metadata: { escalationReason: "low_confidence" },
      escalated: true,
    },
    {
      hasServiceRoleEnv: () => true,
      createServiceRoleClient: () => ({}) as ReturnType<typeof createServiceRoleClient>,
      getSiteUrl: async () => "https://www.propatyhub.com",
      loadAdminProfiles: async () => [
        {
          id: "admin-1",
          role: "admin",
          support_request_email_enabled: true,
          support_escalation_email_enabled: false,
        },
        {
          id: "admin-2",
          role: "admin",
          support_request_email_enabled: false,
          support_escalation_email_enabled: true,
        },
        {
          id: "admin-3",
          role: "admin",
          support_request_email_enabled: false,
          support_escalation_email_enabled: false,
        },
      ],
      getAdminEmail: async (_client, userId) => `${userId}@example.com`,
      sendEmail: async ({ to, subject, html }) => {
        sentTo.push(to);
        assert.match(subject, /\[Support escalation\]/);
        assert.match(html, /Escalated support request/);
        return { ok: true };
      },
    }
  );

  assert.deepEqual(sentTo, ["admin-1@example.com", "admin-2@example.com"]);
  assert.deepEqual(result, {
    ok: true,
    attempted: 2,
    sent: 2,
    skipped: 1,
  });
});
