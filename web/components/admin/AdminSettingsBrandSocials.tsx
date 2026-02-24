"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";

type BrandSocialSettings = {
  instagramUrl: string;
  youtubeUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
  whatsappLink: string;
};

type Props = {
  settings: BrandSocialSettings;
  updatedAt: {
    instagramUrl: string | null;
    youtubeUrl: string | null;
    tiktokUrl: string | null;
    facebookUrl: string | null;
    whatsappLink: string | null;
  };
};

type SocialField = {
  key: keyof BrandSocialSettings;
  label: string;
  placeholder: string;
  settingKey: string;
  helper: string;
};

const SOCIAL_FIELDS: SocialField[] = [
  {
    key: "instagramUrl",
    label: "Instagram URL",
    placeholder: "https://instagram.com/propatyhub",
    settingKey: APP_SETTING_KEYS.brandSocialInstagramUrl,
    helper: "Public profile link shown in footer and menu when set.",
  },
  {
    key: "youtubeUrl",
    label: "YouTube URL",
    placeholder: "https://youtube.com/@propatyhub",
    settingKey: APP_SETTING_KEYS.brandSocialYoutubeUrl,
    helper: "Channel or profile link.",
  },
  {
    key: "tiktokUrl",
    label: "TikTok URL",
    placeholder: "https://www.tiktok.com/@propatyhub",
    settingKey: APP_SETTING_KEYS.brandSocialTiktokUrl,
    helper: "Profile link shown as TikTok.",
  },
  {
    key: "facebookUrl",
    label: "Facebook URL",
    placeholder: "https://facebook.com/propatyhub",
    settingKey: APP_SETTING_KEYS.brandSocialFacebookUrl,
    helper: "Page link for Facebook.",
  },
  {
    key: "whatsappLink",
    label: "WhatsApp link or number",
    placeholder: "https://wa.me/2348000000000 or 2348000000000",
    settingKey: APP_SETTING_KEYS.brandSocialWhatsappLink,
    helper: "Supports a full WhatsApp URL or digits-only number.",
  },
];

export default function AdminSettingsBrandSocials({ settings, updatedAt }: Props) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<BrandSocialSettings>(settings);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const save = () => {
    setError(null);
    setToast(null);
    startTransition(async () => {
      try {
        const payloads = SOCIAL_FIELDS.map((field) => ({
          key: field.settingKey,
          value: { value: draft[field.key].trim() },
        }));
        const responses = await Promise.all(
          payloads.map((payload) =>
            fetch("/api/admin/app-settings", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          )
        );
        for (const response of responses) {
          if (response.ok) continue;
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error || "Unable to save social links.");
        }
        setDraft((prev) => ({
          ...prev,
          instagramUrl: prev.instagramUrl.trim(),
          youtubeUrl: prev.youtubeUrl.trim(),
          tiktokUrl: prev.tiktokUrl.trim(),
          facebookUrl: prev.facebookUrl.trim(),
          whatsappLink: prev.whatsappLink.trim(),
        }));
        setToast("Brand social links saved.");
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Unable to save social links.");
      }
    });
  };

  const lastUpdated =
    updatedAt.instagramUrl ||
    updatedAt.youtubeUrl ||
    updatedAt.tiktokUrl ||
    updatedAt.facebookUrl ||
    updatedAt.whatsappLink ||
    null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Brand &amp; Socials</h2>
        <p className="text-sm text-slate-600">
          Add public social links for footer and hamburger menu. Empty values stay hidden.
        </p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {SOCIAL_FIELDS.map((field) => (
          <label key={field.key} className="space-y-1 text-sm text-slate-700">
            <span className="font-medium">{field.label}</span>
            <input
              type="text"
              value={draft[field.key]}
              placeholder={field.placeholder}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  [field.key]: event.target.value,
                }))
              }
              className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <span className="text-xs text-slate-500">{field.helper}</span>
          </label>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "Never"}
      </p>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save social links"}
        </Button>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        {toast ? <p className="text-xs text-emerald-600">{toast}</p> : null}
      </div>
    </section>
  );
}
