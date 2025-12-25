import { NextResponse } from "next/server";
import { z } from "zod";
import { DEV_MOCKS } from "@/lib/env";
import { getUserRole, requireUser } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";
import { mockProperties } from "@/lib/mock";
import type { Message } from "@/lib/types";

const messageSchema = z.object({
  property_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  body: z.string().min(1),
});

export async function GET(request: Request) {
  const startTime = Date.now();
  const routeLabel = "/api/messages";
  const url = new URL(request.url);
  const propertyId = url.searchParams.get("propertyId");
  let messages: Message[] = [];

  if (!propertyId) {
    return NextResponse.json({ messages });
  }

  if (!hasServerSupabaseEnv()) {
    if (DEV_MOCKS) {
      return NextResponse.json({
        messages: [
          {
            id: "demo-message",
            property_id: propertyId,
            sender_id: "demo-tenant",
            recipient_id: mockProperties[0]?.owner_id || "demo-owner",
            body: "Demo mode: connect Supabase to enable real messaging.",
            created_at: new Date().toISOString(),
          },
        ],
      });
    }
    logFailure({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      { error: "Supabase is not configured; messaging is unavailable.", messages: [] },
      { status: 503 }
    );
  }

  try {
    const auth = await requireUser({ request, route: routeLabel, startTime });
    if (!auth.ok) return auth.response;

    const supabase = auth.supabase;
    const role = await getUserRole(supabase, auth.user.id);

    let query = supabase
      .from("messages")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: true });

    if (role !== "admin") {
      query = query.or(
        `sender_id.eq.${auth.user.id},recipient_id.eq.${auth.user.id}`
      );
    }

    const { data, error } = await query;

    if (error) {
      if (!DEV_MOCKS) {
        logFailure({
          request,
          route: routeLabel,
          status: 500,
          startTime,
          error: new Error(error.message),
        });
        return NextResponse.json(
          { error: error.message, messages: [] },
          { status: 500 }
        );
      }
    } else if (data) {
      messages = data;
    }
  } catch (err: unknown) {
    if (DEV_MOCKS) {
      messages = [
        {
          id: "mock-msg-1",
          property_id: propertyId,
          sender_id: "tenant-1",
          recipient_id: mockProperties[0]?.owner_id,
          body: "Is this still available next month?",
          created_at: new Date().toISOString(),
        },
      ];
    } else {
      logFailure({
        request,
        route: routeLabel,
        status: 500,
        startTime,
        error: err,
      });
      return NextResponse.json(
        { error: "Unable to load messages.", messages: [] },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const routeLabel = "/api/messages";

  if (!hasServerSupabaseEnv()) {
    logFailure({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      { error: "Supabase is not configured; messaging is available in live mode only." },
      { status: 503 }
    );
  }

  try {
    const auth = await requireUser({ request, route: routeLabel, startTime });
    if (!auth.ok) return auth.response;
    const supabase = auth.supabase;
    const role = await getUserRole(supabase, auth.user.id);

    const body = await request.json();
    const payload = messageSchema.parse(body);

    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, owner_id, is_approved, is_active")
      .eq("id", payload.property_id)
      .maybeSingle();

    if (propertyError || !property) {
      logFailure({
        request,
        route: routeLabel,
        status: 404,
        startTime,
        error: "Property not found",
      });
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const isAdmin = role === "admin";
    const isOwner = auth.user.id === property.owner_id;
    const isPublished = property.is_approved === true && property.is_active === true;

    if (!isPublished && !isOwner && !isAdmin) {
      logFailure({
        request,
        route: routeLabel,
        status: 403,
        startTime,
        error: "Property not published",
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (isOwner) {
      const { data: existingThread } = await supabase
        .from("messages")
        .select("id")
        .eq("property_id", payload.property_id)
        .or(
          `and(sender_id.eq.${auth.user.id},recipient_id.eq.${payload.recipient_id}),and(sender_id.eq.${payload.recipient_id},recipient_id.eq.${auth.user.id})`
        )
        .limit(1);

      if (!existingThread?.length && !isAdmin) {
        logFailure({
          request,
          route: routeLabel,
          status: 403,
          startTime,
          error: "Owner cannot start new thread",
        });
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (payload.recipient_id !== property.owner_id && !isAdmin) {
      logFailure({
        request,
        route: routeLabel,
        status: 403,
        startTime,
        error: "Recipient must be owner",
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        ...payload,
        sender_id: auth.user.id,
      })
      .select()
      .single();

    if (error) {
      logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(error.message),
      });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unable to send message";
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: err,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
