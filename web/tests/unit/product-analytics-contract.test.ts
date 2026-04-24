import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rootLayout = readFileSync('/Users/olubusayoadewale/rentnow/web/app/layout.tsx', 'utf8');
const bootcampPage = readFileSync('/Users/olubusayoadewale/rentnow/web/app/bootcamp/page.tsx', 'utf8');
const bootcampHero = readFileSync('/Users/olubusayoadewale/rentnow/web/components/bootcamp/HeroSection.tsx', 'utf8');
const bootcampHeader = readFileSync('/Users/olubusayoadewale/rentnow/web/components/bootcamp/HeaderNav.tsx', 'utf8');
const bootcampFinalCta = readFileSync('/Users/olubusayoadewale/rentnow/web/components/bootcamp/FinalCTASection.tsx', 'utf8');
const bootcampFaq = readFileSync('/Users/olubusayoadewale/rentnow/web/components/bootcamp/FAQSection.tsx', 'utf8');
const bootcampTrackedLink = readFileSync('/Users/olubusayoadewale/rentnow/web/components/bootcamp/BootcampTrackedButtonLink.tsx', 'utf8');
const bootcampTrackedTextLink = readFileSync('/Users/olubusayoadewale/rentnow/web/components/bootcamp/BootcampTrackedTextLink.tsx', 'utf8');
const propertiesPage = readFileSync('/Users/olubusayoadewale/rentnow/web/app/properties/page.tsx', 'utf8');
const propertyDetailPage = readFileSync('/Users/olubusayoadewale/rentnow/web/app/properties/[id]/page.tsx', 'utf8');
const billingPage = readFileSync('/Users/olubusayoadewale/rentnow/web/app/dashboard/billing/page.tsx', 'utf8');
const plansGrid = readFileSync('/Users/olubusayoadewale/rentnow/web/components/billing/PlansGrid.tsx', 'utf8');
const shortletsSearchShell = readFileSync('/Users/olubusayoadewale/rentnow/web/components/shortlets/search/ShortletsSearchShell.tsx', 'utf8');
const browseTrackerSource = readFileSync('/Users/olubusayoadewale/rentnow/web/components/analytics/PropertiesBrowseAnalyticsTracker.tsx', 'utf8');

test('root layout mounts product analytics bootstrap', () => {
  assert.match(rootLayout, /ProductAnalyticsBootstrap/);
});

test('bootcamp page mounts narrow launch analytics tracking', () => {
  assert.match(bootcampPage, /BootcampPageAnalytics/);
  assert.match(bootcampPage, /buildBootcampMetadata/);
  assert.match(bootcampTrackedLink, /bootcamp_cta_clicked/);
  assert.match(bootcampTrackedTextLink, /bootcamp_cta_clicked/);
  assert.match(bootcampHero, /BootcampTrackedButtonLink/);
  assert.match(bootcampHero, /BootcampTrackedTextLink/);
  assert.match(bootcampHeader, /BootcampTrackedButtonLink/);
  assert.match(bootcampHeader, /BootcampTrackedTextLink/);
  assert.match(bootcampFinalCta, /BootcampTrackedButtonLink/);
  assert.match(bootcampFaq, /bootcamp_faq_expanded/);
});

test('browse page mounts properties analytics tracker', () => {
  assert.match(propertiesPage, /PropertiesBrowseAnalyticsTracker/);
  assert.match(propertiesPage, /commercialFilterUsed/);
  assert.match(propertiesPage, /localLivingFilterUsed/);
  assert.match(browseTrackerSource, /commercial_filters_applied/);
  assert.match(browseTrackerSource, /local_living_filters_applied/);
});

test('shortlets search reuses product browse analytics tracking', () => {
  assert.match(shortletsSearchShell, /PropertiesBrowseAnalyticsTracker/);
});

test('property detail page tracks listing view', () => {
  assert.match(propertyDetailPage, /ProductEventTracker/);
  assert.match(propertyDetailPage, /listing_viewed/);
  assert.match(propertyDetailPage, /ProductEventSectionTracker/);
  assert.match(propertyDetailPage, /listing_detail_section_viewed/);
  assert.match(propertyDetailPage, /hasLocalLivingDetails/);
});

test('billing page tracks billing page view and plans grid tracks plan selection', () => {
  assert.match(billingPage, /billing_page_viewed/);
  assert.match(plansGrid, /plan_selected/);
});
