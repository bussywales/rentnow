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
    'listing_detail_section_viewed',
    'listing_save_clicked',
    'listing_unsave_clicked',
    'shortlist_created',
    'shortlist_shared',
    'property_request_started',
    'property_request_published',
    'contact_submitted',
    'viewing_request_submitted',
    'billing_page_viewed',
    'listing_limit_recovery_viewed',
    'listing_limit_recovery_cta_clicked',
    'plan_selected',
    'checkout_started',
    'checkout_succeeded',
    'listing_created',
    'listing_submitted_for_review',
    'listing_published_live',
    'qr_generated',
    'sign_kit_downloaded',
    'qr_redirect_succeeded',
    'qr_redirect_inactive_listing',
    'service_entrypoint_viewed',
    'service_request_started',
    'service_request_submitted',
    'service_request_matched',
    'service_request_unmatched',
    'provider_lead_sent',
    'provider_lead_accepted',
    'provider_lead_declined',
    'provider_response_submitted',
  ]);
});

test('event family mapping stays stable', () => {
  assert.equal(getProductAnalyticsEventFamily('search_performed'), 'search_browse');
  assert.equal(getProductAnalyticsEventFamily('listing_viewed'), 'listing_engagement');
  assert.equal(getProductAnalyticsEventFamily('listing_detail_section_viewed'), 'listing_engagement');
  assert.equal(getProductAnalyticsEventFamily('property_request_published'), 'tenant_intent');
  assert.equal(getProductAnalyticsEventFamily('listing_limit_recovery_viewed'), 'billing');
  assert.equal(getProductAnalyticsEventFamily('checkout_succeeded'), 'billing');
  assert.equal(getProductAnalyticsEventFamily('listing_published_live'), 'host_activation');
  assert.equal(getProductAnalyticsEventFamily('qr_generated'), 'host_activation');
  assert.equal(getProductAnalyticsEventFamily('qr_redirect_succeeded'), 'listing_engagement');
  assert.equal(getProductAnalyticsEventFamily('service_request_submitted'), 'move_ready_services');
});

test('normalizeProductAnalyticsProperties drops unknown properties', () => {
  assert.deepEqual(
    normalizeProductAnalyticsProperties({
      market: 'UK',
      role: 'tenant',
      listingId: '9dfe19b2-f303-470f-b896-e7127195c9b4',
      commercialFilterUsed: true,
      unknown: 'ignore-me',
    }),
    {
      market: 'UK',
      role: 'tenant',
      listingId: '9dfe19b2-f303-470f-b896-e7127195c9b4',
      commercialFilterUsed: true,
    }
  );
});
