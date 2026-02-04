export const BRAND_NAME = "PropatyHub";
export const BRAND_SHORT_NAME = "PropatyHub";
export const BRAND_DOMAIN_PRIMARY = "propatyhub.com";
export const BRAND_DOMAIN_PREVIEW = "rentnow-ashem.vercel.app";
export const BRAND_SUPPORT_EMAIL = "support@propatyhub.com";
export const BRAND_TAGLINE = "Property Rentals & Sales Re-Imagined";
export const BRAND_LOGO_LIGHT = "/logo.svg";
export const BRAND_LOGO_DARK = "/logo-dark.svg";
export const BRAND_MARK = "/mark.svg";
export const BRAND_OG_IMAGE = "/og-propatyhub.png";
export const BRAND_SITE_URL = `https://www.${BRAND_DOMAIN_PRIMARY}`;

export const BRAND = {
  name: BRAND_NAME,
  shortName: BRAND_SHORT_NAME,
  domain: BRAND_DOMAIN_PRIMARY,
  siteUrl: BRAND_SITE_URL,
  contactEmail: BRAND_SUPPORT_EMAIL,
  tagline: BRAND_TAGLINE,
  logo: {
    light: BRAND_LOGO_LIGHT,
    dark: BRAND_LOGO_DARK,
  },
  mark: BRAND_MARK,
  ogImage: BRAND_OG_IMAGE,
} as const;

export function getBrandHostLabel(hostname?: string | null) {
  if (!hostname) return "live";
  const normalized = hostname.toLowerCase();
  if (
    normalized === BRAND_DOMAIN_PREVIEW ||
    normalized.endsWith(`.${BRAND_DOMAIN_PREVIEW}`)
  ) {
    return "preview";
  }
  return "live";
}

export type BrandConfig = typeof BRAND;
