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
