import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANALYTICS_ATTRIBUTION_COOKIE_NAME,
  buildAnalyticsAttributionCookieString,
  extractAnalyticsAttribution,
  mergeAnalyticsAttribution,
  parseAnalyticsAttributionCookie,
  readAnalyticsAttributionFromCookieHeader,
} from '@/lib/analytics/acquisition';

test('extractAnalyticsAttribution returns null without utm params', () => {
  const params = new URLSearchParams('city=London');
  assert.equal(extractAnalyticsAttribution(params), null);
});

test('mergeAnalyticsAttribution preserves first known utms and updates landing path', () => {
  const merged = mergeAnalyticsAttribution({
    existing: {
      utm_source: 'facebook',
      utm_medium: 'paid_social',
      utm_campaign: 'uk_launch',
      utm_content: null,
      utm_term: null,
      landing_path: '/old',
      captured_at: '2026-04-06T10:00:00.000Z',
      referrer: 'https://facebook.com',
    },
    incoming: {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: 'creative-a',
      utm_term: null,
      landing_path: null,
      captured_at: null,
      referrer: null,
    },
    landingPath: '/properties?utm_source=facebook',
    capturedAt: '2026-04-06T10:05:00.000Z',
    referrer: 'https://m.facebook.com',
  });

  assert.deepEqual(merged, {
    utm_source: 'facebook',
    utm_medium: 'paid_social',
    utm_campaign: 'uk_launch',
    utm_content: 'creative-a',
    utm_term: null,
    landing_path: '/properties?utm_source=facebook',
    captured_at: '2026-04-06T10:05:00.000Z',
    referrer: 'https://m.facebook.com',
  });
});

test('attribution cookie round-trip works from cookie header', () => {
  const cookieValue = buildAnalyticsAttributionCookieString({
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: 'tenant_yearly',
    utm_content: 'headline-b',
    utm_term: 'london flat',
    landing_path: '/properties',
    captured_at: '2026-04-06T11:00:00.000Z',
    referrer: 'https://google.com',
  });

  const header = `other=1; ${cookieValue.split(';')[0]}; another=2`;
  assert.deepEqual(readAnalyticsAttributionFromCookieHeader(header), {
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: 'tenant_yearly',
    utm_content: 'headline-b',
    utm_term: 'london flat',
    landing_path: '/properties',
    captured_at: '2026-04-06T11:00:00.000Z',
    referrer: 'https://google.com',
  });

  const raw = header.match(new RegExp(`${ANALYTICS_ATTRIBUTION_COOKIE_NAME}=([^;]+)`))?.[1] ?? null;
  assert.deepEqual(parseAnalyticsAttributionCookie(raw ? decodeURIComponent(raw) : null), {
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: 'tenant_yearly',
    utm_content: 'headline-b',
    utm_term: 'london flat',
    landing_path: '/properties',
    captured_at: '2026-04-06T11:00:00.000Z',
    referrer: 'https://google.com',
  });
});
