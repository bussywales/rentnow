import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroSearchHref, getHeroSearchPropertyTypeOptions } from '@/lib/home/hero-search';

void test('hero rent mode builds a long-term properties browse URL with source attribution', () => {
  const href = buildHeroSearchHref('rent', {
    location: 'Lagos',
    minPrice: '150000',
    maxPrice: '450000',
    bedrooms: '2',
    propertyType: 'apartment',
    source: 'home_hero_v2',
  });

  assert.equal(
    href,
    '/properties?category=rent&intent=rent&page=1&city=Lagos&minPrice=150000&maxPrice=450000&bedrooms=2&propertyType=apartment&rentalType=long_term&source=home_hero_v2'
  );
});

void test('hero buy mode builds a for-sale browse URL', () => {
  const href = buildHeroSearchHref('buy', {
    location: 'Abuja',
    propertyType: 'land',
    source: 'home_hero_v2',
  });

  assert.equal(
    href,
    '/properties?category=buy&intent=buy&page=1&city=Abuja&propertyType=land&source=home_hero_v2'
  );
});

void test('hero shortlet mode routes into dedicated shortlets search with guests and market', () => {
  const href = buildHeroSearchHref('shortlet', {
    location: 'Lekki',
    bedrooms: '4',
    minPrice: '80000',
    maxPrice: '250000',
    propertyType: 'condo',
    marketCountry: 'NG',
    source: 'home_hero_v2',
  });

  assert.equal(
    href,
    '/shortlets?where=Lekki&market=NG&guests=4&minPrice=80000&maxPrice=250000&propertyType=condo&source=home_hero_v2'
  );
});

void test('hero property type options are mode-aware', () => {
  const buyOptions = getHeroSearchPropertyTypeOptions('buy').map((option) => option.value);
  const shortletOptions = getHeroSearchPropertyTypeOptions('shortlet').map((option) => option.value);

  assert.equal(buyOptions.includes('land'), true);
  assert.equal(shortletOptions.includes('land'), false);
  assert.equal(shortletOptions.includes('studio'), true);
});
