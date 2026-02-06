"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ensureProfileRow, type ProfileRecord } from "@/lib/profile/ensure-profile";
import { shouldEnsureAgentSlug } from "@/lib/agents/agent-storefront";
import { shouldShowClientPagesShortcut } from "@/lib/profile/client-pages-shortcut";

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
  const [agentStorefrontEnabled, setAgentStorefrontEnabled] = useState(
    initialProfile?.agent_storefront_enabled ?? true
  );
  const [agentBio, setAgentBio] = useState(initialProfile?.agent_bio ?? "");
  const [agentSlug, setAgentSlug] = useState(initialProfile?.agent_slug ?? null);
  const [copyState, setCopyState] = useState<string | null>(null);
  const [slugUpdating, setSlugUpdating] = useState(false);
  const ensureSlugRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState({
    displayName: initialProfile?.display_name ?? initialProfile?.full_name ?? "",
    phone: initialProfile?.phone ?? "",
    avatarUrl: initialProfile?.avatar_url ?? null,
    agentStorefrontEnabled: initialProfile?.agent_storefront_enabled ?? true,
    agentBio: initialProfile?.agent_bio ?? "",
    agentSlug: initialProfile?.agent_slug ?? null,
  });

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  const showClientPages = shouldShowClientPagesShortcut(profile?.role ?? null);

  useEffect(() => {
    if (profile || !supabase) return;
    const load = async () => {
      setLoadingProfile(true);
      setLoadError(null);
      const result = await ensureProfileRow({ client: supabase, userId, email });
      if (result.error) {
        console.error("profile.load", result.error);
        setLoadError("Unable to load profile. Please try again.");
        setLoadingProfile(false);
        return;
      }
      const nextProfile = result.profile;
      if (!nextProfile) {
        console.error("profile.load.missing", {
          message: "Profile row not found after create.",
          userId,
        });
        setLoadError("Unable to load profile. Please try again.");
        setLoadingProfile(false);
        return;
      }
      setProfile(nextProfile);
      const nextName = nextProfile?.display_name ?? nextProfile?.full_name ?? "";
      setDisplayName(nextName);
      setPhone(nextProfile?.phone ?? "");
      setAvatarUrl(nextProfile?.avatar_url ?? null);
      setAgentStorefrontEnabled(nextProfile?.agent_storefront_enabled ?? true);
      setAgentBio(nextProfile?.agent_bio ?? "");
      setAgentSlug(nextProfile?.agent_slug ?? null);
      setCopyState(null);
      setSnapshot({
        displayName: nextName,
        phone: nextProfile?.phone ?? "",
        avatarUrl: nextProfile?.avatar_url ?? null,
        agentStorefrontEnabled: nextProfile?.agent_storefront_enabled ?? true,
        agentBio: nextProfile?.agent_bio ?? "",
        agentSlug: nextProfile?.agent_slug ?? null,
      });
      setLoadingProfile(false);
    };
    void load();
  }, [profile, supabase, userId, email, retryToken]);

  useEffect(() => {
    if (!profile || !supabase) return;
    if (ensureSlugRef.current) return;
    if (profile.role !== "agent") return;
    if (!shouldEnsureAgentSlug({ enabled: true, slug: agentSlug })) return;
    ensureSlugRef.current = true;
    void (async () => {
      const slugRes = await fetch("/api/profile/agent-storefront", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          enabled: agentStorefrontEnabled,
          bio: agentBio,
        }),
      });
      if (slugRes.ok) {
        const data = await slugRes.json().catch(() => ({}));
        if (typeof data?.slug === "string") {
          setAgentSlug(data.slug);
          setSnapshot((prev) => ({ ...prev, agentSlug: data.slug }));
        }
      }
    })();
  }, [agentBio, agentStorefrontEnabled, agentSlug, displayName, profile, supabase]);

  const initials = getInitials(displayName || email || "U");
  const isAgent = profile?.role === "agent";
  const hasChanges =
    !!profile &&
    (displayName.trim() !== snapshot.displayName ||
      phone.trim() !== snapshot.phone ||
      avatarUrl !== snapshot.avatarUrl ||
      (isAgent &&
        (agentStorefrontEnabled !== snapshot.agentStorefrontEnabled ||
          agentBio.trim() !== snapshot.agentBio ||
          agentSlug !== snapshot.agentSlug)));
  const storefrontPath = agentSlug ? `/agents/${agentSlug}` : "";
  const baseUrl =
    (typeof window !== "undefined" ? window.location.origin : "") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";
  const storefrontUrl = storefrontPath ? `${baseUrl}${storefrontPath}` : "";

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
      ...(isAgent
        ? {
            agent_storefront_enabled: agentStorefrontEnabled,
            agent_bio: agentBio.trim() || null,
          }
        : {}),
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
        agentStorefrontEnabled,
        agentBio: payload.agent_bio ?? "",
        agentSlug,
      });
      setSuccess("Profile updated.");
    }
    if (!updateError && isAgent && (agentStorefrontEnabled || agentSlug)) {
      const slugRes = await fetch("/api/profile/agent-storefront", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          enabled: agentStorefrontEnabled,
          bio: agentBio,
        }),
      });
      if (slugRes.ok) {
        const data = await slugRes.json().catch(() => ({}));
        if (typeof data?.slug === "string") {
          setAgentSlug(data.slug);
          setSnapshot((prev) => ({ ...prev, agentSlug: data.slug }));
          setCopyState(null);
        }
      } else if (agentStorefrontEnabled && !agentSlug) {
        setError(
          "Profile saved, but we couldn’t generate your storefront link. Please try again."
        );
      }
    }
    setSaving(false);
  };

  const handleRegenerateSlug = async () => {
    if (!profile || profile.role !== "agent") return;
    setSlugUpdating(true);
    setError(null);
    setSuccess(null);
    try {
      const slugRes = await fetch("/api/profile/agent-storefront", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          force: true,
          enabled: agentStorefrontEnabled,
          bio: agentBio,
        }),
      });
      if (!slugRes.ok) {
        setError("Unable to regenerate storefront link. Please try again.");
        return;
      }
      const data = await slugRes.json().catch(() => ({}));
      if (typeof data?.slug === "string") {
        setAgentSlug(data.slug);
        setSnapshot((prev) => ({ ...prev, agentSlug: data.slug }));
        setSuccess("Storefront link updated.");
        setCopyState(null);
      } else {
        setError("Unable to regenerate storefront link. Please try again.");
      }
    } finally {
      setSlugUpdating(false);
    }
  };

  const handleCopyStorefront = async () => {
    if (!storefrontPath) return;
    setCopyState(null);
    try {
      await navigator.clipboard.writeText(storefrontUrl || storefrontPath);
      setCopyState("Copied!");
      setTimeout(() => setCopyState(null), 2000);
    } catch {
      setCopyState("Copy failed");
    }
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

      {loadError && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{loadError}</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setLoadError(null);
                setRetryToken((value) => value + 1);
              }}
            >
              Try again
            </Button>
          </div>
        </section>
      )}

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

      {isAgent && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Agent storefront</h2>
          <p className="mt-1 text-sm text-slate-600">
            Control your public agent page and the short bio shown to tenants.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">
                Show my Agent Storefront publicly
              </p>
              <p className="text-xs text-slate-500">
                When off, your storefront page is hidden.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-slate-900"
                checked={agentStorefrontEnabled}
                onChange={(event) => setAgentStorefrontEnabled(event.target.checked)}
                data-testid="agent-storefront-toggle"
              />
              {agentStorefrontEnabled ? "Enabled" : "Disabled"}
            </label>
          </div>
          <div className="mt-4 grid gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600">Public bio</label>
              <Textarea
                value={agentBio}
                onChange={(event) => setAgentBio(event.target.value)}
                placeholder="A short summary about your agency or expertise."
                rows={4}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                Public storefront URL
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Input
                  value={storefrontUrl || (storefrontPath ? storefrontPath : "Generating link...")}
                  readOnly
                  data-testid="agent-storefront-url"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyStorefront}
                  disabled={!storefrontPath}
                >
                  {copyState ?? "Copy link"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerateSlug}
                  disabled={slugUpdating}
                >
                  {slugUpdating ? "Regenerating..." : "Regenerate slug"}
                </Button>
              </div>
            </div>
          </div>
          {showClientPages && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Client pages</p>
                  <p className="text-xs text-slate-600">
                    Build shortlists for clients and share a private link.
                  </p>
                </div>
                <Link href="/profile/clients" className="shrink-0">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid="client-pages-storefront-shortcut"
                  >
                    Manage client pages
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
