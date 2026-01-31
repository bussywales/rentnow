export const BRAND = {
  name: "PropatyHub",
  shortName: "PropatyHub",
  domain: "propatyhub.com",
  siteUrl: "https://www.propatyhub.com",
  contactEmail: "hello@propatyhub.com",
  tagline: "African rentals reimagined.",
  logo: {
    light: "/brand/logo.svg",
    dark: "/brand/logo.svg",
  },
} as const;

export type BrandConfig = typeof BRAND;
