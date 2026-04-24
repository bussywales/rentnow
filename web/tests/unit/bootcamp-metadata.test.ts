import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBootcampMetadata } from '@/app/bootcamp/page';
import { BRAND_OG_IMAGE, BRAND_SITE_URL } from '@/lib/brand';

test('bootcamp metadata includes launch-ready canonical and sharing basics', () => {
  const metadata = buildBootcampMetadata(BRAND_SITE_URL);
  const canonical = `${BRAND_SITE_URL}/bootcamp`;
  const ogImage = `${BRAND_SITE_URL}${BRAND_OG_IMAGE}`;

  assert.equal(metadata.alternates?.canonical, canonical);
  assert.deepEqual(metadata.robots, { index: true, follow: true });
  assert.equal(metadata.openGraph?.url, canonical);
  assert.equal(metadata.openGraph?.type, 'website');
  assert.equal(metadata.openGraph?.images?.[0]?.url, ogImage);
  assert.equal(metadata.twitter?.card, 'summary_large_image');
  assert.equal(metadata.twitter?.images?.[0], ogImage);
});
