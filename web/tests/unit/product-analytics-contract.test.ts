import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rootLayout = readFileSync('/Users/olubusayoadewale/rentnow/web/app/layout.tsx', 'utf8');
const propertiesPage = readFileSync('/Users/olubusayoadewale/rentnow/web/app/properties/page.tsx', 'utf8');
const propertyDetailPage = readFileSync('/Users/olubusayoadewale/rentnow/web/app/properties/[id]/page.tsx', 'utf8');
const billingPage = readFileSync('/Users/olubusayoadewale/rentnow/web/app/dashboard/billing/page.tsx', 'utf8');
const plansGrid = readFileSync('/Users/olubusayoadewale/rentnow/web/components/billing/PlansGrid.tsx', 'utf8');

test('root layout mounts product analytics bootstrap', () => {
  assert.match(rootLayout, /ProductAnalyticsBootstrap/);
});

test('browse page mounts properties analytics tracker', () => {
  assert.match(propertiesPage, /PropertiesBrowseAnalyticsTracker/);
});

test('property detail page tracks listing view', () => {
  assert.match(propertyDetailPage, /ProductEventTracker/);
  assert.match(propertyDetailPage, /listing_viewed/);
});

test('billing page tracks billing page view and plans grid tracks plan selection', () => {
  assert.match(billingPage, /billing_page_viewed/);
  assert.match(plansGrid, /plan_selected/);
});
