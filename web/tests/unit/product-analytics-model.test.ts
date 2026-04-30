import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCT_ANALYTICS_EVENT_NAMES,
  getProductAnalyticsEventFamily,
  normalizeProductAnalyticsProperties,
} from '@/lib/analytics/product-events';

test('product analytics event names stay constrained to the approved funnel set', () => {
  assert.deepEqual(PRODUCT_ANALYTICS_EVENT_NAMES, [
    'bootcamp_page_viewed',
    'bootcamp_cta_clicked',
    'bootcamp_faq_expanded',
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
    'property_request_alert_subscription_created',
    'property_request_alert_subscription_deleted',
    'property_request_subscriber_alert_sent',
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
    'property_prep_supplier_application_started',
    'property_prep_supplier_application_submitted',
    'property_prep_supplier_approved',
    'property_prep_supplier_rejected',
    'property_prep_request_route_ready',
    'property_prep_request_manual_routing_required',
  ]);
});

test('event family mapping stays stable', () => {
  assert.equal(getProductAnalyticsEventFamily('bootcamp_page_viewed'), 'host_activation');
  assert.equal(getProductAnalyticsEventFamily('bootcamp_cta_clicked'), 'host_activation');
  assert.equal(getProductAnalyticsEventFamily('bootcamp_faq_expanded'), 'host_activation');
  assert.equal(getProductAnalyticsEventFamily('search_performed'), 'search_browse');
  assert.equal(getProductAnalyticsEventFamily('listing_viewed'), 'listing_engagement');
  assert.equal(getProductAnalyticsEventFamily('listing_detail_section_viewed'), 'listing_engagement');
  assert.equal(getProductAnalyticsEventFamily('property_request_published'), 'tenant_intent');
  assert.equal(getProductAnalyticsEventFamily('property_request_alert_subscription_created'), 'host_activation');
  assert.equal(getProductAnalyticsEventFamily('property_request_alert_subscription_deleted'), 'host_activation');
  assert.equal(getProductAnalyticsEventFamily('property_request_subscriber_alert_sent'), 'host_activation');
  assert.equal(getProductAnalyticsEventFamily('listing_limit_recovery_viewed'), 'billing');
  assert.equal(getProductAnalyticsEventFamily('checkout_succeeded'), 'billing');
  assert.equal(getProductAnalyticsEventFamily('listing_published_live'), 'host_activation');
  assert.equal(getProductAnalyticsEventFamily('qr_generated'), 'host_activation');
  assert.equal(getProductAnalyticsEventFamily('qr_redirect_succeeded'), 'listing_engagement');
  assert.equal(getProductAnalyticsEventFamily('service_request_submitted'), 'move_ready_services');
  assert.equal(getProductAnalyticsEventFamily('property_prep_supplier_application_started'), 'move_ready_services');
  assert.equal(getProductAnalyticsEventFamily('property_prep_request_manual_routing_required'), 'move_ready_services');
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
