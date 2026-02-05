"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type ProfileRecord = {
  id: string;
  display_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
};

type Props = {
  userId: string;
  email: string;
  initialProfile: ProfileRecord | null;
};

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function ProfileFormClient({ userId, email, initialProfile }: Props) {
  const [profile, setProfile] = useState<ProfileRecord | null>(initialProfile);
  const [loadingProfile, setLoadingProfile] = useState(!initialProfile);
  const [displayName, setDisplayName] = useState(
    initialProfile?.display_name ?? initialProfile?.full_name ?? ""
  );
  const [phone, setPhone] = useState(initialProfile?.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initialProfile?.avatar_url ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState({
    displayName: initialProfile?.display_name ?? initialProfile?.full_name ?? "",
    phone: initialProfile?.phone ?? "",
    avatarUrl: initialProfile?.avatar_url ?? null,
  });

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (profile || !supabase) return;
    const load = async () => {
      setLoadingProfile(true);
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("id, display_name, full_name, phone, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      if (fetchError) {
        setError("Unable to load profile. Please try again.");
        setLoadingProfile(false);
        return;
      }
      const nextProfile = (data as ProfileRecord | null) ?? null;
      setProfile(nextProfile);
      const nextName = nextProfile?.display_name ?? nextProfile?.full_name ?? "";
      setDisplayName(nextName);
      setPhone(nextProfile?.phone ?? "");
      setAvatarUrl(nextProfile?.avatar_url ?? null);
      setSnapshot({
        displayName: nextName,
        phone: nextProfile?.phone ?? "",
        avatarUrl: nextProfile?.avatar_url ?? null,
      });
      setLoadingProfile(false);
    };
    void load();
  }, [profile, supabase, userId]);

  const initials = getInitials(displayName || email || "U");
  const hasChanges =
    displayName.trim() !== snapshot.displayName ||
    phone.trim() !== snapshot.phone ||
    avatarUrl !== snapshot.avatarUrl;

  const handleSave = async () => {
    if (!supabase || !profile) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const payload = {
      display_name: displayName.trim() || null,
      full_name: displayName.trim() || null,
      phone: phone.trim() || null,
      avatar_url: avatarUrl,
    };
    const { error: updateError } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", profile.id);
    if (updateError) {
      setError("Unable to save changes. Please try again.");
    } else {
      setSnapshot({
        displayName: payload.display_name ?? "",
        phone: payload.phone ?? "",
        avatarUrl,
      });
      setSuccess("Profile updated.");
    }
    setSaving(false);
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !supabase) return;
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Avatar must be 2MB or smaller.");
      event.target.value = "";
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Upload a PNG, JPG, or WebP image.");
      event.target.value = "";
      return;
    }
    if (!profile) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    const extension = file.name.split(".").pop() || "png";
    const path = `${profile.id}/${Date.now()}.${extension}`;
    const upload = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (upload.error) {
      setError("Unable to upload avatar. Please try again.");
      setUploading(false);
      event.target.value = "";
      return;
    }
    const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
    const nextUrl = publicData?.publicUrl ?? null;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: nextUrl })
      .eq("id", profile.id);
    if (updateError) {
      setError("Unable to save avatar. Please try again.");
    } else {
      setAvatarUrl(nextUrl);
      setSnapshot((prev) => ({
        ...prev,
        avatarUrl: nextUrl,
      }));
      setSuccess("Avatar updated.");
    }
    setUploading(false);
    event.target.value = "";
  };

  if (loadingProfile) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-32 rounded bg-slate-200" />
          <div className="h-24 w-24 rounded-full bg-slate-200" />
          <div className="h-10 w-full rounded bg-slate-200" />
          <div className="h-10 w-full rounded bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Avatar</h2>
        <p className="mt-1 text-sm text-slate-600">
          Add a friendly photo so tenants and hosts recognize you quickly.
        </p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xl font-semibold text-slate-600">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Profile avatar" width={96} height={96} />
            ) : (
              initials || "U"
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={uploading}
              />
              {uploading ? "Uploading..." : "Upload"}
            </label>
            <p className="text-xs text-slate-500">PNG, JPG, or WebP up to 2MB.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Details</h2>
        <div className="mt-4 grid gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600">Display name</label>
            <Input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Phone</label>
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+234 801 234 5678"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Email</label>
            <Input value={email} disabled />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
        {success && <p className="mt-4 text-sm text-emerald-600">{success}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
          <Link href="/auth/reset" className="text-sm font-semibold text-sky-700">
            Change password
          </Link>
        </div>
      </section>
    </div>
  );
}
