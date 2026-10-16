import test from 'node:test';
import assert from 'node:assert/strict';
import { sign, verify, assertFile, checkPassword, sameOrigin, isAdmin, isConfigured } from './drive.js';
const secret = 'a-secure-test-secret-of-at-least-32-characters';
test('sessions expire and signatures cannot be altered', () => {
  const token = sign({ role: 'admin', exp: Date.now() + 10000 }, secret);
  assert.equal(verify(token, secret).role, 'admin');
  assert.equal(verify(token + 'x', secret), null);
  assert.equal(verify(sign({ exp: 1 }, secret), secret), null);
  assert.equal(verify(token, 'another-secret'), null);
});
test('rejects oversized files, active content, and invalid lengths', () => {
  assert.doesNotThrow(() => assertFile({ name: 'photo.jpg', type: 'image/jpeg', size: 30000000 }));
  for (const file of [
    { name: 'x.svg', type: 'image/svg+xml', size: 1 },
    { name: 'x.jpg', type: 'image/jpeg', size: 0 },
    { name: 'x.mp4', type: 'video/mp4', size: 513 * 1024 * 1024 },
    { name: 'x.jpg', type: 'image/jpeg', size: '100' },
  ]) assert.throws(() => assertFile(file));
});
test('password fails closed without configuration', () => {
  assert.equal(checkPassword('password', ''), false);
  assert.equal(checkPassword('password', 'password'), true);
  assert.equal(checkPassword('wrong', 'password'), false);
  assert.equal(checkPassword({}, 'password'), false);
  assert.equal(isConfigured({}), false);
  assert.equal(isAdmin({ headers: {} }), false);
});
test('write requests require the configured gallery origin', () => {
  assert.equal(sameOrigin({ headers: { origin: 'https://evil.example' } }), false);
  assert.equal(sameOrigin({ headers: {} }), false);
});

test('request cache shares concurrent lookups and expires successful values', async () => {
  const { createRequestCache } = await import('./drive.js');
  let now = 0;
  const cached = createRequestCache({ ttlMs: 10, now: () => now });
  let calls = 0;
  const read = async () => { calls++; return { id: calls }; };
  const results = await Promise.all(Array.from({ length: 20 }, () => cached('file', read)));
  assert.equal(calls, 1);
  assert.ok(results.every(result => result === results[0]));
  now = 11;
  assert.equal((await cached('file', read)).id, 2);
});
test('failed and missing lookups are retried; cache stays bounded', async () => {
  const { createRequestCache } = await import('./drive.js');
  const cached = createRequestCache({ maxEntries: 1 });
  await assert.rejects(cached('file', async () => { throw new Error('temporary'); }), /temporary/);
  assert.equal(await cached('file', async () => null), null);
  assert.equal(await cached('file', async () => 'ready'), 'ready');
  await cached('other', async () => 'other');
  assert.equal(await cached('file', async () => 'reloaded'), 'reloaded');
});
test('thumbnail credentials are restricted to HTTPS Google thumbnail hosts', async () => {
  const { isThumbnailUrl } = await import('./drive.js');
  assert.equal(isThumbnailUrl('https://lh3.googleusercontent.com/example=s220'), true);
  for (const url of ['https://googleusercontent.com.evil.example/a', 'http://lh3.googleusercontent.com/a', 'https://evil.example/a', 'https://user:pass@lh3.googleusercontent.com/a', 'https://lh3.googleusercontent.com:8080/a', '/relative']) {
    assert.equal(isThumbnailUrl(url), false);
  }
});
