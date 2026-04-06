import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCT_ANALYTICS_EVENT_NAMES,
  getProductAnalyticsEventFamily,
  normalizeProductAnalyticsProperties,
} from '@/lib/analytics/product-events';

test('product analytics event names stay constrained to the approved funnel set', () => {
  assert.deepEqual(PRODUCT_ANALYTICS_EVENT_NAMES, [
    'search_performed',
    'filter_applied',
    'result_clicked',
    'listing_viewed',
    'listing_save_clicked',
    'listing_unsave_clicked',
    'shortlist_created',
    'shortlist_shared',
    'property_request_started',
    'property_request_published',
    'contact_submitted',
    'viewing_request_submitted',
    'billing_page_viewed',
    'plan_selected',
    'checkout_started',
    'checkout_succeeded',
    'listing_created',
    'listing_submitted_for_review',
    'listing_published_live',
  ]);
});

test('event family mapping stays stable', () => {
  assert.equal(getProductAnalyticsEventFamily('search_performed'), 'search_browse');
  assert.equal(getProductAnalyticsEventFamily('listing_viewed'), 'listing_engagement');
  assert.equal(getProductAnalyticsEventFamily('property_request_published'), 'tenant_intent');
  assert.equal(getProductAnalyticsEventFamily('checkout_succeeded'), 'billing');
  assert.equal(getProductAnalyticsEventFamily('listing_published_live'), 'host_activation');
});

test('normalizeProductAnalyticsProperties drops unknown properties', () => {
  assert.deepEqual(
    normalizeProductAnalyticsProperties({
      market: 'UK',
      role: 'tenant',
      listingId: '9dfe19b2-f303-470f-b896-e7127195c9b4',
      unknown: 'ignore-me',
    }),
    {
      market: 'UK',
      role: 'tenant',
      listingId: '9dfe19b2-f303-470f-b896-e7127195c9b4',
    }
  );
});
