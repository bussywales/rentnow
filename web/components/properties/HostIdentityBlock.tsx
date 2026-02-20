import Link from "next/link";

type Props = {
  hostProfileIsPublicAdvertiser: boolean;
  ownerId: string | null;
  hostProfileHref: string | null;
  hostProfileName: string | null;
};

export function HostIdentityBlock({
  hostProfileIsPublicAdvertiser,
  ownerId,
  hostProfileHref,
  hostProfileName,
}: Props) {
  if (hostProfileIsPublicAdvertiser && ownerId) {
    return (
      <Link
        href={hostProfileHref ?? `/u/${ownerId}`}
        className="text-xs font-semibold text-slate-700 underline-offset-4 hover:text-sky-700 hover:underline"
      >
        {hostProfileName || "View advertiser profile"}
      </Link>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-700">Host profile private</p>
      <p className="text-xs text-slate-500">
        This host has chosen not to display their profile publicly.
      </p>
    </div>
  );
}
