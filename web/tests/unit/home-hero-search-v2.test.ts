import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homePage = readFileSync('/Users/olubusayoadewale/rentnow/web/app/page.tsx', 'utf8');
const heroSearchForm = readFileSync('/Users/olubusayoadewale/rentnow/web/components/home/HeroSearchForm.tsx', 'utf8');

void test('homepage swaps the legacy quick search form for Hero Search v2', () => {
  assert.match(homePage, /HeroSearchForm/);
  assert.doesNotMatch(homePage, /QuickSearchForm/);
});

void test('hero search form exposes the approved top-level modes', () => {
  assert.match(heroSearchForm, /label: "Rent"/);
  assert.match(heroSearchForm, /label: "Buy"/);
  assert.match(heroSearchForm, /label: "Shortlets"/);
});

void test('hero search form keeps the MVP field set and hero source attribution', () => {
  assert.match(heroSearchForm, /Location/);
  assert.match(heroSearchForm, /Budget/);
  assert.match(heroSearchForm, /Bedrooms|Guests/);
  assert.match(heroSearchForm, /Property type|Stay type/);
  assert.match(heroSearchForm, /source: "home_hero_v2"/);
});

void test('desktop homepage keeps hero primary and demotes smart search below featured homes', () => {
  const heroIndex = homePage.indexOf('data-testid="desktop-home-hero"');
  const featuredIndex = homePage.indexOf('data-testid="featured-homes-section"');
  const smartSearchIndex = homePage.indexOf('data-testid="desktop-home-smart-search-assist"');

  assert.ok(heroIndex >= 0, 'expected desktop hero marker');
  assert.ok(featuredIndex >= 0, 'expected featured homes section marker');
  assert.ok(smartSearchIndex >= 0, 'expected desktop smart search assist marker');
  assert.ok(heroIndex < featuredIndex, 'expected hero above featured homes');
  assert.ok(featuredIndex < smartSearchIndex, 'expected smart search assist below featured homes');
});
