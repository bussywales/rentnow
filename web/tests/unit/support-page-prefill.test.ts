import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const supportPageSource = fs.readFileSync(
  path.join(process.cwd(), 'app', 'support', 'page.tsx'),
  'utf8'
);
const supportClientSource = fs.readFileSync(
  path.join(process.cwd(), 'components', 'support', 'SupportPageClient.tsx'),
  'utf8'
);
const supportFormSource = fs.readFileSync(
  path.join(process.cwd(), 'components', 'support', 'SupportContactForm.tsx'),
  'utf8'
);

test('support page consumes CTA query params and forwards them into the support form', () => {
  assert.match(supportPageSource, /readSingleParam\(resolvedSearchParams, "category"\)/);
  assert.match(supportPageSource, /readSingleParam\(resolvedSearchParams, "message"\)/);
  assert.match(supportPageSource, /initialCategory=\{initialCategory\}/);
  assert.match(supportPageSource, /initialMessage=\{initialMessage\}/);
  assert.match(supportClientSource, /initialCategory\?: SupportCategory/);
  assert.match(supportClientSource, /initialMessage\?: string \| null/);
  assert.match(supportClientSource, /useState<SupportCategory>\(\s*initialCategory \?\? "general"/);
  assert.match(supportClientSource, /initialMessage=\{initialMessage\}/);
  assert.match(supportFormSource, /initialMessage\?: string \| null/);
  assert.match(supportFormSource, /useState\(initialMessage \?\? ""\)/);
  assert.match(supportFormSource, /id="support-form"/);
});
