type DigestListing = {
  id: string;
  title: string;
  city: string | null;
  price: number | null;
  currency: string | null;
};

export type SavedSearchDigestGroup = {
  savedSearchId: string;
  searchName: string;
  matchCount: number;
  matchesUrl: string;
  unsubscribeUrl: string;
  listings: DigestListing[];
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPrice(input: { amount: number | null; currency: string | null }) {
  if (!Number.isFinite(input.amount ?? NaN)) return "Price unavailable";
  const value = Number(input.amount ?? 0);
  const currency = input.currency || "NGN";
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function buildGroupRows(input: { siteUrl: string; group: SavedSearchDigestGroup }) {
  return input.group.listings
    .slice(0, 4)
    .map((listing) => {
      const listingUrl = `${input.siteUrl}/properties/${listing.id}`;
      const price = formatPrice({ amount: listing.price, currency: listing.currency });
      const city = listing.city || "Location not set";
      return `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
            <a href="${listingUrl}" style="font-weight: 600; color: #0f172a; text-decoration: none;">
              ${escapeHtml(listing.title)}
            </a>
            <div style="color: #475569; font-size: 12px; margin-top: 4px;">
              ${escapeHtml(city)} · ${escapeHtml(price)}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function buildGroupSection(input: { siteUrl: string; group: SavedSearchDigestGroup }) {
  const rows = buildGroupRows(input);
  return `
    <section style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 14px;">
      <h3 style="margin: 0 0 6px; font-size: 16px; color: #0f172a;">
        ${escapeHtml(input.group.searchName)}
      </h3>
      <p style="margin: 0 0 10px; color: #334155; font-size: 13px;">
        ${input.group.matchCount} new match${input.group.matchCount === 1 ? "" : "es"} since last sent.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 10px;">
        ${rows}
      </table>
      <a href="${input.group.matchesUrl}" style="display: inline-block; background: #0ea5e9; color: #ffffff; padding: 8px 12px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13px;">
        View matches
      </a>
      <p style="margin: 10px 0 0; color: #64748b; font-size: 12px;">
        <a href="${input.group.unsubscribeUrl}" style="color: #0f766e;">Disable alerts for this search</a>
      </p>
    </section>
  `;
}

export function buildSavedSearchDigestEmail(input: {
  siteUrl: string;
  groups: SavedSearchDigestGroup[];
  omittedSearchCount?: number;
}) {
  const sections = input.groups.map((group) => buildGroupSection({ siteUrl: input.siteUrl, group }));
  const manageUrl = `${input.siteUrl}/saved-searches`;
  const subject = "New matches on PropatyHub";
  const omittedCopy =
    (input.omittedSearchCount ?? 0) > 0
      ? `<p style="margin: 10px 0 0; color: #334155; font-size: 13px;">
          Showing top ${input.groups.length} searches in this digest.
          You have ${input.omittedSearchCount} more search${
            input.omittedSearchCount === 1 ? "" : "es"
          } with updates. Use <a href="${manageUrl}" style="color: #0f766e;">View all</a>.
        </p>`
      : "";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; line-height: 1.5;">
      <h2 style="margin: 0 0 8px;">PropatyHub</h2>
      <p style="margin: 0 0 16px; color: #334155;">
        New homes matching your saved searches are available.
      </p>
      ${sections.join("\n")}
      ${omittedCopy}
      <p style="margin: 16px 0 0; color: #64748b; font-size: 12px;">
        Manage saved searches: <a href="${manageUrl}" style="color: #0f766e;">${manageUrl}</a>
      </p>
      <p style="margin: 8px 0 0; color: #64748b; font-size: 12px;">
        PropatyHub is a marketplace. Always verify viewing details before paying.
      </p>
      <p style="margin: 8px 0 0; color: #94a3b8; font-size: 12px;">
        You can disable alerts per search using the link in each section above.
      </p>
    </div>
  `;

  return { subject, html };
}
