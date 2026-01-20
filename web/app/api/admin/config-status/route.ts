import { NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/authz";
import { normalizeRole } from "@/lib/roles";
import { parseAppSettingBool } from "@/lib/settings/app-settings";

export async function GET() {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const role = normalizeRole(await getUserRole(supabase, user.id));
  if (role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { data } = await supabase
    .from("app_settings")
    .select("key,value")
    .in("key", [
      "enable_location_picker",
      "require_location_pin_for_publish",
      "show_tenant_checkin_badge",
    ]);

  const parseFlag = (key: string) =>
    parseAppSettingBool(data?.find((row) => row.key === key)?.value, false);

  return NextResponse.json({
    ok: true,
    flags: {
      enable_location_picker: parseFlag("enable_location_picker"),
      require_location_pin_for_publish: parseFlag("require_location_pin_for_publish"),
      show_tenant_checkin_badge: parseFlag("show_tenant_checkin_badge"),
    },
    env: {
      mapboxServerConfigured: !!process.env.MAPBOX_TOKEN,
      mapboxClientConfigured: !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    },
  });
}
